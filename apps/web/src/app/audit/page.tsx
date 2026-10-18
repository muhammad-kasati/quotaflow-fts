'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { ShieldAlert, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, limit: 20, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.getAuditLogs(p, 15);
      setLogs(res.data || []);
      setMeta(res.meta || { page: 1, limit: 15, totalPages: 1, total: 0 });
    } catch (err: any) {
      alert(`Error loading audit logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Administrative Audit Log
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Append-only security audit log recording administrative events, plan changes, and key rotations.
          </p>
        </div>

        <button
          onClick={() => loadLogs(page)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 text-slate-400 font-semibold">
              <tr>
                <th className="pb-3">Timestamp (UTC)</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Target ID</th>
                <th className="pb-3">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-3 font-mono text-[11px] text-slate-500">
                    {new Date(log.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                  </td>
                  <td className="py-3 font-semibold text-slate-800">{log.actor}</td>
                  <td className="py-3">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 font-medium text-slate-900">{log.targetResource}</td>
                  <td className="py-3 font-mono text-[10px] text-slate-500">{log.targetId}</td>
                  <td className="py-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
