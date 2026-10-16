import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PACKAGE_DIR = path.resolve(__dirname, '..');
export const ROOT_DIR = path.resolve(__dirname, '../../..');

// Always load .env from the repo, not from whatever folder the terminal was opened in.
dotenv.config({ path: path.join(ROOT_DIR, '.env') });
dotenv.config({ path: path.join(PACKAGE_DIR, '.env') });

function userDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'LedgerLens'
    );
  }
  return path.join(os.homedir(), '.ledgerlens');
}

function resolveDataDir(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.join(os.tmpdir(), 'ledgerlens-test');
  }
  if (process.env.DATA_DIR) {
    return path.isAbsolute(process.env.DATA_DIR)
      ? process.env.DATA_DIR
      : path.resolve(ROOT_DIR, process.env.DATA_DIR);
  }
  return userDataDir();
}

export const DATA_DIR = resolveDataDir();
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');

function resolveDbFile(): string {
  if (process.env.DB_FILE) {
    return path.isAbsolute(process.env.DB_FILE)
      ? process.env.DB_FILE
      : path.resolve(ROOT_DIR, process.env.DB_FILE);
  }
  return path.join(
    DATA_DIR,
    process.env.NODE_ENV === 'test' ? 'ledgerlens.test.sqlite' : 'ledgerlens.sqlite'
  );
}

export const DB_FILE = resolveDbFile();

function copyFileIfMissing(src: string, dest: string): boolean {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function migrateLegacyFolder(legacyDir: string): void {
  if (!legacyDir || legacyDir === DATA_DIR || !fs.existsSync(legacyDir)) return;

  const legacyDb = path.join(legacyDir, 'ledgerlens.sqlite');
  const copiedDb = copyFileIfMissing(legacyDb, DB_FILE);
  copyFileIfMissing(`${legacyDb}-wal`, `${DB_FILE}-wal`);
  copyFileIfMissing(`${legacyDb}-shm`, `${DB_FILE}-shm`);

  const legacyUploads = path.join(legacyDir, 'uploads');
  if (fs.existsSync(legacyUploads)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    for (const name of fs.readdirSync(legacyUploads)) {
      if (name === '.gitkeep') continue;
      copyFileIfMissing(path.join(legacyUploads, name), path.join(UPLOADS_DIR, name));
    }
  }

  if (copiedDb) {
    console.log(`  Migrated existing ledger from ${legacyDir}`);
  }
}

[DATA_DIR, UPLOADS_DIR, EXPORTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

if (process.env.NODE_ENV !== 'test') {
  for (const legacy of [
    path.join(ROOT_DIR, 'data'),
    path.join(PACKAGE_DIR, 'data'),
    path.join(process.cwd(), 'data')
  ]) {
    migrateLegacyFolder(legacy);
  }
}

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
