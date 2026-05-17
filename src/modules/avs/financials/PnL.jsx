// src/modules/avs/financials/PnL.jsx
// Tier 5f-finalize — Full P&L breakdown
//
// Shows the same period-toggle math as Dashboard's profit card, but
// fully exploded: Revenue → minus COGS → minus Commissions → minus
// Payroll → minus Ad Spend → minus Misc = Profit. Each line clickable
// (where possible) to jump to the source.
//
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ChevronRight, Package,
  Coins, Users, Megaphone, Receipt,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';

const ws = () => getWorkspace('avs');
const ease = [0.16, 1, 0.3, 1];
const HTG_PER_USD = 150;

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff); x.setHours(0,0,0,0); return x;
}
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23,59,59,999); return x;
}
function startOfYear(d = new Date()) { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d = new Date()) {
  const x = new Date(d.getFullYear(), 11, 31);
  x.setHours(23,59,59,999); return x;
}

function periodRange(period) {
  const now = new Date();
  switch (period) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now), label: 'today' };
    case 'week':  return { from: startOfWeek(now), to: endOfDay(now), label: 'this week' };
    case 'year':  return { from: startOfYear(now), to: endOfYear(now), label: 'this year' };
    case 'month':
    default:      return { from: startOfMonth(now), to: endOfMonth(now), label: 'this month' };
  }
}

function fmtHTG(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export default function PnL() {
  const [period, setPeriod] = useState('month');
  const accent = ws().accent;
  const leads = useStore((s) => s.business?.leads || []);
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const payroll = useStore((s) => s.business?.staffPayroll || []);
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const cardCosts = useStore((s) => s.business?.cardCosts || []);
  const businessExpenses = useStore((s) => s.business?.businessExpenses || []);

  const pnl = useMemo(() => {
    const r = periodRange(period);
    const inR = (d) => d && d >= r.from && d <= r.to;

    const cogsFor = (lead) => {
      const cost = cardCosts.find((c) =>
        String(c.typeCarte).toLowerCase() === String(lead.cardType).toLowerCase() &&
        String(c.pack).toLowerCase() === String(lead.pack).toLowerCase()
      );
      if (!cost) return 0;
      return cost.currency === 'USD'
        ? Number(cost.supplierCost) * HTG_PER_USD
        : Number(cost.supplierCost);
    };

    let revenue = 0, cogs = 0, cards = 0;
    leads.forEach((l) => {
      if (l.leadStatus !== '✅ Terminé') return;
      const paid = parseDate(l.datePaidFull) || parseDate(l.date);
      if (!inR(paid)) return;
      revenue += Number(l.totalPrice) || 0;
      cogs += cogsFor(l);
      cards += 1;
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
      const amtHTG = p.currency === 'USD' ? (Number(p.amount) || 0) * HTG_PER_USD : (Number(p.amount) || 0);
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

    let expensesTotal = 0;
    businessExpenses.forEach((e) => {
      const d = parseDate(e.date);
      if (!inR(d)) return;
      const amtHTG = e.currency === 'USD'
        ? (Number(e.amount) || 0) * HTG_PER_USD
        : (Number(e.amount) || 0);
      expensesTotal += amtHTG;
    });

    const grossProfit = revenue - cogs;
    const opCosts = commissionsPaid + payrollPaid + adSpendTotal + expensesTotal;
    const netProfit = grossProfit - opCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue, cogs, cards,
      commissionsPaid, payrollPaid, adSpendTotal, expensesTotal,
      grossProfit, opCosts, netProfit, margin,
      label: r.label,
    };
  }, [period, leads, commissions, payroll, adSpend, cardCosts, businessExpenses]);

  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <div className="space-y-4">
      {/* Period toggle */}
      <div className="surface border rounded-2xl p-1 grid grid-cols-4 gap-0.5">
        {['today', 'week', 'month', 'year'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="py-2 rounded-xl text-[11px] font-medium capitalize"
            style={period === p
              ? { backgroundColor: accent.primary, color: accent.primaryFg }
              : { color: 'var(--text-muted, #7a8a8c)' }
            }
          >
            {p}
          </button>
        ))}
      </div>

      {/* Headline */}
      <div
        className="rounded-2xl p-5 border"
        style={{
          backgroundColor: pnl.netProfit >= 0 ? '#3d8b5f15' : '#c2452f15',
          borderColor: pnl.netProfit >= 0 ? '#3d8b5f44' : '#c2452f44',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: pnl.netProfit >= 0 ? '#3d8b5f' : '#c2452f',
              color: '#fff',
            }}
          >
            {pnl.netProfit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Net {pnl.netProfit >= 0 ? 'profit' : 'loss'} · {pnl.label}
          </div>
        </div>
        <div
          className="font-display text-4xl leading-tight"
          style={{ color: pnl.netProfit >= 0 ? '#3d8b5f' : '#c2452f' }}
        >
          {pnl.netProfit >= 0 ? '' : '−'}{fmtHTG(Math.abs(pnl.netProfit))}
          <span className="text-base text-muted font-sans ml-2">HTG</span>
        </div>
        <div className="text-xs text-muted mt-1">
          {pnl.revenue > 0 ? `${pnl.margin.toFixed(0)}% margin` : 'no revenue this period'}
          {pnl.cards > 0 && <> · {pnl.cards} cards sold</>}
        </div>
      </div>

      {/* Breakdown table */}
      <div className="surface border rounded-2xl overflow-hidden">
        <PnLRow
          label="Revenue"
          value={pnl.revenue}
          kind="positive"
          icon={TrendingUp}
          accent={accent}
        />
        <PnLRow
          label="Card supplier cost"
          value={-pnl.cogs}
          kind="negative"
          icon={Package}
          subtitle={pnl.cogs === 0 && pnl.cards > 0 ? 'Add card costs in Salaries → soon' : null}
          accent={accent}
        />
        <PnLRow
          label="Gross profit"
          value={pnl.grossProfit}
          kind="subtotal"
          accent={accent}
        />
        <PnLRow
          label="Marc commissions paid"
          value={-pnl.commissionsPaid}
          kind="negative"
          icon={Coins}
          onClick={() => setActiveTab('financials')}
          accent={accent}
        />
        <PnLRow
          label="Sales + content payroll"
          value={-pnl.payrollPaid}
          kind="negative"
          icon={Users}
          accent={accent}
        />
        <PnLRow
          label="Ad spend"
          value={-pnl.adSpendTotal}
          kind="negative"
          icon={Megaphone}
          onClick={() => setActiveTab('ads')}
          accent={accent}
        />
        <PnLRow
          label="Operating expenses"
          value={-pnl.expensesTotal}
          kind="negative"
          icon={Receipt}
          accent={accent}
        />
        <PnLRow
          label={pnl.netProfit >= 0 ? 'Net profit' : 'Net loss'}
          value={pnl.netProfit}
          kind="total"
          accent={accent}
        />
      </div>

      {/* Cost composition bar */}
      {pnl.revenue > 0 && (
        <div className="surface border rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
            Cost composition
          </div>
          <CompositionBar
            segments={[
              { label: 'COGS', value: pnl.cogs, color: '#a67c5a' },
              { label: 'Commissions', value: pnl.commissionsPaid, color: '#d4a942' },
              { label: 'Payroll', value: pnl.payrollPaid, color: '#5b8def' },
              { label: 'Ad spend', value: pnl.adSpendTotal, color: '#9b59b6' },
              { label: 'Expenses', value: pnl.expensesTotal, color: '#e07a5f' },
              { label: pnl.netProfit >= 0 ? 'Profit' : 'Loss', value: Math.abs(pnl.netProfit), color: pnl.netProfit >= 0 ? '#3d8b5f' : '#c2452f' },
            ]}
            total={pnl.revenue}
          />
        </div>
      )}
    </div>
  );
}

function PnLRow({ label, value, kind, icon: Icon, subtitle, onClick, accent }) {
  const isSubtotal = kind === 'subtotal' || kind === 'total';
  const isPositive = value >= 0;
  const Inner = (
    <div
      className={`px-4 py-3 flex items-center gap-3 ${
        isSubtotal ? 'bg-[var(--bg)]' : ''
      }`}
      style={kind === 'total'
        ? { borderTop: '2px solid var(--border)' }
        : kind === 'subtotal'
          ? { borderTop: '1px solid var(--border)' }
          : { borderTop: '1px solid var(--border)' }
      }
    >
      {Icon && !isSubtotal && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: kind === 'positive' ? '#3d8b5f22' : '#c2452f22',
            color: kind === 'positive' ? '#3d8b5f' : '#c2452f',
          }}
        >
          <Icon size={13} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`${isSubtotal ? 'font-medium text-sm' : 'text-sm'} truncate`}
          style={kind === 'total' ? { fontWeight: 600 } : undefined}
        >
          {label}
        </div>
        {subtitle && (
          <div className="text-[10px] text-muted truncate mt-0.5">{subtitle}</div>
        )}
      </div>
      <div
        className={`font-display shrink-0 ${kind === 'total' ? 'text-lg' : 'text-base'}`}
        style={{
          color: kind === 'total' || kind === 'subtotal'
            ? (value >= 0 ? '#3d8b5f' : '#c2452f')
            : (kind === 'positive' ? '#3d8b5f' : value < 0 ? '#c2452f' : 'var(--text)')
        }}
      >
        {value < 0 ? '−' : ''}{fmtHTG(Math.abs(value))}
      </div>
      {onClick && !isSubtotal && (
        <ChevronRight size={14} className="text-muted shrink-0" />
      )}
    </div>
  );

  return onClick ? (
    <button onClick={onClick} className="w-full text-left hover:bg-[var(--bg)] transition-colors block">
      {Inner}
    </button>
  ) : Inner;
}

function CompositionBar({ segments, total }) {
  if (total <= 0) return null;
  return (
    <>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-[var(--bg)] mb-3">
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <motion.div
              key={s.label}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              style={{ backgroundColor: s.color }}
            />
          );
        })}
      </div>
      <div className="space-y-1">
        {segments.filter(s => s.value > 0).map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <div key={s.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="text-muted shrink-0">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
