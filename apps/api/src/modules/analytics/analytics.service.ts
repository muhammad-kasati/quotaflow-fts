import { prisma } from '../../lib/prisma';
import { getCurrentUtcPeriod, getPeriodRange } from '../../lib/period';
import { RequestStatus } from '@quotaflow/shared';

export async function getAccountAnalytics(accountId: string, periodInput?: string) {
  const period = periodInput || getCurrentUtcPeriod();
  const { start, end } = getPeriodRange(period);

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { plan: true },
  });

  if (!account) {
    return null;
  }

  // 1. Current monthly usage counter
  const accountMonthly = await prisma.accountMonthlyUsage.findUnique({
    where: {
      accountId_period: {
        accountId,
        period,
      },
    },
  });

  const consumedUnits = accountMonthly?.consumedUnits || 0;
  const monthlyAllowance = account.plan.monthlyAllowance;
  const remainingUnits = Math.max(0, monthlyAllowance - consumedUnits);
  const usagePercentage = Math.min(100, (consumedUnits / monthlyAllowance) * 100);

  // 2. Request breakdown (accepted vs rejected)
  const acceptedRequests = accountMonthly?.acceptedRequests || 0;
  const rejectedRequests = accountMonthly?.rejectedRequests || 0;
  const totalRequests = acceptedRequests + rejectedRequests;

  // 3. Rejection breakdown by scope & code
  const rejections = await prisma.consumptionRequest.groupBy({
    by: ['rejectionScope', 'rejectionCode'],
    where: {
      accountId,
      period,
      status: RequestStatus.REJECTED,
    },
    _count: { id: true },
  });

  const rejectionBreakdown = rejections.map((r) => ({
    scope: r.rejectionScope,
    code: r.rejectionCode,
    count: r._count.id,
  }));

  // 4. Top users by consumption for the period
  const userUsages = await prisma.userMonthlyUsage.findMany({
    where: {
      accountId,
      period,
    },
    include: {
      user: {
        select: { id: true, name: true, plan: { select: { name: true, monthlyAllowance: true } } },
      },
    },
    orderBy: { consumedUnits: 'desc' },
    take: 10,
  });

  const topUsers = userUsages.map((u) => ({
    userId: u.userId,
    userName: u.user.name,
    planName: u.user.plan.name,
    monthlyAllowance: u.user.plan.monthlyAllowance,
    consumedUnits: u.consumedUnits,
    remainingUnits: Math.max(0, u.user.plan.monthlyAllowance - u.consumedUnits),
    acceptedRequests: u.acceptedRequests,
    rejectedRequests: u.rejectedRequests,
  }));

  // 5. Daily usage trend for the current month
  const dailyRequests = await prisma.$queryRaw<
    { day: string; accepted_units: bigint; accepted_count: bigint; rejected_count: bigint }[]
  >`
    SELECT 
      TO_CHAR("createdAt", 'YYYY-MM-DD') as day,
      COALESCE(SUM(CASE WHEN "status" = 'ACCEPTED' THEN "units" ELSE 0 END), 0) as accepted_units,
      COUNT(CASE WHEN "status" = 'ACCEPTED' THEN 1 END) as accepted_count,
      COUNT(CASE WHEN "status" = 'REJECTED' THEN 1 END) as rejected_count
    FROM "ConsumptionRequest"
    WHERE "accountId" = ${accountId}
      AND "createdAt" >= ${start}
      AND "createdAt" < ${end}
    GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
    ORDER BY day ASC;
  `;

  const dailyTrend = dailyRequests.map((d) => ({
    date: d.day,
    consumedUnits: Number(d.accepted_units),
    acceptedRequests: Number(d.accepted_count),
    rejectedRequests: Number(d.rejected_count),
  }));

  // 6. Historical monthly comparison (last 6 months)
  const historicalMonthly = await prisma.accountMonthlyUsage.findMany({
    where: { accountId },
    orderBy: { period: 'desc' },
    take: 6,
  });

  return {
    period,
    account: {
      id: account.id,
      name: account.name,
      plan: account.plan,
    },
    summary: {
      monthlyAllowance,
      consumedUnits,
      remainingUnits,
      usagePercentage: parseFloat(usagePercentage.toFixed(2)),
      totalRequests,
      acceptedRequests,
      rejectedRequests,
    },
    topUsers,
    rejectionBreakdown,
    dailyTrend,
    historicalMonthly: historicalMonthly.reverse(),
  };
}
