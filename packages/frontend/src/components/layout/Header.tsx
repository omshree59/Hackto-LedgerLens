import React from 'react';
import { Search, Shield, UploadCloud, Moon, Sun, Lock } from 'lucide-react';
import type { NavItem } from './Sidebar';
import type { OllamaStatus } from '../../types';

interface HeaderProps {
  currentTab: NavItem;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  ollamaStatus: OllamaStatus | null;
  onOpenUpload: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const TAB_TITLES: Record<NavItem, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Spending trends, extraction health, and recent documents' },
  invoices: { title: 'Invoices', subtitle: 'Search, filter, and review accounts payable' },
  receipts: { title: 'Receipts', subtitle: 'Track receipts, card transactions, and reimbursements' },
  review: { title: 'Review Queue', subtitle: 'Documents requiring verification or duplicate resolution' },
  vendors: { title: 'Vendors', subtitle: 'Vendor directory, lifetime spend, and merchant profiles' },
  expenses: { title: 'Expenses', subtitle: 'Recorded financial expenses linked to source documents' },
  rules: { title: 'Automation Rules', subtitle: 'Custom conditional workflows and Gemma AI assistant' },
  reports: { title: 'Financial Reports', subtitle: 'Tax summaries, monthly breakdowns, and category exports' },
  settings: { title: 'Settings & Privacy', subtitle: 'Ollama model configuration, local storage, and database controls' },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  searchQuery,
  onSearchChange,
  ollamaStatus,
  onOpenUpload,
  isDarkMode,
  onToggleTheme
}) => {
  const current = TAB_TITLES[currentTab] || { title: 'LedgerLens', subtitle: 'Invoice Management' };

  return (
    <header className="h-16 px-6 bg-white dark:bg-[#0c1611] border-b border-slate-200 dark:border-[#193326] flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Title & Breadcrumb */}
      <div className="flex flex-col">
        <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
          {current.title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
          {current.subtitle}
        </p>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search vendor, invoice #, notes, or filename..."
          className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#1f3a2c] bg-slate-50 dark:bg-[#091510] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
        />
      </div>

      {/* Status Badges & Quick Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Privacy Shield Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium">
          <Lock className="size-3 text-emerald-600 dark:text-emerald-400" />
          <span>Local AI Inference</span>
        </div>

        {/* Ollama Model Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#11241c] border border-slate-200 dark:border-[#1d3d2e] text-[11px] text-slate-700 dark:text-slate-300 font-mono">
          <span className={`size-1.5 rounded-full ${ollamaStatus?.isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span>{ollamaStatus?.selectedModel || 'gemma3:4b'}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1f3a2c] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#11241c] transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
        </button>

        {/* Quick Upload Button */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <UploadCloud className="size-3.5" />
          <span>Import</span>
        </button>
      </div>
    </header>
  );
};
