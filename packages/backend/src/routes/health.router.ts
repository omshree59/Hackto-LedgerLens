import { Router } from 'express';
import { OllamaService } from '../services/ollama.service.js';
import { getDb } from '../db/index.js';
import { CONFIG } from '../config.js';

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

router.post('/ollama/start', async (_req, res) => {
  try {
    const result = await OllamaService.ensureRunning();
    res.status(result.health.isOnline ? 200 : 503).json({
      success: result.health.isOnline,
      started: result.started,
      error: result.error,
      status: result.health
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to start Ollama' });
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

router.post('/ollama/test-prompt', async (req, res) => {
  const { prompt = 'Say hello and confirm you are the local Gemma engine.', model, temperature = 0.1 } = req.body;
  const targetModel = model || OllamaService.getActiveModel();
  const startTime = Date.now();

  try {
    const response = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: targetModel,
        prompt,
        stream: false,
        options: { temperature: parseFloat(String(temperature)) || 0.1 }
      })
    });

    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Ollama returned ${response.status}: ${errText}`,
        latencyMs: elapsedMs
      });
    }

    const data = await response.json() as any;
    res.json({
      success: true,
      model: targetModel,
      response: data.response,
      latencyMs: elapsedMs,
      totalDurationNs: data.total_duration,
      evalCount: data.eval_count,
      evalDurationNs: data.eval_duration
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to communicate with local Ollama service',
      latencyMs: Date.now() - startTime
    });
  }
});

export default router;
