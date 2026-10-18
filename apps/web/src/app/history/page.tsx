'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { History, Download, Filter, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HistoryPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, limit: 20, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadHistory = async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: p.toString(),
        limit: '15',
      };
      if (statusFilter === 'ACCEPTED') params.accepted = 'true';
      if (statusFilter === 'REJECTED') params.accepted = 'false';

      const res = await apiClient.getHistory(params);
      setRequests(res.data || []);
      setMeta(res.meta || { page: 1, limit: 15, totalPages: 1, total: 0 });
    } catch (err: any) {
      alert(`Error loading history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(page);
  }, [page, statusFilter]);

  const handleExportCsv = () => {
    const params: Record<string, string> = {};
    if (statusFilter === 'ACCEPTED') params.accepted = 'true';
    if (statusFilter === 'REJECTED') params.accepted = 'false';
    const exportUrl = apiClient.getExportUrl(params);
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Consumption Request History
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Immutable log of all accepted and rejected consumption requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => loadHistory(page)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card mb-6 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACCEPTED">Accepted Only</option>
            <option value="REJECTED">Rejected Only</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Showing <strong>{requests.length}</strong> of <strong>{meta.total}</strong> records
        </span>
      </div>

      {/* History Table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 text-slate-400 font-semibold">
              <tr>
                <th className="pb-3">Timestamp (UTC)</th>
                <th className="pb-3">Request ID</th>
                <th className="pb-3">User</th>
                <th className="pb-3">Units</th>
                <th className="pb-3">Outcome</th>
                <th className="pb-3">Rejection Reason / Code</th>
                <th className="pb-3">Account Remaining</th>
                <th className="pb-3">User Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="py-3 font-mono text-[11px] text-slate-500">
                    {new Date(r.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                  </td>
                  <td className="py-3 font-mono font-semibold text-slate-900">{r.requestId}</td>
                  <td className="py-3 font-medium text-slate-800">{r.user?.name || r.userId}</td>
                  <td className="py-3 font-semibold text-slate-900">{r.units}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 text-[11px]">
                    {r.status === 'REJECTED' ? (
                      <span className="text-rose-700 font-medium">
                        {r.rejectionCode}: {r.rejectionReason}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 font-medium text-slate-800">{r.accountRemainingAfter}</td>
                  <td className="py-3 font-medium text-slate-800">{r.userRemainingAfter}</td>
                </tr>
              ))}

              {requests.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No consumption requests found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {meta.page} of {meta.totalPages || 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
