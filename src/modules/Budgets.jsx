// src/modules/Budgets.jsx
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import {
  useStore,
  selectBudgets, selectTransactions, selectBaseCurrency, selectRates,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';
import { fadeUp, ease, startOfMonth, startOfWeek, startOfDay } from '../lib/util';

const PERIODS = [
  { id: 'daily',   label: 'Daily',   start: () => startOfDay() },
  { id: 'weekly',  label: 'Weekly',  start: () => startOfWeek() },
  { id: 'monthly', label: 'Monthly', start: () => startOfMonth() },
];

const CATEGORIES = ['Food & Dining', 'Transport', 'Housing', 'Health', 'Entertainment', 'Subscriptions', 'Shopping', 'Education', 'Other'];

export default function Budgets() {
  const budgets      = useStore(selectBudgets);
  const transactions = useStore(selectTransactions);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);
  const removeBudget = useStore((s) => s.removeBudget);

  const [adding, setAdding] = useState(false);

  const enriched = useMemo(() => {
    return budgets.map((b) => {
      const period = PERIODS.find((p) => p.id === b.period) || PERIODS[2];
      const since = period.start();
      const limitInBase = convert(b.limit, b.currency, baseCurrency, rates);
      let spent = 0;
      for (const t of transactions) {
        if (t.type !== 'expense') continue;
        if (t.category !== b.category) continue;
        if (new Date(t.date) < since) continue;
        spent += convert(Math.abs(t.amount), t.currency || 'USD', baseCurrency, rates);
      }
      const pct = limitInBase > 0 ? Math.min(spent / limitInBase, 1.5) : 0;
      return { ...b, spent, limitInBase, pct, periodLabel: period.label };
    });
  }, [budgets, transactions, baseCurrency, rates]);

  const totals = useMemo(() => {
    const limit = enriched.reduce((s, b) => s + b.limitInBase, 0);
    const spent = enriched.reduce((s, b) => s + b.spent, 0);
    return { limit, spent, pct: limit > 0 ? spent / limit : 0 };
  }, [enriched]);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Budgets</div>
        <h1 className="font-display text-4xl">Spending controls</h1>
      </motion.section>

      {/* Overall progress */}
      {enriched.length > 0 && (
        <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
          className="surface border rounded-2xl p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Overall</div>
              <div className="font-display text-2xl mt-0.5">All categories</div>
            </div>
            <div className="text-right num">
              <div className="text-sm font-medium">{formatMoney(totals.spent, baseCurrency)}</div>
              <div className="text-[11px] text-muted">of {formatMoney(totals.limit, baseCurrency)}</div>
            </div>
          </div>
          <ProgressBar pct={totals.pct} />
        </motion.section>
      )}

      {/* Budget list */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }}
        className="space-y-3 mb-4">
        <AnimatePresence>
          {enriched.map((b, idx) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ delay: idx * 0.04, duration: 0.4, ease }}
              className="surface border rounded-2xl p-4"
            >
              <div className="flex items-baseline justify-between mb-2.5">
                <div>
                  <div className="text-sm font-medium">{b.category}</div>
                  <div className="text-[11px] text-muted">{b.periodLabel}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right num">
                    <div className="text-sm font-medium">{formatMoney(b.spent, baseCurrency)}</div>
                    <div className="text-[11px] text-muted">of {formatMoney(b.limitInBase, baseCurrency)}</div>
                  </div>
                  <button onClick={() => removeBudget(b.id)}
                    className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <ProgressBar pct={b.pct} />
              <div className="flex items-baseline justify-between mt-2 text-[11px] num">
                <span className="text-muted">{Math.round(b.pct * 100)}% used</span>
                <span className={b.spent > b.limitInBase ? 'text-accent-expense font-medium' : 'text-muted'}>
                  {b.spent > b.limitInBase
                    ? `${formatMoney(b.spent - b.limitInBase, baseCurrency)} over`
                    : `${formatMoney(b.limitInBase - b.spent, baseCurrency)} left`}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.section>

      {/* Add button */}
      <button
        onClick={() => setAdding(true)}
        className="w-full py-3.5 rounded-2xl border-2 border-dashed border-[var(--border)] text-muted hover:text-[var(--text)] hover:border-[var(--text)] transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <Plus size={16} /> Add budget
      </button>

      <AddBudgetSheet open={adding} onClose={() => setAdding(false)} />
    </main>
  );
}

function ProgressBar({ pct }) {
  const clamped = Math.min(pct, 1);
  const overflow = pct > 1;
  // Color thresholds: 0–60% green, 60–90% yellow, 90+% red
  const color =
    pct >= 0.9 ? '#c2452f' :
    pct >= 0.6 ? '#d97a1f' : '#3d8b5f';

  return (
    <div className="relative h-2.5 rounded-full bg-[var(--bg)] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
      {overflow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: color, opacity: 0.2 }}
        />
      )}
    </div>
  );
}

function AddBudgetSheet({ open, onClose }) {
  const addBudget = useStore((s) => s.addBudget);
  const baseCurrency = useStore(selectBaseCurrency);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [limit, setLimit] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [period, setPeriod] = useState('monthly');

  const submit = (e) => {
    e.preventDefault();
    const v = parseFloat(limit);
    if (!v || v <= 0) return;
    addBudget({ category, limit: v, currency, period });
    setLimit(''); setCategory(CATEGORIES[0]); setPeriod('monthly');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="px-5 pt-2 pb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl">New budget</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 px-1">Category</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button key={c} type="button" onClick={() => setCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          category === c
                            ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                            : 'border-[var(--border)] text-muted hover:text-[var(--text)]'
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                  {PERIODS.map((p) => (
                    <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
                      className={`py-2 rounded-lg text-xs font-medium ${
                        period === p.id ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                  {Object.values(CURRENCIES).map((c) => (
                    <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                      className={`py-2 rounded-lg text-xs font-medium ${
                        currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                      }`}>
                      <span className="font-display mr-1">{c.symbol}</span>{c.code}
                    </button>
                  ))}
                </div>

                <div className="bg-[var(--bg)] rounded-2xl px-5 py-6 text-center">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Limit</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-3xl text-muted">{CURRENCIES[currency].symbol}</span>
                    <input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0"
                      className="w-full max-w-[200px] bg-transparent outline-none font-display text-5xl text-center num"
                    />
                  </div>
                </div>

                <button type="submit" disabled={!limit || parseFloat(limit) <= 0}
                  className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40 active:scale-[0.99] transition-transform">
                  Create budget
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
