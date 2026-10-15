import React, { useState, useEffect } from 'react';
import {
  FileText,
  Wallet,
  AlertCircle,
  Copy,
  TrendingUp,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Tag
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { api } from '../api/client';
import type { DashboardData, DocumentType } from '../types';

interface OverviewPageProps {
  onOpenReview: (id: string) => void;
  onOpenUpload: () => void;
  onNavigateTab: (tab: any) => void;
  searchQuery: string;
}

const CATEGORY_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#ec4899', '#14b8a6', '#64748b'
];

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onOpenReview,
  onOpenUpload,
  onNavigateTab,
  searchQuery
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'30d' | '90d' | 'all'>('all');

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  const loadDashboard = async () => {
    setIsLoading(true);
    let startDate: string | undefined;
    const now = new Date();
    if (dateRange === '30d') {
      const d = new Date(now.setDate(now.getDate() - 30));
      startDate = d.toISOString().slice(0, 10);
    } else if (dateRange === '90d') {
      const d = new Date(now.setDate(now.getDate() - 90));
      startDate = d.toISOString().slice(0, 10);
    }

    try {
      const res = await api.getDashboardData(startDate);
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const hasNoData = !data || data.metrics.totalDocuments === 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Date Range & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Financial Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time accounting analytics parsed locally on your device
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date range filter */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#11241c] p-1 border border-slate-200 dark:border-[#1e3c2c] text-xs font-semibold">
            <button
              onClick={() => setDateRange('30d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                dateRange === '30d'
                  ? 'bg-white dark:bg-[#1d3d2e] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateRange('90d')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                dateRange === '90d'
                  ? 'bg-white dark:bg-[#1d3d2e] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Last 90 Days
            </button>
            <button
              onClick={() => setDateRange('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                dateRange === 'all'
                  ? 'bg-white dark:bg-[#1d3d2e] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={loadDashboard}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#11241c] cursor-pointer"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Empty State Banner if no records exist */}
      {hasNoData && !isLoading && (
        <div className="p-8 rounded-2xl bg-gradient-to-r from-emerald-950/20 to-teal-950/20 border border-emerald-500/30 text-center space-y-4">
          <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
            <Sparkles className="size-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to LedgerLens</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              No financial documents have been imported yet. Upload your first PDF invoice or populate realistic sample data to explore the workspace.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Import Invoices
            </button>
            <button
              onClick={async () => {
                await api.seedDemo();
                loadDashboard();
              }}
              className="px-4 py-2.5 rounded-xl border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold text-xs cursor-pointer"
            >
              Load Demo Records (Labeled)
            </button>
          </div>
        </div>
      )}

      {/* 4 Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoices */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Total Invoices</span>
            <div className="size-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {data?.metrics.totalInvoices ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              + {data?.metrics.totalReceipts ?? 0} receipts tracked
            </p>
          </div>
        </div>

        {/* Total Recorded Expenses */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Recorded Expenses</span>
            <div className="size-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              ${(data?.metrics.totalExpenses ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Across {data?.metrics.expenseCount ?? 0} approved records
            </p>
          </div>
        </div>

        {/* Awaiting Review */}
        <div
          onClick={() => onNavigateTab('review')}
          className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-3 hover:border-amber-500/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Awaiting Review</span>
            <div className="size-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                {data?.metrics.awaitingReview ?? 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Require human verification</p>
            </div>
            <ArrowRight className="size-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Duplicate Candidates */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Duplicate Warnings</span>
            <div className="size-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Copy className="size-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {data?.metrics.duplicateCandidates ?? 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Hash & metadata collisions</p>
          </div>
        </div>
      </div>

      {/* Charts Section: Monthly Trend & Spending by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Spending Trend (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Expense Trend</h3>
              <p className="text-[11px] text-slate-400">Total spending grouped by month from SQLite records</p>
            </div>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>

          <div className="h-64 w-full flex-1">
            {data?.monthlyTrend && data.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#091510', borderColor: '#193627', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Spend']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#emeraldGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No expense data recorded for this period
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown (1 col) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Spending by Category</h3>
            <p className="text-[11px] text-slate-400">Top operational expense distributions</p>
          </div>

          <div className="h-44 w-full">
            {data?.spendingByCategory && data.spendingByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.spendingByCategory}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                  >
                    {data.spendingByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#091510', borderColor: '#193627', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                    formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No categorized expenses yet
              </div>
            )}
          </div>

          {/* Category Legend list */}
          <div className="mt-3 space-y-1.5 flex-1 overflow-y-auto max-h-36 pr-1 text-xs">
            {data?.spendingByCategory?.map((cat, idx) => (
              <div key={cat.category} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="truncate text-[11px]">{cat.category}</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-900 dark:text-white shrink-0">
                  ${cat.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Documents Table & Processing Status */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Documents</h3>
            <p className="text-[11px] text-slate-400">Recently imported invoices, receipts, and scans</p>
          </div>
          <button
            onClick={() => onNavigateTab('invoices')}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {data?.recentDocuments && data.recentDocuments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#11241c] text-slate-400 uppercase text-[10px] font-bold border-y border-slate-100 dark:border-[#1a3628]">
                <tr>
                  <th className="py-2.5 px-3">Document</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#152e23]">
                {data.recentDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => onOpenReview(doc.id)}
                    className="hover:bg-slate-50 dark:hover:bg-[#11241c]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                      {doc.original_filename}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {doc.vendor_name || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="capitalize text-slate-500">{doc.document_type}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {doc.category || 'Other'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {doc.total_amount ? `$${doc.total_amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        doc.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : doc.status === 'needs_review'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/15 text-slate-500'
                      }`}>
                        {doc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReview(doc.id);
                        }}
                        className="px-2.5 py-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold cursor-pointer"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No recent documents found
          </div>
        )}
      </div>
    </div>
  );
};
