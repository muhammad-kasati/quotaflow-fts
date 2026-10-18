'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Activity,
  Layers,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getAnalytics();
      setAnalytics(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <RotateCcw className="h-4 w-4 animate-spin text-brand-600" />
          Loading QuotaFlow analytics from PostgreSQL...
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
          <h3 className="mt-2 text-sm font-bold text-rose-900">Failed to Connect to QuotaFlow API</h3>
          <p className="mt-1 text-xs text-rose-700">{error || 'Make sure the API server is running.'}</p>
          <button
            onClick={loadData}
            className="mt-4 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { account, summary, topUsers, rejectionBreakdown, dailyTrend, historicalMonthly } = analytics;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">{account?.name}</span>
            <span>•</span>
            <span className="font-mono">{analytics.period} (UTC)</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Usage Metering Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Activity className="h-4 w-4" />
            Launch Interactive Demo
          </Link>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Consumed Quota */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Monthly Consumption</span>
            <TrendingUp className="h-4 w-4 text-brand-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {summary.consumedUnits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">/ {summary.monthlyAllowance.toLocaleString()} units</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${summary.usagePercentage}%` }}
            />
          </div>
          <div className="mt-2 text-right text-[11px] font-semibold text-brand-600">
            {summary.usagePercentage}% utilized
          </div>
        </div>

        {/* Card 2: Remaining Quota */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Remaining Quota</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600">
            {summary.remainingUnits.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Current plan: <strong className="text-slate-800">{account?.plan?.name}</strong> (max {account?.plan?.maxUnitsPerRequest}/req)
          </p>
        </div>

        {/* Card 3: Accepted Requests */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Accepted Requests</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {summary.acceptedRequests.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Total evaluated: {summary.totalRequests.toLocaleString()}
          </p>
        </div>

        {/* Card 4: Rejected Requests */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Quota Rejections</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-600">
            {summary.rejectedRequests.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Zero units consumed on rejection
          </p>
        </div>
      </div>

      {/* Analytics Sections */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Daily Trend & Rejection Breakdown (8 cols) */}
        <div className="space-y-8 lg:col-span-8">
          {/* Daily Consumption Trend */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-600" />
              Daily Consumption Trend ({analytics.period})
            </h2>
            <div className="mt-6">
              {dailyTrend.length > 0 ? (
                <div className="space-y-3">
                  {dailyTrend.map((d: any) => (
                    <div key={d.date} className="flex items-center gap-4 text-xs">
                      <span className="w-24 font-mono text-slate-500">{d.date}</span>
                      <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-600 transition-all"
                          style={{
                            width: `${Math.min(100, (d.consumedUnits / (summary.monthlyAllowance / 30)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-20 text-right font-semibold text-slate-800">
                        {d.consumedUnits.toLocaleString()} units
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No consumption recorded for this period yet. Run requests from the Interactive Demo!
                </div>
              )}
            </div>
          </div>

          {/* Top Users by Consumption */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" />
              Top Users by Consumption
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 text-slate-400 font-semibold">
                  <tr>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Consumed</th>
                    <th className="pb-3">Remaining</th>
                    <th className="pb-3">Accepted</th>
                    <th className="pb-3">Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topUsers.map((user: any) => (
                    <tr key={user.userId} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold text-slate-900">{user.userName}</td>
                      <td className="py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {user.planName}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-slate-800">{user.consumedUnits.toLocaleString()}</td>
                      <td className="py-3 text-emerald-600 font-medium">{user.remainingUnits.toLocaleString()}</td>
                      <td className="py-3 text-emerald-700">{user.acceptedRequests}</td>
                      <td className="py-3 text-rose-600">{user.rejectedRequests}</td>
                    </tr>
                  ))}
                  {topUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No user consumption recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Rejections Breakdown & Historical Comparison (4 cols) */}
        <div className="space-y-8 lg:col-span-4">
          {/* Rejection Breakdown */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Rejections Breakdown</h2>
            <p className="mt-1 text-xs text-slate-500">
              Categorized reasons for rejected requests
            </p>

            <div className="mt-4 space-y-3">
              {rejectionBreakdown.length > 0 ? (
                rejectionBreakdown.map((r: any) => (
                  <div key={r.code} className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-rose-900">{r.code}</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        {r.count}
                      </span>
                    </div>
                    <span className="text-[11px] text-rose-700">Scope: {r.scope}</span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No rejections recorded this period.
                </div>
              )}
            </div>
          </div>

          {/* Historical Monthly Comparison */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Monthly History</h2>
            <p className="mt-1 text-xs text-slate-500">
              Preserved historical monthly UTC usage counters
            </p>

            <div className="mt-4 divide-y divide-slate-100 text-xs">
              {historicalMonthly.map((m: any) => (
                <div key={m.period} className="py-2.5 flex items-center justify-between">
                  <span className="font-mono text-slate-700">{m.period}</span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {m.consumedUnits.toLocaleString()} units
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {m.acceptedRequests} acc / {m.rejectedRequests} rej
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
