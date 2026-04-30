// src/modules/CalendarView.jsx
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, Calendar as CalIcon } from 'lucide-react';
import {
  useStore,
  selectTransactions, selectBaseCurrency, selectRates,
} from '../store/useStore';
import { convert, formatMoney } from '../lib/currency';
import { fadeUp, ease, isSameDay } from '../lib/util';
import { useTxActions } from '../components/TxActions';

const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarView() {
  const transactions = useStore(selectTransactions);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  const [selected, setSelected] = useState(() => new Date());

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const dayMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      const d = new Date(t.date);
      if (d.getFullYear() !== cursor.getFullYear() || d.getMonth() !== cursor.getMonth()) continue;
      const key = d.getDate();
      if (!map[key]) map[key] = { income: 0, expense: 0 };
      const v = convert(Math.abs(t.amount), t.currency || 'USD', baseCurrency, rates);
      if (t.type === 'income')  map[key].income  += v;
      if (t.type === 'expense') map[key].expense += v;
    }
    return map;
  }, [transactions, cursor, baseCurrency, rates]);

  const monthTotals = useMemo(() => {
    return Object.values(dayMap).reduce(
      (acc, d) => ({ income: acc.income + d.income, expense: acc.expense + d.expense }),
      { income: 0, expense: 0 }
    );
  }, [dayMap]);

  const selectedTxs = useMemo(() => {
    return transactions
      .filter((t) => isSameDay(new Date(t.date), selected))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selected]);

  const monthLabel = cursor.toLocaleDateString('en', { month: 'long', year: 'numeric' });

  const navMonth = (delta) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  };

  const { bind, sheet } = useTxActions();

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Calendar</div>
        <h1 className="font-display text-4xl">Time machine</h1>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className="grid grid-cols-2 gap-3 mb-4">
        <div className="surface border rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Inflow</div>
          <div className="font-display text-2xl text-accent-income num mt-1">
            +{formatMoney(monthTotals.income, baseCurrency)}
          </div>
        </div>
        <div className="surface border rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Outflow</div>
          <div className="font-display text-2xl text-accent-expense num mt-1">
            −{formatMoney(monthTotals.expense, baseCurrency)}
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }}
        className="surface border rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navMonth(-1)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center">
            <ChevronLeft size={16} />
          </button>
          <div className="font-display text-xl">{monthLabel}</div>
          <button onClick={() => navMonth(1)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK.map((w) => (
            <div key={w} className="text-center text-[10px] text-muted font-medium uppercase tracking-wider py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const data = dayMap[d.getDate()];
            const isToday = isSameDay(d, new Date());
            const isSelected = isSameDay(d, selected);
            const hasIncome  = data?.income  > 0;
            const hasExpense = data?.expense > 0;

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelected(d)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${
                  isSelected ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
                  : isToday   ? 'bg-[var(--bg)] ring-1 ring-[var(--border)]'
                  : 'hover:bg-[var(--bg)]'
                }`}
              >
                {!isSelected && (hasIncome || hasExpense) && (
                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                    {hasIncome && <div className="absolute inset-0 bg-accent-income/10" />}
                    {hasExpense && <div className="absolute inset-0 bg-accent-expense/10" />}
                  </div>
                )}
                <span className="relative text-sm font-medium num">{d.getDate()}</span>
                {(hasIncome || hasExpense) && (
                  <div className="relative flex gap-0.5 mt-0.5">
                    {hasIncome  && <span className="w-1 h-1 rounded-full bg-accent-income" />}
                    {hasExpense && <span className="w-1 h-1 rounded-full bg-accent-expense" />}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.15 }}>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
              {selected.toLocaleDateString('en', { weekday: 'long' })}
            </div>
            <h2 className="font-display text-2xl">
              {selected.toLocaleDateString('en', { month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <span className="text-[11px] text-muted">{selectedTxs.length} entries</span>
        </div>

        <AnimatePresence mode="wait">
          {selectedTxs.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="surface border rounded-2xl p-8 text-center"
            >
              <CalIcon size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
              <div className="font-display text-xl mb-1">No activity</div>
              <div className="text-sm text-muted">Nothing logged on this day</div>
            </motion.div>
          ) : (
            <motion.ul
              key={selected.toISOString()}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden"
            >
              {selectedTxs.map((t) => {
                const isIncome = t.type === 'income';
                return (
                  <li
                    key={t.id}
                    {...bind(t)}
                    className="flex items-center gap-3 px-4 py-3.5 select-none cursor-pointer active:bg-[var(--bg)] transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
                    }`}>
                      {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.notes || t.category}</div>
                      <div className="text-[11px] text-muted truncate">
                        {t.category} · {new Date(t.date).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className={`font-medium num text-sm ${isIncome ? 'text-accent-income' : ''}`}>
                      {isIncome ? '+' : '−'}{formatMoney(Math.abs(t.amount), t.currency || 'USD')}
                    </div>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.section>

      {sheet}
    </main>
  );
}
