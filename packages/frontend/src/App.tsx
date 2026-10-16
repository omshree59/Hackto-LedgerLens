import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { NavItem, OllamaStatus } from './types';
import { CoinRackViewer, COIN_FEATURES } from './components/coins/CoinRackViewer';
import { UploadModal } from './components/upload/UploadModal';
import { ReviewWorkspaceModal } from './components/review/ReviewWorkspaceModal';
import { AiStatusPill } from './components/layout/AiStatusPill';

import { OverviewPage } from './pages/OverviewPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { VendorsPage } from './pages/VendorsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { RulesPage } from './pages/RulesPage';
import { ReportsPage } from './pages/ReportsPage';
import { LocalAiPage } from './pages/LocalAiPage';
import { SettingsPage } from './pages/SettingsPage';

import { api } from './api/client';
import {
  ArrowLeft,
  UploadCloud,
  Search,
  Sun,
  Moon,
  ChevronDown,
  Layers,
  Sparkles,
  RotateCcw
} from 'lucide-react';

export const App: React.FC = () => {
  // Application Mode: 'conveyor' (State A) or 'workspace' (State B)
  const [appMode, setAppMode] = useState<'conveyor' | 'workspace'>('conveyor');
  const [currentTab, setCurrentTab] = useState<NavItem>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Removed coins persistence during session (empty slot on conveyor)
  const [removedCoins, setRemovedCoins] = useState<string[]>([]);

  // Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ledgerlens_theme') !== 'light';
  });

  // Global modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedReviewDocId, setSelectedReviewDocId] = useState<string | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  // Status & badge counts
  const [reviewCount, setReviewCount] = useState(0);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [isStartingOllama, setIsStartingOllama] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ledgerlens_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ledgerlens_theme', 'light');
    }
  }, [isDarkMode]);

  // Poll fast (2s) while anything is down so a late-started backend/Ollama is picked up
  // immediately, then relax to 8s once everything is healthy.
  const healthyRef = useRef(false);

  const loadAppStatus = useCallback(async () => {
    const [ollama, reviewDocs] = await Promise.all([
      api.getOllamaStatus().catch(() => null),
      api.getDocuments({ status: 'needs_review', limit: 1 }).catch(() => null)
    ]);

    const reachable = ollama !== null || reviewDocs !== null;
    setBackendOnline(reachable);
    // Never keep a stale "Active" after the API goes away
    setOllamaStatus(ollama);
    if (reviewDocs) setReviewCount(reviewDocs.total);

    healthyRef.current = reachable && !!ollama?.isOnline;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      await loadAppStatus();
      if (!cancelled) timer = setTimeout(tick, healthyRef.current ? 8000 : 2000);
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadAppStatus]);

  const handleStartOllama = useCallback(async () => {
    setIsStartingOllama(true);
    try {
      const res = await api.startOllama();
      setOllamaStatus(res.status);
    } catch {
      // Status poll will report the real state
    } finally {
      setIsStartingOllama(false);
      loadAppStatus();
    }
  }, [loadAppStatus]);

  // Keyboard navigation: Escape key returns to the conveyor if no modal is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isUploadOpen && !selectedReviewDocId && appMode === 'workspace') {
          e.preventDefault();
          setAppMode('conveyor');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, isUploadOpen, selectedReviewDocId]);

  const handleSelectCoin = useCallback((tab: NavItem) => {
    // Add chosen coin to removed list (persisted during session)
    setRemovedCoins(prev => Array.from(new Set([...prev, tab])));
    setCurrentTab(tab);
    setAppMode('workspace');
  }, []);

  const handleRestoreCoins = useCallback(() => {
    setRemovedCoins([]);
  }, []);

  const activeCoinMeta = COIN_FEATURES.find(c => c.id === currentTab) || COIN_FEATURES[0];

  const renderWorkspaceContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <OverviewPage
            onOpenReview={(id) => setSelectedReviewDocId(id)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onNavigateTab={(tab) => setCurrentTab(tab as NavItem)}
            searchQuery={searchQuery}
          />
        );
      case 'invoices':
        return (
          <InvoicesPage
            onOpenReview={(id) => setSelectedReviewDocId(id)}
            onOpenUpload={() => setIsUploadOpen(true)}
            globalSearch={searchQuery}
          />
        );
      case 'receipts':
        return (
          <ReceiptsPage
            onOpenReview={(id) => setSelectedReviewDocId(id)}
            onOpenUpload={() => setIsUploadOpen(true)}
            globalSearch={searchQuery}
          />
        );
      case 'review':
        return (
          <ReviewQueuePage
            onOpenReview={(id) => setSelectedReviewDocId(id)}
            onOpenUpload={() => setIsUploadOpen(true)}
            globalSearch={searchQuery}
          />
        );
      case 'vendors':
        return (
          <VendorsPage
            onOpenReview={(id) => setSelectedReviewDocId(id)}
            globalSearch={searchQuery}
          />
        );
      case 'expenses':
        return (
          <ExpensesPage
            onOpenReview={(id) => setSelectedReviewDocId(id)}
            globalSearch={searchQuery}
          />
        );
      case 'rules':
        return <RulesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'local_ai':
        return <LocalAiPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050A0B] text-slate-100 font-sans">
      {/* ======================================================== */}
      {/* STATE A: IMMERSIVE 3D COIN CONVEYOR (Full Screen, No Sidebar) */}
      {/* ======================================================== */}
      {appMode === 'conveyor' && (
        <div className="absolute inset-0 w-full h-full z-10 animate-in fade-in zoom-in-95 duration-400">
          <CoinRackViewer
            currentTab={currentTab}
            onSelectTab={handleSelectCoin}
            removedCoins={removedCoins}
            onRestoreCoins={handleRestoreCoins}
            ollamaStatus={ollamaStatus}
            backendOnline={backendOnline}
            isStartingOllama={isStartingOllama}
            onStartOllama={handleStartOllama}
            onOpenUpload={() => setIsUploadOpen(true)}
            reviewCount={reviewCount}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* STATE B: SELECTED WORKSPACE (Full Screen, Sidebar-Free)  */}
      {/* ======================================================== */}
      {appMode === 'workspace' && (
        <div className="absolute inset-0 w-full h-full flex flex-col z-10 bg-[#050A0B] animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Top Floating Glass HUD */}
          <header className="h-16 px-6 border-b border-slate-800/80 bg-[#071310]/90 backdrop-blur-xl flex items-center justify-between shrink-0 z-20">
            {/* Left: Return to Conveyor CTA & Active Coin Pill */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAppMode('conveyor')}
                className="group px-3.5 py-2 rounded-xl bg-[#0b1b17] hover:bg-[#122e27] border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                title="Return to 3D Conveyor (Esc)"
              >
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>Return to Conveyor</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-400 font-mono hidden sm:inline">
                  Esc
                </span>
              </button>

              {/* Active Workspace Selector Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsWorkspaceMenuOpen(p => !p)}
                  className="px-3 py-1.5 rounded-xl bg-[#091512] hover:bg-[#0f231f] border flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer"
                  style={{
                    borderColor: `${activeCoinMeta.color}50`,
                    color: activeCoinMeta.textColor
                  }}
                >
                  <span
                    className="size-5 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: `${activeCoinMeta.color}25`, color: activeCoinMeta.color }}
                  >
                    {activeCoinMeta.badgeIcon}
                  </span>
                  <span>{activeCoinMeta.name}</span>
                  <ChevronDown className="size-3 text-slate-400" />
                </button>

                {/* Workspace Fast Switch Menu */}
                {isWorkspaceMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-2 w-64 p-1.5 rounded-2xl bg-[#091714] border border-slate-800 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2"
                    onMouseLeave={() => setIsWorkspaceMenuOpen(false)}
                  >
                    <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                      Switch Feature Workspace
                    </div>
                    <div className="space-y-0.5">
                      {COIN_FEATURES.map(feat => {
                        const isCurrent = feat.id === currentTab;
                        return (
                          <button
                            key={feat.id}
                            onClick={() => {
                              setCurrentTab(feat.id);
                              setRemovedCoins(prev => Array.from(new Set([...prev, feat.id])));
                              setIsWorkspaceMenuOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs text-left transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-950/60 text-white font-bold'
                                : 'text-slate-300 hover:bg-[#11241f] hover:text-white'
                            }`}
                          >
                            <span
                              className="size-5 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${feat.color}20`, color: feat.color }}
                            >
                              {feat.badgeIcon}
                            </span>
                            <span className="flex-1">{feat.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{feat.subtext}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Search Field */}
            <div className="hidden lg:flex items-center w-80 max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeCoinMeta.name.toLowerCase()}...`}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#030807] border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Right: Actions, AI Status, Quick Import, Theme */}
            <div className="flex items-center gap-3">
              {/* Backend / Ollama Status Pill */}
              <AiStatusPill
                backendOnline={backendOnline}
                ollamaStatus={ollamaStatus}
                isStarting={isStartingOllama}
                onStartOllama={handleStartOllama}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#091512] border border-slate-800 text-xs font-mono"
              />

              {/* Quick Import CTA */}
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <UploadCloud className="size-3.5" />
                <span>Import Invoices</span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setIsDarkMode(prev => !prev)}
                className="p-2 rounded-xl bg-[#091512] hover:bg-[#11241f] border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              </button>
            </div>
          </header>

          {/* Main Full-Screen Workspace Body */}
          <main className="flex-1 overflow-y-auto bg-[#050A0B] text-slate-100">
            <div key={currentTab} className="animate-in fade-in duration-200">
              {renderWorkspaceContent()}
            </div>
          </main>
        </div>
      )}

      {/* Global Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={loadAppStatus}
      />

      <ReviewWorkspaceModal
        documentId={selectedReviewDocId}
        onClose={() => setSelectedReviewDocId(null)}
        onRefresh={loadAppStatus}
      />
    </div>
  );
};

export default App;
