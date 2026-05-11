// src/modules/Debt.jsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Check, Info, HandCoins, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  useStore,
  selectDebts, selectDebtEvents, selectTotalDebtInBase, selectTotalReceivableInBase,
  selectBaseCurrency, selectRates,
  computeDebtsWithStatus,
} from '../store/useStore';
import { convert, formatMoney } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

// Round D: Debt module is now VIEWER-ONLY.
//
// Recording new debts happens via QuickAdd with the special categories:
//   • Borrowed (income) → creates a 'You owe' debt
//   • Lent     (expense) → creates an 'Owed to you' debt
//
// This module shows both lists, the net position, and the repayment flow.
//
export default function DebtModule() {
  const rawDebts     = useStore(selectDebts);
  const debtEvents   = useStore(selectDebtEvents);
  const totalOwe     = useStore(selectTotalDebtInBase);
  const totalReceivable = useStore(selectTotalReceivableInBase);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);
  const removeDebt   = useStore((s) => s.removeDebt);

  const allDebts = useMemo(
    () => computeDebtsWithStatus(rawDebts, debtEvents, baseCurrency, rates),
    [rawDebts, debtEvents, baseCurrency, rates]
  );

  const owedDebts = useMemo(() => allDebts.filter((d) => d.direction === 'owe'), [allDebts]);
  const receivableDebts = useMemo(() => allDebts.filter((d) => d.direction === 'receivable'), [allDebts]);

  const netPosition = totalReceivable - totalOwe;
  const hasAny = allDebts.length > 0;

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Debt & Receivables</div>
        <h1 className="font-display text-4xl">Position</h1>
      </motion.section>

      {/* Net position hero */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className={`surface border rounded-2xl p-5 mb-4 ${
          netPosition < 0 ? 'border-accent-expense/30' :
          netPosition > 0 ? 'border-accent-income/30' : ''
        }`}>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Net position</div>
          {!hasAny && (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent-income font-medium">
              <Check size={12} /> Clean slate
            </span>
          )}
        </div>
        <div className={`font-display text-5xl num ${
          netPosition < 0 ? 'text-accent-expense' :
          netPosition > 0 ? 'text-accent-income'  : ''
        }`}>
          {netPosition >= 0 ? '+' : '−'}{formatMoney(Math.abs(netPosition), baseCurrency)}
        </div>
        {hasAny && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <div className="text-muted">You owe</div>
              <div className="font-medium num text-accent-expense">{formatMoney(totalOwe, baseCurrency)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted">Owed to you</div>
              <div className="font-medium num text-accent-income">{formatMoney(totalReceivable, baseCurrency)}</div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Help block — replaces the old add buttons */}
      <motion.div {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.08 }}
        className="rounded-2xl border border-dashed border-[var(--border)] p-4 mb-5 bg-[var(--bg)]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center shrink-0">
            <Info size={14} className="text-muted" />
          </div>
          <div className="flex-1">
            <div className="text-[12px] font-medium mb-1">Recording new debts</div>
            <div className="text-[11px] text-muted leading-relaxed">
              Use the + button (QuickAdd) and pick category:
              <br />• <span className="text-accent-income font-medium">Borrowed</span> (income) — money you took on loan, lands in Holding
              <br />• <span className="text-accent-expense font-medium">Lent</span> (expense) — money you loaned out, debits a bucket
              <br />Debt entries appear here automatically.
            </div>
          </div>
        </div>
      </motion.div>

      {/* You owe section */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }} className="mb-5">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-expense/10 text-accent-expense flex items-center justify-center">
              <ArrowUpRight size={14} />
            </div>
            <h2 className="font-display text-2xl">You owe</h2>
          </div>
          <span className="text-[11px] text-muted">{owedDebts.length}</span>
        </div>

        {owedDebts.length === 0 ? (
          <div className="surface border rounded-2xl p-6 text-center">
            <div className="text-sm text-muted">Nothing owed. Keep it that way.</div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {owedDebts.map((d, idx) => (
                <DebtRow key={d.id} debt={d} idx={idx} baseCurrency={baseCurrency} rates={rates}
                  onDelete={() => removeDebt(d.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {/* Owed to you section */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.13 }} className="mb-5">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-income/10 text-accent-income flex items-center justify-center">
              <ArrowDownLeft size={14} />
            </div>
            <h2 className="font-display text-2xl">Owed to you</h2>
          </div>
          <span className="text-[11px] text-muted">{receivableDebts.length}</span>
        </div>

        {receivableDebts.length === 0 ? (
          <div className="surface border rounded-2xl p-6 text-center">
            <div className="text-sm text-muted">No outstanding receivables.</div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {receivableDebts.map((d, idx) => (
                <DebtRow key={d.id} debt={d} idx={idx} baseCurrency={baseCurrency} rates={rates}
                  onDelete={() => removeDebt(d.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>
    </main>
  );
}

function DebtRow({ debt, idx, baseCurrency, rates, onDelete }) {
  const recordRepayment = useStore((s) => s.recordRepayment);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { remaining, remainingBase, repaid, events = [], direction } = debt;
  const pct = debt.principal > 0 ? repaid / debt.principal : 0;
  const isPaid = remaining <= 0;
  const isReceivable = direction === 'receivable';

  const submit = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    recordRepayment(debt.id, v);
    setAmount(''); setPaying(false);
  };

  const dueText = debt.dueDate
    ? new Date(debt.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const isOverdue = debt.dueDate && new Date(debt.dueDate) < new Date() && !isPaid;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ delay: idx * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`surface border rounded-2xl p-4 ${isPaid ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium truncate">{debt.creditor}</h3>
            {isPaid && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-income/10 text-accent-income font-medium">{isReceivable ? 'COLLECTED' : 'PAID'}</span>}
            {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-expense/10 text-accent-expense font-medium">OVERDUE</span>}
          </div>
          {debt.notes && <p className="text-[11px] text-muted mt-0.5 truncate">{debt.notes}</p>}
          {dueText && <p className="text-[11px] text-muted mt-0.5">Due {dueText}</p>}
        </div>
        <button onClick={onDelete}
          className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className={`font-display text-2xl num ${!isPaid ? (isReceivable ? 'text-accent-income' : 'text-accent-expense') : ''}`}>
            {formatMoney(remaining, debt.currency)}
          </div>
          {debt.currency !== baseCurrency && (
            <div className="text-[11px] text-muted num">≈ {formatMoney(remainingBase, baseCurrency)}</div>
          )}
        </div>
        <div className="text-right text-[11px] text-muted num">
          <div>{Math.round(pct * 100)}% {isReceivable ? 'collected' : 'repaid'}</div>
          <div>of {formatMoney(debt.principal, debt.currency)}</div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden mb-3">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.7 }}
          className="h-full bg-accent-income rounded-full" />
      </div>

      {!isPaid && (
        <>
          <div className="flex gap-2">
            <button onClick={() => setPaying((v) => !v)}
              className="flex-1 text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors">
              {paying ? 'Cancel' : (isReceivable ? 'Record receipt' : 'Record repayment')}
            </button>
            {events.length > 0 && (
              <button onClick={() => setShowHistory((v) => !v)}
                className="px-3 text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors">
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </button>
            )}
          </div>
          <AnimatePresence>
            {paying && (
              <motion.form
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                onSubmit={submit} className="overflow-hidden"
              >
                <div className="pt-3 flex items-center gap-2">
                  <input type="number" step="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Amount (${debt.currency})`}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm num focus:ring-2 focus:ring-[var(--border)]" />
                  <button type="submit" disabled={!amount || parseFloat(amount) <= 0}
                    className="px-4 py-2 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
                    {isReceivable ? 'Receive' : 'Pay'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </>
      )}

      {(isPaid || events.length > 0) && (showHistory || isPaid) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-[var(--border)] space-y-1.5"
        >
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
            {isReceivable ? 'Receipt history' : 'Payment history'}
          </div>
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between text-[11px] num">
              <span className="text-muted">
                {new Date(ev.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-accent-income">−{formatMoney(ev.amount, ev.currency)}</span>
                <span className="text-muted">→ {formatMoney(ev.balanceAfter, ev.currency)} left</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {!isPaid && events.length > 0 && !showHistory && (
        <button onClick={() => setShowHistory(true)} className="w-full text-[11px] text-muted hover:text-[var(--text)] mt-2">
          Show history
        </button>
      )}
    </motion.div>
  );
}
