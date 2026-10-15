export type DocumentType = 'invoice' | 'receipt' | 'other';
export type DocumentStatus = 'uploaded' | 'processing' | 'needs_review' | 'approved' | 'failed' | 'archived';

export interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  document_type: DocumentType;
  status: DocumentStatus;
  is_duplicate: number;
  duplicate_of_id: string | null;
  duplicate_reason: string | null;
  ocr_confidence: number | null;
  created_at: string;
  updated_at: string;
  vendor_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_status: string | null;
  currency: string;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  category: string | null;
  tags: string[];
  validation_warnings: string[];
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  tax_amount: number | null;
  total_price: number | null;
}

export interface DocumentDetail {
  document: {
    id: string;
    filename: string;
    original_filename: string;
    mime_type: string;
    file_size: number;
    file_hash: string;
    storage_path: string;
    document_type: DocumentType;
    status: DocumentStatus;
    is_duplicate: number;
    duplicate_of_id: string | null;
    duplicate_reason: string | null;
    extracted_text: string | null;
    ocr_confidence: number | null;
    created_at: string;
    updated_at: string;
  };
  extractedData: {
    id: string;
    document_id: string;
    document_type: DocumentType;
    vendor_name: string | null;
    vendor_address: string | null;
    vendor_tax_id: string | null;
    customer_name: string | null;
    invoice_number: string | null;
    po_number: string | null;
    invoice_date: string | null;
    due_date: string | null;
    payment_status: string | null;
    currency: string;
    subtotal: number | null;
    discount: number | null;
    shipping: number | null;
    tax_amount: number | null;
    tax_rate: number | null;
    total_amount: number | null;
    amount_paid: number | null;
    outstanding_balance: number | null;
    category: string | null;
    description: string | null;
    notes: string | null;
    tags: string[];
    confidence_scores: Record<string, number>;
    validation_warnings: string[];
    extraction_model: string | null;
  } | null;
  lineItems: LineItem[];
  jobs: Array<{
    id: string;
    status: string;
    progress: number;
    error_message: string | null;
    created_at: string;
  }>;
  duplicateOfDoc: {
    id: string;
    original_filename: string;
    status: string;
    vendor_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    total_amount: number | null;
  } | null;
}

export interface ExpenseItem {
  id: string;
  document_id: string | null;
  expense_date: string;
  vendor_name: string;
  description: string | null;
  category: string;
  amount: number;
  currency: string;
  status: string;
  tags: string[];
  is_duplicate: number;
  created_at: string;
}

export interface VendorItem {
  id: string;
  name: string;
  normalized_name: string;
  default_category: string | null;
  tax_id: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  document_count: number;
  total_spent: number;
  last_invoice_date: string | null;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: Array<{
    field: string;
    operator: string;
    value: string | number;
  }>;
  condition_match_type: 'AND' | 'OR';
  actions: Array<{
    type: string;
    value: string;
  }>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
}

export interface DashboardData {
  metrics: {
    totalInvoices: number;
    totalReceipts: number;
    totalDocuments: number;
    totalExpenses: number;
    expenseCount: number;
    awaitingReview: number;
    duplicateCandidates: number;
  };
  monthlyTrend: Array<{ month: string; total: number; count: number }>;
  spendingByCategory: Array<{ category: string; total: number; count: number }>;
  spendingByVendor: Array<{ vendor: string; total: number; count: number }>;
  recentDocuments: Array<{
    id: string;
    original_filename: string;
    document_type: DocumentType;
    status: DocumentStatus;
    is_duplicate: number;
    created_at: string;
    vendor_name: string | null;
    total_amount: number | null;
    currency: string;
    category: string | null;
  }>;
  processingStats: Array<{ status: string; count: number }>;
  paymentBreakdown: Array<{ status: string; count: number; total: number }>;
}

export interface OllamaStatus {
  isOnline: boolean;
  models: string[];
  selectedModel: string;
  modelFound: boolean;
  error?: string;
}
