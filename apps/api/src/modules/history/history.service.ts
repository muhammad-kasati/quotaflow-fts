import { prisma } from '../../lib/prisma';
import { sanitizeCsvField } from '../../lib/crypto';
import { RejectionCode, RejectionScope, RequestStatus } from '@quotaflow/shared';

export interface HistoryQueryFilters {
  page?: number;
  limit?: number;
  userId?: string;
  accepted?: 'true' | 'false';
  rejectionScope?: RejectionScope;
  rejectionCode?: RejectionCode;
  startDate?: string;
  endDate?: string;
  month?: string;
}

export async function getConsumptionHistory(accountId: string, filters: HistoryQueryFilters) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { accountId };

  if (filters.userId) where.userId = filters.userId;
  if (filters.accepted !== undefined) {
    where.status = filters.accepted === 'true' ? RequestStatus.ACCEPTED : RequestStatus.REJECTED;
  }
  if (filters.rejectionScope) where.rejectionScope = filters.rejectionScope;
  if (filters.rejectionCode) where.rejectionCode = filters.rejectionCode;
  if (filters.month) where.period = filters.month;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  const [total, requests] = await Promise.all([
    prisma.consumptionRequest.count({ where }),
    prisma.consumptionRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    requests,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function exportConsumptionHistoryToCsv(
  accountId: string,
  filters: Omit<HistoryQueryFilters, 'page' | 'limit'>
): Promise<string> {
  const where: Record<string, unknown> = { accountId };

  if (filters.userId) where.userId = filters.userId;
  if (filters.accepted !== undefined) {
    where.status = filters.accepted === 'true' ? RequestStatus.ACCEPTED : RequestStatus.REJECTED;
  }
  if (filters.rejectionScope) where.rejectionScope = filters.rejectionScope;
  if (filters.rejectionCode) where.rejectionCode = filters.rejectionCode;
  if (filters.month) where.period = filters.month;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  // Retrieve up to 10,000 records for CSV export
  const records = await prisma.consumptionRequest.findMany({
    where,
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const headers = [
    'Request ID',
    'Timestamp (UTC)',
    'User ID',
    'User Name',
    'Units Requested',
    'Status',
    'Rejection Scope',
    'Rejection Code',
    'Rejection Reason',
    'Account Consumed After',
    'Account Remaining After',
    'User Consumed After',
    'User Remaining After',
    'Period',
  ];

  const csvRows = [headers.join(',')];

  for (const r of records) {
    const row = [
      sanitizeCsvField(r.requestId),
      sanitizeCsvField(r.createdAt.toISOString()),
      sanitizeCsvField(r.userId),
      sanitizeCsvField(r.user?.name || ''),
      sanitizeCsvField(r.units),
      sanitizeCsvField(r.status),
      sanitizeCsvField(r.rejectionScope || ''),
      sanitizeCsvField(r.rejectionCode || ''),
      sanitizeCsvField(r.rejectionReason || ''),
      sanitizeCsvField(r.accountConsumedAfter),
      sanitizeCsvField(r.accountRemainingAfter),
      sanitizeCsvField(r.userConsumedAfter),
      sanitizeCsvField(r.userRemainingAfter),
      sanitizeCsvField(r.period),
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\r\n');
}
