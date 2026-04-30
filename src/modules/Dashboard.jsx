// src/modules/Dashboard.jsx
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, AlertCircle } from 'lucide-react';
import {
  useStore,
  selectTransactions, selectInvestments,
  selectTotalDebtInBase, selectBaseCurrency, selectRates,
  computeMonthSummary, computeInvestmentTotals,
} from '../store/useStore';
import { convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease, relativeTime } from '../lib/util';
import SyncBadge from '../components/SyncBadge';
import { useTxActions } from '../components/TxActions';

export default function Dashboard() {
  const transactions = useStore(selectTransactions);
  const investments  = useStore(selectInvestments);
  const debt         = useStore(selectTotalDebtInBase);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

  const summary   = useMemo(() => computeMonthSummary(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const invTotals = useMemo(() => computeInvestmentTotals(investments, baseCurrency, rates), [investments, baseCurrency, rates]);

  const netWorth = useMemo(() => {
    let liquid = 0;
    for (const t of transactions) {
      const v = convert(Math.abs(t.amount), t.currency || 'USD', baseCurrency, rates);
      liquid += t.type === 'income' ? v : -v;
    }
    return liquid + invTotals.value - debt;
  }, [transactions, invTotals.value, debt, baseCurrency, rates]);

  const series = useMemo(() => buildSeries(transactions, baseCurrency, rates, 30), [transactions, baseCurrency, rates]);
  const recent = transactions.slice(0, 6);

  const { bind, sheet } = useTxActions();

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Net Worth</div>
          <SyncBadge />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-display ${netWorth < 0 ? 'text-accent-expense' : ''} text-6xl num leading-none`}>
            {formatMoney(netWorth, baseCurrency)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          <span>Liquid + Investments − Debt</span>
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Income · MTD"   value={summary.income}     tone="income"  icon={ArrowDownLeft} currency={baseCurrency} />
        <StatCard label="Expenses · MTD" value={summary.expense}    tone="expense" icon={ArrowUpRight}  currency={baseCurrency} />
        <StatCard label="Investments"    value={invTotals.value}    tone="default" icon={TrendingUp}    currency={baseCurrency}
                  subtle={invTotals.gain >= 0
                    ? `+${formatCompact(invTotals.gain, baseCurrency)} (${(invTotals.gainPct*100).toFixed(1)}%)`
                    : `${formatCompact(invTotals.gain, baseCurrency)} (${(invTotals.gainPct*100).toFixed(1)}%)`} />
        <StatCard label="Total Debt"     value={debt}               tone={debt > 0 ? 'expense' : 'default'} icon={AlertCircle} currency={baseCurrency} />
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }} className="mb-6">
        <div className="surface border rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Cash Flow</div>
              <div className="font-display text-2xl mt-0.5">Last 30 days</div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-income" /><span className="text-muted">Income</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-expense" /><span className="text-muted">Expense</span>
              </span>
            </div>
          </div>
          <div className="h-56 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3d8b5f" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3d8b5f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c2452f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c2452f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={fmtTick}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCompact(v, baseCurrency)} width={48} />
                <Tooltip content={<CFTooltip currency={baseCurrency} />} cursor={{ stroke: 'var(--border)' }} />
                <Area type="monotone" dataKey="income"  stroke="#3d8b5f" strokeWidth={1.75} fill="url(#incG)"
                  isAnimationActive animationDuration={700} />
                <Area type="monotone" dataKey="expense" stroke="#c2452f" strokeWidth={1.75} fill="url(#expG)"
                  isAnimationActive animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.15 }}>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-2xl">Recent</h2>
          <span className="text-[11px] text-muted">{transactions.length} total</span>
        </div>
        {recent.length === 0 ? (
          <div className="surface border rounded-2xl p-8 text-center">
            <Wallet size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
            <div className="font-display text-xl mb-1">Nothing yet</div>
            <div className="text-sm text-muted">Tap the + button to log your first entry</div>
          </div>
        ) : (
          <ul className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
            {recent.map((t) => (
              <Row key={t.id} tx={t} baseCurrency={baseCurrency} rates={rates} bind={bind} />
            ))}
          </ul>
        )}
        <p className="text-[11px] text-muted text-center mt-3">Long-press a transaction to edit or delete</p>
      </motion.section>

      {sheet}
    </main>
  );
}

function buildSeries(transactions, baseCurrency, rates, days = 30) {
  const now = new Date();
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    buckets[k] = { date: k, income: 0, expense: 0 };
  }
  for (const tx of transactions) {
    const k = (typeof tx.date === 'string' ? tx.date : new Date(tx.date).toISOString()).slice(0, 10);
    if (!buckets[k]) continue;
    const v = convert(Math.abs(tx.amount), tx.currency || 'USD', baseCurrency, rates);
    if (tx.type === 'income')  buckets[k].income  += v;
    if (tx.type === 'expense') buckets[k].expense += v;
  }
  return Object.values(buckets);
}

function fmtTick(date) {
  return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function CFTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  const i = payload.find((p) => p.dataKey === 'income')?.value || 0;
  const e = payload.find((p) => p.dataKey === 'expense')?.value || 0;
  return (
    <div className="surface border rounded-xl px-3 py-2.5 shadow-lg text-xs num">
      <div className="font-medium mb-1.5">{fmtTick(label)}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted">Income</span>
        <span className="text-accent-income font-medium">{formatMoney(i, currency, { sign: 'always' })}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted">Expense</span>
        <span className="text-accent-expense font-medium">−{formatMoney(e, currency)}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, icon: Icon, currency, subtle }) {
  const toneClass =
    tone === 'income'  ? 'text-accent-income' :
    tone === 'expense' ? 'text-accent-expense' : '';
  return (
    <div className="surface border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg bg-[var(--bg)] flex items-center justify-center ${toneClass}`}>
          <Icon size={14} strokeWidth={2.25} />
        </div>
        <span className="text-[10px] text-muted uppercase tracking-[0.1em] font-semibold">{label}</span>
      </div>
      <div className={`font-display text-2xl num ${toneClass}`}>{formatCompact(value, currency)}</div>
      {subtle && <div className={`text-[11px] num mt-0.5 ${value >= 0 ? 'text-accent-income' : 'text-accent-expense'}`}>{subtle}</div>}
    </div>
  );
}

function Row({ tx, baseCurrency, rates, bind }) {
  const isIncome = tx.type === 'income';
  const inBase = convert(Math.abs(tx.amount), tx.currency || 'USD', baseCurrency, rates);
  const showConversion = (tx.currency || 'USD') !== baseCurrency;
  return (
    <li
      {...bind(tx)}
      className="flex items-center gap-3 px-4 py-3.5 select-none cursor-pointer active:bg-[var(--bg)] transition-colors"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
      }`}>
        {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{tx.notes || tx.category}</div>
        <div className="text-[11px] text-muted truncate">
          {tx.category} · {relativeTime(tx.date)}
          {tx._pending && <span className="ml-1 text-amber-600 dark:text-amber-400">· pending</span>}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-medium num text-sm ${isIncome ? 'text-accent-income' : ''}`}>
          {isIncome ? '+' : '−'}{formatMoney(Math.abs(tx.amount), tx.currency || 'USD')}
        </div>
        {showConversion && (
          <div className="text-[10px] text-muted num">≈ {formatMoney(inBase, baseCurrency)}</div>
        )}
      </div>
    </li>
  );
}
