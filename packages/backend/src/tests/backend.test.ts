import { describe, it, expect, beforeEach } from 'vitest';
import { ExportService } from '../services/export.service.js';
import { DuplicateService } from '../services/duplicate.service.js';
import { RulesService } from '../services/rules.service.js';
import { ExtractedInvoiceDataSchema, AutomationRuleInputSchema } from '../services/validation.schemas.js';

describe('ExportService - CSV Escaping & Injection Defense', () => {
  it('should escape dangerous formula injection prefixes', () => {
    expect(ExportService.sanitizeCsvValue('=1+2')).toBe("'=1+2");
    expect(ExportService.sanitizeCsvValue('+CMD|test')).toBe("'+CMD|test");
    expect(ExportService.sanitizeCsvValue('-100')).toBe("'-100");
    expect(ExportService.sanitizeCsvValue('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
  });

  it('should quote strings containing commas or quotes', () => {
    expect(ExportService.sanitizeCsvValue('Acme, Inc.')).toBe('"Acme, Inc."');
    expect(ExportService.sanitizeCsvValue('Widget "Pro"')).toBe('"Widget ""Pro"""');
  });

  it('should handle null and undefined safely', () => {
    expect(ExportService.sanitizeCsvValue(null)).toBe('');
    expect(ExportService.sanitizeCsvValue(undefined)).toBe('');
  });
});

describe('DuplicateService - Vendor Normalization', () => {
  it('should normalize vendor names by stripping legal suffixes and punctuation', () => {
    expect(DuplicateService.normalizeVendorName('Google LLC')).toBe('google');
    expect(DuplicateService.normalizeVendorName('Cloudflare, Inc.')).toBe('cloudflare');
    expect(DuplicateService.normalizeVendorName('Amazon Web Services, Corp.')).toBe('amazonwebservices');
    expect(DuplicateService.normalizeVendorName('Acme Co.')).toBe('acme');
  });
});

describe('RulesService - Condition Evaluation Engine', () => {
  const sampleData = {
    document_type: 'invoice' as const,
    vendor_name: 'GitHub Inc',
    invoice_number: 'INV-2026-001',
    invoice_date: '2026-10-01',
    due_date: '2026-10-15',
    total_amount: 42.50,
    currency: 'USD',
    category: 'Software',
    tags: ['dev'],
    line_items: []
  };

  it('should evaluate contains condition correctly', () => {
    const cond = { field: 'vendor_name' as const, operator: 'contains' as const, value: 'github' };
    expect(RulesService.evaluateCondition(cond, sampleData, 'invoice.pdf', '')).toBe(true);
  });

  it('should evaluate greater_than condition on amount', () => {
    const cond1 = { field: 'total_amount' as const, operator: 'greater_than' as const, value: 40 };
    const cond2 = { field: 'total_amount' as const, operator: 'greater_than' as const, value: 50 };
    expect(RulesService.evaluateCondition(cond1, sampleData, 'invoice.pdf', '')).toBe(true);
    expect(RulesService.evaluateCondition(cond2, sampleData, 'invoice.pdf', '')).toBe(false);
  });

  it('should handle AND vs OR rule matching logic', () => {
    const ruleAnd = {
      conditions: [
        { field: 'vendor_name' as const, operator: 'contains' as const, value: 'github' },
        { field: 'total_amount' as const, operator: 'greater_than' as const, value: 100 }
      ],
      condition_match_type: 'AND' as const
    };
    expect(RulesService.matchesRule(ruleAnd, sampleData, 'invoice.pdf', '')).toBe(false);

    const ruleOr = {
      conditions: [
        { field: 'vendor_name' as const, operator: 'contains' as const, value: 'github' },
        { field: 'total_amount' as const, operator: 'greater_than' as const, value: 100 }
      ],
      condition_match_type: 'OR' as const
    };
    expect(RulesService.matchesRule(ruleOr, sampleData, 'invoice.pdf', '')).toBe(true);
  });
});

describe('Zod Schema Validation', () => {
  it('should validate complete structured invoice data', () => {
    const validData = {
      document_type: 'invoice',
      vendor_name: 'Amazon Web Services',
      invoice_number: 'AWS-12345',
      invoice_date: '2026-10-01',
      due_date: '2026-10-31',
      total_amount: 125.50,
      currency: 'USD',
      category: 'Cloud Infrastructure',
      line_items: [
        { description: 'EC2 instances', quantity: 1, unit_price: 125.50, total_price: 125.50 }
      ]
    };

    const parsed = ExtractedInvoiceDataSchema.parse(validData);
    expect(parsed.vendor_name).toBe('Amazon Web Services');
    expect(parsed.total_amount).toBe(125.50);
    expect(parsed.line_items.length).toBe(1);
  });

  it('should allow null for missing fields without failing', () => {
    const minimalData = {
      vendor_name: null,
      total_amount: null,
      invoice_date: null
    };
    const parsed = ExtractedInvoiceDataSchema.parse(minimalData);
    expect(parsed.vendor_name).toBeNull();
    expect(parsed.currency).toBe('USD');
  });

  it('should validate structured automation rule input', () => {
    const validRule = {
      name: 'Tag AWS',
      enabled: true,
      priority: 1,
      conditions: [
        { field: 'vendor_name', operator: 'contains', value: 'AWS' }
      ],
      condition_match_type: 'AND',
      actions: [
        { type: 'set_category', value: 'Cloud Infrastructure' }
      ]
    };
    const parsed = AutomationRuleInputSchema.parse(validRule);
    expect(parsed.name).toBe('Tag AWS');
    expect(parsed.actions[0].type).toBe('set_category');
  });
});
