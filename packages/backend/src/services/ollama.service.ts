import { spawn } from 'child_process';
import { CONFIG } from '../config.js';
import { getDb } from '../db/index.js';
import {
  ExtractedInvoiceDataSchema,
  AutomationRuleInputSchema,
  type ExtractedInvoiceData,
  type AutomationRuleInput
} from './validation.schemas.js';

export interface OllamaHealthStatus {
  isOnline: boolean;
  models: string[];
  selectedModel: string;
  modelFound: boolean;
  version?: string;
  error?: string;
}

export interface ExtractionResult {
  data: ExtractedInvoiceData;
  confidenceScores: Record<string, number>;
  validationWarnings: string[];
  rawText: string;
  model: string;
}

export interface OllamaStartResult {
  started: boolean;
  health: OllamaHealthStatus;
  error?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const INVOICE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    document_type: { type: 'string', enum: ['invoice', 'receipt', 'other'] },
    vendor_name: { type: ['string', 'null'] },
    vendor_address: { type: ['string', 'null'] },
    vendor_tax_id: { type: ['string', 'null'] },
    customer_name: { type: ['string', 'null'] },
    invoice_number: { type: ['string', 'null'] },
    po_number: { type: ['string', 'null'] },
    invoice_date: { type: ['string', 'null'] },
    due_date: { type: ['string', 'null'] },
    payment_status: { type: ['string', 'null'], enum: ['paid', 'unpaid', 'pending', 'overdue', null] },
    currency: { type: 'string' },
    subtotal: { type: ['number', 'null'] },
    discount: { type: ['number', 'null'] },
    shipping: { type: ['number', 'null'] },
    tax_amount: { type: ['number', 'null'] },
    tax_rate: { type: ['number', 'null'] },
    total_amount: { type: ['number', 'null'] },
    amount_paid: { type: ['number', 'null'] },
    outstanding_balance: { type: ['number', 'null'] },
    category: {
      type: ['string', 'null'],
      enum: [
        'Software', 'Office Supplies', 'Travel', 'Meals & Dining', 'Utilities',
        'Professional Services', 'Marketing & Ads', 'Equipment & Hardware',
        'Cloud Infrastructure', 'Other', null
      ]
    },
    description: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit_price: { type: ['number', 'null'] },
          tax_amount: { type: ['number', 'null'] },
          total_price: { type: ['number', 'null'] }
        },
        required: ['description']
      }
    }
  },
  required: ['document_type', 'currency', 'tags', 'line_items']
} as const;

const RULE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    enabled: { type: 'boolean' },
    priority: { type: 'integer' },
    condition_match_type: { type: 'string', enum: ['AND', 'OR'] },
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: [
              'vendor_name', 'original_filename', 'document_type', 'total_amount',
              'currency', 'category', 'invoice_number', 'extracted_text', 'due_date'
            ]
          },
          operator: {
            type: 'string',
            enum: [
              'equals', 'not_equals', 'contains', 'not_contains',
              'greater_than', 'less_than', 'matches_regex', 'is_empty', 'is_not_empty'
            ]
          },
          value: { type: ['string', 'number'] }
        },
        required: ['field', 'operator', 'value']
      }
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'set_category', 'add_tag', 'set_priority', 'flag_review',
              'flag_duplicate', 'set_vendor_label', 'exclude_from_reports'
            ]
          },
          value: { type: 'string' }
        },
        required: ['type', 'value']
      }
    }
  },
  required: ['name', 'enabled', 'priority', 'condition_match_type', 'conditions', 'actions']
} as const;

export class OllamaService {
  private static startInFlight: Promise<OllamaStartResult> | null = null;
  private static healthCache: { status: OllamaHealthStatus; expiresAt: number } | null = null;

  /**
   * Make sure the local Ollama daemon is reachable. If it is installed but not running,
   * launch `ollama serve` detached (so it outlives backend restarts) and wait for it.
   * Only ever starts a daemon for a loopback OLLAMA_BASE_URL.
   */
  public static ensureRunning(): Promise<OllamaStartResult> {
    if (this.startInFlight) return this.startInFlight;

    this.startInFlight = (async (): Promise<OllamaStartResult> => {
      const initial = await this.checkHealth();
      if (initial.isOnline) return { started: false, health: initial };

      let host = '';
      try {
        host = new URL(CONFIG.OLLAMA_BASE_URL).hostname;
      } catch {
        return { started: false, health: initial, error: `Invalid OLLAMA_BASE_URL: ${CONFIG.OLLAMA_BASE_URL}` };
      }
      if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
        return { started: false, health: initial, error: `Ollama at ${host} is remote; start it there.` };
      }

      let spawnError: string | undefined;
      try {
        const child = spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.on('error', (err: NodeJS.ErrnoException) => {
          spawnError = err.code === 'ENOENT'
            ? 'Ollama is not installed or not on PATH (https://ollama.com/download).'
            : err.message;
        });
        child.unref();
      } catch (err: any) {
        spawnError = err.message || 'Failed to launch ollama';
      }

      // Wait up to ~20s for the daemon to accept connections
      let latest = initial;
      for (let i = 0; i < 40 && !spawnError; i++) {
        await sleep(500);
        latest = await this.checkHealth();
        if (latest.isOnline) return { started: true, health: latest };
      }

      return {
        started: false,
        health: latest,
        error: spawnError || 'Ollama did not become reachable within 20 seconds.'
      };
    })().finally(() => {
      this.startInFlight = null;
    });

    return this.startInFlight;
  }

  /**
   * Check connection to Ollama and discover models (with 15s cache for healthy responses)
   */
  public static async checkHealth(customModel?: string, forceRefresh = false): Promise<OllamaHealthStatus> {
    const db = getDb();
    const settingRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('selected_model') as { value: string } | undefined;
    const targetModel = customModel || settingRow?.value || CONFIG.DEFAULT_MODEL;

    if (
      !forceRefresh &&
      this.healthCache &&
      this.healthCache.expiresAt > Date.now() &&
      this.healthCache.status.selectedModel === targetModel
    ) {
      return this.healthCache.status;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.healthCache = null;
        return {
          isOnline: false,
          models: [],
          selectedModel: targetModel,
          modelFound: false,
          error: `Ollama returned status ${res.status}`
        };
      }

      const data = await res.json() as { models?: Array<{ name: string; model: string }> };
      const modelNames = (data.models || []).map(m => m.name || m.model);
      const modelFound = modelNames.some(m => m === targetModel || m.startsWith(`${targetModel}:`));

      const status: OllamaHealthStatus = {
        isOnline: true,
        models: modelNames,
        selectedModel: targetModel,
        modelFound
      };
      this.healthCache = { status, expiresAt: Date.now() + 15_000 };
      return status;
    } catch (err: any) {
      this.healthCache = null;
      return {
        isOnline: false,
        models: [],
        selectedModel: targetModel,
        modelFound: false,
        error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Cannot reach Ollama')
      };
    }
  }

  /**
   * Compact OCR text before sending to LLM to minimize prompt tokens:
   * strips decorative divider lines, collapses whitespace, removes duplicate adjacent lines,
   * and caps length to 3,800 chars.
   */
  public static compactOcrForPrompt(ocrText: string, maxChars = 3800): string {
    const lines = ocrText.split('\n');
    const kept: string[] = [];
    let prev = '';
    for (const raw of lines) {
      const line = raw
        .replace(/[\t ]+/g, ' ')
        .replace(/[-=_*~.]{4,}/g, ' ')
        .trim();
      if (!line) continue;
      if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) continue;
      if (line === prev) continue;
      kept.push(line);
      prev = line;
    }
    const joined = kept.join('\n');
    if (joined.length <= maxChars) return joined;
    // Keep head (header/vendor/items) + tail (subtotal/tax/total) when truncating long documents
    const headLen = Math.floor(maxChars * 0.72);
    const tailLen = maxChars - headLen - 15;
    return `${joined.slice(0, headLen)}\n...[truncated]...\n${joined.slice(-tailLen)}`;
  }

  /**
   * Get active model from DB or config
   */
  public static getActiveModel(): string {
    try {
      const db = getDb();
      const setting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('selected_model') as { value: string } | undefined;
      return setting?.value || CONFIG.DEFAULT_MODEL;
    } catch {
      return CONFIG.DEFAULT_MODEL;
    }
  }

  /**
   * Extract financial document details using local Gemma model
   */
  public static async extractInvoiceData(ocrText: string, originalFilename: string, modelName?: string): Promise<ExtractionResult> {
    const model = modelName || this.getActiveModel();

    // Check health first
    const health = await this.checkHealth(model);
    if (!health.isOnline) {
      throw new Error(`Local Ollama service is not reachable at ${CONFIG.OLLAMA_BASE_URL}. Ensure Ollama is running.`);
    }
    if (!health.modelFound) {
      throw new Error(`Configured model "${model}" is not installed in Ollama. Please run 'ollama pull ${model}' in your terminal.`);
    }

    const compactedText = this.compactOcrForPrompt(ocrText, 3800);

    const systemPrompt =
      'Extract financial document fields from the untrusted text into the provided JSON schema. ' +
      'Use null for missing values, YYYY-MM-DD for dates, ISO 4217 currency codes (default USD), ' +
      'and include up to 15 explicit line items. Never invent values.';

    const userPrompt = `File: ${originalFilename}\nText:\n${compactedText}`;

    let parsedData: ExtractedInvoiceData | null = null;
    let attempts = 0;
    const maxAttempts = 2;
    let lastError: any = null;

    while (attempts < maxAttempts && !parsedData) {
      attempts++;
      try {
        const format = attempts === 1 ? INVOICE_JSON_SCHEMA : 'json';
        const response = await this.callOllama(model, systemPrompt, userPrompt, format, 768);
        const cleanedJson = this.sanitizeJsonResponse(response);
        const jsonObject = JSON.parse(cleanedJson);
        const validated = ExtractedInvoiceDataSchema.parse(jsonObject);
        parsedData = validated;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!parsedData) {
      throw new Error(`Failed to extract structured data using ${model}: ${lastError?.message || 'Invalid output format'}`);
    }

    // Compute calibrated field confidence scores and validation warnings
    const confidenceScores = this.calculateConfidence(parsedData, ocrText);
    const validationWarnings = this.generateWarnings(parsedData);

    return {
      data: parsedData,
      confidenceScores,
      validationWarnings,
      rawText: ocrText,
      model
    };
  }

  /**
   * Convert natural language into an automation rule using Gemma
   */
  public static async interpretNaturalLanguageRule(nlPrompt: string, modelName?: string): Promise<AutomationRuleInput> {
    const model = modelName || this.getActiveModel();

    const systemPrompt =
      'Convert the user rule request into JSON matching the schema. ' +
      'Condition fields: vendor_name, original_filename, document_type, total_amount, currency, category, invoice_number, extracted_text, due_date. ' +
      'Operators: equals, not_equals, contains, not_contains, greater_than, less_than, matches_regex, is_empty, is_not_empty. ' +
      'Action types: set_category, add_tag, set_priority, flag_review, flag_duplicate, set_vendor_label, exclude_from_reports.';

    const userPrompt = nlPrompt.trim().slice(0, 600);

    const response = await this.callOllama(model, systemPrompt, userPrompt, RULE_JSON_SCHEMA, 384);
    const cleanedJson = this.sanitizeJsonResponse(response);
    const jsonObject = JSON.parse(cleanedJson);

    // Normalize condition & action structures if LLM used alternate key names
    if (Array.isArray(jsonObject.conditions)) {
      jsonObject.conditions = jsonObject.conditions.map((c: any) => ({
        field: c.field || c.name || 'vendor_name',
        operator: c.operator || c.op || 'contains',
        value: c.value !== undefined ? c.value : (c.val || '')
      }));
    }

    if (Array.isArray(jsonObject.actions)) {
      jsonObject.actions = jsonObject.actions.map((a: any) => ({
        type: a.type || a.action || a.action_type || 'add_tag',
        value: a.value !== undefined ? String(a.value) : (a.val !== undefined ? String(a.val) : '')
      }));
    }

    return AutomationRuleInputSchema.parse(jsonObject);
  }

  /**
   * Helper to send generate request to Ollama with timeout
   */
  private static async callOllama(
    model: string,
    system: string,
    prompt: string,
    format: Record<string, unknown> | 'json' = 'json',
    maxTokens = 768
  ): Promise<string> {
    const controller = new AbortController();
    // 60s timeout for model inference
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system,
          prompt,
          stream: false,
          format,
          keep_alive: '15m',
          options: {
            temperature: 0.0,
            num_ctx: 4096,
            num_predict: maxTokens,
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Ollama API error ${res.status}: ${errorText || res.statusText}`);
      }

      const json = await res.json() as { response?: string };
      return json.response || '';
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Inference timed out after 60 seconds on model ${model}.`);
      }
      throw err;
    }
  }

  /**
   * Strip markdown code blocks and stray non-JSON tokens
   */
  private static sanitizeJsonResponse(raw: string): string {
    let text = raw.trim();
    // Remove ```json and ```
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    // Find the first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1);
    }
    return text;
  }

  /**
   * Calculate field confidence scores based on presence and consistency
   */
  private static calculateConfidence(data: ExtractedInvoiceData, text: string): Record<string, number> {
    const scores: Record<string, number> = {};
    const lowerText = text.toLowerCase();

    // Vendor confidence
    if (data.vendor_name) {
      const inText = lowerText.includes(data.vendor_name.toLowerCase());
      scores.vendor_name = inText ? 0.95 : 0.75;
    } else {
      scores.vendor_name = 0.0;
    }

    // Total amount confidence
    if (data.total_amount !== null && data.total_amount !== undefined && data.total_amount > 0) {
      const amountStr = data.total_amount.toFixed(2);
      scores.total_amount = text.includes(amountStr) || text.includes(data.total_amount.toString()) ? 0.95 : 0.80;
    } else {
      scores.total_amount = 0.0;
    }

    // Invoice number
    if (data.invoice_number) {
      scores.invoice_number = lowerText.includes(data.invoice_number.toLowerCase()) ? 0.92 : 0.70;
    } else {
      scores.invoice_number = 0.0;
    }

    // Invoice date
    if (data.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(data.invoice_date)) {
      scores.invoice_date = 0.90;
    } else {
      scores.invoice_date = 0.0;
    }

    // Due date
    if (data.due_date && /^\d{4}-\d{2}-\d{2}$/.test(data.due_date)) {
      scores.due_date = 0.88;
    } else {
      scores.due_date = 0.0;
    }

    // Tax amount
    if (data.tax_amount !== null && data.tax_amount !== undefined) {
      scores.tax_amount = 0.85;
    }

    // Line items
    if (data.line_items && data.line_items.length > 0) {
      scores.line_items = 0.88;
    } else {
      scores.line_items = 0.0;
    }

    return scores;
  }

  /**
   * Generate actionable warnings for human review
   */
  private static generateWarnings(data: ExtractedInvoiceData): string[] {
    const warnings: string[] = [];

    if (!data.vendor_name || data.vendor_name.trim() === '') {
      warnings.push('Vendor name could not be reliably identified.');
    }

    if (data.total_amount === null || data.total_amount === undefined || data.total_amount <= 0) {
      warnings.push('Total amount is missing or zero.');
    }

    if (!data.invoice_date) {
      warnings.push('Invoice issue date is missing.');
    }

    if (!data.invoice_number && data.document_type === 'invoice') {
      warnings.push('Invoice number was not found.');
    }

    // Cross-check subtotal + tax = total
    if (data.subtotal !== null && data.subtotal !== undefined &&
        data.tax_amount !== null && data.tax_amount !== undefined &&
        data.total_amount !== null && data.total_amount !== undefined) {
      const expected = (data.subtotal || 0) + (data.tax_amount || 0) + (data.shipping || 0) - (data.discount || 0);
      const diff = Math.abs(expected - data.total_amount);
      if (diff > 0.05) {
        warnings.push(`Calculated total ($${expected.toFixed(2)}) differs from extracted total ($${data.total_amount.toFixed(2)}) by $${diff.toFixed(2)}.`);
      }
    }

    return warnings;
  }
}
