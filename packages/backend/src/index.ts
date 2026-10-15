import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG, UPLOADS_DIR } from './config.js';
import { getDb } from './db/index.js';

import healthRouter from './routes/health.router.js';
import documentsRouter from './routes/documents.router.js';
import expensesRouter from './routes/expenses.router.js';
import vendorsRouter from './routes/vendors.router.js';
import rulesRouter from './routes/rules.router.js';
import analyticsRouter from './routes/analytics.router.js';
import exportRouter from './routes/export.router.js';
import settingsRouter from './routes/settings.router.js';

const app = express();

// Initialize database
getDb();

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded files statically for document preview
app.use('/uploads', express.static(UPLOADS_DIR));

// Root health & welcome check
app.get('/', (_req, res) => {
  res.json({
    name: 'LedgerLens Backend API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      ollama: '/api/ollama/status',
      documents: '/api/documents',
      expenses: '/api/expenses',
      analytics: '/api/analytics'
    }
  });
});

// API routes
app.use('/api', healthRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

export { app };

let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log(`===================================================`);
    console.log(`  LedgerLens Backend running at http://${CONFIG.HOST}:${CONFIG.PORT}`);
    console.log(`  Local AI target: ${CONFIG.OLLAMA_BASE_URL} (${CONFIG.DEFAULT_MODEL})`);
    console.log(`===================================================`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    if (server) {
      server.close(() => {
        console.log('Server stopped');
        process.exit(0);
      });
    }
  });
}
