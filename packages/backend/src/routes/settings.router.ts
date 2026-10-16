import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/index.js';
import { DATA_DIR, UPLOADS_DIR, EXPORTS_DIR, DB_FILE } from '../config.js';
import { OllamaService } from '../services/ollama.service.js';

const router = Router();

/**
 * Get all application settings and storage statistics
 */
router.get('/', async (req, res) => {
  const db = getDb();
  const settingsRows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  settingsRows.forEach(r => { settings[r.key] = r.value; });

  // Calculate local disk storage usage
  let uploadFilesCount = 0;
  let uploadBytes = 0;
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    uploadFilesCount = files.length;
    files.forEach(f => {
      try {
        const stats = fs.statSync(path.join(UPLOADS_DIR, f));
        uploadBytes += stats.size;
      } catch {}
    });
  }

  let dbBytes = 0;
  if (fs.existsSync(DB_FILE)) {
    try {
      dbBytes = fs.statSync(DB_FILE).size;
    } catch {}
  }

  // Get Ollama status
  const ollamaStatus = await OllamaService.checkHealth();

  res.json({
    settings,
    storage: {
      dataDir: DATA_DIR,
      dbFile: DB_FILE,
      uploadFilesCount,
      uploadSizeMb: (uploadBytes / (1024 * 1024)).toFixed(2),
      dbSizeMb: (dbBytes / (1024 * 1024)).toFixed(2),
      totalSizeMb: ((uploadBytes + dbBytes) / (1024 * 1024)).toFixed(2)
    },
    ollama: ollamaStatus
  });
});

/**
 * Update application settings
 */
router.put('/', (req, res) => {
  const db = getDb();
  const entries = Object.entries(req.body);

  const updateStmt = db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value)
    VALUES (?, ?)
  `);

  const tx = db.transaction(() => {
    for (const [k, v] of entries) {
      if (typeof v === 'string') {
        updateStmt.run(k, v);
      }
    }
  });

  tx();
  res.json({ success: true, message: 'Settings updated successfully' });
});

/**
 * Get categories list
 */
router.get('/categories', (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(categories);
});

/**
 * Create custom category
 */
router.post('/categories', (req, res) => {
  const { name, color = '#10b981', description, icon = 'Tag' } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const db = getDb();
  const id = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO categories (id, name, color, description, icon, is_system)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, name.trim(), color, description || null, icon);
    res.status(201).json({ id, name: name.trim(), message: 'Category created' });
  } catch (err: any) {
    res.status(400).json({ error: 'Category with this name already exists' });
  }
});

/**
 * Delete custom category
 */
router.delete('/categories/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  if (cat.is_system) return res.status(400).json({ error: 'Cannot delete default system category' });

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true, message: 'Category deleted' });
});

/**
 * Reset all application records and clear stored documents
 */
router.post('/reset', (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'RESET_ALL_DATA') {
    return res.status(400).json({ error: 'Confirmation string "RESET_ALL_DATA" required' });
  }

  const db = getDb();
  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM line_items').run();
    db.prepare('DELETE FROM extracted_data').run();
    db.prepare('DELETE FROM processing_jobs').run();
    db.prepare('DELETE FROM rule_history').run();
    db.prepare('DELETE FROM automation_rules').run();
    db.prepare('DELETE FROM vendors').run();
    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM categories WHERE is_system = 0').run();
  });

  resetTx();

  // Clear uploaded files
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      } catch {}
    }
  }

  // Clear organized exported directory
  const organizedDir = path.join(EXPORTS_DIR, 'organized');
  if (fs.existsSync(organizedDir)) {
    try {
      fs.rmSync(organizedDir, { recursive: true, force: true });
    } catch {}
  }

  res.json({ success: true, message: 'All application records and local files have been reset.' });
});

export default router;
