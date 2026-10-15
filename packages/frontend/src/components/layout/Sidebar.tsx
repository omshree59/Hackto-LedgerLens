import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  AlertCircle,
  Building2,
  Wallet,
  Sparkles,
  BarChart3,
  Settings,
  ShieldCheck,
  Cpu,
  ArrowUpRight
} from 'lucide-react';
import type { NavItem, OllamaStatus } from '../../types';

export type { NavItem };

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  reviewCount: number;
  ollamaStatus: OllamaStatus | null;
  onOpenUpload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  reviewCount,
  ollamaStatus,
  onOpenUpload
}) => {
  const navItems = [
    { id: 'overview' as NavItem, label: 'Overview', icon: LayoutDashboard },
    { id: 'invoices' as NavItem, label: 'Invoices', icon: FileText },
    { id: 'receipts' as NavItem, label: 'Receipts', icon: Receipt },
    {
      id: 'review' as NavItem,
      label: 'Review Queue',
      icon: AlertCircle,
      badge: reviewCount > 0 ? reviewCount : undefined
    },
    { id: 'vendors' as NavItem, label: 'Vendors', icon: Building2 },
    { id: 'expenses' as NavItem, label: 'Expenses', icon: Wallet },
    { id: 'rules' as NavItem, label: 'Automation Rules', icon: Sparkles },
    { id: 'reports' as NavItem, label: 'Reports', icon: BarChart3 },
    { id: 'settings' as NavItem, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#091510] text-slate-300 flex flex-col border-r border-[#152e23] shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 gap-3 border-b border-[#152e23]">
        <div className="size-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 font-bold">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        </div>
        <div>
          <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
            Ledger<span className="text-emerald-400">Lens</span>
          </div>
          <p className="text-[10px] text-emerald-400/80 font-medium tracking-wide uppercase">Local AI Accounting</p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-4">
        <button
          onClick={onOpenUpload}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#091510] font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] cursor-pointer"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Import Invoices
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-emerald-500/60">
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-[#11241c]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`size-4.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Local AI Engine Status card */}
      <div className="p-3 border-t border-[#152e23]">
        <div className="p-3 rounded-xl bg-[#0e2118] border border-[#1b3b2c] text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <Cpu className="size-3.5 text-emerald-400" />
              Local AI Engine
            </span>
            <span className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${ollamaStatus?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                {ollamaStatus?.isOnline ? 'Online' : 'Offline'}
              </span>
            </span>
          </div>
          <div className="text-[11px] font-mono text-emerald-400/90 truncate mb-1">
            {ollamaStatus?.selectedModel || 'gemma3:4b'}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>100% On-device privacy</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
