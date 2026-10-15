import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { ExpenseService } from '../services/expense.service.js';

const router = Router();

/**
 * List expenses with search, category filtering, date range, pagination
 */
router.get('/', (req, res) => {
  const db = getDb();
  const {
    search,
    category,
    vendor,
    startDate,
    endDate,
    status,
    page = '1',
    limit = '25'
  } = req.query;

  let baseQuery = `FROM expenses WHERE 1=1`;
  const params: any[] = [];

  if (search) {
    baseQuery += ` AND (vendor_name LIKE ? OR description LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s);
  }

  if (category) {
    baseQuery += ` AND category = ?`;
    params.push(category);
  }

  if (vendor) {
    baseQuery += ` AND LOWER(vendor_name) = LOWER(?)`;
    params.push(vendor);
  }

  if (startDate) {
    baseQuery += ` AND expense_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    baseQuery += ` AND expense_date <= ?`;
    params.push(endDate);
  }

  if (status) {
    baseQuery += ` AND status = ?`;
    params.push(status);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params) as { total: number };
  const total = countRow.total;

  const totalAmountRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as totalSum ${baseQuery}`).get(...params) as { totalSum: number };

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
  const offset = (pageNum - 1) * pageSize;

  const rows = db.prepare(`
    SELECT * ${baseQuery}
    ORDER BY expense_date DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as any[];

  // Also get category breakdown for filtered set
  const categorySummary = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total
    ${baseQuery}
    GROUP BY category
    ORDER BY total DESC
  `).all(...params);

  res.json({
    items: rows.map(r => ({
      ...r,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : (r.tags || [])
    })),
    total,
    totalSum: totalAmountRow.totalSum,
    categorySummary,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});

/**
 * Create manual expense
 */
router.post('/', (req, res) => {
  const db = getDb();
  const {
    expense_date,
    vendor_name,
    description,
    category = 'Other',
    amount,
    currency = 'USD',
    tags = []
  } = req.body;

  if (!expense_date || !vendor_name || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'expense_date, vendor_name, and amount are required' });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO expenses (id, expense_date, vendor_name, description, category, amount, currency, status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)
  `).run(
    id,
    expense_date,
    vendor_name.trim(),
    description || null,
    category,
    parseFloat(amount),
    currency,
    JSON.stringify(tags)
  );

  ExpenseService.upsertVendor(vendor_name.trim(), category);

  res.status(201).json({ success: true, id, message: 'Expense created successfully' });
});

/**
 * Update expense
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const { expense_date, vendor_name, description, category, amount, currency, tags, status } = req.body;

  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  db.prepare(`
    UPDATE expenses
    SET expense_date = COALESCE(?, expense_date),
        vendor_name = COALESCE(?, vendor_name),
        description = ?,
        category = COALESCE(?, category),
        amount = COALESCE(?, amount),
        currency = COALESCE(?, currency),
        tags = COALESCE(?, tags),
        status = COALESCE(?, status),
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(
    expense_date || null,
    vendor_name ? vendor_name.trim() : null,
    description !== undefined ? description : null,
    category || null,
    amount !== undefined ? parseFloat(amount) : null,
    currency || null,
    tags ? JSON.stringify(tags) : null,
    status || null,
    id
  );

  if (vendor_name) {
    ExpenseService.upsertVendor(vendor_name.trim(), category);
  }

  res.json({ success: true, message: 'Expense updated successfully' });
});

/**
 * Delete expense
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ success: true, message: 'Expense deleted successfully' });
});

export default router;
