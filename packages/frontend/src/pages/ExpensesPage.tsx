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
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Expense Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Recorded business expenses linked to verified source documents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.exportCsvUrl('expenses', { category, startDate, endDate })}
            download
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#152e23] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Card */}
      <WorkspaceCard spotlightColor="#059669" className="!p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Filtered Spend</span>
            <CountUp
              to={totalSum}
              decimals={2}
              prefix="$"
              separator=","
              duration={1.15}
              className="text-xl font-extrabold text-slate-900 dark:text-white font-mono"
            />
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Showing <span className="font-bold text-slate-800 dark:text-slate-200">{total}</span> recorded transactions
        </div>
      </WorkspaceCard>

      {/* Filter Bar */}
      <WorkspaceCard spotlightColor="#059669" className="!p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or description..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300"
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
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 font-mono"
            title="Start date"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-slate-700 dark:text-slate-300 font-mono"
            title="End date"
          />
        </div>
      </WorkspaceCard>

      {/* Expenses Table */}
      <WorkspaceCard spotlightColor="#059669" className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#11241c] text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-[#193627]">
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
            <tbody className="divide-y divide-slate-100 dark:divide-[#152e23]">
              {expenses.length > 0 ? (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-[#11241c]/60 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {exp.expense_date}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      {exp.vendor_name}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {exp.description || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-[#152e23] text-slate-700 dark:text-slate-300">
                        <Tag className="size-2.5 text-emerald-500" />
                        <span>{exp.category}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      ${exp.amount.toFixed(2)}
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
        </div>

        {/* Pagination */}
        <div className="p-3.5 px-4 bg-slate-50 dark:bg-[#091510] border-t border-slate-200 dark:border-[#193627] flex items-center justify-between text-xs text-slate-500">
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
