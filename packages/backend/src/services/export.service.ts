import fs from 'fs';
import path from 'path';
import { getDb } from '../db/index.js';
import { EXPORTS_DIR } from '../config.js';

export class ExportService {
  /**
   * Escape CSV field safely to defend against formula injection and delimiters
   */
  public static sanitizeCsvValue(val: any): string {
    if (val === null || val === undefined) {
      return '';
    }

    let str = String(val);

    // Defend against CSV injection (formula execution in Excel/Sheets)
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
    if (dangerousPrefixes.some(prefix => str.startsWith(prefix))) {
      str = "'" + str;
    }

    // Escape double quotes
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Convert array of rows and headers into RFC 4180 CSV string
   */
  public static buildCsv(headers: string[], rows: any[][]): string {
    const headerLine = headers.map(h => this.sanitizeCsvValue(h)).join(',');
    const dataLines = rows.map(row =>
      row.map(val => this.sanitizeCsvValue(val)).join(',')
    );
    return [headerLine, ...dataLines].join('\r\n');
  }

  /**
   * Export Invoices or Receipts CSV
   */
  public static exportDocumentsCsv(type?: 'invoice' | 'receipt', status?: string): string {
    const db = getDb();
    let query = `
      SELECT
        d.id,
        d.original_filename,
        d.document_type,
        d.status,
        e.vendor_name,
        e.invoice_number,
        e.invoice_date,
        e.due_date,
        e.payment_status,
        e.subtotal,
        e.tax_amount,
        e.total_amount,
        e.currency,
        e.category,
        e.tags,
        d.created_at
      FROM documents d
      LEFT JOIN extracted_data e ON d.id = e.document_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      query += ` AND d.document_type = ?`;
      params.push(type);
    }
    if (status) {
      query += ` AND d.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY e.invoice_date DESC, d.created_at DESC`;

    const records = db.prepare(query).all(...params) as any[];

    const headers = [
      'Document ID',
      'Filename',
      'Type',
      'Status',
      'Vendor',
      'Invoice #',
      'Invoice Date',
      'Due Date',
      'Payment Status',
      'Subtotal',
      'Tax Amount',
      'Total Amount',
      'Currency',
      'Category',
      'Tags',
      'Uploaded At'
    ];

    const rows = records.map(r => [
      r.id,
      r.original_filename,
      r.document_type,
      r.status,
      r.vendor_name || '',
      r.invoice_number || '',
      r.invoice_date || '',
      r.due_date || '',
      r.payment_status || '',
      r.subtotal ?? '',
      r.tax_amount ?? '',
      r.total_amount ?? '',
      r.currency || 'USD',
      r.category || '',
      Array.isArray(r.tags) ? r.tags.join('; ') : (typeof r.tags === 'string' ? JSON.parse(r.tags || '[]').join('; ') : ''),
      r.created_at
    ]);

    return this.buildCsv(headers, rows);
  }

  /**
   * Export Expenses CSV
   */
  public static exportExpensesCsv(category?: string, startDate?: string, endDate?: string): string {
    const db = getDb();
    let query = `
      SELECT
        id,
        expense_date,
        vendor_name,
        description,
        category,
        amount,
        currency,
        status,
        tags,
        document_id,
        created_at
      FROM expenses
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    if (startDate) {
      query += ` AND expense_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND expense_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY expense_date DESC`;

    const records = db.prepare(query).all(...params) as any[];

    const headers = [
      'Expense ID',
      'Date',
      'Vendor',
      'Description',
      'Category',
      'Amount',
      'Currency',
      'Status',
      'Tags',
      'Source Document ID',
      'Recorded At'
    ];

    const rows = records.map(r => [
      r.id,
      r.expense_date,
      r.vendor_name,
      r.description || '',
      r.category,
      r.amount,
      r.currency,
      r.status,
      typeof r.tags === 'string' ? JSON.parse(r.tags || '[]').join('; ') : '',
      r.document_id || '',
      r.created_at
    ]);

    return this.buildCsv(headers, rows);
  }

  /**
   * Export Vendor Summaries CSV
   */
  public static exportVendorsCsv(): string {
    const db = getDb();
    const records = db.prepare(`
      SELECT
        v.id,
        v.name,
        v.default_category,
        v.tax_id,
        COUNT(DISTINCT d.id) as document_count,
        COALESCE(SUM(e.total_amount), 0) as total_spent,
        MAX(e.invoice_date) as last_invoice_date
      FROM vendors v
      LEFT JOIN extracted_data e ON LOWER(e.vendor_name) = LOWER(v.name)
      LEFT JOIN documents d ON d.id = e.document_id AND d.status != 'archived'
      GROUP BY v.id
      ORDER BY total_spent DESC
    `).all() as any[];

    const headers = [
      'Vendor ID',
      'Vendor Name',
      'Default Category',
      'Tax ID',
      'Total Documents',
      'Total Spent ($)',
      'Last Invoice Date'
    ];

    const rows = records.map(r => [
      r.id,
      r.name,
      r.default_category || '',
      r.tax_id || '',
      r.document_count,
      r.total_spent.toFixed(2),
      r.last_invoice_date || ''
    ]);

    return this.buildCsv(headers, rows);
  }

  /**
   * Organize local files onto disk according to configurable pattern
   */
  public static organizeLocalFiles(): { organizedCount: number; destinationDir: string } {
    const db = getDb();
    const docs = db.prepare(`
      SELECT d.id, d.storage_path, d.original_filename, d.document_type,
             e.vendor_name, e.invoice_number, e.invoice_date
      FROM documents d
      LEFT JOIN extracted_data e ON d.id = e.document_id
      WHERE d.status IN ('approved', 'needs_review')
    `).all() as any[];

    const organizedBase = path.join(EXPORTS_DIR, 'organized');
    if (!fs.existsSync(organizedBase)) {
      fs.mkdirSync(organizedBase, { recursive: true });
    }

    let count = 0;

    for (const doc of docs) {
      if (!fs.existsSync(doc.storage_path)) continue;

      const dateStr = doc.invoice_date || new Date().toISOString().slice(0, 10);
      const [year, month] = dateStr.split('-');
      const typeFolder = doc.document_type === 'receipt' ? 'Receipts' : 'Invoices';
      const safeVendor = (doc.vendor_name || 'UnknownVendor').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeNumber = (doc.invoice_number || doc.id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const ext = path.extname(doc.original_filename) || '.pdf';

      const folderPath = path.join(organizedBase, typeFolder, year || '2026', month || '01');
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const safeFilename = `${safeVendor}_${safeNumber}${ext}`;
      const destPath = path.join(folderPath, safeFilename);

      // Copy file safely
      try {
        fs.copyFileSync(doc.storage_path, destPath);
        count++;
      } catch (err) {
        console.error(`Failed to organize file ${doc.id}:`, err);
      }
    }

    return {
      organizedCount: count,
      destinationDir: organizedBase
    };
  }
}
