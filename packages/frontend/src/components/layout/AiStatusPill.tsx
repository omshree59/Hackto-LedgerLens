import React from 'react';
import type { OllamaStatus } from '../../types';

interface AiStatusPillProps {
  /** null = first check still in flight, false = API unreachable, true = API reachable */
  backendOnline: boolean | null;
  ollamaStatus: OllamaStatus | null;
  isStarting?: boolean;
  onStartOllama?: () => void;
  className?: string;
}

type PillState = {
  dot: string;
  label: string;
  text: string;
  hint: string;
  clickable: boolean;
};

function describe(
  backendOnline: boolean | null,
  ollama: OllamaStatus | null,
  isStarting: boolean
): PillState {
  if (backendOnline === null) {
    return { dot: 'bg-slate-400 animate-pulse', label: 'Backend', text: 'Connecting…', hint: 'Checking the LedgerLens API', clickable: false };
  }
  if (!backendOnline) {
    return {
      dot: 'bg-rose-500',
      label: 'Backend',
      text: 'Offline',
      hint: 'API not reachable on port 3001. Start it with `npm run dev` in packages/backend. Retrying automatically.',
      clickable: false
    };
  }
  if (isStarting) {
    return { dot: 'bg-amber-400 animate-pulse', label: 'Ollama', text: 'Starting…', hint: 'Launching `ollama serve`', clickable: false };
  }
  if (!ollama?.isOnline) {
    return {
      dot: 'bg-amber-400',
      label: 'Ollama',
      text: 'Offline · Start',
      hint: 'Backend is connected, but Ollama is not running. Click to start it.',
      clickable: true
    };
  }
  const model = ollama.selectedModel || 'gemma3:4b';
  if (!ollama.modelFound) {
    return {
      dot: 'bg-amber-400',
      label: model,
      text: 'Not installed',
      hint: `Run: ollama pull ${model}`,
      clickable: false
    };
  }
  return { dot: 'bg-emerald-400 animate-pulse', label: model, text: 'Active', hint: 'Local AI is ready', clickable: false };
}

/** Single source of truth for the "is the AI stack connected" indicator. */
export const AiStatusPill: React.FC<AiStatusPillProps> = ({
  backendOnline,
  ollamaStatus,
  isStarting = false,
  onStartOllama,
  className = ''
}) => {
  const s = describe(backendOnline, ollamaStatus, isStarting);
  const textColor =
    s.dot.includes('emerald') ? 'text-emerald-400'
    : s.dot.includes('rose') ? 'text-rose-400'
    : s.dot.includes('amber') ? 'text-amber-300'
    : 'text-slate-300';

  const body = (
    <>
      <span className={`size-2 rounded-full ${s.dot}`} />
      <span className="text-slate-300">{s.label}</span>
      <span className={`${textColor} font-semibold`}>{s.text}</span>
    </>
  );

  if (s.clickable && onStartOllama) {
    return (
      <button
        type="button"
        onClick={onStartOllama}
        title={s.hint}
        className={`${className} cursor-pointer hover:border-amber-400/60 transition-colors`}
      >
        {body}
      </button>
    );
  }

  return (
    <div title={s.hint} className={className}>
      {body}
    </div>
  );
};
