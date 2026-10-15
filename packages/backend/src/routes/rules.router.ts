import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { OllamaService } from '../services/ollama.service.js';
import { AutomationRuleInputSchema } from '../services/validation.schemas.js';

const router = Router();

/**
 * List all automation rules
 */
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM automation_rules
    ORDER BY priority DESC, created_at DESC
  `).all() as any[];

  res.json(rows.map(r => ({
    ...r,
    enabled: Boolean(r.enabled),
    conditions: JSON.parse(r.conditions || '[]'),
    actions: JSON.parse(r.actions || '[]')
  })));
});

/**
 * Create automation rule
 */
router.post('/', (req, res) => {
  try {
    const validated = AutomationRuleInputSchema.parse(req.body);
    const db = getDb();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO automation_rules (
        id, name, enabled, priority, conditions, condition_match_type, actions
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      validated.name,
      validated.enabled ? 1 : 0,
      validated.priority || 0,
      JSON.stringify(validated.conditions),
      validated.condition_match_type,
      JSON.stringify(validated.actions)
    );

    res.status(201).json({ id, message: 'Automation rule created successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid rule configuration' });
  }
});

/**
 * Update automation rule
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  const { name, enabled, priority, conditions, condition_match_type, actions } = req.body;

  db.prepare(`
    UPDATE automation_rules
    SET name = COALESCE(?, name),
        enabled = COALESCE(?, enabled),
        priority = COALESCE(?, priority),
        conditions = COALESCE(?, conditions),
        condition_match_type = COALESCE(?, condition_match_type),
        actions = COALESCE(?, actions),
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
  `).run(
    name || null,
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    priority !== undefined ? priority : null,
    conditions ? JSON.stringify(conditions) : null,
    condition_match_type || null,
    actions ? JSON.stringify(actions) : null,
    id
  );

  res.json({ success: true, message: 'Rule updated successfully' });
});

/**
 * Delete rule
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  db.prepare('DELETE FROM automation_rules WHERE id = ?').run(id);
  res.json({ success: true, message: 'Rule deleted successfully' });
});

/**
 * Natural language rule assistant powered by Gemma
 */
router.post('/assistant', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt string is required' });
  }

  try {
    const proposedRule = await OllamaService.interpretNaturalLanguageRule(prompt);
    res.json({
      success: true,
      proposedRule
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to interpret rule using local AI: ${err.message || String(err)}`
    });
  }
});

/**
 * Rule execution history log
 */
router.get('/history', (req, res) => {
  const db = getDb();
  const { limit = '50' } = req.query;

  const rows = db.prepare(`
    SELECT rh.*, d.original_filename
    FROM rule_history rh
    JOIN documents d ON rh.document_id = d.id
    ORDER BY rh.executed_at DESC
    LIMIT ?
  `).all(parseInt(limit as string, 10) || 50) as any[];

  res.json(rows.map(r => ({
    ...r,
    actions_applied: JSON.parse(r.actions_applied || '[]')
  })));
});

export default router;
