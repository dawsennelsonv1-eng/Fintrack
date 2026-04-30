// src/components/TxActions.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatMoney } from '../lib/currency';

/**
 * Hook that wires up long-press to open an action sheet for a transaction.
 * Usage:
 *   const { bind, sheet } = useTxActions();
 *   <li {...bind(tx)}>...</li>
 *   {sheet}
 */
export function useTxActions() {
  const [target, setTarget] = useState(null); // { tx } or null
  const setEditingTx = useStore((s) => s.setEditingTx);
  const deleteTransaction = useStore((s) => s.deleteTransaction);

  const timer = useRef(null);
  const fired = useRef(false);

  const start = useCallback((tx) => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      // haptic-ish feedback via vibration if available
      if (navigator.vibrate) navigator.vibrate(15);
      setTarget({ tx });
    }, 450);
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const bind = (tx) => ({
    onTouchStart: () => start(tx),
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onTouchCancel: cancel,
    onMouseDown: () => start(tx),
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onContextMenu: (e) => {
      // Right-click on desktop opens the sheet too
      e.preventDefault();
      cancel();
      setTarget({ tx });
    },
  });

  const close = () => setTarget(null);

  const sheet = (
    <AnimatePresence>
      {target && (
        <ActionSheet
          tx={target.tx}
          onEdit={() => { setEditingTx(target.tx.id); close(); }}
          onDelete={() => { deleteTransaction(target.tx.id); close(); }}
          onClose={close}
        />
      )}
    </AnimatePresence>
  );

  return { bind, sheet };
}

function ActionSheet({ tx, onEdit, onDelete, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const isIncome = tx.type === 'income';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        <div className="px-5 pt-2 pb-5">
          {/* Preview of the tx */}
          <div className="flex items-baseline justify-between mb-4 pb-4 border-b border-[var(--border)]">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{tx.notes || tx.category}</div>
              <div className="text-[11px] text-muted mt-0.5">
                {tx.category} · {new Date(tx.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className={`font-medium num text-base ${isIncome ? 'text-accent-income' : 'text-accent-expense'}`}>
              {isIncome ? '+' : '−'}{formatMoney(Math.abs(tx.amount), tx.currency || 'USD')}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!confirming ? (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-2"
              >
                <button
                  onClick={onEdit}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-left active:scale-[0.99]"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--surface)] flex items-center justify-center">
                    <Pencil size={15} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Edit</div>
                    <div className="text-[11px] text-muted">Change amount, category, or note</div>
                  </div>
                </button>

                <button
                  onClick={() => setConfirming(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-accent-expense/10 hover:bg-accent-expense/15 transition-colors text-left active:scale-[0.99]"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent-expense/15 flex items-center justify-center text-accent-expense">
                    <Trash2 size={15} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-accent-expense">Delete</div>
                    <div className="text-[11px] text-accent-expense/70">Remove this transaction</div>
                  </div>
                </button>

                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 rounded-xl text-sm text-muted hover:text-[var(--text)]"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="text-sm">
                  <span className="font-medium">Delete this transaction?</span>
                  <p className="text-muted text-[12px] mt-1">You'll have a few seconds to undo.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="py-3 rounded-xl bg-[var(--bg)] text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onDelete}
                    className="py-3 rounded-xl bg-accent-expense text-white text-sm font-medium active:scale-[0.99]"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

/** Floating undo toast — auto-shows for 5s after a delete */
export function UndoToast() {
  const lastDeleted = useStore((s) => s.personal.lastDeleted);
  const undoDelete = useStore((s) => s.undoDelete);
  const clearLastDeleted = useStore((s) => s.clearLastDeleted);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!lastDeleted) return;
    setProgress(100);
    const start = Date.now();
    const duration = 5000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed >= duration) {
        clearInterval(interval);
        clearLastDeleted();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [lastDeleted, clearLastDeleted]);

  return (
    <AnimatePresence>
      {lastDeleted && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 surface border rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 pr-2">
            <Trash2 size={14} className="text-muted shrink-0" />
            <span className="text-sm">Transaction deleted</span>
            <button
              onClick={undoDelete}
              className="ml-1 px-3 py-1.5 rounded-lg bg-[var(--bg)] text-xs font-medium hover:bg-[var(--border)] transition-colors"
            >
              Undo
            </button>
            <button
              onClick={clearLastDeleted}
              className="w-7 h-7 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center text-muted"
            >
              <X size={13} />
            </button>
          </div>
          <div className="h-0.5 bg-[var(--border)]">
            <motion.div
              className="h-full bg-[var(--text)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.05 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
