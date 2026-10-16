import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Search,
  Plus,
  Download,
  Trash2,
  Edit,
  ExternalLink,
  Tag,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import { WorkspaceCard } from '../components/reactbits/WorkspaceCard';
import CountUp from '../components/reactbits/CountUp';
import type { ExpenseItem } from '../types';

interface ExpensesPageProps {
  onOpenReview: (id: string) => void;
  globalSearch: string;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ onOpenReview, globalSearch }) => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalSum, setTotalSum] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(globalSearch);
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [formVendor, setFormVendor] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Software');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  useEffect(() => {
    loadExpenses();
  }, [page, search, category, startDate, endDate]);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const res = await api.getExpenses({
        page,
        limit: 15,
        search,
        category,
        startDate,
        endDate
      });
      setExpenses(res.items);
      setTotal(res.total);
      setTotalSum(res.totalSum);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormVendor('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAmount('');
    setFormCategory('Software');
    setFormDescription('');
    setFormTags('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setFormVendor(exp.vendor_name);
    setFormDate(exp.expense_date);
    setFormAmount(String(exp.amount));
    setFormCategory(exp.category);
    setFormDescription(exp.description || '');
    setFormTags(exp.tags?.join(', ') || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVendor || !formAmount || !formDate) return;

    const tagsArray = formTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const amountNum = parseFloat(formAmount);

    try {
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, {
          vendor_name: formVendor,
          expense_date: formDate,
          amount: amountNum,
          category: formCategory,
          description: formDescription,
          tags: tagsArray
        });
      } else {
        await api.createExpense({
          vendor_name: formVendor,
          expense_date: formDate,
          amount: amountNum,
          category: formCategory,
          description: formDescription,
          currency: 'USD',
          tags: tagsArray
        });
      }
      setIsModalOpen(false);
      loadExpenses();
    } catch (err) {
      console.error('Failed to save expense:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      await api.deleteExpense(id);
      loadExpenses();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  return (
    <div className="p-6 lg:px-10 gap-4 w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-sm">
            Expense Tracker
          </h2>
          <p className="text-xs font-bold text-slate-300 mt-0.5">
            Recorded business expenses linked to verified source documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.exportCsvUrl('expenses', { category, startDate, endDate })}
            download
            className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-[#091813]/80 text-slate-100 hover:bg-[#152e23] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="size-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md shadow-emerald-950/50 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Card */}
      <WorkspaceCard spotlightColor="#059669" className="!p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <div>
            <span className="text-xs text-slate-200 font-extrabold uppercase tracking-wider block">Total Filtered Spend</span>
            <CountUp
              to={totalSum}
              decimals={2}
              prefix={expenses[0]?.currency && expenses[0].currency !== 'USD' ? `${expenses[0].currency} ` : '$'}
              separator=","
              duration={1.15}
              className="text-2xl font-black text-white font-mono"
            />
          </div>
        </div>
        <div className="text-xs font-bold text-slate-200">
          Showing <span className="font-black text-emerald-300">{total}</span> recorded transactions
        </div>
      </WorkspaceCard>

      {/* Filter Bar */}
      <WorkspaceCard spotlightColor="#059669" className="!p-4 flex flex-wrap items-center justify-between gap-3 text-sm shrink-0">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or description..."
            className="w-full pl-12 pr-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-3 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300"
          >
            <option value="">All Categories</option>
            <option value="Software">Software</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Travel">Travel</option>
            <option value="Meals & Dining">Meals & Dining</option>
            <option value="Equipment & Hardware">Equipment & Hardware</option>
            <option value="Other">Other</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-3 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 font-mono"
            title="Start date"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-3 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 font-mono"
            title="End date"
          />
        </div>
      </WorkspaceCard>

      {/* Expenses Table — stretches to the bottom of the workspace */}
      <WorkspaceCard spotlightColor="#059669" className="!p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d221a]/90 text-emerald-300/90 uppercase text-[11px] font-extrabold tracking-wider border-b border-emerald-500/20">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Vendor</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Source Document</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {expenses.length > 0 ? (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-emerald-500/10 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      {exp.expense_date}
                    </td>
                    <td className="py-3 px-3 font-extrabold text-white">
                      {exp.vendor_name}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200 max-w-xs truncate">
                      {exp.description || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#152e23] text-emerald-300 border border-emerald-500/25">
                        <Tag className="size-2.5 text-emerald-400" />
                        <span>{exp.category}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-white">
                      {exp.currency && exp.currency !== 'USD' ? `${exp.currency} ` : '$'}{exp.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      {exp.document_id ? (
                        <button
                          onClick={() => onOpenReview(exp.document_id!)}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <span>Linked Document</span>
                          <ExternalLink className="size-3" />
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Manual Entry</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    {isLoading ? 'Loading expenses...' : 'No recorded expenses found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Lower Space Filler in Expenses Table when fewer than 6 rows */}
          {expenses.length < 6 && (
            <div className="p-5 flex-1 min-h-[12rem] grid grid-cols-1 lg:grid-cols-12 gap-5 border-t border-white/10 bg-[#06120e]/45">
              <div className="lg:col-span-7 p-5 rounded-2xl bg-[#091a14]/85 border border-emerald-500/25 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                    Ledger Summary
                  </span>
                  <h3 className="text-base font-black text-white mt-0.5">
                    Verified Expense Records ({total})
                  </h3>
                  <p className="text-xs font-bold text-slate-300 mt-1">
                    Every approved invoice or receipt is automatically recorded here and linked to its original source PDF/image.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Transactions</span>
                    <span className="font-mono font-black text-white mt-0.5 block">{total}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Latest Vendor</span>
                    <span className="font-extrabold text-white mt-0.5 block truncate">
                      {expenses[0]?.vendor_name || '—'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-300 block">Total Recorded</span>
                    <span className="font-mono font-black text-emerald-300 mt-0.5 block">
                      {expenses[0]?.currency && expenses[0].currency !== 'USD' ? `${expenses[0].currency} ` : '$'}
                      {totalSum.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div
                onClick={handleOpenCreate}
                className="lg:col-span-5 p-5 rounded-2xl border-2 border-dashed border-emerald-500/35 hover:border-emerald-400 bg-[#071611]/70 hover:bg-[#0b221a]/80 transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2"
              >
                <div className="size-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">+ Record Manual Expense</h4>
                  <p className="text-xs font-bold text-slate-300 mt-0.5">
                    Add cash outlays or card charges directly to your local SQLite ledger
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 px-5 bg-[#07130f]/90 border-t border-emerald-500/20 flex items-center justify-between text-xs font-bold text-slate-300 shrink-0">
          <span>Showing {expenses.length} of {total} expenses</span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="font-mono text-[11px] px-2">Page {page} of {Math.max(1, totalPages)}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </WorkspaceCard>

      {/* Manual Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#1e3c2c] w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="size-4.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value)}
                  placeholder="e.g. AWS, Office Depot, Uber"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                >
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
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional note or item description"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="e.g. q3, client-billable"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
