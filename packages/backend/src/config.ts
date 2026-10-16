import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root data directory
export const ROOT_DIR = path.resolve(__dirname, '../../..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
export const DB_FILE =
  process.env.DB_FILE ||
  (process.env.NODE_ENV === 'test'
    ? path.join(DATA_DIR, 'ledgerlens.test.sqlite')
    : path.join(DATA_DIR, 'ledgerlens.sqlite'));

// Ensure required directories exist
[DATA_DIR, UPLOADS_DIR, EXPORTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '127.0.0.1',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'gemma3:4b',
  MAX_FILE_SIZE_MB: 25,
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp'
  ]
};
