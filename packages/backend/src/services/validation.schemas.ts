import { z } from 'zod';

export const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  tax_amount: z.number().nullable().optional(),
  total_price: z.number().nullable().optional(),
});

export const ExtractedInvoiceDataSchema = z.object({
  document_type: z.enum(['invoice', 'receipt', 'other']).default('invoice'),
  vendor_name: z.string().nullable().optional(),
  vendor_address: z.string().nullable().optional(),
  vendor_tax_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  po_number: z.string().nullable().optional(),
  invoice_date: z.string().nullable().optional(), // YYYY-MM-DD format
  due_date: z.string().nullable().optional(),     // YYYY-MM-DD format
  payment_status: z.enum(['paid', 'unpaid', 'pending', 'overdue']).nullable().optional(),
  currency: z.string().default('USD'),
  subtotal: z.number().nullable().optional(),
  discount: z.number().nullable().optional(),
  shipping: z.number().nullable().optional(),
  tax_amount: z.number().nullable().optional(),
  tax_rate: z.number().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  amount_paid: z.number().nullable().optional(),
  outstanding_balance: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  line_items: z.array(LineItemSchema).default([]),
});

export type ExtractedInvoiceData = z.infer<typeof ExtractedInvoiceDataSchema>;

export const RuleConditionSchema = z.object({
  field: z.enum([
    'vendor_name',
    'original_filename',
    'document_type',
    'total_amount',
    'currency',
    'category',
    'invoice_number',
    'extracted_text',
    'due_date'
  ]),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'matches_regex',
    'is_empty',
    'is_not_empty'
  ]),
  value: z.union([z.string(), z.number()])
});

export const RuleActionSchema = z.object({
  type: z.enum([
    'set_category',
    'add_tag',
    'set_priority',
    'flag_review',
    'flag_duplicate',
    'set_vendor_label',
    'exclude_from_reports'
  ]),
  value: z.string()
});

export const AutomationRuleInputSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  conditions: z.array(RuleConditionSchema).min(1),
  condition_match_type: z.enum(['AND', 'OR']).default('AND'),
  actions: z.array(RuleActionSchema).min(1),
});

export type AutomationRuleInput = z.infer<typeof AutomationRuleInputSchema>;
