import React, { useState, useEffect } from 'react';
import { Sidebar, type NavItem } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { UploadModal } from './components/upload/UploadModal';
import { ReviewWorkspaceModal } from './components/review/ReviewWorkspaceModal';
import { CoinRackViewer } from './components/coins/CoinRackViewer';

import { OverviewPage } from './pages/OverviewPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { VendorsPage } from './pages/VendorsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { RulesPage } from './pages/RulesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

import { api } from './api/client';
import type { OllamaStatus } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavItem>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ledgerlens_theme') !== 'light';
  });

  // 3D Coin Rack showcase toggle (starts open on first load for cinematic animation)
  const [isCoinRackOpen, setIsCoinRackOpen] = useState(true);

  // Global modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedReviewDocId, setSelectedReviewDocId] = useState<string | null>(null);

  // Status & badge counts
  const [reviewCount, setReviewCount] = useState(0);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ledgerlens_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ledgerlens_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    loadAppStatus();
    const interval = setInterval(loadAppStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const loadAppStatus = async () => {
    try {
      const [ollama, reviewDocs] = await Promise.all([
        api.getOllamaStatus().catch(() => null),
        api.getDocuments({ status: 'needs_review', limit: 1 }).catch(() => null)
      ]);
      if (ollama) setOllamaStatus(ollama);
      if (reviewDocs) setReviewCount(reviewDocs.total);
    } catch {}
  };

  const handleOpenReview = (id: string) => {
    setSelectedReviewDocId(id);
  };

  const handleCloseReview = () => {
    setSelectedReviewDocId(null);
  };

  const handleUploadSuccess = () => {
    loadAppStatus();
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <OverviewPage
            onOpenReview={handleOpenReview}
            onOpenUpload={() => setIsUploadOpen(true)}
            onNavigateTab={setCurrentTab}
            searchQuery={searchQuery}
          />
        );
      case 'invoices':
        return (
          <InvoicesPage
            onOpenReview={handleOpenReview}
            onOpenUpload={() => setIsUploadOpen(true)}
            globalSearch={searchQuery}
          />
        );
      case 'receipts':
        return (
          <ReceiptsPage
            onOpenReview={handleOpenReview}
            onOpenUpload={() => setIsUploadOpen(true)}
            globalSearch={searchQuery}
          />
        );
      case 'review':
        return (
          <ReviewQueuePage
            onOpenReview={handleOpenReview}
            onOpenUpload={() => setIsUploadOpen(true)}
            globalSearch={searchQuery}
          />
        );
      case 'vendors':
        return (
          <VendorsPage
            onOpenReview={handleOpenReview}
            globalSearch={searchQuery}
          />
        );
      case 'expenses':
        return (
          <ExpensesPage
            onOpenReview={handleOpenReview}
            globalSearch={searchQuery}
          />
        );
      case 'rules':
        return <RulesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fbfbfa] dark:bg-[#08100c] text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        reviewCount={reviewCount}
        ollamaStatus={ollamaStatus}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          currentTab={currentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          ollamaStatus={ollamaStatus}
          onOpenUpload={() => setIsUploadOpen(true)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode(prev => !prev)}
          isCoinRackOpen={isCoinRackOpen}
          onToggleCoinRack={() => setIsCoinRackOpen(prev => !prev)}
        />

        <main className="flex-1 overflow-y-auto">
          {/* Interactive 3D Coin Rack Section */}
          {isCoinRackOpen && (
            <div className="px-6 pt-5 animate-in fade-in slide-in-from-top-3 duration-200">
              <CoinRackViewer
                currentTab={currentTab}
                onSelectTab={(tab) => {
                  setCurrentTab(tab);
                }}
              />
            </div>
          )}

          {/* Active Feature View */}
          <div className="transition-all duration-200">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Review Workspace Split-Screen Modal */}
      <ReviewWorkspaceModal
        documentId={selectedReviewDocId}
        onClose={handleCloseReview}
        onRefresh={() => {
          loadAppStatus();
        }}
      />
    </div>
  );
};
export default App;
