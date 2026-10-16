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
import { WorkspaceCard } from '../components/reactbits/WorkspaceCard';
import CountUp from '../components/reactbits/CountUp';

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

  const hasProcessingDocs = Boolean(
    data?.recentDocuments?.some(d => d.status === 'uploaded' || d.status === 'processing')
  );

  useEffect(() => {
    if (!hasProcessingDocs) return;
    const timer = setInterval(() => {
      loadDashboard(true);
    }, 1200);
    return () => clearInterval(timer);
  }, [hasProcessingDocs, dateRange]);

  const loadDashboard = async (silent = false) => {
    if (!silent) setIsLoading(true);
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

  // Detect dominant currency from recent documents so KPIs & charts match the user's invoice currency
  const dominantCurrency = data?.recentDocuments?.find(d => d.currency && d.currency !== 'USD')?.currency || 'USD';
  const currencyPrefix = dominantCurrency === 'USD' ? '$' : `${dominantCurrency} `;

  // Ensure AreaChart has at least 2 points when only 1 month exists so it draws a full curve & area fill instead of a lone dot
  const chartMonthlyTrend = React.useMemo(() => {
    const raw = data?.monthlyTrend || [];
    if (raw.length === 1 && raw[0]?.month) {
      const [yStr, mStr] = String(raw[0].month).split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        const prevDate = new Date(Date.UTC(y, m - 2, 1));
        const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
        return [{ month: prevMonth, total: 0, count: 0 }, ...raw];
      }
    }
    return raw;
  }, [data?.monthlyTrend]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Date Range & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">
            Financial Dashboard
          </h2>
          <p className="text-xs font-semibold text-slate-300 mt-0.5">
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
            onClick={() => loadDashboard(false)}
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
              Your private local ledger is ready. Import your first invoice or receipt to automatically extract details with local AI.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onOpenUpload}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
            >
              <UploadCloud className="size-4" />
              Import Invoices
            </button>
            <button
              onClick={() => onNavigateTab('invoices')}
              className="px-4 py-2.5 rounded-xl border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold text-xs cursor-pointer flex items-center gap-1.5"
            >
              Explore Invoices
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4 Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoices */}
        <WorkspaceCard spotlightColor="#00D6A0" className="space-y-3">
          <div className="flex items-center justify-between text-slate-100 text-xs font-extrabold uppercase tracking-wider">
            <span>Total Invoices</span>
            <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </div>
          <div>
            <CountUp
              to={data?.metrics.totalInvoices ?? 0}
              duration={1.1}
              className="text-3xl font-black text-white tracking-tight"
            />
            <p className="text-xs font-bold text-slate-300 mt-1">
              + {data?.metrics.totalReceipts ?? 0} receipts tracked
            </p>
          </div>
        </WorkspaceCard>

        {/* Total Recorded Expenses */}
        <WorkspaceCard spotlightColor="#3b82f6" className="space-y-3">
          <div className="flex items-center justify-between text-slate-100 text-xs font-extrabold uppercase tracking-wider">
            <span>Recorded Expenses</span>
            <div className="size-8 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
          </div>
          <div>
            <CountUp
              to={data?.metrics.totalExpenses ?? 0}
              decimals={2}
              prefix={currencyPrefix}
              separator=","
              duration={1.25}
              className="text-3xl font-black text-white tracking-tight"
            />
            <p className="text-xs font-bold text-slate-300 mt-1">
              Across {data?.metrics.expenseCount ?? 0} approved records
            </p>
          </div>
        </WorkspaceCard>

        {/* Awaiting Review */}
        <WorkspaceCard
          onClick={() => onNavigateTab('review')}
          spotlightColor="#FFB000"
          className="space-y-3 cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-100 text-xs font-extrabold uppercase tracking-wider">
            <span>Awaiting Review</span>
            <div className="size-8 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 flex items-center justify-center">
              <AlertCircle className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <CountUp
                to={data?.metrics.awaitingReview ?? 0}
                duration={1}
                className="text-3xl font-black text-amber-400 tracking-tight"
              />
              <p className="text-xs font-bold text-slate-300 mt-1">Require human verification</p>
            </div>
            <ArrowRight className="size-4 text-slate-300 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </WorkspaceCard>

        {/* Duplicate Candidates */}
        <WorkspaceCard spotlightColor="#f43f5e" className="space-y-3">
          <div className="flex items-center justify-between text-slate-100 text-xs font-extrabold uppercase tracking-wider">
            <span>Duplicate Warnings</span>
            <div className="size-8 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center">
              <Copy className="size-4" />
            </div>
          </div>
          <div>
            <CountUp
              to={data?.metrics.duplicateCandidates ?? 0}
              duration={1}
              className="text-3xl font-black text-white tracking-tight"
            />
            <p className="text-xs font-bold text-slate-300 mt-1">Hash &amp; metadata collisions</p>
          </div>
        </WorkspaceCard>
      </div>

      {/* Charts Section: Monthly Trend & Spending by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Spending Trend (2 cols) */}
        <WorkspaceCard spotlightColor="#10b981" className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">Monthly Expense Trend</h3>
              <p className="text-xs font-semibold text-slate-300">Total spending grouped by month from SQLite records</p>
            </div>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>

          <div className="h-64 w-full flex-1">
            {chartMonthlyTrend && chartMonthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartMonthlyTrend} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#cbd5e1" fontSize={11} fontWeight={700} tickLine={false} />
                  <YAxis stroke="#cbd5e1" fontSize={11} fontWeight={700} tickLine={false} tickFormatter={(v) => `${currencyPrefix}${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#091510', borderColor: '#193627', borderRadius: '12px', fontSize: '12px', fontWeight: 700, color: '#fff' }}
                    formatter={(value: any) => [`${currencyPrefix}${Number(value).toFixed(2)}`, 'Spend']}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#emeraldGradient)"
                    dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300">
                No expense data recorded for this period
              </div>
            )}
          </div>
        </WorkspaceCard>

        {/* Category Breakdown (1 col) */}
        <WorkspaceCard spotlightColor="#8b5cf6" className="flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-extrabold text-white tracking-tight">Spending by Category</h3>
            <p className="text-xs font-semibold text-slate-300">Top operational expense distributions</p>
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
                    contentStyle={{ backgroundColor: '#091510', borderColor: '#193627', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: '#fff' }}
                    formatter={(val: any) => [`${currencyPrefix}${Number(val).toFixed(2)}`, 'Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-slate-300">
                No categorized expenses yet
              </div>
            )}
          </div>

          {/* Category Legend list */}
          <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-36 pr-1 text-xs">
            {data?.spendingByCategory?.map((cat, idx) => (
              <div key={cat.category} className="flex items-center justify-between text-slate-100 font-bold">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="truncate text-xs font-bold text-white">{cat.category}</span>
                </div>
                <span className="font-mono text-xs font-extrabold text-emerald-300 shrink-0">
                  {currencyPrefix}{cat.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </WorkspaceCard>
      </div>

      {/* Recent Documents Table & Processing Status */}
      <WorkspaceCard spotlightColor="#00D6A0" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">Recent Documents</h3>
            <p className="text-xs font-semibold text-slate-300">Recently imported invoices, receipts, and scans</p>
          </div>
          <button
            onClick={() => onNavigateTab('invoices')}
            className="text-xs text-emerald-300 hover:text-emerald-200 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {data?.recentDocuments && data.recentDocuments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0d221a]/90 text-emerald-300/90 uppercase text-[11px] font-extrabold tracking-wider border-y border-emerald-500/20">
                <tr>
                  <th className="py-3 px-3">Document</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.recentDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => onOpenReview(doc.id)}
                    className="hover:bg-emerald-500/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-extrabold text-white max-w-xs truncate">
                      {doc.original_filename}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-100">
                      {doc.status === 'uploaded' || doc.status === 'processing'
                        ? 'Extracting with Gemma AI…'
                        : doc.vendor_name || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="capitalize font-bold text-slate-200">{doc.document_type}</span>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-300">
                      {doc.category || 'Other'}
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-white">
                      {doc.total_amount !== null && doc.total_amount !== undefined
                        ? `${doc.currency && doc.currency !== 'USD' ? `${doc.currency} ` : '$'}${Number(doc.total_amount).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        doc.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : doc.status === 'needs_review'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : doc.status === 'uploaded' || doc.status === 'processing'
                          ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {doc.status === 'uploaded' || doc.status === 'processing'
                          ? 'extracting…'
                          : doc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReview(doc.id);
                        }}
                        className="px-3 py-1 rounded-lg text-emerald-300 hover:bg-emerald-500/20 font-extrabold cursor-pointer"
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
          <div className="py-8 text-center text-xs font-bold text-slate-300">
            No recent documents found
          </div>
        )}
      </WorkspaceCard>
    </div>
  );
};
