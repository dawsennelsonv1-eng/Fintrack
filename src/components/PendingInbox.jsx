// src/components/PendingInbox.jsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Check, SkipForward, X, Pencil, ArrowDownLeft, ArrowUpRight, Clock,
} from 'lucide-react';
import {
  useStore, selectPending, selectBaseCurrency, selectRates,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';
import DateTimePicker from './DateTimePicker';

/**
 * Pending Inbox — banner at top of Dashboard.
 * Shows when there are pending entries from recurring schedules.
 * Tap → opens review modal where user confirms/skips/edits each.
 */
export default function PendingInbox() {
  const pending = useStore(selectPending);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);
  const [open, setOpen] = useState(false);

  const sortedPending = useMemo(
    () => [...pending].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)),
    [pending]
  );

  if (sortedPending.length === 0) return null;

  // Compute total expected income/expense in base currency
  const totals = sortedPending.reduce(
    (acc, p) => {
      const v = convert(Math.abs(Number(p.amount) || 0), p.currency || 'USD', baseCurrency, rates);
      if (p.type === 'income') acc.income += v;
      if (p.type === 'expense') acc.expense += v;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        className="w-full surface border rounded-2xl p-4 mb-4 text-left hover:bg-[var(--bg)] transition-colors"
        style={{ borderColor: 'rgba(212, 169, 66, 0.4)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Inbox size={18} strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-sm">
                {sortedPending.length} pending {sortedPending.length === 1 ? 'entry' : 'entries'}
              </span>
              <span className="text-[10px] text-muted">tap to review</span>
            </div>
            <div className="text-[11px] text-muted mt-0.5 num">
              {totals.income > 0 && (
                <span className="text-accent-income mr-3">+{formatMoney(totals.income, baseCurrency)}</span>
              )}
              {totals.expense > 0 && (
                <span className="text-accent-expense">−{formatMoney(totals.expense, baseCurrency)}</span>
              )}
              {totals.income === 0 && totals.expense === 0 && (
                <span>Awaiting confirmation</span>
              )}
            </div>
          </div>
        </div>
      </motion.button>

      <PendingReviewModal
        open={open}
        pending={sortedPending}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// REVIEW MODAL
// ════════════════════════════════════════════════════════════════════
function PendingReviewModal({ open, pending, onClose }) {
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
                  <h2 className="font-display text-2xl">Pending entries</h2>
                  <div className="text-[11px] text-muted mt-0.5">
                    Confirm what actually happened
                  </div>
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              {pending.length === 0 ? (
                <div className="surface border rounded-2xl p-8 text-center">
                  <Check size={26} className="mx-auto text-accent-income mb-3" strokeWidth={2} />
                  <div className="font-display text-xl mb-1">All caught up</div>
                  <div className="text-sm text-muted">Nothing pending to review</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.map((p) => (
                    <PendingRow key={p.id} entry={p} />
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

// ════════════════════════════════════════════════════════════════════
// PENDING ROW with inline edit
// ════════════════════════════════════════════════════════════════════
function PendingRow({ entry }) {
  const confirmPending = useStore((s) => s.confirmPending);
  const skipPending = useStore((s) => s.skipPending);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);

  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(entry.dueAt);
  const [confirming, setConfirming] = useState(false);

  const isIncome = entry.type === 'income';
  const cfg = CURRENCIES[entry.currency] || CURRENCIES.USD;
  const inBase = convert(Math.abs(Number(entry.amount) || 0), entry.currency || 'USD', baseCurrency, rates);

  const dueDate = new Date(entry.dueAt);
  const now = new Date();
  const overdue = dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const confirm = () => {
    confirmPending(entry.id, {
      amount: editing ? parseFloat(amount) : entry.amount,
      date: editing ? date : entry.dueAt,
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="surface border rounded-xl overflow-hidden"
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isIncome ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
          }`}>
            {isIncome ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{entry.name}</div>
            <div className="text-[11px] text-muted truncate flex items-center gap-1">
              <Clock size={10} />
              {overdue ? <span className="text-amber-600 dark:text-amber-400">Due {formatDate(dueDate)}</span> : `Due ${formatDate(dueDate)}`}
              {entry.category && <> · {entry.category}</>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`font-medium num text-sm ${isIncome ? 'text-accent-income' : ''}`}>
              {isIncome ? '+' : '−'}{formatMoney(Math.abs(entry.amount), entry.currency)}
            </div>
            {entry.currency !== baseCurrency && (
              <div className="text-[10px] text-muted num">≈ {formatMoney(inBase, baseCurrency)}</div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!editing && !confirming && (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex gap-1.5 mt-3"
            >
              <button onClick={confirm}
                className="flex-1 py-2 rounded-lg bg-accent-income/10 text-accent-income text-xs font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5">
                <Check size={13} /> Confirm
              </button>
              <button onClick={() => setEditing(true)}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-xs font-medium transition-colors flex items-center gap-1.5">
                <Pencil size={12} /> Edit
              </button>
              <button onClick={() => setConfirming('skip')}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-xs font-medium transition-colors flex items-center gap-1.5">
                <SkipForward size={12} /> Skip
              </button>
            </motion.div>
          )}

          {editing && !confirming && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border)]">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Actual amount</div>
                  <div className="flex items-baseline gap-1 px-3 py-2.5 rounded-lg bg-[var(--bg)]">
                    <span className="text-muted text-sm">{cfg.prefix}</span>
                    <input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent outline-none num"
                      autoFocus
                    />
                    {cfg.suffix && <span className="text-muted text-sm">{cfg.suffix}</span>}
                  </div>
                </div>
                <DateTimePicker value={date} onChange={setDate} label="Actual date" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setEditing(false); setAmount(String(entry.amount)); setDate(entry.dueAt); }}
                    className="py-2.5 rounded-lg bg-[var(--bg)] text-sm font-medium">
                    Cancel
                  </button>
                  <button onClick={confirm}
                    className="py-2.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium">
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {confirming === 'skip' && (
            <motion.div
              key="confirm-skip"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-3 pt-3 border-t border-[var(--border)]"
            >
              <p className="text-[12px] text-muted mb-2">Skip this entry? It won't count as income/expense.</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirming(false)}
                  className="py-2 rounded-lg bg-[var(--bg)] text-xs font-medium">
                  Cancel
                </button>
                <button onClick={() => skipPending(entry.id)}
                  className="py-2 rounded-lg bg-accent-expense/10 text-accent-expense text-xs font-medium">
                  Skip
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function formatDate(d) {
  const now = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const ydy = new Date(); ydy.setDate(ydy.getDate() - 1);
  if (sameDay(d, now)) return `today, ${d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`;
  if (sameDay(d, ydy)) return `yesterday`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
