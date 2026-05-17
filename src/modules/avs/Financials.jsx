// src/modules/avs/Financials.jsx
// Tier 5f-final — all 6 sub-tabs live
//
// Sub-tabs:
//   • Salaries — LIVE (5f-salaries)
//   • P&L      — LIVE (5f-final v1)
//   • Debts    — LIVE NOW (Tier 5f-final v2)
//   • Expenses — LIVE NOW (Tier 5f-final v2)
//   • History  — LIVE (5f-final v1)
//   • Transfer — LIVE (5f-final v1)
//
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Receipt, History, ArrowLeftRight, PieChart, CreditCard,
} from 'lucide-react';
import { getWorkspace } from '../../workspaces/registry';
import Salaries from './financials/Salaries';
import PnL from './financials/PnL';
import HistoryView from './financials/History';
import Transfer from './financials/Transfer';
import Debts from './financials/Debts';
import Expenses from './financials/Expenses';

const TABS = [
  { id: 'salaries',  label: 'Salaries', icon: Users },
  { id: 'pnl',       label: 'P&L',      icon: PieChart },
  { id: 'debts',     label: 'Debts',    icon: CreditCard },
  { id: 'expenses',  label: 'Expenses', icon: Receipt },
  { id: 'history',   label: 'History',  icon: History },
  { id: 'transfer',  label: 'Transfer', icon: ArrowLeftRight },
];

export default function AvsFinancials() {
  const [sub, setSub] = useState('salaries');
  const accent = getWorkspace('avs').accent;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
      <div className="mb-4">
        <h1 className="font-display text-2xl leading-tight">Finances</h1>
        <p className="text-xs text-muted mt-0.5">AVS Solution HT — money in, money out</p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 mb-4">
        <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = sub === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSub(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  isActive ? '' : 'surface border text-muted'
                }`}
                style={
                  isActive
                    ? { backgroundColor: accent.primary, color: accent.primaryFg }
                    : undefined
                }
              >
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={sub}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {sub === 'salaries'  && <Salaries />}
          {sub === 'pnl'       && <PnL />}
          {sub === 'debts'     && <Debts />}
          {sub === 'expenses'  && <Expenses />}
          {sub === 'history'   && <HistoryView />}
          {sub === 'transfer'  && <Transfer />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
