import type { NavItem } from '../../types';

export interface CoinFeature {
  id: NavItem;
  name: string;
  subtext: string;
  color: string;       // Rim & glow accent color
  faceColor: string;   // Face background color
  textColor: string;   // Text label color
  ledColor: string;    // Pedestal LED color
  badgeIcon: string;   // Short symbol or icon
  description: string;
}

export const COIN_FEATURES: CoinFeature[] = [
  {
    id: 'overview',
    name: 'Overview',
    subtext: 'Analytics & KPIs',
    color: '#00D6A0',
    faceColor: '#061a15',
    textColor: '#F2F7F5',
    ledColor: '#00D6A0',
    badgeIcon: '⊞',
    description: 'Executive financial dashboard with spend trends, categorized summaries, and real-time KPIs.'
  },
  {
    id: 'invoices',
    name: 'Invoices',
    subtext: 'Accounts Payable',
    color: '#B45BFF',
    faceColor: '#180a2b',
    textColor: '#F2F7F5',
    ledColor: '#B45BFF',
    badgeIcon: '📄',
    description: 'Full-featured accounts payable registry with OCR confidence badges and fast payment tracking.'
  },
  {
    id: 'receipts',
    name: 'Receipts',
    subtext: 'Expense Slips',
    color: '#3185FF',
    faceColor: '#09182f',
    textColor: '#F2F7F5',
    ledColor: '#3185FF',
    badgeIcon: '🧾',
    description: 'Instant slip categorization, merchant parsing, and multi-currency exchange conversion.'
  },
  {
    id: 'review',
    name: 'Review Queue',
    subtext: 'Verification AI',
    color: '#FFB000',
    faceColor: '#261803',
    textColor: '#F2F7F5',
    ledColor: '#FFB000',
    badgeIcon: '⚠',
    description: 'Side-by-side document verification workspace for low-confidence fields and duplicate collisions.'
  },
  {
    id: 'vendors',
    name: 'Vendors',
    subtext: 'Merchant Profiles',
    color: '#06B6D4',
    faceColor: '#061c24',
    textColor: '#F2F7F5',
    ledColor: '#06B6D4',
    badgeIcon: '🏢',
    description: 'Merchant directory with historical spend aggregations, contact details, and vendor deduplication.'
  },
  {
    id: 'expenses',
    name: 'Expenses',
    subtext: 'Ledger Records',
    color: '#059669',
    faceColor: '#041f15',
    textColor: '#F2F7F5',
    ledColor: '#059669',
    badgeIcon: '💳',
    description: 'Recorded business expenses linked to verified source documents with one-click export.'
  },
  {
    id: 'rules',
    name: 'Automation',
    subtext: 'Gemma Workflows',
    color: '#7B35FF',
    faceColor: '#190b30',
    textColor: '#F2F7F5',
    ledColor: '#7B35FF',
    badgeIcon: '✦',
    description: 'Automated categorization and threshold rules interpreted and created by local Gemma AI.'
  },
  {
    id: 'reports',
    name: 'Reports',
    subtext: 'Tax & Subtotals',
    color: '#2563EB',
    faceColor: '#081630',
    textColor: '#F2F7F5',
    ledColor: '#2563EB',
    badgeIcon: '📊',
    description: 'Annual fiscal reports, deductible tax calculations, and local folder file reorganization.'
  },
  {
    id: 'local_ai',
    name: 'Local AI',
    subtext: 'Ollama & Gemma Hub',
    color: '#68FFE0',
    faceColor: '#041c19',
    textColor: '#F2F7F5',
    ledColor: '#68FFE0',
    badgeIcon: '⚙',
    description: 'Live AI diagnostic playground, on-device model weights, latency benchmarks, and privacy controls.'
  },
  {
    id: 'settings',
    name: 'Settings',
    subtext: 'Privacy & Storage',
    color: '#94A3B8',
    faceColor: '#141c24',
    textColor: '#F2F7F5',
    ledColor: '#94A3B8',
    badgeIcon: '🛡',
    description: 'Local SQLite database management, storage metrics, category taxonomies, and system backups.'
  }
];
