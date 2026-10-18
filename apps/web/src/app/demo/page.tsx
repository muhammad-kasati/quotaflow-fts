'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Server,
  Zap,
} from 'lucide-react';

interface QuotaSnapshot {
  monthlyAllowance: number;
  consumedUnits: number;
  remainingUnits: number;
  usagePercentage: number;
  planName: string;
  planVersion: number;
}

interface ConsumptionDecision {
  accepted: boolean;
  requestId: string;
  unitsRequested: number;
  period: string;
  timestamp: string;
  rejectionReason?: string;
  rejectionScope?: string;
  rejectionCode?: string;
  account: QuotaSnapshot;
  user: QuotaSnapshot;
  idempotentReplay?: boolean;
}

export default function DemoPage() {
  const [accountOverview, setAccountOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('user_demo_alice');
  const [customUnits, setCustomUnits] = useState<number>(10);
  const [customRequestId, setCustomRequestId] = useState<string>('');
  const [lastDecision, setLastDecision] = useState<ConsumptionDecision | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<string>('');
  const [recentHistory, setRecentHistory] = useState<any[]>([]);

  // Load account and user statuses
  const refreshData = async () => {
    try {
      const [accRes, usersRes, plansRes, historyRes] = await Promise.all([
        apiClient.getAccountOverview('account_demo_acme'),
        apiClient.getUsers('account_demo_acme'),
        apiClient.getPlans(),
        apiClient.getHistory({ limit: '6' }),
      ]);

      setAccountOverview(accRes.data);
      setUsers(usersRes.data);
      setPlans(plansRes.data);
      setRecentHistory(historyRes.data || []);
    } catch (err) {
      console.error('Failed to load demo data:', err);
    }
  };

  useEffect(() => {
    refreshData();
    setCustomRequestId(`demo-req-${Date.now().toString().slice(-6)}`);
  }, []);

  // Submit consumption request
  const handleConsume = async (userId: string, units: number, reqId?: string) => {
    setLoading(true);
    setActionStatus('');
    const idToUse = reqId || `demo-req-${Date.now().toString().slice(-6)}`;

    try {
      const res = await apiClient.consume({
        userId,
        units,
        requestId: idToUse,
      });

      setLastDecision(res.data);
      await refreshData();
      setCustomRequestId(`demo-req-${Date.now().toString().slice(-6)}`);
    } catch (err: any) {
      alert(`API Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Scenario 1: Normal Accepted Request
  const runNormalAccepted = () => {
    setActionStatus('Executing: Valid request (10 units for Alice)...');
    handleConsume('user_demo_alice', 10);
  };

  // Scenario 2: User Per-Request Limit Rejection (Alice limit is 20)
  const runUserPerRequestLimit = () => {
    setActionStatus('Executing: Requesting 25 units for Alice (Exceeds user per-request max of 20)...');
    handleConsume('user_demo_alice', 25);
  };

  // Scenario 3: Account Per-Request Limit Rejection (Account limit is 100)
  const runAccountPerRequestLimit = () => {
    setActionStatus('Executing: Requesting 150 units for Bob (Exceeds account per-request max of 100)...');
    handleConsume('user_demo_bob', 150);
  };

  // Scenario 4: Idempotent Retry
  const runIdempotentRetry = async () => {
    const fixedId = `idemp-demo-key-1001`;
    setActionStatus('Executing: Submitting idempotent request twice with requestId: ' + fixedId);
    setLoading(true);
    try {
      // Step 1: First request
      await apiClient.consume({ userId: 'user_demo_bob', units: 10, requestId: fixedId });
      // Step 2: Retry with exact same payload
      const res2 = await apiClient.consume({ userId: 'user_demo_bob', units: 10, requestId: fixedId });
      setLastDecision(res2.data);
      await refreshData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Scenario 5: Plan Upgrade for Alice
  const runPlanUpgrade = async () => {
    setActionStatus('Executing: Upgrading Alice from Basic (1,000 allowance) to Premium (5,000 allowance)...');
    setLoading(true);
    try {
      await apiClient.updateUser('user_demo_alice', { planId: 'plan_user_premium' });
      await refreshData();
      // Now consume 40 units (which would have failed under Basic limit of 20, but succeeds on Premium!)
      await handleConsume('user_demo_alice', 40);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Demo Reset
  const runResetAlice = async () => {
    setActionStatus('Resetting Alice plan back to Basic...');
    setLoading(true);
    try {
      await apiClient.updateUser('user_demo_alice', { planId: 'plan_user_basic' });
      await refreshData();
    } finally {
      setLoading(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Banner */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
            <Zap className="h-3.5 w-3.5 text-brand-600" />
            Live Backend Simulator
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Interactive Quota Engine Demo
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Evaluate dual-quota business rules in real-time. Every action calls the real Express API and updates PostgreSQL atomically.
          </p>
        </div>

        <button
          onClick={refreshData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {/* Account & User Overview Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Account Card */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {accountOverview?.account?.name || 'Acme Document AI'}
                </h3>
                <span className="text-xs text-slate-500">Account Quota Scope</span>
              </div>
            </div>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              {accountOverview?.account?.plan?.name || 'Starter'}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Consumed Quota</span>
              <span className="font-semibold text-slate-900">
                {accountOverview?.consumedUnits?.toLocaleString() || 0} / {accountOverview?.monthlyAllowance?.toLocaleString() || 10000} units
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{ width: `${accountOverview?.usagePercentage || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Remaining: <strong className="text-emerald-600">{accountOverview?.remainingUnits?.toLocaleString() || 0}</strong></span>
              <span>Max/Request: {accountOverview?.account?.plan?.maxUnitsPerRequest || 100} units</span>
            </div>
          </div>
        </div>

        {/* Users Status Cards */}
        {users.map((user) => (
          <div
            key={user.id}
            onClick={() => setSelectedUserId(user.id)}
            className={`glass-card cursor-pointer rounded-2xl p-6 transition-all ${
              selectedUserId === user.id
                ? 'ring-2 ring-brand-500 shadow-md shadow-brand-500/10'
                : 'hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{user.name}</h3>
                  <span className="text-xs font-mono text-slate-400">{user.id}</span>
                </div>
              </div>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
                {user.plan?.name}
              </span>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
              <div>
                <div className="text-slate-400">Monthly Limit</div>
                <div className="font-semibold text-slate-800">
                  {user.plan?.monthlyAllowance?.toLocaleString()} units
                </div>
              </div>
              <div>
                <div className="text-slate-400">Per-Request Limit</div>
                <div className="font-semibold text-slate-800">
                  {user.plan?.maxUnitsPerRequest} units
                </div>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                selectedUserId === user.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {selectedUserId === user.id ? 'Active User' : 'Click to Select'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Interactive Controls & Results */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Preset Test Scenarios & Custom Form (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Presets Panel */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-brand-600" />
              Predefined Test Scenarios
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Click any scenario to verify deterministic quota evaluation and concurrency guarantees.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Scenario 1 */}
              <button
                onClick={runNormalAccepted}
                disabled={loading}
                className="flex flex-col text-left rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 transition hover:bg-emerald-50 hover:border-emerald-300"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  1. Normal Consumption
                </div>
                <span className="mt-1 text-[11px] text-emerald-700">
                  Consume 10 units for Alice. Passes both user and account checks.
                </span>
              </button>

              {/* Scenario 2 */}
              <button
                onClick={runUserPerRequestLimit}
                disabled={loading}
                className="flex flex-col text-left rounded-xl border border-rose-200 bg-rose-50/50 p-4 transition hover:bg-rose-50 hover:border-rose-300"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-rose-800">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  2. User Request Limit Reject
                </div>
                <span className="mt-1 text-[11px] text-rose-700">
                  Request 25 units for Alice (limit: 20). Rejects with USER_MAX_UNITS_EXCEEDED.
                </span>
              </button>

              {/* Scenario 3 */}
              <button
                onClick={runAccountPerRequestLimit}
                disabled={loading}
                className="flex flex-col text-left rounded-xl border border-amber-200 bg-amber-50/50 p-4 transition hover:bg-amber-50 hover:border-amber-300"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-amber-800">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  3. Account Limit Reject
                </div>
                <span className="mt-1 text-[11px] text-amber-700">
                  Request 150 units for Bob (limit: 100). Rejects with ACCOUNT_MAX_UNITS_EXCEEDED.
                </span>
              </button>

              {/* Scenario 4 */}
              <button
                onClick={runIdempotentRetry}
                disabled={loading}
                className="flex flex-col text-left rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 transition hover:bg-indigo-50 hover:border-indigo-300"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-indigo-800">
                  <RotateCcw className="h-4 w-4 text-indigo-600" />
                  4. Idempotent Retry
                </div>
                <span className="mt-1 text-[11px] text-indigo-700">
                  Submits same requestId twice. Proves zero double-counting.
                </span>
              </button>

              {/* Scenario 5 */}
              <button
                onClick={runPlanUpgrade}
                disabled={loading}
                className="flex flex-col text-left rounded-xl border border-brand-200 bg-brand-50/50 p-4 transition hover:bg-brand-50 hover:border-brand-300 sm:col-span-2"
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-brand-800">
                  <TrendingUp className="h-4 w-4 text-brand-600" />
                  5. Upgrade Plan & Consume Large Units
                </div>
                <span className="mt-1 text-[11px] text-brand-700">
                  Upgrades Alice to Premium (max 100/req), then consumes 40 units which previously failed.
                </span>
              </button>
            </div>

            {/* Reset Button */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={runResetAlice}
                disabled={loading}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Reset Alice back to Basic Plan
              </button>
            </div>
          </div>

          {/* Custom Request Form */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Custom Consumption Request</h2>
            <p className="mt-1 text-xs text-slate-500">
              Submit custom units directly to <code className="text-brand-600 font-mono">POST /api/v1/consume</code>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConsume(selectedUserId, customUnits, customRequestId);
              }}
              className="mt-4 space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">User Scope</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.plan?.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Requested Units</label>
                  <input
                    type="number"
                    min="1"
                    value={customUnits}
                    onChange={(e) => setCustomUnits(parseInt(e.target.value, 10) || 1)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Request ID (Idempotency Key)</label>
                <input
                  type="text"
                  value={customRequestId}
                  onChange={(e) => setCustomRequestId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-brand-500 focus:outline-none"
                  placeholder="e.g. document-batch-901"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Evaluating in PostgreSQL...' : 'Submit to Quota Engine'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Decision Inspector & Live Output (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Decision Status Card */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Live Decision Output</h2>
            <p className="mt-1 text-xs text-slate-500">
              Evaluated decision response from QuotaFlow API
            </p>

            {actionStatus && (
              <div className="mt-3 rounded-lg bg-slate-100 p-2 text-xs text-slate-700">
                {actionStatus}
              </div>
            )}

            {lastDecision ? (
              <div className="mt-4 space-y-4">
                {/* Result Header Badge */}
                <div
                  className={`flex items-center gap-3 rounded-xl p-4 ${
                    lastDecision.accepted
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  {lastDecision.accepted ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-8 w-8 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-sm">
                      {lastDecision.accepted ? 'CONSUMPTION ACCEPTED' : 'CONSUMPTION REJECTED'}
                    </div>
                    <div className="text-xs">
                      {lastDecision.accepted
                        ? `Incremented ${lastDecision.unitsRequested} units atomically.`
                        : lastDecision.rejectionReason}
                    </div>
                    {lastDecision.idempotentReplay && (
                      <span className="mt-1 inline-block rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                        Idempotent Replay (Zero Double-Count)
                      </span>
                    )}
                  </div>
                </div>

                {/* Quota Snapshots */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-800">Quota Snapshot After Decision</div>

                  {/* Account Snapshot */}
                  <div className="border-b border-slate-100 pb-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Account ({lastDecision.account.planName} v{lastDecision.account.planVersion})</span>
                      <span className="font-semibold">{lastDecision.account.consumedUnits} / {lastDecision.account.monthlyAllowance} units</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Remaining: <strong className="text-emerald-600">{lastDecision.account.remainingUnits} units</strong> ({lastDecision.account.usagePercentage}%)
                    </div>
                  </div>

                  {/* User Snapshot */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>User ({lastDecision.user.planName} v{lastDecision.user.planVersion})</span>
                      <span className="font-semibold">{lastDecision.user.consumedUnits} / {lastDecision.user.monthlyAllowance} units</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Remaining: <strong className="text-emerald-600">{lastDecision.user.remainingUnits} units</strong> ({lastDecision.user.usagePercentage}%)
                    </div>
                  </div>
                </div>

                {/* Raw JSON Details */}
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium hover:text-slate-800">
                    View Raw JSON Payload
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
                    {JSON.stringify(lastDecision, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="mt-6 text-center py-10 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                Click a test scenario above or submit a request to observe real-time evaluation.
              </div>
            )}
          </div>

          {/* Recent Decisions History */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-sm font-bold text-slate-900">Recent Request Stream</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {recentHistory.slice(0, 5).map((req) => (
                <div key={req.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {req.status === 'ACCEPTED' ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                    )}
                    <span className="font-mono text-slate-800">{req.requestId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{req.units} units</span>
                    <span
                      className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                        req.status === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {req.status}
                    </span>
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
