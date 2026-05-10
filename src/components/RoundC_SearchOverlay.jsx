// src/components/SearchOverlay.jsx
// ROUND C — REPLACE the entire file with this version.
//
// What's new:
//   • Date range filter row inside the filter panel
//   • Presets: Today, Yesterday, This week, This month, Last month, Custom
//   • Custom opens two date inputs (from / to)
//   • Plumbs into searchTransactions which already supports dateFrom/dateTo

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowDownLeft, ArrowUpRight, SlidersHorizontal, Hash, Calendar } from 'lucide-react';
import {
  useStore, selectTransactions, selectCategories, selectBaseCurrency, selectRates,
  selectSearchOpen, selectSearchQuery,
  searchTransactions, gatherTags,
} from '../store/useStore';
import { convert, formatMoney } from '../lib/currency';
import { useTxActions } from './TxActions';
import { relativeTime } from '../lib/util';

// Date range preset helpers — return ISO date strings (YYYY-MM-DD)
function presetRange(id) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);

  const startOfWeek = new Date(today);
  // Week starts Sunday (matches the rest of the app's recurring scheduler)
  startOfWeek.setDate(today.getDate() - today.getDay());

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0);

  // End-of-day for the "to" bound (23:59:59.999)
  const eod = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x.toISOString();
  };
  const sod = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString();
  };

  switch (id) {
    case 'today':      return { from: sod(today),          to: eod(today) };
    case 'yesterday':  return { from: sod(yest),           to: eod(yest)  };
    case 'thisWeek':   return { from: sod(startOfWeek),    to: eod(today) };
    case 'thisMonth':  return { from: sod(startOfMonth),   to: eod(endOfThisMonth) };
    case 'lastMonth':  return { from: sod(startOfLastMonth), to: eod(endOfLastMonth) };
    default:           return null;
  }
}

const DATE_PRESETS = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisWeek',  label: 'This week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom',    label: 'Custom' },
];

export default function SearchOverlay() {
  const open = useStore(selectSearchOpen);
  const query = useStore(selectSearchQuery);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const transactions = useStore(selectTransactions);
  const categories = useStore(selectCategories);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);

  const [filterType, setFilterType] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [filterTags, setFilterTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef(null);

  // ─── Round C: date range state ─────────────────────────────────
  const [datePreset, setDatePreset] = useState(null);  // null | 'today' | … | 'custom'
  const [customFrom, setCustomFrom] = useState('');    // YYYY-MM-DD
  const [customTo, setCustomTo]     = useState('');

  const allTags = useMemo(() => gatherTags(transactions), [transactions]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset filters on close
      setFilterType(null);
      setFilterCategory(null);
      setFilterTags([]);
      setShowFilters(false);
      setDatePreset(null);
      setCustomFrom('');
      setCustomTo('');
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Resolve the active date range from preset or custom fields
  const dateRange = useMemo(() => {
    if (!datePreset) return { from: null, to: null };
    if (datePreset === 'custom') {
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : null,
        to:   customTo   ? new Date(customTo   + 'T23:59:59').toISOString() : null,
      };
    }
    return presetRange(datePreset) || { from: null, to: null };
  }, [datePreset, customFrom, customTo]);

  const results = useMemo(() => {
    const filtered = searchTransactions(transactions, {
      query,
      type: filterType,
      category: filterCategory,
      tags: filterTags,
      dateFrom: dateRange.from,
      dateTo:   dateRange.to,
    });
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, query, filterType, filterCategory, filterTags, dateRange]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of results) {
      if (t.type === 'transfer') continue;
      const v = convert(Math.abs(t.amount), t.currency || 'USD', baseCurrency, rates);
      if (t.type === 'income') income += v;
      if (t.type === 'expense') expense += v;
    }
    return { income, expense };
  }, [results, baseCurrency, rates]);

  const { bind, sheet } = useTxActions();

  const dateActive = !!datePreset && (datePreset !== 'custom' || customFrom || customTo);
  const filterCount =
    (filterType ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    filterTags.length +
    (dateActive ? 1 : 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-[var(--bg)]"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 surface border-b">
            <div className="max-w-2xl mx-auto px-4 pt-[env(safe-area-inset-top)]">
              <div className="flex items-center gap-2 py-3">
                <button onClick={() => setSearchOpen(false)}
                  className="w-9 h-9 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={18} />
                </button>
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg)]">
                  <Search size={15} className="text-muted shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes, categories, amounts…"
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted"
                  />
                  {query && (
                    <button onClick={() => setSearchQuery('')}
                      className="w-5 h-5 rounded-full bg-[var(--surface)] flex items-center justify-center text-muted">
                      <X size={11} />
                    </button>
                  )}
                </div>
                <button onClick={() => setShowFilters((v) => !v)}
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    showFilters || filterCount > 0 ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'hover:bg-[var(--bg)]'
                  }`}>
                  <SlidersHorizontal size={16} />
                  {filterCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent-expense text-white text-[9px] flex items-center justify-center font-bold">
                      {filterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pb-3">
                      {/* Date range — Round C */}
                      <div>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted mb-1.5">
                          <Calendar size={11} /> Date range
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <FilterChip active={datePreset === null} onClick={() => setDatePreset(null)}>Any time</FilterChip>
                          {DATE_PRESETS.map((p) => (
                            <FilterChip
                              key={p.id}
                              active={datePreset === p.id}
                              onClick={() => setDatePreset(datePreset === p.id ? null : p.id)}
                            >
                              {p.label}
                            </FilterChip>
                          ))}
                        </div>
                        <AnimatePresence>
                          {datePreset === 'custom' && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <div className="text-[10px] text-muted mb-1 px-1">From</div>
                                  <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    max={customTo || undefined}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs num focus:ring-2 focus:ring-[var(--border)]"
                                  />
                                </div>
                                <div>
                                  <div className="text-[10px] text-muted mb-1 px-1">To</div>
                                  <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    min={customFrom || undefined}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs num focus:ring-2 focus:ring-[var(--border)]"
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Type */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted shrink-0">Type</span>
                        <div className="flex gap-1.5">
                          <FilterChip active={filterType === null} onClick={() => setFilterType(null)}>Any</FilterChip>
                          <FilterChip active={filterType === 'income'} onClick={() => setFilterType('income')}>Income</FilterChip>
                          <FilterChip active={filterType === 'expense'} onClick={() => setFilterType('expense')}>Expense</FilterChip>
                        </div>
                      </div>

                      {/* Categories */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Category</div>
                        <div className="flex flex-wrap gap-1.5">
                          <FilterChip active={filterCategory === null} onClick={() => setFilterCategory(null)}>Any</FilterChip>
                          {categories
                            .filter((c) => filterType === null || c.type === filterType)
                            .filter((c) => c.enabled !== false)
                            .map((c) => (
                              <FilterChip
                                key={c.id}
                                active={filterCategory === c.name}
                                onClick={() => setFilterCategory(filterCategory === c.name ? null : c.name)}
                              >
                                {c.name}
                              </FilterChip>
                            ))}
                        </div>
                      </div>

                      {/* Tags */}
                      {allTags.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Tags</div>
                          <div className="flex flex-wrap gap-1.5">
                            {allTags.map((t) => (
                              <FilterChip
                                key={t}
                                active={filterTags.includes(t)}
                                onClick={() => setFilterTags((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t])}
                              >
                                <Hash size={10} className="-mr-1" />
                                {t}
                              </FilterChip>
                            ))}
                          </div>
                        </div>
                      )}

                      {filterCount > 0 && (
                        <button
                          onClick={() => {
                            setFilterType(null);
                            setFilterCategory(null);
                            setFilterTags([]);
                            setDatePreset(null);
                            setCustomFrom('');
                            setCustomTo('');
                          }}
                          className="text-[11px] text-accent-expense hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Results */}
          <div className="max-w-2xl mx-auto px-4 py-4 pb-[env(safe-area-inset-bottom)] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
            {/* Summary */}
            <div className="flex items-baseline justify-between mb-3 px-1">
              <span className="text-[11px] text-muted">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </span>
              <div className="flex gap-3 text-[11px] num">
                {totals.income > 0 && (
                  <span className="text-accent-income">+{formatMoney(totals.income, baseCurrency)}</span>
                )}
                {totals.expense > 0 && (
                  <span className="text-accent-expense">−{formatMoney(totals.expense, baseCurrency)}</span>
                )}
              </div>
            </div>

            {results.length === 0 ? (
              <div className="surface border rounded-2xl p-8 text-center">
                <Search size={26} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
                <div className="font-display text-lg mb-1">No matches</div>
                <div className="text-sm text-muted">
                  {query || filterCount > 0 ? 'Try a different search or clear filters' : 'Start typing to search'}
                </div>
              </div>
            ) : (
              <ul className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
                {results.map((t) => (
                  <ResultRow key={t.id} tx={t} baseCurrency={baseCurrency} rates={rates} bind={bind} />
                ))}
              </ul>
            )}
          </div>

          {sheet}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
          : 'border-[var(--border)] text-muted hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}

function ResultRow({ tx, baseCurrency, rates, bind }) {
  const isIncome = tx.type === 'income';
  const inBase = convert(Math.abs(tx.amount), tx.currency || 'USD', baseCurrency, rates);
  const showConversion = (tx.currency || 'USD') !== baseCurrency;
  const tagList = (tx.tags || '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <li
      {...bind(tx)}
      className="flex items-center gap-3 px-4 py-3 select-none cursor-pointer active:bg-[var(--bg)] transition-colors"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
      }`}>
        {isIncome ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{tx.notes || tx.category}</div>
        <div className="text-[11px] text-muted truncate">
          {tx.category} · {relativeTime(tx.date)}
          {tagList.length > 0 && (
            <> · <span className="text-[10px]">#{tagList.join(' #')}</span></>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-medium num text-sm ${isIncome ? 'text-accent-income' : ''}`}>
          {isIncome ? '+' : '−'}{formatMoney(Math.abs(tx.amount), tx.currency || 'USD')}
        </div>
        {showConversion && (
          <div className="text-[10px] text-muted num">≈ {formatMoney(inBase, baseCurrency)}</div>
        )}
      </div>
    </li>
  );
}
