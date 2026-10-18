'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { Layers, Plus, Lock, History, Check } from 'lucide-react';

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    type: 'USER',
    monthlyAllowance: 2000,
    maxUnitsPerRequest: 50,
  });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getPlans();
      setPlans(res.data || []);
    } catch (err: any) {
      alert(`Error loading plans: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/api/v1/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'qf_admin_dev_bootstrap_secret_key_2026',
        },
        body: JSON.stringify(newPlan),
      });
      if (!res.ok) throw new Error('Failed to create plan');
      setShowCreateModal(false);
      setNewPlan({ name: '', type: 'USER', monthlyAllowance: 2000, maxUnitsPerRequest: 50 });
      await loadPlans();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Plans & Versioned Limits
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Predefined system plans are immutable. Custom plans track full version history and preserve historical usage.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Create Custom Plan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <div key={p.id} className="glass-card flex flex-col justify-between rounded-2xl p-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  {p.type} PLAN
                </span>
                {p.isPredefined ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    <Lock className="h-3 w-3" />
                    Read-Only
                  </span>
                ) : (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                    v{p.version} Custom
                  </span>
                )}
              </div>

              <h3 className="mt-3 text-lg font-bold text-slate-900">{p.name}</h3>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Monthly Allowance:</span>
                  <span className="font-bold text-slate-900">{p.monthlyAllowance.toLocaleString()} units</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Max Per Request:</span>
                  <span className="font-bold text-slate-900">{p.maxUnitsPerRequest} units</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Version:</span>
                  <span className="font-mono text-slate-800">v{p.version}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              {p.versions && p.versions.length > 0 ? (
                <div>
                  <span className="font-medium text-slate-600">History:</span> {p.versions.length} version(s) recorded
                </div>
              ) : (
                'System initial version'
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Create Custom Plan</h3>
            <p className="mt-1 text-xs text-slate-500">
              Define a new custom quota policy for accounts or users.
            </p>

            <form onSubmit={handleCreatePlan} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Plan Name</label>
                <input
                  type="text"
                  required
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="e.g. Enterprise Tier"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Scope Type</label>
                <select
                  value={newPlan.type}
                  onChange={(e) => setNewPlan({ ...newPlan, type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="USER">USER Scope</option>
                  <option value="ACCOUNT">ACCOUNT Scope</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Monthly Allowance</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPlan.monthlyAllowance}
                    onChange={(e) => setNewPlan({ ...newPlan, monthlyAllowance: parseInt(e.target.value, 10) || 1 })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Max Per Request</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPlan.maxUnitsPerRequest}
                    onChange={(e) => setNewPlan({ ...newPlan, maxUnitsPerRequest: parseInt(e.target.value, 10) || 1 })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
