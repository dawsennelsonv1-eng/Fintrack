// src/modules/recharge/financials/PnL.jsx
//
// Recharge P&L with period toggle. Shows benefits, Marc commissions
// (paid in period), recharge-tagged expenses, net.
//
import { useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Coins, Receipt, Package,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import { useAvsCurrency } from '../../avs/useAvsCurrency';
import { parseDate, isTermine } from '../useRechargeData';

const ws = () => getWorkspace('recharge');
const HTG_PER_USD = 150;

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

export default function PnL() {
  const [period, setPeriod] = useState('month');
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const orders = useStore((s) => s.business?.rechargeOrders || []);
  const commissions = useStore((s) => s.business?.rechargeCommissions || []);
  const expenses = useStore((s) => s.business?.businessExpenses || []);

  const pnl = useMemo(() => {
    const r = periodRange(period);
    const inR = (v) => {
      if (!v) return false;
      const d = parseDate(v);
      return d && d >= r.from && d <= r.to;
    };

    let revenue = 0, supplierCost = 0, benefits = 0, count = 0;
    orders.forEach((o) => {
      if (!isTermine(o)) return;
      if (!inR(o.date)) return;
      revenue += Number(o.amountHtg) || 0;
      supplierCost += Number(o.supplierFee) || 0;
      benefits += Number(o.profit) || 0;
      count += 1;
    });

    let commissionsPaid = 0;
    commissions.forEach((c) => {
      if (c.status !== 'paid') return;
      if (!inR(c.paidDate)) return;
      commissionsPaid += Number(c.commissionAmount) || 0;
    });

    let expensesTotal = 0;
    expenses.forEach((e) => {
      if (!inR(e.date)) return;
      const tag = (String(e.notes || '') + ' ' + String(e.description || '')).toLowerCase();
      if (!tag.includes('recharge')) return;
      const amtHtg = e.currency === 'USD'
        ? (Number(e.amount) || 0) * HTG_PER_USD
        : (Number(e.amount) || 0);
      expensesTotal += amtHtg;
    });

    const netProfit = benefits - commissionsPaid - expensesTotal;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      revenue, supplierCost, benefits, count,
      commissionsPaid, expensesTotal, netProfit, margin,
      label: r.label,
    };
  }, [period, orders, commissions, expenses]);

  return (
    <div className="space-y-4">
      {/* Period toggle */}
      <div className="surface border rounded-2xl p-1 grid grid-cols-4 gap-0.5">
        {['today', 'week', 'month', 'year'].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className="py-2 rounded-xl text-[11px] font-medium capitalize"
            style={period === p
              ? { backgroundColor: accent.primary, color: accent.primaryFg }
              : { color: 'var(--text-muted, #7a8a8c)' }}>
            {p}
          </button>
        ))}
      </div>

      {/* Headline */}
      <div className="rounded-2xl p-5 border"
        style={{
          backgroundColor: pnl.netProfit >= 0 ? '#3d8b5f15' : '#c2452f15',
          borderColor: pnl.netProfit >= 0 ? '#3d8b5f44' : '#c2452f44',
        }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: pnl.netProfit >= 0 ? '#3d8b5f' : '#c2452f',
              color: '#fff',
            }}>
            {pnl.netProfit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Net {pnl.netProfit >= 0 ? 'profit' : 'loss'} · {pnl.label}
          </div>
        </div>
        <div className="font-display text-4xl leading-tight"
          style={{ color: pnl.netProfit >= 0 ? '#3d8b5f' : '#c2452f' }}>
          {pnl.netProfit >= 0 ? '' : '−'}{fmtCompact(Math.abs(pnl.netProfit), 'HTG')}
        </div>
        <div className="text-xs text-muted mt-1">
          {pnl.revenue > 0 ? `${pnl.margin.toFixed(0)}% margin` : 'no revenue this period'}
          {pnl.count > 0 && <> · {pnl.count} orders</>}
        </div>
      </div>

      {/* Breakdown */}
      <div className="surface border rounded-2xl overflow-hidden">
        <Row label="Revenue" value={pnl.revenue} kind="positive"
          icon={TrendingUp} accent={accent} fmt={fmtCompact} />
        <Row label="Supplier costs" value={-pnl.supplierCost} kind="negative"
          icon={Package} accent={accent} fmt={fmtCompact}
          subtitle={pnl.supplierCost === 0 ? 'logged inline in each order' : null} />
        <Row label="Benefits" value={pnl.benefits} kind="subtotal" fmt={fmtCompact} />
        <Row label="Marc commissions paid" value={-pnl.commissionsPaid} kind="negative"
          icon={Coins} accent={accent} fmt={fmtCompact} />
        <Row label="Operating expenses" value={-pnl.expensesTotal} kind="negative"
          icon={Receipt} accent={accent} fmt={fmtCompact}
          subtitle="tag with 'recharge' to include here" />
        <Row label={pnl.netProfit >= 0 ? 'Net profit' : 'Net loss'} value={pnl.netProfit}
          kind="total" fmt={fmtCompact} />
      </div>
    </div>
  );
}

function Row({ label, value, kind, icon: Icon, subtitle, accent, fmt }) {
  const isSubtotal = kind === 'subtotal' || kind === 'total';
  return (
    <div className={`px-4 py-3 flex items-center gap-3 border-t border-[var(--border)] first:border-0 ${
      isSubtotal ? 'bg-[var(--bg)]' : ''
    }`}
      style={kind === 'total' ? { borderTopWidth: '2px' } : undefined}>
      {Icon && !isSubtotal && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: kind === 'positive' ? '#3d8b5f22' : '#c2452f22',
            color: kind === 'positive' ? '#3d8b5f' : '#c2452f',
          }}>
          <Icon size={13} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`${isSubtotal ? 'font-medium text-sm' : 'text-sm'} truncate`}
          style={kind === 'total' ? { fontWeight: 600 } : undefined}>
          {label}
        </div>
        {subtitle && <div className="text-[10px] text-muted truncate mt-0.5">{subtitle}</div>}
      </div>
      <div className={`font-display shrink-0 ${kind === 'total' ? 'text-lg' : 'text-base'}`}
        style={{
          color: kind === 'total' || kind === 'subtotal'
            ? (value >= 0 ? '#3d8b5f' : '#c2452f')
            : (kind === 'positive' ? '#3d8b5f' : value < 0 ? '#c2452f' : 'var(--text)'),
        }}>
        {value < 0 ? '−' : ''}{fmt(Math.abs(value), 'HTG')}
      </div>
    </div>
  );
}
