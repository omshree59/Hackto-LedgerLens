import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { DuplicateService } from './duplicate.service.js';
import type { ExpenseRecord, VendorRecord } from '../types/index.js';

export class ExpenseService {
  /**
   * Sync an invoice/receipt record to the expenses table safely without creating duplicates
   */
  public static syncDocumentToExpense(
    docId: string,
    vendorName: string,
    expenseDate: string,
    amount: number,
    currency: string,
    category: string,
    description: string | null,
    tags: string[] = []
  ): ExpenseRecord {
    const db = getDb();

    // Check if an expense already exists for this document
    const existing = db.prepare(`
      SELECT * FROM expenses WHERE document_id = ?
    `).get(docId) as any;

    if (existing) {
      db.prepare(`
        UPDATE expenses
        SET vendor_name = ?,
            expense_date = ?,
            amount = ?,
            currency = ?,
            category = ?,
            description = ?,
            tags = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `).run(
        vendorName,
        expenseDate,
        amount,
        currency,
        category || 'Other',
        description || null,
        JSON.stringify(tags),
        existing.id
      );

      this.upsertVendor(vendorName, category);

      return {
        ...existing,
        vendor_name: vendorName,
        expense_date: expenseDate,
        amount,
        currency,
        category: category || 'Other',
        description,
        tags
      };
    }

    // Insert new expense
    const expenseId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO expenses (
        id, document_id, expense_date, vendor_name, description, category, amount, currency, status, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `).run(
      expenseId,
      docId,
      expenseDate,
      vendorName,
      description || null,
      category || 'Other',
      amount,
      currency,
      JSON.stringify(tags)
    );

    this.upsertVendor(vendorName, category);

    return {
      id: expenseId,
      document_id: docId,
      expense_date: expenseDate,
      vendor_name: vendorName,
      description,
      category: category || 'Other',
      amount,
      currency,
      status: 'approved',
      tags,
      is_duplicate: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Upsert vendor profile automatically with normalized name
   */
  public static upsertVendor(name: string, defaultCategory?: string): void {
    if (!name || name.trim() === '') return;
    const db = getDb();
    const cleanName = name.trim();
    const normalized = DuplicateService.normalizeVendorName(cleanName);
    if (!normalized) return;

    const existing = db.prepare(`
      SELECT id, default_category FROM vendors WHERE normalized_name = ?
    `).get(normalized) as { id: string; default_category: string | null } | undefined;

    if (existing) {
      if (!existing.default_category && defaultCategory) {
        db.prepare('UPDATE vendors SET default_category = ? WHERE id = ?').run(defaultCategory, existing.id);
      }
    } else {
      db.prepare(`
        INSERT INTO vendors (id, name, normalized_name, default_category, tags)
        VALUES (?, ?, ?, ?, '[]')
      `).run(crypto.randomUUID(), cleanName, normalized, defaultCategory || null);
    }
  }

  /**
   * Merge one vendor into another, updating documents and expenses
   */
  public static mergeVendors(sourceVendorId: string, targetVendorId: string): void {
    const db = getDb();
    const source = db.prepare('SELECT * FROM vendors WHERE id = ?').get(sourceVendorId) as any;
    const target = db.prepare('SELECT * FROM vendors WHERE id = ?').get(targetVendorId) as any;

    if (!source || !target) {
      throw new Error('Vendor not found for merging');
    }

    const mergeTx = db.transaction(() => {
      // Update expenses
      db.prepare('UPDATE expenses SET vendor_name = ? WHERE vendor_name = ?').run(target.name, source.name);
      // Update extracted_data
      db.prepare('UPDATE extracted_data SET vendor_name = ? WHERE vendor_name = ?').run(target.name, source.name);
      // Delete source vendor
      db.prepare('DELETE FROM vendors WHERE id = ?').run(sourceVendorId);
    });

    mergeTx();
  }
}
