'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { Users, UserPlus, Shield, RotateCcw, ArrowRight } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPlanId, setNewUserPlanId] = useState('plan_user_basic');
  const [actionMsg, setActionMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, pRes] = await Promise.all([
        apiClient.getUsers('account_demo_acme'),
        apiClient.getPlans(),
      ]);
      setUsers(uRes.data || []);
      setPlans(pRes.data?.filter((p: any) => p.type === 'USER') || []);
    } catch (err: any) {
      alert(`Error loading users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;

    try {
      await apiClient.updateUser('', { name: newUserName, planId: newUserPlanId }); // or user create
      // Using fetchFromApi for create
      await (apiClient as any).consume; // dummy check
      const res = await fetch(`http://localhost:4000/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'qf_admin_dev_bootstrap_secret_key_2026',
        },
        body: JSON.stringify({
          accountId: 'account_demo_acme',
          name: newUserName,
          planId: newUserPlanId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create user');

      setNewUserName('');
      setActionMsg('User created successfully!');
      setTimeout(() => setActionMsg(''), 3000);
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handlePlanChange = async (userId: string, newPlanId: string) => {
    try {
      await apiClient.updateUser(userId, { planId: newPlanId });
      setActionMsg(`Plan updated for user!`);
      setTimeout(() => setActionMsg(''), 3000);
      await loadData();
    } catch (err: any) {
      alert(`Error updating plan: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Accounts & Users
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage users and assign individual monthly quotas. Users are strictly scoped to their owning organization.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* User List Table (8 cols) */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-8">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" />
            Users in Acme Document AI
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 text-slate-400 font-semibold">
                <tr>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Current Plan</th>
                  <th className="pb-3">Monthly Allowance</th>
                  <th className="pb-3">Per-Request Max</th>
                  <th className="pb-3">Change Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900">
                      <div>{u.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{u.id}</div>
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-slate-800">{u.plan?.name}</td>
                    <td className="py-3 font-semibold text-brand-600">{u.plan?.monthlyAllowance?.toLocaleString()} units</td>
                    <td className="py-3">{u.plan?.maxUnitsPerRequest} units</td>
                    <td className="py-3">
                      <select
                        value={u.planId}
                        onChange={(e) => handlePlanChange(u.id, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-brand-500 focus:outline-none"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.monthlyAllowance?.toLocaleString()} units)
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User Form (4 cols) */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-brand-600" />
            Provision New User
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Create an additional user scoped to this account.
          </p>

          <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. Carol Analyst"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Assigned User Plan</label>
              <select
                value={newUserPlanId}
                onChange={(e) => setNewUserPlanId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.monthlyAllowance?.toLocaleString()} units/mo)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Create User
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
