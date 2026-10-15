import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  ExternalLink,
  Edit,
  GitMerge,
  Download,
  DollarSign,
  FileText,
  Calendar,
  X,
  Check,
  Tag
} from 'lucide-react';
import { api } from '../api/client';
import { WorkspaceCard } from '../components/reactbits/WorkspaceCard';
import CountUp from '../components/reactbits/CountUp';
import type { VendorItem } from '../types';

interface VendorsPageProps {
  onOpenReview: (id: string) => void;
  globalSearch: string;
}

export const VendorsPage: React.FC<VendorsPageProps> = ({ onOpenReview, globalSearch }) => {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(globalSearch);

  // Selected vendor detail modal
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [vendorDetail, setVendorDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Merge modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [sourceVendorId, setSourceVendorId] = useState('');
  const [targetVendorId, setTargetVendorId] = useState('');
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);

  useEffect(() => {
    loadVendors();
  }, [search]);

  const loadVendors = async () => {
    setIsLoading(true);
    try {
      const data = await api.getVendors(search);
      setVendors(data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openVendorDetail = async (id: string) => {
    setSelectedVendorId(id);
    setDetailLoading(true);
    try {
      const detail = await api.getVendorDetail(id);
      setVendorDetail(detail);
    } catch (err) {
      console.error('Failed to load vendor detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMergeVendors = async () => {
    if (!sourceVendorId || !targetVendorId) return;
    setMergeStatus('Merging...');
    try {
      await api.mergeVendors(sourceVendorId, targetVendorId);
      setIsMergeModalOpen(false);
      setSourceVendorId('');
      setTargetVendorId('');
      setMergeStatus(null);
      loadVendors();
    } catch (err: any) {
      setMergeStatus(err.message || 'Merge failed');
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Vendor Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track merchant profiles, total lifetime spending, and manage duplicates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.exportCsvUrl('vendors')}
            download
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#152e23] text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => setIsMergeModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#11241c] hover:bg-slate-200 dark:hover:bg-[#183528] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-[#1e3c2c]"
          >
            <GitMerge className="size-3.5 text-emerald-500" />
            <span>Merge Vendors</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter vendors by name or default category..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#0c1813] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((v) => (
          <WorkspaceCard
            key={v.id}
            onClick={() => openVendorDetail(v.id)}
            spotlightColor="#06B6D4"
            className="cursor-pointer space-y-3 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                  {v.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                    {v.name}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {v.default_category || 'Uncategorized'}
                  </span>
                </div>
              </div>
              <ExternalLink className="size-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-[#152e23] flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Lifetime Spend</span>
                <CountUp
                  to={v.total_spent || 0}
                  decimals={2}
                  prefix="$"
                  separator=","
                  duration={1}
                  className="font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Invoices</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {v.document_count || 0} doc(s)
                </span>
              </div>
            </div>

            {v.last_invoice_date && (
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <Calendar className="size-2.5" /> Last active: {v.last_invoice_date}
              </div>
            )}
          </WorkspaceCard>
        ))}

        {vendors.length === 0 && !isLoading && (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No vendors match your search criteria.
          </div>
        )}
      </div>

      {/* Vendor Detail Modal */}
      {selectedVendorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#1e3c2c] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#1a3628] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {vendorDetail?.vendor.name || 'Vendor Profile'}
                </h3>
                <p className="text-xs text-slate-400">
                  Category: {vendorDetail?.vendor.default_category || 'Other'} • Tax ID: {vendorDetail?.vendor.tax_id || 'Not recorded'}
                </p>
              </div>
              <button
                onClick={() => setSelectedVendorId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="size-4.5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1d3d2e]">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Spend</span>
                  <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                    ${(vendorDetail?.stats?.total_expenses || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Transactions</span>
                  <span className="font-bold text-base text-slate-800 dark:text-slate-200">
                    {vendorDetail?.stats?.expense_count || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Avg Transaction</span>
                  <span className="font-mono font-bold text-base text-slate-800 dark:text-slate-200">
                    ${(vendorDetail?.stats?.avg_expense || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Related Documents */}
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Linked Documents & Invoices ({vendorDetail?.documents?.length || 0})
                </h4>
                <div className="border border-slate-200 dark:border-[#1e3c2c] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-[#152e23]">
                  {vendorDetail?.documents?.map((doc: any) => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedVendorId(null);
                        onOpenReview(doc.id);
                      }}
                      className="p-2.5 px-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#11241c] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{doc.original_filename}</span>
                        <span className="text-[10px] font-mono text-slate-400">({doc.invoice_date})</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          ${(doc.total_amount || 0).toFixed(2)}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          View →
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!vendorDetail?.documents || vendorDetail.documents.length === 0) && (
                    <div className="p-4 text-center text-slate-400">No linked documents found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Vendors Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#1e3c2c] w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Merge Vendor Profiles</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reassign all documents and expenses from a duplicate vendor into the primary vendor.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Source Vendor (Will be deleted)
                </label>
                <select
                  value={sourceVendorId}
                  onChange={(e) => setSourceVendorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                >
                  <option value="">Select source vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} (${(v.total_spent || 0).toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Vendor (Will receive all records)
                </label>
                <select
                  value={targetVendorId}
                  onChange={(e) => setTargetVendorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                >
                  <option value="">Select target vendor...</option>
                  {vendors.filter(v => v.id !== sourceVendorId).map(v => (
                    <option key={v.id} value={v.id}>{v.name} (${(v.total_spent || 0).toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {mergeStatus && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs">
                  {mergeStatus}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!sourceVendorId || !targetVendorId}
                onClick={handleMergeVendors}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
