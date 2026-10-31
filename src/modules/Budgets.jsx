import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
Flame, TrendingUp, Wallet, Shield, Heart, Sparkles,
  Plus, X, ArrowRight, ArrowLeftRight, Target, Trash2, Check,
ChevronUp, ChevronDown, Calendar, Zap, Calculator, Clock,
AlertTriangle, FileText, Play,
} from 'lucide-react';
import {
  useStore,
  selectBuckets, selectGoals, selectTransactions, selectBudgetItems,
selectBaseCurrency, selectRates, selectIsDangerMode, selectBucketNotes,
computeBucketBalances, computeBucketBudgetSummary, computeGoalsForBucket,
computeItemWeeklyEquivalent, computeItemMonthlyEquivalent, autoSplitIncome,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease, relativeTime } from '../lib/util';
import BucketBars from '../components/BucketBars';

const ICON_MAP = {
Flame, TrendingUp, Wallet, Shield, Heart, Sparkles,
};

export default function BudgetsModule() {
  const buckets      = useStore(selectBuckets);
  const goals        = useStore(selectGoals);
  const transactions = useStore(selectTransactions);
const budgetItems  = useStore(selectBudgetItems);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);
const isDangerMode = useStore(selectIsDangerMode);
const transfer     = useStore((s) => s.transferBetweenBuckets);

  const balances = useMemo(
    () => computeBucketBalances(transactions, baseCurrency, rates),
    [transactions, baseCurrency, rates]
  );


const bucketSummaries = useMemo(
() => computeBucketBudgetSummary(buckets, transactions, goals, budgetItems, baseCurrency, rates),
[buckets, transactions, goals, budgetItems, baseCurrency, rates]
  );

  const [transferOpen, setTransferOpen] = useState(false);
const [simulatorOpen, setSimulatorOpen] = useState(false);
const [activeBucketKey, setActiveBucketKey] = useState(null);
const [initialPlannerTab, setInitialPlannerTab] = useState('goals');

const activeBucketSummary = useMemo(
() => bucketSummaries.find((b) => b.key === activeBucketKey) || null,
[bucketSummaries, activeBucketKey]
);
const deficitBucket = useMemo(
() => bucketSummaries.find((b) => b.balance < -0.01),
[bucketSummaries]
);
const surplusBucket = useMemo(
() =>
[...bucketSummaries]
.filter((b) => b.safeToSpend > 0 && (!deficitBucket || b.key !== deficitBucket.key))
.sort((a, b) => b.safeToSpend - a.safeToSpend)[0] || null,
[bucketSummaries, deficitBucket]
);
const handleAutoCoverDeficit = () => {
if (!deficitBucket || !surplusBucket) return;
const coverAmt = Math.min(Math.abs(deficitBucket.balance), surplusBucket.safeToSpend);
if (coverAmt <= 0) return;
transfer({
fromKey: surplusBucket.key,
toKey: deficitBucket.key,
amount: Math.round(coverAmt * 100) / 100,
currency: baseCurrency,
notes: `Auto-cover ${deficitBucket.name} deficit`,
});
};
if (bucketSummaries.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Buckets</div>
        <h1 className="font-display text-4xl mb-6">Budgets</h1>
        <div className="surface border rounded-2xl p-8 text-center">
          <Wallet size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
          <div className="font-display text-xl mb-1">Setting up buckets…</div>

        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
{/* Page Header */}
<motion.section {...fadeUp} transition={{ duration: 0.45, ease }} className="mb-4">
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
{isDangerMode ? 'Danger Mode · 40 / 25 / 20 / 10 / 5' : 'Normal Mode · 50 / 30 / 10 / 5 / 5'}
        </div>
<div className="flex items-center justify-between gap-2 flex-wrap">
<h1 className="font-display text-4xl">Bucket Budgets</h1>
<div className="flex items-center gap-2">
<button
type="button"
onClick={() => setSimulatorOpen((v) => !v)}
className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl surface border text-xs font-medium hover:bg-[var(--bg)] transition-colors"
>
<Calculator size={13} /> Simulator
</button>
<button
type="button"
onClick={() => setTransferOpen(true)}
className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl surface border text-xs font-medium hover:bg-[var(--bg)] transition-colors"
>
<ArrowLeftRight size={13} /> Transfer
</button>
          </div>
        </div>
      </motion.section>

{/* What-If Income Split Simulator Drawer */}
<AnimatePresence>
{simulatorOpen && (
<motion.section
initial={{ opacity: 0, height: 0 }}
animate={{ opacity: 1, height: 'auto' }}
exit={{ opacity: 0, height: 0 }}
className="mb-4 overflow-hidden"
>
<IncomeSimulatorCard
buckets={bucketSummaries}
baseCurrency={baseCurrency}
rates={rates}
onClose={() => setSimulatorOpen(false)}
/>
</motion.section>
)}
</AnimatePresence>
{/* 1-Tap Deficit Rebalancer Alert */}
{deficitBucket && surplusBucket && (
<motion.section {...fadeUp} transition={{ duration: 0.4, ease }} className="mb-4">
<div className="surface border border-amber-500/40 bg-amber-500/5 rounded-2xl p-3.5 flex items-center justify-between gap-3">
<div className="min-w-0 flex-1">
<div className="text-xs font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
<AlertTriangle size={13} />
<span>{deficitBucket.name} is negative ({formatMoney(deficitBucket.balance, baseCurrency)})</span>
</div>
<div className="text-[11px] text-muted mt-0.5">
{surplusBucket.name} has {formatMoney(surplusBucket.safeToSpend, baseCurrency)} uncommitted cash available.
</div>
</div>
<button
type="button"
onClick={handleAutoCoverDeficit}
className="px-3 py-2 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium shrink-0"
>
Cover deficit
</button>
</div>
</motion.section>
)}
{/* Top Danger Mode & 5-Bucket Overview Graph */}
<motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.04 }} className="mb-6">
<BucketBars
showCards={false}
onSelectBucket={(b) => {
setInitialPlannerTab('goals');
setActiveBucketKey(b.key);
}}
/>
</motion.section>
{/* Detailed Bucket Budgeting Studio Cards */}
<div className="flex items-baseline justify-between mb-3 px-1">
<div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Plan Your Spending
</div>
<h2 className="font-display text-2xl">Buckets, Goals & Planned Bills</h2>
</div>
<span className="text-[11px] text-muted">Tap any bucket to plan</span>
</div>
<motion.section
{...fadeUp}
transition={{ duration: 0.5, ease, delay: 0.08 }}
className="space-y-4 mb-6"
>
{bucketSummaries.map((bucket, i) => (
<BucketStudioCard
key={bucket.key}
            bucket={bucket}

            baseCurrency={baseCurrency}
            rates={rates}
delay={0.08 + i * 0.04}
onOpenPlanner={(tab = 'goals') => {
setInitialPlannerTab(tab);
setActiveBucketKey(bucket.key);
}}
          />
        ))}
      </motion.section>


      <BucketTransferSheet
        open={transferOpen}
buckets={bucketSummaries}
        balances={balances}
        baseCurrency={baseCurrency}
        rates={rates}
        onClose={() => setTransferOpen(false)}
      />

<BucketPlannerSheet
bucket={activeBucketSummary}
initialTab={initialPlannerTab}
onClose={() => setActiveBucketKey(null)}
      />

    </main>
  );
}

// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
function IncomeSimulatorCard({ buckets, baseCurrency, rates, onClose }) {
const [simAmount, setSimAmount] = useState('5000');
const [simCurrency, setSimCurrency] = useState(baseCurrency);
const addTransaction = useStore((s) => s.addTransaction);

const numAmt = parseFloat(simAmount) || 0;
const amtInBase = convert(numAmt, simCurrency, baseCurrency, rates);
const split = useMemo(() => autoSplitIncome(numAmt, buckets), [numAmt, buckets]);

const handleLogSimulatedIncome = () => {
if (numAmt <= 0) return;
addTransaction({
type: 'income',
amount: numAmt,
currency: simCurrency,
category: 'Salary',
notes: 'Income (auto-split)',
buckets: split,
});
onClose();
  };

  return (
<div className="surface border rounded-2xl p-4 space-y-3">
<div className="flex items-center justify-between">
        <div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
What-If Paycheck Simulator
</div>
<div className="text-sm font-medium">Preview how new income splits across your 5 buckets</div>
        </div>
<button type="button" onClick={onClose} className="w-7 h-7 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
<X size={14} />
        </button>
      </div>

<div className="grid grid-cols-[1fr_auto] gap-2">
<input
type="number"
inputMode="decimal"
value={simAmount}
onChange={(e) => setSimAmount(e.target.value)}
placeholder="Enter amount"
className="px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] outline-none font-display text-xl num"
/>
<div className="flex gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
{Object.keys(CURRENCIES).map((c) => (
<button
key={c}
type="button"
onClick={() => setSimCurrency(c)}
className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
simCurrency === c ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
}`}
>
{c}
</button>
))}
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
{buckets.map((b) => {
const portion = split[b.key] || 0;
const portionBase = convert(portion, simCurrency, baseCurrency, rates);
const newBal = b.balance + portionBase;
return (
<div key={b.key} className="bg-[var(--bg)] rounded-xl p-2.5 flex items-center justify-between text-xs">
<div className="flex items-center gap-2 min-w-0">
<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
<span className="font-medium truncate">{b.name} ({b.percentage}%)</span>
</div>
<div className="text-right num shrink-0">
<div className="text-accent-income font-semibold">+{formatMoney(portion, simCurrency)}</div>
<div className="text-[10px] text-muted">→ {formatCompact(newBal, baseCurrency)}</div>
</div>
            </div>
);
})}
</div>
{amtInBase > 0 && (
<button
type="button"
onClick={handleLogSimulatedIncome}
className="w-full py-2.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium"
>
Log {formatMoney(numAmt, simCurrency)} as split income now
</button>
      )}
</div>
  );
}

// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
function BucketStudioCard({ bucket, baseCurrency, rates, delay, onOpenPlanner }) {
const confirmBudgetItem = useStore((s) => s.confirmBudgetItem);
const setQuickSpendBucket = useStore((s) => s.setQuickSpendBucket);
  const Icon = ICON_MAP[bucket.icon] || Wallet;

const totalPool = Math.max(
1,
bucket.positiveBalance,
bucket.goalsFilled + bucket.plannedWeeklyOutflow
  );
const goalPct = Math.min(100, (bucket.goalsFilled / totalPool) * 100);
const plannedPct = Math.min(100 - goalPct, (bucket.plannedWeeklyOutflow / totalPool) * 100);
const freePct = Math.max(0, Math.min(100 - goalPct - plannedPct, (bucket.safeToSpend / totalPool) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.45, ease, delay }}
      className="surface border rounded-2xl overflow-hidden"
style={{ borderLeftWidth: 4, borderLeftColor: bucket.color }}
    >
<div className="p-4">
{/* Header */}
<div className="flex items-start gap-3">
<button
type="button"
onClick={() => onOpenPlanner('goals')}
className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
>
<Icon size={20} strokeWidth={2.1} />
</button>
<div className="flex-1 min-w-0">
<div className="flex items-baseline justify-between gap-2">
<button
type="button"
onClick={() => onOpenPlanner('goals')}
className="text-left min-w-0"
>
<div className="flex items-center gap-2 flex-wrap">
<span className="font-medium text-base truncate">{bucket.name}</span>
<span
className="text-[10px] px-2 py-0.5 rounded-full font-semibold num"
style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
>
{bucket.percentage}% split
</span>
</div>
<div className="text-[11px] text-muted mt-0.5 num">
Safe uncommitted: <strong className="text-accent-income">{formatMoney(bucket.safeToSpend, baseCurrency)}</strong>
{bucket.daysToFundGoals !== null && bucket.daysToFundGoals > 0 && (
<span> · Goals funded in ≈ {bucket.daysToFundGoals}d</span>
)}
</div>
</button>
<div className="text-right shrink-0">
<div className="text-[9px] uppercase tracking-wider text-muted font-semibold">Money Left</div>
<div className={`font-display text-2xl num ${bucket.balance < 0 ? 'text-accent-expense' : ''}`}>
{formatMoney(bucket.balance, baseCurrency)}
</div>
</div>
</div>
{/* 3-Segment Visual Budget Breakdown Bar */}
<div className="mt-3">
<div className="h-2.5 bg-[var(--bg)] rounded-full overflow-hidden flex border border-[var(--border)]/60">
{bucket.balance < 0 ? (
<div className="h-full w-full bg-accent-expense" />
) : (
<>
{goalPct > 0 && (
<div style={{ width: `${goalPct}%`, backgroundColor: '#d4a942' }} className="h-full" />
)}
{plannedPct > 0 && (
<div style={{ width: `${plannedPct}%`, backgroundColor: '#5b8def' }} className="h-full" />
)}
{freePct > 0 && (
<div style={{ width: `${freePct}%`, backgroundColor: bucket.color }} className="h-full" />
)}
</>
)}
</div>
<div className="grid grid-cols-3 gap-2 mt-2 text-[10px] num">
<div className="bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
<div className="text-muted flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-[#d4a942]" /> Goals Locked
</div>
<div className="font-semibold mt-0.5">{formatCompact(bucket.goalsFilled, baseCurrency)}</div>
</div>
<div className="bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
<div className="text-muted flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-[#5b8def]" /> Planned / Wk
</div>
<div className="font-semibold mt-0.5">{formatCompact(bucket.plannedWeeklyOutflow, baseCurrency)}</div>
</div>
<div className="bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
<div className="text-muted flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bucket.color }} /> Free Left
</div>
<div className="font-semibold text-accent-income mt-0.5">{formatCompact(bucket.safeToSpend, baseCurrency)}</div>
</div>
</div>
</div>
</div>
</div>
{/* Inline Preview of Active Goals & Planned Expenses in this Bucket */}
{(bucket.activeGoals.length > 0 || bucket.plannedExpenses.length > 0) && (
<div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
{bucket.activeGoals.slice(0, 2).map((g) => (
<div key={g.id} className="flex items-center justify-between text-xs bg-[var(--bg)] rounded-xl px-3 py-2">
<div className="flex items-center gap-2 min-w-0">
<Target size={12} className="text-[#d4a942] shrink-0" />
<span className="font-medium truncate">{g.name}</span>
{g.ready && (
<span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-income/15 text-accent-income font-semibold">
Ready ✦
</span>
)}
</div>
<span className="num text-[11px] text-muted shrink-0">
{formatCompact(g.filledBase, baseCurrency)} / {formatCompact(g.targetBase, baseCurrency)} ({Math.round(g.progress * 100)}%)
</span>
</div>
))}
{bucket.plannedExpenses.slice(0, 2).map((item) => (
<div key={item.id} className="flex items-center justify-between text-xs bg-[var(--bg)] rounded-xl px-3 py-2">
<div className="flex items-center gap-2 min-w-0">
<Calendar size={12} className="text-[#5b8def] shrink-0" />
<span className="truncate">{item.name}</span>
<span className="text-[10px] text-muted">· {item.frequency}</span>
</div>
<div className="flex items-center gap-2 shrink-0">
<span className="num text-[11px] font-medium text-amber-500">
{formatMoney(item.amount, item.currency)}
</span>
<button
type="button"
onClick={() => confirmBudgetItem(item.id)}
className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[10px] font-medium hover:bg-accent-income hover:text-white transition-colors"
title="Log this planned expense now"
>
Spend now
</button>
</div>
</div>
))}
</div>
)}
{/* Action Buttons Row */}
<div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[var(--border)]">
<button
type="button"
onClick={() => onOpenPlanner('goals')}
className="py-2 px-2.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
>
<Target size={12} /> Goals ({bucket.activeGoals.length})
</button>
<button
type="button"
onClick={() => onOpenPlanner('planned')}
className="py-2 px-2.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
>
<Calendar size={12} /> Plan Bills ({bucket.plannedExpenses.length})
</button>
<button
type="button"
onClick={() => setQuickSpendBucket(bucket.key)}
className="py-2 px-2.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
>
<Zap size={12} /> Quick Spend
</button>
</div>
</div>
</motion.div>
);
}
function BucketPlannerSheet({ bucket, initialTab = 'goals', onClose }) {
const [tab, setTab] = useState(initialTab);
const goals        = useStore(selectGoals);
const budgetItems  = useStore(selectBudgetItems);
const transactions = useStore(selectTransactions);
const bucketNotes  = useStore(selectBucketNotes);
const baseCurrency = useStore(selectBaseCurrency);
const rates        = useStore(selectRates);
const addGoal          = useStore((s) => s.addGoal);
const removeGoal       = useStore((s) => s.removeGoal);
const claimGoal        = useStore((s) => s.claimGoal);
const updateGoal       = useStore((s) => s.updateGoal);
const reorderGoals     = useStore((s) => s.reorderGoals);
const addBudgetItem    = useStore((s) => s.addBudgetItem);
const removeBudgetItem = useStore((s) => s.removeBudgetItem);
const confirmBudgetItem = useStore((s) => s.confirmBudgetItem);
const setBucketNote    = useStore((s) => s.setBucketNote);
useEffect(() => {
if (bucket) setTab(initialTab || 'goals');
}, [bucket?.key, initialTab]);
const [addingGoal, setAddingGoal] = useState(false);
const [claiming, setClaiming] = useState(null);
const [planName, setPlanName] = useState('');
const [planAmount, setPlanAmount] = useState('');
const [planCurrency, setPlanCurrency] = useState(baseCurrency);
const [planFreq, setPlanFreq] = useState('weekly');
const [planType, setPlanType] = useState('expense');
const computedGoals = useMemo(() => {
if (!bucket) return [];
return computeGoalsForBucket(goals, bucket.key, Math.max(0, bucket.balance), baseCurrency, rates);
}, [bucket, goals, baseCurrency, rates]);
const claimedGoals = useMemo(() => {
if (!bucket) return [];
return goals
.filter((g) => g.bucketKey === bucket.key && g.status === 'claimed')
.sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt));
}, [bucket, goals]);
const bucketPlannedItems = useMemo(() => {
if (!bucket) return [];
return (budgetItems || []).filter((b) => b.bucketKey === bucket.key && b.status === 'expected');
}, [bucket, budgetItems]);
const bucketHistoryTxs = useMemo(() => {
if (!bucket) return [];
return (transactions || [])
.filter((t) => t && t.buckets && t.buckets[bucket.key] !== undefined && Number(t.buckets[bucket.key]) !== 0)
.slice(0, 25);
}, [bucket, transactions]);
if (!bucket) return null;
const Icon = ICON_MAP[bucket.icon] || Wallet;
const activeComputed = computedGoals.filter((g) => g.status === 'active');
const moveGoal = (goalId, direction) => {
const active = [...activeComputed].sort((a, b) => a.priority - b.priority);
const idx = active.findIndex((g) => g.id === goalId);
if (idx < 0) return;
const newIdx = direction === 'up' ? idx - 1 : idx + 1;
if (newIdx < 0 || newIdx >= active.length) return;
const reordered = [...active];
[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
reorderGoals(bucket.key, reordered.map((g) => g.id));
};
const submitPlannedItem = (e) => {
e.preventDefault();
const v = parseFloat(planAmount);
if (!planName.trim() || !v || v <= 0) return;
addBudgetItem({
bucketKey: bucket.key,
type: planType,
name: planName.trim(),
amount: v,
currency: planCurrency,
frequency: planFreq,
});
setPlanName('');
setPlanAmount('');
};
return (
<AnimatePresence>
<motion.div
initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
transition={{ duration: 0.2 }}
onClick={onClose}
className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
/>
<motion.div
initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
transition={{ type: 'spring', damping: 32, stiffness: 320 }}
className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
      >
<div className="flex justify-center pt-3 pb-1">
<div className="w-10 h-1 rounded-full bg-[var(--border)]" />
</div>
<div className="px-5 pt-2 pb-8 max-w-2xl mx-auto">
{/* Header */}
<div className="flex items-center gap-3 mb-4">
            <div
className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
            >
<Icon size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
<div className="flex items-center gap-2">
<h2 className="font-display text-2xl truncate">{bucket.name}</h2>
<span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg)] num font-semibold">
{bucket.percentage}%
</span>
</div>
<div className="text-xs text-muted num mt-0.5">
Balance: <strong className="text-[var(--text)]">{formatMoney(bucket.balance, baseCurrency)}</strong>
{' · '}
Safe Free: <strong className="text-accent-income">{formatMoney(bucket.safeToSpend, baseCurrency)}</strong>
</div>
</div>
<button
type="button"
onClick={onClose}
className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center"
>
<X size={16} />
</button>
</div>
{/* 4-Tab Bar */}
<div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[var(--bg)] mb-5">
{[
{ id: 'goals',   label: `Goals (${activeComputed.length})`, icon: Target },
{ id: 'planned', label: `Plan (${bucketPlannedItems.length})`, icon: Calendar },
{ id: 'notes',   label: 'Strategy', icon: FileText },
{ id: 'history', label: 'History',  icon: Clock },
].map((t) => {
const TabIcon = t.icon;
const active = tab === t.id;
return (
<button
key={t.id}
type="button"
onClick={() => setTab(t.id)}
className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
active ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-muted'
}`}
>
<TabIcon size={12} />
<span className="truncate">{t.label}</span>
</button>
);
})}
</div>
{/* TAB 1: GOALS TO BUY WITHIN THIS BUCKET */}
{tab === 'goals' && (
<div className="space-y-4">
<p className="text-xs text-muted">
Set specific things you want to buy or fund with your <strong>{bucket.name}</strong> money. Income allocated to this bucket automatically fills these goals in priority order.
</p>
{activeComputed.length > 0 && (
<div className="space-y-2.5">
{activeComputed.map((goal, i) => (
<GoalRow
key={goal.id}
goal={goal}
dailyInflow={bucket.dailyInflow}
isFirst={i === 0}
isLast={i === activeComputed.length - 1}
bucketColor={bucket.color}
baseCurrency={baseCurrency}
onClaim={() => setClaiming(goal)}
onRemove={() => removeGoal(goal.id)}
onMoveUp={() => moveGoal(goal.id, 'up')}
onMoveDown={() => moveGoal(goal.id, 'down')}
onToggleParallel={() => updateGoal(goal.id, { parallel: !goal.parallel })}
/>
))}
</div>
)}
{!addingGoal ? (
<button
type="button"
onClick={() => setAddingGoal(true)}
className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium"
>
<Plus size={15} /> Add a goal to {bucket.name}
</button>
) : (
<NewGoalForm
bucketKey={bucket.key}
defaultCurrency={baseCurrency}
onSave={(data) => { addGoal(data); setAddingGoal(false); }}
onCancel={() => setAddingGoal(false)}
/>
)}
{claimedGoals.length > 0 && (
<div className="pt-4 border-t border-[var(--border)]">
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2">
Claimed & Purchased · {claimedGoals.length}
</div>
<div className="space-y-1.5">
{claimedGoals.slice(0, 6).map((g) => (
<ClaimedGoalRow key={g.id} goal={g} onRemove={() => removeGoal(g.id)} />
))}
                  </div>
                </div>
)}
</div>
)}
{/* TAB 2: PLANNED RECURRING / EXPECTED EXPENSES IN THIS BUCKET */}
{tab === 'planned' && (
<div className="space-y-4">
<div className="bg-[var(--bg)] rounded-2xl p-3.5 grid grid-cols-2 gap-3 text-xs">
<div>
<div className="text-[10px] uppercase text-muted font-semibold">Planned Weekly Burn</div>
<div className="font-display text-xl num mt-0.5">{formatMoney(bucket.plannedWeeklyOutflow, baseCurrency)}</div>
</div>
<div>
<div className="text-[10px] uppercase text-muted font-semibold">Planned Monthly Burn</div>
<div className="font-display text-xl num mt-0.5">{formatMoney(bucket.plannedMonthlyOutflow, baseCurrency)}</div>
                </div>
              </div>

<form onSubmit={submitPlannedItem} className="surface border rounded-2xl p-4 space-y-3">
<div className="text-xs font-semibold">Budget an expected expense or inflow for {bucket.name}</div>
<div className="grid grid-cols-2 gap-2">
<select
value={planType}
onChange={(e) => setPlanType(e.target.value)}
className="px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs font-medium"
>
<option value="expense">Planned Expense</option>
<option value="income">Expected Income</option>
</select>
<select
value={planFreq}
onChange={(e) => setPlanFreq(e.target.value)}
className="px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs font-medium"
>
<option value="daily">Daily</option>
<option value="weekly">Weekly</option>
<option value="biweekly">Biweekly</option>
<option value="monthly">Monthly</option>
<option value="once">One-Time Planned</option>
</select>
</div>
<input
type="text"
value={planName}
onChange={(e) => setPlanName(e.target.value)}
placeholder={`What will you spend ${bucket.name} money on?`}
className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] outline-none text-sm"
/>
<div className="grid grid-cols-[1fr_auto] gap-2">
<input
type="number"
step="0.01"
min="0"
value={planAmount}
onChange={(e) => setPlanAmount(e.target.value)}
placeholder="Amount"
className="px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm num"
/>
<div className="flex gap-1 p-1 rounded-lg bg-[var(--bg)]">
{Object.keys(CURRENCIES).map((c) => (
<button
key={c}
type="button"
onClick={() => setPlanCurrency(c)}
className={`px-2 py-1 rounded text-xs font-medium ${
planCurrency === c ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
}`}
>
{c}
</button>
))}
</div>
</div>
<button
type="submit"
disabled={!planName.trim() || !planAmount || parseFloat(planAmount) <= 0}
className="w-full py-2.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium disabled:opacity-40"
>
Add to {bucket.name} budget
</button>
</form>
{bucketPlannedItems.length === 0 ? (
<div className="text-center py-6 text-xs text-muted">
No planned items in {bucket.name} yet. Add your weekly or monthly expenses above.
</div>
) : (
<div className="space-y-2">
{bucketPlannedItems.map((item) => {
const isInc = item.type === 'income';
const wkEq = computeItemWeeklyEquivalent(item, baseCurrency, rates);
const moEq = computeItemMonthlyEquivalent(item, baseCurrency, rates);
return (
<div key={item.id} className="surface border rounded-xl p-3 flex items-center justify-between gap-2">
<div className="min-w-0 flex-1">
<div className="text-sm font-medium truncate">{item.name}</div>
<div className="text-[11px] text-muted num">
{formatMoney(item.amount, item.currency)} · {item.frequency} (≈ {formatCompact(wkEq, baseCurrency)}/wk · {formatCompact(moEq, baseCurrency)}/mo)
</div>
</div>
<div className="flex items-center gap-1.5 shrink-0">
<button
type="button"
onClick={() => confirmBudgetItem(item.id)}
className="px-2.5 py-1.5 rounded-lg bg-accent-income/15 text-accent-income hover:bg-accent-income hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
>
<Play size={10} /> {isInc ? 'Receive' : 'Spend now'}
</button>
<button
type="button"
onClick={() => removeBudgetItem(item.id)}
className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center"
>
<Trash2 size={13} />
</button>
</div>
</div>
);
})}
</div>
)}
</div>
)}
{/* TAB 3: STRATEGY NOTES & RULES */}
{tab === 'notes' && (
<div className="space-y-3">
<div className="text-xs text-muted">
Write down your personal spending rules, limits, or strategy for <strong>{bucket.name}</strong>:
              </div>
<textarea
rows={5}
value={bucketNotes[bucket.key] || ''}
onChange={(e) => setBucketNote(bucket.key, e.target.value)}
placeholder={`e.g., Only spend ${bucket.name} on high-ROI tools, courses, or scheduled priorities...`}
className="w-full p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--border)] outline-none text-sm leading-relaxed"
/>
</div>
)}

{/* TAB 4: BUCKET TRANSACTION HISTORY */}
{tab === 'history' && (
<div className="space-y-2">
{bucketHistoryTxs.length === 0 ? (
<div className="text-center py-6 text-xs text-muted">
No transactions have touched {bucket.name} yet.
</div>
) : (
bucketHistoryTxs.map((tx) => {
const amt = Number(tx.buckets?.[bucket.key]) || 0;
const isPos = amt > 0;
return (
<div key={tx.id} className="bg-[var(--bg)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
<div className="min-w-0 flex-1">
<div className="font-medium truncate">{tx.notes || tx.category}</div>
<div className="text-[10px] text-muted">{tx.category} · {relativeTime(tx.date)}</div>
</div>
<div className={`font-semibold num ${isPos ? 'text-accent-income' : 'text-accent-expense'}`}>
{isPos ? '+' : '−'}{formatMoney(Math.abs(amt), tx.currency || 'USD')}
</div>
</div>
);
})
)}
            </div>
)}
</div>
</motion.div>

<ClaimDialog
goal={claiming}
baseCurrency={baseCurrency}
rates={rates}
onCancel={() => setClaiming(null)}
onConfirm={(actualAmount) => { claimGoal(claiming.id, { actualAmount }); setClaiming(null); }}
/>
</AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════════
// BUCKET TRANSFER SHEET
// ════════════════════════════════════════════════════════════════════
function BucketTransferSheet({ open, buckets, balances, baseCurrency, onClose }) {
  const transfer = useStore((s) => s.transferBetweenBuckets);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);

  const reset = () => { setFrom(''); setTo(''); setAmount(''); setCurrency(baseCurrency); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!from || !to || from === to || !v || v <= 0) return;
    transfer({ fromKey: from, toKey: to, amount: v, currency, notes: '' });
    reset();
    onClose();
  };


  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
<div className="px-5 pt-2 pb-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl">Transfer between buckets</h2>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <BucketSelect label="From" value={from} onChange={setFrom} buckets={buckets} balances={balances} baseCurrency={baseCurrency} />
                <div className="flex justify-center">
                  <ArrowLeftRight size={18} className="text-muted rotate-90" />
                </div>
                <BucketSelect label="To" value={to} onChange={setTo} buckets={buckets} balances={balances} baseCurrency={baseCurrency} excludeKey={from} />

                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                  {Object.values(CURRENCIES).map((c) => (
                    <button
                      key={c.code} type="button" onClick={() => setCurrency(c.code)}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        currency === c.code ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-muted'
                      }`}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>

                <div className="bg-[var(--bg)] rounded-2xl px-5 py-5 text-center">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Amount</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-2xl text-muted">{CURRENCIES[currency].prefix}</span>
                    <input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full max-w-[160px] bg-transparent outline-none font-display text-4xl text-center num"
                    />
                    {CURRENCIES[currency].suffix && (
                      <span className="font-display text-2xl text-muted">{CURRENCIES[currency].suffix}</span>
                    )}
                  </div>
                </div>

                <button type="submit"
                  disabled={!from || !to || from === to || !amount || parseFloat(amount) <= 0}
                  className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40 active:scale-[0.99] transition-transform"
                >
                  Transfer
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BucketSelect({ label, value, onChange, buckets, balances, baseCurrency, excludeKey }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 px-1">{label}</div>
      <div className="grid grid-cols-1 gap-1.5">
        {buckets
          .filter((b) => b.key !== excludeKey)
          .map((b) => {
            const Icon = ICON_MAP[b.icon] || Wallet;
            const selected = value === b.key;
            return (
              <button
                key={b.key} type="button" onClick={() => onChange(b.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  selected
                    ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                    : 'bg-[var(--bg)] border-transparent hover:border-[var(--border)]'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={selected ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'currentColor' } : { backgroundColor: `${b.color}1f`, color: b.color }}
                >
                  <Icon size={15} />
                </div>
                <span className="text-sm font-medium flex-1 text-left">{b.name}</span>
                <span className={`text-xs num ${selected ? '' : 'text-muted'}`}>
{formatMoney(balances[b.key] ?? b.balance ?? 0, baseCurrency)}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function GoalRow({ goal, dailyInflow, isFirst, isLast, bucketColor, baseCurrency, onClaim, onRemove, onMoveUp, onMoveDown, onToggleParallel }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const progress = Math.min(1, goal.progress);
const remainingToFill = Math.max(0, (goal.targetBase || 0) - (goal.filledBase || 0));
const etaDays = remainingToFill <= 0 ? 0 : (dailyInflow > 0 ? Math.ceil(remainingToFill / dailyInflow) : null);
const coolingOffActive = goal.coolingOffUntil && new Date(goal.coolingOffUntil) > new Date();

  return (
    <motion.div
      layout
      className="surface border rounded-xl p-3"
      style={{ borderColor: goal.ready ? bucketColor : undefined }}
    >
      <div className="flex items-center gap-3">
<div className="relative shrink-0" style={{ width: 52, height: 52 }}>
          <svg viewBox="0 0 56 56" className="-rotate-90 absolute inset-0">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="3.5" />
            <motion.circle
              cx="28" cy="28" r="24" fill="none"
              stroke={bucketColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - progress) }}
              transition={{ duration: 0.8, ease }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {goal.ready ? (
<span className="text-[16px]">✦</span>
            ) : (
              <span className="text-[10px] num font-medium">{Math.round(progress * 100)}%</span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
<div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted font-medium">#{goal.priority}</span>
            <span className="text-sm font-medium truncate">{goal.name}</span>
            {goal.parallel && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg)] text-muted">
                parallel
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted num mt-0.5">
            {formatMoney(goal.filledBase, baseCurrency)} / {formatMoney(goal.targetBase, baseCurrency)}
{etaDays !== null && etaDays > 0 && <span> · ETA ≈ {etaDays}d</span>}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp} disabled={isFirst}
            className="w-6 h-5 rounded hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-20"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={onMoveDown} disabled={isLast}
            className="w-6 h-5 rounded hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-20"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!confirmingDelete ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 mt-3"
          >
            <button
onClick={onClaim}
disabled={!goal.ready || coolingOffActive}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{
backgroundColor: goal.ready && !coolingOffActive ? bucketColor : 'var(--bg)',
color: goal.ready && !coolingOffActive ? '#fff' : 'inherit',
              }}
            >
{coolingOffActive
? 'Cooling-off active'
: goal.ready
? '✦ Claim / Buy'
: 'Funding in progress'}
            </button>
            <button
              onClick={onToggleParallel}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] text-xs hover:bg-[var(--border)] transition-colors"

            >
              {goal.parallel ? 'Sequential' : 'Parallel'}
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-9 h-9 rounded-lg hover:bg-accent-expense/10 hover:text-accent-expense transition-colors flex items-center justify-center"
            >
              <Trash2 size={13} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-3 grid grid-cols-2 gap-2"
          >
            <button
              onClick={() => setConfirmingDelete(false)}
              className="py-2 rounded-lg bg-[var(--bg)] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onRemove}
              className="py-2 rounded-lg bg-accent-expense text-white text-xs font-medium"
            >
              Delete goal
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewGoalForm({ bucketKey, defaultCurrency = 'HTG', onSave, onCancel }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
const [currency, setCurrency] = useState(defaultCurrency);
  const [parallel, setParallel] = useState(false);
const [coolingOffDays, setCoolingOffDays] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
onSave({ bucketKey, name: name.trim(), target: t, currency, parallel, coolingOffDays });
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="overflow-hidden"
    >
      <div className="space-y-3 surface border rounded-xl p-4">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
placeholder="What do you want to buy or fund in this bucket?"
          autoFocus
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-[var(--border)]"
        />

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[var(--bg)]">
          {Object.values(CURRENCIES).map((c) => (
            <button
              key={c.code} type="button" onClick={() => setCurrency(c.code)}
              className={`py-1.5 rounded-md text-xs font-medium transition-all ${
                currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
              }`}
            >
              {c.code}
            </button>
          ))}
        </div>

        <div className="flex items-baseline gap-1 px-3 py-2.5 rounded-lg bg-[var(--bg)]">
          <span className="text-muted text-sm">{CURRENCIES[currency].prefix}</span>
          <input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={target} onChange={(e) => setTarget(e.target.value)}
            placeholder="Target amount"
            className="flex-1 bg-transparent outline-none text-sm num"
          />
          {CURRENCIES[currency].suffix && (
            <span className="text-muted text-sm">{CURRENCIES[currency].suffix}</span>
          )}
        </div>

<div className="flex items-center justify-between gap-2 text-xs text-muted">
<label className="flex items-center gap-2 cursor-pointer select-none">
<input
type="checkbox" checked={parallel} onChange={(e) => setParallel(e.target.checked)}
className="rounded"
/>
Fill in parallel
</label>
<select
value={coolingOffDays}
onChange={(e) => setCoolingOffDays(Number(e.target.value))}
className="px-2 py-1 rounded bg-[var(--bg)] text-[11px] outline-none"
>
<option value={0}>No impulse lock</option>
<option value={1}>24h cooling-off</option>
<option value={7}>7d cooling-off</option>
</select>
</div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button" onClick={onCancel}
            className="py-2.5 rounded-lg bg-[var(--bg)] text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={!name.trim() || !target || parseFloat(target) <= 0}
            className="py-2.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40"
          >
Save goal
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function ClaimDialog({ goal, onCancel, onConfirm }) {
  const [actual, setActual] = useState('');

  if (!goal) return null;

  const target = goal.target;
  const final = actual ? parseFloat(actual) : target;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm surface border rounded-2xl p-5"
        >
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">✦</div>
            <h3 className="font-display text-2xl">Claim {goal.name}</h3>
            <p className="text-[12px] text-muted mt-1">
Logs this purchase from the bucket and marks the goal completed.
            </p>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Target</span>
              <span className="num">{formatMoney(target, goal.currency)}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Actual amount paid</div>
              <div className="flex items-baseline gap-1 px-3 py-2.5 rounded-lg bg-[var(--bg)]">
                <span className="text-muted text-sm">{CURRENCIES[goal.currency].prefix}</span>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0"
                  value={actual} onChange={(e) => setActual(e.target.value)}
                  placeholder={String(target)}
                  className="flex-1 bg-transparent outline-none num"
                />
                {CURRENCIES[goal.currency].suffix && (
                  <span className="text-muted text-sm">{CURRENCIES[goal.currency].suffix}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
<button onClick={onCancel} className="py-3 rounded-xl bg-[var(--bg)] text-sm font-medium">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(final)}
className="py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium"
            >
              ✦ Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


function ClaimedGoalRow({ goal, onRemove }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <motion.div layout className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] text-sm">
      <div className="w-7 h-7 rounded-lg bg-accent-income/10 text-accent-income flex items-center justify-center shrink-0">
        <Check size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{goal.name}</div>
        <div className="text-[10px] text-muted">
          {new Date(goal.claimedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {!confirming ? (
        <>
          <div className="text-[11px] num text-muted">
            {formatMoney(goal.claimedAmount, goal.currency)}
          </div>
          <button
            onClick={() => setConfirming(true)}
className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 hover:text-accent-expense flex items-center justify-center shrink-0"
          >
            <Trash2 size={12} />
          </button>
        </>
      ) : (
        <div className="flex gap-1.5 shrink-0">
<button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-md bg-[var(--surface)] text-[10px] font-medium">
            Cancel
          </button>
<button onClick={onRemove} className="px-2 py-1 rounded-md bg-accent-expense text-white text-[10px] font-medium">
            Delete
          </button>
        </div>
      )}
    </motion.div>
  );
}
