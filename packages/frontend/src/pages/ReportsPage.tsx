import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  DollarSign,
  PieChart as PieIcon,
  Percent,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';
import { api } from '../api/client';

export const ReportsPage: React.FC = () => {
  const [year, setYear] = useState('2026');
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [year]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const res = await api.getReportsData(year);
      setData(res);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedMonthly = (data?.monthlyData || []).map((m: any) => ({
    ...m,
    monthName: monthNames[parseInt(m.monthNum, 10) - 1] || m.monthNum,
  }));

  const totalYearSpend = (data?.monthlyData || []).reduce((acc: number, cur: any) => acc + (cur.amount || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Financial & Tax Reports
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comprehensive year-to-date accounting summaries compiled directly from local database records
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="size-3.5 text-emerald-500" />
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#0c1813] font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="2026">Fiscal Year 2026</option>
              <option value="2025">Fiscal Year 2025</option>
            </select>
          </div>

          <a
            href={api.exportCsvUrl('expenses', { startDate: `${year}-01-01`, endDate: `${year}-12-31` })}
            download
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export Fiscal Year CSV</span>
          </a>
        </div>
      </div>

      {/* Tax & Grand Totals Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-2">
          <span className="text-[11px] uppercase font-bold text-slate-400">Total Recorded Spend ({year})</span>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            ${totalYearSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">Total approved expenses across all categories</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-2">
          <span className="text-[11px] uppercase font-bold text-slate-400">Total Sales Tax / VAT Paid</span>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ${(data?.taxSummary?.totalTax || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">Identified on invoices with explicit tax amounts</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-2">
          <span className="text-[11px] uppercase font-bold text-slate-400">Net Subtotal Before Tax</span>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
            ${(data?.taxSummary?.totalSubtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">Pre-tax business deductions basis</p>
        </div>
      </div>

      {/* Monthly Breakdown Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Expense Distribution</h3>
          <p className="text-[11px] text-slate-400">Fiscal year monthly spending volume</p>
        </div>

        <div className="h-64 w-full">
          {formattedMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedMonthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#091510', borderColor: '#193627', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                  formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Spend']}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No expenses recorded for year {year}
            </div>
          )}
        </div>
      </div>

      {/* Category & Vendor Breakdown Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category breakdown table */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Spending by Category</h3>
          <div className="divide-y divide-slate-100 dark:divide-[#152e23] text-xs">
            {data?.categoryData?.map((c: any) => (
              <div key={c.category} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{c.category}</span>
                  <span className="text-[11px] text-slate-400 ml-1.5">({c.count} records)</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">${c.total.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 block">
                    {totalYearSpend > 0 ? `${((c.total / totalYearSpend) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
            {(!data?.categoryData || data.categoryData.length === 0) && (
              <div className="py-6 text-center text-slate-400">No category records</div>
            )}
          </div>
        </div>

        {/* Top Vendors breakdown table */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#193627] shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Vendors by Spend</h3>
          <div className="divide-y divide-slate-100 dark:divide-[#152e23] text-xs">
            {data?.vendorData?.map((v: any) => (
              <div key={v.vendor_name} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{v.vendor_name}</span>
                  <span className="text-[11px] text-slate-400 ml-1.5">({v.count} payments)</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white">${v.total.toFixed(2)}</span>
              </div>
            ))}
            {(!data?.vendorData || data.vendorData.length === 0) && (
              <div className="py-6 text-center text-slate-400">No vendor records</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
