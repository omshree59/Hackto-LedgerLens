import { Router } from 'express';
import { OllamaService } from '../services/ollama.service.js';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/health', (req, res) => {
  const db = getDb();
  let dbStatus = 'healthy';
  try {
    db.prepare('SELECT 1').get();
  } catch {
    dbStatus = 'unhealthy';
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    version: '1.0.0'
  });
});

router.get('/ollama/status', async (req, res) => {
  try {
    const health = await OllamaService.checkHealth();
    res.json(health);
  } catch (err: any) {
    res.status(500).json({
      isOnline: false,
      models: [],
      selectedModel: OllamaService.getActiveModel(),
      modelFound: false,
      error: err.message || 'Error checking Ollama status'
    });
  }
});

router.post('/ollama/set-model', (req, res) => {
  const { model } = req.body;
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'Valid model name is required' });
  }

  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value)
    VALUES ('selected_model', ?)
  `).run(model.trim());

  res.json({ success: true, selectedModel: model.trim() });
});

export default router;
