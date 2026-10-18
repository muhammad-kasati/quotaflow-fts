'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { Webhook, Plus, Bell, CheckCircle2, AlertTriangle, Trash2, ArrowUpRight } from 'lucide-react';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [wRes, aRes, eRes] = await Promise.all([
        apiClient.getWebhooks(),
        apiClient.getAlerts(),
        apiClient.getWebhookEvents(),
      ]);
      setWebhooks(wRes.data || []);
      setAlerts(aRes.data || []);
      setEvents(eRes.data || []);
    } catch (err: any) {
      alert(`Error loading data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    try {
      await apiClient.createWebhook({
        url: newUrl,
        secret: newSecret || undefined,
        events: ['THRESHOLD_80', 'THRESHOLD_90', 'THRESHOLD_100'],
      });
      setNewUrl('');
      setNewSecret('');
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Remove this webhook?')) return;
    try {
      await apiClient.deleteWebhook(id);
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Usage Alerts & Webhooks
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Subscribe to 80%, 90%, and 100% quota threshold events. Dispatched via reliable outbox with HMAC-SHA256 signature verification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Webhook Config & Outbox (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Create Webhook */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Webhook className="h-4 w-4 text-brand-600" />
              Register Webhook Endpoint
            </h2>

            <form onSubmit={handleCreateWebhook} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Webhook URL</label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://your-service.com/quotaflow-webhook"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">HMAC Signing Secret (Optional)</label>
                <input
                  type="text"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  placeholder="Min 16 characters (or generated automatically)"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Register Webhook
              </button>
            </form>
          </div>

          {/* Active Webhooks List */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Active Webhook Subscriptions</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {webhooks.map((w) => (
                <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono font-semibold text-slate-800">{w.url}</div>
                    <div className="text-[11px] text-slate-400">
                      Secret: {w.secret || 'Auto'} • Events: {w.events.join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(w.id)}
                    className="rounded p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {webhooks.length === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">No webhooks configured.</div>
              )}
            </div>
          </div>

          {/* Outbox Event Dispatch Logs */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Outbox Event Queue & Delivery Attempts</h2>
            <div className="mt-3 divide-y divide-slate-100 text-xs">
              {events.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{e.eventType}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(e.createdAt).toLocaleTimeString()} • Attempts: {e.attempts}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      e.status === 'DELIVERED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : e.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              ))}
              {events.length === 0 && (
                <div className="py-4 text-center text-xs text-slate-400">No events dispatched yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Quota Alerts Feed (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" />
              Threshold Alerts (80% / 90% / 100%)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Triggered when account or user consumption crosses quota thresholds.
            </p>

            <div className="mt-4 space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border p-3.5 text-xs ${
                    a.threshold === 100
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : a.threshold === 90
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-blue-200 bg-blue-50 text-blue-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>{a.scope} QUOTA AT {a.threshold}%</span>
                    <span className="font-mono text-[10px]">{a.period}</span>
                  </div>
                  <div className="mt-1 text-xs">
                    {a.user ? `User: ${a.user.name} • ` : 'Account Shared • '}
                    {a.consumedUnits} of {a.monthlyAllowance} units used ({a.percentage}%)
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No quota thresholds crossed this month yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
