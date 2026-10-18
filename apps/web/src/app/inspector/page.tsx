'use client';

import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { Search, CheckCircle2, XCircle, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

export default function InspectorPage() {
  const [searchId, setSearchId] = useState('');
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setLoading(true);
    setError(null);
    setRecord(null);

    try {
      const res = await apiClient.getRequestDetails(searchId.trim());
      setRecord(res.data);
    } catch (err: any) {
      setError(err.message || 'Request ID not found.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Request Inspector
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Inspect individual idempotency keys and review the quota decision, rejection rationale, and remaining capacity snapshots.
        </p>
      </div>

      {/* Search Input */}
      <div className="glass-card mb-8 rounded-2xl p-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              required
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter exact Request ID (e.g. demo-req-12345 or k6-norm-1-1)"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-xs font-mono text-slate-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Inspect Request'}
          </button>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Snapshot Card */}
      {record && (
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900">{record.requestId}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    record.status === 'ACCEPTED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {record.status === 'ACCEPTED' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {record.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(record.createdAt).toUTCString()}</span>
                <span>•</span>
                <span>Period: {record.period}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500">Units Evaluated</span>
              <div className="text-2xl font-bold text-slate-900">{record.units} units</div>
            </div>
          </div>

          {/* Rejection Details if applicable */}
          {record.status === 'REJECTED' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-bold text-rose-900">Rejection Details</div>
              <div className="mt-1 text-xs text-rose-800">
                <strong>Code:</strong> {record.rejectionCode} (Scope: {record.rejectionScope})
              </div>
              <p className="mt-1 text-xs text-rose-700">{record.rejectionReason}</p>
            </div>
          )}

          {/* Context & Snapshots Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Account Scope */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-bold text-slate-800">Account Quota Context</h4>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Account:</span>
                  <span className="font-semibold text-slate-900">{record.account?.name || record.accountId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Consumed After:</span>
                  <span className="font-semibold text-slate-900">{record.accountConsumedAfter} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining After:</span>
                  <span className="font-semibold text-emerald-600">{record.accountRemainingAfter} units</span>
                </div>
              </div>
            </div>

            {/* User Scope */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-xs font-bold text-slate-800">User Quota Context</h4>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>User:</span>
                  <span className="font-semibold text-slate-900">{record.user?.name || record.userId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Consumed After:</span>
                  <span className="font-semibold text-slate-900">{record.userConsumedAfter} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining After:</span>
                  <span className="font-semibold text-emerald-600">{record.userRemainingAfter} units</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
