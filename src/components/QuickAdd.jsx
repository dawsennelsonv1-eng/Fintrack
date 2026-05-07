// src/components/QuickAdd.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, ArrowDownLeft, ArrowUpRight, Repeat, Bookmark, Save,
  ChevronDown, ChevronUp, Calendar, Hash, FileText, Tag, Check,
} from 'lucide-react';
import {
  useStore, selectRates, selectBaseCurrency, selectEditingTxId, selectTransactions,
  selectCategories, selectTemplates, gatherTags,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';
import DateTimePicker from './DateTimePicker';
import TagInput from './TagInput';
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

  const availableCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === type && c.enabled !== false)
      .sort((a, b) => a.order - b.order);
  }, [categories, type]);

  const topTemplates = useMemo(() => {
    return [...templates]
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, 6);
  }, [templates]);

  // Name autocomplete: search past transactions for matching notes
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
          notes: n,
          amount: t.amount,
          currency: t.currency,
          category: t.category,
          type: t.type,
        });
        if (matches.length >= 5) break;
      }
    }
    return matches;
  }, [notes, transactions]);

  // Pick default category when type changes
  useEffect(() => {
    if (isEditing) return;
    if (availableCategories.length > 0 && !availableCategories.some((c) => c.name === category)) {
      setCategory(availableCategories[0].name);
    }
  }, [type, availableCategories, isEditing]);

  // Open in edit mode
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
    setNotes('');
    setTags([]);
    setDate(new Date().toISOString());
    setShowDate(false);
    setShowTags(false);
    setRecFrequency('monthly');
    setRecInterval(1);
    setRecDayOfMonth(new Date().getDate());
    setTplName('');
    setShowSuggestions(false);
  };

  const close = () => {
    setOpen(false);
    setEditingTx(null);
    setSection('quick');
    setTimeout(reset, 250);
  };

  // Apply a suggestion to the form
  const applySuggestion = (sug) => {
    setNotes(sug.notes);
    setAmount(String(sug.amount));
    setCurrency(sug.currency || 'USD');
    setCategory(sug.category);
    if (sug.type !== type) setType(sug.type);
    setShowSuggestions(false);
  };

  // Apply a template
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

  const submit = (e) => {
    e?.preventDefault?.();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    const tagsStr = tags.filter(Boolean).join(',');

    if (section === 'quick') {
      const data = {
        type, amount: v, currency, category,
        notes: notes.trim(), tags: tagsStr, date,
      };
      if (isEditing) updateTransaction(editingId, data);
      else addTransaction(data);
    } else if (section === 'recurring') {
      addRecurring({
        name: notes.trim() || category,
        amount: v, currency, type, category,
        notes: notes.trim(), tags: tagsStr,
        frequency: recFrequency,
        interval: recInterval,
        dayOfMonth: recDayOfMonth,
        startDate: date,
      });
    } else if (section === 'template') {
      const tplDisplayName = tplName.trim() || notes.trim() || category;
      addTemplate({
        name: tplDisplayName,
        amount: v, currency, type, category,
        notes: notes.trim(), tags: tagsStr,
        icon: 'Tag', color: '#7a8a8c',
      });
    }
    close();
  };

  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  const valid = amount && parseFloat(amount) > 0;

  return (
    <>
      {/* Floating action button */}
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
              {/* Sticky header */}
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

                {/* Section tabs (hidden when editing) */}
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

              {/* Content */}
              <div className="px-5 pt-5 space-y-5">

                {/* Templates strip — only in 'quick' mode */}
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

                {/* Type toggle (income/expense) */}
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

                {/* Big amount input — hero */}
                <div className="surface border rounded-2xl p-6">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted text-center mb-2">
                    Amount
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    {cfg.prefix && (
                      <span className="font-display text-3xl text-muted">{cfg.prefix}</span>
                    )}
                    <input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      autoFocus={!isEditing}
                      className="bg-transparent outline-none font-display text-5xl text-center num min-w-[3ch] max-w-full"
                      style={{ width: `${Math.max(3, amount.length || 1)}ch` }}
                    />
                    {cfg.suffix && (
                      <span className="font-display text-2xl text-muted">{cfg.suffix}</span>
                    )}
                  </div>

                  {/* Currency picker */}
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

                {/* Name / notes field with autocomplete */}
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
                  {section !== 'recurring' && nameSuggestions.length === 0 && notes.length >= 2 && (
                    <p className="text-[10px] text-muted mt-1 px-1">
                      Tip: future entries with this name will autocomplete fields from this one.
                    </p>
                  )}
                </div>

                {/* Category picker */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                    Category
                  </div>
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

                {/* Recurring fields */}
                {section === 'recurring' && (
                  <RecurringFields
                    frequency={recFrequency} setFrequency={setRecFrequency}
                    interval={recInterval} setInterval={setRecInterval}
                    dayOfMonth={recDayOfMonth} setDayOfMonth={setRecDayOfMonth}
                  />
                )}

                {/* Template name */}
                {section === 'template' && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                      Template name
                    </div>
                    <input
                      type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
                      placeholder="e.g., Morning coffee"
                      className="w-full px-4 py-3 rounded-xl surface border outline-none text-sm"
                    />
                  </div>
                )}

                {/* Foldable: Date */}
                <FoldableSection
                  icon={Calendar}
                  label={section === 'recurring' ? 'Start date' : 'Date'}
                  preview={formatDatePreview(date)}
                  open={showDate}
                  onToggle={() => setShowDate(!showDate)}
                >
                  <DateTimePicker value={date} onChange={setDate} />
                </FoldableSection>

                {/* Foldable: Tags */}
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

              {/* Sticky footer with save */}
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
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            <div className="p-4 border-t border-[var(--border)]">
              {children}
            </div>
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
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
        Frequency
      </div>
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
            type="number" min="1" max="28"
            value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
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
