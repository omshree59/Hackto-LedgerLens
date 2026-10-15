import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ExpenseService } from '../services/expense.service.js';

const router = Router();

/**
 * List all vendors with calculated spending and invoice statistics
 */
router.get('/', (req, res) => {
  const db = getDb();
  const { search } = req.query;

  let query = `
    SELECT
      v.id,
      v.name,
      v.normalized_name,
      v.default_category,
      v.tax_id,
      v.address,
      v.tags,
      v.notes,
      v.created_at,
      COUNT(DISTINCT d.id) as document_count,
      COALESCE(SUM(e.total_amount), 0) as total_spent,
      MAX(e.invoice_date) as last_invoice_date
    FROM vendors v
    LEFT JOIN extracted_data e ON LOWER(e.vendor_name) = LOWER(v.name)
    LEFT JOIN documents d ON d.id = e.document_id AND d.status != 'archived'
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (v.name LIKE ? OR v.default_category LIKE ? OR v.notes LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` GROUP BY v.id ORDER BY total_spent DESC, v.name ASC`;

  const rows = db.prepare(query).all(...params) as any[];

  res.json(rows.map(r => ({
    ...r,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : (r.tags || [])
  })));
});

/**
 * Create vendor manually
 */
router.post('/', (req, res) => {
  const { name, default_category, tax_id, address, notes, tags } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Vendor name is required' });
  }

  const id = ExpenseService.upsertVendor(name.trim(), default_category);
  const db = getDb();

  if (tax_id || address || notes || tags) {
    db.prepare(`
      UPDATE vendors
      SET tax_id = COALESCE(?, tax_id),
          address = COALESCE(?, address),
          notes = COALESCE(?, notes),
          tags = COALESCE(?, tags),
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(
      tax_id || null,
      address || null,
      notes || null,
      tags ? JSON.stringify(tags) : null,
      id
    );
  }

  res.status(201).json({ success: true, id, message: 'Vendor registered successfully' });
});

/**
 * Get vendor details by ID including related documents and expenses
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as any;
  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }

  const documents = db.prepare(`
    SELECT d.id, d.original_filename, d.document_type, d.status, d.created_at,
           e.invoice_number, e.invoice_date, e.total_amount, e.currency, e.category
    FROM documents d
    JOIN extracted_data e ON d.id = e.document_id
    WHERE LOWER(e.vendor_name) = LOWER(?)
    ORDER BY e.invoice_date DESC
  `).all(vendor.name);

  const expenses = db.prepare(`
    SELECT * FROM expenses
    WHERE LOWER(vendor_name) = LOWER(?)
    ORDER BY expense_date DESC
  `).all(vendor.name);

  const stats = db.prepare(`
    SELECT
      COUNT(id) as expense_count,
      COALESCE(SUM(amount), 0) as total_expenses,
      COALESCE(AVG(amount), 0) as avg_expense
    FROM expenses
    WHERE LOWER(vendor_name) = LOWER(?)
  `).get(vendor.name);

  res.json({
    vendor: {
      ...vendor,
      tags: typeof vendor.tags === 'string' ? JSON.parse(vendor.tags || '[]') : (vendor.tags || [])
    },
    stats,
    documents,
    expenses
  });
});

/**
 * Update vendor info
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const { name, default_category, tax_id, address, notes, tags } = req.body;

  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as any;
  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }

  db.prepare(`
    UPDATE vendors
    SET name = COALESCE(?, name),
        default_category = COALESCE(?, default_category),
        tax_id = COALESCE(?, tax_id),
        address = COALESCE(?, address),
        notes = COALESCE(?, notes),
        tags = COALESCE(?, tags),
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    default_category || null,
    tax_id || null,
    address || null,
    notes || null,
    tags ? JSON.stringify(tags) : null,
    id
  );

  res.json({ success: true, message: 'Vendor updated successfully' });
});

/**
 * Merge source vendor into target vendor
 */
router.post('/merge', (req, res) => {
  const { sourceVendorId, targetVendorId } = req.body;
  if (!sourceVendorId || !targetVendorId) {
    return res.status(400).json({ error: 'sourceVendorId and targetVendorId are required' });
  }
  if (sourceVendorId === targetVendorId) {
    return res.status(400).json({ error: 'Cannot merge vendor into itself' });
  }

  try {
    ExpenseService.mergeVendors(sourceVendorId, targetVendorId);
    res.json({ success: true, message: 'Vendors merged successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to merge vendors' });
  }
});

/**
 * Delete vendor
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
  if (!vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }

  db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
  res.json({ success: true, message: 'Vendor removed successfully' });
});

export default router;
