// src/components/QuickAdd.jsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  useStore, selectRates, selectBaseCurrency, selectEditingTxId, selectTransactions,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney } from '../lib/currency';

const CATEGORIES = {
  expense: ['Food & Dining', 'Transport', 'Housing', 'Health', 'Entertainment', 'Subscriptions', 'Shopping', 'Education', 'Other'],
  income:  ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'],
};

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState(CATEGORIES.expense[0]);
  const [notes, setNotes] = useState('');
  const amountRef = useRef(null);

  const addTransaction = useStore((s) => s.addTransaction);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const setEditingTx = useStore((s) => s.setEditingTx);
  const editingId = useStore(selectEditingTxId);
  const transactions = useStore(selectTransactions);
  const rates = useStore(selectRates);
  const baseCurrency = useStore(selectBaseCurrency);

  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : null;
  const isEditing = !!editingTx;

  // Open the sheet automatically when an edit is requested
  useEffect(() => {
    if (editingTx) {
      setType(editingTx.type);
      setAmount(String(editingTx.amount));
      setCurrency(editingTx.currency || 'USD');
      setCategory(editingTx.category);
      setNotes(editingTx.notes || '');
      setOpen(true);
    }
  }, [editingId]);

  useEffect(() => { if (!isEditing) setCategory(CATEGORIES[type][0]); }, [type, isEditing]);
  useEffect(() => {
    if (open && !isEditing) setTimeout(() => amountRef.current?.focus(), 250);
  }, [open, isEditing]);
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const reset = () => {
    setAmount(''); setNotes(''); setType('expense'); setCurrency('USD');
    setCategory(CATEGORIES.expense[0]);
  };

  const closeSheet = () => {
    setOpen(false);
    if (isEditing) setEditingTx(null);
    setTimeout(reset, 250);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return;

    if (isEditing) {
      updateTransaction(editingTx.id, {
        amount: value, currency, category, type, notes: notes.trim(),
      });
    } else {
      addTransaction({
        amount: value, currency, category, type, notes: notes.trim(),
        date: new Date().toISOString(),
      });
    }
    closeSheet();
  };

  const previewBase = amount && currency !== baseCurrency
    ? convert(parseFloat(amount) || 0, currency, baseCurrency, rates)
    : null;

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-2xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 shadow-2xl shadow-black/30 flex items-center justify-center"
        aria-label="Add transaction"
      >
        <Plus size={22} strokeWidth={2.25} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeSheet}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) closeSheet();
              }}
              className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
              </div>

              <div className="px-5 pt-2 pb-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-2xl">
                    {isEditing ? 'Edit entry' : 'New entry'}
                  </h2>
                  <button
                    onClick={closeSheet}
                    className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                    <button
                      type="button" onClick={() => setType('expense')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        type === 'expense' ? 'bg-[var(--surface)] shadow-sm text-accent-expense' : 'text-muted'
                      }`}
                    >
                      <ArrowUpRight size={15} /> Expense
                    </button>
                    <button
                      type="button" onClick={() => setType('income')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        type === 'income' ? 'bg-[var(--surface)] shadow-sm text-accent-income' : 'text-muted'
                      }`}
                    >
                      <ArrowDownLeft size={15} /> Income
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                    {Object.values(CURRENCIES).map((c) => (
                      <button
                        key={c.code} type="button" onClick={() => setCurrency(c.code)}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                          currency === c.code
                            ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]'
                            : 'text-muted'
                        }`}
                      >
                        <span className="font-display mr-1">{c.symbol}</span> {c.code}
                      </button>
                    ))}
                  </div>

                  <div className="bg-[var(--bg)] rounded-2xl px-5 py-6 text-center">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Amount</div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-display text-3xl text-muted">{CURRENCIES[currency].prefix}</span>
                      <input
                        ref={amountRef} type="number" inputMode="decimal" step="0.01" min="0"
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full max-w-[200px] bg-transparent outline-none font-display text-5xl text-center num"
                      />
                      {CURRENCIES[currency].suffix && (
                        <span className="font-display text-3xl text-muted">{CURRENCIES[currency].suffix}</span>
                      )}
                    </div>
                    {previewBase !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-muted mt-2 num"
                      >
                        ≈ {formatMoney(previewBase, baseCurrency)}
                      </motion.div>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 px-1">Category</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES[type].map((c) => (
                        <button
                          key={c} type="button" onClick={() => setCategory(c)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            category === c
                              ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                              : 'border-[var(--border)] text-muted hover:text-[var(--text)]'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note (optional)"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-[var(--border)]"
                  />

                  <button
                    type="submit" disabled={!amount || parseFloat(amount) <= 0}
                    className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                  >
                    {isEditing ? 'Save changes' : 'Save entry'}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
