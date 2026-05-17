// src/components/CombinedWealthStrip.jsx
// Tier 5g — Combined wealth at-a-glance strip
//
// Renders below the Header, above the DebtPill. Shows:
//   • Personal net worth (cash buckets + investments + ventures + receivables - debts)
//   • AVS MTD profit (revenue - COGS - commissions - payroll - ad spend)
//
// Tapping either side switches workspaces and jumps to that workspace's
// Home/Dashboard for the breakdown.
//
// Hidden if BOTH sides are zero (fresh install). Tucks in cleanly.
//
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore, selectBaseCurrency, selectRates } from '../store/useStore';
import { convert, formatMoney } from '../lib/currency';
import { getWorkspace } from '../workspaces/registry';

const HTG_PER_USD = 150;

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth() {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ─── Net worth math (Personal) ─────────────────────────────
function computePersonalNetWorth(state, base, rates) {
  const p = state.personal || {};

  // Cash from bucket allocations across all transactions
  let cashBase = 0;
  (p.transactions || []).forEach((t) => {
    const allocs = t.buckets || {};
    Object.values(allocs).forEach((v) => {
      const n = Number(v) || 0;
      if (n !== 0) {
        cashBase += convert(n, t.currency || 'USD', base, rates);
      }
    });
  });

  // Investments
  let investmentsBase = 0;
  (p.investments || []).forEach((inv) => {
    const value = (Number(inv.units) || 0) * (Number(inv.currentPrice) || 0);
    investmentsBase += convert(value, inv.currency || 'USD', base, rates);
  });

  // Ventures
  let venturesBase = 0;
  (p.ventures || []).forEach((v) => {
    venturesBase += convert(
      Number(v.currentValuation) || 0,
      v.valuationCurrency || 'USD',
      base, rates
    );
  });

  // Debts (owe = negative, receivable = positive offset already in cash)
  let debtsBase = 0;
  (p.debts || []).forEach((d) => {
    if (d.status === 'paid') return;
    const repaid = (p.debtEvents || [])
      .filter((e) => e.debtId === d.id && e.type === 'repayment')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const remaining = (Number(d.principal) || 0) - repaid;
    if (remaining <= 0) return;
    const direction = d.direction || 'owe';
    if (direction === 'owe') {
      debtsBase -= convert(remaining, d.currency || 'USD', base, rates);
    } else {
      debtsBase += convert(remaining, d.currency || 'USD', base, rates);
    }
  });

  return cashBase + investmentsBase + venturesBase + debtsBase;
}

// ─── AVS MTD profit ────────────────────────────────────────
function computeAvsMtdProfit(state) {
  const b = state.business || {};
  const leads = b.leads || [];
  const commissions = b.staffCommissions || [];
  const payroll = b.staffPayroll || [];
  const adSpend = b.adSpend || [];
  const cardCosts = b.cardCosts || [];

  const from = startOfMonth();
  const to = endOfMonth();
  const inR = (d) => d && d >= from && d <= to;

  const cogsFor = (lead) => {
    const cost = cardCosts.find((c) =>
      String(c.typeCarte).toLowerCase() === String(lead.cardType).toLowerCase() &&
      String(c.pack).toLowerCase() === String(lead.pack).toLowerCase()
    );
    if (!cost) return 0;
    return cost.currency === 'USD'
      ? (Number(cost.supplierCost) || 0) * HTG_PER_USD
      : (Number(cost.supplierCost) || 0);
  };

  let revenue = 0, cogs = 0;
  leads.forEach((l) => {
    if (l.leadStatus !== '✅ Terminé') return;
    const paid = parseDate(l.datePaidFull) || parseDate(l.date);
    if (!inR(paid)) return;
    revenue += Number(l.totalPrice) || 0;
    cogs += cogsFor(l);
  });

  let commissionsPaid = 0;
  commissions.forEach((c) => {
    if (c.status !== 'paid') return;
    const d = parseDate(c.paidDate);
    if (inR(d)) commissionsPaid += Number(c.commissionAmount) || 0;
  });

  let payrollPaid = 0;
  payroll.forEach((p) => {
    if (p.status !== 'paid') return;
    const d = parseDate(p.paidDate);
    if (!inR(d)) return;
    const amtHTG = p.currency === 'USD'
      ? (Number(p.amount) || 0) * HTG_PER_USD
      : (Number(p.amount) || 0);
    payrollPaid += amtHTG;
  });

  let adSpendTotal = 0;
  adSpend.forEach((a) => {
    const d = parseDate(a.date);
    if (!inR(d)) return;
    const amtHTG = a.spendCurrency === 'USD'
      ? (Number(a.spendAmount) || 0) * HTG_PER_USD
      : (Number(a.spendAmount) || 0);
    adSpendTotal += amtHTG;
  });

  return revenue - cogs - commissionsPaid - payrollPaid - adSpendTotal;
}

// ════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function CombinedWealthStrip() {
  const workspace = useStore((s) => s.app.workspace);
  const setWorkspace = useStore((s) => s.setWorkspace);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);

  // Compute both metrics — pull the whole state for the calc
  const personalNetWorth = useStore((s) => computePersonalNetWorth(s, baseCurrency, rates));
  const avsMtdProfit = useStore((s) => computeAvsMtdProfit(s));

  // Hide entirely if both are zero
  if (Math.abs(personalNetWorth) < 0.01 && Math.abs(avsMtdProfit) < 0.01) {
    return null;
  }

  const avsAccent = getWorkspace('avs').accent;
  const personalActive = workspace === 'personal';
  const avsActive = workspace === 'avs';

  const handleJump = (target) => {
    if (target === workspace) {
      setActiveTab('dashboard');
      return;
    }
    setWorkspace(target);
    setActiveTab('dashboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full surface border rounded-2xl overflow-hidden flex"
    >
      {/* Personal side */}
      <button
        onClick={() => handleJump('personal')}
        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left min-w-0"
        style={personalActive ? { backgroundColor: 'var(--bg)' } : undefined}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#1a1a1a', color: '#fffaf2' }}
        >
          <Wallet size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-muted font-semibold leading-none">
            Net worth
          </div>
          <div
            className="font-display text-base leading-tight num mt-0.5 truncate"
            style={{ color: personalNetWorth >= 0 ? 'var(--text)' : '#c2452f' }}
          >
            {formatMoney(Math.abs(personalNetWorth), baseCurrency, { decimals: 0 })}
          </div>
        </div>
      </button>

      {/* Divider */}
      <div className="w-px bg-[var(--border)] my-2" />

      {/* AVS side */}
      <button
        onClick={() => handleJump('avs')}
        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left min-w-0"
        style={avsActive ? { backgroundColor: 'var(--bg)' } : undefined}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: avsAccent.primary, color: avsAccent.primaryFg }}
        >
          <Briefcase size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted font-semibold leading-none">
            AVS MTD
            {avsMtdProfit > 0 ? (
              <TrendingUp size={9} style={{ color: '#3d8b5f' }} />
            ) : avsMtdProfit < 0 ? (
              <TrendingDown size={9} style={{ color: '#c2452f' }} />
            ) : null}
          </div>
          <div
            className="font-display text-base leading-tight num mt-0.5 truncate"
            style={{
              color: avsMtdProfit > 0 ? '#3d8b5f'
                : avsMtdProfit < 0 ? '#c2452f'
                : 'var(--text)',
            }}
          >
            {avsMtdProfit >= 0 ? '+' : '−'}
            {fmtCompact(Math.abs(avsMtdProfit))} HTG
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function fmtCompact(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
