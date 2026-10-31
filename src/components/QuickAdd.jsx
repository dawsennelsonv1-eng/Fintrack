
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, ArrowDownLeft, ArrowUpRight, Repeat, Bookmark, Save,
  ChevronDown, ChevronUp, Calendar, Hash, Tag, Users, Wallet, Percent, SlidersHorizontal,
} from 'lucide-react';
import {
  useStore, selectRates, selectBaseCurrency, selectEditingTxId, selectTransactions,
  selectCategories, selectTemplates, selectBuckets, selectDebts, selectGoals,
selectQuickSpendBucket, selectIsDangerMode, selectWallets, selectBorrowedPool,
gatherTags, computeBucketImpact, buildCategoryToBucket, autoSplitIncome,
  BORROWED_CATEGORY, LENT_CATEGORY,
} from '../store/useStore';
import { CURRENCIES, formatMoney, formatCompact } from '../lib/currency';
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
const [currency, setCurrency] = useState('HTG');
  const [category, setCategory] = useState('');
const [walletId, setWalletId] = useState('w_moncash');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString());

const [incomeAllocMode, setIncomeAllocMode] = useState('split');
const [singleIncomeBucket, setSingleIncomeBucket] = useState('warChest');
const [customIncomeSplit, setCustomIncomeSplit] = useState({});
const [expenseBucketOverride, setExpenseBucketOverride] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sourceBucketKey, setSourceBucketKey] = useState('operations');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState('simple');

  const [advancedSplit, setAdvancedSplit] = useState(false);
  const [bucketSplit, setBucketSplit] = useState({});


  const [showDate, setShowDate] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const notesRef = useRef(null);


  const [recFrequency, setRecFrequency] = useState('monthly');
  const [recInterval, setRecInterval] = useState(1);
  const [recDayOfMonth, setRecDayOfMonth] = useState(new Date().getDate());

  const [tplName, setTplName] = useState('');


  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingImpact, setPendingImpact] = useState(null);
  const [pendingTxData, setPendingTxData] = useState(null);
  const [pendingWarningBucket, setPendingWarningBucket] = useState(null);


  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [pendingBorrowData, setPendingBorrowData] = useState(null);


  const [incomeSplitOpen, setIncomeSplitOpen] = useState(false);
  const [pendingIncomeData, setPendingIncomeData] = useState(null);

  const addTransaction    = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const setEditingTx      = useStore((s) => s.setEditingTx);
const setQuickSpendBucket = useStore((s) => s.setQuickSpendBucket);
  const addRecurring      = useStore((s) => s.addRecurring);
  const addTemplate       = useStore((s) => s.addTemplate);
  const useTemplate       = useStore((s) => s.useTemplate);
  const recordBorrowedDeployment = useStore((s) => s.recordBorrowedDeployment);

const editingId        = useStore(selectEditingTxId);
const quickSpendBucket = useStore(selectQuickSpendBucket);
const isDangerMode     = useStore(selectIsDangerMode);
const transactions     = useStore(selectTransactions);
const categories       = useStore(selectCategories);
const templates        = useStore(selectTemplates);
const buckets          = useStore(selectBuckets);
const wallets          = useStore(selectWallets);
const borrowedPool     = useStore(selectBorrowedPool);
const debts            = useStore(selectDebts);
const goals            = useStore(selectGoals);
const baseCurrency     = useStore(selectBaseCurrency);
const rates            = useStore(selectRates);

  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : null;
  const isEditing = !!editingTx;

  const allTags = useMemo(() => gatherTags(transactions), [transactions]);
  const categoryMap = useMemo(() => buildCategoryToBucket(categories), [categories]);
const sourceBuckets = useMemo(() => {
return buckets
.filter((b) => b.enabled !== false)
.sort((a, b) => a.order - b.order);
}, [buckets]);
useEffect(() => {
if (quickSpendBucket) {
setOpen(true);
setSection('quick');
setType('expense');
setCurrency(baseCurrency || 'HTG');
setExpenseBucketOverride(quickSpendBucket);
}
}, [quickSpendBucket, baseCurrency]);

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
notes: n, amount: t.amount, currency: t.currency, category: t.category, type: t.type, walletId: t.walletId,
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
setWalletId(editingTx.walletId || 'w_moncash');
      setNotes(editingTx.notes || '');
      setDate(editingTx.date || new Date().toISOString());
      const tagList = (editingTx.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
      setTags(tagList);
    }
  }, [editingTx]);

  const reset = () => {
    setType('expense');
    setAmount('');
setCurrency(baseCurrency || 'HTG');
    setCategory(availableCategories[0]?.name || '');
setWalletId('w_moncash');
    setNotes(''); setTags([]);
    setDate(new Date().toISOString());
setIncomeAllocMode('split');
setSingleIncomeBucket('warChest');
setCustomIncomeSplit({});
setExpenseBucketOverride('');
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
setQuickSpendBucket(null);
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
if (sug.walletId) setWalletId(sug.walletId);
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

const expenseBucketKey = useMemo(() => {
if (type !== 'expense' || isLent) return null;
if (expenseBucketOverride) return expenseBucketOverride;
return categoryMap[category] || 'operations';
}, [type, isLent, category, categoryMap, expenseBucketOverride]);
const expenseBucket = useMemo(() => {
if (!expenseBucketKey || expenseBucketKey === 'borrowedPool') return null;
return sourceBuckets.find((b) => b.key === expenseBucketKey) || null;
}, [expenseBucketKey, sourceBuckets]);
  const buildTxData = () => {
    const v = parseFloat(amount);
    const data = {
      type, amount: v, currency, category,
walletId,
      notes: notes.trim(),
      tags: tags.filter(Boolean).join(','),
      date,
    };
if (type === 'expense' && !isLent && expenseBucketOverride) {
data.sourceBucketKey = expenseBucketOverride;
if (expenseBucketOverride === 'borrowedPool') {
data.buckets = {};
} else {
data.buckets = { [expenseBucketOverride]: -Math.abs(v) };
}
}
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

const liveIncomePreview = useMemo(() => {
const v = parseFloat(amount) || 0;
if (v <= 0) return {};
return autoSplitIncome(v, sourceBuckets);
}, [amount, sourceBuckets]);

  const submit = (e) => {
    e?.preventDefault?.();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    if (isSpecial && !counterparty.trim()) return;


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

if (type === 'expense' && !isLent && expenseBucketKey && expenseBucketKey !== 'borrowedPool') {
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


    if (isBorrowed) {
      setPendingBorrowData(buildTxData());
      setBorrowModalOpen(true);
      return;
    }


    if (type === 'income') {
if (incomeAllocMode === 'single') {
const txData = buildTxData();
addTransaction({ ...txData, buckets: { [singleIncomeBucket]: v } });
close();
return;
}
if (incomeAllocMode === 'custom') {
const cleaned = {};
for (const [k, val] of Object.entries(customIncomeSplit)) {
const n = Number(val) || 0;
if (n > 0) cleaned[k] = n;
}
const txData = buildTxData();
addTransaction({ ...txData, buckets: Object.keys(cleaned).length > 0 ? cleaned : liveIncomePreview });
close();
return;
}
      setPendingIncomeData(buildTxData());
      setIncomeSplitOpen(true);
      return;
    }

    addTransaction(buildTxData());
    close();
  };


  const closeIncomeSplit = () => {
    setIncomeSplitOpen(false);
    setPendingIncomeData(null);
  };


  const commitIncomeSplit = () => {
addTransaction({ ...pendingIncomeData, buckets: autoSplitIncome(pendingIncomeData.amount, sourceBuckets) });
    closeIncomeSplit();
    close();
  };


  const commitIncomeSingle = (bucketKey) => {
    addTransaction({ ...pendingIncomeData, buckets: { [bucketKey]: pendingIncomeData.amount } });
    closeIncomeSplit();
    close();
  };


  const closeBorrowModal = () => {
    setBorrowModalOpen(false);
    setPendingBorrowData(null);
  };


  const commitBorrowedSpent = () => {
    const tx = addTransaction(pendingBorrowData);
    if (tx?.linkedDebtId) {
      recordBorrowedDeployment({
        sourceDebtId: tx.linkedDebtId,
        destinationType: 'spent',
        destinationLabel: 'Spent (consumed)',
        amount: pendingBorrowData.amount,
        currency: pendingBorrowData.currency,
        note: 'Borrowed money already spent',
      });
    }
    closeBorrowModal();
    close();
  };


  const commitBorrowedPool = () => {
    addTransaction(pendingBorrowData);
    closeBorrowModal();
    close();
  };


  const commitBorrowedAllocate = (allocMap) => {
    const tx = addTransaction({ ...pendingBorrowData, buckets: allocMap });
    if (tx?.linkedDebtId) {
      for (const [bucketKey, v] of Object.entries(allocMap)) {
        const amt = Number(v) || 0;
        if (amt <= 0) continue;
        recordBorrowedDeployment({
          sourceDebtId: tx.linkedDebtId,
          destinationType: 'bucket',
          destinationId: bucketKey,
destinationLabel: sourceBuckets.find((b) => b.key === bucketKey)?.name || bucketKey,
          amount: amt,
          currency: pendingBorrowData.currency,
          note: 'Borrowed money allocated to bucket',
        });
      }
    }
    closeBorrowModal();
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
<ArrowUpRight size={15} /> Expense / Spending
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

{/* ─── WHERE DOES THIS HAPPEN? (6 WALLETS PICKER) ─────── */}
<div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
Where does it happen? (Account / Place)
</div>
<div className="grid grid-cols-3 gap-1.5">
{wallets.map((w) => {
const sel = walletId === w.id;
return (
<button
key={w.id}
type="button"
onClick={() => setWalletId(w.id)}
className={`px-2.5 py-2 rounded-xl border text-xs font-medium truncate transition-all ${
sel
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
: 'surface text-muted'
}`}
>
{w.name} ({w.currency})
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
placeholder={section === 'quick' ? 'e.g., Salary, Groceries, Plan Natcom' : 'Name this'}
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

{/* ─── INLINE BUCKET PICKER FOR EXPENSES (INCL. BORROWED CAPITAL POOL) ─── */}
{type === 'expense' && !isLent && section === 'quick' && (
<div className="surface border rounded-2xl p-4">
<div className="flex items-center justify-between mb-2">
<span className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Spend from which bucket / pool?
</span>
{expenseBucketOverride && (
<button
type="button"
onClick={() => setExpenseBucketOverride('')}
className="text-[10px] text-muted underline"
>
Reset to default
</button>
)}
</div>
<div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
{sourceBuckets.map((b) => {
const activeKey = expenseBucketOverride || categoryMap[category] || 'operations';
const sel = activeKey === b.key;
return (
<button
key={b.key}
type="button"
onClick={() => setExpenseBucketOverride(b.key)}
className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all ${
sel
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent font-medium'
: 'bg-[var(--bg)] border-transparent text-muted'
}`}
>
<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
<span className="truncate">{b.name}</span>
</button>
);
})}
{borrowedPool > 0.01 && (
<button
type="button"
onClick={() => setExpenseBucketOverride('borrowedPool')}
className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all ${
expenseBucketOverride === 'borrowedPool'
? 'bg-amber-600 text-white border-transparent font-medium'
: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
}`}
>
<span className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
<span className="truncate">Borrowed Pool ({formatCompact(borrowedPool, baseCurrency)})</span>
</button>
)}
</div>
</div>
)}
{/* ─── INLINE INCOME SPLIT CHOOSER ─── */}
{type === 'income' && !isBorrowed && section === 'quick' && (
<div className="surface border rounded-2xl p-4 space-y-3">
<div className="flex items-center justify-between">
<span className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
How should this income be allocated?
</span>
<span className="text-[10px] text-accent-income font-semibold">
{isDangerMode ? 'Danger Mode (40/25/20/10/5)' : 'Normal Mode (50/30/10/5/5)'}
</span>
</div>
<div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
{[
{ id: 'split',  label: 'Auto-Split' },
{ id: 'single', label: '1 Bucket (No Split)' },
{ id: 'custom', label: 'Custom Split' },
].map((m) => (
<button
key={m.id}
type="button"
onClick={() => setIncomeAllocMode(m.id)}
className={`py-2 rounded-lg text-xs font-medium transition-all ${
incomeAllocMode === m.id
? 'bg-[var(--surface)] shadow-sm text-[var(--text)]'
: 'text-muted'
}`}
>
{m.label}
</button>
))}
</div>
{incomeAllocMode === 'split' && (
<div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
{sourceBuckets.map((b) => (
<div key={b.key} className="bg-[var(--bg)] rounded-xl px-2.5 py-2 text-xs flex items-center justify-between">
<span className="truncate text-muted">{b.name.split(' ')[0]} ({b.percentage}%)</span>
<span className="num font-medium text-accent-income">
+{formatMoney(liveIncomePreview[b.key] || 0, currency)}
</span>
</div>
))}
</div>
)}
{incomeAllocMode === 'single' && (
<div className="grid grid-cols-2 gap-1.5 pt-1">
{sourceBuckets.map((b) => {
const sel = singleIncomeBucket === b.key;
return (
<button
key={b.key}
type="button"
onClick={() => setSingleIncomeBucket(b.key)}
className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs transition-all ${
sel
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent font-medium'
: 'bg-[var(--bg)] border-transparent'
}`}
>
<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
<span className="truncate">100% → {b.name}</span>
</button>
);
})}
</div>
)}
{incomeAllocMode === 'custom' && (
<div className="space-y-2 pt-1">
{sourceBuckets.map((b) => (
<div key={b.key} className="flex items-center gap-2 text-xs">
<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
<span className="flex-1 truncate">{b.name}</span>
<input
type="number"
step="0.01"
min="0"
value={customIncomeSplit[b.key] ?? ''}
onChange={(e) => setCustomIncomeSplit({ ...customIncomeSplit, [b.key]: e.target.value })}
placeholder={String(liveIncomePreview[b.key] || 0)}
className="w-28 px-2.5 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-right num"
/>
</div>
))}
</div>
)}
</div>
)}
{/* Borrow / Lend extra fields */}
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
className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm"
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
className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm num"
                              />
                              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                                {[
                                  { id: 'simple',   label: 'Simple' },
                                  { id: 'compound', label: 'Compound' },
].map((m) => (
<button
key={m.id} type="button" onClick={() => setInterestType(m.id)}
className={`px-3 rounded-lg text-[11px] font-medium ${
interestType === m.id ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
}`}
>
{m.label}
</button>
))}
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
className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm num"
                          />
                        </div>

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

                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


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


      <BorrowedMoneyModal
        open={borrowModalOpen}
        amount={pendingBorrowData?.amount || 0}
        currency={pendingBorrowData?.currency || 'USD'}
        counterparty={pendingBorrowData?.counterparty || ''}
        buckets={sourceBuckets}
        onSpent={commitBorrowedSpent}
        onKeepPool={commitBorrowedPool}
        onAllocate={commitBorrowedAllocate}
        onCancel={closeBorrowModal}
      />


      <IncomeSplitModal
        open={incomeSplitOpen}
        amount={pendingIncomeData?.amount || 0}
        currency={pendingIncomeData?.currency || 'USD'}
        buckets={sourceBuckets}
        onSplit={commitIncomeSplit}
        onSingle={commitIncomeSingle}
        onCancel={closeIncomeSplit}
      />
    </>
  );
}


function IncomeSplitModal({ open, amount, currency, buckets, onSplit, onSingle, onCancel }) {
const [choice, setChoice] = useState('split');
const [bucketKey, setBucketKey] = useState(buckets[0]?.key || 'warChest');

  useEffect(() => {
if (open) {
setChoice('split');
setBucketKey(buckets[0]?.key || 'warChest');
}
}, [open, buckets]);
const splitPreview = useMemo(() => autoSplitIncome(amount, buckets), [amount, buckets]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md surface border rounded-2xl p-5 space-y-4"
          >
            <div>
<h3 className="font-display text-lg">Split this income across your buckets?</h3>
              <p className="text-sm text-muted mt-1">
Choose whether to auto-split {formatMoney(amount, currency)} across your 5 active buckets or keep it in a single bucket.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button" onClick={() => setChoice('split')}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  choice === 'split' ? 'border-accent-income bg-accent-income/5' : 'border-[var(--border)] bg-[var(--bg)]'
                }`}
              >
                <div className="text-sm font-medium">Yes, split across buckets</div>
<div className="text-[11px] text-muted mt-1 flex flex-wrap gap-x-2 gap-y-1">
{buckets.map((b) => (
<span key={b.key} className="num">
{b.name.split(' ')[0]} ({b.percentage}%): <strong>{formatMoney(splitPreview[b.key] || 0, currency)}</strong>
</span>
))}
</div>
              </button>

              <button
                type="button" onClick={() => setChoice('single')}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  choice === 'single' ? 'border-accent-income bg-accent-income/5' : 'border-[var(--border)] bg-[var(--bg)]'
                }`}
              >
<div className="text-sm font-medium">No, keep 100% in one bucket</div>
<div className="text-[11px] text-muted">Assigns the entire {formatMoney(amount, currency)} to a single pocket.</div>
              </button>
            </div>

            {choice === 'single' && (
              <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                <label className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold whitespace-nowrap">Bucket</label>
                <select value={bucketKey} onChange={(e) => setBucketKey(e.target.value)}
className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm">
                  {buckets.map((b) => (
                    <option key={b.key} value={b.key}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-medium">
                Cancel
              </button>
              <button type="button"
                onClick={() => choice === 'split' ? onSplit() : onSingle(bucketKey)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium">
{choice === 'split' ? 'Split income' : 'Keep in 1 bucket'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


function BorrowedMoneyModal({ open, amount, currency, counterparty, buckets, onSpent, onKeepPool, onAllocate, onCancel }) {
const [mode, setMode] = useState(null);
  const [alloc, setAlloc] = useState({});
  const [showAlloc, setShowAlloc] = useState(false);

  useEffect(() => {
    if (open) { setMode(null); setAlloc({}); setShowAlloc(false); }
  }, [open]);

  const allocTotal = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);
  const allocValid = showAlloc && Math.abs(allocTotal - amount) < 0.005;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md surface border rounded-2xl p-5 space-y-4"
          >
            <div>
              <h3 className="font-display text-lg">Borrowed money</h3>
              <p className="text-sm text-muted mt-1">
                Has this {formatMoney(amount, currency)}{counterparty ? ` from ${counterparty}` : ''} already been spent, or is it still available for use?
              </p>

            </div>

            <div className="space-y-2">
              <button
type="button" onClick={() => setMode('available')}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  mode === 'available' ? 'border-accent-income bg-accent-income/5' : 'border-[var(--border)] bg-[var(--bg)]'
                }`}
              >
                <div className="text-sm font-medium">Still available</div>
                <div className="text-[11px] text-muted">
Adds {formatMoney(amount, currency)} to your Borrowed Capital Pool and records the liability.
                </div>
              </button>

              <button
                type="button" onClick={onSpent}
                className="w-full text-left px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors"
              >
                <div className="text-sm font-medium">Already spent</div>
                <div className="text-[11px] text-muted">
Records the debt liability without adding available cash.
                </div>
              </button>
            </div>

            {mode === 'available' && (
              <div className="pt-1 space-y-3 border-t border-[var(--border)]">
                <p className="text-[12px] text-muted pt-3">
                  Allocate the borrowed funds across buckets?
                </p>
                {showAlloc && (
                  <div className="space-y-2">
                    {buckets.map((b) => (
                      <div key={b.key} className="flex items-center gap-2">
                        <span className="flex-1 text-sm truncate">{b.name}</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={alloc[b.key] ?? ''}
                          onChange={(e) => setAlloc((a) => ({ ...a, [b.key]: e.target.value }))}
                          placeholder="0.00"
className="w-28 px-3 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-sm num text-right"
                        />
                      </div>
                    ))}

                  </div>
                )}
                <div className="flex gap-2">
                  {!showAlloc && (
                    <button type="button" onClick={onKeepPool}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium">
Keep in pool
                    </button>
                  )}
                  {!showAlloc ? (
                    <button type="button" onClick={() => setShowAlloc(true)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-medium">
                      Allocate to buckets
                    </button>
                  ) : (
                    <button type="button" disabled={!allocValid}
                      onClick={() => {
                        const cleaned = {};
                        for (const [k, v] of Object.entries(alloc)) {
                          const n = Number(v) || 0;
                          if (n > 0) cleaned[k] = n;
                        }
                        onAllocate(cleaned);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
                      Confirm allocation
                    </button>
                  )}
                </div>
              </div>
            )}

            <button type="button" onClick={onCancel}
              className="w-full text-center text-xs text-muted py-1 hover:text-[var(--text)]">
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

function RecurringFields({ frequency, setFrequency, dayOfMonth, setDayOfMonth }) {
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
