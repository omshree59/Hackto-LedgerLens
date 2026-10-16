import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Check,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Tag,
  FileText
} from 'lucide-react';
import { api } from '../../api/client';
import { WorkspaceCard } from '../reactbits/WorkspaceCard';
import type { DocumentItem, DocumentType, DocumentStatus } from '../../types';

interface DocumentTableProps {
  documentType?: DocumentType;
  filterStatus?: DocumentStatus;
  onlyDuplicates?: boolean;
  onOpenReview: (id: string) => void;
  onOpenUpload: () => void;
  globalSearch?: string;
  title: string;
  description: string;
  spotlightColor?: string;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documentType,
  filterStatus,
  onlyDuplicates,
  onOpenReview,
  onOpenUpload,
  globalSearch = '',
  title,
  description,
  spotlightColor = '#00D6A0'
}) => {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(globalSearch);
  const [statusFilter, setStatusFilter] = useState<string>(filterStatus || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionCategory, setBulkActionCategory] = useState('');

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  useEffect(() => {
    loadDocuments();
  }, [page, search, statusFilter, categoryFilter, sortBy, sortOrder]);

  const hasProcessingItems = items.some(
    i => i.status === 'uploaded' || i.status === 'processing'
  );

  // Compute summary stats for the currently loaded documents
  const pageCurrency = items.find(i => i.currency && i.currency !== 'USD')?.currency || 'USD';
  const currencyPrefix = pageCurrency === 'USD' ? '$' : `${pageCurrency} `;
  const totalPageValue = items.reduce((sum, d) => sum + (d.total_amount || 0), 0);
  const approvedCount = items.filter(d => d.status === 'approved').length;
  const reviewCount = items.filter(d => d.status === 'needs_review').length;
  const avgConfidence = items.length > 0
    ? Math.round(
        (items.reduce((acc, d) => acc + (d.ocr_confidence ?? 0.92), 0) / items.length) * 100
      )
    : 0;
  const featuredDoc = items[0] || null;

  useEffect(() => {
    if (!hasProcessingItems) return;
    const timer = setInterval(() => {
      loadDocuments(true);
    }, 1200);
    return () => clearInterval(timer);
  }, [hasProcessingItems, page, search, statusFilter, categoryFilter, sortBy, sortOrder]);

  const loadDocuments = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.getDocuments({
        page,
        limit: 15,
        type: documentType,
        status: statusFilter,
        category: categoryFilter,
        search,
        sortBy,
        sortOrder
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(items.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.bulkAction(selectedIds, 'approve');
      setSelectedIds([]);
      loadDocuments();
    } catch (err) {
      console.error('Bulk approve failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} documents permanently?`)) return;
    try {
      await api.bulkAction(selectedIds, 'delete');
      setSelectedIds([]);
      loadDocuments();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const handleBulkCategorize = async (cat: string) => {
    if (selectedIds.length === 0 || !cat) return;
    try {
      await api.bulkAction(selectedIds, 'categorize', cat);
      setSelectedIds([]);
      loadDocuments();
    } catch (err) {
      console.error('Bulk categorize failed:', err);
    }
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  };

  return (
    <div className="p-6 lg:px-10 gap-4 w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden">
      {/* Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">
            {title}
          </h2>
          <p className="text-xs font-bold text-slate-300 mt-0.5">
            {description} • <span className="text-emerald-300 font-extrabold">{total} total records</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* CSV Export Button */}
          <a
            href={api.exportCsvUrl(documentType || 'invoices', { status: statusFilter, category: categoryFilter })}
            download
            className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-[#091813]/80 text-slate-100 hover:bg-[#152e23] text-xs font-extrabold flex items-center gap-1.5 transition-colors"
          >
            <Download className="size-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={onOpenUpload}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-950/50 cursor-pointer transition-all"
          >
            + Upload New
          </button>
        </div>
      </div>

      {/* 4-Card Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <WorkspaceCard spotlightColor={spotlightColor} className="!p-4 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 block">
            Total Records
          </span>
          <div className="text-2xl font-black text-white font-mono">{total}</div>
          <p className="text-[11px] font-bold text-slate-300">
            Stored in local SQLite ledger
          </p>
        </WorkspaceCard>

        <WorkspaceCard spotlightColor="#10b981" className="!p-4 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 block">
            Total Extracted Value
          </span>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {currencyPrefix}{totalPageValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-bold text-slate-300">
            Sum across displayed documents
          </p>
        </WorkspaceCard>

        <WorkspaceCard spotlightColor="#38bdf8" className="!p-4 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 block">
            Approved &amp; Verified
          </span>
          <div className="text-2xl font-black text-white font-mono">
            {approvedCount} <span className="text-xs font-bold text-amber-300 ml-1">({reviewCount} in review)</span>
          </div>
          <p className="text-[11px] font-bold text-slate-300">
            Synced with expense tracker
          </p>
        </WorkspaceCard>

        <WorkspaceCard spotlightColor="#a855f7" className="!p-4 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200 block">
            Avg OCR Confidence
          </span>
          <div className="text-2xl font-black text-white font-mono">
            {avgConfidence > 0 ? `${avgConfidence}%` : '—'}
          </div>
          <p className="text-[11px] font-bold text-slate-300">
            On-device OCR + Gemma 3:4b
          </p>
        </WorkspaceCard>
      </div>

      {/* Filter & Search Bar */}
      <WorkspaceCard spotlightColor={spotlightColor} className="!p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Search */}
        <div className="flex-1 min-w-[280px] relative">
          <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, invoice #, filename..."
            className="w-full pl-12 pr-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {/* Status Filter */}
          {!filterStatus && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-3 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="needs_review">Needs Review</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          )}

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-3 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="Software">Software</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Travel">Travel</option>
            <option value="Meals & Dining">Meals & Dining</option>
            <option value="Utilities">Utilities</option>
            <option value="Professional Services">Professional Services</option>
            <option value="Equipment & Hardware">Equipment & Hardware</option>
            <option value="Other">Other</option>
          </select>

          <button
            onClick={() => loadDocuments(false)}
            className="p-3 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </WorkspaceCard>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs flex items-center justify-between flex-wrap gap-2 animate-in fade-in">
          <span className="font-semibold text-emerald-900 dark:text-emerald-200">
            {selectedIds.length} document(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApprove}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Check className="size-3.5" /> Approve Selected
            </button>
            <select
              value={bulkActionCategory}
              onChange={(e) => {
                setBulkActionCategory(e.target.value);
                if (e.target.value) handleBulkCategorize(e.target.value);
              }}
              className="px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#0c1813] text-slate-800 dark:text-slate-200"
            >
              <option value="">Assign Category...</option>
              <option value="Software">Software</option>
              <option value="Cloud Infrastructure">Cloud Infrastructure</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Travel">Travel</option>
              <option value="Meals & Dining">Meals & Dining</option>
              <option value="Other">Other</option>
            </select>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 rounded-lg text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Documents Table — stretches to the bottom of the workspace */}
      <WorkspaceCard
        spotlightColor={spotlightColor}
        className="!p-0 overflow-hidden flex-1 min-h-0 flex flex-col"
      >
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d221a]/90 text-emerald-300/90 uppercase text-[11px] font-extrabold tracking-wider border-b border-emerald-500/20">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === items.length}
                    onChange={handleSelectAll}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('filename')} className="flex items-center gap-1 cursor-pointer font-extrabold">
                    <span>Document</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('vendor')} className="flex items-center gap-1 cursor-pointer font-extrabold">
                    <span>Vendor</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 cursor-pointer font-extrabold">
                    <span>Date</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 cursor-pointer font-extrabold">
                    <span>Amount</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.length > 0 ? (
                items.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => onOpenReview(doc.id)}
                    className="hover:bg-emerald-500/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => handleSelectOne(doc.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-3 font-extrabold text-white max-w-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="size-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{doc.original_filename}</span>
                        {doc.is_duplicate === 1 && (
                          <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            DUP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-100">
                      {doc.vendor_name || <span className="text-slate-400 italic">Unidentified</span>}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {doc.invoice_number || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {doc.invoice_date || doc.created_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#152e23] text-emerald-300 border border-emerald-500/25">
                        <Tag className="size-2.5 text-emerald-400" />
                        <span>{doc.category || 'Other'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-white">
                      {doc.total_amount !== null && doc.total_amount !== undefined
                        ? `${doc.currency && doc.currency !== 'USD' ? `${doc.currency} ` : '$'}${doc.total_amount.toFixed(2)}`
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        doc.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : doc.status === 'needs_review'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : doc.status === 'processing' || doc.status === 'uploaded'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}>
                        {doc.status === 'uploaded' || doc.status === 'processing'
                          ? 'extracting…'
                          : doc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenReview(doc.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    {isLoading ? 'Loading records...' : 'No documents match the current filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Lower Space Filler: Featured Document Breakdown & Quick Upload Dropzone when fewer than 6 rows */}
          {items.length < 6 && (
            <div className="p-5 flex-1 min-h-[12rem] grid grid-cols-1 lg:grid-cols-12 gap-5 border-t border-white/10 bg-[#06120e]/45">
              {/* Left 7 cols: Latest Document Quick Inspector */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-[#091a14]/85 border border-emerald-500/25 flex flex-col justify-between space-y-4">
                {featuredDoc ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                          Latest Extracted Document Spotlight
                        </span>
                        <h3 className="text-base font-black text-white mt-0.5">
                          {featuredDoc.vendor_name || featuredDoc.original_filename}
                        </h3>
                        <p className="text-xs font-bold text-slate-300 mt-0.5">
                          File: <span className="font-mono text-slate-100">{featuredDoc.original_filename}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenReview(featuredDoc.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-sm shrink-0"
                      >
                        Open Full Workspace →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Invoice / Ref #</span>
                        <span className="font-mono font-extrabold text-white mt-0.5 block truncate">
                          {featuredDoc.invoice_number || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Issue Date</span>
                        <span className="font-mono font-extrabold text-white mt-0.5 block">
                          {featuredDoc.invoice_date || featuredDoc.created_at.slice(0, 10)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Subtotal / Tax</span>
                        <span className="font-mono font-extrabold text-slate-200 mt-0.5 block">
                          {featuredDoc.subtotal !== null && featuredDoc.subtotal !== undefined
                            ? `${currencyPrefix}${Number(featuredDoc.subtotal).toFixed(2)}`
                            : '—'}{' '}
                          /{' '}
                          {featuredDoc.tax_amount !== null && featuredDoc.tax_amount !== undefined
                            ? `${currencyPrefix}${Number(featuredDoc.tax_amount).toFixed(2)}`
                            : '0.00'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-300 block">Grand Total</span>
                        <span className="font-mono font-black text-sm text-emerald-300 mt-0.5 block">
                          {featuredDoc.total_amount !== null && featuredDoc.total_amount !== undefined
                            ? `${currencyPrefix}${Number(featuredDoc.total_amount).toFixed(2)}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center space-y-2">
                    <h3 className="text-sm font-extrabold text-white">No Documents Stored Yet</h3>
                    <p className="text-xs font-bold text-slate-300">
                      Upload an invoice or receipt on the right to extract vendor, line items, taxes, and totals with local Gemma AI.
                    </p>
                  </div>
                )}
              </div>

              {/* Right 5 cols: Quick Import Dropzone Card */}
              <div
                onClick={onOpenUpload}
                className="lg:col-span-5 p-5 rounded-2xl border-2 border-dashed border-emerald-500/35 hover:border-emerald-400 bg-[#071611]/70 hover:bg-[#0b221a]/80 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5"
              >
                <div className="size-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    + Import More {documentType === 'receipt' ? 'Receipts' : 'Invoices'}
                  </h4>
                  <p className="text-xs font-bold text-slate-300 mt-0.5">
                    Click to upload PDF, PNG, JPG, or WEBP for instant local OCR &amp; Gemma extraction
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 px-5 bg-[#07130f]/90 border-t border-emerald-500/20 flex items-center justify-between text-xs font-bold text-slate-300 shrink-0">
          <span>
            Showing {items.length} of {total} document(s)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#152e23]"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="font-mono px-2 text-[11px]">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#152e23]"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </WorkspaceCard>
    </div>
  );
};
