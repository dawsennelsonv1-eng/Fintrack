// src/modules/Debt.jsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Trash2, AlertCircle, Check } from 'lucide-react';
import {
  useStore,
  selectDebts, selectTotalDebtInBase, selectBaseCurrency, selectRates,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

export default function DebtModule() {
  const debts        = useStore(selectDebts);
  const totalDebt    = useStore(selectTotalDebtInBase);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);
  const removeDebt   = useStore((s) => s.removeDebt);

  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    let principal = 0, repaid = 0;
    for (const d of debts) {
      principal += convert(d.principal, d.currency, baseCurrency, rates);
      repaid    += convert(d.repaid,    d.currency, baseCurrency, rates);
    }
    return { principal, repaid, pct: principal > 0 ? repaid / principal : 0 };
  }, [debts, baseCurrency, rates]);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Debt & Liabilities</div>
        <h1 className="font-display text-4xl">Reality check</h1>
      </motion.section>

      {/* Hero */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className={`surface border rounded-2xl p-5 mb-4 ${totalDebt > 0 ? 'border-accent-expense/30' : ''}`}>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Outstanding</div>
          {totalDebt === 0 && debts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent-income font-medium">
              <Check size={12} /> All clear
            </span>
          )}
        </div>
        <div className={`font-display text-5xl num ${totalDebt > 0 ? 'text-accent-expense' : ''}`}>
          {formatMoney(totalDebt, baseCurrency)}
        </div>
        {debts.length > 0 && (
          <>
            <div className="mt-4 h-2 rounded-full bg-[var(--bg)] overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${totals.pct * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-accent-income rounded-full" />
            </div>
            <div className="flex justify-between text-[11px] text-muted mt-2 num">
              <span>Repaid · {formatMoney(totals.repaid, baseCurrency)}</span>
              <span>{Math.round(totals.pct * 100)}%</span>
              <span>Total · {formatMoney(totals.principal, baseCurrency)}</span>
            </div>
          </>
        )}
      </motion.section>

      {/* Debt list */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }} className="mb-4">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-2xl">Creditors</h2>
          <span className="text-[11px] text-muted">{debts.length}</span>
        </div>

        {debts.length === 0 ? (
          <div className="surface border rounded-2xl p-8 text-center">
            <Check size={28} className="mx-auto text-accent-income mb-3" strokeWidth={1.5} />
            <div className="font-display text-xl mb-1">Debt-free</div>
            <div className="text-sm text-muted">Nothing owed. Keep it that way.</div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {debts.map((d, idx) => (
                <DebtRow key={d.id} debt={d} idx={idx} baseCurrency={baseCurrency} rates={rates}
                  onDelete={() => removeDebt(d.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      <button onClick={() => setAdding(true)}
        className="w-full py-3.5 rounded-2xl border-2 border-dashed border-[var(--border)] text-muted hover:text-[var(--text)] hover:border-[var(--text)] transition-colors flex items-center justify-center gap-2 text-sm">
        <Plus size={16} /> Record new debt
      </button>

      <AddDebtSheet open={adding} onClose={() => setAdding(false)} />
    </main>
  );
}

function DebtRow({ debt, idx, baseCurrency, rates, onDelete }) {
  const recordRepayment = useStore((s) => s.recordRepayment);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');

  const remaining = debt.principal - debt.repaid;
  const pct = debt.principal > 0 ? debt.repaid / debt.principal : 0;
  const remainingBase = convert(remaining, debt.currency, baseCurrency, rates);
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ delay: idx * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`surface border rounded-2xl p-4 ${isPaid ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{debt.creditor}</h3>
            {isPaid && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-income/10 text-accent-income font-medium">PAID</span>}
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
          <div className={`font-display text-2xl num ${!isPaid ? 'text-accent-expense' : ''}`}>
            {formatMoney(remaining, debt.currency)}
          </div>
          {debt.currency !== baseCurrency && (
            <div className="text-[11px] text-muted num">≈ {formatMoney(remainingBase, baseCurrency)}</div>
          )}
        </div>
        <div className="text-right text-[11px] text-muted num">
          <div>{Math.round(pct * 100)}% repaid</div>
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
          <button onClick={() => setPaying((v) => !v)}
            className="w-full text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors">
            {paying ? 'Cancel' : 'Record repayment'}
          </button>
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
                    Pay
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function AddDebtSheet({ open, onClose }) {
  const addDebt = useStore((s) => s.addDebt);
  const [creditor, setCreditor] = useState('');
  const [principal, setPrincipal] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!creditor || !principal) return;
    addDebt({
      creditor, principal: parseFloat(principal), currency,
      dueDate: dueDate || null, notes,
    });
    setCreditor(''); setPrincipal(''); setDueDate(''); setNotes('');
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
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl">Record debt</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <input type="text" value={creditor} onChange={(e) => setCreditor(e.target.value)}
                  placeholder="Who is owed?"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

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
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Principal</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-3xl text-muted">{CURRENCIES[currency].symbol}</span>
                    <input type="number" inputMode="decimal" step="0.01" min="0"
                      value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0"
                      className="w-full max-w-[200px] bg-transparent outline-none font-display text-5xl text-center num" />
                  </div>
                </div>

                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

                <button type="submit" disabled={!creditor || !principal}
                  className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40">
                  Save
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
