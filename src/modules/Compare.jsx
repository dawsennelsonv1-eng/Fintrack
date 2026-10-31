
//


import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowDownLeft, ArrowUpRight, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import {
  useStore,
selectTransactions, selectConversions, selectWallets,
selectBaseCurrency, selectRates,
computePeriodLedger,
} from '../store/useStore';
import { formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

function toDateKey(d) {
const dt = new Date(d);
const y = dt.getFullYear();
const m = String(dt.getMonth() + 1).padStart(2, '0');
const day = String(dt.getDate()).padStart(2, '0');
return `${y}-${m}-${day}`;
}

export default function Compare({ embedded = false }) {
  const transactions = useStore(selectTransactions);
const conversions  = useStore(selectConversions);
const wallets      = useStore(selectWallets);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

const [mode, setMode] = useState('week'); // 'week' | 'month'

const { currentLedger, previousLedger, currentLabel, previousLabel, categoryChart } = useMemo(() => {
const now = new Date();
let curStart, curEnd, prevStart, prevEnd, curLbl, prevLbl;

if (mode === 'week') {
const day = now.getDay();
const diffToMon = day === 0 ? -6 : 1 - day;
curStart = new Date(now);
curStart.setDate(now.getDate() + diffToMon);
curEnd = new Date(curStart);
curEnd.setDate(curStart.getDate() + 6);

prevStart = new Date(curStart);
prevStart.setDate(curStart.getDate() - 7);
prevEnd = new Date(curStart);
prevEnd.setDate(curStart.getDate() - 1);

curLbl = 'This Week';
prevLbl = 'Last Week';
} else {
curStart = new Date(now.getFullYear(), now.getMonth(), 1);
curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

curLbl = 'This Month';
prevLbl = 'Last Month';
    }


const cur = computePeriodLedger(
transactions, conversions, wallets, baseCurrency, rates,
toDateKey(curStart), toDateKey(curEnd)
);
const prev = computePeriodLedger(
transactions, conversions, wallets, baseCurrency, rates,
toDateKey(prevStart), toDateKey(prevEnd)
);

const cats = {};
for (const t of cur.spendingTxs) {
const c = t.category || 'Other';
if (!cats[c]) cats[c] = { name: c, current: 0, previous: 0 };
cats[c].current += t.amountBase;
}
for (const t of prev.spendingTxs) {
const c = t.category || 'Other';
if (!cats[c]) cats[c] = { name: c, current: 0, previous: 0 };
cats[c].previous += t.amountBase;
}

const chart = Object.values(cats)
.sort((a, b) => (b.current + b.previous) - (a.current + a.previous))
.slice(0, 6);
return {
currentLedger: cur,
previousLedger: prev,
currentLabel: curLbl,
previousLabel: prevLbl,
categoryChart: chart,
};
}, [transactions, conversions, wallets, baseCurrency, rates, mode]);
const spendDiff = currentLedger.totalSpendingBase - previousLedger.totalSpendingBase;
const incomeDiff = currentLedger.totalIncomeBase - previousLedger.totalIncomeBase;
const content = (
<div className="space-y-4">
<div className="flex items-center justify-between gap-2">
<div>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
Simple Comparison
</div>
<h2 className="font-display text-2xl">{currentLabel} vs. {previousLabel}</h2>
</div>
<div className="flex gap-1 p-1 rounded-xl surface border text-xs">
<button
type="button"
onClick={() => setMode('week')}
className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
mode === 'week' ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'text-muted'
}`}
>
Weeks
</button>
<button
type="button"
onClick={() => setMode('month')}
className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
mode === 'month' ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'text-muted'
}`}
>
Months
</button>
</div>
</div>
{/* 3 Simple Side-by-Side Scorecards */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
{/* Income Card */}
<div className="surface border rounded-2xl p-4">
<div className="flex items-center justify-between text-xs text-muted mb-1">
<span>Income</span>
<ArrowDownLeft size={13} className="text-accent-income" />
</div>
<div className="font-display text-2xl num text-accent-income">
+{formatMoney(currentLedger.totalIncomeBase, baseCurrency)}
</div>
<div className="text-[11px] text-muted num mt-1">
{previousLabel}: +{formatMoney(previousLedger.totalIncomeBase, baseCurrency)}
</div>
<div className={`text-[10px] font-medium num mt-1 ${incomeDiff >= 0 ? 'text-accent-income' : 'text-accent-expense'}`}>
{incomeDiff >= 0 ? '▲' : '▼'} {formatCompact(Math.abs(incomeDiff), baseCurrency)} vs {previousLabel.toLowerCase()}
</div>
</div>
{/* Spendings Card */}
<div className="surface border rounded-2xl p-4">
<div className="flex items-center justify-between text-xs text-muted mb-1">
<span>Spendings (incl. Debt)</span>
<ArrowUpRight size={13} className="text-accent-expense" />
</div>
<div className="font-display text-2xl num text-accent-expense">
−{formatMoney(currentLedger.totalSpendingBase, baseCurrency)}
</div>
<div className="text-[11px] text-muted num mt-1">
{previousLabel}: −{formatMoney(previousLedger.totalSpendingBase, baseCurrency)}
</div>
<div className={`text-[10px] font-medium num mt-1 ${spendDiff <= 0 ? 'text-accent-income' : 'text-accent-expense'}`}>
{spendDiff <= 0 ? '✓ Spent less by ' : '▲ Spent more by '}
{formatCompact(Math.abs(spendDiff), baseCurrency)}
</div>
</div>
{/* Net Left Card */}
<div className="surface border rounded-2xl p-4">
<div className="flex items-center justify-between text-xs text-muted mb-1">
<span>Money Left ({currentLabel})</span>
<Sparkles size={13} />
</div>
<div className={`font-display text-2xl num ${currentLedger.netForPeriodBase >= 0 ? 'text-accent-income' : 'text-accent-expense'}`}>
{formatMoney(currentLedger.netForPeriodBase, baseCurrency, { sign: 'always' })}
</div>
<div className="text-[11px] text-muted num mt-1">
{previousLabel}: {formatMoney(previousLedger.netForPeriodBase, baseCurrency, { sign: 'always' })}
</div>
</div>
</div>
{/* Simple Category Bar Chart */}
{categoryChart.length > 0 && (
<div className="surface border rounded-2xl p-4">
<div className="flex items-center justify-between text-xs mb-3">
<span className="font-semibold">Spendings by Category ({currentLabel} vs. {previousLabel})</span>
<div className="flex items-center gap-3 text-[10px] text-muted">
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#c2452f]" /> {currentLabel}
</span>
<span className="flex items-center gap-1">
<span className="w-2 h-2 rounded-sm bg-[#7a8a8c]" /> {previousLabel}
</span>
</div>
</div>
<div className="h-52 -mx-2">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={categoryChart} margin={{ top: 6, right: 10, bottom: 2, left: -12 }}>
<CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
<XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
<YAxis
tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
axisLine={false}
tickLine={false}
tickFormatter={(v) => formatCompact(v, baseCurrency)}
width={50}
/>
<Tooltip
formatter={(val) => formatMoney(val, baseCurrency)}
contentStyle={{ borderRadius: 12, background: 'var(--surface)', borderColor: 'var(--border)', fontSize: 11 }}
/>
<Bar dataKey="current" name={currentLabel} fill="#c2452f" radius={[5, 5, 0, 0]} maxBarSize={26} />
<Bar dataKey="previous" name={previousLabel} fill="#7a8a8c" fillOpacity={0.55} radius={[5, 5, 0, 0]} maxBarSize={26} />
</BarChart>
</ResponsiveContainer>
</div>
</div>
)}
</div>
);
if (embedded) return content;

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
<motion.section {...fadeUp} transition={{ duration: 0.4, ease }}>
{content}
      </motion.section>

    </main>
  );
}

