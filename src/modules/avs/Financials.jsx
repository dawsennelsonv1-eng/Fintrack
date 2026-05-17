// src/modules/avs/Financials.jsx
// Tier 5f-salaries — Financials hub
//
// Sub-tabs:
//   • Salaries — LIVE in this tier (commissions, payroll, content adherence)
//   • P&L      — placeholder (next tier)
//   • Debts    — placeholder (next tier, reuse Personal Debt module)
//   • Expenses — placeholder (next tier)
//   • History  — placeholder (next tier)
//   • Transfer — placeholder (cross-workspace, next tier)
//
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Receipt, History, ArrowLeftRight, PieChart, CreditCard,
} from 'lucide-react';
import { getWorkspace } from '../../workspaces/registry';
import Salaries from './financials/Salaries';
import FinancialsPlaceholder from './financials/_Placeholder';

const TABS = [
  { id: 'salaries',  label: 'Salaries', icon: Users,         live: true },
  { id: 'pnl',       label: 'P&L',      icon: PieChart,      live: false },
  { id: 'debts',     label: 'Debts',    icon: CreditCard,    live: false },
  { id: 'expenses',  label: 'Expenses', icon: Receipt,       live: false },
  { id: 'history',   label: 'History',  icon: History,       live: false },
  { id: 'transfer',  label: 'Transfer', icon: ArrowLeftRight, live: false },
];

export default function AvsFinancials() {
  const [sub, setSub] = useState('salaries');
  const accent = getWorkspace('avs').accent;
  const activeTab = TABS.find((t) => t.id === sub);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
      <div className="mb-4">
        <h1 className="font-display text-2xl leading-tight">Finances</h1>
        <p className="text-xs text-muted mt-0.5">AVS Solution HT — money in, money out</p>
      </div>

      {/* Sub-tab strip — horizontal scroll on phones */}
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

      {/* Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={sub}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {sub === 'salaries' && <Salaries />}
          {sub === 'pnl' && (
            <FinancialsPlaceholder
              icon={PieChart}
              title="Profit & Loss"
              tier="next"
              description="Period revenue − COGS − expenses − commissions = net profit. Toggle: month / quarter / year. Live data from your leads + ad spend + commissions."
            />
          )}
          {sub === 'debts' && (
            <FinancialsPlaceholder
              icon={CreditCard}
              title="Debts"
              tier="next"
              description="Money you owe (suppliers, Gemini Express, etc.) + money owed to you (client deposits, balances). Same component as Personal Debt module, scoped to AVS."
            />
          )}
          {sub === 'expenses' && (
            <FinancialsPlaceholder
              icon={Receipt}
              title="Operating expenses"
              tier="next"
              description="Recurring costs (internet, phone, rent) + one-off costs (equipment). Ad spend auto-pulled from Ads module. Recurring engine handles the monthly schedule."
            />
          )}
          {sub === 'history' && (
            <FinancialsPlaceholder
              icon={History}
              title="Transaction history"
              tier="next"
              description="Full log of all AVS money movements: card sales, commissions paid, expenses, transfers. Searchable, filterable, exportable to CSV."
            />
          )}
          {sub === 'transfer' && (
            <FinancialsPlaceholder
              icon={ArrowLeftRight}
              title="Cross-workspace transfer"
              tier="next"
              description="One button creates paired transactions: AVS → Personal (owner draw) or Personal → AVS (capital injection). Net worth stays correct across both workspaces."
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
