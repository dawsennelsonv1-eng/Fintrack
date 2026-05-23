// src/modules/recharge/Home.jsx
//
// Recharge home: daily/weekly/monthly benefits with period toggle,
// pending Marc commissions, fulfillment time KPI, top 3 clients,
// benefits-vs-expenses chart.
//
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Coins, Zap, Users as UsersIcon,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import { useRechargeData, clientAnalytics, parseDate, isTermine } from './useRechargeData';
import { useAvsCurrency } from '../avs/useAvsCurrency';
import { useWorkspaceFilter, applyDateFilter } from '../../lib/workspaceFilter';
import FilterPill from '../../components/FilterPill';

const ws = () => getWorkspace('recharge');
const ease = [0.16, 1, 0.3, 1];
const fadeUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

export default function RechargeHome() {
  const [period, setPeriod] = useState('month');
  const accent = ws().accent;
  const setActiveTab = useStore((s) => s.setActiveTab);
  const data = useRechargeData(period);
  const { fmtCompact } = useAvsCurrency();
  const wsFilter = useWorkspaceFilter('recharge');

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
          AVS Recharge
        </div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl leading-tight">Command center</h1>
          <FilterPill filter={wsFilter} />
        </div>
      </motion.section>

      <PeriodToggle period={period} onChange={setPeriod} accent={accent} />

      <BenefitsHeadline data={data} accent={accent} fmt={fmtCompact} />

      <KPIRow data={data} accent={accent} fmt={fmtCompact}
        onTapPending={() => setActiveTab('financials')} />

      <BenefitsVsExpenses period={period} accent={accent} fmt={fmtCompact} />

      <TopClients accent={accent} fmt={fmtCompact}
        onTapAll={() => setActiveTab('clients')} />

      <FulfillmentSpeed data={data} accent={accent} />

      {data.lossOrders.length > 0 && (
        <LossAlert orders={data.lossOrders} accent={accent} fmt={fmtCompact}
          onTap={() => setActiveTab('orders')} />
      )}
    </main>
  );
}

function PeriodToggle({ period, onChange, accent }) {
  const opts = [
    { id: 'today', label: 'Today' },
    { id: 'week',  label: 'Week' },
    { id: 'month', label: 'Month' },
  ];
  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.02 }} className="mb-3">
      <div className="surface border rounded-2xl p-1 grid grid-cols-3 gap-0.5">
        {opts.map((o) => {
          const active = period === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className="py-2 rounded-xl text-xs font-medium"
              style={active
                ? { backgroundColor: accent.primary, color: accent.primaryFg }
                : { color: 'var(--text-muted, #7a8a8c)' }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}

function BenefitsHeadline({ data, accent, fmt }) {
  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.04 }}
      className="grid grid-cols-2 gap-3 mb-4">
      <div className="rounded-2xl p-4 border"
        style={{ backgroundColor: accent.soft, borderColor: accent.primary + '33' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
            <Coins size={12} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Benefits · {data.period.label}
          </div>
        </div>
        <div className="font-display text-2xl leading-tight">
          {fmt(data.benefits, 'HTG')}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
          <span className="text-muted">{data.count} orders</span>
          {data.benefitsDelta !== null && (
            <>
              <span className="text-muted">·</span>
              <span className="flex items-center gap-0.5 font-medium"
                style={{ color: data.benefitsDelta >= 0 ? '#3d8b5f' : '#c2452f' }}>
                {data.benefitsDelta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(data.benefitsDelta).toFixed(0)}%
              </span>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-4 border"
        style={{
          backgroundColor: data.netProfit >= 0 ? '#3d8b5f15' : '#c2452f15',
          borderColor: data.netProfit >= 0 ? '#3d8b5f44' : '#c2452f44',
        }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: data.netProfit >= 0 ? '#3d8b5f' : '#c2452f',
              color: '#fff',
            }}>
            {data.netProfit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Net after costs
          </div>
        </div>
        <div className="font-display text-2xl leading-tight"
          style={{ color: data.netProfit >= 0 ? '#3d8b5f' : '#c2452f' }}>
          {data.netProfit >= 0 ? '' : '−'}{fmt(Math.abs(data.netProfit), 'HTG')}
        </div>
        <div className="text-[11px] text-muted mt-1.5">
          {data.commissionsPaidPeriod > 0 && (
            <>−{fmt(data.commissionsPaidPeriod, 'HTG')} Marc</>
          )}
          {data.commissionsPaidPeriod > 0 && data.expensesPeriod > 0 && ' · '}
          {data.expensesPeriod > 0 && (
            <>−{fmt(data.expensesPeriod, 'HTG')} costs</>
          )}
          {data.commissionsPaidPeriod === 0 && data.expensesPeriod === 0 && 'no costs paid'}
        </div>
      </div>
    </motion.section>
  );
}

function KPIRow({ data, accent, fmt, onTapPending }) {
  const pendingCount = data.commissions
    ? data.commissions.filter((c) => c.status === 'pending').length
    : 0;
  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.08 }}
      className="grid grid-cols-3 gap-2 mb-4">
      <KPI label="Revenue"
        value={fmt(data.revenue, 'HTG')}
        sub={`${data.count} orders`}
        color={accent.primary} bg={accent.soft} />
      <button
        onClick={data.pendingCommissions > 0 ? onTapPending : undefined}
        className="surface border rounded-2xl p-3 text-left active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}>
            <Coins size={11} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted">Marc owed</div>
        </div>
        <div className="font-display text-base leading-tight"
          style={{ color: data.pendingCommissions > 0 ? '#d4a942' : 'var(--text)' }}>
          {fmt(data.pendingCommissions, 'HTG')}
        </div>
        <div className="text-[10px] text-muted mt-0.5">
          {pendingCount} pending
        </div>
      </button>
      <KPI label="Losses"
        value={`${data.lossOrders.length}`}
        sub={data.lossOrders.length === 0 ? 'none' : 'orders'}
        color={data.lossOrders.length === 0 ? '#3d8b5f' : '#c2452f'}
        bg={data.lossOrders.length === 0 ? '#3d8b5f22' : '#c2452f22'} />
    </motion.section>
  );
}

function KPI({ label, value, sub, color, bg }) {
  return (
    <div className="surface border rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: bg, color }}>
          <Zap size={11} />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      </div>
      <div className="font-display text-base leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function BenefitsVsExpenses({ period, accent, fmt }) {
  const rawOrders = useStore((s) => s.business?.rechargeOrders || []);
  const rawCommissions = useStore((s) => s.business?.rechargeCommissions || []);
  const expenses = useStore((s) => s.business?.businessExpenses || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const orders = useMemo(() => applyDateFilter(rawOrders, wsFilter, 'date'), [rawOrders, wsFilter]);
  const commissions = useMemo(() => applyDateFilter(rawCommissions, wsFilter, 'date'), [rawCommissions, wsFilter]);

  const data = useMemo(() => {
    // Build buckets for last N days/weeks based on period
    const days = period === 'today' ? 7 : period === 'week' ? 8 : 12;
    const granularity = period === 'today' ? 'day' : period === 'week' ? 'week' : 'month';
    const buckets = [];

    for (let i = days - 1; i >= 0; i--) {
      let from, to, label;
      const ref = new Date();
      if (granularity === 'day') {
        const d = new Date(ref); d.setDate(d.getDate() - i);
        from = new Date(d); from.setHours(0, 0, 0, 0);
        to = new Date(d); to.setHours(23, 59, 59, 999);
        label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
      } else if (granularity === 'week') {
        const d = new Date(ref);
        const diff = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - diff - (i * 7));
        from = new Date(d); from.setHours(0, 0, 0, 0);
        to = new Date(d); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
        label = `W${i === 0 ? '' : -i}`;
      } else {
        const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        from = d;
        to = new Date(d.getFullYear(), d.getMonth() + 1, 0); to.setHours(23, 59, 59, 999);
        label = d.toLocaleDateString('en', { month: 'short' });
      }

      let benefits = 0, costs = 0;
      orders.forEach((o) => {
        if (!isTermine(o)) return;
        const dt = parseDate(o.date);
        if (!dt || dt < from || dt > to) return;
        benefits += Number(o.profit) || 0;
      });
      commissions.forEach((c) => {
        if (c.status !== 'paid') return;
        const dt = parseDate(c.paidDate);
        if (!dt || dt < from || dt > to) return;
        costs += Number(c.commissionAmount) || 0;
      });
      expenses.forEach((e) => {
        const dt = parseDate(e.date);
        if (!dt || dt < from || dt > to) return;
        const tag = (String(e.notes || '') + ' ' + String(e.description || '')).toLowerCase();
        if (!tag.includes('recharge')) return;
        costs += e.currency === 'USD' ? (Number(e.amount) || 0) * 150 : (Number(e.amount) || 0);
      });
      buckets.push({ label, benefits: Math.round(benefits), costs: Math.round(costs), net: Math.round(benefits - costs) });
    }
    return buckets;
  }, [orders, commissions, expenses, period]);

  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.12 }}
      className="surface border rounded-2xl p-4 mb-4">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Benefits vs expenses
      </div>
      <div className="h-40 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#7a8a8c' }} interval={0} />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v) => fmt(v, 'HTG')}
            />
            <Bar dataKey="benefits" fill={accent.primary} radius={[3, 3, 0, 0]} />
            <Bar dataKey="costs" fill="#c2452f" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="net" stroke="#d4a942" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-muted">
        <Dot color={accent.primary} label="Benefits" />
        <Dot color="#c2452f" label="Costs" />
        <Dot color="#d4a942" label="Net" />
      </div>
    </motion.section>
  );
}

function Dot({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function TopClients({ accent, fmt, onTapAll }) {
  const rawOrders = useStore((s) => s.business?.rechargeOrders || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const orders = useMemo(() => applyDateFilter(rawOrders, wsFilter, 'date'), [rawOrders, wsFilter]);
  const top = useMemo(() => {
    return clientAnalytics(orders)
      .filter((c) => c.benefits > 0)
      .sort((a, b) => b.benefits - a.benefits)
      .slice(0, 3);
  }, [orders]);

  if (top.length === 0) return null;

  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.16 }}
      className="surface border rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
          Top 3 by benefits · all time
        </div>
        <button onClick={onTapAll}
          className="text-[11px] flex items-center gap-0.5" style={{ color: accent.primary }}>
          All clients <ChevronRight size={11} />
        </button>
      </div>
      <div className="space-y-2">
        {top.map((c, i) => (
          <div key={c.key} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--bg)]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-display text-sm shrink-0"
              style={{ backgroundColor: accent.soft, color: accent.primary }}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-[10px] text-muted truncate">
                {c.tagInfo && <>{c.tagInfo} · </>}{c.orderCount} orders
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-sm leading-none">{fmt(c.benefits, 'HTG')}</div>
              <div className="text-[9px] text-muted mt-0.5">benefits</div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function FulfillmentSpeed({ data, accent }) {
  // Count orders by speed tier (Vitesse field)
  const speeds = useMemo(() => {
    const tiers = {};
    data.terminéInPeriod.forEach((o) => {
      const s = String(o.speed || 'Unspecified').trim();
      const cleaned = s.replace(/\s*\([^)]*\)/, '').trim() || 'Unspecified';
      tiers[cleaned] = (tiers[cleaned] || 0) + 1;
    });
    return Object.entries(tiers).sort((a, b) => b[1] - a[1]);
  }, [data.terminéInPeriod]);

  if (speeds.length === 0) return null;

  const colors = {
    'Urgent VIP': '#c2452f',
    'Urgent': '#c2452f',
    'Prioritaire': '#d4a942',
    'Standard': '#5b8def',
    'Différé': '#7a8a8c',
  };

  const total = speeds.reduce((s, [, c]) => s + c, 0);

  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.20 }}
      className="surface border rounded-2xl p-4 mb-4">
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Speed tiers · {data.period.label}
      </div>
      <div className="space-y-2">
        {speeds.map(([tier, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          const color = colors[tier] || '#7a8a8c';
          return (
            <div key={tier}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs">{tier}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-sm">{count}</span>
                  <span className="text-[10px] text-muted">{pct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

function LossAlert({ orders, accent, fmt, onTap }) {
  const total = orders.reduce((s, o) => s + Math.abs(Number(o.profit) || 0), 0);
  return (
    <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.24 }}>
      <button onClick={onTap}
        className="w-full rounded-2xl p-3 border flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
        style={{ backgroundColor: '#c2452f15', borderColor: '#c2452f44' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#c2452f22', color: '#c2452f' }}>
          <AlertTriangle size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: '#c2452f' }}>
            {orders.length} loss orders this period
          </div>
          <div className="text-[11px] text-muted">
            −{fmt(total, 'HTG')} total loss · tap to review
          </div>
        </div>
        <ChevronRight size={14} className="text-muted shrink-0" />
      </button>
    </motion.section>
  );
}
