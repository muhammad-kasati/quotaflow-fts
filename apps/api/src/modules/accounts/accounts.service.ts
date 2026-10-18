import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { recordAudit } from '../audit/audit.service';
import { getCurrentUtcPeriod } from '../../lib/period';
import { PlanType } from '@quotaflow/shared';

export interface CreateAccountDto {
  name: string;
  planId: string;
}

export interface UpdateAccountDto {
  name?: string;
  planId?: string;
  status?: string;
}

export async function listAccounts(query: { page?: number; limit?: number; status?: string }) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;

  const [total, accounts] = await Promise.all([
    prisma.account.count({ where }),
    prisma.account.findMany({
      where,
      include: {
        plan: true,
        _count: {
          select: { users: true, apiKeys: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    accounts,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAccountById(id: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      plan: {
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 5,
          },
        },
      },
      apiKeys: {
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          status: true,
          lastUsedAt: true,
          createdAt: true,
          revokedAt: true,
        },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', `Account with ID '${id}' not found`);
  }

  return account;
}

export async function getAccountUsageSummary(accountId: string, periodInput?: string) {
  const account = await getAccountById(accountId);
  const period = periodInput || getCurrentUtcPeriod();

  const usageRecord = await prisma.accountMonthlyUsage.findUnique({
    where: {
      accountId_period: {
        accountId,
        period,
      },
    },
  });

  const consumedUnits = usageRecord?.consumedUnits || 0;
  const monthlyAllowance = account.plan.monthlyAllowance;
  const remainingUnits = Math.max(0, monthlyAllowance - consumedUnits);
  const usagePercentage = Math.min(100, (consumedUnits / monthlyAllowance) * 100);

  return {
    account: {
      id: account.id,
      name: account.name,
      plan: account.plan,
    },
    period,
    monthlyAllowance,
    consumedUnits,
    remainingUnits,
    usagePercentage: parseFloat(usagePercentage.toFixed(2)),
    acceptedRequests: usageRecord?.acceptedRequests || 0,
    rejectedRequests: usageRecord?.rejectedRequests || 0,
    totalRequests: (usageRecord?.acceptedRequests || 0) + (usageRecord?.rejectedRequests || 0),
  };
}

export async function createAccount(dto: CreateAccountDto, actor: string) {
  const plan = await prisma.plan.findUnique({ where: { id: dto.planId } });
  if (!plan || plan.type !== PlanType.ACCOUNT) {
    throw new AppError(400, 'INVALID_ACCOUNT_PLAN', 'The specified plan does not exist or is not an ACCOUNT plan.');
  }

  const account = await prisma.account.create({
    data: {
      name: dto.name,
      planId: dto.planId,
      status: 'ACTIVE',
    },
    include: {
      plan: true,
    },
  });

  await recordAudit({
    actor,
    action: 'ACCOUNT_CREATED',
    targetResource: 'Account',
    targetId: account.id,
    metadata: { name: account.name, planId: account.planId },
  });

  return account;
}

export async function updateAccount(id: string, dto: UpdateAccountDto, actor: string) {
  const account = await getAccountById(id);

  if (dto.planId && dto.planId !== account.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || plan.type !== PlanType.ACCOUNT) {
      throw new AppError(400, 'INVALID_ACCOUNT_PLAN', 'The specified plan is not an ACCOUNT plan.');
    }
  }

  const updatedAccount = await prisma.account.update({
    where: { id },
    data: {
      name: dto.name,
      planId: dto.planId,
      status: dto.status,
    },
    include: {
      plan: true,
    },
  });

  await recordAudit({
    actor,
    action: 'ACCOUNT_UPDATED',
    targetResource: 'Account',
    targetId: id,
    metadata: {
      oldPlanId: account.planId,
      newPlanId: updatedAccount.planId,
      oldName: account.name,
      newName: updatedAccount.name,
    },
  });

  return updatedAccount;
}
