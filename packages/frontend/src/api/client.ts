import type {
  DocumentItem,
  DocumentDetail,
  ExpenseItem,
  VendorItem,
  AutomationRule,
  DashboardData,
  OllamaStatus
} from '../types';

const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.error || errorMsg;
    } catch {}
    throw new ApiError(res.status, errorMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Health & AI status
  getHealth: () => request<{ status: string; database: string }>('/health'),
  getOllamaStatus: () => request<OllamaStatus>('/ollama/status'),
  startOllama: () => request<{ success: boolean; started: boolean; error?: string; status: OllamaStatus }>('/ollama/start', {
    method: 'POST'
  }),
  setOllamaModel: (model: string) => request<{ success: boolean; selectedModel: string }>('/ollama/set-model', {
    method: 'POST',
    body: JSON.stringify({ model })
  }),
  testPrompt: (prompt: string, model?: string, temperature?: number) => request<{
    success: boolean;
    model: string;
    response: string;
    latencyMs: number;
    evalCount?: number;
    evalDurationNs?: number;
  }>('/ollama/test-prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt, model, temperature })
  }),

  // Documents
  uploadDocuments: (files: File[], documentType?: string) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (documentType) formData.append('document_type', documentType);
    return request<{ message: string; documents: Array<{ id: string; filename: string; isDuplicate: boolean; status: string }> }>('/documents/upload', {
      method: 'POST',
      body: formData
    });
  },
  getDocuments: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.append(k, String(v));
    });
    return request<{
      items: DocumentItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/documents?${query.toString()}`);
  },
  getDocument: (id: string) => request<DocumentDetail>(`/documents/${id}`),
  updateDocument: (id: string, data: any) => request<{ success: boolean }>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  approveDocument: (id: string) => request<{ success: boolean }>(`/documents/${id}/approve`, {
    method: 'POST'
  }),
  reprocessDocument: (id: string) => request<{ success: boolean }>(`/documents/${id}/reprocess`, {
    method: 'POST'
  }),
  duplicateAction: (id: string, action: 'clear' | 'confirm') => request<{ success: boolean }>(`/documents/${id}/duplicate-action`, {
    method: 'POST',
    body: JSON.stringify({ action })
  }),
  deleteDocument: (id: string) => request<{ success: boolean }>(`/documents/${id}`, {
    method: 'DELETE'
  }),
  bulkAction: (ids: string[], action: 'approve' | 'delete' | 'categorize', value?: string) => request<{ success: boolean; message: string }>('/documents/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action, value })
  }),

  // Expenses
  getExpenses: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.append(k, String(v));
    });
    return request<{
      items: ExpenseItem[];
      total: number;
      totalSum: number;
      categorySummary: Array<{ category: string; count: number; total: number }>;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/expenses?${query.toString()}`);
  },
  createExpense: (data: any) => request<{ id: string }>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateExpense: (id: string, data: any) => request<{ success: boolean }>(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteExpense: (id: string) => request<{ success: boolean }>(`/expenses/${id}`, {
    method: 'DELETE'
  }),

  // Vendors
  getVendors: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<VendorItem[]>(`/vendors${q}`);
  },
  getVendorDetail: (id: string) => request<{
    vendor: VendorItem;
    stats: { expense_count: number; total_expenses: number; avg_expense: number };
    documents: any[];
    expenses: any[];
  }>(`/vendors/${id}`),
  updateVendor: (id: string, data: any) => request<{ success: boolean }>(`/vendors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  mergeVendors: (sourceVendorId: string, targetVendorId: string) => request<{ success: boolean }>(`/vendors/merge`, {
    method: 'POST',
    body: JSON.stringify({ sourceVendorId, targetVendorId })
  }),

  // Automation Rules
  getRules: () => request<AutomationRule[]>('/rules'),
  createRule: (data: any) => request<{ id: string; message: string }>('/rules', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateRule: (id: string, data: any) => request<{ success: boolean }>(`/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteRule: (id: string) => request<{ success: boolean }>(`/rules/${id}`, {
    method: 'DELETE'
  }),
  interpretRuleWithGemma: (prompt: string) => request<{ success: boolean; proposedRule: any }>('/rules/assistant', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }),
  getRuleHistory: (limit = 50) => request<any[]>(`/rules/history?limit=${limit}`),

  // Analytics & Dashboard
  getDashboardData: (startDate?: string, endDate?: string) => {
    const q = new URLSearchParams();
    if (startDate) q.append('startDate', startDate);
    if (endDate) q.append('endDate', endDate);
    return request<DashboardData>(`/analytics/dashboard?${q.toString()}`);
  },
  getReportsData: (year?: string) => request<any>(`/analytics/reports?year=${year || new Date().getFullYear()}`),

  // Exports
  exportCsvUrl: (type: string, filters: Record<string, string> = {}) => {
    const q = new URLSearchParams({ type, ...filters });
    return `/api/export/csv?${q.toString()}`;
  },
  organizeLocalFiles: () => request<{ success: boolean; message: string; destination: string }>('/export/organize', {
    method: 'POST'
  }),

  // Settings & Categories
  getSettings: () => request<any>('/settings'),
  updateSettings: (data: Record<string, string>) => request<{ success: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getCategories: () => request<any[]>('/settings/categories'),
  createCategory: (data: { name: string; color?: string; description?: string }) => request<any>('/settings/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  resetAllData: () => request<{ success: boolean; message: string }>('/settings/reset', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'RESET_ALL_DATA' })
  }),
  seedDemo: () => request<{ success: boolean; message: string }>('/settings/seed-demo', {
    method: 'POST'
  })
};
