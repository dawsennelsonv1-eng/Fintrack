// src/modules/Compare.jsx
// ROUND C — NEW FILE. Create this at src/modules/Compare.jsx
//
// Period comparison view. Three modes:
//   • Week-over-week    — last 7d vs previous 7d
//   • Month-over-month  — this calendar month vs last calendar month
//   • Custom            — pick two date ranges manually
//
// Shows:
//   • Headline trio: Income / Expenses / Net for both periods + delta %
//   • Cash-flow line chart: period A vs period B overlaid (normalized to day-of-period)
//   • Top movers: categories that shifted most (absolute delta)
//   • Bucket comparison: spending per bucket A vs B
//   • Savings rate: (income - expense) / income, both periods

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  useStore,
  selectTransactions, selectBuckets, selectBaseCurrency, selectRates,
} from '../store/useStore';
import { convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

// ─── Period helpers ─────────────────────────────────────────────
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function daysAgo(n)    { const x = new Date(); x.setDate(x.getDate() - n); return x; }
function fmtRange(from, to) {
  const f = new Date(from), t = new Date(to);
  const sameYear = f.getFullYear() === t.getFullYear();
  const opts = sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: '2-digit' };
  return `${f.toLocaleDateString('en', opts)} – ${t.toLocaleDateString('en', opts)}`;
}

function buildPeriods(mode, customA, customB) {
  if (mode === 'wow') {
    const aFrom = startOfDay(daysAgo(6));   // last 7 days incl. today
    const aTo   = endOfDay(new Date());
    const bFrom = startOfDay(daysAgo(13));  // 7 days before that
    const bTo   = endOfDay(daysAgo(7));
    return {
      a: { from: aFrom.toISOString(), to: aTo.toISOString(), label: 'Last 7 days' },
      b: { from: bFrom.toISOString(), to: bTo.toISOString(), label: 'Prior 7 days' },
    };
  }
  if (mode === 'mom') {
    const now = new Date();
    const aFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const aTo   = endOfDay(now);
    const bFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const bTo   = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    return {
      a: {
        from: aFrom.toISOString(), to: aTo.toISOString(),
        label: aFrom.toLocaleDateString('en', { month: 'long' }),
      },
      b: {
        from: bFrom.toISOString(), to: bTo.toISOString(),
        label: bFrom.toLocaleDateString('en', { month: 'long' }),
      },
    };
  }
  // Custom
  return {
    a: customA && customA.from && customA.to
      ? { from: new Date(customA.from + 'T00:00:00').toISOString(), to: new Date(customA.to + 'T23:59:59').toISOString(), label: 'Period A' }
      : null,
    b: customB && customB.from && customB.to
      ? { from: new Date(customB.from + 'T00:00:00').toISOString(), to: new Date(customB.to + 'T23:59:59').toISOString(), label: 'Period B' }
      : null,
  };
}

// Sum income / expense for a date range
function periodTotals(transactions, period, base, rates) {
  if (!period) return { income: 0, expense: 0, net: 0 };
  const from = new Date(period.from), to = new Date(period.to);
  let income = 0, expense = 0;
  for (const t of transactions) {
    const d = new Date(t.date);
    if (d < from || d > to) continue;
    if (t.type === 'transfer') continue;
    const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
    if (t.type === 'income') income += v;
    if (t.type === 'expense') expense += v;
  }
  return { income, expense, net: income - expense };
}

// Per-category breakdown for a period
function periodByCategory(transactions, period, base, rates, kind /* 'expense' | 'income' */) {
  if (!period) return {};
  const from = new Date(period.from), to = new Date(period.to);
  const out = {};
  for (const t of transactions) {
    if (t.type !== kind) continue;
    const d = new Date(t.date);
    if (d < from || d > to) continue;
    const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
    const cat = t.category || 'Other';
    out[cat] = (out[cat] || 0) + v;
  }
  return out;
}

// Per-bucket OUTFLOW for a period (positive numbers = money spent from bucket)
function periodByBucket(transactions, period, base, rates) {
  if (!period) return {};
  const from = new Date(period.from), to = new Date(period.to);
  const out = {};
  for (const t of transactions) {
    const d = new Date(t.date);
    if (d < from || d > to) continue;
    const allocations = t.buckets || {};
    for (const [key, amt] of Object.entries(allocations)) {
      const n = Number(amt) || 0;
      if (n < 0) {
        const v = convert(Math.abs(n), t.currency || 'USD', base, rates);
        out[key] = (out[key] || 0) + v;
      }
    }
  }
  return out;
}

// Build daily series normalized to "day index from period start"
function buildSeries(transactions, periodA, periodB, base, rates) {
  const lenDays = (p) => {
    if (!p) return 0;
    return Math.max(1, Math.round((new Date(p.to) - new Date(p.from)) / 86400000) + 1);
  };
  const lenA = lenDays(periodA);
  const lenB = lenDays(periodB);
  const maxLen = Math.max(lenA, lenB);

  const dayKey = (date, periodFrom) => {
    const diff = Math.floor((startOfDay(date) - startOfDay(new Date(periodFrom))) / 86400000);
    return diff;
  };

  const initSeries = () => Array.from({ length: maxLen }, (_, i) => ({
    day: i + 1,
    incomeA: 0, expenseA: 0, netA: 0,
    incomeB: 0, expenseB: 0, netB: 0,
  }));
  const series = initSeries();

  if (periodA) {
    const fromA = new Date(periodA.from), toA = new Date(periodA.to);
    for (const t of transactions) {
      const d = new Date(t.date);
      if (d < fromA || d > toA) continue;
      if (t.type === 'transfer') continue;
      const idx = dayKey(d, periodA.from);
      if (idx < 0 || idx >= maxLen) continue;
      const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
      if (t.type === 'income')  { series[idx].incomeA  += v; series[idx].netA += v; }
      if (t.type === 'expense') { series[idx].expenseA += v; series[idx].netA -= v; }
    }
  }
  if (periodB) {
    const fromB = new Date(periodB.from), toB = new Date(periodB.to);
    for (const t of transactions) {
      const d = new Date(t.date);
      if (d < fromB || d > toB) continue;
      if (t.type === 'transfer') continue;
      const idx = dayKey(d, periodB.from);
      if (idx < 0 || idx >= maxLen) continue;
      const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
      if (t.type === 'income')  { series[idx].incomeB  += v; series[idx].netB += v; }
      if (t.type === 'expense') { series[idx].expenseB += v; series[idx].netB -= v; }
    }
  }
  return series;
}

// ─────────────────────────────────────────────────────────────────
export default function Compare() {
  const transactions = useStore(selectTransactions);
  const buckets      = useStore(selectBuckets);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

  const [mode, setMode] = useState('mom'); // 'wow' | 'mom' | 'custom'
  const [customA, setCustomA] = useState({ from: '', to: '' });
  const [customB, setCustomB] = useState({ from: '', to: '' });
  const [chartMetric, setChartMetric] = useState('net'); // 'income' | 'expense' | 'net'

  const periods = useMemo(() => buildPeriods(mode, customA, customB), [mode, customA, customB]);
  const periodA = periods.a, periodB = periods.b;

  const totalsA = useMemo(() => periodTotals(transactions, periodA, baseCurrency, rates), [transactions, periodA, baseCurrency, rates]);
  const totalsB = useMemo(() => periodTotals(transactions, periodB, baseCurrency, rates), [transactions, periodB, baseCurrency, rates]);

  const expensesByCatA = useMemo(() => periodByCategory(transactions, periodA, baseCurrency, rates, 'expense'), [transactions, periodA, baseCurrency, rates]);
  const expensesByCatB = useMemo(() => periodByCategory(transactions, periodB, baseCurrency, rates, 'expense'), [transactions, periodB, baseCurrency, rates]);

  const bucketsA = useMemo(() => periodByBucket(transactions, periodA, baseCurrency, rates), [transactions, periodA, baseCurrency, rates]);
  const bucketsB = useMemo(() => periodByBucket(transactions, periodB, baseCurrency, rates), [transactions, periodB, baseCurrency, rates]);

  const series = useMemo(() => buildSeries(transactions, periodA, periodB, baseCurrency, rates), [transactions, periodA, periodB, baseCurrency, rates]);

  // Top category movers (by absolute delta in expenses)
  const movers = useMemo(() => {
    const allCats = new Set([...Object.keys(expensesByCatA), ...Object.keys(expensesByCatB)]);
    const rows = [];
    for (const cat of allCats) {
      const a = expensesByCatA[cat] || 0;
      const b = expensesByCatB[cat] || 0;
      const delta = a - b;
      rows.push({ cat, a, b, delta, deltaPct: b > 0 ? (delta / b) * 100 : (a > 0 ? 100 : 0) });
    }
    rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    return rows.slice(0, 8);
  }, [expensesByCatA, expensesByCatB]);

  const bucketComparison = useMemo(() => {
    const sorted = [...buckets].filter((b) => b.enabled !== false).sort((a, b) => a.order - b.order);
    return sorted.map((b) => ({
      key: b.key, name: b.name, color: b.color,
      a: bucketsA[b.key] || 0,
      b: bucketsB[b.key] || 0,
    })).filter(r => r.a > 0 || r.b > 0);
  }, [buckets, bucketsA, bucketsB]);

  const savingsRateA = totalsA.income > 0 ? (totalsA.income - totalsA.expense) / totalsA.income : 0;
  const savingsRateB = totalsB.income > 0 ? (totalsB.income - totalsB.expense) / totalsB.income : 0;

  const periodsValid = periodA && periodB;

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Period comparison</div>
        <h1 className="font-display text-4xl">Compare</h1>
      </motion.section>

      {/* Mode picker */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }} className="mb-4">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--surface)]">
          {[
            { id: 'wow',    label: 'Week / Week' },
            { id: 'mom',    label: 'Month / Month' },
            { id: 'custom', label: 'Custom' },
          ].map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  active ? 'bg-[var(--bg)] shadow-sm' : 'text-muted'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Custom range pickers */}
        {mode === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="surface border rounded-xl p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Period A</div>
              <input type="date" value={customA.from} onChange={(e) => setCustomA({ ...customA, from: e.target.value })}
                max={customA.to || undefined}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-xs num" />
              <input type="date" value={customA.to} onChange={(e) => setCustomA({ ...customA, to: e.target.value })}
                min={customA.from || undefined}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-xs num" />
            </div>
            <div className="surface border rounded-xl p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Period B</div>
              <input type="date" value={customB.from} onChange={(e) => setCustomB({ ...customB, from: e.target.value })}
                max={customB.to || undefined}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-xs num" />
              <input type="date" value={customB.to} onChange={(e) => setCustomB({ ...customB, to: e.target.value })}
                min={customB.from || undefined}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-xs num" />
            </div>
          </div>
        )}
      </motion.section>

      {!periodsValid ? (
        <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }}>
          <div className="surface border rounded-2xl p-8 text-center">
            <div className="font-display text-lg mb-1">Pick two periods</div>
            <div className="text-sm text-muted">Choose a date range for each period to compare.</div>
          </div>
        </motion.section>
      ) : (
        <>
          {/* Period labels */}
          <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.08 }}
            className="grid grid-cols-2 gap-3 mb-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">{periodA.label}</div>
              <div className="text-[10px] text-muted num mt-0.5">{fmtRange(periodA.from, periodA.to)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">{periodB.label}</div>
              <div className="text-[10px] text-muted num mt-0.5">{fmtRange(periodB.from, periodB.to)}</div>
            </div>
          </motion.section>

          {/* Headline trio */}
          <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }} className="space-y-3 mb-5">
            <CompareCard
              label="Income"
              tone="income"
              icon={ArrowDownLeft}
              valueA={totalsA.income}
              valueB={totalsB.income}
              currency={baseCurrency}
            />
            <CompareCard
              label="Expenses"
              tone="expense"
              icon={ArrowUpRight}
              valueA={totalsA.expense}
              valueB={totalsB.expense}
              currency={baseCurrency}
              invertDelta
            />
            <CompareCard
              label="Net"
              tone={totalsA.net >= 0 ? 'income' : 'expense'}
              icon={totalsA.net >= totalsB.net ? TrendingUp : TrendingDown}
              valueA={totalsA.net}
              valueB={totalsB.net}
              currency={baseCurrency}
            />
          </motion.section>

          {/* Cash flow chart */}
          <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.13 }} className="mb-5">
            <div className="surface border rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Daily flow</div>
                  <div className="font-display text-2xl mt-0.5">A vs B</div>
                </div>
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--bg)]">
                  {[
                    { id: 'income',  label: 'In' },
                    { id: 'expense', label: 'Out' },
                    { id: 'net',     label: 'Net' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setChartMetric(m.id)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium ${
                        chartMetric === m.id ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] mb-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-ink-900 dark:bg-ink-50" />
                  <span className="text-muted">{periodA.label}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-muted" style={{ borderColor: 'var(--text-muted)' }} />
                  <span className="text-muted">{periodB.label}</span>
                </span>
              </div>
              <div className="h-56 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(d) => `D${d}`}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => formatCompact(v, baseCurrency)}
                      width={48}
                    />
                    <Tooltip content={<CompareTooltip currency={baseCurrency} metric={chartMetric} periodA={periodA} periodB={periodB} />} cursor={{ stroke: 'var(--border)' }} />
                    <Line
                      type="monotone"
                      dataKey={`${chartMetric}A`}
                      stroke="var(--text)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                      animationDuration={500}
                    />
                    <Line
                      type="monotone"
                      dataKey={`${chartMetric}B`}
                      stroke="var(--text-muted)"
                      strokeWidth={1.75}
                      strokeDasharray="4 3"
                      dot={false}
                      isAnimationActive
                      animationDuration={500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.section>

          {/* Savings rate */}
          <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.15 }} className="mb-5">
            <div className="surface border rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-3">Savings rate</div>
              <div className="grid grid-cols-2 gap-4">
                <SavingsRateCell label={periodA.label} rate={savingsRateA} hasIncome={totalsA.income > 0} />
                <SavingsRateCell label={periodB.label} rate={savingsRateB} hasIncome={totalsB.income > 0} />
              </div>
              {totalsA.income > 0 && totalsB.income > 0 && (
                <div className="text-[11px] text-muted text-center mt-3">
                  {savingsRateA > savingsRateB
                    ? `Up ${((savingsRateA - savingsRateB) * 100).toFixed(1)} pts`
                    : savingsRateA < savingsRateB
                      ? `Down ${((savingsRateB - savingsRateA) * 100).toFixed(1)} pts`
                      : 'Unchanged'}
                </div>
              )}
            </div>
          </motion.section>

          {/* Top movers */}
          <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.17 }} className="mb-5">
            <div className="surface border rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Top movers</div>
                  <div className="font-display text-2xl mt-0.5">Where it shifted</div>
                </div>
                <span className="text-[11px] text-muted">By expense delta</span>
              </div>
              {movers.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted">No expense activity in either period.</div>
              ) : (
                <ul className="space-y-2">
                  {movers.map((m) => (
                    <MoverRow key={m.cat} mover={m} currency={baseCurrency} />
                  ))}
                </ul>
              )}
            </div>
          </motion.section>

          {/* Bucket comparison */}
          {bucketComparison.length > 0 && (
            <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.19 }} className="mb-5">
              <div className="surface border rounded-2xl p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Buckets</div>
                    <div className="font-display text-2xl mt-0.5">Outflow per bucket</div>
                  </div>
                </div>
                <ul className="space-y-3">
                  {bucketComparison.map((b) => {
                    const max = Math.max(b.a, b.b, 1);
                    return (
                      <li key={b.key}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                          <span className="text-[12px] font-medium flex-1 truncate">{b.name}</span>
                          <DeltaPill a={b.a} b={b.b} invert />
                        </div>
                        <div className="space-y-1">
                          <BucketBar label={periodA.label} value={b.a} max={max} color={b.color} currency={baseCurrency} solid />
                          <BucketBar label={periodB.label} value={b.b} max={max} color={b.color} currency={baseCurrency} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.section>
          )}
        </>
      )}
    </main>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function CompareCard({ label, tone, icon: Icon, valueA, valueB, currency, invertDelta = false }) {
  const delta = valueA - valueB;
  const deltaPct = valueB !== 0 ? (delta / Math.abs(valueB)) * 100 : (valueA !== 0 ? 100 : 0);
  // For expenses, "up" is bad. invertDelta flips the color logic.
  const goodSign = invertDelta ? -delta : delta;
  const deltaTone = goodSign > 0 ? 'income' : goodSign < 0 ? 'expense' : 'muted';
  const toneClass =
    tone === 'income'  ? 'text-accent-income'  :
    tone === 'expense' ? 'text-accent-expense' : '';
  const deltaClass =
    deltaTone === 'income'  ? 'text-accent-income'  :
    deltaTone === 'expense' ? 'text-accent-expense' : 'text-muted';

  return (
    <div className="surface border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg bg-[var(--bg)] flex items-center justify-center ${toneClass}`}>
          <Icon size={14} strokeWidth={2.25} />
        </div>
        <span className="text-[10px] text-muted uppercase tracking-[0.1em] font-semibold">{label}</span>
        <div className={`ml-auto text-[11px] num font-medium ${deltaClass}`}>
          {delta === 0 ? (
            <span className="flex items-center gap-1"><Minus size={11} /> 0%</span>
          ) : (
            <span>
              {delta > 0 ? '+' : ''}{deltaPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={`font-display text-2xl num ${toneClass}`}>{formatCompact(valueA, currency)}</div>
          <div className="text-[10px] text-muted mt-0.5">A</div>
        </div>
        <div>
          <div className="font-display text-2xl num text-muted">{formatCompact(valueB, currency)}</div>
          <div className="text-[10px] text-muted mt-0.5">B</div>
        </div>
      </div>
    </div>
  );
}

function CompareTooltip({ active, payload, label, currency, metric, periodA, periodB }) {
  if (!active || !payload?.length) return null;
  const a = payload.find((p) => p.dataKey === `${metric}A`)?.value || 0;
  const b = payload.find((p) => p.dataKey === `${metric}B`)?.value || 0;
  return (
    <div className="surface border rounded-xl px-3 py-2.5 shadow-lg text-xs num">
      <div className="font-medium mb-1.5">Day {label}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted">{periodA.label}</span>
        <span className="font-medium">{formatMoney(a, currency)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted">{periodB.label}</span>
        <span className="font-medium">{formatMoney(b, currency)}</span>
      </div>
    </div>
  );
}

function SavingsRateCell({ label, rate, hasIncome }) {
  const pct = rate * 100;
  const tone = pct >= 20 ? 'income' : pct < 0 ? 'expense' : '';
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold mb-1">{label}</div>
      {hasIncome ? (
        <div className={`font-display text-3xl num ${tone === 'income' ? 'text-accent-income' : tone === 'expense' ? 'text-accent-expense' : ''}`}>
          {pct.toFixed(0)}%
        </div>
      ) : (
        <div className="font-display text-3xl text-muted">—</div>
      )}
    </div>
  );
}

function MoverRow({ mover, currency }) {
  const { cat, a, b, delta, deltaPct } = mover;
  const goodSign = -delta; // expense down = good
  const deltaClass =
    delta === 0 ? 'text-muted' :
    goodSign > 0 ? 'text-accent-income' : 'text-accent-expense';
  return (
    <li className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{cat}</div>
        <div className="text-[11px] text-muted num">
          {formatCompact(a, currency)} <span className="opacity-50">vs</span> {formatCompact(b, currency)}
        </div>
      </div>
      <div className={`text-right shrink-0 num ${deltaClass}`}>
        <div className="text-[13px] font-medium">
          {delta > 0 ? '+' : delta < 0 ? '−' : ''}{formatCompact(Math.abs(delta), currency)}
        </div>
        <div className="text-[10px]">
          {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${deltaPct.toFixed(0)}%`}
        </div>
      </div>
    </li>
  );
}

function DeltaPill({ a, b, invert = false }) {
  const delta = a - b;
  if (delta === 0) return <span className="text-[10px] text-muted num">—</span>;
  const goodSign = invert ? -delta : delta;
  const cls = goodSign > 0 ? 'text-accent-income' : 'text-accent-expense';
  const pct = b !== 0 ? (delta / Math.abs(b)) * 100 : 100;
  return (
    <span className={`text-[10px] num font-medium ${cls}`}>
      {delta > 0 ? '+' : ''}{pct.toFixed(0)}%
    </span>
  );
}

function BucketBar({ label, value, max, color, currency, solid = false }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{
            backgroundColor: color,
            opacity: solid ? 1 : 0.45,
          }}
        />
      </div>
      <span className="text-[10px] num text-muted w-14 text-right shrink-0">{formatCompact(value, currency)}</span>
    </div>
  );
}
