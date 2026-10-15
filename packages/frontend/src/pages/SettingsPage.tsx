import React, { useState, useEffect } from 'react';
import {
  Shield,
  Cpu,
  Database,
  HardDrive,
  FolderSync,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderCheck,
  Lock,
  ExternalLink
} from 'lucide-react';
import { api } from '../api/client';
import { WorkspaceCard } from '../components/reactbits/WorkspaceCard';
import type { OllamaStatus } from '../types';

export const SettingsPage: React.FC = () => {
  const [settingsData, setSettingsData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemma3:4b');
  const [modelChangeStatus, setModelChangeStatus] = useState<string | null>(null);
  const [organizeResult, setOrganizeResult] = useState<{ message: string; destination: string } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSettings();
      setSettingsData(res);
      if (res.ollama?.selectedModel) {
        setSelectedModel(res.ollama.selectedModel);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    try {
      await api.setOllamaModel(newModel);
      setModelChangeStatus(`Model changed to ${newModel}`);
      loadSettings();
      setTimeout(() => setModelChangeStatus(null), 3000);
    } catch (err: any) {
      setModelChangeStatus(`Failed to update model: ${err.message}`);
    }
  };

  const handleOrganizeFiles = async () => {
    setActionFeedback(null);
    try {
      const res = await api.organizeLocalFiles();
      setOrganizeResult(res);
      setActionFeedback({ type: 'success', text: res.message });
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'File organization failed' });
    }
  };

  const handleSeedDemo = async () => {
    setActionFeedback(null);
    try {
      await api.seedDemo();
      setActionFeedback({ type: 'success', text: 'Realistic demo records seeded successfully (labeled Demo)' });
      loadSettings();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Demo seed failed' });
    }
  };

  const handleResetData = async () => {
    const confirm = window.prompt('WARNING: This will permanently delete all stored invoices, expenses, vendors, and files on disk.\nType "RESET_ALL_DATA" to proceed:');
    if (confirm !== 'RESET_ALL_DATA') {
      alert('Reset canceled. Confirmation text did not match.');
      return;
    }

    try {
      await api.resetAllData();
      setActionFeedback({ type: 'success', text: 'All application records and local files have been reset.' });
      loadSettings();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Reset failed' });
    }
  };

  const ollama = settingsData?.ollama as OllamaStatus | undefined;
  const storage = settingsData?.storage;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Privacy & Local AI Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage local Gemma inference, inspect device storage, and control data privacy
        </p>
      </div>

      {actionFeedback && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
        }`}>
          {actionFeedback.type === 'success' ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertTriangle className="size-4 text-rose-500" />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Card 1: Local AI Engine (Gemma + Ollama) */}
      <WorkspaceCard spotlightColor="#00D6A0" className="!p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Cpu className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Local Ollama Runtime & Gemma Model</h3>
              <p className="text-xs text-slate-400">On-device inference engine running at http://127.0.0.1:11434</p>
            </div>
          </div>
          <button
            onClick={loadSettings}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            title="Refresh Ollama status"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status Box */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1e3c2c] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600 dark:text-slate-300">Connection Status</span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className={`size-2.5 rounded-full ${ollama?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={ollama?.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                {ollama?.isOnline ? 'Connected (Ollama Service Online)' : 'Disconnected (Ollama Unreachable)'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600 dark:text-slate-300">Active Inference Model</span>
            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] font-mono font-bold text-slate-800 dark:text-slate-200 text-xs"
              >
                {ollama?.models && ollama.models.length > 0 ? (
                  ollama.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))
                ) : (
                  <option value="gemma3:4b">gemma3:4b (Default)</option>
                )}
              </select>
            </div>
          </div>

          {modelChangeStatus && (
            <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px]">
              {modelChangeStatus}
            </div>
          )}

          {/* If Ollama is offline, show helpful terminal command */}
          {!ollama?.isOnline && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">Ollama service was not detected on localhost.</p>
              <p>To run Ollama on your machine, open your terminal and run:</p>
              <code className="block p-1.5 rounded bg-black/80 text-emerald-400 font-mono text-[10px]">
                ollama serve
              </code>
              <code className="block p-1.5 rounded bg-black/80 text-emerald-400 font-mono text-[10px]">
                ollama pull gemma3:4b
              </code>
            </div>
          )}
        </div>
      </WorkspaceCard>

      {/* Card 2: Local Storage & Organization */}
      <WorkspaceCard spotlightColor="#3b82f6" className="!p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <HardDrive className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Local Storage & File Organization</h3>
            <p className="text-xs text-slate-400">All original PDFs, OCR text, and SQLite records reside on this machine</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1e3c2c]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Original Documents</span>
            <span className="text-base font-mono font-bold text-slate-900 dark:text-white">
              {storage?.uploadFilesCount ?? 0} files
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">({storage?.uploadSizeMb ?? '0.00'} MB disk space)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1e3c2c]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">SQLite Database</span>
            <span className="text-base font-mono font-bold text-slate-900 dark:text-white">
              {storage?.dbSizeMb ?? '0.00'} MB
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Indexed local tables & schema</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1e3c2c]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Local Data Path</span>
            <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all block mt-1">
              {storage?.dataDir}
            </span>
          </div>
        </div>

        {/* Organize into folders button */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1e3c2c] flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <FolderSync className="size-3.5 text-emerald-500" />
              <span>Organize Invoices into Local Monthly Folders</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Copies and renames approved documents into structured paths (e.g. Invoices/2026/10/Vendor_Number.pdf)
            </p>
          </div>
          <button
            onClick={handleOrganizeFiles}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            Run Organization
          </button>
        </div>

        {organizeResult && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <span className="font-bold">{organizeResult.message}</span>
            <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              Path: {organizeResult.destination}
            </p>
          </div>
        )}
      </WorkspaceCard>

      {/* Card 3: Privacy Guarantee */}
      <WorkspaceCard spotlightColor="#14b8a6" className="!p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Lock className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Privacy Architecture</h3>
            <p className="text-xs text-slate-400">Strict local containment guarantees</p>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <p>
            • <strong>No External AI Endpoints:</strong> LedgerLens does not send prompts, invoice images, or metadata to OpenAI, Google Cloud, Anthropic, or any remote server.
          </p>
          <p>
            • <strong>Local File Storage:</strong> Uploaded PDFs and images are saved directly in your private data folder and accessed strictly via loopback (127.0.0.1).
          </p>
          <p>
            • <strong>No Telemetry by Default:</strong> No tracking cookies, usage analytics, or external trackers are initialized.
          </p>
        </div>
      </WorkspaceCard>

      {/* Card 4: Demo Data & Danger Zone */}
      <WorkspaceCard spotlightColor="#f43f5e" className="!p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Data Management</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Seed Demo Data */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-[#1e3c2c] space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-emerald-500" />
              <span>Load Realistic Demo Data</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Populates realistic freelancer & business invoices (Cloudflare, AWS, Apple, etc.) clearly tagged as Demo.
            </p>
            <button
              onClick={handleSeedDemo}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold cursor-pointer"
            >
              Seed Demo Records
            </button>
          </div>

          {/* Reset All Data */}
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10 space-y-2">
            <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <Trash2 className="size-3.5" />
              <span>Reset All Records</span>
            </h4>
            <p className="text-slate-400 text-[11px]">
              Permanently purges all database tables, OCR records, expenses, and deletes uploaded files on disk.
            </p>
            <button
              onClick={handleResetData}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
            >
              Reset Application Data
            </button>
          </div>
        </div>
      </WorkspaceCard>
    </div>
  );
};
