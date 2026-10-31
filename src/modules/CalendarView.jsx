
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, ArrowDownLeft,
ArrowUpRight, ArrowLeftRight, CheckCircle2, AlertTriangle, Wallet,
Banknote, Smartphone, Globe, CreditCard, UserCheck, Heart, Trash2, Check, X, Sparkles,
} from 'lucide-react';
import {
  useStore,
selectTransactions, selectConversions, selectWallets, selectBuckets,
selectBaseCurrency, selectRates, selectSelectedCalendarDate, selectCalendarViewMode,
computePeriodLedger,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';
import { useTxActions } from '../components/TxActions';
import CompareModule from './Compare';

const WALLET_ICONS = {
Banknote,
Smartphone,
Globe,
CreditCard,
UserCheck,
Heart,
Wallet,
};

function toDateKey(d) {
const dt = new Date(d);
const y = dt.getFullYear();
const m = String(dt.getMonth() + 1).padStart(2, '0');
const day = String(dt.getDate()).padStart(2, '0');
return `${y}-${m}-${day}`;
}
function getWeekBounds(dateStr) {
const d = new Date(`${dateStr}T12:00:00`);
const day = d.getDay(); // 0 = Sun, 1 = Mon
const diffToMon = day === 0 ? -6 : 1 - day;
const start = new Date(d);
start.setDate(d.getDate() + diffToMon);
const end = new Date(start);
end.setDate(start.getDate() + 6);
return { startStr: toDateKey(start), endStr: toDateKey(end) };
}
function getMonthBounds(dateStr) {
const d = new Date(`${dateStr}T12:00:00`);
const start = new Date(d.getFullYear(), d.getMonth(), 1);
const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
return { startStr: toDateKey(start), endStr: toDateKey(end) };
}
function formatNotepadDateHeader(dateStr, viewMode) {
const d = new Date(`${dateStr}T12:00:00`);
if (isNaN(d)) return dateStr;
if (viewMode === 'day') {
const frDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const weekdayFr = frDays[d.getDay()];
const monthEn = d.toLocaleDateString('en-US', { month: 'long' });
const dayNum = d.getDate();
const suffix =
dayNum % 10 === 1 && dayNum !== 11 ? 'st' :
dayNum % 10 === 2 && dayNum !== 12 ? 'nd' :
dayNum % 10 === 3 && dayNum !== 13 ? 'rd' : 'th';
return `${weekdayFr}, ${monthEn} ${dayNum}${suffix} ${d.getFullYear()}`;
}
if (viewMode === 'week') {
const { startStr, endStr } = getWeekBounds(dateStr);
const s = new Date(`${startStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const e = new Date(`${endStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
return `Week · ${s} – ${e}`;
}
if (viewMode === 'month') {
return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
return 'Compare Periods';
}

export default function CalendarView() {
const transactions      = useStore(selectTransactions);
const conversions       = useStore(selectConversions);
const wallets           = useStore(selectWallets);
const buckets           = useStore(selectBuckets);
const baseCurrency      = useStore(selectBaseCurrency);
const rates             = useStore(selectRates);
const selectedDate      = useStore(selectSelectedCalendarDate);
const viewMode          = useStore(selectCalendarViewMode);
const setSelectedDate   = useStore((s) => s.setSelectedCalendarDate);
const setViewMode       = useStore((s) => s.setCalendarViewMode);
const addTransaction    = useStore((s) => s.addTransaction);
const addConversion     = useStore((s) => s.addConversion);
const removeConversion  = useStore((s) => s.removeConversion);
const updateWalletBalance = useStore((s) => s.updateWalletBalance);
const reconcileWalletDifference = useStore((s) => s.reconcileWalletDifference);
const [calendarGridOpen, setCalendarGridOpen] = useState(false);
const [quickAddType, setQuickAddType] = useState(null); // 'income' | 'expense' | 'conversion' | null
const { bind, sheet } = useTxActions();
const { startDateStr, endDateStr } = useMemo(() => {
if (viewMode === 'week') {
const { startStr, endStr } = getWeekBounds(selectedDate);
return { startDateStr: startStr, endDateStr: endStr };
}
if (viewMode === 'month') {
const { startStr, endStr } = getMonthBounds(selectedDate);
return { startDateStr: startStr, endDateStr: endStr };
}
return { startDateStr: selectedDate, endDateStr: selectedDate };
}, [selectedDate, viewMode]);
const ledger = useMemo(
() => computePeriodLedger(transactions, conversions, wallets, baseCurrency, rates, startDateStr, endDateStr),
[transactions, conversions, wallets, baseCurrency, rates, startDateStr, endDateStr]
);
const stepDate = (dir) => {
const d = new Date(`${selectedDate}T12:00:00`);
if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
else if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
else d.setDate(d.getDate() + dir);
setSelectedDate(toDateKey(d));
};
const periodLabel = viewMode === 'day' ? 'day' : viewMode === 'week' ? 'week' : 'month';
const netHTG = convert(ledger.netForPeriodBase, baseCurrency, 'HTG', rates);
const netHTD = convert(ledger.netForPeriodBase, baseCurrency, 'HTD', rates);
const netUSD = convert(ledger.netForPeriodBase, baseCurrency, 'USD', rates);

  return (
<main className="max-w-2xl mx-auto px-4 sm:px-5 pt-3 pb-32">
{/* ─── TOP VIEW MODE SWITCHER (Day | Week | Month | Compare) ─── */}
<div className="flex items-center justify-between gap-2 mb-3">
<div className="grid grid-cols-4 gap-1 p-1 rounded-xl surface border flex-1">
{[
{ id: 'day',     label: 'Daily' },
{ id: 'week',    label: 'Weekly' },
{ id: 'month',   label: 'Monthly' },
{ id: 'compare', label: 'Compare' },
].map((m) => (
<button
key={m.id}
type="button"
onClick={() => setViewMode(m.id)}
className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
viewMode === m.id
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 shadow-sm'
: 'text-muted hover:text-[var(--text)]'
}`}
>
{m.label}
</button>
))}
</div>
</div>

{viewMode === 'compare' ? (
<CompareModule embedded />
) : (
<>
{/* ─── NOTEPAD DATE HEADER BAR ─────────────────────────── */}
<motion.section {...fadeUp} transition={{ duration: 0.35, ease }} className="mb-3">
<div className="surface border rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2">
<button
type="button"
onClick={() => stepDate(-1)}
className="w-8 h-8 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] flex items-center justify-center shrink-0"
aria-label="Previous"
>
<ChevronLeft size={16} />
</button>

<button
type="button"
onClick={() => setCalendarGridOpen((v) => !v)}
className="flex-1 text-center min-w-0 group"
>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold flex items-center justify-center gap-1">
<CalendarIcon size={10} />
<span>{viewMode.toUpperCase()} SHEET · TAP TO PICK DATE</span>
</div>
<div className="font-display text-xl sm:text-2xl truncate mt-0.5 group-hover:underline">
{formatNotepadDateHeader(selectedDate, viewMode)}
</div>
</button>
<div className="flex items-center gap-1 shrink-0">
{selectedDate !== toDateKey(new Date()) && (
<button
type="button"
onClick={() => setSelectedDate(toDateKey(new Date()))}
className="px-2 py-1 rounded-lg bg-[var(--bg)] text-[10px] font-semibold text-muted hover:text-[var(--text)]"
>
Today
</button>
)}
<button
type="button"
onClick={() => stepDate(1)}
className="w-8 h-8 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] flex items-center justify-center"
aria-label="Next"
>
<ChevronRight size={16} />
</button>
</div>
</div>
{/* Collapsible Mini Month Picker */}
<AnimatePresence>
{calendarGridOpen && (
<motion.div
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: 'auto' }}
exit={{ opacity: 0, height: 0 }}
className="overflow-hidden mt-2"
>
<MiniMonthGrid
selectedDate={selectedDate}
transactions={transactions}
onSelectDate={(dKey) => {
setSelectedDate(dKey);
setCalendarGridOpen(false);
}}
/>
</motion.div>
)}
</AnimatePresence>
</motion.section>
{/* ─── 1. INCOME => (Compact Section) ──────────────────── */}
<motion.section {...fadeUp} transition={{ duration: 0.4, ease, delay: 0.02 }} className="mb-3">
<div className="surface border rounded-2xl p-3.5">
<div className="flex items-center justify-between gap-2 mb-2">
<div className="flex items-center gap-2">
<span className="w-6 h-6 rounded-lg bg-accent-income/15 text-accent-income flex items-center justify-center">
<ArrowDownLeft size={13} strokeWidth={2.4} />
</span>
<span className="font-display text-lg">Income ⇒</span>
<span className="text-xs text-muted num">({ledger.incomeTxs.length})</span>
</div>
<div className="flex items-center gap-2">
<span className="font-display text-lg num text-accent-income">
+{formatMoney(ledger.totalIncomeBase, baseCurrency)}
</span>
<button
type="button"
onClick={() => setQuickAddType(quickAddType === 'income' ? null : 'income')}
className="px-2 py-1 rounded-lg bg-accent-income/10 text-accent-income text-[11px] font-medium flex items-center gap-1"
>
<Plus size={11} /> Add
</button>
</div>
</div>
{quickAddType === 'income' && (
<InlineDayTxForm
type="income"
dateStr={endDateStr}
wallets={wallets}
buckets={buckets}
defaultCurrency={baseCurrency}
onSave={(payload) => {
addTransaction(payload);
setQuickAddType(null);
}}
onCancel={() => setQuickAddType(null)}
/>
)}
{ledger.incomeTxs.length === 0 ? (
<div className="text-xs text-muted py-1.5 px-1">
No income logged for this {periodLabel}.
</div>
) : (
<ul className="divide-y divide-[var(--border)]/60">
{ledger.incomeTxs.map((tx) => {
const w = wallets.find((x) => x.id === tx.walletId);
return (
<li
key={tx.id}
{...bind(tx)}
className="py-2 px-1 flex items-center justify-between gap-2 text-xs cursor-pointer active:bg-[var(--bg)] rounded-lg"
>
<div className="min-w-0 flex-1">
<div className="font-medium truncate">{tx.notes || tx.category}</div>
<div className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
<span>{tx.category}</span>
{w && (
<span className="px-1.5 py-0.2 rounded bg-[var(--bg)] font-medium text-[var(--text)]">
{w.name}
</span>
)}
</div>
</div>
<div className="text-right num shrink-0">
<div className="font-semibold text-accent-income">
+{formatMoney(tx.amount, tx.currency)}
</div>
</div>
</li>
);
})}
</ul>
)}
</div>
</motion.section>
{/* ─── 2. SPENDINGS => (Compact Section, incl. Debt Paid) ─── */}
<motion.section {...fadeUp} transition={{ duration: 0.4, ease, delay: 0.04 }} className="mb-3">
<div className="surface border rounded-2xl p-3.5">
<div className="flex items-center justify-between gap-2 mb-2">
<div className="flex items-center gap-2">
<span className="w-6 h-6 rounded-lg bg-accent-expense/15 text-accent-expense flex items-center justify-center">
<ArrowUpRight size={13} strokeWidth={2.4} />
</span>
<span className="font-display text-lg">Spendings ⇒</span>
<span className="text-xs text-muted num">({ledger.spendingTxs.length})</span>
</div>
<div className="flex items-center gap-2">
<span className="font-display text-lg num text-accent-expense">
−{formatMoney(ledger.totalSpendingBase, baseCurrency)}
</span>
<button
type="button"
onClick={() => setQuickAddType(quickAddType === 'expense' ? null : 'expense')}
className="px-2 py-1 rounded-lg bg-accent-expense/10 text-accent-expense text-[11px] font-medium flex items-center gap-1"
>
<Plus size={11} /> Add
</button>
</div>
</div>
{quickAddType === 'expense' && (
<InlineDayTxForm
type="expense"
dateStr={endDateStr}
wallets={wallets}
buckets={buckets}
defaultCurrency={baseCurrency}
onSave={(payload) => {
addTransaction(payload);
setQuickAddType(null);
}}
onCancel={() => setQuickAddType(null)}
/>
)}
{ledger.spendingTxs.length === 0 ? (
<div className="text-xs text-muted py-1.5 px-1">
No spendings logged for this {periodLabel}.
</div>
) : (
<ul className="divide-y divide-[var(--border)]/60">
{ledger.spendingTxs.map((tx) => {
const w = wallets.find((x) => x.id === tx.walletId);
const isDebtRepay = tx.category === 'Repayment';
const bucketKey = Object.keys(tx.buckets || {})[0];
return (
<li
key={tx.id}
{...bind(tx)}
className="py-2 px-1 flex items-center justify-between gap-2 text-xs cursor-pointer active:bg-[var(--bg)] rounded-lg"
>
<div className="min-w-0 flex-1">
<div className="flex items-center gap-1.5">
<span className="font-medium truncate">{tx.notes || tx.category}</span>
{isDebtRepay && (
<span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-expense/15 text-accent-expense font-semibold shrink-0">
Debt Paid
</span>
)}
</div>
<div className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
<span>{tx.category}</span>
{w && (
<span className="px-1.5 py-0.2 rounded bg-[var(--bg)] font-medium text-[var(--text)]">
{w.name}
</span>
)}
{bucketKey && (
<span className="text-muted">· {bucketKey}</span>
)}
</div>
</div>
<div className="text-right num shrink-0">
<div className="font-semibold text-accent-expense">
−{formatMoney(tx.amount, tx.currency)}
</div>
</div>
</li>
);
})}
</ul>
)}
</div>
</motion.section>
{/* ─── 3. COMPACT 3-LINE SUMMARY STRIP ("These shouldn't be big, just make sure they are there") ─── */}
<motion.section {...fadeUp} transition={{ duration: 0.4, ease, delay: 0.06 }} className="mb-4">
<div className="surface border rounded-2xl divide-y divide-[var(--border)] text-xs overflow-hidden">
{/* Row 1: Conversions => if Any (and place for the fees they took) */}
<div className="px-3.5 py-2.5">
<div className="flex items-center justify-between gap-2">
<div className="flex items-center gap-1.5 text-muted">
<ArrowLeftRight size={12} />
<span className="font-medium text-[var(--text)]">Conversions ⇒</span>
<span>
{ledger.periodConversions.length === 0
? 'None'
: `${ledger.periodConversions.length} logged`}
</span>
{ledger.totalFeesBase > 0 && (
<span className="text-accent-expense num font-medium">
(Fees: −{formatCompact(ledger.totalFeesBase, baseCurrency)})
</span>
)}
</div>
<button
type="button"
onClick={() => setQuickAddType(quickAddType === 'conversion' ? null : 'conversion')}
className="text-[11px] font-medium text-muted hover:text-[var(--text)] flex items-center gap-1"
>
<Plus size={11} /> Conversion / Fee
</button>
</div>
{quickAddType === 'conversion' && (
<div className="mt-2.5">
<InlineConversionForm
dateStr={endDateStr}
wallets={wallets}
onSave={(data) => {
addConversion(data);
setQuickAddType(null);
}}
onCancel={() => setQuickAddType(null)}
/>
</div>
)}
{ledger.periodConversions.length > 0 && (
<div className="mt-2 space-y-1">
{ledger.periodConversions.map((c) => {
const fw = wallets.find((w) => w.id === c.fromWalletId);
const tw = wallets.find((w) => w.id === c.toWalletId);
return (
<div key={c.id} className="flex items-center justify-between bg-[var(--bg)] rounded-lg px-2.5 py-1.5 text-[11px] num">
<span className="truncate">
{formatMoney(c.fromAmount, c.fromCurrency)} ({fw?.name || c.fromCurrency}) →{' '}
<strong>{formatMoney(c.toAmount, c.toCurrency)}</strong> ({tw?.name || c.toCurrency})
{c.feeAmount > 0 && (
<span className="text-accent-expense ml-1.5">
· Fee: −{formatMoney(c.feeAmount, c.feeCurrency)}
</span>
)}
</span>
<button
type="button"
onClick={() => removeConversion(c.id)}
className="text-muted hover:text-accent-expense ml-2"
>
<X size={12} />
</button>
</div>
);
})}
</div>
)}
</div>
{/* Row 2: Total Money left for the day (ex: -$100 ht or +20 USD) */}
<div className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-[var(--bg)]/40">
<span className="font-medium text-muted">
Total Money left for the {periodLabel}
</span>
<div className="text-right num flex items-center gap-2 flex-wrap justify-end">
<span
className={`font-display text-base font-semibold ${
ledger.netForPeriodBase >= 0 ? 'text-accent-income' : 'text-accent-expense'
}`}
>
{formatMoney(ledger.netForPeriodBase, baseCurrency, { sign: 'always' })}
</span>
<span className="text-[10px] text-muted">
({formatMoney(netHTD, 'HTD', { sign: 'always' })} · {formatMoney(netUSD, 'USD', { sign: 'always' })})
</span>
</div>
</div>
{/* Row 3: Available total money left overall (counting today and previous days) */}
<div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
<span className="font-medium text-muted">
Available total money left overall
</span>
<span className="font-display text-base font-semibold num">
{formatMoney(ledger.overallAvailableBase, baseCurrency)}
</span>
</div>
</div>
</motion.section>
{/* ─── 4. BIG SECTION: "↳ Different places the money can be" (Wallets & Reconciler) ─── */}
<motion.section {...fadeUp} transition={{ duration: 0.45, ease, delay: 0.08 }}>
<WalletsReconcilerSection
walletRecon={ledger.walletRecon}
baseCurrency={baseCurrency}
rates={rates}
dateStr={endDateStr}
buckets={buckets}
onUpdateWallet={updateWalletBalance}
onReconcile={reconcileWalletDifference}
/>
</motion.section>
</>
)}
{sheet}
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
function WalletsReconcilerSection({
walletRecon,
baseCurrency,
rates,
dateStr,
buckets,
onUpdateWallet,
onReconcile,
}) {
const [editingWalletId, setEditingWalletId] = useState(null);
const [draftVal, setDraftVal] = useState('');
const [draftCurr, setDraftCurr] = useState('HTG');
const [reconcileBucket, setReconcileBucket] = useState('operations');

const startEdit = (w) => {
setEditingWalletId(w.id);
setDraftVal(String(w.effectiveBalance || 0));
setDraftCurr(w.currency || 'HTG');
  };

const saveEdit = (wId) => {
onUpdateWallet(wId, parseFloat(draftVal) || 0, draftCurr);
setEditingWalletId(null);
};
const diffHTG = convert(Math.abs(walletRecon.differenceBase), baseCurrency, 'HTG', rates);
const diffHTD = convert(Math.abs(walletRecon.differenceBase), baseCurrency, 'HTD', rates);
const diffUSD = convert(Math.abs(walletRecon.differenceBase), baseCurrency, 'USD', rates);

  return (
<div className="surface border rounded-3xl p-4 sm:p-5 space-y-4">
<div className="flex items-start justify-between gap-2">
<div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
↳ Different places the money can be
          </div>
<h2 className="font-display text-2xl mt-0.5">Where Your Money Sits</h2>
<p className="text-[11px] text-muted mt-0.5">
Tap any account to enter today’s real balance. The system verifies if everything adds up.
</p>
        </div>
<div className="text-right shrink-0">
<div className="text-[9px] uppercase tracking-wider text-muted font-semibold">Accounts Total</div>
<div className="font-display text-2xl num">{formatMoney(walletRecon.totalWalletsBase, baseCurrency)}</div>
        </div>
</div>

{/* 6 Wallets Grid (MonCash, NatCash, Wise, Meru, Marc's Account, Mom's Account) */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
{walletRecon.wallets.map((w) => {
const Icon = WALLET_ICONS[w.icon] || Wallet;
const isEditing = editingWalletId === w.id;
return (
<div
key={w.id}
className="bg-[var(--bg)] border border-[var(--border)]/80 rounded-2xl p-3 transition-all"
style={{ borderLeftWidth: 3, borderLeftColor: w.color }}
>
{!isEditing ? (
<button
type="button"
onClick={() => startEdit(w)}
className="w-full text-left flex items-center justify-between gap-2"
>
<div className="flex items-center gap-2.5 min-w-0">
<div
className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
style={{ backgroundColor: `${w.color}1f`, color: w.color }}
>
<Icon size={16} />
</div>
<div className="min-w-0">
<div className="font-medium text-sm truncate flex items-center gap-1.5">
<span>{w.name}</span>
<span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface)] text-muted font-semibold">
{w.currency}
</span>
</div>
<div className="text-[10px] text-muted">
{w.allowAnyCurrency ? 'Any currency · Tap to set' : 'Tap to update balance'}
</div>
                    </div>
                  </div>
<div className="text-right num shrink-0">
<div className="font-display text-lg">
{formatMoney(w.effectiveBalance, w.currency)}
</div>
{w.currency !== baseCurrency && (
<div className="text-[10px] text-muted">
≈ {formatCompact(w.balanceBase, baseCurrency)}
</div>
)}
                  </div>
</button>
) : (
<div className="space-y-2">
<div className="flex items-center justify-between text-xs font-semibold">
<span>{w.name}</span>
{w.allowAnyCurrency && (
<div className="flex gap-1">
{Object.keys(CURRENCIES).map((c) => (
<button
key={c}
type="button"
onClick={() => setDraftCurr(c)}
className={`px-1.5 py-0.5 rounded text-[10px] ${
draftCurr === c ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900' : 'bg-[var(--surface)] text-muted'
}`}
>
{c}
</button>
))}
</div>
)}
</div>
<div className="flex items-center gap-1.5">
<input
type="number"
step="0.01"
value={draftVal}
onChange={(e) => setDraftVal(e.target.value)}
autoFocus
className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] outline-none font-display text-lg num"
/>
                    <button
type="button"
onClick={() => saveEdit(w.id)}
className="px-3 py-1.5 rounded-lg bg-accent-income text-white text-xs font-medium"
>
Save
                    </button>
<button
type="button"
onClick={() => setEditingWalletId(null)}
className="p-1.5 rounded-lg bg-[var(--surface)] text-muted"
>
<X size={13} />
</button>
</div>
                </div>
)}
</div>
);
})}
</div>
{/* ─── VERIFICATION & MISSING-MONEY REALLOCATION BANNER ──── */}
<div
className={`rounded-2xl p-4 border ${
walletRecon.isBalanced
? 'bg-accent-income/8 border-accent-income/30'
: walletRecon.missingAmountBase > 0
? 'bg-accent-expense/8 border-accent-expense/35'
: 'bg-amber-500/8 border-amber-500/35'
}`}
>
{walletRecon.isBalanced ? (
<div className="flex items-center gap-2.5 text-xs">
<CheckCircle2 size={16} className="text-accent-income shrink-0" />
<div>
<div className="font-semibold text-accent-income">
Everything adds up!
</div>
<div className="text-[11px] text-muted">
Your {walletRecon.wallets.length} accounts ({formatMoney(walletRecon.totalWalletsBase, baseCurrency)}) match your available total money left ({formatMoney(walletRecon.expectedTotalBase, baseCurrency)}).
</div>
</div>
          </div>
) : (
<div className="space-y-3">
<div className="flex items-start gap-2.5">
<AlertTriangle
size={16}
className={walletRecon.missingAmountBase > 0 ? 'text-accent-expense shrink-0 mt-0.5' : 'text-amber-500 shrink-0 mt-0.5'}
/>
<div className="flex-1 min-w-0">
<div className="text-xs font-semibold">
{walletRecon.missingAmountBase > 0
? `Missing ${formatMoney(diffHTG, 'HTG')} (${formatMoney(diffHTD, 'HTD')} · ${formatMoney(diffUSD, 'USD')}) to reallocate`
: `Extra +${formatMoney(diffHTG, 'HTG')} (${formatMoney(diffHTD, 'HTD')} · ${formatMoney(diffUSD, 'USD')}) in accounts to allocate`}
</div>
<div className="text-[11px] text-muted mt-0.5">
Accounts sum to <strong>{formatMoney(walletRecon.totalWalletsBase, baseCurrency)}</strong>, while your recorded available money is{' '}
<strong>{formatMoney(walletRecon.expectedTotalBase, baseCurrency)}</strong>.
</div>
</div>
</div>

<div className="flex items-center gap-2 flex-wrap pt-1">
<select
value={reconcileBucket}
onChange={(e) => setReconcileBucket(e.target.value)}
className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs outline-none"
>
{walletRecon.extraAmountBase > 0 && (
<option value="auto">Auto-split across 5 buckets</option>
)}
{buckets.map((b) => (
<option key={b.key} value={b.key}>{b.name}</option>
))}
</select>


              <button
type="button"
onClick={() =>
onReconcile({
diffBase: walletRecon.differenceBase,
actionType: walletRecon.missingAmountBase > 0 ? 'expense' : 'income',
bucketKey: walletRecon.extraAmountBase > 0 && reconcileBucket === 'auto' ? 'auto' : reconcileBucket,
date: `${dateStr}T12:00:00.000Z`,
})
}
className="px-3 py-1.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium"
              >
{walletRecon.missingAmountBase > 0
? 'Deduct missing from bucket so everything adds up'
: 'Allocate extra money into buckets'}
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function InlineDayTxForm({ type, dateStr, wallets, buckets, defaultCurrency, onSave, onCancel }) {
const [notes, setNotes] = useState('');
const [amount, setAmount] = useState('');
const [currency, setCurrency] = useState(defaultCurrency || 'HTG');
const [walletId, setWalletId] = useState(wallets[0]?.id || 'w_moncash');
const [bucketKey, setBucketKey] = useState(type === 'income' ? 'auto' : 'operations');
const submit = (e) => {
e.preventDefault();
const v = parseFloat(amount);
if (!v || v <= 0) return;
const payload = {
type,
amount: v,
currency,
walletId,
category: type === 'income' ? 'Salary' : 'Other',
notes: notes.trim() || (type === 'income' ? 'Income' : 'Spending'),
date: `${dateStr}T12:00:00.000Z`,
};
if (type === 'income' && bucketKey !== 'auto') {
payload.buckets = { [bucketKey]: v };
} else if (type === 'expense') {
payload.sourceBucketKey = bucketKey;
payload.buckets = { [bucketKey]: -v };
}
onSave(payload);
};
  return (
<form onSubmit={submit} className="bg-[var(--bg)] rounded-xl p-3 mb-2 space-y-2 text-xs border border-[var(--border)]">
<div className="grid grid-cols-[1fr_auto] gap-2">
<input
type="text"
value={notes}
onChange={(e) => setNotes(e.target.value)}
placeholder={type === 'income' ? 'Income source (e.g., Recharge+, Salary)' : 'What did you spend on?'}
autoFocus
className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] outline-none"
/>
<select
value={currency}
onChange={(e) => setCurrency(e.target.value)}
className="px-2 py-1.5 rounded-lg bg-[var(--surface)] outline-none font-medium"
>
{Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
</select>
      </div>
<div className="grid grid-cols-3 gap-2">
<input
type="number"
step="0.01"
min="0"
value={amount}
onChange={(e) => setAmount(e.target.value)}
placeholder="Amount"
className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] outline-none num font-medium"
/>
<select
value={walletId}
onChange={(e) => setWalletId(e.target.value)}
className="px-2 py-1.5 rounded-lg bg-[var(--surface)] outline-none"
>
{wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
</select>
<select
value={bucketKey}
onChange={(e) => setBucketKey(e.target.value)}
className="px-2 py-1.5 rounded-lg bg-[var(--surface)] outline-none"
>
{type === 'income' && <option value="auto">Auto-Split (5 Buckets)</option>}
{buckets.map((b) => (
<option key={b.key} value={b.key}>{b.name}</option>
))}
</select>
</div>
<div className="flex justify-end gap-2 pt-1">
<button type="button" onClick={onCancel} className="px-2.5 py-1 rounded-lg bg-[var(--surface)] text-muted">
Cancel
</button>
<button
type="submit"
disabled={!amount || parseFloat(amount) <= 0}
className="px-3 py-1 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium disabled:opacity-40"
>
Save {type === 'income' ? 'Income' : 'Spending'}
</button>
</div>
</form>
);
}
function InlineConversionForm({ dateStr, wallets, onSave, onCancel }) {
const [fromWalletId, setFromWalletId] = useState('w_wise');
const [fromAmount, setFromAmount] = useState('');
const [fromCurrency, setFromCurrency] = useState('USD');
const [toWalletId, setToWalletId] = useState('w_moncash');
const [toAmount, setToAmount] = useState('');
const [toCurrency, setToCurrency] = useState('HTG');
const [feeAmount, setFeeAmount] = useState('');
const [feeCurrency, setFeeCurrency] = useState('HTG');
const [notes, setNotes] = useState('');
const submit = (e) => {
e.preventDefault();
if (!fromAmount || !toAmount) return;
onSave({
date: `${dateStr}T12:00:00.000Z`,
fromWalletId,
fromAmount: parseFloat(fromAmount) || 0,
fromCurrency,
toWalletId,
toAmount: parseFloat(toAmount) || 0,
toCurrency,
feeAmount: parseFloat(feeAmount) || 0,
feeCurrency,
notes: notes.trim(),
});
};
return (
<form onSubmit={submit} className="bg-[var(--bg)] rounded-xl p-3 space-y-2 text-xs border border-[var(--border)]">
<div className="font-semibold text-[11px]">Log Conversion & Any Fee Taken</div>
<div className="grid grid-cols-3 gap-1.5">
<select value={fromWalletId} onChange={(e) => setFromWalletId(e.target.value)} className="px-2 py-1.5 rounded bg-[var(--surface)]">
{wallets.map((w) => <option key={w.id} value={w.id}>From: {w.name}</option>)}
</select>
<input type="number" step="0.01" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} placeholder="From amt" className="px-2 py-1.5 rounded bg-[var(--surface)] num" />
<select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="px-2 py-1.5 rounded bg-[var(--surface)]">
{Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
</select>
</div>
<div className="grid grid-cols-3 gap-1.5">
<select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)} className="px-2 py-1.5 rounded bg-[var(--surface)]">
{wallets.map((w) => <option key={w.id} value={w.id}>To: {w.name}</option>)}
</select>
<input type="number" step="0.01" value={toAmount} onChange={(e) => setToAmount(e.target.value)} placeholder="Received amt" className="px-2 py-1.5 rounded bg-[var(--surface)] num" />
<select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="px-2 py-1.5 rounded bg-[var(--surface)]">
{Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
</select>
</div>
<div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-center">
<input
type="number"
step="0.01"
value={feeAmount}
onChange={(e) => setFeeAmount(e.target.value)}
placeholder="Fee taken (e.g. 105)"
className="px-2 py-1.5 rounded bg-[var(--surface)] num"
/>
<select value={feeCurrency} onChange={(e) => setFeeCurrency(e.target.value)} className="px-2 py-1.5 rounded bg-[var(--surface)]">
{Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
</select>
<input
type="text"
value={notes}
onChange={(e) => setNotes(e.target.value)}
placeholder="Note (e.g. Frais MonCash)"
className="px-2 py-1.5 rounded bg-[var(--surface)]"
/>
</div>
<div className="flex justify-end gap-2 pt-1">
<button type="button" onClick={onCancel} className="px-2.5 py-1 rounded bg-[var(--surface)] text-muted">Cancel</button>
<button type="submit" disabled={!fromAmount || !toAmount} className="px-3 py-1 rounded bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium disabled:opacity-40">
Save Conversion
</button>
</div>
</form>
);
}
function MiniMonthGrid({ selectedDate, transactions, onSelectDate }) {
const [cursorMonth, setCursorMonth] = useState(() => {
const d = new Date(`${selectedDate}T12:00:00`);
return new Date(d.getFullYear(), d.getMonth(), 1);
});
const activeDates = useMemo(() => {
const set = new Set();
for (const t of (transactions || [])) {
if (!t || !t.date || t.type === 'meta') continue;
set.add(toDateKey(t.date));
}
return set;
}, [transactions]);
const year = cursorMonth.getFullYear();
const month = cursorMonth.getMonth();
const firstDay = new Date(year, month, 1).getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const cells = [];
for (let i = 0; i < firstDay; i++) cells.push(null);
for (let day = 1; day <= daysInMonth; day++) {
const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
cells.push({ day, key: k, hasTx: activeDates.has(k) });
}
return (
<div className="surface border rounded-2xl p-3.5 text-xs">
<div className="flex items-center justify-between mb-2">
<button
type="button"
onClick={() => setCursorMonth(new Date(year, month - 1, 1))}
className="p-1 rounded hover:bg-[var(--bg)]"
>
<ChevronLeft size={14} />
</button>
<span className="font-semibold">
{cursorMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
</span>
<button
type="button"
onClick={() => setCursorMonth(new Date(year, month + 1, 1))}
className="p-1 rounded hover:bg-[var(--bg)]"
>
<ChevronRight size={14} />
</button>
</div>
<div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted mb-1">
{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
</div>
<div className="grid grid-cols-7 gap-1">
{cells.map((c, idx) =>
!c ? (
<div key={`empty_${idx}`} />
) : (
<button
key={c.key}
type="button"
onClick={() => onSelectDate(c.key)}
className={`py-1.5 rounded-lg num text-xs relative flex flex-col items-center justify-center ${
c.key === selectedDate
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-semibold'
: 'hover:bg-[var(--bg)]'
}`}
>
<span>{c.day}</span>
{c.hasTx && (
<span className={`w-1 h-1 rounded-full mt-0.5 ${c.key === selectedDate ? 'bg-current' : 'bg-accent-income'}`} />
)}
</button>
)
)}
      </div>
    </div>
  );
}

