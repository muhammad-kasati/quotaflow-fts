import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export interface RecordAuditParams {
  actor: string;
  action: string;
  targetResource: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
}

export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: params.actor,
        action: params.action,
        targetResource: params.targetResource,
        targetId: params.targetId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (error) {
    logger.error('Failed to record audit log', {
      error: error instanceof Error ? error.message : String(error),
      params,
    });
  }
}

export async function listAuditLogs(query: {
  page?: number;
  limit?: number;
  targetResource?: string;
  actor?: string;
}) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (query.targetResource) where.targetResource = query.targetResource;
  if (query.actor) where.actor = query.actor;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
