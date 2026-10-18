import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { PlanType } from '@quotaflow/shared';
import { recordAudit } from '../audit/audit.service';

export interface CreatePlanDto {
  name: string;
  type: PlanType;
  monthlyAllowance: number;
  maxUnitsPerRequest: number;
  ownerAccountId?: string;
}

export interface UpdatePlanDto {
  name?: string;
  monthlyAllowance?: number;
  maxUnitsPerRequest?: number;
  changeReason?: string;
}

export async function getAllPlans(accountId?: string) {
  return prisma.plan.findMany({
    where: {
      OR: [
        { isPredefined: true },
        ...(accountId ? [{ ownerAccountId: accountId }] : [{ ownerAccountId: { not: null } }]),
      ],
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
    orderBy: [{ type: 'asc' }, { monthlyAllowance: 'asc' }],
  });
}

export async function getPlanById(id: string) {
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });

  if (!plan) {
    throw new AppError(404, 'PLAN_NOT_FOUND', `Plan with ID '${id}' not found`);
  }

  return plan;
}

export async function createCustomPlan(dto: CreatePlanDto, actor: string) {
  const planId = `plan_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const plan = await prisma.$transaction(async (tx) => {
    const createdPlan = await tx.plan.create({
      data: {
        id: planId,
        name: dto.name,
        type: dto.type,
        monthlyAllowance: dto.monthlyAllowance,
        maxUnitsPerRequest: dto.maxUnitsPerRequest,
        isPredefined: false,
        ownerAccountId: dto.ownerAccountId,
        version: 1,
        versions: {
          create: {
            version: 1,
            name: dto.name,
            type: dto.type,
            monthlyAllowance: dto.monthlyAllowance,
            maxUnitsPerRequest: dto.maxUnitsPerRequest,
            changeReason: 'Initial custom plan creation',
          },
        },
      },
      include: {
        versions: true,
      },
    });

    return createdPlan;
  });

  await recordAudit({
    actor,
    action: 'PLAN_CREATED',
    targetResource: 'Plan',
    targetId: plan.id,
    metadata: { name: plan.name, type: plan.type, allowance: plan.monthlyAllowance },
  });

  return plan;
}

export async function updatePlan(id: string, dto: UpdatePlanDto, actor: string) {
  const existingPlan = await getPlanById(id);

  if (existingPlan.isPredefined) {
    throw new AppError(
      403,
      'PREDEFINED_PLAN_IMMUTABLE',
      'Predefined system plans are read-only and cannot be modified.'
    );
  }

  const newVersion = existingPlan.version + 1;
  const newName = dto.name ?? existingPlan.name;
  const newAllowance = dto.monthlyAllowance ?? existingPlan.monthlyAllowance;
  const newMaxUnits = dto.maxUnitsPerRequest ?? existingPlan.maxUnitsPerRequest;

  const updatedPlan = await prisma.$transaction(async (tx) => {
    // 1. Create version record with historical snapshot
    await tx.planVersion.create({
      data: {
        planId: id,
        version: newVersion,
        name: newName,
        type: existingPlan.type,
        monthlyAllowance: newAllowance,
        maxUnitsPerRequest: newMaxUnits,
        changeReason: dto.changeReason || 'Plan limits modified',
      },
    });

    // 2. Update parent plan
    return tx.plan.update({
      where: { id },
      data: {
        name: newName,
        monthlyAllowance: newAllowance,
        maxUnitsPerRequest: newMaxUnits,
        version: newVersion,
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });
  });

  await recordAudit({
    actor,
    action: 'PLAN_UPDATED',
    targetResource: 'Plan',
    targetId: id,
    metadata: {
      oldVersion: existingPlan.version,
      newVersion,
      oldAllowance: existingPlan.monthlyAllowance,
      newAllowance,
      changeReason: dto.changeReason,
    },
  });

  return updatedPlan;
}
