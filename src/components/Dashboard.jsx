import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useStore, selectTransactions } from '../store/useStore';
import CashFlowChart from './CashFlowChart';
import SyncBadge from './SyncBadge';

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};
const ease = [0.16, 1, 0.3, 1];

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function relativeTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const transactions = useStore(selectTransactions);

  const { income, expense, net } = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let inc = 0, exp = 0;
    for (const t of transactions) {
      if (new Date(t.date) < startOfMonth) continue;
      const amt = Math.abs(Number(t.amount) || 0);
      if (t.type === 'income') inc += amt;
      else if (t.type === 'expense') exp += amt;
    }
    return { income: inc, expense: exp, net: inc - exp };
  }, [transactions]);

  const recent = transactions.slice(0, 5);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto px-5 pt-4 pb-32"
    >
      {/* Hero — net balance */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium">
            This month
          </div>
          <SyncBadge />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-muted text-3xl">$</span>
          <span className={`font-display text-6xl num leading-none ${net < 0 ? 'text-accent-expense' : ''}`}>
            {net < 0 ? '−' : ''}{formatMoney(net)}
          </span>
        </div>
        <div className="mt-1 text-sm text-muted">Net balance</div>
      </motion.section>

      {/* Income / Expense cards */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease, delay: 0.05 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <StatCard
          label="Income"
          value={income}
          icon={ArrowDownLeft}
          tone="income"
        />
        <StatCard
          label="Expenses"
          value={expense}
          icon={ArrowUpRight}
          tone="expense"
        />
      </motion.section>

      {/* Chart */}
      <section className="mb-6">
        <CashFlowChart />
      </section>

      {/* Recent activity */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease, delay: 0.15 }}
      >
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-2xl">Recent</h2>
          <span className="text-[11px] text-muted">{transactions.length} total</span>
        </div>

        {recent.length === 0 ? (
          <div className="surface border rounded-2xl p-8 text-center">
            <div className="font-display text-xl mb-1">Nothing yet</div>
            <div className="text-sm text-muted">
              Tap the + button to log your first entry
            </div>
          </div>
        ) : (
          <ul className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} />
            ))}
          </ul>
        )}
      </motion.section>
    </motion.main>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const toneClass = tone === 'income' ? 'text-accent-income' : 'text-accent-expense';
  return (
    <div className="surface border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg bg-[var(--bg)] flex items-center justify-center ${toneClass}`}>
          <Icon size={14} strokeWidth={2.25} />
        </div>
        <span className="text-[11px] text-muted uppercase tracking-[0.1em] font-medium">
          {label}
        </span>
      </div>
      <div className={`font-display text-2xl num ${toneClass}`}>
        ${formatMoney(value)}
      </div>
    </div>
  );
}

function TransactionRow({ tx }) {
  const isIncome = tx.type === 'income';
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
        }`}
      >
        {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {tx.notes || tx.category}
        </div>
        <div className="text-[11px] text-muted truncate">
          {tx.category} · {relativeTime(tx.date)}
          {tx._pending && <span className="ml-1 text-amber-600 dark:text-amber-400">· pending</span>}
        </div>
      </div>
      <div className={`font-medium num text-sm ${isIncome ? 'text-accent-income' : ''}`}>
        {isIncome ? '+' : '−'}${formatMoney(tx.amount)}
      </div>
    </li>
  );
}
