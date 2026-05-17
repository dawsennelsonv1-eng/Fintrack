// src/modules/avs/Financials.jsx
// Tier 5f-finalize — AVS Financials hub v2
//
// Sub-tabs:
//   • Salaries — already LIVE from Tier 5f-salaries
//   • P&L      — LIVE in this tier (full revenue/cost breakdown)
//   • History  — LIVE (aggregated log of all AVS money events)
//   • Transfer — LIVE (cross-workspace transfer to/from Personal)
//   • Debts    — placeholder (deferred — see note)
//   • Expenses — placeholder (deferred — see note)
//
// Note: Debts and Expenses are deferred to keep this ship low-risk.
// They both require either Code.gs schema changes or careful filtering
// of Personal-store entities, and that's risky to batch with the live
// Transfer logic that writes across workspace stores.
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
import FinancialsPlaceholder from './financials/_Placeholder';

const TABS = [
  { id: 'salaries',  label: 'Salaries', icon: Users,         live: true },
  { id: 'pnl',       label: 'P&L',      icon: PieChart,      live: true },
  { id: 'history',   label: 'History',  icon: History,       live: true },
  { id: 'transfer',  label: 'Transfer', icon: ArrowLeftRight, live: true },
  { id: 'debts',     label: 'Debts',    icon: CreditCard,    live: false },
  { id: 'expenses',  label: 'Expenses', icon: Receipt,       live: false },
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
                {!t.live && (
                  <span
                    className="text-[9px] opacity-60"
                    style={{ color: isActive ? accent.primaryFg : 'var(--text-muted, #7a8a8c)' }}
                  >
                    soon
                  </span>
                )}
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
          {sub === 'salaries' && <Salaries />}
          {sub === 'pnl' && <PnL />}
          {sub === 'history' && <HistoryView />}
          {sub === 'transfer' && <Transfer />}
          {sub === 'debts' && (
            <FinancialsPlaceholder
              icon={CreditCard}
              title="Debts"
              tier="next"
              description="Money you owe (suppliers, Gemini Express) + money owed to you (client deposits). Deferred to next ship to avoid schema churn during testing window."
            />
          )}
          {sub === 'expenses' && (
            <FinancialsPlaceholder
              icon={Receipt}
              title="Operating expenses"
              tier="next"
              description="Internet, phone, rent — recurring business costs. Deferred to next ship; for now log via the bank-funded Personal expenses if needed."
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
