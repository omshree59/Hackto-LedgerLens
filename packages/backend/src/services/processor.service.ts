import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { OcrService } from './ocr.service.js';
import { OllamaService } from './ollama.service.js';
import { DuplicateService } from './duplicate.service.js';
import { RulesService } from './rules.service.js';
import { ExpenseService } from './expense.service.js';
import type { ExtractedInvoiceData } from './validation.schemas.js';

export class ProcessorService {
  /**
   * Run the full end-to-end extraction and processing pipeline on a document
   */
  public static async processDocument(docId: string): Promise<void> {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId) as any;

    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    // Create or update processing job
    const jobId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO processing_jobs (id, document_id, job_type, status, progress, started_at)
      VALUES (?, ?, 'extraction', 'processing', 10, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    `).run(jobId, docId);

    // Update document status
    db.prepare(`
      UPDATE documents
      SET status = 'processing',
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?
    `).run(docId);

    try {
      // 1. Text extraction / OCR
      const ocrResult = await OcrService.extractText(doc.storage_path, doc.mime_type);

      db.prepare(`
        UPDATE processing_jobs SET progress = 40 WHERE id = ?
      `).run(jobId);

      db.prepare(`
        UPDATE documents
        SET extracted_text = ?,
            ocr_confidence = ?
        WHERE id = ?
      `).run(ocrResult.text, ocrResult.confidence, docId);

      // Check if scanned PDF with minimal text
      if (ocrResult.isScannedPdf && ocrResult.text.length < 30) {
        // Scanned PDF fallback warning
        db.prepare(`
          UPDATE documents
          SET status = 'needs_review',
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ?
        `).run(docId);

        // Save empty extraction record with scanned PDF warning
        const emptyDataId = crypto.randomUUID();
        db.prepare(`
          INSERT OR REPLACE INTO extracted_data (
            id, document_id, document_type, currency, validation_warnings
          ) VALUES (?, ?, ?, 'USD', ?)
        `).run(
          emptyDataId,
          docId,
          doc.document_type || 'invoice',
          JSON.stringify(['Scanned PDF detected: document appears to contain image-only pages with minimal embedded text. Manual entry or higher resolution scan recommended.'])
        );

        db.prepare(`
          UPDATE processing_jobs
          SET status = 'completed',
              progress = 100,
              completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ?
        `).run(jobId);
        return;
      }

      // 2. Structured AI extraction via Gemma / Ollama
      db.prepare(`
        UPDATE processing_jobs SET progress = 60 WHERE id = ?
      `).run(jobId);

      const extraction = await OllamaService.extractInvoiceData(ocrResult.text, doc.original_filename);

      db.prepare(`
        UPDATE processing_jobs SET progress = 80 WHERE id = ?
      `).run(jobId);

      let extractedData: ExtractedInvoiceData = extraction.data;

      // 3. Duplicate detection
      const dupCheck = DuplicateService.checkDuplicate(docId, doc.file_hash, extractedData);
      if (dupCheck.isDuplicate) {
        db.prepare(`
          UPDATE documents
          SET is_duplicate = 1,
              duplicate_of_id = ?,
              duplicate_reason = ?
          WHERE id = ?
        `).run(dupCheck.duplicateOfId, dupCheck.duplicateReason, docId);
      }

      // 4. Apply automation rules
      const ruleResult = RulesService.evaluateRules(
        docId,
        extractedData,
        doc.original_filename,
        ocrResult.text
      );
      extractedData = ruleResult.modifiedData;

      if (ruleResult.flagDuplicate) {
        db.prepare(`
          UPDATE documents
          SET is_duplicate = 1,
              duplicate_reason = COALESCE(duplicate_reason, 'Flagged as duplicate by automation rule')
          WHERE id = ?
        `).run(docId);
      }

      // 5. Store extracted data and line items in a transaction
      const saveTx = db.transaction(() => {
        // Remove existing extracted_data and line_items for this document if reprocessing
        db.prepare('DELETE FROM extracted_data WHERE document_id = ?').run(docId);
        db.prepare('DELETE FROM line_items WHERE document_id = ?').run(docId);

        const extractedId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO extracted_data (
            id, document_id, document_type, vendor_name, vendor_address, vendor_tax_id,
            customer_name, invoice_number, po_number, invoice_date, due_date,
            payment_status, currency, subtotal, discount, shipping, tax_amount,
            tax_rate, total_amount, amount_paid, outstanding_balance, category,
            description, notes, tags, confidence_scores, validation_warnings, extraction_model
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          extractedId,
          docId,
          extractedData.document_type || doc.document_type || 'invoice',
          extractedData.vendor_name || null,
          extractedData.vendor_address || null,
          extractedData.vendor_tax_id || null,
          extractedData.customer_name || null,
          extractedData.invoice_number || null,
          extractedData.po_number || null,
          extractedData.invoice_date || null,
          extractedData.due_date || null,
          extractedData.payment_status || null,
          extractedData.currency || 'USD',
          extractedData.subtotal ?? null,
          extractedData.discount ?? null,
          extractedData.shipping ?? null,
          extractedData.tax_amount ?? null,
          extractedData.tax_rate ?? null,
          extractedData.total_amount ?? null,
          extractedData.amount_paid ?? null,
          extractedData.outstanding_balance ?? null,
          extractedData.category || null,
          extractedData.description || null,
          extractedData.notes || null,
          JSON.stringify(extractedData.tags || []),
          JSON.stringify(extraction.confidenceScores || {}),
          JSON.stringify(extraction.validationWarnings || []),
          extraction.model
        );

        // Insert line items
        if (extractedData.line_items && extractedData.line_items.length > 0) {
          const insertItem = db.prepare(`
            INSERT INTO line_items (id, document_id, description, quantity, unit_price, tax_amount, total_price, item_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          extractedData.line_items.forEach((item, index) => {
            insertItem.run(
              crypto.randomUUID(),
              docId,
              item.description,
              item.quantity ?? null,
              item.unit_price ?? null,
              item.tax_amount ?? null,
              item.total_price ?? null,
              index
            );
          });
        }

        // Update vendor registry
        if (extractedData.vendor_name) {
          ExpenseService.upsertVendor(extractedData.vendor_name, extractedData.category || undefined);
        }

        // Determine final document status
        // If there are validation warnings or duplicate candidate or rule requested review: 'needs_review'
        const hasCriticalWarnings = extraction.validationWarnings.length > 0 || dupCheck.isDuplicate || ruleResult.flagNeedsReview;
        const newStatus = hasCriticalWarnings ? 'needs_review' : 'needs_review'; // Default requires user approval in review workspace

        db.prepare(`
          UPDATE documents
          SET status = ?,
              document_type = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ?
        `).run(newStatus, extractedData.document_type || doc.document_type, docId);

        // Complete processing job
        db.prepare(`
          UPDATE processing_jobs
          SET status = 'completed',
              progress = 100,
              completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ?
        `).run(jobId);
      });

      saveTx();
    } catch (err: any) {
      console.error(`Processing error on document ${docId}:`, err);

      // Record failure accurately
      db.prepare(`
        UPDATE documents
        SET status = 'failed',
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `).run(docId);

      db.prepare(`
        UPDATE processing_jobs
        SET status = 'failed',
            error_message = ?,
            completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
      `).run(err.message || 'Processing failed', jobId);

      throw err;
    }
  }
}
