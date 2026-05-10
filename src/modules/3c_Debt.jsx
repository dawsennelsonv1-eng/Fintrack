// src/modules/Debt.jsx
// ROUND B — REPLACE the entire file with this version.
//
// What's new:
//   • Two sections: "You owe" (direction='owe') and "Owed to you" (direction='receivable')
//   • Net position indicator at the top
//   • AddDebtSheet now has a direction toggle
//   • New "Lend money" flow with source bucket picker (deducts from chosen bucket)
//   • Existing creditors with no `direction` value default to 'owe' (legacy safe)

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, Check, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import {
  useStore,
  selectDebts, selectDebtEvents, selectBaseCurrency, selectRates, selectBuckets,
  computeDebtsWithStatus,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

export default function DebtModule() {
  const rawDebts     = useStore(selectDebts);
  const debtEvents   = useStore(selectDebtEvents);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);
  const removeDebt   = useStore((s) => s.removeDebt);

  // Compute debts with status, then split by direction
  const allDebts = useMemo(
    () => computeDebtsWithStatus(rawDebts, debtEvents, baseCurrency, rates),
    [rawDebts, debtEvents, baseCurrency, rates]
  );

  const owed = useMemo(
    () => allDebts.filter((d) => (d.direction || 'owe') === 'owe'),
    [allDebts]
  );
  const receivable = useMemo(
    () => allDebts.filter((d) => d.direction === 'receivable'),
    [allDebts]
  );

  const totalOwedBase = useMemo(
    () => owed.reduce((sum, d) => sum + (d.remaining > 0 ? d.remainingBase : 0), 0),
    [owed]
  );
  const totalReceivableBase = useMemo(
    () => receivable.reduce((sum, d) => sum + (d.remaining > 0 ? d.remainingBase : 0), 0),
    [receivable]
  );
  const netPosition = totalReceivableBase - totalOwedBase;

  const [adding, setAdding] = useState(false);
  const [addingDirection, setAddingDirection] = useState('owe');

  const openAdd = (direction) => {
    setAddingDirection(direction);
    setAdding(true);
  };

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Debt & Liabilities</div>
        <h1 className="font-display text-4xl">Reality check</h1>
      </motion.section>

      {/* Net position hero */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className={`surface border rounded-2xl p-5 mb-4 ${
          netPosition < 0 ? 'border-accent-expense/30' :
          netPosition > 0 ? 'border-accent-income/30' : ''
        }`}>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Net position</div>
          {netPosition === 0 && (owed.length > 0 || receivable.length > 0) && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted font-medium">
              Even
            </span>
          )}
        </div>
        <div className={`font-display text-5xl num ${
          netPosition < 0 ? 'text-accent-expense' :
          netPosition > 0 ? 'text-accent-income' : ''
        }`}>
          {netPosition < 0 ? '−' : netPosition > 0 ? '+' : ''}
          {formatMoney(Math.abs(netPosition), baseCurrency)}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-[var(--bg)] rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted font-semibold mb-1">
              <ArrowUpRight size={11} className="text-accent-expense" /> You owe
            </div>
            <div className="font-display text-xl num text-accent-expense">
              {formatMoney(totalOwedBase, baseCurrency)}
            </div>
            <div className="text-[10px] text-muted mt-0.5">{owed.filter(d => d.remaining > 0).length} creditor{owed.filter(d => d.remaining > 0).length === 1 ? '' : 's'}</div>
          </div>
          <div className="bg-[var(--bg)] rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted font-semibold mb-1">
              <ArrowDownLeft size={11} className="text-accent-income" /> Owed to you
            </div>
            <div className="font-display text-xl num text-accent-income">
              {formatMoney(totalReceivableBase, baseCurrency)}
            </div>
            <div className="text-[10px] text-muted mt-0.5">{receivable.filter(d => d.remaining > 0).length} debtor{receivable.filter(d => d.remaining > 0).length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </motion.section>

      {/* You owe */}
      <DebtSection
        title="You owe"
        emptyTitle="Debt-free here"
        emptySubtitle="Nothing owed to anyone."
        debts={owed}
        baseCurrency={baseCurrency}
        rates={rates}
        onRemove={removeDebt}
        onAdd={() => openAdd('owe')}
        addLabel="Record debt"
        delay={0.1}
      />

      {/* Owed to you */}
      <DebtSection
        title="Owed to you"
        emptyTitle="Nothing out yet"
        emptySubtitle="Money lent will show here."
        debts={receivable}
        baseCurrency={baseCurrency}
        rates={rates}
        onRemove={removeDebt}
        onAdd={() => openAdd('receivable')}
        addLabel="Record loan out"
        delay={0.15}
      />

      <AddDebtSheet
        open={adding}
        direction={addingDirection}
        onClose={() => setAdding(false)}
      />
    </main>
  );
}

function DebtSection({ title, emptyTitle, emptySubtitle, debts, baseCurrency, rates, onRemove, onAdd, addLabel, delay }) {
  const active = debts.filter((d) => d.remaining > 0);
  const settled = debts.filter((d) => d.remaining <= 0);

  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay }} className="mb-5">
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="font-display text-2xl">{title}</h2>
        <span className="text-[11px] text-muted">{active.length}{settled.length > 0 ? ` · ${settled.length} settled` : ''}</span>
      </div>

      {debts.length === 0 ? (
        <div className="surface border rounded-2xl p-6 text-center mb-3">
          <Check size={24} className="mx-auto text-muted mb-2" strokeWidth={1.5} />
          <div className="font-display text-lg mb-0.5">{emptyTitle}</div>
          <div className="text-[12px] text-muted">{emptySubtitle}</div>
        </div>
      ) : (
        <div className="space-y-3 mb-3">
          <AnimatePresence>
            {active.map((d, idx) => (
              <DebtRow key={d.id} debt={d} idx={idx} baseCurrency={baseCurrency} rates={rates}
                onDelete={() => onRemove(d.id)} />
            ))}
            {settled.map((d, idx) => (
              <DebtRow key={d.id} debt={d} idx={active.length + idx} baseCurrency={baseCurrency} rates={rates}
                onDelete={() => onRemove(d.id)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <button onClick={onAdd}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-muted hover:text-[var(--text)] hover:border-[var(--text)] transition-colors flex items-center justify-center gap-2 text-sm">
        <Plus size={15} /> {addLabel}
      </button>
    </motion.section>
  );
}

function DebtRow({ debt, idx, baseCurrency, rates, onDelete }) {
  const recordRepayment = useStore((s) => s.recordRepayment);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const direction = debt.direction || 'owe';
  const isReceivable = direction === 'receivable';
  const { remaining, remainingBase, repaid, events = [] } = debt;
  const pct = debt.principal > 0 ? repaid / debt.principal : 0;
  const isPaid = remaining <= 0;

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

  // Visual tone differs by direction
  const accentClass = isPaid
    ? ''
    : isReceivable ? 'text-accent-income' : 'text-accent-expense';
  const badgeText = isPaid ? 'SETTLED' : (isReceivable ? 'OWED TO YOU' : 'OWE');
  const badgeClass = isPaid
    ? 'bg-accent-income/10 text-accent-income'
    : isReceivable
      ? 'bg-accent-income/10 text-accent-income'
      : 'bg-accent-expense/10 text-accent-expense';
  const repayLabel = isReceivable ? 'Record receipt' : 'Record repayment';
  const repayCta = isReceivable ? 'Receive' : 'Pay';

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
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{badgeText}</span>
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
          <div className={`font-display text-2xl num ${accentClass}`}>
            {formatMoney(remaining, debt.currency)}
          </div>
          {debt.currency !== baseCurrency && (
            <div className="text-[11px] text-muted num">≈ {formatMoney(remainingBase, baseCurrency)}</div>
          )}
        </div>
        <div className="text-right text-[11px] text-muted num">
          <div>{Math.round(pct * 100)}% {isReceivable ? 'received' : 'repaid'}</div>
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
              {paying ? 'Cancel' : repayLabel}
            </button>
            {events.length > 0 && (
              <button onClick={() => setShowHistory((v) => !v)}
                className="px-3 text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors">
                {events.length} payment{events.length === 1 ? '' : 's'}
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
                    {repayCta}
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
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Payment history</div>
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between text-[11px] num">
              <span className="text-muted">
                {new Date(ev.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-accent-income">{isReceivable ? '+' : '−'}{formatMoney(ev.amount, ev.currency)}</span>
                <span className="text-muted">→ {formatMoney(ev.balanceAfter, ev.currency)} left</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {!isPaid && events.length > 0 && !showHistory && (
        <button onClick={() => setShowHistory(true)} className="w-full text-[11px] text-muted hover:text-[var(--text)] mt-2">
          Show payment history
        </button>
      )}
    </motion.div>
  );
}

function AddDebtSheet({ open, direction, onClose }) {
  const borrowMoney = useStore((s) => s.borrowMoney);
  const lendMoney   = useStore((s) => s.lendMoney);
  const buckets     = useStore(selectBuckets);

  const [counterparty, setCounterparty] = useState('');
  const [principal, setPrincipal]       = useState('');
  const [currency, setCurrency]         = useState('USD');
  const [dueDate, setDueDate]           = useState('');
  const [notes, setNotes]               = useState('');
  const [sourceBucketKey, setSourceBucketKey] = useState('warChest');

  const isLending = direction === 'receivable';

  const submit = (e) => {
    e.preventDefault();
    if (!counterparty || !principal) return;
    const v = parseFloat(principal);
    if (!v || v <= 0) return;

    if (isLending) {
      lendMoney({
        to: counterparty, amount: v, currency,
        sourceBucketKey, dueDate: dueDate || '', notes,
      });
    } else {
      borrowMoney({
        from: counterparty, amount: v, currency,
        dueDate: dueDate || '', notes,
      });
    }

    setCounterparty(''); setPrincipal(''); setDueDate(''); setNotes('');
    setSourceBucketKey('warChest');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="px-5 pt-2 pb-6">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
                    {isLending ? 'Lend money' : 'Record debt'}
                  </div>
                  <h2 className="font-display text-2xl">
                    {isLending ? 'Money out' : 'Money in'}
                  </h2>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
              <p className="text-[11px] text-muted mb-5">
                {isLending
                  ? 'Money you lent out. Deducts from a chosen bucket; tracked until repaid.'
                  : 'Money you borrowed. Lands in Holding (un-allocated capital) — no auto-split.'}
              </p>

              <form onSubmit={submit} className="space-y-4">
                <input type="text" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
                  placeholder={isLending ? 'Who did you lend to?' : 'Who did you borrow from?'}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                  {Object.values(CURRENCIES).map((c) => (
                    <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                      className={`py-2 rounded-lg text-xs font-medium ${
                        currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                      }`}>
                      {c.code}
                    </button>
                  ))}
                </div>

                <div className="bg-[var(--bg)] rounded-2xl px-5 py-6 text-center">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Amount</div>
                  <div className="flex items-baseline justify-center gap-1">
                    {CURRENCIES[currency].prefix && (
                      <span className="font-display text-3xl text-muted">{CURRENCIES[currency].prefix}</span>
                    )}
                    <input type="number" inputMode="decimal" step="0.01" min="0"
                      value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0"
                      className="w-full max-w-[200px] bg-transparent outline-none font-display text-5xl text-center num" />
                    {CURRENCIES[currency].suffix && (
                      <span className="font-display text-3xl text-muted">{CURRENCIES[currency].suffix}</span>
                    )}
                  </div>
                </div>

                {/* Source bucket picker — only for lending */}
                {isLending && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                      Source bucket
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {buckets.map((b) => {
                        const sel = sourceBucketKey === b.key;
                        return (
                          <button
                            key={b.key} type="button"
                            onClick={() => setSourceBucketKey(b.key)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${
                              sel
                                ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                                : 'surface'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: b.color }}
                            />
                            <span className="text-[12px] font-medium truncate">{b.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted mt-2 px-1">
                      The lent amount will be deducted from this bucket.
                    </p>
                  </div>
                )}

                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

                <button type="submit" disabled={!counterparty || !principal}
                  className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40">
                  {isLending ? 'Record loan out' : 'Record debt'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
