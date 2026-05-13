// src/components/SpendingWarning.jsx
//
// Round E: shown by QuickAdd BEFORE saving an expense that routes
// into a bucket with active goals. Receives the computed impact
// from computeBucketImpact() in useStore.js.
//
// Props:
//   open: boolean
//   impact: { balance, balanceAfter, dailyInflow, delayDays, affectedGoals }
//   pendingTx: { amount, currency, category, ... }
//   bucketName, bucketColor
//   onConfirm(): user clicks "Confirm — Add $X expense"
//   onCancel():  user clicks Cancel (back to QuickAdd with fields intact)
//
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Target, Wallet, ArrowRight } from 'lucide-react';
import { formatMoney, formatCompact } from '../lib/currency';

function formatDelay(days) {
  if (days === null || days === undefined) return null;
  if (days < 1) return 'less than a day';
  if (days < 14) return `~${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `~${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'}`;
  return `~${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'}`;
}

export default function SpendingWarning({
  open, impact, pendingTx, bucketName, bucketColor, baseCurrency,
  onConfirm, onCancel,
}) {
  if (!impact) return null;

  const {
    balance = 0,
    balanceAfter = 0,
    delayDays = null,
    affectedGoals = [],
  } = impact;

  const goesNegative = balanceAfter < 0;
  const delayText = formatDelay(delayDays);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[71] surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>

            <div className="px-5 pt-2 pb-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
                    Heads up
                  </div>
                  <h2 className="font-display text-2xl leading-tight">Before you spend</h2>
                  <div className="text-[11px] text-muted mt-1.5 num">
                    {pendingTx?.category} · {formatMoney(pendingTx?.amount || 0, pendingTx?.currency || 'USD')}
                  </div>
                </div>
                <button
                  onClick={onCancel}
                  className="w-9 h-9 rounded-full hover:bg-[var(--bg)] flex items-center justify-center shrink-0"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Bucket impact */}
              <section className="mb-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1 flex items-center gap-1.5">
                  <Wallet size={11} /> Bucket impact
                </div>
                <div className="surface border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: bucketColor || '#7a8a8c' }}
                    />
                    <span className="text-[13px] font-medium">{bucketName}</span>
                    {goesNegative && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-accent-expense font-medium">
                        <AlertTriangle size={11} /> Goes negative
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 num">
                    <span className="text-[13px] text-muted">{formatMoney(balance, baseCurrency)}</span>
                    <ArrowRight size={12} className="text-muted shrink-0" />
                    <span className={`font-display text-2xl ${goesNegative ? 'text-accent-expense' : ''}`}>
                      {formatMoney(balanceAfter, baseCurrency)}
                    </span>
                    <span className="text-[10px] text-muted ml-1">left this month</span>
                  </div>
                </div>
              </section>

              {/* Goal impact */}
              {affectedGoals.length > 0 && (
                <section className="mb-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1 flex items-center gap-1.5">
                    <Target size={11} /> Goal impact
                  </div>
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    {affectedGoals.map((g) => {
                      const beforePct = g.target > 0 ? Math.min(1, g.filledBefore / g.target) : 0;
                      const afterPct  = g.target > 0 ? Math.min(1, g.filledAfter  / g.target) : 0;
                      const hasDeficit = g.deficit > 0;
                      const losingProgress = g.filledAfter < g.filledBefore;
                      return (
                        <div key={g.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Target size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-[13px] font-medium flex-1 truncate">{g.name}</span>
                            {g.wasReady && !g.stillReady && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
                                Not ready
                              </span>
                            )}
                          </div>
                          {/* Dual bar: before in muted, after overlaid */}
                          <div className="relative h-1.5 rounded-full bg-[var(--bg)] overflow-hidden mb-1.5">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full opacity-30"
                              style={{ width: `${beforePct * 100}%`, backgroundColor: bucketColor || '#d4a942' }}
                            />
                            <motion.div
                              initial={{ width: `${beforePct * 100}%` }}
                              animate={{ width: `${afterPct * 100}%` }}
                              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ backgroundColor: bucketColor || '#d4a942' }}
                            />
                          </div>
                          <div className="text-[11px] text-muted">
                            {hasDeficit ? (
                              <>
                                You'll be{' '}
                                <span className="font-medium text-amber-700 dark:text-amber-400 num">
                                  {formatMoney(g.deficit, baseCurrency)}
                                </span>{' '}
                                short of the {formatCompact(g.target, baseCurrency)} target
                                {delayText && (
                                  <> · delays goal by {delayText}</>
                                )}
                              </>
                            ) : losingProgress ? (
                              <>Goal still fundable, but progress drops</>
                            ) : (
                              <>Goal still on track</>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Buttons */}
              <div className="space-y-2">
                <button
                  onClick={onCancel}
                  className="w-full py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm flex items-center justify-center gap-2"
                >
                  Confirm — Add {formatMoney(pendingTx?.amount || 0, pendingTx?.currency || 'USD')} expense
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
