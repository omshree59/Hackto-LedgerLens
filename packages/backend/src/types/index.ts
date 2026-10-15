export type DocumentType = 'invoice' | 'receipt' | 'other';
export type DocumentStatus = 'uploaded' | 'processing' | 'needs_review' | 'approved' | 'failed' | 'archived';
export type PaymentStatus = 'paid' | 'unpaid' | 'pending' | 'overdue' | null;

export interface DocumentRecord {
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
}

export interface ExtractedDataRecord {
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
  payment_status: PaymentStatus;
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
  created_at: string;
  updated_at: string;
}

export interface LineItemRecord {
  id: string;
  document_id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  tax_amount: number | null;
  total_price: number | null;
  item_order: number;
}

export interface ExpenseRecord {
  id: string;
  document_id: string | null;
  expense_date: string;
  vendor_name: string;
  description: string | null;
  category: string;
  amount: number;
  currency: string;
  status: 'pending_review' | 'approved' | 'rejected';
  tags: string[];
  is_duplicate: number;
  created_at: string;
  updated_at: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  normalized_name: string;
  default_category: string | null;
  tax_id: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  document_count?: number;
  total_spent?: number;
  last_invoice_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  is_system: number;
  created_at: string;
}

export type RuleConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'matches_regex'
  | 'is_empty'
  | 'is_not_empty';

export type RuleConditionField =
  | 'vendor_name'
  | 'original_filename'
  | 'document_type'
  | 'total_amount'
  | 'currency'
  | 'category'
  | 'invoice_number'
  | 'extracted_text'
  | 'due_date';

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string | number;
}

export type RuleActionType =
  | 'set_category'
  | 'add_tag'
  | 'set_priority'
  | 'flag_review'
  | 'flag_duplicate'
  | 'set_vendor_label'
  | 'exclude_from_reports';

export interface RuleAction {
  type: RuleActionType;
  value: string;
}

export interface AutomationRuleRecord {
  id: string;
  name: string;
  enabled: number;
  priority: number;
  conditions: RuleCondition[];
  condition_match_type: 'AND' | 'OR';
  actions: RuleAction[];
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessingJobRecord {
  id: string;
  document_id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
