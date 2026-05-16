// src/modules/avs/Financials.jsx
// Tier 5a placeholder. Real build in Tiers 5f + 5g.
//
// This is the consolidated finance hub. Inside Financials there will be
// secondary tabs:
//   • P&L      — current period revenue, COGS, expenses, net profit
//   • Debts    — money you owe (suppliers) + money owed to you (clients)
//   • Salaries — staff commissions earned/paid (Marc, Jémima, Christelle)
//   • Expenses — operating costs (internet, rent, etc)
//   • History  — full transaction log for AVS
//   • Transfer — cross-workspace transfer to/from Personal
//
import { Wallet } from 'lucide-react';
import Placeholder from './_Placeholder';

export default function AvsFinancials() {
  return (
    <Placeholder
      title="Finances"
      subtitle="P&L · Debts · Salaries · Expenses · History · Transfers"
      icon={Wallet}
      tier="5f"
      sections={[
        {
          title: 'Sub-tabs inside this screen',
          description: 'P&L · Debts · Salaries · Expenses · History · Transfer. Each is its own view.',
        },
        {
          title: 'P&L',
          description: 'Period revenue minus COGS (card supplier cost) minus expenses minus commissions = net profit. Toggle: this month / quarter / year.',
        },
        {
          title: 'Debts',
          description: 'Same component as Personal Debt module, scoped to AVS. Suppliers owed + unpaid client invoices.',
        },
        {
          title: 'Salaries',
          description: 'Marc, Jémima, Christelle commissions. Per-card and per-period totals. Mark as paid.',
        },
        {
          title: 'Operating expenses',
          description: 'Recurring: internet, phone, rent. One-off: equipment, ads (auto-pulled from Ads module).',
        },
        {
          title: 'History',
          description: 'Full transaction log for AVS. Searchable, filterable, exportable.',
        },
        {
          title: 'Cross-workspace transfer',
          description: 'One button creates paired tx: AVS → Personal (owner draw) or Personal → AVS (capital injection). Net worth stays correct.',
        },
      ]}
    />
  );
}
