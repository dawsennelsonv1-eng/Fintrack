
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
Trash2, Info, ArrowDownLeft, ArrowUpRight, Percent, Flame, Calendar as CalendarIcon, ExternalLink,
} from 'lucide-react';
import {
  useStore,
  selectDebts, selectDebtEvents, selectTotalDebtInBase, selectTotalReceivableInBase,
  selectBaseCurrency, selectRates, selectBorrowedDeployments,
  selectInvestments, selectVentures, selectVentureEvents, selectVentureDistributions,
selectTransactions, selectBudgetItems, selectBuckets, selectWallets,
computeDebtsWithStatus, computeDebtTrail, computeDebtPayoffPlan, computeBucketBalances,
} from '../store/useStore';
import { formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

function toDateKey(d) {
const dt = new Date(d);
if (isNaN(dt)) return new Date().toISOString().slice(0, 10);
const y = dt.getFullYear();
const m = String(dt.getMonth() + 1).padStart(2, '0');
const day = String(dt.getDate()).padStart(2, '0');
return `${y}-${m}-${day}`;
}

export default function DebtModule() {
  const rawDebts        = useStore(selectDebts);
  const debtEvents      = useStore(selectDebtEvents);
  const totalOwe        = useStore(selectTotalDebtInBase);
  const totalReceivable = useStore(selectTotalReceivableInBase);
  const baseCurrency    = useStore(selectBaseCurrency);
  const rates           = useStore(selectRates);
  const removeDebt      = useStore((s) => s.removeDebt);
  const borrowedDeployments = useStore(selectBorrowedDeployments);
  const investments     = useStore(selectInvestments);
  const ventures        = useStore(selectVentures);
  const ventureEvents   = useStore(selectVentureEvents);
  const ventureDists    = useStore(selectVentureDistributions);
const transactions    = useStore(selectTransactions);
const budgetItems     = useStore(selectBudgetItems);
const openCalendarOnDate = useStore((s) => s.openCalendarOnDate);
const setHighlightedTxId = useStore((s) => s.setHighlightedTxId);

const [strategy, setStrategy] = useState('snowball');
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const allDebts = useMemo(
    () => computeDebtsWithStatus(rawDebts, debtEvents, baseCurrency, rates),
    [rawDebts, debtEvents, baseCurrency, rates]
  );

const bucketBalances = useMemo(
() => computeBucketBalances(transactions, baseCurrency, rates),
[transactions, baseCurrency, rates]
);
const debtBucketBalance = bucketBalances.debtRepayment || 0;
const payoffPlan = useMemo(
() => computeDebtPayoffPlan(rawDebts, debtEvents, transactions, budgetItems, baseCurrency, rates, strategy),
[rawDebts, debtEvents, transactions, budgetItems, baseCurrency, rates, strategy]
);
  const owedDebts       = useMemo(() => allDebts.filter((d) => d.direction === 'owe'), [allDebts]);
  const receivableDebts = useMemo(() => allDebts.filter((d) => d.direction === 'receivable'), [allDebts]);
  const netPosition = totalReceivable - totalOwe;
  const hasAny = allDebts.length > 0;
const handleJumpToExpense = (ev) => {
if (ev.linkedTxId) {
setHighlightedTxId(ev.linkedTxId);
}
if (ev.date) {
openCalendarOnDate(toDateKey(ev.date), 'day');
}
};

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Debt & Receivables</div>
        <h1 className="font-display text-4xl">Position</h1>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className={`surface border rounded-2xl p-5 mb-4 ${
          netPosition < 0 ? 'border-accent-expense/30' :
          netPosition > 0 ? 'border-accent-income/30' : ''
        }`}>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Net position</div>
{totalOwe > 0 && (
<span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-expense/15 text-accent-expense font-semibold">
Danger Mode Active · 40% to Debt
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
<div className="mt-3 grid grid-cols-3 gap-2 text-[11px] pt-3 border-t border-[var(--border)]">
            <div>
              <div className="text-muted">You owe</div>
              <div className="font-medium num text-accent-expense">{formatMoney(totalOwe, baseCurrency)}</div>
</div>
<div>
<div className="text-muted">In 40% Debt Bucket</div>
<div className="font-medium num text-accent-income">{formatMoney(Math.max(0, debtBucketBalance), baseCurrency)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted">Owed to you</div>
              <div className="font-medium num text-accent-income">{formatMoney(totalReceivable, baseCurrency)}</div>
            </div>
          </div>
        )}
      </motion.section>

{/* Snowball vs Avalanche Optimizer */}
{payoffPlan.schedule.length > 0 && (
<motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.07 }}
className="surface border rounded-2xl p-4 mb-5">
<div className="flex items-center justify-between gap-2 mb-3">
<div className="flex items-center gap-2">
<Flame size={15} className="text-accent-expense" />
<div>
<div className="text-xs font-semibold">40% Debt Payoff Optimizer</div>
<div className="text-[10px] text-muted num">
Est. {formatCompact(payoffPlan.weeklyDebtPower, baseCurrency)}/wk ({formatCompact(payoffPlan.monthlyDebtPower, baseCurrency)}/mo) payoff power
</div>
</div>
</div>
<div className="flex gap-1 p-1 rounded-xl bg-[var(--bg)] text-[10px]">
{[
{ id: 'snowball',  label: 'Snowball (Smallest)' },
{ id: 'avalanche', label: 'Avalanche (Interest)' },
].map((s) => (
<button
key={s.id}
type="button"
onClick={() => setStrategy(s.id)}
className={`px-2 py-1 rounded-lg font-medium ${
strategy === s.id ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-muted'
}`}
>
{s.label}
</button>
))}
            </div>
          </div>
<div className="space-y-1.5">
{payoffPlan.schedule.map((item) => (
<div key={item.id} className="bg-[var(--bg)] rounded-xl px-3 py-2 flex items-center justify-between text-xs">
<div className="flex items-center gap-2 min-w-0">
<span className="w-5 h-5 rounded-full bg-accent-expense/15 text-accent-expense text-[10px] font-bold flex items-center justify-center shrink-0">
{item.order}
</span>
<span className="font-medium truncate">{item.creditor}</span>
</div>
<div className="text-right num shrink-0">
<span className="font-medium">{formatMoney(item.remaining, item.currency)}</span>
{item.weeksToClear && (
<span className="text-[10px] text-muted ml-2">· Cleared in ≈ {item.weeksToClear}w</span>
)}
</div>
</div>
))}
</div>
</motion.section>
)}

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
<div className="text-sm text-muted">Nothing owed. Normal Mode (50/30/10/5/5) unlocked!</div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {owedDebts.map((d, idx) => (
                <DebtRow
                  key={d.id} debt={d} idx={idx}
                  baseCurrency={baseCurrency} rates={rates}
                  borrowedDeployments={borrowedDeployments}
                  investments={investments}
                  ventures={ventures}
                  ventureEvents={ventureEvents}
                  ventureDistributions={ventureDists}
onJumpToExpense={handleJumpToExpense}
                  onDelete={() => removeDebt(d.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

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
                <DebtRow
                  key={d.id} debt={d} idx={idx}
                  baseCurrency={baseCurrency} rates={rates}
                  borrowedDeployments={borrowedDeployments}
                  investments={investments}
                  ventures={ventures}
                  ventureEvents={ventureEvents}
                  ventureDistributions={ventureDists}
onJumpToExpense={handleJumpToExpense}
                  onDelete={() => removeDebt(d.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.section>
    </main>
  );
}

function DebtRow({ debt, idx, baseCurrency, rates, onJumpToExpense, onDelete }) {
  const recordRepayment = useStore((s) => s.recordRepayment);
const buckets = useStore(selectBuckets);
const wallets = useStore(selectWallets);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [interestPaid, setInterestPaid] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
const [payBucket, setPayBucket] = useState('debtRepayment');
const [payWallet, setPayWallet] = useState(wallets[0]?.id || 'w_moncash');
const [showHistory, setShowHistory] = useState(true);

  const { remaining, remainingBase, repaid, events = [], direction, interestRate, accruedInterest, projectedPayback } = debt;
  const pct = debt.principal > 0 ? repaid / debt.principal : 0;
  const isPaid = remaining <= 0;
  const isReceivable = direction === 'receivable';


  const submit = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
if (!payDate) return;
    const i = parseFloat(interestPaid) || 0;

    const isoDate = new Date(`${payDate}T12:00:00`).toISOString();
recordRepayment(debt.id, v, {
interestPaid: i,
date: isoDate,
sourceBucketKey: payBucket,
walletId: payWallet,
});
    setAmount(''); setInterestPaid(''); setPaying(false);
  };

  const dueText = debt.dueDate
    ? new Date(debt.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const isOverdue = debt.dueDate && new Date(debt.dueDate) < new Date() && !isPaid;
  const hasInterest = (Number(interestRate) || 0) > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ delay: idx * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`surface border rounded-2xl p-4 ${isPaid ? 'opacity-60' : ''}`}

    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
{/* Debt Name + Inline "-$10 / -1,000 HTG" Repayment Badges referring to the Expense Transaction */}
          <div className="flex items-center gap-2 flex-wrap">
<h3 className="font-medium text-base truncate">{debt.creditor}</h3>
{/* Inline badges for repayments made, linking directly to the Expense on that date */}
{events.map((ev) => (
<button
key={ev.id}
type="button"
onClick={() => onJumpToExpense(ev)}
className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-expense/15 text-accent-expense text-[11px] font-semibold num hover:bg-accent-expense hover:text-white transition-colors"
title="Logged as Spending/Expense — tap to open that day's Spendings in Calendar"
>
<span>−{formatMoney(ev.amount, ev.currency)}</span>
<ExternalLink size={9} />
</button>
))}
            {isPaid && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-income/10 text-accent-income font-medium">{isReceivable ? 'COLLECTED' : 'PAID'}</span>}
            {isOverdue && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-expense/10 text-accent-expense font-medium">OVERDUE</span>}
            {hasInterest && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
<Percent size={9} />{interestRate}%
              </span>
            )}
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


      {hasInterest && !isPaid && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
          <div className="bg-[var(--bg)] rounded-lg px-3 py-2">
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">Accrued so far</div>
            <div className="font-medium num text-amber-700 dark:text-amber-400">
              {formatCompact(accruedInterest, debt.currency)}
            </div>
          </div>
          <div className="bg-[var(--bg)] rounded-lg px-3 py-2">
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">
              {debt.dueDate ? 'Projected at due' : 'Total payback'}
            </div>
            <div className="font-medium num">
              {formatCompact(projectedPayback, debt.currency)}
            </div>
          </div>
        </div>
      )}

      {!isPaid && (
        <>
          <div className="flex gap-2">
            <button onClick={() => setPaying((v) => !v)}
className="flex-1 text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors font-medium">
{paying ? 'Cancel' : (isReceivable ? 'Record receipt' : 'Pay debt (logs in Spendings)')}
            </button>

          </div>
          <AnimatePresence>
            {paying && (
              <motion.form
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                onSubmit={submit} className="overflow-hidden"
              >
                <div className="pt-3 space-y-2">
                  <input type="number" step="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)}
placeholder={`Amount paid (${debt.currency})`}
className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm num" />
<div className="grid grid-cols-2 gap-2">
<div className="flex items-center gap-1.5">
<label className="text-[10px] uppercase text-muted font-semibold">Date</label>
<input type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)}
className="flex-1 px-2.5 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs" />
</div>
<select value={payWallet} onChange={(e) => setPayWallet(e.target.value)}
className="px-2.5 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs">
{wallets.map((w) => (
<option key={w.id} value={w.id}>{w.name} ({w.currency})</option>
))}
</select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold whitespace-nowrap">
                      {isReceivable ? 'Into bucket' : 'From bucket'}
                    </label>
                    <select value={payBucket} onChange={(e) => setPayBucket(e.target.value)}
className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-xs">
                      {buckets.map((b) => (
<option key={b.key} value={b.key}>{b.name} ({b.percentage}%)</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={!amount || parseFloat(amount) <= 0 || !payDate}
className="w-full px-4 py-2.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium disabled:opacity-40">
{isReceivable ? 'Receive' : `Pay & Log −${amount || 0} ${debt.currency} in Spendings`}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </>
      )}

{events.length > 0 && showHistory && (
<div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1.5">
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
Linked Expense Repayments (tap to view in Calendar Spendings)
</div>
{events.map((ev) => (
<button
key={ev.id}
type="button"
onClick={() => onJumpToExpense(ev)}
className="w-full flex items-center justify-between text-[11px] num bg-[var(--bg)] hover:bg-[var(--border)]/60 rounded-lg px-2.5 py-1.5 transition-colors"
>
<span className="text-muted flex items-center gap-1.5">
<CalendarIcon size={10} />
{new Date(ev.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
<span className="text-[var(--text)] font-medium">· {ev.notes || `Paid ${debt.creditor}`}</span>
</span>
<div className="flex items-center gap-2">
<span className="text-accent-expense font-semibold">−{formatMoney(ev.amount, ev.currency)}</span>
<span className="text-muted">→ {formatMoney(ev.balanceAfter, ev.currency)} left</span>
</div>
</button>
))}
        </div>
      )}

    </motion.div>
  );
}
