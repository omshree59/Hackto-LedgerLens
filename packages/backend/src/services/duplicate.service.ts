import crypto from 'crypto';
import fs from 'fs';
import { getDb } from '../db/index.js';
import type { ExtractedInvoiceData } from './validation.schemas.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  duplicateReason: string | null;
  matchType: 'exact_hash' | 'metadata_match' | null;
  matchingFields: string[];
}

export class DuplicateService {
  /**
   * Compute SHA-256 hash of a file
   */
  public static computeFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Normalize vendor name for robust matching (e.g., "Google LLC" -> "google", "Acme Inc." -> "acme")
   */
  public static normalizeVendorName(name: string | null | undefined): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b(inc|llc|corp|ltd|gmbh|co|corporation|incorporated|company|s\.a\.|s\.l\.)\b/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  }

  /**
   * Check if a document is an exact or probable duplicate
   */
  public static checkDuplicate(
    currentDocId: string,
    fileHash: string,
    data?: ExtractedInvoiceData | null
  ): DuplicateCheckResult {
    const db = getDb();

    // 1. Exact SHA-256 Hash check
    const exactMatch = db.prepare(`
      SELECT id, original_filename, created_at
      FROM documents
      WHERE file_hash = ? AND id != ?
      LIMIT 1
    `).get(fileHash, currentDocId) as { id: string; original_filename: string; created_at: string } | undefined;

    if (exactMatch) {
      return {
        isDuplicate: true,
        duplicateOfId: exactMatch.id,
        duplicateReason: `Identical file content (SHA-256 matches existing document "${exactMatch.original_filename}")`,
        matchType: 'exact_hash',
        matchingFields: ['file_hash', 'content']
      };
    }

    // 2. Probable invoice duplicate check if metadata is available
    if (data && data.vendor_name && (data.invoice_number || (data.total_amount && data.invoice_date))) {
      const normVendor = this.normalizeVendorName(data.vendor_name);

      // Search existing approved or under-review documents with matching details
      const candidates = db.prepare(`
        SELECT d.id, d.original_filename, e.vendor_name, e.invoice_number, e.invoice_date, e.total_amount, e.currency
        FROM documents d
        JOIN extracted_data e ON d.id = e.document_id
        WHERE d.id != ? AND d.status != 'archived'
      `).all(currentDocId) as Array<{
        id: string;
        original_filename: string;
        vendor_name: string | null;
        invoice_number: string | null;
        invoice_date: string | null;
        total_amount: number | null;
        currency: string | null;
      }>;

      for (const cand of candidates) {
        const candNormVendor = this.normalizeVendorName(cand.vendor_name);
        const matchingFields: string[] = [];

        // Check invoice number match from same vendor
        if (
          normVendor &&
          candNormVendor === normVendor &&
          data.invoice_number &&
          cand.invoice_number &&
          data.invoice_number.trim().toLowerCase() === cand.invoice_number.trim().toLowerCase()
        ) {
          matchingFields.push('vendor_name', 'invoice_number');
          if (data.total_amount && cand.total_amount && Math.abs(data.total_amount - cand.total_amount) < 0.01) {
            matchingFields.push('total_amount');
          }
          return {
            isDuplicate: true,
            duplicateOfId: cand.id,
            duplicateReason: `Same vendor ("${cand.vendor_name}") and invoice number ("${cand.invoice_number}") as document "${cand.original_filename}"`,
            matchType: 'metadata_match',
            matchingFields
          };
        }

        // Check same vendor + same date + same total
        if (
          normVendor &&
          candNormVendor === normVendor &&
          data.invoice_date &&
          cand.invoice_date &&
          data.invoice_date === cand.invoice_date &&
          data.total_amount &&
          cand.total_amount &&
          Math.abs(data.total_amount - cand.total_amount) < 0.01
        ) {
          matchingFields.push('vendor_name', 'invoice_date', 'total_amount');
          return {
            isDuplicate: true,
            duplicateOfId: cand.id,
            duplicateReason: `Same vendor ("${cand.vendor_name}"), date (${cand.invoice_date}), and total amount ($${cand.total_amount}) as document "${cand.original_filename}"`,
            matchType: 'metadata_match',
            matchingFields
          };
        }
      }
    }

    return {
      isDuplicate: false,
      duplicateOfId: null,
      duplicateReason: null,
      matchType: null,
      matchingFields: []
    };
  }
}
