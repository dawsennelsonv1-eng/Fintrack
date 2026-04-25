import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { useStore, selectTransactions } from '../store/useStore';

// Bin transactions into the last N days
function buildSeries(transactions, days = 30) {
  const now = new Date();
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, income: 0, expense: 0 };
  }
  for (const tx of transactions) {
    const key = (typeof tx.date === 'string' ? tx.date : new Date(tx.date).toISOString()).slice(0, 10);
    if (buckets[key]) buckets[key][tx.type] += Math.abs(Number(tx.amount) || 0);
  }
  return Object.values(buckets);
}

function formatTick(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === 'income')?.value || 0;
  const expense = payload.find((p) => p.dataKey === 'expense')?.value || 0;
  return (
    <div className="surface border rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <div className="font-medium mb-1.5">{formatTick(label)}</div>
      <div className="flex items-center justify-between gap-6 num">
        <span className="text-muted">Income</span>
        <span className="text-accent-income font-medium">+${income.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between gap-6 num">
        <span className="text-muted">Expense</span>
        <span className="text-accent-expense font-medium">−${expense.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function CashFlowChart() {
  const transactions = useStore(selectTransactions);
  const data = useMemo(() => buildSeries(transactions, 30), [transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="surface border rounded-2xl p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium">
            Cash Flow
          </div>
          <div className="font-display text-2xl mt-0.5">Last 30 days</div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-income" />
            <span className="text-muted">Income</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-expense" />
            <span className="text-muted">Expense</span>
          </span>
        </div>
      </div>

      <div className="h-56 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d8b5f" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3d8b5f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c2452f" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#c2452f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)' }} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#3d8b5f"
              strokeWidth={1.75}
              fill="url(#incomeGrad)"
              isAnimationActive
              animationDuration={700}
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#c2452f"
              strokeWidth={1.75}
              fill="url(#expenseGrad)"
              isAnimationActive
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
