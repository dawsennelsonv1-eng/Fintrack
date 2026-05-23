// src/modules/recharge/Financials.jsx
//
// Four sub-tabs:
//   • P&L         — period-toggle profit math
//   • Commissions — Marc's 25% per Terminé order
//   • Payouts     — CEO payout cycle
//   • Attribution — Tag-based ROAS for Recharge ads
//
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Coins, Wallet, Target } from 'lucide-react';
import { getWorkspace } from '../../workspaces/registry';
import PnL from './financials/PnL';
import Commissions from './financials/Commissions';
import Payouts from './financials/Payouts';
import Attribution from './financials/Attribution';

const TABS = [
  { id: 'pnl',         label: 'P&L',         icon: PieChart },
  { id: 'commissions', label: 'Commissions', icon: Coins },
  { id: 'payouts',     label: 'Payouts',     icon: Wallet },
  { id: 'attribution', label: 'Attribution', icon: Target },
];

export default function RechargeFinancials() {
  const [sub, setSub] = useState('pnl');
  const accent = getWorkspace('recharge').accent;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
      <div className="mb-4">
        <h1 className="font-display text-2xl leading-tight">Finances</h1>
        <p className="text-xs text-muted mt-0.5">Recharge benefits, Marc payouts, your share</p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 mb-4">
        <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = sub === t.id;
            return (
              <button key={t.id} onClick={() => setSub(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  isActive ? '' : 'surface border text-muted'
                }`}
                style={isActive
                  ? { backgroundColor: accent.primary, color: accent.primaryFg }
                  : undefined}>
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={sub}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}>
          {sub === 'pnl'         && <PnL />}
          {sub === 'commissions' && <Commissions />}
          {sub === 'payouts'     && <Payouts />}
          {sub === 'attribution' && <Attribution />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
