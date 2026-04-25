// src/components/DebtPill.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useStore, selectTotalDebtInBase, selectBaseCurrency } from '../store/useStore';
import { formatMoney } from '../lib/currency';

export default function DebtPill() {
  const total = useStore(selectTotalDebtInBase);
  const baseCurrency = useStore(selectBaseCurrency);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const acknowledged = useStore((s) => s.app.debtAcknowledged);
  const acknowledge = useStore((s) => s.acknowledgeDebt);

  if (total <= 0) return null;

  const handleClick = () => {
    acknowledge();
    setActiveTab('debt');
  };

  return (
    <AnimatePresence>
      <motion.button
        layout
        onClick={handleClick}
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="group relative w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-accent-expense/10 border border-accent-expense/20 hover:bg-accent-expense/15 active:scale-[0.99] transition-all"
      >
        {!acknowledged && (
          <motion.span
            className="absolute inset-0 rounded-xl bg-accent-expense/15"
            animate={{ opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <div className="relative flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-expense/20 flex items-center justify-center">
            <AlertCircle size={14} className="text-accent-expense" strokeWidth={2.25} />
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-[0.14em] text-accent-expense font-semibold leading-none">
              Outstanding Debt
            </div>
            <div className="text-[11px] text-muted leading-none mt-1">
              Tap to review
            </div>
          </div>
        </div>
        <div className="relative font-display text-xl text-accent-expense num">
          {formatMoney(total, baseCurrency, { decimals: 2 })}
        </div>
      </motion.button>
    </AnimatePresence>
  );
}
