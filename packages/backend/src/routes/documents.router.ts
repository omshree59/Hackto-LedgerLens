import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR, CONFIG } from '../config.js';
import { getDb } from '../db/index.js';
import { DuplicateService } from '../services/duplicate.service.js';
import { ProcessorService } from '../services/processor.service.js';
import { ExpenseService } from '../services/expense.service.js';

const router = Router();

// Configure multer storage with random safe file names
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `doc_${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 20
  },
  fileFilter: (req, file, cb) => {
    const allowedMime = CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype);
    const allowedExt = /\.(pdf|png|jpe?g|webp)$/i.test(path.extname(file.originalname));
    if (allowedMime || allowedExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype || file.originalname}. Only PDF and images (PNG, JPG, WEBP) are supported.`));
    }
  }
});

/**
 * Upload one or multiple documents
 */
router.post('/upload', upload.array('files', 20), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded' });
  }

  const db = getDb();
  const createdDocs = [];

  for (const file of files) {
    const docId = crypto.randomUUID();
    const fileHash = DuplicateService.computeFileHash(file.path);
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdf = ext === '.pdf' || file.mimetype === 'application/pdf';
    const docType = (req.body.document_type as string) || (file.originalname.toLowerCase().includes('receipt') ? 'receipt' : 'invoice');

    // Immediate exact hash check
    const dupCheck = DuplicateService.checkDuplicate(docId, fileHash, null);

    db.prepare(`
      INSERT INTO documents (
        id, filename, original_filename, mime_type, file_size, file_hash,
        storage_path, document_type, status, is_duplicate, duplicate_of_id, duplicate_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?)
    `).run(
      docId,
      path.basename(file.path),
      file.originalname,
      file.mimetype || (isPdf ? 'application/pdf' : 'image/jpeg'),
      file.size,
      fileHash,
      file.path,
      docType,
      dupCheck.isDuplicate ? 1 : 0,
      dupCheck.duplicateOfId,
      dupCheck.duplicateReason
    );

    createdDocs.push({
      id: docId,
      filename: file.originalname,
      isDuplicate: dupCheck.isDuplicate,
      status: 'uploaded'
    });

    // Start background processing without blocking the upload response
    ProcessorService.processDocument(docId).catch(err => {
      console.error(`Async background processor failed for ${docId}:`, err);
    });
  }

  res.status(201).json({
    message: `Successfully uploaded ${createdDocs.length} document(s)`,
    documents: createdDocs
  });
});

/**
 * List documents with rich search, filtering, and pagination
 */
router.get('/', (req, res) => {
  const db = getDb();
  const {
    search,
    type,
    status,
    vendor,
    category,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    page = '1',
    limit = '25',
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  let baseQuery = `
    FROM documents d
    LEFT JOIN extracted_data e ON d.id = e.document_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    baseQuery += ` AND (
      d.original_filename LIKE ? OR
      e.vendor_name LIKE ? OR
      e.invoice_number LIKE ? OR
      e.description LIKE ?
    )`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (type) {
    baseQuery += ` AND d.document_type = ?`;
    params.push(type);
  }

  if (status) {
    baseQuery += ` AND d.status = ?`;
    params.push(status);
  }

  if (vendor) {
    baseQuery += ` AND LOWER(e.vendor_name) = LOWER(?)`;
    params.push(vendor);
  }

  if (category) {
    baseQuery += ` AND e.category = ?`;
    params.push(category);
  }

  if (startDate) {
    baseQuery += ` AND (e.invoice_date >= ? OR d.created_at >= ?)`;
    params.push(startDate, startDate);
  }

  if (endDate) {
    baseQuery += ` AND (e.invoice_date <= ? OR d.created_at <= ?)`;
    params.push(endDate, endDate);
  }

  if (minAmount) {
    baseQuery += ` AND e.total_amount >= ?`;
    params.push(parseFloat(minAmount as string));
  }

  if (maxAmount) {
    baseQuery += ` AND e.total_amount <= ?`;
    params.push(parseFloat(maxAmount as string));
  }

  // Count total records
  const countRow = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params) as { total: number };
  const total = countRow.total;

  // Sorting
  const allowedSortCols: Record<string, string> = {
    created_at: 'd.created_at',
    date: 'COALESCE(e.invoice_date, d.created_at)',
    amount: 'COALESCE(e.total_amount, 0)',
    vendor: 'e.vendor_name',
    filename: 'd.original_filename',
    status: 'd.status'
  };
  const sortCol = allowedSortCols[sortBy as string] || 'd.created_at';
  const order = (sortOrder as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
  const offset = (pageNum - 1) * pageSize;

  const selectQuery = `
    SELECT
      d.id,
      d.filename,
      d.original_filename,
      d.mime_type,
      d.file_size,
      d.document_type,
      d.status,
      d.is_duplicate,
      d.duplicate_of_id,
      d.duplicate_reason,
      d.ocr_confidence,
      d.created_at,
      d.updated_at,
      e.vendor_name,
      e.invoice_number,
      e.invoice_date,
      e.due_date,
      e.payment_status,
      e.currency,
      e.subtotal,
      e.tax_amount,
      e.total_amount,
      e.category,
      e.tags,
      e.validation_warnings
    ${baseQuery}
    ORDER BY ${sortCol} ${order}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(selectQuery).all(...params, pageSize, offset) as any[];

  const items = rows.map(r => ({
    ...r,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : (r.tags || []),
    validation_warnings: typeof r.validation_warnings === 'string' ? JSON.parse(r.validation_warnings || '[]') : (r.validation_warnings || [])
  }));

  res.json({
    items,
    total,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  });
});

/**
 * Get full document details by ID (including line items and extracted metadata)
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const extracted = db.prepare('SELECT * FROM extracted_data WHERE document_id = ?').get(id) as any;
  const lineItems = db.prepare('SELECT * FROM line_items WHERE document_id = ? ORDER BY item_order ASC').all(id) as any[];
  const jobs = db.prepare('SELECT * FROM processing_jobs WHERE document_id = ? ORDER BY created_at DESC LIMIT 5').all(id) as any[];

  // If duplicate, get matching document summary
  let duplicateOfDoc = null;
  if (doc.duplicate_of_id) {
    duplicateOfDoc = db.prepare(`
      SELECT d.id, d.original_filename, d.status, e.vendor_name, e.invoice_number, e.invoice_date, e.total_amount
      FROM documents d
      LEFT JOIN extracted_data e ON d.id = e.document_id
      WHERE d.id = ?
    `).get(doc.duplicate_of_id);
  }

  res.json({
    document: doc,
    extractedData: extracted ? {
      ...extracted,
      tags: JSON.parse(extracted.tags || '[]'),
      confidence_scores: JSON.parse(extracted.confidence_scores || '{}'),
      validation_warnings: JSON.parse(extracted.validation_warnings || '[]')
    } : null,
    lineItems,
    jobs,
    duplicateOfDoc
  });
});

/**
 * Update extracted document fields
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const {
    document_type,
    vendor_name,
    vendor_address,
    vendor_tax_id,
    customer_name,
    invoice_number,
    po_number,
    invoice_date,
    due_date,
    payment_status,
    currency,
    subtotal,
    discount,
    shipping,
    tax_amount,
    tax_rate,
    total_amount,
    amount_paid,
    outstanding_balance,
    category,
    description,
    notes,
    tags,
    line_items
  } = req.body;

  const updateTx = db.transaction(() => {
    if (document_type) {
      db.prepare('UPDATE documents SET document_type = ?, updated_at = strftime("%Y-%m-%dT%H:%M:%SZ", "now") WHERE id = ?').run(document_type, id);
    }

    // Check if extracted_data row exists
    const existingExtracted = db.prepare('SELECT id FROM extracted_data WHERE document_id = ?').get(id) as any;

    if (existingExtracted) {
      db.prepare(`
        UPDATE extracted_data SET
          document_type = COALESCE(?, document_type),
          vendor_name = ?,
          vendor_address = ?,
          vendor_tax_id = ?,
          customer_name = ?,
          invoice_number = ?,
          po_number = ?,
          invoice_date = ?,
          due_date = ?,
          payment_status = ?,
          currency = COALESCE(?, 'USD'),
          subtotal = ?,
          discount = ?,
          shipping = ?,
          tax_amount = ?,
          tax_rate = ?,
          total_amount = ?,
          amount_paid = ?,
          outstanding_balance = ?,
          category = ?,
          description = ?,
          notes = ?,
          tags = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE document_id = ?
      `).run(
        document_type || null,
        vendor_name || null,
        vendor_address || null,
        vendor_tax_id || null,
        customer_name || null,
        invoice_number || null,
        po_number || null,
        invoice_date || null,
        due_date || null,
        payment_status || null,
        currency || 'USD',
        subtotal ?? null,
        discount ?? null,
        shipping ?? null,
        tax_amount ?? null,
        tax_rate ?? null,
        total_amount ?? null,
        amount_paid ?? null,
        outstanding_balance ?? null,
        category || null,
        description || null,
        notes || null,
        JSON.stringify(tags || []),
        id
      );
    } else {
      db.prepare(`
        INSERT INTO extracted_data (
          id, document_id, document_type, vendor_name, vendor_address, vendor_tax_id,
          customer_name, invoice_number, po_number, invoice_date, due_date,
          payment_status, currency, subtotal, discount, shipping, tax_amount,
          tax_rate, total_amount, amount_paid, outstanding_balance, category,
          description, notes, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        id,
        document_type || 'invoice',
        vendor_name || null,
        vendor_address || null,
        vendor_tax_id || null,
        customer_name || null,
        invoice_number || null,
        po_number || null,
        invoice_date || null,
        due_date || null,
        payment_status || null,
        currency || 'USD',
        subtotal ?? null,
        discount ?? null,
        shipping ?? null,
        tax_amount ?? null,
        tax_rate ?? null,
        total_amount ?? null,
        amount_paid ?? null,
        outstanding_balance ?? null,
        category || null,
        description || null,
        notes || null,
        JSON.stringify(tags || [])
      );
    }

    // Line items replacement if provided
    if (Array.isArray(line_items)) {
      db.prepare('DELETE FROM line_items WHERE document_id = ?').run(id);
      const insertItem = db.prepare(`
        INSERT INTO line_items (id, document_id, description, quantity, unit_price, tax_amount, total_price, item_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      line_items.forEach((item: any, idx: number) => {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description || `Item #${idx + 1}`,
          item.quantity ?? null,
          item.unit_price ?? null,
          item.tax_amount ?? null,
          item.total_price ?? null,
          idx
        );
      });
    }

    if (vendor_name) {
      ExpenseService.upsertVendor(vendor_name, category || undefined);
    }
  });

  updateTx();
  res.json({ success: true, message: 'Document updated successfully' });
});

/**
 * Approve document and sync to expenses
 */
router.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const extracted = db.prepare('SELECT * FROM extracted_data WHERE document_id = ?').get(id) as any;
  if (!extracted) {
    return res.status(400).json({ error: 'Document has no extracted data to approve' });
  }

  const approveTx = db.transaction(() => {
    db.prepare(`
      UPDATE documents
      SET status = 'approved',
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(id);

    // Sync to expenses table
    const vendorName = extracted.vendor_name || 'Unknown Vendor';
    const expenseDate = extracted.invoice_date || doc.created_at.slice(0, 10);
    const amount = extracted.total_amount || 0;
    const currency = extracted.currency || 'USD';
    const category = extracted.category || 'Other';
    const tags = JSON.parse(extracted.tags || '[]');

    ExpenseService.syncDocumentToExpense(
      id,
      vendorName,
      expenseDate,
      amount,
      currency,
      category,
      extracted.description || `${doc.document_type === 'receipt' ? 'Receipt' : 'Invoice'} from ${vendorName}`,
      tags
    );
  });

  approveTx();
  res.json({ success: true, message: 'Document approved and recorded in expenses' });
});

/**
 * Reprocess document through AI extraction pipeline
 */
router.post('/:id/reprocess', async (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Trigger processor
  ProcessorService.processDocument(id).catch(err => {
    console.error(`Reprocessing failed for ${id}:`, err);
  });

  res.json({ success: true, message: 'Document reprocessing initiated' });
});

/**
 * Duplicate actions: confirm or clear duplicate flag
 */
router.post('/:id/duplicate-action', (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'clear' | 'confirm'
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (action === 'clear') {
    db.prepare(`
      UPDATE documents
      SET is_duplicate = 0,
          duplicate_of_id = NULL,
          duplicate_reason = NULL,
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(id);
    return res.json({ success: true, message: 'Marked as legitimate separate document' });
  } else if (action === 'confirm') {
    db.prepare(`
      UPDATE documents
      SET is_duplicate = 1,
          status = 'archived',
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(id);
    return res.json({ success: true, message: 'Confirmed as duplicate and archived' });
  } else {
    return res.status(400).json({ error: 'Invalid action. Must be "clear" or "confirm"' });
  }
});

/**
 * Delete a document and its linked files
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const deleteTx = db.transaction(() => {
    // Delete expense linked to this document
    db.prepare('DELETE FROM expenses WHERE document_id = ?').run(id);
    // Delete line items
    db.prepare('DELETE FROM line_items WHERE document_id = ?').run(id);
    // Delete extracted data
    db.prepare('DELETE FROM extracted_data WHERE document_id = ?').run(id);
    // Delete processing jobs
    db.prepare('DELETE FROM processing_jobs WHERE document_id = ?').run(id);
    // Delete rule history
    db.prepare('DELETE FROM rule_history WHERE document_id = ?').run(id);
    // Delete document row
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  });

  deleteTx();

  // Remove file from disk
  if (doc.storage_path && fs.existsSync(doc.storage_path)) {
    try {
      fs.unlinkSync(doc.storage_path);
    } catch (err) {
      console.error(`Failed to delete file on disk ${doc.storage_path}:`, err);
    }
  }

  res.json({ success: true, message: 'Document deleted successfully' });
});

/**
 * Bulk action on multiple documents
 */
router.post('/bulk', (req, res) => {
  const { ids, action, value } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of document IDs is required' });
  }

  const db = getDb();

  if (action === 'approve') {
    const approveStmt = db.prepare(`
      UPDATE documents SET status = 'approved', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?
    `);
    const selectExtracted = db.prepare('SELECT * FROM extracted_data WHERE document_id = ?');

    const bulkTx = db.transaction(() => {
      for (const id of ids) {
        approveStmt.run(id);
        const extracted = selectExtracted.get(id) as any;
        if (extracted) {
          ExpenseService.syncDocumentToExpense(
            id,
            extracted.vendor_name || 'Unknown Vendor',
            extracted.invoice_date || new Date().toISOString().slice(0, 10),
            extracted.total_amount || 0,
            extracted.currency || 'USD',
            extracted.category || 'Other',
            extracted.description,
            JSON.parse(extracted.tags || '[]')
          );
        }
      }
    });
    bulkTx();
    return res.json({ success: true, message: `Approved ${ids.length} documents` });
  }

  if (action === 'delete') {
    const deleteTx = db.transaction(() => {
      for (const id of ids) {
        const doc = db.prepare('SELECT storage_path FROM documents WHERE id = ?').get(id) as any;
        db.prepare('DELETE FROM expenses WHERE document_id = ?').run(id);
        db.prepare('DELETE FROM line_items WHERE document_id = ?').run(id);
        db.prepare('DELETE FROM extracted_data WHERE document_id = ?').run(id);
        db.prepare('DELETE FROM processing_jobs WHERE document_id = ?').run(id);
        db.prepare('DELETE FROM documents WHERE id = ?').run(id);

        if (doc && doc.storage_path && fs.existsSync(doc.storage_path)) {
          try { fs.unlinkSync(doc.storage_path); } catch {}
        }
      }
    });
    deleteTx();
    return res.json({ success: true, message: `Deleted ${ids.length} documents` });
  }

  if (action === 'categorize') {
    if (!value) return res.status(400).json({ error: 'Category value is required' });
    const updateCategory = db.prepare('UPDATE extracted_data SET category = ? WHERE document_id = ?');
    const updateExpense = db.prepare('UPDATE expenses SET category = ? WHERE document_id = ?');

    const catTx = db.transaction(() => {
      for (const id of ids) {
        updateCategory.run(value, id);
        updateExpense.run(value, id);
      }
    });
    catTx();
    return res.json({ success: true, message: `Updated category for ${ids.length} documents` });
  }

  res.status(400).json({ error: 'Unknown bulk action' });
});

export default router;
