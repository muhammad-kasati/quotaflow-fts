const API_BASE =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
    : process.env.INTERNAL_API_URL || 'http://localhost:4000';

const DEFAULT_DEMO_KEY = 'qf_live_demo_acme_production_key_2026';
const DEFAULT_ADMIN_KEY = 'qf_admin_dev_bootstrap_secret_key_2026';

export async function fetchFromApi(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (apiKey) {
    headers.set('X-API-Key', apiKey);
  } else {
    // Default to demo key or admin key based on endpoint
    if (endpoint.startsWith('/api/v1/audit-logs') || endpoint.startsWith('/api/v1/accounts')) {
      headers.set('X-Admin-Key', DEFAULT_ADMIN_KEY);
    } else {
      headers.set('X-API-Key', DEFAULT_DEMO_KEY);
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return res.text();
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Request failed with status ${res.status}`);
  }

  return json;
}

export const apiClient = {
  // Consumption
  consume: (data: { userId: string; units: number; requestId: string }, apiKey?: string) =>
    fetchFromApi('/api/v1/consume', { method: 'POST', body: JSON.stringify(data) }, apiKey),

  // Analytics
  getAnalytics: (period?: string, apiKey?: string) =>
    fetchFromApi(`/api/v1/analytics${period ? `?period=${period}` : ''}`, {}, apiKey),

  // Accounts
  getAccounts: () => fetchFromApi('/api/v1/accounts'),
  getAccountOverview: (accountId: string, period?: string) =>
    fetchFromApi(`/api/v1/accounts/${accountId}/overview${period ? `?period=${period}` : ''}`),
  updateAccount: (accountId: string, data: { name?: string; planId?: string }) =>
    fetchFromApi(`/api/v1/accounts/${accountId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Users
  getUsers: (accountId?: string) =>
    fetchFromApi(`/api/v1/users${accountId ? `?accountId=${accountId}` : ''}`),
  createUser: (data: { name: string; planId: string }, accountId?: string) =>
    fetchFromApi(`/api/v1/users${accountId ? `?accountId=${accountId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getUserOverview: (userId: string, period?: string) =>
    fetchFromApi(`/api/v1/users/${userId}/overview${period ? `?period=${period}` : ''}`),
  updateUser: (userId: string, data: { name?: string; planId?: string }) =>
    fetchFromApi(`/api/v1/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Plans
  getPlans: () => fetchFromApi('/api/v1/plans'),
  updatePlan: (
    planId: string,
    data: { name?: string; monthlyAllowance?: number; maxUnitsPerRequest?: number; changeReason?: string }
  ) => fetchFromApi(`/api/v1/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // History & Inspector
  getHistory: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchFromApi(`/api/v1/history?${q}`);
  },
  getRequestDetails: (requestId: string) =>
    fetchFromApi(`/api/v1/history/requests/${requestId}`),
  getExportUrl: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return `${API_BASE}/api/v1/history/export?${q}`;
  },

  // API Keys
  getApiKeys: (accountId?: string) =>
    fetchFromApi(`/api/v1/api-keys${accountId ? `?accountId=${accountId}` : ''}`),
  createApiKey: (name: string, accountId?: string) =>
    fetchFromApi(`/api/v1/api-keys${accountId ? `?accountId=${accountId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  rotateApiKey: (keyId: string, accountId?: string) =>
    fetchFromApi(`/api/v1/api-keys/${keyId}/rotate${accountId ? `?accountId=${accountId}` : ''}`, {
      method: 'POST',
    }),
  revokeApiKey: (keyId: string, accountId?: string) =>
    fetchFromApi(`/api/v1/api-keys/${keyId}${accountId ? `?accountId=${accountId}` : ''}`, {
      method: 'DELETE',
    }),

  // Alerts & Webhooks
  getAlerts: () => fetchFromApi('/api/v1/alerts'),
  getWebhooks: () => fetchFromApi('/api/v1/webhooks'),
  createWebhook: (data: { url: string; secret?: string; events?: string[] }) =>
    fetchFromApi('/api/v1/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  deleteWebhook: (id: string) => fetchFromApi(`/api/v1/webhooks/${id}`, { method: 'DELETE' }),
  getWebhookEvents: () => fetchFromApi('/api/v1/webhooks/events'),

  // Audit Logs
  getAuditLogs: (page = 1, limit = 20) =>
    fetchFromApi(`/api/v1/audit-logs?page=${page}&limit=${limit}`),
};
