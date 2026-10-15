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

  const loadDocuments = async () => {
    setIsLoading(true);
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
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {description} • {total} total records
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* CSV Export Button */}
          <a
            href={api.exportCsvUrl(documentType || 'invoices', { status: statusFilter, category: categoryFilter })}
            download
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#152e23] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={onOpenUpload}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            + Upload New
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <WorkspaceCard spotlightColor={spotlightColor} className="!p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, invoice #, filename..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Status Filter */}
          {!filterStatus && (
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 focus:outline-none"
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
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 focus:outline-none"
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
            onClick={loadDocuments}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
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

      {/* Documents Table */}
      <WorkspaceCard spotlightColor={spotlightColor} className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#11241c] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-[#193627]">
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
                  <button onClick={() => toggleSort('filename')} className="flex items-center gap-1 cursor-pointer">
                    <span>Document</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('vendor')} className="flex items-center gap-1 cursor-pointer">
                    <span>Vendor</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('date')} className="flex items-center gap-1 cursor-pointer">
                    <span>Date</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">
                  <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 cursor-pointer">
                    <span>Amount</span>
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#152e23]">
              {items.length > 0 ? (
                items.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => onOpenReview(doc.id)}
                    className="hover:bg-slate-50 dark:hover:bg-[#11241c]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => handleSelectOne(doc.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white max-w-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">{doc.original_filename}</span>
                        {doc.is_duplicate === 1 && (
                          <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                            DUP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {doc.vendor_name || <span className="text-slate-400 italic">Unidentified</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {doc.invoice_number || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {doc.invoice_date || doc.created_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-[#152e23] text-slate-700 dark:text-slate-300">
                        <Tag className="size-2.5 text-emerald-500" />
                        <span>{doc.category || 'Other'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {doc.total_amount !== null && doc.total_amount !== undefined
                        ? `$${doc.total_amount.toFixed(2)}`
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        doc.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : doc.status === 'needs_review'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : doc.status === 'processing'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}>
                        {doc.status.replace('_', ' ')}
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
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 px-4 bg-slate-50 dark:bg-[#091510] border-t border-slate-200 dark:border-[#193627] flex items-center justify-between text-xs text-slate-500">
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
