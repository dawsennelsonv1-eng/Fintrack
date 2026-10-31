
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
Cell, PieChart, Pie, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
Flame, TrendingUp, Wallet, Shield, Sparkles, Heart, AlertTriangle,
Target, Calendar, Plus, ArrowRight, BarChart3, PieChart as PieIcon,
Activity, CheckCircle2, Zap,
} from 'lucide-react';
import {
  useStore,
selectTransactions, selectBuckets, selectGoals, selectBudgetItems,
selectDebts, selectDebtEvents, selectBaseCurrency, selectRates,
selectIsDangerMode, selectDangerModeOverride, selectTotalDebtInBase,
computeBucketBudgetSummary, computeDebtPayoffPlan,
} from '../store/useStore';
import { formatMoney, formatCompact } from '../lib/currency';
import { ease } from '../lib/util';

const ICON_MAP = {
Flame,
TrendingUp,
Wallet,
Shield,
Sparkles,
Heart,
};
const CHART_MODES = [
{ id: 'left',   label: 'Money Left',  icon: BarChart3 },
{ id: 'burn',   label: 'Plan vs Burn', icon: Activity },
{ id: 'split',  label: 'Split %',     icon: PieIcon },
{ id: 'payoff', label: 'Debt Runway', icon: Flame },
];
export default function BucketBars({ onSelectBucket, showCards = true }) {
  const transactions = useStore(selectTransactions);
  const buckets      = useStore(selectBuckets);
const goals        = useStore(selectGoals);
const budgetItems  = useStore(selectBudgetItems);
const debts        = useStore(selectDebts);
const debtEvents   = useStore(selectDebtEvents);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);
const isDangerMode = useStore(selectIsDangerMode);
const modeOverride = useStore(selectDangerModeOverride);
const totalDebt    = useStore(selectTotalDebtInBase);
const setDangerModeOverride = useStore((s) => s.setDangerModeOverride);
const setActiveTab = useStore((s) => s.setActiveTab);

const [chartMode, setChartMode] = useState('left');

const summary = useMemo(
() => computeBucketBudgetSummary(buckets, transactions, goals, budgetItems, baseCurrency, rates),
[buckets, transactions, goals, budgetItems, baseCurrency, rates]
);

const payoffPlan = useMemo(
() => computeDebtPayoffPlan(debts, debtEvents, transactions, budgetItems, baseCurrency, rates, 'avalanche'),
[debts, debtEvents, transactions, budgetItems, baseCurrency, rates]
);
const totals = useMemo(() => {
let totalBalance = 0;
let totalSafe = 0;
let totalCommittedGoals = 0;
let totalPlannedMonthly = 0;
for (const b of summary) {
if (b.balance > 0) totalBalance += b.balance;
totalSafe += b.safeToSpend;
totalCommittedGoals += b.goalsFilled;
totalPlannedMonthly += b.plannedMonthlyOutflow;
}
return { totalBalance, totalSafe, totalCommittedGoals, totalPlannedMonthly };
}, [summary]);
const barData = useMemo(() => {
return summary.map((b) => {
const shortName =
b.key === 'debtRepayment' ? 'Debt 40%' :
b.key === 'warChest'      ? (isDangerMode ? 'Invest 25%' : 'Invest 50%') :
b.key === 'operations'    ? (isDangerMode ? 'Ops 20%' : 'Ops 30%') :
b.key === 'reserve'       ? 'Reserve 10%' :
b.key === 'baller'        ? 'Fun 5%' :
`${b.name.split(' ')[0]} ${b.percentage}%`;
return {
key: b.key,
name: b.name,
shortName,
pct: b.percentage,
color: b.color,
balance: Math.round(b.balance * 100) / 100,
positiveBalance: Math.round(b.positiveBalance * 100) / 100,
safeToSpend: Math.round(b.safeToSpend * 100) / 100,
committed: Math.round((b.goalsFilled + b.plannedWeeklyOutflow) * 100) / 100,
goalsTarget: Math.round(b.goalsTotalTarget * 100) / 100,
plannedMonthly: Math.round(b.plannedMonthlyOutflow * 100) / 100,
targetAllowance: Math.round(b.targetMonthlyAllowance * 100) / 100,
spent30d: Math.round(b.outflow30d * 100) / 100,
};
});
}, [summary, isDangerMode]);
const payoffSeries = useMemo(() => {
const startDebt = Math.max(0, totalDebt);
const weeklyPay = Math.max(payoffPlan.weeklyDebtPower, startDebt > 0 ? startDebt / 16 : 0);
const pts = [];
for (let w = 0; w <= 12; w++) {
const rem = Math.max(0, startDebt - weeklyPay * w);
pts.push({
week: w === 0 ? 'Now' : `W${w}`,
remaining: Math.round(rem),
paidCumulative: Math.round(startDebt - rem),
});
if (rem === 0 && w >= 2) break;
}
return pts;
}, [totalDebt, payoffPlan.weeklyDebtPower]);
if (summary.length === 0) return null;
const handleBucketClick = (bucket) => {
if (onSelectBucket) {
onSelectBucket(bucket);
} else {
setActiveTab('budgets');
}
};

  return (
<div className="space-y-4">
{/* ─── DANGER MODE / PROTOCOL HERO CARD ─────────────────── */}
<div
className="surface border rounded-3xl p-5 overflow-hidden relative transition-colors"
style={
isDangerMode
? {
background: 'linear-gradient(145deg, rgba(194,69,47,0.14) 0%, rgba(212,169,66,0.08) 60%, rgba(22,21,19,0.02) 100%)',
borderColor: 'rgba(194,69,47,0.38)',
}
: {
background: 'linear-gradient(145deg, rgba(61,139,95,0.14) 0%, rgba(212,169,66,0.08) 100%)',
borderColor: 'rgba(61,139,95,0.3)',
}
}
>
{/* Top status row */}
<div className="flex items-center justify-between gap-2 flex-wrap mb-3">
<div className="flex items-center gap-2">
<div
className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
isDangerMode
? 'bg-accent-expense/20 text-accent-expense'
: 'bg-accent-income/20 text-accent-income'
}`}
>
{isDangerMode ? <Flame size={16} strokeWidth={2.25} /> : <CheckCircle2 size={16} strokeWidth={2.25} />}
</div>
<div>
<div className="flex items-center gap-2">
<span className="text-[10px] uppercase tracking-[0.16em] font-bold text-accent-expense">
{isDangerMode ? 'Danger Mode · Active' : 'Normal Mode · Debt-Free'}
</span>
<span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--bg)]/80 text-muted num">
{isDangerMode ? '40 / 25 / 20 / 10 / 5' : '50 / 30 / 10 / 5 / 5'}
</span>
</div>
<div className="text-[11px] text-muted mt-0.5">
{isDangerMode
? 'In-debt protocol: 40% Debt Repayment · 25% Investment · 20% Ops · 10% Reserve · 5% Fun'
: 'Standard protocol: 50% Investment · 30% Ops · 10% Reserve · 5% Giving · 5% Fun'}
</div>
</div>
</div>
{/* Mode override selector pill */}
<div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg)]/90 border border-[var(--border)] text-[10px]">
{[
{ id: 'auto',   label: 'Auto' },
{ id: 'danger', label: 'Danger' },
{ id: 'normal', label: 'Normal' },
].map((m) => (
<button
key={m.id}
type="button"
onClick={() => setDangerModeOverride(m.id)}
className={`px-2 py-1 rounded-lg font-medium transition-all ${
modeOverride === m.id
? isDangerMode && m.id !== 'normal'
? 'bg-accent-expense text-white shadow-sm'
: 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 shadow-sm'
: 'text-muted hover:text-[var(--text)]'
}`}
>
{m.label}
</button>
))}
</div>
        </div>
{/* Top KPI Trio: Money in Buckets | Safe to Spend (Uncommitted) | Planned / Debt Target */}
<div className="grid grid-cols-3 gap-2.5 my-4">
<div className="bg-[var(--bg)]/80 backdrop-blur-sm border border-[var(--border)]/60 rounded-2xl p-3">
<div className="text-[9px] uppercase tracking-[0.12em] text-muted font-semibold">
In Buckets
</div>
<div className="font-display text-xl sm:text-2xl num mt-0.5 truncate">
{formatCompact(totals.totalBalance, baseCurrency)}
</div>
<div className="text-[10px] text-muted truncate">Positive pocket cash</div>
</div>
<div className="bg-[var(--bg)]/80 backdrop-blur-sm border border-[var(--border)]/60 rounded-2xl p-3">
<div className="text-[9px] uppercase tracking-[0.12em] text-muted font-semibold">
Safe to Spend
</div>
<div className="font-display text-xl sm:text-2xl num mt-0.5 text-accent-income truncate">
{formatCompact(totals.totalSafe, baseCurrency)}
</div>
<div className="text-[10px] text-muted truncate">After goals & weekly bills</div>
</div>
<div className="bg-[var(--bg)]/80 backdrop-blur-sm border border-[var(--border)]/60 rounded-2xl p-3">
<div className="text-[9px] uppercase tracking-[0.12em] text-muted font-semibold">
{isDangerMode && totalDebt > 0 ? 'Owed Debt' : 'Planned / Mo'}
</div>
<div
className={`font-display text-xl sm:text-2xl num mt-0.5 truncate ${
isDangerMode && totalDebt > 0 ? 'text-accent-expense' : ''
}`}
>
{isDangerMode && totalDebt > 0
? formatCompact(totalDebt, baseCurrency)
: formatCompact(totals.totalPlannedMonthly, baseCurrency)}
</div>
<div className="text-[10px] text-muted truncate">
{isDangerMode && totalDebt > 0
? payoffPlan.estimatedWeeksToDebtFree
? `≈ ${payoffPlan.estimatedWeeksToDebtFree} wks at 40%`
: '40% repayment active'
: 'Budgeted monthly outflow'}
</div>
</div>
</div>
{/* 5-Bucket Proportional Allocation Bar */}
<div className="mb-4">
<div className="flex items-center justify-between text-[10px] text-muted mb-1.5">
<span className="uppercase tracking-[0.12em] font-semibold">
Active 5-Bucket Split ({isDangerMode ? 'Danger Mode' : 'Normal Mode'})
</span>
<span className="num">100% of every inflow</span>
</div>
<div className="h-3 rounded-full bg-[var(--bg)] overflow-hidden flex p-0.5 gap-0.5 border border-[var(--border)]/60">
{summary.map((b) => (
<div
key={b.key}
style={{ width: `${b.percentage}%`, backgroundColor: b.color }}
className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
title={`${b.name}: ${b.percentage}%`}
/>
))}
</div>
<div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 mt-2">
{summary.map((b) => (
<div key={b.key} className="flex items-center gap-1.5 text-[10px]">
<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
<span className="font-medium truncate">{b.name.replace(' (War Chest)', '')}</span>
<span className="num text-muted font-semibold">{b.percentage}%</span>
</div>
))}
</div>
</div>
{/* ─── CHART MODE SWITCHER ────────────────────────────── */}
<div className="flex items-center justify-between gap-2 mb-3 pt-2 border-t border-[var(--border)]/60">
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Bucket Analytics Graph
</div>
<div className="flex items-center gap-1 bg-[var(--bg)]/90 p-1 rounded-xl border border-[var(--border)]">
{CHART_MODES.map((m) => {
const Icon = m.icon;
const active = chartMode === m.id;
return (
<button
key={m.id}
type="button"
onClick={() => setChartMode(m.id)}
className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
active
? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
: 'text-muted hover:text-[var(--text)]'
}`}
>
<Icon size={11} />
<span className="hidden sm:inline">{m.label}</span>
<span className="sm:hidden">{m.label.split(' ')[0]}</span>
</button>
);
})}
</div>
</div>
{/* ─── BIG INTERACTIVE GRAPH AREA ─────────────────────── */}
<div className="bg-[var(--bg)]/85 border border-[var(--border)]/70 rounded-2xl p-3.5">
{chartMode === 'left' && (
<div>
<div className="flex items-center justify-between text-[11px] mb-2">
<span className="font-medium">Money in Bucket vs. Safe-to-Spend</span>
<div className="flex items-center gap-3 text-[10px] text-muted">
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#3d8b5f]" /> Balance
</span>
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#d4a942]" /> Committed (Goals/Bills)
</span>
</div>
</div>
<div className="h-60 -mx-2">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={barData} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
<CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
<XAxis
dataKey="shortName"
tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
axisLine={false}
tickLine={false}
/>
<YAxis
tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
axisLine={false}
tickLine={false}
tickFormatter={(v) => formatCompact(v, baseCurrency)}
width={52}
/>
<ReferenceLine y={0} stroke="var(--border)" />
<Tooltip content={<BucketChartTooltip currency={baseCurrency} mode="left" />} />
<Bar dataKey="balance" name="Balance" radius={[6, 6, 0, 0]} maxBarSize={36}>
{barData.map((entry) => (
<Cell
key={entry.key}
fill={entry.balance < 0 ? '#c2452f' : entry.color}
/>
))}
</Bar>
<Bar dataKey="committed" name="Committed (Goals + Weekly Bills)" fill="#d4a942" fillOpacity={0.55} radius={[6, 6, 0, 0]} maxBarSize={24} />
</BarChart>
</ResponsiveContainer>
</div>
</div>
)}
{chartMode === 'burn' && (
<div>
<div className="flex items-center justify-between text-[11px] mb-2">
<span className="font-medium">Monthly Target vs. Planned Bills vs. 30d Spend</span>
<div className="flex items-center gap-2.5 text-[10px] text-muted">
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#3d8b5f]" /> Target
</span>
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#5b8def]" /> Planned
</span>
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#c2452f]" /> 30d Spend
</span>
</div>
</div>
<div className="h-60 -mx-2">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={barData} margin={{ top: 8, right: 10, bottom: 4, left: -12 }}>
<CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
<XAxis
dataKey="shortName"
tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
axisLine={false}
tickLine={false}
/>
<YAxis
tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
axisLine={false}
tickLine={false}
tickFormatter={(v) => formatCompact(v, baseCurrency)}
width={52}
/>
<Tooltip content={<BucketChartTooltip currency={baseCurrency} mode="burn" />} />
<Bar dataKey="targetAllowance" name="Target Monthly Inflow" fill="#3d8b5f" radius={[5, 5, 0, 0]} maxBarSize={22} />
<Bar dataKey="plannedMonthly" name="Planned Monthly Bills" fill="#5b8def" radius={[5, 5, 0, 0]} maxBarSize={22} />
<Bar dataKey="spent30d" name="Actual 30d Spend" fill="#c2452f" radius={[5, 5, 0, 0]} maxBarSize={22} />
</BarChart>
</ResponsiveContainer>
</div>
</div>
)}
{chartMode === 'split' && (
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center py-1">
<div className="h-52">
<ResponsiveContainer width="100%" height="100%">
<PieChart>
<Pie
data={barData}
dataKey="pct"
nameKey="name"
cx="50%"
cy="50%"
innerRadius={48}
outerRadius={78}
paddingAngle={3}
stroke="none"
>
{barData.map((b) => (
<Cell key={b.key} fill={b.color} />
))}
</Pie>
<Tooltip content={<BucketChartTooltip currency={baseCurrency} mode="split" />} />
</PieChart>
</ResponsiveContainer>
</div>
<div className="space-y-2">
{summary.map((b) => (
<div key={b.key} className="flex items-center justify-between text-xs bg-[var(--surface)] px-3 py-2 rounded-xl border border-[var(--border)]">
<div className="flex items-center gap-2 min-w-0">
<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
<span className="font-medium truncate">{b.name}</span>
</div>
<div className="text-right num shrink-0">
<span className="font-semibold">{b.percentage}%</span>
<span className="text-muted text-[11px] ml-2">({formatCompact(b.balance, baseCurrency)})</span>
</div>
</div>
))}
</div>
</div>
)}
{chartMode === 'payoff' && (
<div>
<div className="flex items-center justify-between text-[11px] mb-2">
<span className="font-medium">
40% Debt Repayment Trajectory ({formatCompact(payoffPlan.weeklyDebtPower, baseCurrency)}/wk power)
</span>
<span className="text-[10px] text-accent-expense font-semibold num">
{totalDebt > 0
? `${formatMoney(totalDebt, baseCurrency)} total debt`
: '0 debt remaining!'}
</span>
</div>
<div className="h-56 -mx-2">
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={payoffSeries} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
<defs>
<linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#c2452f" stopOpacity={0.45} />
<stop offset="100%" stopColor="#c2452f" stopOpacity={0.02} />
</linearGradient>
</defs>
<CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
<XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
<YAxis
tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
axisLine={false}
tickLine={false}
tickFormatter={(v) => formatCompact(v, baseCurrency)}
width={52}
/>
<Tooltip content={<BucketChartTooltip currency={baseCurrency} mode="payoff" />} />
<Area
type="monotone"
dataKey="remaining"
name="Remaining Debt"
stroke="#c2452f"
strokeWidth={2.25}
fill="url(#debtGrad)"
/>
</AreaChart>
</ResponsiveContainer>
</div>
</div>
)}
</div>
      </div>

{/* ─── PER-BUCKET INTERACTIVE CARDS ────────────────────── */}
{showCards && (
<div className="space-y-3">
<div className="flex items-baseline justify-between px-1">
<div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Pocket Breakdown
</div>
<h2 className="font-display text-2xl">How each bucket is budgeted</h2>
</div>
<button
type="button"
onClick={() => setActiveTab('budgets')}
className="text-xs text-muted hover:text-[var(--text)] flex items-center gap-1 transition-colors"
>
Manage plans <ArrowRight size={12} />
</button>
</div>

{summary.map((bucket, idx) => (
<BucketInteractiveRow
key={bucket.key}
bucket={bucket}
idx={idx}
baseCurrency={baseCurrency}
onSelect={() => handleBucketClick(bucket)}
/>
))}
</div>
)}
    </div>
  );
}
function BucketInteractiveRow({ bucket, idx, baseCurrency, onSelect }) {
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
const isNegative = bucket.balance < 0;
return (
<motion.div
initial={{ opacity: 0, y: 6 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: idx * 0.04, duration: 0.35, ease }}
className="surface border rounded-2xl p-4 hover:border-[var(--text)]/20 transition-all"
style={
bucket.key === 'debtRepayment'
? { borderLeftWidth: 3, borderLeftColor: '#c2452f' }
: { borderLeftWidth: 3, borderLeftColor: bucket.color }
}
>
<div className="flex items-start gap-3">
<button
type="button"
onClick={onSelect}
className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
>
<Icon size={18} strokeWidth={2.2} />
</button>
<div className="flex-1 min-w-0">
<div className="flex items-baseline justify-between gap-2">
<button type="button" onClick={onSelect} className="text-left min-w-0 flex-1">
<div className="flex items-center gap-1.5 flex-wrap">
<span className="font-medium text-sm truncate">{bucket.name}</span>
<span
className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold num"
style={{ backgroundColor: `${bucket.color}18`, color: bucket.color }}
>
{bucket.percentage}%
</span>
{isNegative && (
<span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-accent-expense/15 text-accent-expense font-medium">
<AlertTriangle size={10} /> Deficit
</span>
)}
</div>
</button>
<div className="text-right shrink-0">
<div className={`font-display text-xl num leading-none ${isNegative ? 'text-accent-expense' : ''}`}>
{formatMoney(bucket.balance, baseCurrency)}
</div>
<div className="text-[10px] text-muted num mt-0.5">
Safe: <span className="text-accent-income font-medium">{formatCompact(bucket.safeToSpend, baseCurrency)}</span>
</div>
</div>
</div>
{/* 3-Layer Budgeted Money Bar */}
<div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden flex mt-2.5 mb-2 border border-[var(--border)]/50">
{isNegative ? (
<div className="h-full w-full bg-accent-expense/80" />
) : (
<>
{goalPct > 0 && (
<div
style={{ width: `${goalPct}%`, backgroundColor: '#d4a942' }}
className="h-full transition-all duration-500"
title="Committed to Goals"
/>
)}
{plannedPct > 0 && (
<div
style={{ width: `${plannedPct}%`, backgroundColor: '#5b8def' }}
className="h-full transition-all duration-500"
title="Planned Weekly Expenses"
/>
)}
{freePct > 0 && (
<div
style={{ width: `${freePct}%`, backgroundColor: bucket.color }}
className="h-full transition-all duration-500"
title="Free Safe-to-Spend"
/>
)}
</>
)}
</div>
{/* Bottom pills: Goals, Planned Spend, Runway, and Quick Actions */}
<div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-muted num">
<div className="flex items-center gap-2.5 flex-wrap">
<span className="flex items-center gap-1">
<Target size={11} className="text-[#d4a942]" />
{bucket.activeGoals.length > 0
? `${bucket.activeGoals.length} goal${bucket.activeGoals.length > 1 ? 's' : ''} (${formatCompact(bucket.goalsTotalTarget, baseCurrency)})`
: '0 goals'}
</span>
<span className="flex items-center gap-1">
<Calendar size={11} className="text-[#5b8def]" />
{bucket.plannedExpenses.length > 0
? `Planned ${formatCompact(bucket.plannedWeeklyOutflow, baseCurrency)}/wk`
: 'No planned bills'}
</span>
{bucket.runwayDays > 0 && bucket.runwayDays < 365 && (
<span>· {bucket.runwayDays}d runway</span>
)}
</div>
<div className="flex items-center gap-1.5">
<button
type="button"
onClick={() => setQuickSpendBucket(bucket.key)}
className="px-2 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-[var(--text)] font-medium flex items-center gap-1 transition-colors"
>
<Zap size={10} /> Spend
</button>
<button
type="button"
onClick={onSelect}
className="px-2 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-[var(--text)] font-medium flex items-center gap-1 transition-colors"
>
<Plus size={10} /> Budget
</button>
</div>
</div>
</div>
</div>
</motion.div>
);
}
function BucketChartTooltip({ active, payload, label, currency, mode }) {
if (!active || !payload?.length) return null;
const row = payload[0]?.payload;
return (
<div className="surface border rounded-xl px-3 py-2.5 shadow-xl text-xs num space-y-1">
<div className="font-semibold text-[var(--text)]">{row?.name || label}</div>
{mode === 'left' && row && (
<>
<div className="flex justify-between gap-4">
<span className="text-muted">Current Balance</span>
<span className={row.balance < 0 ? 'text-accent-expense font-medium' : 'font-medium'}>
{formatMoney(row.balance, currency)}
</span>
</div>
<div className="flex justify-between gap-4">
<span className="text-muted">Committed (Goals + Wk Bills)</span>
<span className="text-amber-500 font-medium">{formatMoney(row.committed, currency)}</span>
</div>
<div className="flex justify-between gap-4 border-t border-[var(--border)] pt-1">
<span className="text-muted">Safe to Spend Now</span>
<span className="text-accent-income font-semibold">{formatMoney(row.safeToSpend, currency)}</span>
</div>
</>
)}
{mode === 'burn' && row && (
<>
<div className="flex justify-between gap-4">
<span className="text-muted">Target Monthly ({row.pct}%)</span>
<span className="text-accent-income font-medium">{formatMoney(row.targetAllowance, currency)}</span>
</div>
<div className="flex justify-between gap-4">
<span className="text-muted">Planned Monthly Bills</span>
<span className="text-blue-500 font-medium">{formatMoney(row.plannedMonthly, currency)}</span>
</div>
<div className="flex justify-between gap-4">
<span className="text-muted">Actual 30d Spend</span>
<span className="text-accent-expense font-medium">{formatMoney(row.spent30d, currency)}</span>
</div>
</>
)}
{mode === 'split' && row && (
<>
<div className="flex justify-between gap-4">
<span className="text-muted">Target Share</span>
<span className="font-semibold">{row.pct}%</span>
</div>
<div className="flex justify-between gap-4">
<span className="text-muted">Current Balance</span>
<span>{formatMoney(row.balance, currency)}</span>
</div>
</>
)}
{mode === 'payoff' && row && (
<>
<div className="flex justify-between gap-4">
<span className="text-muted">Projected Remaining Debt</span>
<span className="text-accent-expense font-semibold">{formatMoney(row.remaining, currency)}</span>
</div>
<div className="flex justify-between gap-4">
<span className="text-muted">Cumulative Paid</span>
<span className="text-accent-income font-medium">{formatMoney(row.paidCumulative, currency)}</span>
</div>
</>
)}
</div>
);
}
