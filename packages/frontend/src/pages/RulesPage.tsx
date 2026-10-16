import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Layers,
  Sliders,
  History,
  X,
  Bot,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import { WorkspaceCard } from '../components/reactbits/WorkspaceCard';
import type { AutomationRule } from '../types';

export const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');

  // Rule creation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [rulePriority, setRulePriority] = useState(5);
  const [matchType, setMatchType] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<Array<{ field: string; operator: string; value: string }>>([
    { field: 'vendor_name', operator: 'contains', value: '' }
  ]);
  const [actions, setActions] = useState<Array<{ type: string; value: string }>>([
    { type: 'set_category', value: 'Software' }
  ]);

  // AI Assistant prompt
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    loadRulesAndHistory();
  }, []);

  const loadRulesAndHistory = async () => {
    setIsLoading(true);
    try {
      const [rulesList, historyList] = await Promise.all([
        api.getRules(),
        api.getRuleHistory(30)
      ]);
      setRules(rulesList);
      setHistory(historyList);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      await api.updateRule(rule.id, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Delete this automation rule?')) return;
    try {
      await api.deleteRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleAddCondition = () => {
    setConditions(prev => [...prev, { field: 'vendor_name', operator: 'contains', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    setActions(prev => [...prev, { type: 'add_tag', value: '' }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || conditions.length === 0 || actions.length === 0) return;

    try {
      await api.createRule({
        name: ruleName.trim(),
        enabled: true,
        priority: Number(rulePriority),
        condition_match_type: matchType,
        conditions: conditions.map(c => ({
          field: c.field,
          operator: c.operator,
          value: c.field === 'total_amount' ? Number(c.value) : c.value
        })),
        actions
      });
      setIsModalOpen(false);
      resetModal();
      loadRulesAndHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to create rule');
    }
  };

  const handleGenerateWithGemma = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await api.interpretRuleWithGemma(aiPrompt);
      if (res.success && res.proposedRule) {
        const prop = res.proposedRule;
        setRuleName(prop.name || 'AI Generated Rule');
        setRulePriority(prop.priority || 5);
        setMatchType(prop.condition_match_type || 'AND');
        setConditions(prop.conditions?.map((c: any) => ({
          field: c.field,
          operator: c.operator,
          value: String(c.value)
        })) || []);
        setActions(prop.actions || []);
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to interpret prompt with local Gemma model');
    } finally {
      setIsAiLoading(false);
    }
  };

  const resetModal = () => {
    setRuleName('');
    setRulePriority(5);
    setMatchType('AND');
    setConditions([{ field: 'vendor_name', operator: 'contains', value: '' }]);
    setActions([{ type: 'set_category', value: 'Software' }]);
    setAiPrompt('');
    setAiError(null);
  };

  return (
    <div className="p-6 lg:px-10 gap-5 w-full h-full min-h-0 flex-1 flex flex-col overflow-y-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 drop-shadow-sm">
            <span>Automation Rules</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Gemma Assisted
            </span>
          </h2>
          <p className="text-xs font-bold text-slate-300 mt-0.5">
            Define deterministic condition-action workflows to automatically categorize, tag, and route invoices
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#11241c] p-1 border border-slate-200 dark:border-[#1e3c2c] text-xs font-semibold">
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-white dark:bg-[#1d3d2e] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Active Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-[#1d3d2e] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Execution History
            </button>
          </div>

          <button
            onClick={() => { resetModal(); setIsModalOpen(true); }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <Plus className="size-3.5" />
            <span>Create Rule</span>
          </button>
        </div>
      </div>

      {activeTab === 'rules' ? (
        /* Rules List */
        <div className="space-y-3 flex-1 flex flex-col">
          {rules.map((rule) => (
            <WorkspaceCard
              key={rule.id}
              spotlightColor={rule.enabled ? '#7B35FF' : '#64748b'}
              surface={rule.enabled ? '#0c1813' : '#08100c'}
              className={rule.enabled ? '' : 'opacity-65'}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`size-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    rule.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {rule.priority}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{rule.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ({rule.condition_match_type} logic)
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Executed {rule.execution_count} time(s) • Last run: {rule.last_executed_at || 'Never'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Enable / Disable Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      rule.enabled
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                    title="Delete rule"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Conditions & Actions Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-[#152e23] text-xs">
                {/* Conditions */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    If ({rule.condition_match_type})
                  </span>
                  <div className="space-y-1">
                    {rule.conditions.map((cond, idx) => (
                      <div key={idx} className="p-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-[#11241c] border border-slate-200 dark:border-[#1b3b2c] font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{cond.field}</span>{' '}
                        <span className="text-slate-400">{cond.operator}</span>{' '}
                        <span className="font-bold text-slate-900 dark:text-white">"{cond.value}"</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Then Apply
                  </span>
                  <div className="space-y-1">
                    {rule.actions.map((act, idx) => (
                      <div key={idx} className="p-1.5 px-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                        <span className="font-semibold">{act.type}</span> →{' '}
                        <span className="font-bold">{act.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </WorkspaceCard>
          ))}

          {rules.length === 0 && !isLoading && (
            <WorkspaceCard spotlightColor="#7B35FF" className="py-12 flex-1 flex items-center justify-center text-center text-xs font-bold text-slate-200">
              No automation rules created yet. Click &quot;+ Create Rule&quot; to build your first workflow.
            </WorkspaceCard>
          )}
        </div>
      ) : (
        /* History Log */
        <WorkspaceCard spotlightColor="#7B35FF" className="!p-0 overflow-hidden text-xs flex-1 flex flex-col">
          <table className="w-full text-left">
            <thead className="bg-[#0d221a]/90 text-emerald-300/90 uppercase text-[11px] font-extrabold tracking-wider border-b border-emerald-500/20">
              <tr>
                <th className="py-3 px-3">Executed At</th>
                <th className="py-3 px-3">Rule Name</th>
                <th className="py-3 px-3">Triggered By Document</th>
                <th className="py-3 px-3">Actions Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-emerald-500/10">
                  <td className="py-3 px-3 font-mono font-bold text-slate-200">{h.executed_at}</td>
                  <td className="py-3 px-3 font-extrabold text-white">{h.rule_name}</td>
                  <td className="py-3 px-3 font-bold text-slate-100 truncate max-w-xs">{h.original_filename}</td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {h.actions_applied?.map((act: any, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-[10px]">
                          {act.type}: {act.value}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center font-bold text-slate-300">No rule execution logs recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </WorkspaceCard>
      )}

      {/* Visual Rule Builder Modal with Gemma Assistant */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-[#1e3c2c] w-full max-w-2xl rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1a3628] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Rule Builder</h3>
                <p className="text-xs text-slate-400">Build automated actions or let Gemma translate your instructions</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="size-4.5" />
              </button>
            </div>

            {/* Gemma Natural Language Assistant Box */}
            <div className="p-4 rounded-xl bg-gradient-to-tr from-emerald-950/30 to-teal-950/20 border border-emerald-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Bot className="size-4 text-emerald-400" />
                <span>Gemma Natural Language Assistant</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Describe your rule in plain English (e.g., "When vendor is Cloudflare, set category to Software and add tech tag"):
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGenerateWithGemma())}
                  placeholder="e.g. When total is greater than 1000, flag for review and set priority high"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleGenerateWithGemma}
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-1 cursor-pointer"
                >
                  {isAiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  <span>Generate</span>
                </button>
              </div>
              {aiError && <p className="text-rose-400 text-[11px]">{aiError}</p>}
            </div>

            {/* Standard Visual Rule Form */}
            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Auto-tag Cloudflare Invoices"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={rulePriority}
                    onChange={(e) => setRulePriority(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510] text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Conditions Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Conditions</span>
                    <select
                      value={matchType}
                      onChange={(e) => setMatchType(e.target.value as 'AND' | 'OR')}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-[#1e3c2c] bg-slate-50 dark:bg-[#091510] text-[11px] font-bold text-emerald-500"
                    >
                      <option value="AND">Match ALL (AND)</option>
                      <option value="OR">Match ANY (OR)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="text-emerald-500 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Condition
                  </button>
                </div>

                <div className="space-y-2">
                  {conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={cond.field}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].field = e.target.value;
                          setConditions(updated);
                        }}
                        className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510]"
                      >
                        <option value="vendor_name">Vendor Name</option>
                        <option value="total_amount">Total Amount</option>
                        <option value="original_filename">Filename</option>
                        <option value="document_type">Document Type</option>
                        <option value="currency">Currency</option>
                        <option value="invoice_number">Invoice #</option>
                        <option value="extracted_text">Document Text</option>
                      </select>

                      <select
                        value={cond.operator}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].operator = e.target.value;
                          setConditions(updated);
                        }}
                        className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510]"
                      >
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="not_contains">not contains</option>
                        <option value="greater_than">greater than</option>
                        <option value="less_than">less than</option>
                      </select>

                      <input
                        type="text"
                        required
                        value={cond.value}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].value = e.target.value;
                          setConditions(updated);
                        }}
                        placeholder="Value to match"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510]"
                      />

                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Builder */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#152e23]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Actions</span>
                  <button
                    type="button"
                    onClick={handleAddAction}
                    className="text-emerald-500 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Action
                  </button>
                </div>

                <div className="space-y-2">
                  {actions.map((act, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={act.type}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].type = e.target.value;
                          setActions(updated);
                        }}
                        className="w-48 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510]"
                      >
                        <option value="set_category">Assign Category</option>
                        <option value="add_tag">Add Custom Tag</option>
                        <option value="set_priority">Set Review Priority</option>
                        <option value="flag_review">Flag for Review</option>
                        <option value="flag_duplicate">Flag as Duplicate</option>
                        <option value="exclude_from_reports">Exclude from Reports</option>
                      </select>

                      <input
                        type="text"
                        required
                        value={act.value}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx].value = e.target.value;
                          setActions(updated);
                        }}
                        placeholder="Value (e.g. Software, urgent, client)"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1e3c2c] bg-white dark:bg-[#091510]"
                      />

                      {actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAction(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-[#152e23]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer"
                >
                  Activate Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
