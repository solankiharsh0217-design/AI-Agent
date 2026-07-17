const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

// Clerk session tokens are short-lived (~60s). Instead of caching a token, we hold a
// getter (Clerk's getToken) and fetch a fresh token per request — Clerk caches and
// refreshes internally, so this is cheap and never sends an expired token. Caching a
// single token for minutes (the previous behavior) meant most requests carried an
// already-expired token and were rejected by the worker.
let tokenGetter: (() => Promise<string | null>) | null = null;
let lastKnownToken: string | null = null;

let markAuthReady: () => void;
const authReady = new Promise<void>((resolve) => { markAuthReady = resolve; });

export function setClerkTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
  markAuthReady();
}

// Backwards-compatible: pages call this after getToken(). It seeds a last-known token
// and marks auth ready — used as a fallback when no getter is registered yet.
export function setClerkToken(token: string | null) {
  lastKnownToken = token;
  markAuthReady();
}

async function getAuthToken(): Promise<string | null> {
  await authReady;
  if (tokenGetter) {
    try {
      const fresh = await tokenGetter();
      if (fresh) lastKnownToken = fresh;
      return fresh ?? lastKnownToken;
    } catch {
      return lastKnownToken;
    }
  }
  return lastKnownToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/v1${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.data ?? data;
}

export const api = {
  agents: {
    list: () => request<any[]>('/agents'),
    get: (id: string) => request<any>(`/agents/${id}`),
    create: (data: any) => request<any>('/agents', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/agents/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => request<void>(`/agents/${id}`, { method: 'DELETE' }),
    publish: (id: string) => request<any>(`/agents/${id}/publish`, { method: 'POST' }),
    archive: (id: string) => request<any>(`/agents/${id}/archive`, { method: 'POST' }),
  },
  knowledge: {
    list: () => request<any[]>('/knowledge'),
    get: (id: string) => request<any>(`/knowledge/${id}`),
    create: (data: any) => request<any>('/knowledge', { method: 'POST', body: data }),
    delete: (id: string) => request<void>(`/knowledge/${id}`, { method: 'DELETE' }),
    uploadDocument: async (kbId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      const uploadToken = await getAuthToken();
      if (uploadToken) {
        headers['Authorization'] = `Bearer ${uploadToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/${kbId}/documents`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      return response.json();
    },
    listDocuments: (kbId: string) => request<any[]>(`/knowledge/${kbId}/documents`),
    deleteDocument: (kbId: string, documentId: string) => request<void>(`/knowledge/${kbId}/documents/${documentId}`, { method: 'DELETE' }),
  },
  conversations: {
    list: (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      // Return full response with data and meta for pagination
      return request<any>(`/conversations?${query.toString()}`);
    },
    get: (id: string) => request<any>(`/conversations/${id}`),
    delete: (id: string) => request<void>(`/conversations/${id}`, { method: 'DELETE' }),
    getMessages: (id: string) => request<any[]>(`/conversations/${id}/messages`),
  },
  widgets: {
    list: () => request<any[]>('/widgets'),
    get: (id: string) => request<any>(`/widgets/${id}`),
    create: (data: any) => request<any>('/widgets', { method: 'POST', body: data }),
    update: (id: string, data: any) => request<any>(`/widgets/${id}`, { method: 'PATCH', body: data }),
    delete: (id: string) => request<void>(`/widgets/${id}`, { method: 'DELETE' }),
  },
  analytics: {
    get: (params?: { from?: string; to?: string; agentId?: string }) => {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      if (params?.agentId) query.set('agentId', params.agentId);
      return request<any>(`/analytics?${query.toString()}`);
    },
    getUsage: (params?: { from?: string; to?: string }) => {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      return request<any[]>(`/analytics/usage?${query.toString()}`);
    },
    getCost: (params?: { from?: string; to?: string }) => {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      return request<any>(`/analytics/cost?${query.toString()}`);
    },
  },
  phone: {
    listNumbers: () => request<any[]>('/phone/numbers'),
    createNumber: (data: any) => request<any>('/phone/numbers', { method: 'POST', body: data }),
    assignAgent: (id: string, agentId: string) => request<any>(`/phone/numbers/${id}/assign`, { method: 'POST', body: { agentId } }),
    releaseNumber: (id: string) => request<any>(`/phone/numbers/${id}/release`, { method: 'POST' }),
    listCalls: () => request<any[]>('/phone/calls'),
  },
  user: {
    me: () => request<any>('/users/me'),
  },
  billing: {
    getSubscription: () => request<any>('/billing/subscription'),
    getInvoices: () => request<any[]>('/billing/invoices'),
    getUsage: () => request<any[]>('/billing/usage'),
    getPlans: () => request<any[]>('/billing/plans'),
    upgradePlan: (planSlug: string) => request<any>('/billing/checkout', { method: 'POST', body: { planSlug } }),
    cancelSubscription: () => request<any>('/billing/subscription', { method: 'DELETE' }),
  },
};
