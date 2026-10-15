import fs from 'fs';
import { extractText as extractPdfText } from 'unpdf';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
  pageCount?: number;
  isScannedPdf?: boolean;
}

export class OcrService {
  /**
   * Extract text from PDF or Image file
   */
  public static async extractText(filePath: string, mimeType: string): Promise<OcrResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(filePath);
    } else if (mimeType.startsWith('image/')) {
      return this.extractFromImage(filePath);
    } else {
      throw new Error(`Unsupported MIME type for OCR: ${mimeType}`);
    }
  }

  /**
   * Extract embedded text from PDF using modern unpdf with pdf-parse fallback
   */
  private static async extractFromPdf(filePath: string): Promise<OcrResult> {
    const fileBuffer = fs.readFileSync(filePath);

    let rawText = '';
    let totalPages = 1;

    // 1. Try modern unpdf (pdfjs-based)
    try {
      const res = await extractPdfText(new Uint8Array(fileBuffer));
      rawText = Array.isArray(res.text) ? res.text.join('\n') : String(res.text || '');
      totalPages = res.totalPages || 1;
    } catch (unpdfErr) {
      // 2. Fallback to pdf-parse
      try {
        const legacyData = await pdfParse(fileBuffer);
        rawText = legacyData.text || '';
        totalPages = legacyData.numpages || 1;
      } catch (legacyErr: any) {
        throw new Error(`PDF text extraction failed: ${legacyErr.message || String(legacyErr)}`);
      }
    }

    const cleanedText = this.normalizeText(rawText);
    const nonWhitespaceCount = cleanedText.replace(/\s+/g, '').length;

    // Check if scanned PDF with minimal or no embedded text
    if (nonWhitespaceCount < 30) {
      return {
        text: cleanedText,
        confidence: 0.2,
        pageCount: totalPages,
        isScannedPdf: true
      };
    }

    return {
      text: cleanedText,
      confidence: 0.95,
      pageCount: totalPages,
      isScannedPdf: false
    };
  }

  /**
   * Perform OCR on an image file using Tesseract.js
   */
  private static async extractFromImage(filePath: string): Promise<OcrResult> {
    try {
      const result = await Tesseract.recognize(filePath, 'eng', {
        logger: () => {} // quiet progress logger
      });

      const cleanedText = this.normalizeText(result.data.text || '');
      const confidence = (result.data.confidence || 75) / 100;

      return {
        text: cleanedText,
        confidence: Math.min(Math.max(confidence, 0.1), 0.99),
        pageCount: 1,
        isScannedPdf: false
      };
    } catch (err: any) {
      throw new Error(`Image OCR failed: ${err.message || String(err)}`);
    }
  }

  /**
   * Normalize OCR text for downstream LLM parsing
   */
  public static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
