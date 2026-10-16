import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Eye,
  Check,
  Building2,
  Calendar,
  Hash,
  Tag
} from 'lucide-react';
import { api } from '../../api/client';
import type { DocumentDetail } from '../../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onOpenReview?: (documentId: string) => void;
}

interface TrackedUploadItem {
  id: string;
  filename: string;
  isDuplicate: boolean;
  status: string;
  progress: number;
  stageLabel: string;
  errorMessage: string | null;
  detail: DocumentDetail | null;
  approving?: boolean;
}

const TERMINAL_STATUSES = new Set(['needs_review', 'approved', 'failed', 'archived']);

function getStageLabel(status: string, progress: number, errorMsg?: string | null): string {
  if (status === 'failed') {
    return errorMsg || 'Extraction failed';
  }
  if (status === 'approved') {
    return 'Extraction complete • Approved & recorded in expenses';
  }
  if (status === 'needs_review') {
    return 'Extraction complete • Ready below';
  }
  if (progress >= 80) {
    return 'Checking duplicates & evaluating automation rules…';
  }
  if (progress >= 55) {
    return 'Running local Gemma AI structured field extraction…';
  }
  if (progress >= 35) {
    return 'Extracting text with local OCR engine…';
  }
  return 'Initializing local OCR & reading document…';
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onOpenReview
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<'invoice' | 'receipt'>('invoice');
  const [isUploading, setIsUploading] = useState(false);
  const [trackedItems, setTrackedItems] = useState<TrackedUploadItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onUploadSuccessRef = useRef(onUploadSuccess);
  onUploadSuccessRef.current = onUploadSuccess;

  const hasActiveExtractions = trackedItems.some(
    item => !TERMINAL_STATUSES.has(item.status)
  );

  // When the modal opens, load any active or recently uploaded user documents so their
  // live extraction progress and extracted results are always visible down below.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getDocuments({ limit: 5, sortBy: 'created_at', sortOrder: 'desc' });
        if (cancelled || !list.items || list.items.length === 0) return;
        const details = await Promise.all(
          list.items.map(d => api.getDocument(d.id).catch(() => null))
        );
        if (cancelled) return;
        const hydrated: TrackedUploadItem[] = list.items.map((d, idx) => {
          const detail = details[idx];
          const latestJob = detail?.jobs?.[0];
          const effectiveStatus = latestJob?.status === 'failed' ? 'failed' : d.status;
          const progress = TERMINAL_STATUSES.has(effectiveStatus)
            ? 100
            : Math.max(15, latestJob?.progress ?? 20);
          const errMsg = latestJob?.error_message || null;
          return {
            id: d.id,
            filename: d.original_filename,
            isDuplicate: Boolean(d.is_duplicate),
            status: effectiveStatus,
            progress,
            stageLabel: getStageLabel(effectiveStatus, progress, errMsg),
            errorMessage: errMsg,
            detail
          };
        });
        setTrackedItems(prev => {
          if (prev.length === 0) return hydrated;
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...hydrated.filter(h => !existingIds.has(h.id))];
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const pollTrackedDocuments = useCallback(async (items: TrackedUploadItem[]) => {
    const pending = items.filter(item => !TERMINAL_STATUSES.has(item.status));
    if (pending.length === 0) return;

    const updates = await Promise.all(
      pending.map(async (item) => {
        try {
          const detail = await api.getDocument(item.id);
          const docStatus = detail.document.status;
          const latestJob = detail.jobs?.[0];
          const jobFailed = latestJob?.status === 'failed';
          const effectiveStatus = jobFailed ? 'failed' : docStatus;
          const progress = TERMINAL_STATUSES.has(effectiveStatus)
            ? 100
            : Math.max(item.progress, latestJob?.progress ?? 20);
          const errMsg = latestJob?.error_message || null;

          return {
            id: item.id,
            status: effectiveStatus,
            progress,
            stageLabel: getStageLabel(effectiveStatus, progress, errMsg),
            errorMessage: errMsg,
            detail,
            isDuplicate: Boolean(detail.document.is_duplicate)
          };
        } catch {
          return null;
        }
      })
    );

    let anyJustFinished = false;
    setTrackedItems(prev =>
      prev.map(item => {
        const u = updates.find(x => x && x.id === item.id);
        if (!u) return item;
        if (!TERMINAL_STATUSES.has(item.status) && TERMINAL_STATUSES.has(u.status)) {
          anyJustFinished = true;
        }
        return {
          ...item,
          status: u.status,
          progress: u.progress,
          stageLabel: u.stageLabel,
          errorMessage: u.errorMessage,
          detail: u.detail,
          isDuplicate: u.isDuplicate
        };
      })
    );

    if (anyJustFinished) {
      onUploadSuccessRef.current();
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !hasActiveExtractions) return;

    const initialTimer = setTimeout(() => {
      pollTrackedDocuments(trackedItems);
    }, 350);

    const interval = setInterval(() => {
      pollTrackedDocuments(trackedItems);
    }, 900);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isOpen, hasActiveExtractions, trackedItems, pollTrackedDocuments]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const isImg = f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name);
      return isPdf || isImg;
    });

    if (validFiles.length < newFiles.length) {
      setErrorMessage('Some files were ignored because only PDF, PNG, JPG, and WEBP files are supported.');
    } else {
      setErrorMessage(null);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await api.uploadDocuments(selectedFiles, documentType);
      const initialTracked: TrackedUploadItem[] = res.documents.map(d => ({
        id: d.id,
        filename: d.filename,
        isDuplicate: d.isDuplicate,
        status: 'processing',
        progress: 15,
        stageLabel: 'Initializing local OCR & reading document…',
        errorMessage: null,
        detail: null
      }));

      setTrackedItems(prev => [...initialTracked, ...prev]);
      setSelectedFiles([]);
      onUploadSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuickApprove = async (docId: string) => {
    setTrackedItems(prev =>
      prev.map(it => (it.id === docId ? { ...it, approving: true } : it))
    );
    try {
      await api.approveDocument(docId);
      const updatedDetail = await api.getDocument(docId).catch(() => null);
      setTrackedItems(prev =>
        prev.map(it =>
          it.id === docId
            ? {
                ...it,
                approving: false,
                status: 'approved',
                stageLabel: 'Extraction complete • Approved & recorded in expenses',
                detail: updatedDetail || it.detail
              }
            : it
        )
      );
      onUploadSuccess();
    } catch (err: any) {
      setTrackedItems(prev =>
        prev.map(it => (it.id === docId ? { ...it, approving: false } : it))
      );
      setErrorMessage(err.message || 'Failed to approve document');
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setTrackedItems([]);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#1e3c2c] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1a3628] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Import Financial Documents</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Files are OCR-scanned and extracted on-device using local Gemma AI
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#152e23] cursor-pointer"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Document Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDocumentType('invoice')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  documentType === 'invoice'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-[#1a3628] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#11241c]'
                }`}
              >
                <FileText className="size-4" />
                <span>Invoice / Bill</span>
              </button>
              <button
                type="button"
                onClick={() => setDocumentType('receipt')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  documentType === 'receipt'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-[#1a3628] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#11241c]'
                }`}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                  <path d="M16 8h-6" />
                  <path d="M16 12h-6" />
                  <path d="M12 16h-2" />
                </svg>
                <span>Receipt / Expense Slip</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 scale-[0.99]'
                : 'border-slate-200 dark:border-[#1e3c2c] hover:border-emerald-500/60 hover:bg-slate-50 dark:hover:bg-[#10231b]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="size-11 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2.5">
              <UploadCloud className="size-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Click to select or drag and drop files here
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports PDF, PNG, JPG, JPEG, WEBP (up to 25MB each)
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selected Files Queued for Upload */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex justify-between">
                <span>Ready to Extract ({selectedFiles.length})</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1a3628] text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Extraction Progress & Extracted Results Down Below */}
          {trackedItems.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-[#1a3628]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="size-3.5" />
                  <span>
                    {hasActiveExtractions
                      ? 'Extracting with Local Gemma AI…'
                      : `Extraction Results (${trackedItems.length})`}
                  </span>
                </span>
                {hasActiveExtractions && (
                  <span className="text-[11px] font-mono text-amber-500 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    Processing…
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {trackedItems.map((item) => {
                  const isRunning = !TERMINAL_STATUSES.has(item.status);
                  const isFailed = item.status === 'failed';
                  const isApproved = item.status === 'approved';
                  const ext = item.detail?.extractedData;
                  const lineItems = item.detail?.lineItems || [];
                  const warnings = ext?.validation_warnings || [];
                  const ocrConf = item.detail?.document?.ocr_confidence;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border text-xs space-y-3 transition-all ${
                        isFailed
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/70'
                          : isRunning
                          ? 'bg-slate-50 dark:bg-[#0f221b] border-emerald-500/40'
                          : 'bg-slate-50 dark:bg-[#0f221b] border-slate-200 dark:border-[#1e3c2c]'
                      }`}
                    >
                      {/* Top row: filename + status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isRunning ? (
                            <Loader2 className="size-4 text-emerald-400 animate-spin shrink-0" />
                          ) : isFailed ? (
                            <AlertTriangle className="size-4 text-rose-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {item.filename}
                            </p>
                            <p className={`text-[11px] ${isFailed ? 'text-rose-400' : 'text-slate-400'}`}>
                              {item.stageLabel}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            isRunning
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : isFailed
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : isApproved
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                          }`}
                        >
                          {isRunning
                            ? `${item.progress}%`
                            : isFailed
                            ? 'Failed'
                            : isApproved
                            ? 'Approved'
                            : 'Extracted'}
                        </span>
                      </div>

                      {/* Progress bar while extracting */}
                      {isRunning && (
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#07120e] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(10, item.progress))}%` }}
                          />
                        </div>
                      )}

                      {/* Duplicate note */}
                      {item.isDuplicate && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          <span>
                            {item.detail?.document?.duplicate_reason ||
                              'Matched an existing document and was flagged as a potential duplicate.'}
                          </span>
                        </div>
                      )}

                      {/* Extracted Details Card shown right below when finished */}
                      {!isRunning && !isFailed && ext && (
                        <div className="pt-2 border-t border-slate-200/80 dark:border-[#1a3628] space-y-2.5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-white dark:bg-[#091510] p-3 rounded-xl border border-slate-200/70 dark:border-[#173024]">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <Building2 className="size-3 text-emerald-400" /> Vendor
                              </span>
                              <p className="font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                {ext.vendor_name || 'Unknown Vendor'}
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                Total Amount
                              </span>
                              <p className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {ext.total_amount !== null && ext.total_amount !== undefined
                                  ? `${ext.currency && ext.currency !== 'USD' ? `${ext.currency} ` : '$'}${Number(ext.total_amount).toFixed(2)}`
                                  : '—'}
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <Calendar className="size-3 text-emerald-400" /> Date
                              </span>
                              <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                                {ext.invoice_date || '—'}
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <Hash className="size-3 text-emerald-400" /> Invoice #
                              </span>
                              <p className="font-mono text-slate-800 dark:text-slate-200 truncate mt-0.5">
                                {ext.invoice_number || '—'}
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                <Tag className="size-3 text-emerald-400" /> Category
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 truncate mt-0.5">
                                {ext.category || 'Other'}
                              </p>
                            </div>

                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                Subtotal / Tax
                              </span>
                              <p className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                                {ext.subtotal !== null && ext.subtotal !== undefined
                                  ? `${ext.currency && ext.currency !== 'USD' ? `${ext.currency} ` : '$'}${Number(ext.subtotal).toFixed(2)}`
                                  : '—'}{' '}
                                /{' '}
                                {ext.tax_amount !== null && ext.tax_amount !== undefined
                                  ? `${ext.currency && ext.currency !== 'USD' ? `${ext.currency} ` : '$'}${Number(ext.tax_amount).toFixed(2)}`
                                  : `${ext.currency && ext.currency !== 'USD' ? `${ext.currency} ` : '$'}0.00`}
                              </p>
                            </div>
                          </div>

                          {/* Line items preview if extracted */}
                          {lineItems.length > 0 && (
                            <div className="bg-white dark:bg-[#091510] p-2.5 rounded-xl border border-slate-200/70 dark:border-[#173024]">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                                Extracted Line Items ({lineItems.length})
                              </span>
                              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                {lineItems.map((li, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300"
                                  >
                                    <span className="truncate pr-2">
                                      {li.quantity ? `${li.quantity}× ` : ''}
                                      {li.description}
                                    </span>
                                    <span className="font-mono font-semibold shrink-0">
                                      {li.total_price !== null && li.total_price !== undefined
                                        ? `${ext.currency && ext.currency !== 'USD' ? `${ext.currency} ` : '$'}${Number(li.total_price).toFixed(2)}`
                                        : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Warnings if any */}
                          {warnings.length > 0 && (
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] space-y-0.5">
                              {warnings.map((w, idx) => (
                                <div key={idx}>• {w}</div>
                              ))}
                            </div>
                          )}

                          {/* Bottom action bar for this extracted document */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-mono text-slate-400">
                              {ocrConf ? `OCR ${(ocrConf * 100).toFixed(0)}%` : ''}
                              {ext.extraction_model ? ` • ${ext.extraction_model}` : ''}
                            </span>

                            <div className="flex items-center gap-2">
                              {onOpenReview && (
                                <button
                                  type="button"
                                  onClick={() => onOpenReview(item.id)}
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-[#1e3c2c] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#152e23] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="size-3.5" />
                                  <span>Inspect / Edit</span>
                                </button>
                              )}

                              {!isApproved && (
                                <button
                                  type="button"
                                  disabled={item.approving}
                                  onClick={() => handleQuickApprove(item.id)}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {item.approving ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Check className="size-3.5" />
                                  )}
                                  <span>Approve &amp; Record Expense</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#091510] border-t border-slate-100 dark:border-[#1a3628] flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {hasActiveExtractions
              ? 'Local Gemma AI is extracting fields below…'
              : trackedItems.length > 0
              ? 'Extraction finished. Review results above or upload more files.'
              : 'All processing happens locally on your machine.'}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {trackedItems.length > 0 && selectedFiles.length === 0 ? 'Done' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading || hasActiveExtractions}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : hasActiveExtractions ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Extracting with Gemma AI…</span>
                </>
              ) : trackedItems.length > 0 && selectedFiles.length === 0 ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Extracted Below</span>
                </>
              ) : (
                <span>
                  Start Extraction{selectedFiles.length > 0 ? ` (${selectedFiles.length})` : ''}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
