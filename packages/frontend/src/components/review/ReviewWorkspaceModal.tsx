import React, { useState, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Copy,
  Plus,
  Tag,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { api } from '../../api/client';
import type { DocumentDetail, LineItem } from '../../types';

interface ReviewWorkspaceModalProps {
  documentId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const ReviewWorkspaceModal: React.FC<ReviewWorkspaceModalProps> = ({
  documentId,
  onClose,
  onRefresh
}) => {
  const [data, setData] = useState<DocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formFields, setFormFields] = useState<any>({});
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  useEffect(() => {
    if (!documentId) return;
    loadDocument(documentId);
  }, [documentId]);

  const loadDocument = async (id: string) => {
    setIsLoading(true);
    setFeedbackMessage(null);
    try {
      const docDetail = await api.getDocument(id);
      setData(docDetail);

      const ext = docDetail.extractedData;
      setFormFields({
        document_type: docDetail.document.document_type || 'invoice',
        vendor_name: ext?.vendor_name || '',
        vendor_address: ext?.vendor_address || '',
        vendor_tax_id: ext?.vendor_tax_id || '',
        customer_name: ext?.customer_name || '',
        invoice_number: ext?.invoice_number || '',
        po_number: ext?.po_number || '',
        invoice_date: ext?.invoice_date || '',
        due_date: ext?.due_date || '',
        payment_status: ext?.payment_status || 'unpaid',
        currency: ext?.currency || 'USD',
        subtotal: ext?.subtotal ?? '',
        discount: ext?.discount ?? '',
        shipping: ext?.shipping ?? '',
        tax_amount: ext?.tax_amount ?? '',
        tax_rate: ext?.tax_rate ?? '',
        total_amount: ext?.total_amount ?? '',
        amount_paid: ext?.amount_paid ?? '',
        outstanding_balance: ext?.outstanding_balance ?? '',
        category: ext?.category || 'Software',
        description: ext?.description || '',
        notes: ext?.notes || '',
      });
      setLineItems(docDetail.lineItems || []);
      setTags(ext?.tags || []);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to load document' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!documentId) return null;

  const handleFieldChange = (field: string, value: any) => {
    setFormFields((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { description: 'New Item', quantity: 1, unit_price: 0, tax_amount: 0, total_price: 0 }
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (!newTagInput.trim()) return;
    const clean = newTagInput.trim().toLowerCase();
    if (!tags.includes(clean)) {
      setTags(prev => [...prev, clean]);
    }
    setNewTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      await api.updateDocument(documentId, {
        ...formFields,
        subtotal: formFields.subtotal !== '' ? parseFloat(formFields.subtotal) : null,
        discount: formFields.discount !== '' ? parseFloat(formFields.discount) : null,
        shipping: formFields.shipping !== '' ? parseFloat(formFields.shipping) : null,
        tax_amount: formFields.tax_amount !== '' ? parseFloat(formFields.tax_amount) : null,
        tax_rate: formFields.tax_rate !== '' ? parseFloat(formFields.tax_rate) : null,
        total_amount: formFields.total_amount !== '' ? parseFloat(formFields.total_amount) : null,
        amount_paid: formFields.amount_paid !== '' ? parseFloat(formFields.amount_paid) : null,
        outstanding_balance: formFields.outstanding_balance !== '' ? parseFloat(formFields.outstanding_balance) : null,
        tags,
        line_items: lineItems.map(item => ({
          ...item,
          quantity: item.quantity ? Number(item.quantity) : null,
          unit_price: item.unit_price ? Number(item.unit_price) : null,
          tax_amount: item.tax_amount ? Number(item.tax_amount) : null,
          total_price: item.total_price ? Number(item.total_price) : null
        }))
      });
      setFeedbackMessage({ type: 'success', text: 'Document fields updated successfully' });
      onRefresh();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      await handleSave();
      await api.approveDocument(documentId);
      setFeedbackMessage({ type: 'success', text: 'Document approved and recorded in Expenses!' });
      onRefresh();
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to approve document' });
      setIsSaving(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    setFeedbackMessage(null);
    try {
      await api.reprocessDocument(documentId);
      setFeedbackMessage({ type: 'success', text: 'Reprocessing started with local Gemma model...' });
      setTimeout(() => loadDocument(documentId), 4000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to start reprocessing' });
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleDuplicateAction = async (action: 'clear' | 'confirm') => {
    try {
      await api.duplicateAction(documentId, action);
      setFeedbackMessage({
        type: 'success',
        text: action === 'clear' ? 'Duplicate flag cleared (marked legitimate)' : 'Document archived as duplicate'
      });
      onRefresh();
      loadDocument(documentId);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Action failed' });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document and its associated file permanently?')) {
      return;
    }
    try {
      await api.deleteDocument(documentId);
      onRefresh();
      onClose();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete' });
    }
  };

  const fileUrl = data ? `/uploads/${data.document.filename}` : '';
  const isPdf = data?.document.mime_type === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#1e3c2c] w-full max-w-7xl h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Workspace Top Bar */}
        <div className="h-14 px-6 border-b border-slate-200 dark:border-[#1a3628] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#091510]">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-sm">
              {data?.document.original_filename || 'Review Workspace'}
            </span>
            {data?.document.status && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                data.document.status === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : data.document.status === 'needs_review'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              }`}>
                {data.document.status.replace('_', ' ')}
              </span>
            )}
            {data?.document.is_duplicate === 1 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="size-3" /> Duplicate Candidate
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={fileUrl}
              download={data?.document.original_filename}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#152e23] text-xs flex items-center gap-1"
            >
              <Download className="size-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#152e23] cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className={`px-6 py-2 text-xs flex items-center gap-2 font-medium ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-b border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-b border-rose-500/30'
          }`}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Workspace Body: Split Screen */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-500">Loading document extraction workspace...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Panel: Document Viewer */}
            <div className="w-full md:w-1/2 border-r border-slate-200 dark:border-[#1a3628] flex flex-col bg-slate-100 dark:bg-[#07100b] relative">
              {/* Zoom Controls Bar */}
              <div className="h-10 px-4 bg-white/80 dark:bg-[#091510]/80 backdrop-blur-sm border-b border-slate-200 dark:border-[#1a3628] flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shrink-0">
                <span className="font-mono text-[11px]">{data?.document.mime_type}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 25, 50))}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#152e23]"
                    title="Zoom Out"
                  >
                    <ZoomOut className="size-3.5" />
                  </button>
                  <span className="font-mono text-[11px] w-12 text-center">{zoomLevel}%</span>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 25, 200))}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#152e23]"
                    title="Zoom In"
                  >
                    <ZoomIn className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#152e23]"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Document Canvas / Iframe */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                {isPdf ? (
                  <iframe
                    src={`${fileUrl}#zoom=${zoomLevel}`}
                    title="PDF Document Preview"
                    className="w-full h-full rounded-lg shadow-sm border border-slate-200 dark:border-[#1e3c2c] bg-white"
                  />
                ) : (
                  <div className="overflow-auto max-h-full max-w-full flex items-center justify-center">
                    <img
                      src={fileUrl}
                      alt="Document scan"
                      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                      className="max-h-full object-contain rounded-lg shadow-md transition-transform duration-100"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Extracted Financial Fields & Review */}
            <div className="w-full md:w-1/2 flex flex-col overflow-y-auto bg-white dark:bg-[#0c1813]">
              {/* Duplicate Detection Alert Banner */}
              {data?.document.is_duplicate === 1 && (
                <div className="p-4 m-4 mb-0 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-900 dark:text-rose-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="size-4.5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-600 dark:text-rose-400">Potential Duplicate Detected</div>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                        {data.document.duplicate_reason || 'This document matches details or content of another record.'}
                      </p>
                      {data.duplicateOfDoc && (
                        <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          Matches: {data.duplicateOfDoc.original_filename} ({data.duplicateOfDoc.vendor_name || 'Vendor'} • ${data.duplicateOfDoc.total_amount})
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-rose-500/20">
                    <button
                      type="button"
                      onClick={() => handleDuplicateAction('clear')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 cursor-pointer"
                    >
                      Legitimate Separate Transaction
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateAction('confirm')}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-500 cursor-pointer"
                    >
                      Confirm Duplicate & Archive
                    </button>
                  </div>
                </div>
              )}

              {/* Validation Warnings */}
              {data?.extractedData?.validation_warnings && data.extractedData.validation_warnings.length > 0 && (
                <div className="p-3 m-4 mb-0 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" /> Extraction Warnings
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {data.extractedData.validation_warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable Fields Form */}
              <div className="p-6 space-y-5 flex-1">
                {/* Confidence Meter */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1d3d2e] text-xs">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Local AI Extraction</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Model: {data?.extractedData?.extraction_model || 'gemma3:4b'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Confidence</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {data?.document.ocr_confidence ? `${Math.round(data.document.ocr_confidence * 100)}%` : '95%'}
                    </span>
                  </div>
                </div>

                {/* Section 1: Vendor & Document Identifiers */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-500/70">
                    Vendor & Document Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Vendor / Merchant Name
                      </label>
                      <input
                        type="text"
                        value={formFields.vendor_name || ''}
                        onChange={(e) => handleFieldChange('vendor_name', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="e.g. Cloudflare, AWS, Apple"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Invoice / Receipt #
                      </label>
                      <input
                        type="text"
                        value={formFields.invoice_number || ''}
                        onChange={(e) => handleFieldChange('invoice_number', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="e.g. INV-2026-001"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Tax ID / VAT #
                      </label>
                      <input
                        type="text"
                        value={formFields.vendor_tax_id || ''}
                        onChange={(e) => handleFieldChange('vendor_tax_id', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="e.g. US-27-0130541"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Document Type
                      </label>
                      <select
                        value={formFields.document_type || 'invoice'}
                        onChange={(e) => handleFieldChange('document_type', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="invoice">Invoice</option>
                        <option value="receipt">Receipt</option>
                        <option value="other">Other Financial Document</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Dates & Status */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-500/70">
                    Dates & Financial Terms
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Issue Date
                      </label>
                      <input
                        type="date"
                        value={formFields.invoice_date || ''}
                        onChange={(e) => handleFieldChange('invoice_date', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={formFields.due_date || ''}
                        onChange={(e) => handleFieldChange('due_date', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Payment Status
                      </label>
                      <select
                        value={formFields.payment_status || 'unpaid'}
                        onChange={(e) => handleFieldChange('payment_status', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="pending">Pending</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Financial Totals */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-500/70">
                    Amounts & Totals
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={formFields.currency || 'USD'}
                        onChange={(e) => handleFieldChange('currency', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Subtotal
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formFields.subtotal}
                        onChange={(e) => handleFieldChange('subtotal', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Tax Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formFields.tax_amount}
                        onChange={(e) => handleFieldChange('tax_amount', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 text-emerald-600 dark:text-emerald-400">
                        Total Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formFields.total_amount}
                        onChange={(e) => handleFieldChange('total_amount', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border-2 border-emerald-500/60 bg-emerald-50/20 dark:bg-[#11241c] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Categorization & Tags */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-500/70">
                    Categorization & Tags
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Expense Category
                      </label>
                      <select
                        value={formFields.category || 'Software'}
                        onChange={(e) => handleFieldChange('category', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="Software">Software</option>
                        <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Travel">Travel</option>
                        <option value="Meals & Dining">Meals & Dining</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Professional Services">Professional Services</option>
                        <option value="Marketing & Ads">Marketing & Ads</option>
                        <option value="Equipment & Hardware">Equipment & Hardware</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Add Custom Tag
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          placeholder="e.g. project-x, client, q4"
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={addTag}
                          className="px-2.5 py-1.5 bg-slate-200 dark:bg-[#152e23] text-slate-700 dark:text-slate-300 hover:bg-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-[#152e23] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#224836]"
                        >
                          <Tag className="size-2.5 text-emerald-500" />
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="hover:text-rose-500 cursor-pointer ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 5: Extracted Line Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-emerald-500/70">
                      Line Items ({lineItems.length})
                    </h4>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Plus className="size-3" /> Add Item
                    </button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-[#091510] border border-dashed border-slate-200 dark:border-[#1e3c2c] text-xs text-slate-400">
                      No discrete line items extracted. You can add items manually.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-[#1e3c2c] rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-[#11241c] border-b border-slate-200 dark:border-[#1e3c2c] text-[10px] uppercase font-bold text-slate-500">
                          <tr>
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-2 w-16">Qty</th>
                            <th className="py-2 px-2 w-20">Unit $</th>
                            <th className="py-2 px-2 w-20">Total $</th>
                            <th className="py-2 px-1 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#152e23]">
                          {lineItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#11241c]/50">
                              <td className="p-1.5 px-3">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                                  className="w-full bg-transparent border-0 text-slate-900 dark:text-white focus:outline-none"
                                />
                              </td>
                              <td className="p-1.5 px-2">
                                <input
                                  type="number"
                                  value={item.quantity ?? ''}
                                  onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                                  className="w-full font-mono bg-transparent border-0 text-slate-900 dark:text-white focus:outline-none"
                                />
                              </td>
                              <td className="p-1.5 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unit_price ?? ''}
                                  onChange={(e) => handleLineItemChange(idx, 'unit_price', e.target.value)}
                                  className="w-full font-mono bg-transparent border-0 text-slate-900 dark:text-white focus:outline-none"
                                />
                              </td>
                              <td className="p-1.5 px-2 font-mono font-semibold text-slate-900 dark:text-white">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.total_price ?? ''}
                                  onChange={(e) => handleLineItemChange(idx, 'total_price', e.target.value)}
                                  className="w-full font-mono font-bold bg-transparent border-0 text-slate-900 dark:text-white focus:outline-none"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(idx)}
                                  className="text-slate-400 hover:text-rose-500"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="h-16 px-6 bg-slate-50 dark:bg-[#091510] border-t border-slate-200 dark:border-[#1a3628] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                    className="p-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#152e23] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Reprocess with local Gemma model"
                  >
                    <RefreshCw className={`size-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
                    <span>{isReprocessing ? 'Extracting...' : 'Reprocess AI'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-[#152e23] cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Check className="size-4 stroke-[3]" />
                    <span>Approve & Save</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
