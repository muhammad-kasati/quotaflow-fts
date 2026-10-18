import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { getCurrentUtcPeriod } from '../../lib/period';
import {
  ConsumeRequest,
  ConsumptionDecisionResponse,
  RejectionCode,
  RejectionScope,
  RequestStatus,
  ALERT_THRESHOLDS,
  QuotaSnapshot,
} from '@quotaflow/shared';
import { logger } from '../../lib/logger';

interface RawUsageRow {
  consumedUnits: number;
  acceptedRequests: number;
  rejectedRequests: number;
}

export async function processConsumption(
  accountId: string,
  dto: ConsumeRequest
): Promise<ConsumptionDecisionResponse> {
  const period = getCurrentUtcPeriod();
  const { userId, units, requestId } = dto;

  // 1. Verify user exists and belongs strictly to authenticated account
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      account: {
        include: {
          plan: {
            include: {
              versions: { orderBy: { version: 'desc' }, take: 1 },
            },
          },
        },
      },
      plan: {
        include: {
          versions: { orderBy: { version: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!user || user.accountId !== accountId) {
    throw new AppError(
      404,
      'USER_NOT_FOUND',
      `User '${userId}' was not found or does not belong to this account.`
    );
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'USER_INACTIVE', `User '${userId}' is not active.`);
  }

  const account = user.account;
  const accountPlan = account.plan;
  const userPlan = user.plan;

  // 2. Check Idempotency before entering transaction
  const existingRequest = await prisma.consumptionRequest.findUnique({
    where: {
      accountId_requestId: {
        accountId,
        requestId,
      },
    },
  });

  if (existingRequest) {
    // If exact match of parameters, return stored decision
    if (existingRequest.userId === userId && existingRequest.units === units) {
      const isAccepted = existingRequest.status === RequestStatus.ACCEPTED;
      const accountAllowance = accountPlan.monthlyAllowance;
      const userAllowance = userPlan.monthlyAllowance;

      return {
        accepted: isAccepted,
        requestId: existingRequest.requestId,
        unitsRequested: existingRequest.units,
        period: existingRequest.period,
        timestamp: existingRequest.createdAt.toISOString(),
        rejectionReason: existingRequest.rejectionReason,
        rejectionScope: (existingRequest.rejectionScope as RejectionScope) || null,
        rejectionCode: (existingRequest.rejectionCode as RejectionCode) || null,
        account: {
          monthlyAllowance: accountAllowance,
          consumedUnits: existingRequest.accountConsumedAfter,
          remainingUnits: existingRequest.accountRemainingAfter,
          usagePercentage: parseFloat(
            Math.min(100, (existingRequest.accountConsumedAfter / accountAllowance) * 100).toFixed(2)
          ),
          planId: accountPlan.id,
          planName: accountPlan.name,
          planVersion: accountPlan.version,
        },
        user: {
          monthlyAllowance: userAllowance,
          consumedUnits: existingRequest.userConsumedAfter,
          remainingUnits: existingRequest.userRemainingAfter,
          usagePercentage: parseFloat(
            Math.min(100, (existingRequest.userConsumedAfter / userAllowance) * 100).toFixed(2)
          ),
          planId: userPlan.id,
          planName: userPlan.name,
          planVersion: userPlan.version,
        },
        idempotentReplay: true,
      };
    } else {
      // Reused requestId with different parameters -> 409 Conflict
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        `Request ID '${requestId}' has already been processed with different parameters (user or units).`
      );
    }
  }

  // 3. PostgreSQL Transaction with Row-Level Locking (FOR UPDATE)
  return await prisma.$transaction(async (tx) => {
    // A. Ensure usage records exist for current period (ON CONFLICT DO NOTHING)
    await tx.$executeRaw`
      INSERT INTO "AccountMonthlyUsage" ("id", "accountId", "period", "consumedUnits", "acceptedRequests", "rejectedRequests", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${accountId}, ${period}, 0, 0, 0, NOW(), NOW())
      ON CONFLICT ("accountId", "period") DO NOTHING;
    `;

    await tx.$executeRaw`
      INSERT INTO "UserMonthlyUsage" ("id", "userId", "accountId", "period", "consumedUnits", "acceptedRequests", "rejectedRequests", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${userId}, ${accountId}, ${period}, 0, 0, 0, NOW(), NOW())
      ON CONFLICT ("userId", "period") DO NOTHING;
    `;

    // B. Acquire row locks in deterministic order (AccountUsage first, then UserUsage)
    const accountUsageRows = await tx.$queryRaw<RawUsageRow[]>`
      SELECT "consumedUnits", "acceptedRequests", "rejectedRequests"
      FROM "AccountMonthlyUsage"
      WHERE "accountId" = ${accountId} AND "period" = ${period}
      FOR UPDATE;
    `;

    const userUsageRows = await tx.$queryRaw<RawUsageRow[]>`
      SELECT "consumedUnits", "acceptedRequests", "rejectedRequests"
      FROM "UserMonthlyUsage"
      WHERE "userId" = ${userId} AND "period" = ${period}
      FOR UPDATE;
    `;

    const currentAccountConsumed = accountUsageRows[0]?.consumedUnits ?? 0;
    const currentUserConsumed = userUsageRows[0]?.consumedUnits ?? 0;

    // C. Deterministic Rejection Evaluation
    let isAccepted = true;
    let rejectionScope: RejectionScope | null = null;
    let rejectionCode: RejectionCode | null = null;
    let rejectionReason: string | null = null;

    // Rule 1: Account per-request limit
    if (units > accountPlan.maxUnitsPerRequest) {
      isAccepted = false;
      rejectionScope = RejectionScope.ACCOUNT;
      rejectionCode = RejectionCode.ACCOUNT_MAX_UNITS_EXCEEDED;
      rejectionReason = `Requested units (${units}) exceed account per-request maximum of ${accountPlan.maxUnitsPerRequest}.`;
    }
    // Rule 2: User per-request limit
    else if (units > userPlan.maxUnitsPerRequest) {
      isAccepted = false;
      rejectionScope = RejectionScope.USER;
      rejectionCode = RejectionCode.USER_MAX_UNITS_EXCEEDED;
      rejectionReason = `Requested units (${units}) exceed user per-request maximum of ${userPlan.maxUnitsPerRequest}.`;
    }
    // Rule 3: Account monthly quota
    else if (currentAccountConsumed + units > accountPlan.monthlyAllowance) {
      isAccepted = false;
      rejectionScope = RejectionScope.ACCOUNT;
      rejectionCode = RejectionCode.ACCOUNT_QUOTA_EXCEEDED;
      const rem = Math.max(0, accountPlan.monthlyAllowance - currentAccountConsumed);
      rejectionReason = `Account monthly quota exceeded. Available: ${rem} units, Requested: ${units} units.`;
    }
    // Rule 4: User monthly quota
    else if (currentUserConsumed + units > userPlan.monthlyAllowance) {
      isAccepted = false;
      rejectionScope = RejectionScope.USER;
      rejectionCode = RejectionCode.USER_QUOTA_EXCEEDED;
      const rem = Math.max(0, userPlan.monthlyAllowance - currentUserConsumed);
      rejectionReason = `User monthly quota exceeded. Available: ${rem} units, Requested: ${units} units.`;
    }

    // D. Apply Counter Updates & Persist Decision
    let accountConsumedAfter = currentAccountConsumed;
    let userConsumedAfter = currentUserConsumed;

    if (isAccepted) {
      accountConsumedAfter += units;
      userConsumedAfter += units;

      await tx.$executeRaw`
        UPDATE "AccountMonthlyUsage"
        SET "consumedUnits" = "consumedUnits" + ${units},
            "acceptedRequests" = "acceptedRequests" + 1,
            "updatedAt" = NOW()
        WHERE "accountId" = ${accountId} AND "period" = ${period};
      `;

      await tx.$executeRaw`
        UPDATE "UserMonthlyUsage"
        SET "consumedUnits" = "consumedUnits" + ${units},
            "acceptedRequests" = "acceptedRequests" + 1,
            "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND "period" = ${period};
      `;
    } else {
      // Rejection updates only rejected counter, zero units consumed
      await tx.$executeRaw`
        UPDATE "AccountMonthlyUsage"
        SET "rejectedRequests" = "rejectedRequests" + 1,
            "updatedAt" = NOW()
        WHERE "accountId" = ${accountId} AND "period" = ${period};
      `;

      await tx.$executeRaw`
        UPDATE "UserMonthlyUsage"
        SET "rejectedRequests" = "rejectedRequests" + 1,
            "updatedAt" = NOW()
        WHERE "userId" = ${userId} AND "period" = ${period};
      `;
    }

    const accountRemainingAfter = Math.max(0, accountPlan.monthlyAllowance - accountConsumedAfter);
    const userRemainingAfter = Math.max(0, userPlan.monthlyAllowance - userConsumedAfter);

    // E. Insert Request Record (Idempotency Key Protected)
    const requestRecord = await tx.consumptionRequest.create({
      data: {
        requestId,
        accountId,
        userId,
        units,
        period,
        status: isAccepted ? RequestStatus.ACCEPTED : RequestStatus.REJECTED,
        rejectionScope,
        rejectionCode,
        rejectionReason,
        accountPlanVersionId: accountPlan.versions[0]?.id || null,
        userPlanVersionId: userPlan.versions[0]?.id || null,
        accountConsumedAfter,
        accountRemainingAfter,
        userConsumedAfter,
        userRemainingAfter,
      },
    });

    // F. Check Alert Thresholds (80%, 90%, 100%)
    let triggeredAlert: { scope: RejectionScope; threshold: number } | null = null;

    if (isAccepted) {
      const accountPct = (accountConsumedAfter / accountPlan.monthlyAllowance) * 100;
      const userPct = (userConsumedAfter / userPlan.monthlyAllowance) * 100;

      for (const threshold of ALERT_THRESHOLDS) {
        // Check account threshold
        if (accountPct >= threshold) {
          const alertCreated = await checkAndCreateAlert(tx, {
            accountId,
            scope: RejectionScope.ACCOUNT,
            period,
            threshold,
            consumedUnits: accountConsumedAfter,
            monthlyAllowance: accountPlan.monthlyAllowance,
            percentage: accountPct,
          });
          if (alertCreated && !triggeredAlert) {
            triggeredAlert = { scope: RejectionScope.ACCOUNT, threshold };
          }
        }

        // Check user threshold
        if (userPct >= threshold) {
          const alertCreated = await checkAndCreateAlert(tx, {
            accountId,
            userId,
            scope: RejectionScope.USER,
            period,
            threshold,
            consumedUnits: userConsumedAfter,
            monthlyAllowance: userPlan.monthlyAllowance,
            percentage: userPct,
          });
          if (alertCreated && !triggeredAlert) {
            triggeredAlert = { scope: RejectionScope.USER, threshold };
          }
        }
      }
    }

    const accountSnapshot: QuotaSnapshot = {
      monthlyAllowance: accountPlan.monthlyAllowance,
      consumedUnits: accountConsumedAfter,
      remainingUnits: accountRemainingAfter,
      usagePercentage: parseFloat(
        Math.min(100, (accountConsumedAfter / accountPlan.monthlyAllowance) * 100).toFixed(2)
      ),
      planId: accountPlan.id,
      planName: accountPlan.name,
      planVersion: accountPlan.version,
    };

    const userSnapshot: QuotaSnapshot = {
      monthlyAllowance: userPlan.monthlyAllowance,
      consumedUnits: userConsumedAfter,
      remainingUnits: userRemainingAfter,
      usagePercentage: parseFloat(
        Math.min(100, (userConsumedAfter / userPlan.monthlyAllowance) * 100).toFixed(2)
      ),
      planId: userPlan.id,
      planName: userPlan.name,
      planVersion: userPlan.version,
    };

    return {
      accepted: isAccepted,
      requestId: requestRecord.requestId,
      unitsRequested: units,
      period,
      timestamp: requestRecord.createdAt.toISOString(),
      rejectionReason,
      rejectionScope,
      rejectionCode,
      account: accountSnapshot,
      user: userSnapshot,
      alertTriggered: triggeredAlert,
    };
  });
}

// Helper to create Alert and outbox WebhookEvent idempotently
async function checkAndCreateAlert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  params: {
    accountId: string;
    userId?: string;
    scope: RejectionScope;
    period: string;
    threshold: number;
    consumedUnits: number;
    monthlyAllowance: number;
    percentage: number;
  }
): Promise<boolean> {
  try {
    const existing = await tx.alertEvent.findFirst({
      where: {
        accountId: params.accountId,
        userId: params.userId || null,
        period: params.period,
        threshold: params.threshold,
      },
    });

    if (existing) {
      return false;
    }

    const alert = await tx.alertEvent.create({
      data: {
        accountId: params.accountId,
        userId: params.userId || null,
        scope: params.scope,
        period: params.period,
        threshold: params.threshold,
        consumedUnits: params.consumedUnits,
        monthlyAllowance: params.monthlyAllowance,
        percentage: parseFloat(params.percentage.toFixed(2)),
      },
    });

    // Enqueue webhook event in outbox
    const webhookPayload = JSON.stringify({
      event: `QUOTA_${params.scope}_THRESHOLD_${params.threshold}`,
      timestamp: new Date().toISOString(),
      data: {
        alertId: alert.id,
        accountId: params.accountId,
        userId: params.userId || null,
        scope: params.scope,
        period: params.period,
        threshold: params.threshold,
        consumedUnits: params.consumedUnits,
        monthlyAllowance: params.monthlyAllowance,
        percentage: parseFloat(params.percentage.toFixed(2)),
      },
    });

    await tx.webhookEvent.create({
      data: {
        accountId: params.accountId,
        eventType: `THRESHOLD_${params.threshold}`,
        payload: webhookPayload,
        status: 'PENDING',
      },
    });

    return true;
  } catch (err) {
    logger.warn('Alert creation or deduplication hit conflict', { error: String(err) });
    return false;
  }
}
