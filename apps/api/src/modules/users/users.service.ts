import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { recordAudit } from '../audit/audit.service';
import { getCurrentUtcPeriod } from '../../lib/period';
import { PlanType } from '@quotaflow/shared';

export interface CreateUserDto {
  name: string;
  planId: string;
}

export interface UpdateUserDto {
  name?: string;
  planId?: string;
  status?: string;
}

export async function listUsers(
  accountId: string,
  query: { page?: number; limit?: number; status?: string }
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { accountId };
  if (query.status) where.status = query.status;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(accountId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      plan: {
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 5,
          },
        },
      },
    },
  });

  if (!user || user.accountId !== accountId) {
    throw new AppError(404, 'USER_NOT_FOUND', `User with ID '${userId}' not found in this account.`);
  }

  return user;
}

export async function getUserUsageSummary(
  accountId: string,
  userId: string,
  periodInput?: string
) {
  const user = await getUserById(accountId, userId);
  const period = periodInput || getCurrentUtcPeriod();

  const usageRecord = await prisma.userMonthlyUsage.findUnique({
    where: {
      userId_period: {
        userId,
        period,
      },
    },
  });

  const consumedUnits = usageRecord?.consumedUnits || 0;
  const monthlyAllowance = user.plan.monthlyAllowance;
  const remainingUnits = Math.max(0, monthlyAllowance - consumedUnits);
  const usagePercentage = Math.min(100, (consumedUnits / monthlyAllowance) * 100);

  return {
    user: {
      id: user.id,
      name: user.name,
      plan: user.plan,
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

export async function createUser(accountId: string, dto: CreateUserDto, actor: string) {
  const plan = await prisma.plan.findUnique({ where: { id: dto.planId } });
  if (!plan || plan.type !== PlanType.USER) {
    throw new AppError(400, 'INVALID_USER_PLAN', 'The specified plan is not a valid USER plan.');
  }

  const user = await prisma.user.create({
    data: {
      accountId,
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
    action: 'USER_CREATED',
    targetResource: 'User',
    targetId: user.id,
    metadata: { accountId, name: user.name, planId: user.planId },
  });

  return user;
}

export async function updateUser(
  accountId: string,
  userId: string,
  dto: UpdateUserDto,
  actor: string
) {
  const user = await getUserById(accountId, userId);

  if (dto.planId && dto.planId !== user.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || plan.type !== PlanType.USER) {
      throw new AppError(400, 'INVALID_USER_PLAN', 'The specified plan is not a valid USER plan.');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
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
    action: 'USER_UPDATED',
    targetResource: 'User',
    targetId: userId,
    metadata: {
      accountId,
      oldPlanId: user.planId,
      newPlanId: updatedUser.planId,
      oldName: user.name,
      newName: updatedUser.name,
    },
  });

  return updatedUser;
}
