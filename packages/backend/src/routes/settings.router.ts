import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/index.js';
import { DATA_DIR, UPLOADS_DIR, EXPORTS_DIR, DB_FILE } from '../config.js';
import { OllamaService } from '../services/ollama.service.js';

const router = Router();

/**
 * Get all application settings and storage statistics
 */
router.get('/', async (req, res) => {
  const db = getDb();
  const settingsRows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  // Calculate local disk storage usage
  let uploadFilesCount = 0;
  let uploadBytes = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    uploadFilesCount = files.length;
    files.forEach(f => {
      try {
        const stats = fs.statSync(path.join(UPLOADS_DIR, f));
        uploadBytes += stats.size;
      } catch {}
    });
  }

  let dbBytes = 0;
  if (fs.existsSync(DB_FILE)) {
    try {
      dbBytes = fs.statSync(DB_FILE).size;
    } catch {}
  }

  // Get Ollama status
  const ollamaStatus = await OllamaService.checkHealth();

  res.json({
    settings,
    storage: {
      dataDir: DATA_DIR,
      uploadFilesCount,
      uploadSizeMb: (uploadBytes / (1024 * 1024)).toFixed(2),
      dbSizeMb: (dbBytes / (1024 * 1024)).toFixed(2),
      totalSizeMb: ((uploadBytes + dbBytes) / (1024 * 1024)).toFixed(2)
    },
    ollama: ollamaStatus
  });
});

/**
 * Update application settings
 */
router.put('/', (req, res) => {
  const db = getDb();
  const entries = Object.entries(req.body);

  const updateStmt = db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value)
    VALUES (?, ?)
  `);

  const tx = db.transaction(() => {
    for (const [k, v] of entries) {
      if (typeof v === 'string') {
        updateStmt.run(k, v);
      }
    }
  });

  tx();
  res.json({ success: true, message: 'Settings updated successfully' });
});

/**
 * Get categories list
 */
router.get('/categories', (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(categories);
});

/**
 * Create custom category
 */
router.post('/categories', (req, res) => {
  const { name, color = '#10b981', description, icon = 'Tag' } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const db = getDb();
  const id = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO categories (id, name, color, description, icon, is_system)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, name.trim(), color, description || null, icon);
    res.status(201).json({ id, name: name.trim(), message: 'Category created' });
  } catch (err: any) {
    res.status(400).json({ error: 'Category with this name already exists' });
  }
});

/**
 * Delete custom category
 */
router.delete('/categories/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (cat.is_system) return res.status(400).json({ error: 'Cannot delete default system category' });

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true, message: 'Category deleted' });
});

/**
 * Reset all application records and clear stored documents
 */
router.post('/reset', (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'RESET_ALL_DATA') {
    return res.status(400).json({ error: 'Confirmation string "RESET_ALL_DATA" required' });
  }

  const db = getDb();
  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM line_items').run();
    db.prepare('DELETE FROM extracted_data').run();
    db.prepare('DELETE FROM processing_jobs').run();
    db.prepare('DELETE FROM rule_history').run();
    db.prepare('DELETE FROM automation_rules').run();
    db.prepare('DELETE FROM vendors').run();
    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM categories WHERE is_system = 0').run();
  });

  resetTx();

  // Clear uploaded files
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      } catch {}
    }
  }

  // Clear organized exported directory
  const organizedDir = path.join(EXPORTS_DIR, 'organized');
  if (fs.existsSync(organizedDir)) {
    try {
      fs.rmSync(organizedDir, { recursive: true, force: true });
    } catch {}
  }

  res.json({ success: true, message: 'All application records and local files have been reset.' });
});

/**
 * Seed realistic synthetic demo records for freelancers and small businesses
 * All items are clearly labeled with "(Demo)" tag
 */
router.post('/seed-demo', (req, res) => {
  const db = getDb();

  const demoVendors = [
    { name: 'Cloudflare, Inc.', category: 'Software', taxId: 'US-27-0130541' },
    { name: 'Amazon Web Services', category: 'Cloud Infrastructure', taxId: 'US-91-1646860' },
    { name: 'GitHub, Inc.', category: 'Software', taxId: 'US-26-3820202' },
    { name: 'Figma Design', category: 'Software', taxId: 'US-45-5629193' },
    { name: 'Google Workspace', category: 'Software', taxId: 'US-94-3257850' },
    { name: 'Delta Air Lines', category: 'Travel', taxId: 'US-58-0218548' },
    { name: 'Blue Bottle Coffee', category: 'Meals & Dining', taxId: 'US-94-1122334' },
    { name: 'Staples Office Supplies', category: 'Office Supplies', taxId: 'US-04-2896127' },
    { name: 'Apple Store', category: 'Equipment & Hardware', taxId: 'US-94-2404110' },
    { name: 'Vercel Inc.', category: 'Cloud Infrastructure', taxId: 'US-84-4821034' },
  ];

  const demoInvoices = [
    {
      vendor: 'Cloudflare, Inc.',
      invoiceNum: 'INV-CF-88291',
      date: '2026-09-12',
      dueDate: '2026-10-12',
      amount: 25.00,
      subtotal: 25.00,
      tax: 0.00,
      category: 'Software',
      status: 'approved',
      docType: 'invoice',
      desc: 'Workers Paid Subscription & DNS Pro plan',
      items: [{ desc: 'Cloudflare Workers Paid', qty: 1, unit: 5.00, total: 5.00 }, { desc: 'Pro Zone Plan (monthly)', qty: 1, unit: 20.00, total: 20.00 }]
    },
    {
      vendor: 'Amazon Web Services',
      invoiceNum: 'AWS-99120412',
      date: '2026-09-30',
      dueDate: '2026-10-31',
      amount: 148.72,
      subtotal: 136.44,
      tax: 12.28,
      category: 'Cloud Infrastructure',
      status: 'approved',
      docType: 'invoice',
      desc: 'AWS Monthly Cloud Services (EC2, S3, RDS)',
      items: [{ desc: 'Amazon EC2 compute instances', qty: 720, unit: 0.11, total: 79.20 }, { desc: 'Amazon Simple Storage Service', qty: 1, unit: 15.24, total: 15.24 }, { desc: 'Amazon Aurora RDS Database', qty: 1, unit: 42.00, total: 42.00 }]
    },
    {
      vendor: 'GitHub, Inc.',
      invoiceNum: 'GH-2026-0941',
      date: '2026-10-01',
      dueDate: '2026-10-15',
      amount: 42.00,
      subtotal: 42.00,
      tax: 0.00,
      category: 'Software',
      status: 'approved',
      docType: 'invoice',
      desc: 'GitHub Team Subscription (2 seats) + Copilot',
      items: [{ desc: 'GitHub Team (2 users)', qty: 2, unit: 11.00, total: 22.00 }, { desc: 'GitHub Copilot Business', qty: 1, unit: 20.00, total: 20.00 }]
    },
    {
      vendor: 'Figma Design',
      invoiceNum: 'FIG-88310',
      date: '2026-10-04',
      dueDate: '2026-10-18',
      amount: 45.00,
      subtotal: 45.00,
      tax: 0.00,
      category: 'Software',
      status: 'approved',
      docType: 'invoice',
      desc: 'Figma Professional Monthly License',
      items: [{ desc: 'Figma Professional Editor seat', qty: 3, unit: 15.00, total: 45.00 }]
    },
    {
      vendor: 'Apple Store',
      invoiceNum: 'APL-R-90214',
      date: '2026-10-08',
      dueDate: '2026-10-08',
      amount: 1499.00,
      subtotal: 1375.23,
      tax: 123.77,
      category: 'Equipment & Hardware',
      status: 'needs_review',
      docType: 'receipt',
      desc: 'MacBook Pro M3 Hardware purchase',
      items: [{ desc: 'MacBook Pro 14-inch Space Gray', qty: 1, unit: 1375.23, total: 1375.23 }]
    },
    {
      vendor: 'Delta Air Lines',
      invoiceNum: 'DL-8829410',
      date: '2026-09-18',
      dueDate: '2026-09-18',
      amount: 382.40,
      subtotal: 350.00,
      tax: 32.40,
      category: 'Travel',
      status: 'approved',
      docType: 'receipt',
      desc: 'Round-trip flight SFO - JFK for client summit',
      items: [{ desc: 'Flight SFO to JFK Return Comfort+', qty: 1, unit: 350.00, total: 350.00 }]
    },
    {
      vendor: 'Blue Bottle Coffee',
      invoiceNum: 'BB-98102',
      date: '2026-10-11',
      dueDate: '2026-10-11',
      amount: 28.50,
      subtotal: 26.20,
      tax: 2.30,
      category: 'Meals & Dining',
      status: 'needs_review',
      docType: 'receipt',
      desc: 'Client meeting coffee & pastry',
      items: [{ desc: 'Cold brew & pastry platter', qty: 1, unit: 26.20, total: 26.20 }]
    },
    {
      vendor: 'Staples Office Supplies',
      invoiceNum: 'STP-44019',
      date: '2026-09-22',
      dueDate: '2026-10-06',
      amount: 84.19,
      subtotal: 77.24,
      tax: 6.95,
      category: 'Office Supplies',
      status: 'approved',
      docType: 'invoice',
      desc: 'Paper, printer ink cartridges and desk organizer',
      items: [{ desc: 'Copy paper carton', qty: 1, unit: 34.99, total: 34.99 }, { desc: 'Desk tray organizer', qty: 2, unit: 21.12, total: 42.25 }]
    },
    {
      vendor: 'Vercel Inc.',
      invoiceNum: 'VCL-2026-1092',
      date: '2026-10-14',
      dueDate: '2026-10-28',
      amount: 20.00,
      subtotal: 20.00,
      tax: 0.00,
      category: 'Cloud Infrastructure',
      status: 'needs_review',
      docType: 'invoice',
      desc: 'Vercel Pro Monthly subscription',
      items: [{ desc: 'Vercel Pro Team', qty: 1, unit: 20.00, total: 20.00 }]
    }
  ];

  const seedTx = db.transaction(() => {
    // Seed vendors
    for (const v of demoVendors) {
      const norm = v.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      db.prepare(`
        INSERT OR IGNORE INTO vendors (id, name, normalized_name, default_category, tax_id, tags)
        VALUES (?, ?, ?, ?, ?, '["demo"]')
      `).run(crypto.randomUUID(), v.name, norm, v.category, v.taxId);
    }

    // Seed documents and expenses
    for (const inv of demoInvoices) {
      const docId = crypto.randomUUID();
      const filename = `${inv.vendor.replace(/[^a-zA-Z0-9]/g, '_')}_${inv.invoiceNum}.pdf`;

      // Create a dummy mock file in uploads for preview if needed
      const dummyPath = path.join(UPLOADS_DIR, `doc_${docId}.pdf`);
      if (!fs.existsSync(dummyPath)) {
        fs.writeFileSync(dummyPath, `%PDF-1.4\n1 0 obj << /Title (${inv.vendor}) >> endobj\ntrailer << /Root 1 0 R >> %%EOF`);
      }

      db.prepare(`
        INSERT INTO documents (
          id, filename, original_filename, mime_type, file_size, file_hash,
          storage_path, document_type, status, is_duplicate, extracted_text, ocr_confidence, created_at
        ) VALUES (?, ?, ?, 'application/pdf', 24500, ?, ?, ?, ?, 0, ?, 0.98, ?)
      `).run(
        docId,
        path.basename(dummyPath),
        filename,
        crypto.createHash('sha256').update(docId).digest('hex'),
        dummyPath,
        inv.docType,
        inv.status,
        `${inv.vendor}\nInvoice Number: ${inv.invoiceNum}\nDate: ${inv.date}\nTotal Amount: $${inv.amount}\nSubtotal: $${inv.subtotal}\nTax: $${inv.tax}\nDescription: ${inv.desc}`,
        `${inv.date}T10:00:00Z`
      );

      const extId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO extracted_data (
          id, document_id, document_type, vendor_name, invoice_number, invoice_date, due_date,
          payment_status, currency, subtotal, tax_amount, total_amount, category, description,
          tags, confidence_scores, validation_warnings, extraction_model, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, '["demo"]', '{"vendor_name":0.95,"total_amount":0.95,"invoice_date":0.92}', '[]', 'gemma3:4b', ?)
      `).run(
        extId,
        docId,
        inv.docType,
        inv.vendor,
        inv.invoiceNum,
        inv.date,
        inv.dueDate,
        inv.status === 'approved' ? 'paid' : 'pending',
        inv.subtotal,
        inv.tax,
        inv.amount,
        inv.category,
        inv.desc,
        `${inv.date}T10:00:00Z`
      );

      // Line items
      const insertLineItem = db.prepare(`
        INSERT INTO line_items (id, document_id, description, quantity, unit_price, total_price, item_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      inv.items.forEach((item, idx) => {
        insertLineItem.run(crypto.randomUUID(), docId, item.desc, item.qty, item.unit, item.total, idx);
      });

      // If approved, create expense
      if (inv.status === 'approved') {
        db.prepare(`
          INSERT INTO expenses (id, document_id, expense_date, vendor_name, description, category, amount, currency, status, tags, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 'approved', '["demo"]', ?)
        `).run(
          crypto.randomUUID(),
          docId,
          inv.date,
          inv.vendor,
          inv.desc,
          inv.category,
          inv.amount,
          `${inv.date}T10:00:00Z`
        );
      }
    }

    // Seed a couple default automation rules
    const rule1Id = crypto.randomUUID();
    db.prepare(`
      INSERT OR IGNORE INTO automation_rules (id, name, enabled, priority, conditions, condition_match_type, actions)
      VALUES (?, 'Auto-tag Cloud Providers', 1, 10, ?, 'OR', ?)
    `).run(
      rule1Id,
      JSON.stringify([
        { field: 'vendor_name', operator: 'contains', value: 'AWS' },
        { field: 'vendor_name', operator: 'contains', value: 'Cloudflare' },
        { field: 'vendor_name', operator: 'contains', value: 'Vercel' }
      ]),
      JSON.stringify([
        { type: 'set_category', value: 'Cloud Infrastructure' },
        { type: 'add_tag', value: 'cloud' }
      ])
    );

    const rule2Id = crypto.randomUUID();
    db.prepare(`
      INSERT OR IGNORE INTO automation_rules (id, name, enabled, priority, conditions, condition_match_type, actions)
      VALUES (?, 'Flag High Value Invoices (> $500)', 1, 5, ?, 'AND', ?)
    `).run(
      rule2Id,
      JSON.stringify([
        { field: 'total_amount', operator: 'greater_than', value: 500 }
      ]),
      JSON.stringify([
        { type: 'set_priority', value: 'high' },
        { type: 'flag_review', value: 'true' },
        { type: 'add_tag', value: 'high-value' }
      ])
    );
  });

  seedTx();
  res.json({ success: true, message: 'Seeded realistic demo records with transparent (Demo) badges.' });
});

export default router;
