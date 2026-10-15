# LedgerLens 🔍🧾

> **"Your invoices, organized. Your data, yours."**
> Premium, local-first AI invoice & receipt management application inspired by InvoiceSorter.app.

LedgerLens automatically extracts, organizes, categorizes, and tracks invoices and receipts using **local AI (Gemma 3 4B through Ollama)**. All documents, OCR text, extracted financial records, and automation rules stay completely on your computer—zero cloud AI APIs invoked.

---

## 🌟 Key Features

1. **100% Private, Local-First AI Inference**
   - Inference runs via Ollama (`http://127.0.0.1:11434`) using the default model `gemma3:4b`.
   - No external API keys (no OpenAI, Gemini, or Anthropic cloud endpoints).
   - Zero telemetry tracking. Original documents remain stored in private local directories.

2. **Smart Invoice & Receipt Inbox**
   - Drag-and-drop batch upload for PDF, PNG, JPG, JPEG, and WEBP documents (up to 25MB each).
   - Multi-stage local processing: Tesseract.js OCR for images, modern `unpdf` and `pdf-parse` for PDFs, with scanned PDF fallback detection.
   - Comprehensive document tables with status badges, vendor filtering, date ranges, amount filters, sorting, and pagination.
   - Multi-select bulk actions: Bulk Approve, Bulk Categorize, Bulk Export CSV, and Bulk Delete.

3. **Split-Screen AI Review Workspace**
   - **Left Panel**: High-fidelity PDF/image viewer with zoom controls (50% to 200%), reset zoom, and original file download.
   - **Right Panel**: Extracted financial fields (Vendor, Tax ID, Invoice #, Issue Date, Due Date, Payment Status, Subtotal, Tax Amount, Total, Category, Tags), field-level confidence scores, and validation warnings.
   - **Line Items Editor**: Editable table to add, modify, or delete line items with quantities, unit prices, and line totals.
   - Actions to save edits, approve into expenses, reprocess with Ollama, or archive duplicates.

4. **Multi-Factor Duplicate Detection**
   - Exact SHA-256 cryptographic file hashing detects identical file uploads instantly.
   - Probable invoice collision detection compares normalized vendor names, invoice numbers, dates, and amounts.
   - Clear comparison UI with options to *"Mark as Legitimate Separate Transaction"* or *"Confirm Duplicate & Archive"*.

5. **Gemma Natural Language Automation Rules**
   - Visual rule builder supporting AND/OR logic with conditions (`vendor_name`, `total_amount`, `currency`, `document_type`, etc.) and actions (`set_category`, `add_tag`, `set_priority`, `flag_review`, etc.).
   - Built-in **Gemma Natural Language Assistant**: Type requests like *"When vendor is Cloudflare, add the Software tag and assign the Technology category"* and let Gemma generate the structured rule with deterministic backend validation.
   - Rule execution audit history tracking past automated actions.

6. **Expense Tracking & Vendor Directory**
   - Single-source expense synchronization: Approving an invoice records it into the expense registry and prevents duplicate expense generation when reprocessing.
   - Vendor directory tracking lifetime spend, invoice counts, most recent invoice dates, with safe vendor merging.

7. **Financial Analytics, Tax Summaries & RFC 4180 CSV Export**
   - Real SQLite-computed metrics (monthly spending trends, category distributions, paid vs unpaid breakdowns).
   - Annual tax & VAT estimations.
   - Safe CSV exports for Invoices, Receipts, Expenses, and Vendors with spreadsheet formula injection defense (`=`, `+`, `-`, `@` prefixes sanitized).
   - Automatic local folder reorganization into `Invoices/YYYY/MM/Vendor_InvoiceNumber.pdf`.

---

## 🏗️ Architecture & Technology Stack

```
ledgerlens/
├── packages/
│   ├── backend/               # Node.js + Express + TypeScript + SQLite
│   │   ├── src/
│   │   │   ├── config.ts      # Server configuration & local paths
│   │   │   ├── db/            # SQLite schema, indices & migrations
│   │   │   ├── services/      # Ollama, OCR, Duplicate, Rules, Expense, Export
│   │   │   ├── routes/        # Express REST API endpoints
│   │   │   ├── types/         # Domain TypeScript types
│   │   │   └── tests/         # Vitest unit & integration tests
│   ├── frontend/              # React 19 + TypeScript + Vite + Tailwind CSS v4
│   │   ├── src/
│   │   │   ├── api/           # Type-safe API client
│   │   │   ├── components/    # Sidebar, Header, UploadModal, ReviewWorkspaceModal, DocumentTable
│   │   │   ├── pages/         # Overview, Invoices, Receipts, Review, Vendors, Expenses, Rules, Reports, Settings
│   │   │   └── types/         # Frontend domain types
└── data/                      # Private local file storage & SQLite database
    ├── uploads/               # Uploaded originals
    ├── exports/               # Exported CSVs & organized folder trees
    └── ledgerlens.sqlite      # SQLite database with WAL mode
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20+ or v22+
- **Ollama**: Installed from [ollama.com](https://ollama.com)

### 2. Pull Gemma Model & Start Ollama
In your terminal, pull the required model:
```bash
ollama pull gemma3:4b
```
Ensure the Ollama service is running:
```bash
ollama serve
```

### 3. Install Dependencies
From the repository root:
```bash
npm install
```

### 4. Run Development Servers
Start both backend (port 3001) and frontend (port 5173):
```bash
npm run dev
```

Or run them individually:
```bash
npm run dev:backend   # Express backend on http://127.0.0.1:3001
npm run dev:frontend  # Vite frontend on http://localhost:5173
```

Open your browser to:
**http://localhost:5173**

---

## 🧪 Running Automated Tests

Run backend unit and integration tests with Vitest:
```bash
npm run test
```

Build both frontend and backend for production:
```bash
npm run build
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | System health & SQLite connectivity |
| `/api/ollama/status` | GET | Connection state & installed models |
| `/api/ollama/set-model` | POST | Configure active local AI model |
| `/api/documents/upload` | POST | Multi-file document upload & queue processing |
| `/api/documents` | GET | Filtered & paginated documents |
| `/api/documents/:id` | GET | Document detail, extracted fields, and line items |
| `/api/documents/:id` | PUT | Save human corrections to extracted fields |
| `/api/documents/:id/approve` | POST | Approve document and sync into Expenses |
| `/api/documents/:id/reprocess` | POST | Re-trigger Gemma extraction on document |
| `/api/documents/:id/duplicate-action` | POST | Clear or confirm duplicate candidate |
| `/api/documents/:id` | DELETE | Delete document, DB records, and local file |
| `/api/documents/bulk` | POST | Bulk approve, delete, or categorize documents |
| `/api/expenses` | GET / POST | List filtered expenses or create manual expense |
| `/api/vendors` | GET | Vendor spending directory and invoice counts |
| `/api/vendors/merge` | POST | Reassign records from duplicate vendor |
| `/api/rules` | GET / POST | Manage automation rules |
| `/api/rules/assistant` | POST | Gemma natural language rule translation |
| `/api/analytics/dashboard` | GET | Real SQLite KPIs, trends, and recent records |
| `/api/export/csv` | GET | Download RFC 4180 sanitized CSV |
| `/api/export/organize` | POST | Trigger local directory file organization |
| `/api/settings/seed-demo` | POST | Populate realistic synthetic records (labeled Demo) |
| `/api/settings/reset` | POST | Purge all database records and storage files |

---

## 🔒 Security & Privacy Guarantees

1. **Loopback Binding**: Backend binds to `127.0.0.1` by default to prevent unauthorized network exposure.
2. **Untrusted Prompt Protection**: System prompt strictly commands Gemma to treat documents as untrusted data and ignore embedded prompt injection commands.
3. **CSV Formula Injection Defense**: All exported cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are escaped with a prepended apostrophe (`'`).
4. **Collision & Traversal Protection**: Uploaded files receive sanitized UUID identifiers; original paths are never trusted from the client.

---

## 📄 License
MIT License.
LedgerLens – Built for freelancers, independent creators, and accounting professionals who value their privacy.
