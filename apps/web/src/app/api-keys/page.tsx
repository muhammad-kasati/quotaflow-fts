'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { Key, Plus, RefreshCw, Trash2, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyModal, setNewKeyModal] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyName, setKeyName] = useState('');

  const loadKeys = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getApiKeys('account_demo_acme');
      setKeys(res.data || []);
    } catch (err: any) {
      alert(`Error loading keys: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.createApiKey(keyName || 'Live Key', 'account_demo_acme');
      setNewKeyModal(res.data);
      setKeyName('');
      await loadKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    if (!confirm('Rotating will immediately revoke the old key. Proceed?')) return;
    try {
      const res = await apiClient.rotateApiKey(keyId, 'account_demo_acme');
      setNewKeyModal(res.data.newKey);
      await loadKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    try {
      await apiClient.revokeApiKey(keyId, 'account_demo_acme');
      await loadKeys();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            API Key Management
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Cryptographically secure API keys for authenticating consumption requests. Only hashed keys are persisted in PostgreSQL.
          </p>
        </div>

        <form onSubmit={handleCreateKey} className="flex gap-2">
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key Description"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Generate New Key
          </button>
        </form>
      </div>

      {/* Keys Table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 text-slate-400 font-semibold">
              <tr>
                <th className="pb-3">Key Name</th>
                <th className="pb-3">Prefix</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Created</th>
                <th className="pb-3">Last Used</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-slate-50/50">
                  <td className="py-3 font-semibold text-slate-900 flex items-center gap-2">
                    <Key className="h-4 w-4 text-slate-400" />
                    {k.name}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-600">{k.keyPrefix}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        k.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {k.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 text-slate-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleTimeString() : 'Never'}
                  </td>
                  <td className="py-3 text-right space-x-2">
                    {k.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => handleRotateKey(k.id)}
                          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Rotate
                        </button>
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3 w-3" />
                          Revoke
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Show Plaintext Key Modal (Shown ONLY ONCE) */}
      {newKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900">API Key Generated Successfully</h3>
            </div>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="inline-block h-3.5 w-3.5 mr-1" />
              <strong>Warning:</strong> Copy this key immediately. For your security, this plaintext key is never stored and will not be displayed again.
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">Raw Secret Key</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-xs text-slate-900">
                <span className="flex-1 break-all select-all">{newKeyModal.rawKey}</span>
                <button
                  onClick={() => copyToClipboard(newKeyModal.rawKey)}
                  className="rounded bg-white p-1.5 text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setNewKeyModal(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                I Have Saved My Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
