import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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

import request from 'supertest';
import { app } from '../index.js';
import { getDb } from '../db/index.js';

describe('API Integration Endpoints - Internal Features Verification', () => {
  afterAll(() => {
    const db = getDb();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM vendors').run();
    db.prepare('DELETE FROM automation_rules').run();
    db.prepare('DELETE FROM documents').run();
  });
  it('GET / should return 200 with online status', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.name).toBe('LedgerLens Backend API');
  });

  it('GET /api/health should return healthy database status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('healthy');
  });

  it('GET /api/documents should handle clean empty state safely', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
  });

  it('should support full expense ledger lifecycle (create, read, update, delete)', async () => {
    // 1. Create manual expense
    const createRes = await request(app)
      .post('/api/expenses')
      .send({
        vendor_name: 'Test Vendor Co',
        expense_date: '2026-10-15',
        amount: 88.50,
        currency: 'USD',
        category: 'Software',
        description: 'Test subscription',
        tags: ['test', 'dev']
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const expenseId = createRes.body.id;
    expect(expenseId).toBeDefined();

    // 2. Read expenses
    const listRes = await request(app).get('/api/expenses');
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.totalSum).toBe(88.50);
    expect(listRes.body.items[0].vendor_name).toBe('Test Vendor Co');

    // 3. Update expense
    const updateRes = await request(app)
      .put(`/api/expenses/${expenseId}`)
      .send({
        vendor_name: 'Test Vendor Updated',
        amount: 99.00,
        category: 'Cloud Infrastructure'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    // 4. Delete expense
    const deleteRes = await request(app).delete(`/api/expenses/${expenseId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify it is gone
    const verifyRes = await request(app).get('/api/expenses');
    expect(verifyRes.body.total).toBe(0);
  });

  it('should support vendor directory management', async () => {
    const createRes = await request(app)
      .post('/api/vendors')
      .send({
        name: 'GitHub Inc',
        default_category: 'Software',
        tax_id: 'US-26-3820202',
        notes: 'Source code hosting'
      });
    expect(createRes.status).toBe(201);
    const vendorId = createRes.body.id;

    const listRes = await request(app).get('/api/vendors');
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((v: any) => v.name === 'GitHub Inc')).toBe(true);

    // Clean up
    await request(app).delete(`/api/vendors/${vendorId}`);
  });

  it('should support automation rules creation, testing, and deletion', async () => {
    const createRes = await request(app)
      .post('/api/rules')
      .send({
        name: 'Auto Software Tag',
        enabled: true,
        priority: 10,
        condition_match_type: 'AND',
        conditions: [
          { field: 'vendor_name', operator: 'contains', value: 'JetBrains' }
        ],
        actions: [
          { type: 'set_category', value: 'Software' }
        ]
      });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;

    // Test rule matching endpoint
    const testRes = await request(app)
      .post('/api/rules/test')
      .send({
        rule: {
          name: 'Test',
          enabled: true,
          priority: 1,
          condition_match_type: 'AND',
          conditions: [{ field: 'vendor_name', operator: 'contains', value: 'JetBrains' }],
          actions: [{ type: 'set_category', value: 'Software' }]
        },
        sampleDocument: {
          vendor_name: 'JetBrains s.r.o.',
          total_amount: 199.00
        }
      });
    expect(testRes.status).toBe(200);
    expect(testRes.body.matched).toBe(true);

    // Clean up
    await request(app).delete(`/api/rules/${ruleId}`);
  });

  it('GET /api/analytics/dashboard should return zeroed metrics without crashing', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.totalDocuments).toBe(0);
    expect(res.body.metrics.totalExpenses).toBe(0);
    expect(Array.isArray(res.body.monthlyTrend)).toBe(true);
    expect(Array.isArray(res.body.spendingByCategory)).toBe(true);
  });

  it('GET /api/export/csv should return CSV format with appropriate headers', async () => {
    const res = await request(app).get('/api/export/csv?type=expenses');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Expense ID,Date,Vendor');
  });

  it('GET /api/settings should return storage statistics and categories', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.storage).toBeDefined();
    expect(res.body.storage.dataDir).toBeDefined();
    expect(res.body.settings.selected_model).toBeDefined();
  });
});
