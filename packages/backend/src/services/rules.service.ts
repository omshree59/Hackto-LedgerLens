import crypto from 'crypto';
import { getDb } from '../db/index.js';
import type { ExtractedInvoiceData } from './validation.schemas.js';
import type { AutomationRuleRecord, RuleCondition, RuleAction } from '../types/index.js';

export interface RuleEvaluationResult {
  modifiedData: ExtractedInvoiceData;
  rulesApplied: Array<{
    ruleId: string;
    ruleName: string;
    actions: RuleAction[];
  }>;
  flagNeedsReview: boolean;
  flagDuplicate: boolean;
}

export class RulesService {
  /**
   * Evaluate all active automation rules against a document
   */
  public static evaluateRules(
    docId: string,
    extractedData: ExtractedInvoiceData,
    originalFilename: string,
    extractedText: string
  ): RuleEvaluationResult {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM automation_rules
      WHERE enabled = 1
      ORDER BY priority DESC, created_at ASC
    `).all() as any[];

    const activeRules: AutomationRuleRecord[] = rows.map(r => ({
      ...r,
      conditions: JSON.parse(r.conditions || '[]'),
      actions: JSON.parse(r.actions || '[]'),
    }));

    const resultData: ExtractedInvoiceData = {
      ...extractedData,
      tags: [...(extractedData.tags || [])]
    };

    const rulesApplied: Array<{ ruleId: string; ruleName: string; actions: RuleAction[] }> = [];
    let flagNeedsReview = false;
    let flagDuplicate = false;

    for (const rule of activeRules) {
      const isMatch = this.matchesRule(rule, resultData, originalFilename, extractedText);
      if (isMatch) {
        const appliedActions: RuleAction[] = [];

        for (const action of rule.actions) {
          switch (action.type) {
            case 'set_category':
              resultData.category = action.value;
              appliedActions.push(action);
              break;
            case 'add_tag':
              if (!resultData.tags.includes(action.value)) {
                resultData.tags.push(action.value);
                appliedActions.push(action);
              }
              break;
            case 'set_priority':
              const priorityTag = `priority:${action.value}`;
              if (!resultData.tags.includes(priorityTag)) {
                resultData.tags.push(priorityTag);
                appliedActions.push(action);
              }
              break;
            case 'flag_review':
              flagNeedsReview = true;
              appliedActions.push(action);
              break;
            case 'flag_duplicate':
              flagDuplicate = true;
              appliedActions.push(action);
              break;
            case 'set_vendor_label':
              const vendorTag = `vendor:${action.value}`;
              if (!resultData.tags.includes(vendorTag)) {
                resultData.tags.push(vendorTag);
                appliedActions.push(action);
              }
              break;
            case 'exclude_from_reports':
              if (!resultData.tags.includes('exclude_report')) {
                resultData.tags.push('exclude_report');
                appliedActions.push(action);
              }
              break;
          }
        }

        if (appliedActions.length > 0) {
          rulesApplied.push({
            ruleId: rule.id,
            ruleName: rule.name,
            actions: appliedActions
          });

          // Record rule execution history
          try {
            db.prepare(`
              INSERT INTO rule_history (id, rule_id, document_id, rule_name, actions_applied)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              crypto.randomUUID(),
              rule.id,
              docId,
              rule.name,
              JSON.stringify(appliedActions)
            );

            // Update rule statistics
            db.prepare(`
              UPDATE automation_rules
              SET execution_count = execution_count + 1,
                  last_executed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                  updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
              WHERE id = ?
            `).run(rule.id);
          } catch (e) {
            console.error('Failed to log rule execution:', e);
          }
        }
      }
    }

    return {
      modifiedData: resultData,
      rulesApplied,
      flagNeedsReview,
      flagDuplicate
    };
  }

  /**
   * Test whether a rule conditions match the given document attributes
   */
  public static matchesRule(
    rule: { conditions: RuleCondition[]; condition_match_type: 'AND' | 'OR' },
    data: ExtractedInvoiceData,
    filename: string,
    extractedText: string
  ): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return false;

    const results = rule.conditions.map(cond =>
      this.evaluateCondition(cond, data, filename, extractedText)
    );

    if (rule.condition_match_type === 'OR') {
      return results.some(r => r === true);
    } else {
      return results.every(r => r === true);
    }
  }

  /**
   * Evaluate a single condition against document attributes
   */
  public static evaluateCondition(
    condition: RuleCondition,
    data: ExtractedInvoiceData,
    filename: string,
    extractedText: string
  ): boolean {
    const { field, operator, value } = condition;
    let actualValue: any = null;

    switch (field) {
      case 'vendor_name':
        actualValue = data.vendor_name;
        break;
      case 'original_filename':
        actualValue = filename;
        break;
      case 'document_type':
        actualValue = data.document_type;
        break;
      case 'total_amount':
        actualValue = data.total_amount;
        break;
      case 'currency':
        actualValue = data.currency;
        break;
      case 'category':
        actualValue = data.category;
        break;
      case 'invoice_number':
        actualValue = data.invoice_number;
        break;
      case 'extracted_text':
        actualValue = extractedText;
        break;
      case 'due_date':
        actualValue = data.due_date;
        break;
    }

    const strActual = (actualValue !== null && actualValue !== undefined) ? String(actualValue).toLowerCase() : '';
    const strVal = String(value).toLowerCase();

    switch (operator) {
      case 'equals':
        return strActual === strVal;
      case 'not_equals':
        return strActual !== strVal;
      case 'contains':
        return strActual.includes(strVal);
      case 'not_contains':
        return !strActual.includes(strVal);
      case 'is_empty':
        return actualValue === null || actualValue === undefined || strActual.trim() === '';
      case 'is_not_empty':
        return actualValue !== null && actualValue !== undefined && strActual.trim() !== '';
      case 'greater_than': {
        const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(strActual);
        const numVal = typeof value === 'number' ? value : parseFloat(strVal);
        return !isNaN(numActual) && !isNaN(numVal) && numActual > numVal;
      }
      case 'less_than': {
        const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(strActual);
        const numVal = typeof value === 'number' ? value : parseFloat(strVal);
        return !isNaN(numActual) && !isNaN(numVal) && numActual < numVal;
      }
      case 'matches_regex': {
        try {
          const regex = new RegExp(String(value), 'i');
          return regex.test(String(actualValue || ''));
        } catch {
          return false;
        }
      }
      default:
        return false;
    }
  }
}
