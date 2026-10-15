import Database from 'better-sqlite3';
import { DB_FILE } from '../config.js';
import crypto from 'crypto';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_FILE);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      document_type TEXT NOT NULL DEFAULT 'invoice',
      status TEXT NOT NULL DEFAULT 'uploaded',
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      duplicate_of_id TEXT,
      duplicate_reason TEXT,
      extracted_text TEXT,
      ocr_confidence REAL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (duplicate_of_id) REFERENCES documents(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);

    CREATE TABLE IF NOT EXISTS extracted_data (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL UNIQUE,
      document_type TEXT,
      vendor_name TEXT,
      vendor_address TEXT,
      vendor_tax_id TEXT,
      customer_name TEXT,
      invoice_number TEXT,
      po_number TEXT,
      invoice_date TEXT,
      due_date TEXT,
      payment_status TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      subtotal REAL,
      discount REAL,
      shipping REAL,
      tax_amount REAL,
      tax_rate REAL,
      total_amount REAL,
      amount_paid REAL,
      outstanding_balance REAL,
      category TEXT,
      description TEXT,
      notes TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      confidence_scores TEXT NOT NULL DEFAULT '{}',
      validation_warnings TEXT NOT NULL DEFAULT '[]',
      extraction_model TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_extracted_vendor ON extracted_data(vendor_name);
    CREATE INDEX IF NOT EXISTS idx_extracted_invoice_num ON extracted_data(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_extracted_invoice_date ON extracted_data(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_extracted_category ON extracted_data(category);

    CREATE TABLE IF NOT EXISTS line_items (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL,
      unit_price REAL,
      tax_amount REAL,
      total_price REAL,
      item_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_line_items_doc ON line_items(document_id);

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      expense_date TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Other',
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'approved',
      tags TEXT NOT NULL DEFAULT '[]',
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(vendor_name);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_doc ON expenses(document_id);

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      normalized_name TEXT NOT NULL UNIQUE,
      default_category TEXT,
      tax_id TEXT,
      address TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vendors_norm ON vendors(normalized_name);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#10b981',
      icon TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      conditions TEXT NOT NULL DEFAULT '[]',
      condition_match_type TEXT NOT NULL DEFAULT 'AND',
      actions TEXT NOT NULL DEFAULT '[]',
      execution_count INTEGER NOT NULL DEFAULT 0,
      last_executed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS rule_history (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      actions_applied TEXT NOT NULL,
      executed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS processing_jobs (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      job_type TEXT NOT NULL DEFAULT 'extraction',
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default categories
  const defaultCategories = [
    { name: 'Software', color: '#3b82f6', icon: 'Code', desc: 'SaaS subscriptions, developer tools, licenses' },
    { name: 'Office Supplies', color: '#10b981', icon: 'Briefcase', desc: 'Stationery, paper, office basics' },
    { name: 'Travel', color: '#f59e0b', icon: 'Plane', desc: 'Flights, hotels, transit, rental cars' },
    { name: 'Meals & Dining', color: '#ef4444', icon: 'Utensils', desc: 'Business meals, client dining, catering' },
    { name: 'Utilities', color: '#8b5cf6', icon: 'Zap', desc: 'Electricity, water, internet, phone' },
    { name: 'Professional Services', color: '#6366f1', icon: 'Award', desc: 'Legal, accounting, consulting' },
    { name: 'Marketing & Ads', color: '#ec4899', icon: 'Megaphone', desc: 'Advertising campaigns, sponsorships, PR' },
    { name: 'Equipment & Hardware', color: '#14b8a6', icon: 'Cpu', desc: 'Computers, monitors, machinery' },
    { name: 'Cloud Infrastructure', color: '#06b6d4', icon: 'Server', desc: 'AWS, GCP, DigitalOcean, Supabase, Vercel' },
    { name: 'Other', color: '#64748b', icon: 'Tag', desc: 'Miscellaneous and uncategorized expenses' },
  ];

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, description, color, icon, is_system)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const cat of defaultCategories) {
    insertCat.run(crypto.randomUUID(), cat.name, cat.desc, cat.color, cat.icon);
  }

  // Seed default settings
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES (?, ?)
  `);

  insertSetting.run('selected_model', 'gemma3:4b');
  insertSetting.run('theme', 'dark');
  insertSetting.run('document_naming_pattern', '{type}/{yyyy}/{mm}/{vendor}_{number}');
  insertSetting.run('auto_approve_high_confidence', '0');
  insertSetting.run('currency_default', 'USD');
}
