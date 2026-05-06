// src/components/QuickAdd.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, ArrowDownLeft, ArrowUpRight, Repeat, Bookmark, Save,
} from 'lucide-react';
import {
  useStore, selectRates, selectBaseCurrency, selectEditingTxId, selectTransactions,
  selectCategories, selectTemplates, gatherTags,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';
import DateTimePicker from './DateTimePicker';
import TagInput from './TagInput';
import * as Icons from 'lucide-react';

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('quick'); // 'quick' | 'recurring' | 'template'
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString());
  const amountRef = useRef(null);

  // Recurring-specific fields
  const [recName, setRecName] = useState('');
  const [recFrequency, setRecFrequency] = useState('monthly');
  const [recInterval, setRecInterval] = useState(1);
  const [recDayOfMonth, setRecDayOfMonth] = useState(new Date().getDate());

  // Template-specific
  const [tplName, setTplName] = useState('');

  const addTransaction = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const setEditingTx = useStore((s) => s.setEditingTx);
  const addRecurring = useStore((s) => s.addRecurring);
  const addTemplate = useStore((s) => s.addTemplate);
  const useTemplate = useStore((s) => s.useTemplate);

  const editingId = useStore(selectEditingTxId);
  const transactions = useStore(selectTransactions);
  const categories = useStore(selectCategories);
  const templates = useStore(selectTemplates);
  const rates = useStore(selectRates);
  const baseCurrency = useStore(selectBaseCurrency);

  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : null;
  const isEditing = !!editingTx;

  const allTags = useMemo(() => gatherTags(transactions), [transactions]);

  // Categories filtered by type
  const availableCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === type && c.enabled !== false)
      .sort((a, b) => a.order - b.order);
  }, [categories, type]);

  // Top templates (most-used)
  const topTemplates = useMemo(() => {
    return [...templates]
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, 6);
  }, [templates]);

  // Pick a default category when type changes
  useEffect(() => {
    if (isEditing) return;
    if (availableCategories.length > 0 && !availableCategories.some((c) => c.name === category)) {
      setCategory(availableCategories[0].name);
    }
  }, [type, availableCategories, isEditing]);

  // Open in edit mode
  useEffect(() => {
    if (editingTx) {
      setSection('quick');
      setType(editingTx.type);
      setAmount(String(editingTx.amount));
      setCurrency(editingTx.currency || 'USD');
      setCategory(editingTx.category);
      setNotes(editingTx.notes || '');
      setDate(editingTx.date || new Date().toISOString());
      const tagList = (editingTx.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
      setTags(tagList);
      setOpen(true);
    }
  }, [editingId]);

  useEffect(() => {
    if (open && !isEditing && section === 'quick') {
      setTimeout(() => amountRef.current?.focus(), 250);
    }
  }, [open, isEditing, section]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const reset = () => {
    setAmount(''); setNotes(''); setType('expense'); setCurrency('USD');
    setTags([]); setDate(new Date().toISOString());
    setRecName(''); setRecFrequency('monthly'); setRecInterval(1);
    setRecDayOfMonth(new Date().getDate());
    setTplName('');
    setSection('quick');
  };

  const closeSheet = () => {
    setOpen(false);
    if (isEditing) setEditingTx(null);
    setTimeout(reset, 250);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return;

    if (section === 'recurring') {
      addRecurring({
        name: recName.trim() || `${type === 'income' ? 'Income' : 'Expense'} · ${category}`,
        amount: value,
        currency,
        type,
        category,
        notes: notes.trim(),
        tags,
        frequency: recFrequency,
        interval: recInterval,
        dayOfMonth: recDayOfMonth,
        startDate: date,
        nextDueAt: date,
      });
      closeSheet();
      return;
    }

    if (section === 'template') {
      addTemplate({
        name: tplName.trim() || `${category} · ${value} ${currency}`,
        amount: value,
        currency,
        type,
        category,
        notes: notes.trim(),
        tags,
        icon: 'Bookmark',
        color: '#7a8a8c',
      });
      closeSheet();
      return;
    }

    // Default: just add transaction
    if (isEditing) {
      updateTransaction(editingTx.id, {
        amount: value, currency, category, type,
        notes: notes.trim(), tags, date,
      });
    } else {
      addTransaction({
        amount: value, currency, category, type,
        notes: notes.trim(), tags, date,
      });
    }
    closeSheet();
  };

  const previewBase = amount && currency !== baseCurrency
    ? convert(parseFloat(amount) || 0, currency, baseCurrency, rates)
    : null;

  const cfg = CURRENCIES[currency];

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-2xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 shadow-2xl shadow-black/30 flex items-center justify-center"
        aria-label="Add transaction"
      >
        <Plus size={22} strokeWidth={2.25} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeSheet}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) closeSheet();
              }}
              className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
              </div>

              <div className="px-5 pt-2 pb-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-2xl">
                    {isEditing ? 'Edit entry'
                      : section === 'recurring' ? 'New recurring'
                      : section === 'template'  ? 'New template'
                      : 'New entry'}
                  </h2>
                  <button onClick={closeSheet}
                    className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>

                {/* Templates strip — only on quick mode, not editing */}
                {section === 'quick' && !isEditing && topTemplates.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                      Quick templates
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {topTemplates.map((t) => (
                        <TemplateChip
                          key={t.id}
                          template={t}
                          onUse={() => { useTemplate(t.id, date); closeSheet(); }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Recurring name field */}
                  {section === 'recurring' && (
                    <input
                      type="text" value={recName} onChange={(e) => setRecName(e.target.value)}
                      placeholder="Schedule name (e.g., Netflix, Salary)"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-[var(--border)]"
                    />
                  )}

                  {/* Template name field */}
                  {section === 'template' && (
                    <input
                      type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
                      placeholder="Template name (e.g., Coffee, Lunch)"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-[var(--border)]"
                    />
                  )}

                  {/* Income/expense toggle */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                    <button type="button" onClick={() => setType('expense')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        type === 'expense' ? 'bg-[var(--surface)] shadow-sm text-accent-expense' : 'text-muted'
                      }`}>
                      <ArrowUpRight size={15} /> Expense
                    </button>
                    <button type="button" onClick={() => setType('income')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        type === 'income' ? 'bg-[var(--surface)] shadow-sm text-accent-income' : 'text-muted'
                      }`}>
                      <ArrowDownLeft size={15} /> Income
                    </button>
                  </div>

                  {/* Currency */}
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                    {Object.values(CURRENCIES).map((c) => (
                      <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                          currency === c.code
                            ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]'
                            : 'text-muted'
                        }`}>
                        {c.code === 'HTG' ? c.code : <><span className="font-display mr-1">{c.symbol}</span>{c.code}</>}
                      </button>
                    ))}
                  </div>

                  {/* Amount hero */}
                  <div className="bg-[var(--bg)] rounded-2xl px-5 py-6 text-center">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Amount</div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-display text-3xl text-muted">{cfg.prefix}</span>
                      <input
                        ref={amountRef} type="number" inputMode="decimal" step="0.01" min="0"
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full max-w-[200px] bg-transparent outline-none font-display text-5xl text-center num"
                      />
                      {cfg.suffix && (
                        <span className="font-display text-3xl text-muted">{cfg.suffix}</span>
                      )}
                    </div>
                    {previewBase !== null && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-muted mt-2 num">
                        ≈ {formatMoney(previewBase, baseCurrency)}
                      </motion.div>
                    )}
                  </div>

                  {/* Categories */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 px-1">Category</div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCategories.map((c) => (
                        <CategoryChip
                          key={c.id}
                          category={c}
                          selected={category === c.name}
                          onSelect={() => setCategory(c.name)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Date/time picker (not shown for templates — they're date-less) */}
                  {section !== 'template' && (
                    <DateTimePicker
                      value={date}
                      onChange={setDate}
                      label={section === 'recurring' ? 'First occurrence' : 'When'}
                    />
                  )}

                  {/* Recurring frequency settings */}
                  {section === 'recurring' && (
                    <div className="space-y-3 p-3 rounded-xl bg-[var(--bg)]">
                      <div className="flex items-center gap-2">
                        <Repeat size={14} className="text-muted shrink-0" />
                        <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">Repeats</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['daily', 'weekly', 'monthly', 'yearly'].map((f) => (
                          <button key={f} type="button" onClick={() => setRecFrequency(f)}
                            className={`py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                              recFrequency === f
                                ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
                                : 'bg-[var(--surface)] text-muted'
                            }`}>
                            {f}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-muted">Every</span>
                        <input
                          type="number" min="1" max="60"
                          value={recInterval} onChange={(e) => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-1.5 rounded-md bg-[var(--surface)] border outline-none num text-center"
                        />
                        <span className="text-muted">{frequencyUnit(recFrequency, recInterval)}</span>
                      </div>
                      {recFrequency === 'monthly' && (
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="text-muted">On day</span>
                          <input
                            type="number" min="1" max="31"
                            value={recDayOfMonth} onChange={(e) => setRecDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                            className="w-16 px-2 py-1.5 rounded-md bg-[var(--surface)] border outline-none num text-center"
                          />
                          <span className="text-muted">of the month</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <input
                    type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-[var(--border)]"
                  />

                  {/* Tags */}
                  <TagInput value={tags} onChange={setTags} allTags={allTags} />

                  {/* Submit */}
                  <button type="submit" disabled={!amount || parseFloat(amount) <= 0}
                    className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform">
                    {isEditing ? 'Save changes'
                      : section === 'recurring' ? 'Create schedule'
                      : section === 'template' ? 'Save template'
                      : 'Save entry'}
                  </button>

                  {/* Mode switcher — only when adding fresh */}
                  {!isEditing && (
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <SwitchButton active={section === 'quick'} onClick={() => setSection('quick')} icon={Plus} label="Entry" />
                      <SwitchButton active={section === 'recurring'} onClick={() => setSection('recurring')} icon={Repeat} label="Recurring" />
                      <SwitchButton active={section === 'template'} onClick={() => setSection('template')} icon={Bookmark} label="Template" />
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function TemplateChip({ template, onUse }) {
  const Icon = Icons[template.icon] || Bookmark;
  const sign = template.type === 'income' ? '+' : '−';
  const cfg = CURRENCIES[template.currency] || CURRENCIES.USD;
  return (
    <button
      type="button" onClick={onUse}
      className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors active:scale-[0.97]"
    >
      <Icon size={13} style={{ color: template.color }} />
      <div className="text-left">
        <div className="text-[12px] font-medium leading-tight">{template.name}</div>
        <div className="text-[10px] text-muted num">
          {sign}{cfg.prefix}{template.amount}{cfg.suffix}
        </div>
      </div>
    </button>
  );
}

function CategoryChip({ category, selected, onSelect }) {
  const Icon = Icons[category.icon] || Icons.Tag;
  return (
    <button type="button" onClick={onSelect}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        selected
          ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
          : 'border-[var(--border)] text-muted hover:text-[var(--text)]'
      }`}
    >
      <Icon size={11} />
      {category.name}
    </button>
  );
}

function SwitchButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
        active
          ? 'bg-[var(--bg)] text-[var(--text)]'
          : 'text-muted hover:text-[var(--text)]'
      }`}>
      <Icon size={12} />
      {label}
    </button>
  );
}

function frequencyUnit(freq, interval) {
  const plural = interval > 1;
  if (freq === 'daily') return plural ? 'days' : 'day';
  if (freq === 'weekly') return plural ? 'weeks' : 'week';
  if (freq === 'monthly') return plural ? 'months' : 'month';
  if (freq === 'yearly') return plural ? 'years' : 'year';
  return '';
}
