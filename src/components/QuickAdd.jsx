// src/components/QuickAdd.jsx — Round E
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, ArrowDownLeft, ArrowUpRight, Repeat, Bookmark, Save,
  ChevronDown, ChevronUp, Calendar, Hash, Tag, Users, Wallet, Percent, SlidersHorizontal,
} from 'lucide-react';
import {
  useStore, selectRates, selectBaseCurrency, selectEditingTxId, selectTransactions,
  selectCategories, selectTemplates, selectBuckets, selectDebts, selectGoals,
  gatherTags, computeBucketImpact, buildCategoryToBucket,
  BORROWED_CATEGORY, LENT_CATEGORY,
} from '../store/useStore';
import { CURRENCIES, formatMoney } from '../lib/currency';
import DateTimePicker from './DateTimePicker';
import TagInput from './TagInput';
import SpendingWarning from './SpendingWarning';
import * as Icons from 'lucide-react';

const SECTIONS = [
  { id: 'quick',     label: 'Entry',     icon: Plus },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'template',  label: 'Template',  icon: Bookmark },
];

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('quick');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString());

  // Round E: borrow/lend extras
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sourceBucketKey, setSourceBucketKey] = useState('operations');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState('simple');
  // Advanced split (hidden by default for Lent)
  const [advancedSplit, setAdvancedSplit] = useState(false);
  const [bucketSplit, setBucketSplit] = useState({});

  // Foldable sections
  const [showDate, setShowDate] = useState(false);
  const [showTags, setShowTags] = useState(false);

  // Name autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const notesRef = useRef(null);

  // Recurring-specific
  const [recFrequency, setRecFrequency] = useState('monthly');
  const [recInterval, setRecInterval] = useState(1);
  const [recDayOfMonth, setRecDayOfMonth] = useState(new Date().getDate());

  // Template-specific
  const [tplName, setTplName] = useState('');

  // Round E: spending warning state
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingImpact, setPendingImpact] = useState(null);
  const [pendingTxData, setPendingTxData] = useState(null);
  const [pendingWarningBucket, setPendingWarningBucket] = useState(null);

  const addTransaction    = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const setEditingTx      = useStore((s) => s.setEditingTx);
  const addRecurring      = useStore((s) => s.addRecurring);
  const addTemplate       = useStore((s) => s.addTemplate);
  const useTemplate       = useStore((s) => s.useTemplate);

  const editingId  = useStore(selectEditingTxId);
  const transactions = useStore(selectTransactions);
  const categories = useStore(selectCategories);
  const templates  = useStore(selectTemplates);
  const buckets    = useStore(selectBuckets);
  const debts      = useStore(selectDebts);
  const goals      = useStore(selectGoals);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates      = useStore(selectRates);

  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : null;
  const isEditing = !!editingTx;

  const allTags = useMemo(() => gatherTags(transactions), [transactions]);
  const categoryMap = useMemo(() => buildCategoryToBucket(categories), [categories]);

  const availableCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === type && c.enabled !== false)
      .sort((a, b) => a.order - b.order);
  }, [categories, type]);

  const counterpartySuggestions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const d of debts) {
      const c = (d.creditor || '').trim();
      if (c && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase()); out.push(c);
      }
    }
    return out;
  }, [debts]);

  const topTemplates = useMemo(() => {
    return [...templates]
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, 6);
  }, [templates]);

  const nameSuggestions = useMemo(() => {
    const q = notes.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set();
    const matches = [];
    for (const t of transactions) {
      const n = (t.notes || '').trim();
      if (!n) continue;
      const lower = n.toLowerCase();
      if (lower.startsWith(q) && lower !== q && !seen.has(lower)) {
        seen.add(lower);
        matches.push({
          notes: n, amount: t.amount, currency: t.currency, category: t.category, type: t.type,
        });
        if (matches.length >= 5) break;
      }
    }
    return matches;
  }, [notes, transactions]);

  useEffect(() => {
    if (isEditing) return;
    if (availableCategories.length > 0 && !availableCategories.some((c) => c.name === category)) {
      setCategory(availableCategories[0].name);
    }
  }, [type, availableCategories, isEditing]);

  useEffect(() => {
    if (editingTx) {
      setOpen(true);
      setSection('quick');
      setType(editingTx.type);
      setAmount(String(editingTx.amount));
      setCurrency(editingTx.currency || 'USD');
      setCategory(editingTx.category);
      setNotes(editingTx.notes || '');
      setDate(editingTx.date || new Date().toISOString());
      const tagList = (editingTx.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
      setTags(tagList);
    }
  }, [editingTx]);

  const reset = () => {
    setType('expense');
    setAmount('');
    setCurrency('USD');
    setCategory(availableCategories[0]?.name || '');
    setNotes(''); setTags([]);
    setDate(new Date().toISOString());
    setCounterparty(''); setDueDate('');
    setSourceBucketKey('operations');
    setInterestRate(''); setInterestType('simple');
    setAdvancedSplit(false); setBucketSplit({});
    setShowDate(false); setShowTags(false);
    setRecFrequency('monthly'); setRecInterval(1); setRecDayOfMonth(new Date().getDate());
    setTplName(''); setShowSuggestions(false);
  };

  const close = () => {
    setOpen(false);
    setEditingTx(null);
    setSection('quick');
    setWarningOpen(false);
    setPendingImpact(null);
    setPendingTxData(null);
    setPendingWarningBucket(null);
    setTimeout(reset, 250);
  };

  const applySuggestion = (sug) => {
    setNotes(sug.notes);
    setAmount(String(sug.amount));
    setCurrency(sug.currency || 'USD');
    setCategory(sug.category);
    if (sug.type !== type) setType(sug.type);
    setShowSuggestions(false);
  };

  const applyTemplate = (tpl) => {
    setType(tpl.type);
    setAmount(String(tpl.amount));
    setCurrency(tpl.currency || 'USD');
    setCategory(tpl.category);
    setNotes(tpl.notes || tpl.name || '');
    const tagList = (tpl.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
    setTags(tagList);
    setSection('quick');
    useTemplate?.(tpl.id);
  };

  const isBorrowed = type === 'income'  && category === BORROWED_CATEGORY;
  const isLent     = type === 'expense' && category === LENT_CATEGORY;
  const isSpecial  = isBorrowed || isLent;

  // Build the tx payload (used by both immediate save and confirmed-save-after-warning)
  const buildTxData = () => {
    const v = parseFloat(amount);
    const data = {
      type, amount: v, currency, category,
      notes: notes.trim(),
      tags: tags.filter(Boolean).join(','),
      date,
    };
    if (isBorrowed) {
      data.counterparty = counterparty.trim();
      if (dueDate) data.dueDate = new Date(dueDate + 'T00:00:00').toISOString();
      if (interestRate) {
        data.interestRate = Number(interestRate);
        data.interestType = interestType;
      }
    } else if (isLent) {
      data.counterparty = counterparty.trim();
      if (dueDate) data.dueDate = new Date(dueDate + 'T00:00:00').toISOString();
      if (advancedSplit && Object.keys(bucketSplit).length > 0) {
        // Filter out empty entries and ensure they sum (best-effort)
        const cleaned = {};
        for (const [k, val] of Object.entries(bucketSplit)) {
          const n = Number(val) || 0;
          if (n > 0) cleaned[k] = n;
        }
        data.bucketSplit = cleaned;
      } else {
        data.sourceBucketKey = sourceBucketKey;
      }
    }
    return data;
  };

  // Determine the affected bucket for an expense (for SpendingWarning)
  const expenseBucketKey = useMemo(() => {
    if (type !== 'expense' || isLent) return null;
    return categoryMap[category] || 'operations';
  }, [type, isLent, category, categoryMap]);

  const expenseBucket = useMemo(() => {
    if (!expenseBucketKey) return null;
    return buckets.find((b) => b.key === expenseBucketKey) || null;
  }, [expenseBucketKey, buckets]);

  const submit = (e) => {
    e?.preventDefault?.();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    if (isSpecial && !counterparty.trim()) return;

    // Recurring + template paths never trigger the warning — they don't commit
    // immediately. Edit path skips it too (too disruptive).
    if (section !== 'quick' || isEditing) {
      const data = buildTxData();
      if (section === 'quick') {
        if (isEditing) updateTransaction(editingId, data);
        else addTransaction(data);
      } else if (section === 'recurring') {
        addRecurring({
          name: notes.trim() || category,
          amount: v, currency, type, category,
          notes: notes.trim(), tags: tags.filter(Boolean).join(','),
          frequency: recFrequency, interval: recInterval, dayOfMonth: recDayOfMonth,
          startDate: date,
        });
      } else if (section === 'template') {
        const tplDisplayName = tplName.trim() || notes.trim() || category;
        addTemplate({
          name: tplDisplayName, amount: v, currency, type, category,
          notes: notes.trim(), tags: tags.filter(Boolean).join(','),
          icon: 'Tag', color: '#7a8a8c',
        });
      }
      close();
      return;
    }

    // Round E: check for goal-conflict warning on regular expenses
    if (type === 'expense' && !isLent && expenseBucketKey) {
      const hasActiveGoal = goals.some(
        (g) => g.bucketKey === expenseBucketKey && g.status === 'active'
      );
      if (hasActiveGoal) {
        const impact = computeBucketImpact(
          transactions, goals, expenseBucketKey, v, currency, baseCurrency, rates
        );
        if (impact.affectedGoals.length > 0) {
          setPendingImpact(impact);
          setPendingTxData(buildTxData());
          setPendingWarningBucket(expenseBucket);
          setWarningOpen(true);
          return;
        }
      }
    }

    addTransaction(buildTxData());
    close();
  };

  const confirmWarning = () => {
    if (pendingTxData) addTransaction(pendingTxData);
    close();
  };

  const cancelWarning = () => {
    setWarningOpen(false);
    setPendingImpact(null);
    setPendingTxData(null);
    setPendingWarningBucket(null);
  };

  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  const valid = amount && parseFloat(amount) > 0 && (!isSpecial || counterparty.trim().length > 0);

  const sourceBuckets = useMemo(() => {
    return buckets
      .filter((b) => b.enabled !== false)
      .sort((a, b) => a.order - b.order);
  }, [buckets]);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 flex items-center justify-center shadow-xl shadow-black/20"
        aria-label="Add entry"
      >
        <Plus size={24} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto no-scrollbar"
          >
            <div className="min-h-full max-w-2xl mx-auto pb-32">
              <div className="sticky top-0 z-10 bg-[var(--bg)] pt-[env(safe-area-inset-top)] border-b border-[var(--border)]">
                <div className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
                      {isEditing ? 'Edit' : 'New'}
                    </div>
                    <h2 className="font-display text-2xl">
                      {section === 'quick' ? (isEditing ? 'Edit entry' : 'Add entry') :
                       section === 'recurring' ? 'Schedule' : 'Save template'}
                    </h2>
                  </div>
                  <button onClick={close}
                    className="w-9 h-9 rounded-full hover:bg-[var(--surface)] flex items-center justify-center">
                    <X size={18} />
                  </button>
                </div>

                {!isEditing && (
                  <div className="px-5 pb-2">
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--surface)]">
                      {SECTIONS.map((s) => {
                        const Icon = s.icon;
                        const active = section === s.id;
                        return (
                          <button
                            key={s.id} onClick={() => setSection(s.id)}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                              active ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-muted'
                            }`}
                          >
                            <Icon size={12} /> {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 pt-5 space-y-5">
                {section === 'quick' && !isEditing && topTemplates.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                      Quick templates
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
                      {topTemplates.map((tpl) => {
                        const Icon = Icons[tpl.icon] || Tag;
                        return (
                          <button
                            key={tpl.id} onClick={() => applyTemplate(tpl)}
                            className="surface border rounded-xl px-3 py-2.5 flex items-center gap-2 hover:bg-[var(--bg)] transition-colors shrink-0"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${tpl.color}1f`, color: tpl.color }}>
                              <Icon size={13} />
                            </div>
                            <div className="text-left">
                              <div className="text-[12px] font-medium">{tpl.name}</div>
                              <div className="text-[10px] text-muted num">
                                {formatMoney(tpl.amount, tpl.currency)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button" onClick={() => setType('expense')}
                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${
                      type === 'expense'
                        ? 'bg-accent-expense/10 border-accent-expense/30 text-accent-expense'
                        : 'surface text-muted'
                    }`}
                  >
                    <ArrowUpRight size={15} /> Expense
                  </button>
                  <button
                    type="button" onClick={() => setType('income')}
                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${
                      type === 'income'
                        ? 'bg-accent-income/10 border-accent-income/30 text-accent-income'
                        : 'surface text-muted'
                    }`}
                  >
                    <ArrowDownLeft size={15} /> Income
                  </button>
                </div>

                <div className="surface border rounded-2xl p-6">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted text-center mb-2">Amount</div>
                  <div className="flex items-baseline justify-center gap-1">
                    {cfg.prefix && (<span className="font-display text-3xl text-muted">{cfg.prefix}</span>)}
                    <input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      autoFocus={!isEditing}
                      className="bg-transparent outline-none font-display text-5xl text-center num min-w-[3ch] max-w-full"
                      style={{ width: `${Math.max(3, amount.length || 1)}ch` }}
                    />
                    {cfg.suffix && (<span className="font-display text-2xl text-muted">{cfg.suffix}</span>)}
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-4 p-1 rounded-xl bg-[var(--bg)]">
                    {Object.values(CURRENCIES).map((c) => {
                      const sel = currency === c.code;
                      return (
                        <button
                          key={c.code} type="button" onClick={() => setCurrency(c.code)}
                          className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                            sel ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-muted'
                          }`}
                        >
                          {c.code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                    {section === 'recurring' ? 'Schedule name' : section === 'template' ? 'Description' : 'Name / description'}
                  </div>
                  <div className="relative">
                    <input
                      ref={notesRef}
                      type="text" value={notes}
                      onChange={(e) => { setNotes(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder={section === 'quick' ? 'e.g., Coffee at Kafe Anaïs' : 'Name this'}
                      className="w-full px-4 py-3 rounded-xl surface border outline-none focus:ring-2 focus:ring-[var(--text)]/10 text-sm"
                    />
                    <AnimatePresence>
                      {showSuggestions && nameSuggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full mt-1 w-full surface border rounded-xl overflow-hidden z-20 shadow-lg"
                        >
                          {nameSuggestions.map((sug, i) => (
                            <button
                              key={i} type="button"
                              onMouseDown={(e) => { e.preventDefault(); applySuggestion(sug); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg)] flex items-center justify-between gap-3 border-b border-[var(--border)] last:border-b-0"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] truncate">{sug.notes}</div>
                                <div className="text-[10px] text-muted">{sug.category}</div>
                              </div>
                              <div className="text-[11px] num text-muted shrink-0">
                                {formatMoney(sug.amount, sug.currency)}
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">Category</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {availableCategories.map((c) => {
                      const Icon = Icons[c.icon] || Tag;
                      const sel = category === c.name;
                      return (
                        <button
                          key={c.id} type="button" onClick={() => setCategory(c.name)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                            sel
                              ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                              : 'surface'
                          }`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={sel
                              ? { backgroundColor: 'rgba(255,255,255,0.15)' }
                              : { backgroundColor: `${c.color}1f`, color: c.color }
                            }
                          >
                            <Icon size={13} />
                          </div>
                          <span className="text-[11px] font-medium truncate w-full text-center">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Round E: Borrow / Lend extra fields */}
                <AnimatePresence>
                  {isSpecial && section === 'quick' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`rounded-2xl border p-4 space-y-3 ${
                        isBorrowed ? 'bg-accent-income/5 border-accent-income/20' : 'bg-accent-expense/5 border-accent-expense/20'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isBorrowed ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
                          }`}>
                            <Users size={14} />
                          </div>
                          <div className="text-[12px] font-medium">
                            {isBorrowed ? 'Borrowing from someone' : 'Lending to someone'}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 block px-1">
                            {isBorrowed ? 'From whom' : 'To whom'} <span className="text-accent-expense">*</span>
                          </label>
                          <input
                            type="text" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
                            placeholder={isBorrowed ? 'Who lent you this?' : 'Who is borrowing?'}
                            list="counterparty-list"
                            className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm focus:ring-2 focus:ring-[var(--text)]/10"
                          />
                          <datalist id="counterparty-list">
                            {counterpartySuggestions.map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                        </div>

                        {isBorrowed && (
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 flex items-center gap-1 px-1">
                              <Percent size={11} /> Interest rate <span className="opacity-60 normal-case tracking-normal">(annual %, optional)</span>
                            </label>
                            <div className="grid grid-cols-[1fr_auto] gap-2">
                              <input
                                type="number" inputMode="decimal" step="0.01" min="0"
                                value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm num focus:ring-2 focus:ring-[var(--text)]/10"
                              />
                              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                                {[
                                  { id: 'simple',   label: 'Simple' },
                                  { id: 'compound', label: 'Compound' },
                                ].map((m) => {
                                  const sel = interestType === m.id;
                                  return (
                                    <button
                                      key={m.id} type="button" onClick={() => setInterestType(m.id)}
                                      className={`px-3 rounded-lg text-[11px] font-medium ${
                                        sel ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                                      }`}
                                    >
                                      {m.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {isLent && !advancedSplit && (
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 flex items-center gap-1 px-1">
                              <Wallet size={11} /> From which bucket
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              {sourceBuckets.map((b) => {
                                const sel = sourceBucketKey === b.key;
                                return (
                                  <button
                                    key={b.id} type="button" onClick={() => setSourceBucketKey(b.key)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                                      sel
                                        ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                                        : 'bg-[var(--bg)] border-[var(--border)]'
                                    }`}
                                  >
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                                    <span className="text-[11px] font-medium truncate">{b.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {isLent && advancedSplit && (
                          <div>
                            <label className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 flex items-center gap-1 px-1">
                              <SlidersHorizontal size={11} /> Split across buckets
                            </label>
                            <div className="space-y-2">
                              {sourceBuckets.map((b) => (
                                <div key={b.id} className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                                  <span className="text-[12px] flex-1 truncate">{b.name}</span>
                                  <input
                                    type="number" inputMode="decimal" step="0.01" min="0"
                                    value={bucketSplit[b.key] || ''}
                                    onChange={(e) => setBucketSplit({ ...bucketSplit, [b.key]: e.target.value })}
                                    placeholder="0"
                                    className="w-24 px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] outline-none text-xs num text-right"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isLent && (
                          <button
                            type="button"
                            onClick={() => setAdvancedSplit((v) => !v)}
                            className="text-[10px] text-muted hover:text-[var(--text)] flex items-center gap-1 px-1"
                          >
                            <SlidersHorizontal size={10} />
                            {advancedSplit ? 'Use single bucket' : 'Advanced: split across buckets'}
                          </button>
                        )}

                        <div>
                          <label className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 flex items-center gap-1 px-1">
                            <Calendar size={11} /> Due date <span className="opacity-60 normal-case tracking-normal">(optional)</span>
                          </label>
                          <input
                            type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm num focus:ring-2 focus:ring-[var(--text)]/10"
                          />
                        </div>

                        <p className="text-[10px] text-muted px-1">
                          {isBorrowed
                            ? 'This will appear as Borrowed Capital on Home — separate from your cash. Deploy it into investments or ventures from the Wealth tab.'
                            : 'Money leaves your bucket and an entry appears in the Debt tab under Owed to you.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {section === 'recurring' && (
                  <RecurringFields
                    frequency={recFrequency} setFrequency={setRecFrequency}
                    interval={recInterval} setInterval={setRecInterval}
                    dayOfMonth={recDayOfMonth} setDayOfMonth={setRecDayOfMonth}
                  />
                )}

                {section === 'template' && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">Template name</div>
                    <input
                      type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
                      placeholder="e.g., Morning coffee"
                      className="w-full px-4 py-3 rounded-xl surface border outline-none text-sm"
                    />
                  </div>
                )}

                <FoldableSection
                  icon={Calendar}
                  label={section === 'recurring' ? 'Start date' : 'Date'}
                  preview={formatDatePreview(date)}
                  open={showDate}
                  onToggle={() => setShowDate(!showDate)}
                >
                  <DateTimePicker value={date} onChange={setDate} />
                </FoldableSection>

                {section !== 'recurring' && (
                  <FoldableSection
                    icon={Hash}
                    label="Tags"
                    preview={tags.length > 0 ? tags.map((t) => `#${t}`).join(' ') : 'none'}
                    open={showTags}
                    onToggle={() => setShowTags(!showTags)}
                  >
                    <TagInput value={tags} onChange={setTags} suggestions={allTags} />
                  </FoldableSection>
                )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--bg)] border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]">
                <div className="max-w-2xl mx-auto px-5 py-3">
                  <button
                    onClick={submit}
                    disabled={!valid}
                    className="w-full py-4 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40 active:scale-[0.99] transition-transform flex items-center justify-center gap-2"
                  >
                    {section === 'quick' && <><Save size={15} /> {isEditing ? 'Save changes' : 'Add entry'}</>}
                    {section === 'recurring' && <><Repeat size={15} /> Save schedule</>}
                    {section === 'template' && <><Bookmark size={15} /> Save template</>}
                  </button>
                  {isSpecial && !counterparty.trim() && (
                    <p className="text-[10px] text-accent-expense text-center mt-2">
                      {isBorrowed ? 'Who did you borrow from?' : 'Who did you lend to?'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round E: SpendingWarning overlay */}
      <SpendingWarning
        open={warningOpen}
        impact={pendingImpact}
        pendingTx={pendingTxData}
        bucketName={pendingWarningBucket?.name}
        bucketColor={pendingWarningBucket?.color}
        baseCurrency={baseCurrency}
        onConfirm={confirmWarning}
        onCancel={cancelWarning}
      />
    </>
  );
}

function FoldableSection({ icon: Icon, label, preview, open, onToggle, children }) {
  return (
    <div className="surface border rounded-xl overflow-hidden">
      <button
        type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] transition-colors text-left"
      >
        <Icon size={15} className="text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</div>
          <div className="text-[12px] truncate">{preview}</div>
        </div>
        {open ? <ChevronUp size={15} className="text-muted shrink-0" /> : <ChevronDown size={15} className="text-muted shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-[var(--border)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecurringFields({ frequency, setFrequency, interval, setInterval, dayOfMonth, setDayOfMonth }) {
  const FREQS = [
    { id: 'daily',   label: 'Daily' },
    { id: 'weekly',  label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly',  label: 'Yearly' },
  ];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">Frequency</div>
      <div className="grid grid-cols-4 gap-1.5">
        {FREQS.map((f) => {
          const sel = frequency === f.id;
          return (
            <button
              key={f.id} type="button" onClick={() => setFrequency(f.id)}
              className={`py-2.5 rounded-xl text-xs font-medium transition-all ${
                sel ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'surface text-muted'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {frequency === 'monthly' && (
        <div className="mt-3 surface border rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] text-muted">Day of month</span>
          <input
            type="number" min="1" max="28" value={dayOfMonth}
            onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
            className="w-16 bg-[var(--bg)] outline-none rounded-md px-2 py-1 num text-right text-sm"
          />
        </div>
      )}
    </div>
  );
}

function formatDatePreview(iso) {
  if (!iso) return 'Now';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
