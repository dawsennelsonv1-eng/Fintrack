
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
ArrowDownLeft, ArrowUpRight, Wallet, PieChart as PieIcon,
Eye, EyeOff, Wrench, Check, X, Sparkles, HandCoins, Calendar as CalendarIcon,
ArrowRight, AlertCircle, TrendingUp,
} from 'lucide-react';
import {
  useStore,
selectTransactions, selectBuckets, selectGoals, selectBudgetItems,
selectDebts, selectDebtEvents, selectBorrowedDeployments, selectWallets, selectConversions,
selectBaseCurrency, selectRates, selectPrivacyMask, selectDismissedAnomalies,
selectNetWorth, selectTotalAssets, selectTotalLiabilities, selectTotalLiquidAssets,
selectHighlightedTxId,
computeMonthSummary, computeMonthCashFlow, computeBucketBudgetSummary,
computeBorrowedSummary, computeDebtsWithStatus, computeWalletsWithReconciliation,
detectCurrencyAnomalies,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease, relativeTime } from '../lib/util';
import { useWorkspaceFilter, applyDateFilter } from '../lib/workspaceFilter';
import SyncBadge from '../components/SyncBadge';
import { useTxActions } from '../components/TxActions';
import PendingInbox from '../components/PendingInbox';
import BucketBars from '../components/BucketBars';
function toDateKey(d) {
const dt = new Date(d);
if (isNaN(dt)) return new Date().toISOString().slice(0, 10);
const y = dt.getFullYear();
const m = String(dt.getMonth() + 1).padStart(2, '0');
const day = String(dt.getDate()).padStart(2, '0');
return `${y}-${m}-${day}`;
}

export default function Dashboard() {
  const allTransactions = useStore(selectTransactions);
  const filter = useWorkspaceFilter('personal');
  const transactions = useMemo(
    () => applyDateFilter(allTransactions, filter, 'date'),
    [allTransactions, filter]
  );
const buckets             = useStore(selectBuckets);
const goals               = useStore(selectGoals);
const budgetItems         = useStore(selectBudgetItems);
const debts               = useStore(selectDebts);
const debtEvents          = useStore(selectDebtEvents);
const borrowedDeployments = useStore(selectBorrowedDeployments);
const wallets             = useStore(selectWallets);
const conversions         = useStore(selectConversions);
const baseCurrency        = useStore(selectBaseCurrency);
const rates               = useStore(selectRates);
const privacyMask         = useStore(selectPrivacyMask);
const togglePrivacyMask   = useStore((s) => s.togglePrivacyMask);
const dismissedAnomalies  = useStore(selectDismissedAnomalies);
const fixTransactionCurrency = useStore((s) => s.fixTransactionCurrency);
const dismissAnomaly      = useStore((s) => s.dismissAnomaly);
const setActiveTab        = useStore((s) => s.setActiveTab);
const openCalendarOnDate  = useStore((s) => s.openCalendarOnDate);
const spendFromBorrowedCapital = useStore((s) => s.spendFromBorrowedCapital);
const setRemainingBorrowedCapital = useStore((s) => s.setRemainingBorrowedCapital);
const highlightedTxId     = useStore(selectHighlightedTxId);
const netWorth          = useStore(selectNetWorth);
const totalAssets       = useStore(selectTotalAssets);
const totalLiabilities  = useStore(selectTotalLiabilities);
  const totalLiquidAssets = useStore(selectTotalLiquidAssets);


const summary = useMemo(
() => computeMonthSummary(transactions, baseCurrency, rates),
    [transactions, baseCurrency, rates]
  );
const cashFlow = useMemo(
() => computeMonthCashFlow(transactions, baseCurrency, rates),
    [transactions, baseCurrency, rates]
  );

const bucketSummary = useMemo(
() => computeBucketBudgetSummary(buckets, transactions, goals, budgetItems, baseCurrency, rates),
[buckets, transactions, goals, budgetItems, baseCurrency, rates]
);
const borrowedSummary = useMemo(
() => computeBorrowedSummary(debts, debtEvents, borrowedDeployments, baseCurrency, rates),
[debts, debtEvents, borrowedDeployments, baseCurrency, rates]
);
const debtsWithStatus = useMemo(
() => computeDebtsWithStatus(debts, debtEvents, baseCurrency, rates).filter((d) => d.direction === 'owe'),
[debts, debtEvents, baseCurrency, rates]
);
const walletRecon = useMemo(
() => computeWalletsWithReconciliation(wallets, allTransactions, conversions, baseCurrency, rates),
[wallets, allTransactions, conversions, baseCurrency, rates]
);
const opsBucket = useMemo(
() => bucketSummary.find((b) => b.key === 'operations') || bucketSummary[0],
[bucketSummary]
);
const daysLeftInMonth = useMemo(() => {
const now = new Date();
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
return Math.max(1, lastDay - now.getDate() + 1);
}, []);
const dailySafeAllowance = useMemo(() => {
if (!opsBucket) return 0;
return Math.max(0, opsBucket.safeToSpend / Math.min(7, daysLeftInMonth));
}, [opsBucket, daysLeftInMonth]);
const anomalies = useMemo(
() => detectCurrencyAnomalies(allTransactions, dismissedAnomalies),
[allTransactions, dismissedAnomalies]
);

  const { bind, sheet } = useTxActions();

  return (
<main className="max-w-2xl mx-auto px-5 pt-3 pb-32">
      <PendingInbox />

{/* Top Sync & Daily Safe Pace Strip */}
<div className="flex items-center justify-between gap-2 mb-3 px-1">
<div className="flex items-center gap-2 text-xs text-muted">
<Sparkles size={13} className="text-accent-income" />
<span>
Safe daily Ops:{' '}
<strong className="text-[var(--text)] num">{formatMoney(dailySafeAllowance, baseCurrency)}/day</strong>
</span>
</div>
<div className="flex items-center gap-2.5">
<SyncBadge />
<button
type="button"
onClick={() => openCalendarOnDate(toDateKey(new Date()), 'day')}
className="flex items-center gap-1 px-2.5 py-1 rounded-lg surface border text-[10px] font-medium text-muted hover:text-[var(--text)] transition-colors"
>
<CalendarIcon size={11} />
<span>Today’s Sheet</span>
</button>
</div>
</div>
{/* Data Doctor: Currency Anomaly Alert */}
<AnimatePresence>
{anomalies.length > 0 && (
<motion.section
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: 'auto' }}
exit={{ opacity: 0, height: 0 }}
className="mb-4 overflow-hidden"
>
<div className="surface border border-amber-500/40 bg-amber-500/5 rounded-2xl p-4 space-y-2.5">
<div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
<Wrench size={14} />
<span>Data Doctor · {anomalies.length} likely currency typo{anomalies.length > 1 ? 's' : ''} found</span>
              </div>
{anomalies.slice(0, 3).map((a) => (
<div key={a.txId} className="flex items-center justify-between gap-2 bg-[var(--bg)] rounded-xl px-3 py-2 text-xs">
<div className="min-w-0 flex-1">
<div className="font-medium truncate">{a.notes}</div>
<div className="text-[11px] text-muted">{a.reason}</div>
</div>
<div className="flex items-center gap-1.5 shrink-0">
<button
type="button"
onClick={() => fixTransactionCurrency(a.txId, a.suggestedCurrency)}
className="px-2.5 py-1.5 rounded-lg bg-accent-income text-white text-[11px] font-medium flex items-center gap-1"
>
<Check size={11} /> Fix to {a.amount} {a.suggestedCurrency}
</button>
<button
type="button"
onClick={() => dismissAnomaly(a.txId)}
className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-muted"
>
<X size={12} />
</button>
</div>
                </div>
))}
</div>
</motion.section>
)}
</AnimatePresence>
{/* ─── 1. PRIMARY HERO: DANGER MODE & 5-BUCKET COMMAND CENTER ──── */}
<motion.section {...fadeUp} transition={{ duration: 0.45, ease }} className="mb-5">
<BucketBars onSelectBucket={() => setActiveTab('budgets')} showCards={true} />
</motion.section>
{/* ─── 2. SECONDARY IMPORTANT METRICS BELOW BUCKETS ────────────── */}
<motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }} className="space-y-3 mb-5">
<div className="flex items-baseline justify-between px-1">
<div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Secondary Position
</div>
<h2 className="font-display text-2xl">Borrowed Capital, Net Worth & Debts</h2>
</div>
<button
type="button"
onClick={togglePrivacyMask}
className="text-[11px] text-muted hover:text-[var(--text)] flex items-center gap-1"
>
{privacyMask ? <Eye size={12} /> : <EyeOff size={12} />}
<span>{privacyMask ? 'More stats' : 'Hide extra stats'}</span>
</button>
</div>
{/* Fixed Borrowed Capital Card (with inline Record Spent / Adjust Remaining) */}
<BorrowedCapitalSecondaryCard
borrowedSummary={borrowedSummary}
baseCurrency={baseCurrency}
onSpendBorrowed={spendFromBorrowedCapital}
onSetRemaining={setRemainingBorrowedCapital}
onOpenWealth={() => setActiveTab('investments')}
/>
{/* Accurate Net Worth, Wallets & Active Debts with Repayment Badges */}
<div className="surface border rounded-2xl p-4 space-y-3">
<div className="grid grid-cols-3 gap-2 text-center">
<div className="bg-[var(--bg)] rounded-xl p-2.5">
<div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">Actual Net Worth</div>
<div className={`font-display text-lg num mt-0.5 ${netWorth < 0 ? 'text-accent-expense' : ''}`}>
{formatCompact(netWorth, baseCurrency)}
</div>
<div className="text-[9px] text-muted">Assets − Debts</div>
</div>
<button
type="button"
onClick={() => openCalendarOnDate(toDateKey(new Date()), 'day')}
className="bg-[var(--bg)] hover:bg-[var(--border)]/50 transition-colors rounded-xl p-2.5 text-center"
>
<div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">In 6 Wallets</div>
<div className="font-display text-lg num mt-0.5">
{formatCompact(walletRecon.totalWalletsBase, baseCurrency)}
</div>
<div className="text-[9px] text-muted">
{walletRecon.isBalanced ? '✓ Matches ledger' : 'Tap to verify'}
</div>
</button>
<button
type="button"
onClick={() => setActiveTab('debt')}
className="bg-[var(--bg)] hover:bg-[var(--border)]/50 transition-colors rounded-xl p-2.5 text-center"
>
<div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">Total Owed Debt</div>
<div className="font-display text-lg num mt-0.5 text-accent-expense">
{formatCompact(totalLiabilities, baseCurrency)}
</div>
<div className="text-[9px] text-muted">{debtsWithStatus.length} active</div>
</button>
</div>
{/* Active Debts Quick Strip showing recent "-$10 / -1,000 HTG" repayment badges linked to Expenses */}
{debtsWithStatus.length > 0 && (
<div className="pt-2 border-t border-[var(--border)] space-y-1.5">
<div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-wider font-semibold">
<span>Active Debts & Recent Repayments</span>
<button type="button" onClick={() => setActiveTab('debt')} className="hover:text-[var(--text)] underline">
Open Debt tab →
</button>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
{debtsWithStatus.map((d) => (
<div
key={d.id}
className="bg-[var(--bg)] rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
>
<div className="flex items-center gap-1.5 min-w-0 flex-wrap">
<span className="font-medium truncate">{d.creditor}</span>
{d.repaid > 0 && (
<button
type="button"
onClick={() => {
if (d.latestRepayment?.date) {
openCalendarOnDate(toDateKey(d.latestRepayment.date), 'day');
} else {
setActiveTab('debt');
}
}}
className="px-1.5 py-0.5 rounded-md bg-accent-income/15 text-accent-income text-[10px] font-semibold num hover:bg-accent-income hover:text-white transition-colors"
title="Paid in Spendings — tap to view expense on that date"
>
−{formatMoney(d.repaid, d.currency)} paid
</button>
)}
</div>
<span className="font-semibold num text-accent-expense shrink-0">
{formatMoney(d.remaining, d.currency)} left
</span>
</div>
))}
              </div>
            </div>
)}
{/* Extra Collapsible Metrics (Hidden unless toggled open) */}
<AnimatePresence>
{!privacyMask && (
<motion.div
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: 'auto' }}
exit={{ opacity: 0, height: 0 }}
className="overflow-hidden pt-2 border-t border-[var(--border)]"
>
<div className="grid grid-cols-3 gap-2 text-xs">
<div className="bg-[var(--bg)] rounded-xl p-2.5">
<div className="text-[9px] uppercase text-muted">Total Assets</div>
<div className="font-display text-sm num mt-0.5">{formatCompact(totalAssets, baseCurrency)}</div>
</div>
<div className="bg-[var(--bg)] rounded-xl p-2.5">
<div className="text-[9px] uppercase text-muted">Liquid Assets</div>
<div className="font-display text-sm num mt-0.5">{formatCompact(totalLiquidAssets, baseCurrency)}</div>
</div>
<div className="bg-[var(--bg)] rounded-xl p-2.5">
<div className="text-[9px] uppercase text-muted">MTD Spend (w/ Debt)</div>
<div className="font-display text-sm num mt-0.5 text-accent-expense">
−{formatCompact(summary.totalSpendWithRepayments, baseCurrency)}
</div>
</div>
</div>
</motion.div>
)}
</AnimatePresence>
        </div>
      </motion.section>

{/* ─── 3. SPENDING BREAKDOWN BY CATEGORY ──────────────────────── */}
<motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.08 }} className="mb-5">
        <SpendingBreakdown
          transactions={transactions}
          baseCurrency={baseCurrency}
          rates={rates}
        />
      </motion.section>

{/* ─── 4. TRANSACTION HISTORY (WITH CALENDAR DAY BUTTON PER DAY) ─── */}
<motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.12 }}>
        <TransactionHistory
          transactions={transactions}
          baseCurrency={baseCurrency}
          rates={rates}
          bind={bind}
highlightedTxId={highlightedTxId}
onOpenDayInCalendar={(dateKey) => openCalendarOnDate(dateKey, 'day')}
        />
      </motion.section>

      {sheet}
    </main>
);
}
function BorrowedCapitalSecondaryCard({
borrowedSummary,
baseCurrency,
onSpendBorrowed,
onSetRemaining,
onOpenWealth,
}) {
const [adjustOpen, setAdjustOpen] = useState(false);
const [mode, setMode] = useState('spent'); // 'spent' | 'remaining'
const [val, setVal] = useState('');
const [curr, setCurr] = useState(baseCurrency);
const [note, setNote] = useState('');
const { totalPrincipalBase, totalDeployedOrSpentBase, undeployedPoolBase } = borrowedSummary;
const handleSave = (e) => {
e.preventDefault();
const num = parseFloat(val);
if (isNaN(num) || num < 0) return;
if (mode === 'spent') {
if (num > 0) {
onSpendBorrowed({ amount: num, currency: curr, note: note.trim() || 'Spent from borrowed capital' });
}
} else {
onSetRemaining(num, curr);
}
setVal('');
setNote('');
setAdjustOpen(false);
};
return (
<div
className="surface border rounded-2xl p-4"
style={{ borderColor: 'rgba(212,169,66,0.35)' }}
>
<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-3 min-w-0">
<div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
<HandCoins size={18} strokeWidth={2.2} />
</div>
<div className="min-w-0">
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Borrowed Capital Pool (Fixed)
</div>
<div className="flex items-baseline gap-2 flex-wrap">
<span className="font-display text-2xl num">
{formatMoney(undeployedPoolBase, baseCurrency)}
</span>
<span className="text-[11px] text-muted num">
left of {formatCompact(totalPrincipalBase, baseCurrency)} borrowed ({formatCompact(totalDeployedOrSpentBase, baseCurrency)} spent/used)
</span>
</div>
</div>
</div>
<div className="flex items-center gap-1.5 shrink-0">
<button
type="button"
onClick={() => {
setCurr(baseCurrency);
setAdjustOpen((v) => !v);
}}
className="px-2.5 py-1.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] text-xs font-medium transition-colors"
>
{adjustOpen ? 'Close' : 'Update / Spend'}
</button>
</div>
</div>
<AnimatePresence>
{adjustOpen && (
<motion.form
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: 'auto' }}
exit={{ opacity: 0, height: 0 }}
onSubmit={handleSave}
className="overflow-hidden mt-3 pt-3 border-t border-[var(--border)] space-y-2.5 text-xs"
>
<div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
<button
type="button"
onClick={() => setMode('spent')}
className={`py-1.5 rounded-lg font-medium ${
mode === 'spent' ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
}`}
>
Record amount spent
</button>
<button
type="button"
onClick={() => setMode('remaining')}
className={`py-1.5 rounded-lg font-medium ${
mode === 'remaining' ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
}`}
>
Set exact remaining left
</button>
</div>
<div className="grid grid-cols-[1fr_auto] gap-2">
<input
type="number"
step="0.01"
min="0"
value={val}
onChange={(e) => setVal(e.target.value)}
placeholder={mode === 'spent' ? 'How much borrowed money was spent?' : 'Exact borrowed money still left'}
autoFocus
className="px-3 py-2 rounded-xl bg-[var(--bg)] outline-none num text-sm"
/>
<select
value={curr}
onChange={(e) => setCurr(e.target.value)}
className="px-2.5 py-2 rounded-xl bg-[var(--bg)] outline-none font-medium"
>
{Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
</select>
</div>
{mode === 'spent' && (
<input
type="text"
value={note}
onChange={(e) => setNote(e.target.value)}
placeholder="What was it spent on? (optional)"
className="w-full px-3 py-2 rounded-xl bg-[var(--bg)] outline-none"
/>
)}
<div className="flex justify-between items-center gap-2">
<button
type="button"
onClick={onOpenWealth}
className="text-[11px] text-muted hover:text-[var(--text)] underline"
>
Deploy into Investments/Ventures →
</button>
<button
type="submit"
className="px-4 py-2 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium"
>
Save & Update Pool
</button>
</div>
</motion.form>
)}
</AnimatePresence>
</div>
  );
}

const PIE_COLORS = [
  '#c2452f', '#d4a942', '#3d8b5f', '#5b8def', '#9b59b6',
  '#e07a5f', '#7a8a8c', '#2c8d9c', '#a67c5a', '#9aa3ad',
];

function SpendingBreakdown({ transactions, baseCurrency, rates }) {
  const { incomeData, expenseData, totalIncome, totalExpense } = useMemo(() => {
const cutoff30d = Date.now() - 30 * 24 * 3600 * 1000;
    const inc = {}, exp = {};
    let totalIn = 0, totalEx = 0;
    for (const t of transactions) {
if (new Date(t.date).getTime() < cutoff30d) continue;
if (t.type === 'transfer' || t.type === 'meta') continue;
      const v = convert(Math.abs(t.amount), t.currency || 'USD', baseCurrency, rates);
      const cat = t.category || 'Other';
      if (t.type === 'income')  { inc[cat] = (inc[cat] || 0) + v; totalIn += v; }
      if (t.type === 'expense') { exp[cat] = (exp[cat] || 0) + v; totalEx += v; }
    }
    const toData = (m) => Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return {
      incomeData: toData(inc),
      expenseData: toData(exp),
      totalIncome: totalIn,
      totalExpense: totalEx,
    };
  }, [transactions, baseCurrency, rates]);

  const hasAnyData = incomeData.length > 0 || expenseData.length > 0;

  return (
    <div className="surface border rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Breakdown</div>
          <div className="font-display text-2xl mt-0.5">By category</div>
        </div>
<span className="text-[11px] text-muted">Last 30 days (incl. debt paid)</span>
      </div>

      {!hasAnyData ? (
        <div className="py-8 text-center">
          <PieIcon size={24} className="mx-auto text-muted mb-2" strokeWidth={1.5} />
<div className="text-sm text-muted">No activity in the last 30 days</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
<CategoryPie data={incomeData} total={totalIncome} label="Inflows" currency={baseCurrency} tone="income" />
<CategoryPie data={expenseData} total={totalExpense} label="Spendings" currency={baseCurrency} tone="expense" />
        </div>
      )}
    </div>
  );
}

function CategoryPie({ data, total, label, currency, tone }) {
  const isEmpty = data.length === 0;
  const toneClass = tone === 'income' ? 'text-accent-income' : 'text-accent-expense';
  return (
    <div className="bg-[var(--bg)] rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold">{label}</span>
        <span className={`text-[11px] num font-medium ${toneClass}`}>
          {tone === 'income' ? '+' : '−'}{formatCompact(total, currency)}
        </span>
      </div>
      {isEmpty ? (
        <div className="h-32 flex items-center justify-center text-[11px] text-muted">None</div>
      ) : (
        <>
          <div className="h-32 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" cx="50%" cy="50%"
                  innerRadius={32} outerRadius={56} paddingAngle={2}
                  isAnimationActive animationDuration={600} stroke="none">
                  {data.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                </Pie>
                <Tooltip content={<PieTip currency={currency} total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1 mt-1">
            {data.slice(0, 4).map((d, i) => {
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <li key={d.name} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate flex-1">{d.name}</span>
                  <span className="num text-muted">{pct.toFixed(0)}%</span>
                </li>
              );
            })}
            {data.length > 4 && (
              <li className="text-[10px] text-muted pl-3">+{data.length - 4} more</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function PieTip({ active, payload, currency, total }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="surface border rounded-lg px-2.5 py-1.5 shadow-lg text-[11px] num">
      <div className="font-medium">{name}</div>
      <div className="text-muted">{formatMoney(value, currency)} · {pct.toFixed(1)}%</div>
    </div>
  );
}

function TransactionHistory({ transactions, baseCurrency, rates, bind, highlightedTxId, onOpenDayInCalendar }) {
const [showCount, setShowCount] = useState(12);
const cleanTxs = useMemo(
() => transactions.filter((t) => t && t.type !== 'meta' && t.category !== '__system__'),
[transactions]
  );
const total = cleanTxs.length;
const visible = cleanTxs.slice(0, showCount);
  const hasMore = showCount < total;

  const grouped = useMemo(() => {
    const groups = {};
    for (const t of visible) {
      const d = new Date(t.date);
const dateKey = toDateKey(d);
const label = d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
if (!groups[dateKey]) groups[dateKey] = { label, dateKey, transactions: [], date: d };
groups[dateKey].transactions.push(t);
    }
return Object.values(groups);
  }, [visible]);

  return (
    <>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="font-display text-2xl">History</h2>
        <span className="text-[11px] text-muted">
          {total === 0 ? 'No entries yet' : `${total} total`}
        </span>
      </div>

      {total === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <Wallet size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
          <div className="font-display text-xl mb-1">Nothing yet</div>
          <div className="text-sm text-muted">Tap the + button to log your first entry</div>
        </div>
      ) : (
        <>
<div className="space-y-4">
{grouped.map((group) => (
<div key={group.dateKey}>
{/* Day Header with Direct Redirect Button to Calendar Daily Sheet */}
<div className="flex items-center justify-between gap-2 mb-1.5 px-1">
<div className="text-[11px] uppercase tracking-[0.12em] text-muted font-semibold">
{group.label}
</div>
<button
type="button"
onClick={() => onOpenDayInCalendar(group.dateKey)}
className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg surface border text-[10px] font-medium text-[var(--text)] hover:bg-[var(--bg)] active:scale-95 transition-all"
>
<CalendarIcon size={10} />
<span>Open Day in Calendar</span>
<ArrowRight size={10} />
</button>
                </div>

                <ul className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
                  {group.transactions.map((t) => (
<Row
key={t.id}
tx={t}
isHighlighted={highlightedTxId === t.id}
baseCurrency={baseCurrency}
rates={rates}
bind={bind}
/>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowCount((c) => c + 20)}
              className="w-full mt-3 py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium text-muted"
            >
              Load older ({total - showCount} more)
            </button>
          )}
{!hasMore && total > 12 && (
            <button
onClick={() => setShowCount(12)}
              className="w-full mt-3 py-2 text-[11px] text-muted hover:text-[var(--text)] transition-colors"
            >
              Collapse
            </button>
          )}
          <p className="text-[11px] text-muted text-center mt-3">Long-press an entry to edit or delete</p>
        </>
      )}
    </>
  );
}

function Row({ tx, isHighlighted, baseCurrency, rates, bind }) {
  const isIncome = tx.type === 'income';
const isRepayment = tx.category === 'Repayment';
  const inBase = convert(Math.abs(tx.amount), tx.currency || 'USD', baseCurrency, rates);
  const showConversion = (tx.currency || 'USD') !== baseCurrency;
const bucketKeys = Object.keys(tx.buckets || {});
const bucketBadge =
bucketKeys.length > 1
? `Split (${bucketKeys.length})`
: bucketKeys.length === 1
? bucketKeys[0]
: null;
  return (
    <li
      {...bind(tx)}
className={`flex items-center gap-3 px-4 py-3.5 select-none cursor-pointer active:bg-[var(--bg)] transition-colors ${
isHighlighted ? 'bg-amber-500/10 ring-1 ring-amber-500/40' : ''
}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
      }`}>
        {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </div>
      <div className="flex-1 min-w-0">
<div className="flex items-center gap-1.5">
<span className="text-sm font-medium truncate">{tx.notes || tx.category}</span>
{isRepayment && (
<span className="px-1.5 py-0.5 rounded bg-accent-expense/15 text-accent-expense text-[9px] font-semibold shrink-0">
Debt Expense
</span>
)}
</div>
<div className="text-[11px] text-muted truncate flex items-center gap-1.5">
<span>{tx.category} · {relativeTime(tx.date)}</span>
{bucketBadge && (
<span className="px-1.5 py-0.2 rounded bg-[var(--bg)] text-[9px] uppercase tracking-wider">
{bucketBadge}
</span>
)}
{tx._pending && <span className="text-amber-600 dark:text-amber-400">· syncing</span>}
        </div>
      </div>
      <div className="text-right">
<div className={`font-medium num text-sm ${isIncome ? 'text-accent-income' : 'text-accent-expense'}`}>
          {isIncome ? '+' : '−'}{formatMoney(Math.abs(tx.amount), tx.currency || 'USD')}
        </div>
        {showConversion && (
          <div className="text-[10px] text-muted num">≈ {formatMoney(inBase, baseCurrency)}</div>
        )}
      </div>
    </li>
  );
}
