import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Shield,
  Sliders,
  Terminal,
  Activity,
  Server
} from 'lucide-react';
import { api } from '../api/client';
import { WorkspaceCard } from '../components/reactbits/WorkspaceCard';
import type { OllamaStatus } from '../types';

export const LocalAiPage: React.FC = () => {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [selectedModelInput, setSelectedModelInput] = useState('');
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Diagnostic Playground state
  const [testPrompt, setTestPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.1);
  const [isRunningInference, setIsRunningInference] = useState(false);
  const [inferenceResult, setInferenceResult] = useState<{
    response: string;
    latencyMs: number;
    evalCount?: number;
    evalDurationNs?: number;
    model: string;
  } | null>(null);
  const [inferenceError, setInferenceError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await api.getOllamaStatus();
      setStatus(res);
      setSelectedModelInput(res.selectedModel || 'gemma3:4b');
    } catch (err: any) {
      setStatus({
        isOnline: false,
        models: [],
        selectedModel: 'gemma3:4b',
        modelFound: false,
        error: err.message || 'Failed to reach Ollama'
      });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleModelSwitch = async (modelName: string) => {
    setIsUpdatingModel(true);
    setStatusMessage(null);
    try {
      const res = await api.setOllamaModel(modelName);
      if (res.success) {
        setSelectedModelInput(modelName);
        setStatusMessage(`Active model switched to "${modelName}"`);
        await fetchStatus();
      }
    } catch (err: any) {
      setStatusMessage(`Failed to switch model: ${err.message}`);
    } finally {
      setIsUpdatingModel(false);
    }
  };

  const handleRunInference = async () => {
    if (!testPrompt.trim()) return;
    setIsRunningInference(true);
    setInferenceError(null);
    setInferenceResult(null);

    try {
      const res = await api.testPrompt(testPrompt, selectedModelInput, temperature);
      setInferenceResult(res);
    } catch (err: any) {
      setInferenceError(err.message || 'Inference execution failed');
    } finally {
      setIsRunningInference(false);
    }
  };

  return (
    <div className="p-6 lg:px-10 w-full h-full min-h-0 flex-1 flex flex-col overflow-y-auto gap-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#071b19] via-[#0b1714] to-[#071b19] border border-emerald-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Local AI Inference Hub
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Gemma 3:4b
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                100% On-device privacy • Zero cloud API calls • Local Ollama endpoint
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={isLoadingStatus}
            className="px-3.5 py-2 rounded-xl bg-[#11241f] hover:bg-[#18332c] border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className={`size-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
          <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            status?.isOnline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span className={`size-2 rounded-full ${status?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {status?.isOnline ? 'Ollama Online' : 'Ollama Offline'}
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid: Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Connection Health */}
        <WorkspaceCard surface="#091513" spotlightColor="#00D6A0" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Engine Connectivity</span>
            <Server className="size-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            {status?.isOnline ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> Ready for Inference
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="size-4" /> Unreachable
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Endpoint: http://127.0.0.1:11434
          </div>
        </WorkspaceCard>

        {/* Card 2: Active Model */}
        <WorkspaceCard surface="#091513" spotlightColor="#B45BFF" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Configured Model</span>
            <Sparkles className="size-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2 font-mono">
            {status?.selectedModel || 'gemma3:4b'}
          </div>
          <div className="text-xs text-slate-400">
            {status?.modelFound ? (
              <span className="text-emerald-400">✓ Installed in local weights</span>
            ) : (
              <span className="text-amber-400">⚠ Not yet installed (`ollama pull`)</span>
            )}
          </div>
        </WorkspaceCard>

        {/* Card 3: Privacy Shield */}
        <WorkspaceCard surface="#091513" spotlightColor="#14b8a6" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Privacy Architecture</span>
            <Shield className="size-4 text-teal-400" />
          </div>
          <div className="text-lg font-bold text-white">
            Zero External Leaks
          </div>
          <div className="text-xs text-slate-400">
            OCR and LLM extraction run locally on host RAM/VRAM.
          </div>
        </WorkspaceCard>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Discovered Models & Configuration (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Discovered Models Card */}
          <WorkspaceCard spotlightColor="#00D6A0" className="!p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Terminal className="size-4 text-emerald-400" />
                Local Ollama Models
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">
                {status?.models.length || 0} discovered
              </span>
            </div>

            {status?.models && status.models.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {status.models.map(m => {
                  const isCurrent = m === status.selectedModel || m.startsWith(`${status.selectedModel}:`);
                  return (
                    <div
                      key={m}
                      onClick={() => handleModelSwitch(m)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                          : 'bg-[#0e1f1c] hover:bg-[#142d28] border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`size-2.5 rounded-full ${isCurrent ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span className="text-xs font-mono font-medium">{m}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <button
                          disabled={isUpdatingModel}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2 text-xs text-slate-400">
                <p>No models found or Ollama service is stopped.</p>
                <div className="p-2 rounded bg-black/60 font-mono text-[11px] text-emerald-300 select-all">
                  ollama pull gemma3:4b
                </div>
              </div>
            )}

            {/* Quick manual model input */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <label className="text-xs text-slate-400">Or type custom model name:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedModelInput}
                  onChange={e => setSelectedModelInput(e.target.value)}
                  placeholder="e.g. gemma3:4b, llama3.2"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#050a0b] border border-slate-700 text-white text-xs font-mono focus:border-emerald-500 outline-none"
                />
                <button
                  onClick={() => handleModelSwitch(selectedModelInput)}
                  disabled={isUpdatingModel || !selectedModelInput.trim()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </WorkspaceCard>

          {/* Model Inference Settings */}
          <WorkspaceCard spotlightColor="#B45BFF" className="!p-6 space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sliders className="size-4 text-emerald-400" />
              Inference Parameters
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-200">
                <span>Temperature (Determinism)</span>
                <span className="font-mono text-emerald-400 font-extrabold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] font-semibold text-slate-300">
                Low temperature (0.05 - 0.15) provides strictly deterministic accounting JSON extractions with zero hallucination.
              </p>
            </div>
          </WorkspaceCard>
        </div>

        {/* Right Column: Live Diagnostic Playground (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <WorkspaceCard spotlightColor="#14b8a6" className="!p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Activity className="size-4 text-emerald-400" />
                Live Inference Playground
              </h2>
              {testPrompt && (
                <button
                  onClick={() => setTestPrompt('')}
                  className="text-[11px] text-slate-400 hover:text-emerald-400 underline cursor-pointer"
                >
                  Clear Prompt
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">Prompt Test String</label>
              <textarea
                value={testPrompt}
                onChange={e => setTestPrompt(e.target.value)}
                placeholder="Type your own prompt or paste text from one of your invoices to test local Gemma inference..."
                rows={3}
                className="w-full p-3 rounded-xl bg-[#050a0b] border border-slate-700 text-white font-mono text-xs focus:border-emerald-500 outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-slate-400">
                Target Model: <span className="font-mono text-emerald-300">{selectedModelInput}</span>
              </div>
              <button
                onClick={handleRunInference}
                disabled={isRunningInference || !testPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isRunningInference ? (
                  <>
                    <Zap className="size-4 animate-spin" />
                    <span>Running Inference...</span>
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-white" />
                    <span>Run Inference Benchmark</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Display */}
            {inferenceError && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-4" /> Inference Failed
                </div>
                <div>{inferenceError}</div>
              </div>
            )}

            {/* Inference Result Display */}
            {inferenceResult && (
              <div className="p-4 rounded-xl bg-[#050a0b] border border-emerald-500/40 shadow-inner space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" /> Model Output
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                    <span>Latency: <strong className="text-emerald-300">{inferenceResult.latencyMs}ms</strong></span>
                    {inferenceResult.evalCount && (
                      <span>Tokens: <strong className="text-emerald-300">{inferenceResult.evalCount}</strong></span>
                    )}
                  </div>
                </div>

                <pre className="text-xs font-mono text-emerald-200/90 whitespace-pre-wrap overflow-x-auto max-h-64 p-2 bg-[#020506] rounded-lg border border-emerald-500/20">
                  {inferenceResult.response}
                </pre>
              </div>
            )}
          </WorkspaceCard>
        </div>
      </div>
    </div>
  );
};
