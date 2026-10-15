# LedgerLens 🔍🪙

> **"Your invoices, organized. Your data, yours."**  
> *A premium, local-first AI financial workspace with an immersive 3D coin conveyor navigation experience, inspired by InvoiceSorter.app.*

[![Local AI: Gemma 3](https://img.shields.io/badge/AI-Gemma%203%20(4B)%20via%20Ollama-emerald?style=flat-square)](https://ollama.com)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20On--Device-teal?style=flat-square)](#-privacy--security-guarantees)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite%20(better--sqlite3)-blue?style=flat-square)](https://sqlite.org)
[![Engine: Three.js 60FPS](https://img.shields.io/badge/3D%20Engine-Three.js%20(60%20FPS)-purple?style=flat-square)](#-3d-coin-conveyor--camera-controls)
[![Test Suite: 10/10 Passing](https://img.shields.io/badge/Tests-10%2F10%20Passing-success?style=flat-square)](#-testing--quality-assurance)

---

## 🎯 Who Is LedgerLens For?

LedgerLens was crafted for individuals and organizations who manage high volumes of invoices, bills, and receipts, but **refuse to compromise their financial privacy** by sending documents to third-party cloud AI vendors:

- **Independent Freelancers & Solopreneurs:** Auto-extract client billing information, track deductible expense slips, and maintain organized records for tax season without manual data entry.
- **Small Business Owners & Agency Founders:** Streamline accounts payable, monitor vendor spend distributions, and catch duplicate billings before money leaves the bank.
- **CPAs, Bookkeepers & Accounting Professionals:** Verify high-stakes financial data using human-in-the-loop side-by-side verification with field-level confidence scores.
- **Privacy-First Creators:** Protect sensitive banking details, client contracts, and vendor tax IDs entirely on localhost—zero external telemetry, zero subscription fees.

---

## 💡 The Core Differentiator: 100% Private Local AI

Traditional invoice SaaS products upload your private bank statements and vendor invoices to remote cloud APIs (OpenAI, AWS Textract, Google Cloud). **LedgerLens keeps every byte on your computer**:

| Feature | Typical Cloud SaaS | LedgerLens |
| :--- | :--- | :--- |
| **Inference Location** | Remote Cloud Servers | **100% Localhost (`127.0.0.1:11434`)** |
| **AI Model** | Proprietary Cloud Models | **Google Gemma 3 (4B) via Ollama** |
| **File Storage** | Cloud S3 Buckets | **Local Encrypted/Private Directory** |
| **Database** | Multi-tenant Remote Cloud | **Single-Tenant Local SQLite (`WAL` mode)** |
| **Recurring AI Costs** | Monthly Subscriptions & Token Fees | **Free & Unlimited Local Compute** |
| **Data Privacy** | Subject to third-party terms | **Absolute Zero Network Leaks** |

---

## 🪙 3D Coin Conveyor Navigation Paradigm

Instead of a generic, cluttered dashboard layout, LedgerLens introduces an **immersive 3D tactile conveyor experience**:

```
[ STATE A: 3D Coin Conveyor ] ──(Click / Space / Enter)──> [ STATE B: Full-Screen Workspace ]
              ▲                                                               │
              └──────────────(Return via Esc / Floating HUD)──────────────────┘
```

### State A: The Immersive Conveyor
- **Cinematic Atmosphere:** Diagonal metallic conveyor rack set in an obsidian environment (`#050A0B`) with teal (`#00D6A0`) and electric violet (`#B45BFF`) edge neon and soft volumetric lighting.
- **10 Collectible Metallic Feature Coins:** Each token features physical thickness, knurled fluted rims, engraved badge symbols, and embossed typography.
- **Interactive 360° Orbiting:** Rotate horizontally and vertically around the scene, zoom from overview to macro detail, and pan freely.
- **Session-Persisted Coin Pickup:** Selecting a feature physically elevates the coin out of its slot. Returning to the conveyor shows an empty recessed slot with a faint ambient glow, with an explicit **Restore Coins** button available.

### State B: The Sidebar-Free Workspace
- **Distraction-Free Focus:** The selected feature takes over the entire viewport with no permanent sidebar eating screen real estate.
- **Glass Top HUD:** Minimal floating controller featuring `← Return to Conveyor [Esc]`, active workspace selector, quick search, Ollama engine health status, and quick `+ Import Invoices` CTA.

---

## 🌟 The 10 Feature Workspaces

| Coin # | Feature | Accent Color | Description |
| :---: | :--- | :--- | :--- |
| **1** | **Overview** | `#00D6A0` Emerald | Financial analytics, monthly spending trends, category distributions, and real-time document counters. |
| **2** | **Invoices** | `#B45BFF` Violet | Accounts payable inbox with OCR confidence badges, payment status filters, and bulk operations. |
| **3** | **Receipts** | `#3185FF` Blue | Dedicated expense slip registry with merchant parsing, payment method badges, and currency normalizer. |
| **4** | **Review Queue** | `#FFB000` Amber | High-priority human-in-the-loop review for low-confidence extractions and duplicate candidates. |
| **5** | **Vendors** | `#06B6D4` Cyan | Merchant profiles, aggregated lifetime spend metrics, average invoice sizes, and vendor deduplication merging. |
| **6** | **Expenses** | `#059669` Green | Single-source recorded business expenses linked directly to verified source documents. |
| **7** | **Automation Rules** | `#7B35FF` Purple | Custom conditional rules (AND/OR logic) with a **Gemma natural language rule translator**. |
| **8** | **Reports** | `#2563EB` Deep Blue | Annual tax & VAT breakdowns, sanitized RFC 4180 CSV exports, and automated local folder file reorganization. |
| **9** | **Local AI Hub** | `#68FFE0` Mint | On-device model discovery, temperature determinism sliders, latency benchmarks, and live prompt testing playground. |
| **10** | **Settings** | `#94A3B8` Silver | Local SQLite database maintenance, storage metrics, custom expense categories, and system reset controls. |

---

## 🛠️ Technology Stack

- **Frontend:**
  - **Framework:** React 19 + TypeScript
  - **Build Tool:** Vite
  - **Styling:** Tailwind CSS v4
  - **3D Graphics:** Three.js + OrbitControls (custom 60 FPS frame-independent damping)
  - **Charts & Motion:** Recharts, Framer Motion, Lucide Icons
- **Backend:**
  - **Runtime:** Node.js (ES Modules)
  - **Server Framework:** Express + TypeScript + `tsx`
  - **Database:** SQLite via `better-sqlite3` (WAL mode enabled)
  - **Validation:** Zod schemas
  - **Document Processing:** Tesseract.js (local OCR), `unpdf`, `pdf-parse`, and `pdf-lib`
  - **Hashing:** Cryptographic SHA-256 for instant bit-for-bit duplicate detection
- **Local AI:**
  - **Engine:** Ollama running locally at `http://127.0.0.1:11434`
  - **Model:** `gemma3:4b` (Google Gemma 3 4B parameters)
  - **Extraction:** Deterministic JSON schema prompting with strict null-fallback parsing

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` installed
- **Ollama**: Download and install from [ollama.com](https://ollama.com)

### 2. Pull the Local Gemma Model
Open your terminal and pull the default model:
```bash
ollama pull gemma3:4b
```

Ensure Ollama is running (it typically starts automatically in the system tray, or you can run):
```bash
ollama serve
```

### 3. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/ledgerlens.git
cd ledgerlens
npm install
```

### 4. Running the Application

You can start both frontend and backend concurrently from the root directory:

```bash
# Starts Express backend (port 3001) and Vite frontend (port 5173) concurrently:
npm run dev
```

Alternatively, you can run services individually:

#### Starting the Backend:
```bash
# From project root:
npm run dev:backend

# Or from inside packages/backend:
cd packages/backend
npm run dev
```
*Backend runs at:* **`http://127.0.0.1:3001`**

#### Starting the Frontend:
```bash
# From project root:
npm run dev:frontend

# Or from inside packages/frontend:
cd packages/frontend
npm run dev
```
*Frontend runs at:* **`http://localhost:5173/`**

---

## 🎮 3D Conveyor Controls & Cheat Sheet

The 3D environment supports full mouse, trackpad, touch, and keyboard interactions:

| Action | Control / Gesture | Description |
| :--- | :--- | :--- |
| **Orbit 360°** | `Left-Click + Drag` | Rotate around the conveyor from any angle or elevation. |
| **Zoom In / Out** | `Mouse Wheel` / `Pinch` | Smoothly zoom in for macro coin inspection or out for rack overview. |
| **Pan Camera** | `Right-Click + Drag` | Pan camera focus across the conveyor plane. |
| **Select Coin** | `Single Click` / `Enter` | Elevates the coin and opens its full-screen workspace. |
| **Focus Coin** | `Double Click` | Dollies the camera directly in front of the clicked coin. |
| **Slide Conveyor** | `←` / `→` or `A` / `D` | Smoothly slides the conveyor to neighboring coins. |
| **Camera Presets** | `Keys 1, 2, 3, 4` | Instant smooth transition: `1` Cinematic, `2` Front, `3` Top, `4` Isometric. |
| **Reset Camera** | `Key R` | Restores the default cinematic perspective view. |
| **Return to Conveyor**| `Esc` | Returns from any workspace back to the 3D coin conveyor. |
| **Restore Coins** | `Alt + R` | Restores all picked-up coins back to their conveyor slots. |

---

## 🔬 Split-Screen Human Review Workspace

For documents requiring verification or duplicate resolution:
1. **Side-by-Side Visual Inspection:** High-fidelity pan-and-zoom preview of original PDF or image on the left; structured fields on the right.
2. **Confidence Scores & Warnings:** Field-level indicators highlighting low-confidence values, missing due dates, or unverified tax amounts.
3. **Editable Line Items:** Add, remove, or modify extracted line items with quantity, unit price, and automatic subtotal calculation.
4. **One-Click Approval:** Instantly converts approved invoices into verified Expense records, updating vendor profiles and monthly spend totals.

---

## 🧪 Testing & Quality Assurance

Run the comprehensive automated Vitest test suite covering extraction, validation, duplicate detection, and rule execution:

```bash
# Run backend test suite:
npm run test

# Run production build checks:
npm run build
```

---

## 🔒 Privacy & Security Guarantees

1. **Local Loopback Only:** Express and SQLite exclusively bind to `127.0.0.1` by default, preventing unintended network exposure.
2. **Prompt Injection Hardening:** The extraction engine treats raw OCR document text as untrusted data with strict system prompt boundaries, preventing embedded text commands from hijacking model output.
3. **CSV Formula Injection Sanitization:** Exported CSV cells starting with sensitive formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading apostrophe (`'`).
4. **Collision-Proof Storage:** Uploaded files are renamed using cryptographic UUIDs and validated against allowed MIME types (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`).

---

## 📡 REST API Quick Reference

| Endpoint | Method | Purpose |
| :--- | :---: | :--- |
| `/api/health` | `GET` | Health check and database connection status |
| `/api/ollama/status` | `GET` | Ollama connectivity and discovered model weights |
| `/api/ollama/test-prompt` | `POST` | Measure inference latency and token output |
| `/api/documents/upload` | `POST` | Multi-file upload with OCR and SHA-256 deduplication |
| `/api/documents` | `GET` | Paginated and filtered invoice/receipt documents |
| `/api/documents/:id` | `GET` / `PUT` | Read detail or update human corrections |
| `/api/documents/:id/approve` | `POST` | Approve document and create synchronized expense entry |
| `/api/documents/bulk` | `POST` | Bulk approve, categorize, or delete items |
| `/api/vendors` | `GET` | Merchant directory with spend aggregation |
| `/api/vendors/merge` | `POST` | Merge duplicate vendors and reassign documents |
| `/api/rules` | `GET` / `POST` | Create and list conditional automation workflows |
| `/api/rules/assistant` | `POST` | Natural language rule synthesis via Gemma |
| `/api/export/csv` | `GET` | Sanitized RFC 4180 spreadsheet export |
| `/api/export/organize` | `POST` | Reorganize files into `Invoices/YYYY/MM/Vendor.pdf` |

---

## 📄 License

Distributed under the **MIT License**.

*Built for freelancers, independent creators, and accounting professionals who value their privacy.*
