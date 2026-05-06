// src/components/SchedulesManager.jsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Repeat, X, Pause, Play, Trash2, ArrowDownLeft, ArrowUpRight, Plus, Calendar,
} from 'lucide-react';
import {
  useStore, selectRecurring, selectBaseCurrency, selectRates,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';

export default function SchedulesManager({ open, onClose }) {
  const recurring = useStore(selectRecurring);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);
  const togglePaused = useStore((s) => s.toggleRecurringPaused);
  const removeRecurring = useStore((s) => s.removeRecurring);

  const sorted = useMemo(
    () => [...recurring].sort((a, b) => {
      // Active first, then by next due
      if (a.paused !== b.paused) return a.paused ? 1 : -1;
      return new Date(a.nextDueAt || 0) - new Date(b.nextDueAt || 0);
    }),
    [recurring]
  );

  const totals = useMemo(() => {
    let monthlyIncome = 0, monthlyExpense = 0;
    for (const r of recurring) {
      if (r.paused) continue;
      const monthlyMultiplier = monthlyEquivalent(r);
      const v = convert(Math.abs(Number(r.amount) || 0), r.currency || 'USD', baseCurrency, rates) * monthlyMultiplier;
      if (r.type === 'income') monthlyIncome += v;
      if (r.type === 'expense') monthlyExpense += v;
    }
    return { monthlyIncome, monthlyExpense };
  }, [recurring, baseCurrency, rates]);

  return (
    <AnimatePresence>
      {open && (
        <>
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
            <div className="px-5 pt-2 pb-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display text-2xl">Recurring schedules</h2>
                  <div className="text-[11px] text-muted mt-0.5">
                    {recurring.length} total · {recurring.filter((r) => !r.paused).length} active
                  </div>
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              {/* Summary cards */}
              {(totals.monthlyIncome > 0 || totals.monthlyExpense > 0) && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="surface border rounded-2xl p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted">Monthly inflow</div>
                    <div className="font-display text-xl text-accent-income num mt-0.5">
                      +{formatMoney(totals.monthlyIncome, baseCurrency)}
                    </div>
                  </div>
                  <div className="surface border rounded-2xl p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted">Monthly outflow</div>
                    <div className="font-display text-xl text-accent-expense num mt-0.5">
                      −{formatMoney(totals.monthlyExpense, baseCurrency)}
                    </div>
                  </div>
                </div>
              )}

              {sorted.length === 0 ? (
                <div className="surface border rounded-2xl p-8 text-center">
                  <Repeat size={26} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
                  <div className="font-display text-lg mb-1">No schedules yet</div>
                  <div className="text-sm text-muted mb-4">
                    Tap + then "Recurring" to create your first one
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {sorted.map((r) => (
                    <ScheduleRow
                      key={r.id}
                      schedule={r}
                      baseCurrency={baseCurrency}
                      rates={rates}
                      onTogglePaused={() => togglePaused(r.id)}
                      onRemove={() => removeRecurring(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ScheduleRow({ schedule, baseCurrency, rates, onTogglePaused, onRemove }) {
  const [confirming, setConfirming] = useState(false);
  const isIncome = schedule.type === 'income';
  const cfg = CURRENCIES[schedule.currency] || CURRENCIES.USD;
  const inBase = convert(Math.abs(Number(schedule.amount) || 0), schedule.currency || 'USD', baseCurrency, rates);
  const next = schedule.nextDueAt ? new Date(schedule.nextDueAt) : null;

  return (
    <motion.div layout className={`surface border rounded-xl p-3 ${schedule.paused ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
        }`}>
          {isIncome ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium truncate">{schedule.name}</div>
            <div className={`font-medium num text-sm shrink-0 ${isIncome ? 'text-accent-income' : ''}`}>
              {isIncome ? '+' : '−'}{formatMoney(Math.abs(schedule.amount), schedule.currency)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
            <Repeat size={10} />
            {describeFrequency(schedule)}
            {schedule.category && <> · {schedule.category}</>}
          </div>
          {next && (
            <div className="flex items-center gap-1.5 text-[11px] mt-1 num">
              <Calendar size={10} className="text-muted" />
              <span className={schedule.paused ? 'text-muted' : ''}>
                {schedule.paused ? 'Paused' : `Next: ${formatNext(next)}`}
              </span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!confirming ? (
          <motion.div key="actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex gap-1.5 mt-3"
          >
            <button onClick={onTogglePaused}
              className="flex-1 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-xs font-medium flex items-center justify-center gap-1.5">
              {schedule.paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
            </button>
            <button onClick={() => setConfirming(true)}
              className="px-3 py-2 rounded-lg bg-accent-expense/10 text-accent-expense hover:bg-accent-expense/20 transition-colors text-xs font-medium flex items-center gap-1.5">
              <Trash2 size={12} />
            </button>
          </motion.div>
        ) : (
          <motion.div key="confirm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-2 mt-3"
          >
            <button onClick={() => setConfirming(false)}
              className="py-2 rounded-lg bg-[var(--bg)] text-xs font-medium">
              Cancel
            </button>
            <button onClick={onRemove}
              className="py-2 rounded-lg bg-accent-expense text-white text-xs font-medium">
              Delete schedule
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function describeFrequency(r) {
  const interval = Number(r.interval) || 1;
  const plural = interval > 1;
  const f = r.frequency || 'monthly';
  if (interval === 1) {
    if (f === 'daily') return 'Every day';
    if (f === 'weekly') return 'Every week';
    if (f === 'monthly') return `Monthly · day ${r.dayOfMonth || 1}`;
    if (f === 'yearly') return 'Every year';
  }
  const unit = f === 'daily' ? 'days' : f === 'weekly' ? 'weeks' : f === 'monthly' ? 'months' : 'years';
  return `Every ${interval} ${unit}`;
}

function formatNext(d) {
  const now = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const ydy = new Date(); ydy.setDate(ydy.getDate() - 1);
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  if (sameDay(d, now)) return 'today';
  if (sameDay(d, tmr)) return 'tomorrow';
  if (sameDay(d, ydy)) return 'yesterday';
  if (d < now) return `${Math.ceil((now - d) / (1000 * 60 * 60 * 24))} days overdue`;
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Convert a recurring's amount to monthly equivalent
function monthlyEquivalent(r) {
  const interval = Math.max(1, Number(r.interval) || 1);
  switch (r.frequency) {
    case 'daily': return 30 / interval;
    case 'weekly': return (52 / 12) / interval;
    case 'monthly': return 1 / interval;
    case 'yearly': return (1 / 12) / interval;
    default: return 1;
  }
}
