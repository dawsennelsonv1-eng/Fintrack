// src/modules/avs/Dashboard.jsx
// Tier 5h v2 — AVS Dashboard with period toggle + profit/loss + paid vs organic
//
// Added in v2:
//   • Period toggle: Today / Week / Month — drives all top stats
//   • Profit/Loss panel for selected period
//   • Paid vs Organic leads breakdown (FB/TikTok/IG ads vs organic posts)
//   • Cards count for selected period
//
// Other panels unchanged from v1 (lead volume, funnel, top staff, ROAS,
// sources, content streak).
//
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip,
  Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown,
  ChevronRight, Clock, Sparkles,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import { useAvsCurrency } from './useAvsCurrency';
import {
  CONTENT_REQUIRED_POSTS_PER_DAY,
} from '../../store/businessSlice';

const ws = () => getWorkspace('avs');
const ease = [0.16, 1, 0.3, 1];
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

const HTG_PER_USD = 150;

// ════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ════════════════════════════════════════════════════════════════════
function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  // Treat Monday as week start (more useful for business)
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfPrevWeek() {
  const w = startOfWeek();
  w.setDate(w.getDate() - 7);
  return w;
}
function endOfPrevWeek() {
  const w = startOfWeek();
  w.setDate(w.getDate() - 1);
  w.setHours(23, 59, 59, 999);
  return w;
}
function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0); return x;
}
function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999); return x;
}
function startOfPrevMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function endOfPrevMonth() {
  const d = new Date();
  const e = new Date(d.getFullYear(), d.getMonth(), 0);
  e.setHours(23, 59, 59, 999); return e;
}
function startOfYesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0); return d;
}
function endOfYesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999); return d;
}
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0); return d;
}

function fmtHTG(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

// Returns { from, to, prevFrom, prevTo, label, prevLabel }
function periodRange(period) {
  const now = new Date();
  switch (period) {
    case 'today': return {
      from: startOfDay(now), to: endOfDay(now),
      prevFrom: startOfYesterday(), prevTo: endOfYesterday(),
      label: 'today', prevLabel: 'yesterday',
    };
    case 'week': return {
      from: startOfWeek(now), to: endOfDay(now),
      prevFrom: startOfPrevWeek(), prevTo: endOfPrevWeek(),
      label: 'this week', prevLabel: 'last week',
    };
    case 'month':
    default: return {
      from: startOfMonth(now), to: endOfMonth(now),
      prevFrom: startOfPrevMonth(), prevTo: endOfPrevMonth(),
      label: 'this month', prevLabel: 'last month',
    };
  }
}

// Classify a lead's source as paid / organic / other
function classifySource(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('ads') || s.includes('ad ')) return 'paid';
  if (s.includes('organic')) return 'organic';
  if (s.includes('facebook') || s.includes('fb') || s.includes('instagram') || s.includes('ig') || s.includes('tiktok')) {
    // unspecified paid/organic — most likely paid since you mostly run ads
    return 'paid';
  }
  return 'other';
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
export default function AvsDashboard() {
  const accent = ws().accent;
  const [period, setPeriod] = useState('month'); // 'today' | 'week' | 'month'

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease }}
        className="mb-4"
      >
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
          AVS Solution HT
        </div>
        <h1 className="font-display text-3xl leading-tight">Command center</h1>
      </motion.section>

      <PeriodToggle period={period} onChange={setPeriod} accent={accent} />
      <PeriodStats period={period} accent={accent} />
      <PaidVsOrganic period={period} accent={accent} />
      <PendingPayouts accent={accent} />
      <DailyLeadVolume accent={accent} />
      <ConversionFunnel accent={accent} />
      <TopStaff period={period} accent={accent} />
      <ROASRankings accent={accent} />
      <LeadSources period={period} accent={accent} />
      <ContentStreak accent={accent} />
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════
// PERIOD TOGGLE
// ════════════════════════════════════════════════════════════════════
function PeriodToggle({ period, onChange, accent }) {
  const opts = [
    { id: 'today', label: 'Today' },
    { id: 'week',  label: 'Week' },
    { id: 'month', label: 'Month' },
  ];
  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.02 }}
      className="mb-3"
    >
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
                : { color: 'var(--text-muted, #7a8a8c)' }
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// PERIOD STATS — Revenue + Cards + Profit (driven by period toggle)
// ════════════════════════════════════════════════════════════════════
function PeriodStats({ period, accent }) {
  const leads = useStore((s) => s.business?.leads || []);
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const payroll = useStore((s) => s.business?.staffPayroll || []);
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const cardCosts = useStore((s) => s.business?.cardCosts || []);
  const { fmtCompact, base } = useAvsCurrency();

  const stats = useMemo(() => {
    const r = periodRange(period);

    const cogsFor = (lead) => {
      const cost = cardCosts.find((c) =>
        String(c.typeCarte).toLowerCase() === String(lead.cardType).toLowerCase() &&
        String(c.pack).toLowerCase() === String(lead.pack).toLowerCase()
      );
      if (!cost) return 0;
      const costHTG = cost.currency === 'USD'
        ? Number(cost.supplierCost) * HTG_PER_USD
        : Number(cost.supplierCost);
      return costHTG;
    };

    const inRange = (d, from, to) => d && d >= from && d <= to;

    let revenue = 0, prevRevenue = 0, cards = 0, prevCards = 0;
    let totalCOGS = 0;

    leads.forEach((l) => {
      if (l.leadStatus !== '✅ Terminé') return;
      const paid = parseDate(l.datePaidFull) || parseDate(l.date);
      const amt = Number(l.totalPrice) || 0;
      if (inRange(paid, r.from, r.to)) {
        revenue += amt;
        cards += 1;
        totalCOGS += cogsFor(l);
      } else if (inRange(paid, r.prevFrom, r.prevTo)) {
        prevRevenue += amt;
        prevCards += 1;
      }
    });

    // Period costs (commissions paid + payroll paid + ad spend, all in HTG)
    let commissionsPaid = 0;
    commissions.forEach((c) => {
      if (c.status !== 'paid') return;
      const d = parseDate(c.paidDate);
      if (inRange(d, r.from, r.to)) {
        commissionsPaid += (Number(c.commissionAmount) || 0); // HTG
      }
    });

    let payrollPaid = 0;
    payroll.forEach((p) => {
      if (p.status !== 'paid') return;
      const d = parseDate(p.paidDate);
      if (inRange(d, r.from, r.to)) {
        const amtHTG = p.currency === 'USD'
          ? (Number(p.amount) || 0) * HTG_PER_USD
          : (Number(p.amount) || 0);
        payrollPaid += amtHTG;
      }
    });

    let adSpendTotal = 0;
    adSpend.forEach((a) => {
      const d = parseDate(a.date);
      if (inRange(d, r.from, r.to)) {
        const amtHTG = a.spendCurrency === 'USD'
          ? (Number(a.spendAmount) || 0) * HTG_PER_USD
          : (Number(a.spendAmount) || 0);
        adSpendTotal += amtHTG;
      }
    });

    const totalCosts = totalCOGS + commissionsPaid + payrollPaid + adSpendTotal;
    const profit = revenue - totalCosts;
    const profitPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    const revDelta = prevRevenue > 0
      ? ((revenue - prevRevenue) / prevRevenue) * 100
      : null;

    return {
      revenue, prevRevenue, revDelta,
      cards, prevCards,
      totalCosts, totalCOGS, commissionsPaid, payrollPaid, adSpendTotal,
      profit, profitPct,
      label: r.label, prevLabel: r.prevLabel,
    };
  }, [period, leads, commissions, payroll, adSpend, cardCosts]);

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.04 }}
      className="grid grid-cols-2 gap-3 mb-4"
    >
      {/* Revenue */}
      <div
        className="rounded-2xl p-4 border"
        style={{
          backgroundColor: accent.soft,
          borderColor: accent.primary + '33',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
          >
            <DollarSign size={12} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Revenue
          </div>
        </div>
        <div className="font-display text-2xl leading-tight">
          {fmtCompact(stats.revenue, 'HTG')}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
          <span className="text-muted">{stats.cards} cards</span>
          {stats.revDelta !== null && (
            <>
              <span className="text-muted">·</span>
              <span
                className="flex items-center gap-0.5 font-medium"
                style={{ color: stats.revDelta >= 0 ? '#3d8b5f' : '#c2452f' }}
              >
                {stats.revDelta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(stats.revDelta).toFixed(0)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Profit/Loss */}
      <div
        className="rounded-2xl p-4 border"
        style={{
          backgroundColor: stats.profit >= 0 ? '#3d8b5f15' : '#c2452f15',
          borderColor: stats.profit >= 0 ? '#3d8b5f44' : '#c2452f44',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: stats.profit >= 0 ? '#3d8b5f' : '#c2452f',
              color: '#fff',
            }}
          >
            {stats.profit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            {stats.profit >= 0 ? 'Profit' : 'Loss'}
          </div>
        </div>
        <div
          className="font-display text-2xl leading-tight"
          style={{ color: stats.profit >= 0 ? '#3d8b5f' : '#c2452f' }}
        >
          {stats.profit >= 0 ? '' : '−'}{fmtCompact(Math.abs(stats.profit), 'HTG')}
        </div>
        <div className="text-[11px] text-muted mt-1.5">
          {stats.revenue > 0 ? `${stats.profitPct.toFixed(0)}% margin` : 'no revenue'}
          {stats.totalCosts > 0 && (
            <> · {fmtCompact(stats.totalCosts, 'HTG')} costs</>
          )}
        </div>
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// PAID VS ORGANIC LEADS (period-driven)
// ════════════════════════════════════════════════════════════════════
function PaidVsOrganic({ period, accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const stats = useMemo(() => {
    const r = periodRange(period);
    const inRange = (d) => d && d >= r.from && d <= r.to;
    let paid = 0, organic = 0, other = 0;
    const breakdown = {};

    leads.forEach((l) => {
      const d = parseDate(l.date);
      if (!inRange(d)) return;
      const kind = classifySource(l.source);
      if (kind === 'paid') paid += 1;
      else if (kind === 'organic') organic += 1;
      else other += 1;
      const key = l.source || 'Unknown';
      breakdown[key] = (breakdown[key] || 0) + 1;
    });

    const total = paid + organic + other;
    return {
      paid, organic, other, total, label: r.label,
      breakdown: Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
    };
  }, [period, leads]);

  if (stats.total === 0) {
    return (
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease, delay: 0.06 }}
        className="surface border rounded-2xl p-4 mb-4 text-center"
      >
        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
          Leads · {stats.label}
        </div>
        <div className="text-sm text-muted py-2">No leads yet</div>
      </motion.section>
    );
  }

  const paidPct = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;
  const organicPct = stats.total > 0 ? (stats.organic / stats.total) * 100 : 0;
  const otherPct = stats.total > 0 ? (stats.other / stats.total) * 100 : 0;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.06 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Leads · {stats.label}
          </div>
          <div className="font-display text-xl leading-tight mt-0.5">
            {stats.total}
            <span className="text-xs text-muted font-sans ml-1">leads</span>
          </div>
        </div>
      </div>

      {/* Stacked bar: paid / organic / other */}
      <div className="h-2.5 rounded-full overflow-hidden flex bg-[var(--bg)] mb-3">
        {stats.paid > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${paidPct}%` }}
            transition={{ duration: 0.6, ease, delay: 0.1 }}
            style={{ backgroundColor: accent.primary }}
          />
        )}
        {stats.organic > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${organicPct}%` }}
            transition={{ duration: 0.6, ease, delay: 0.15 }}
            style={{ backgroundColor: '#9b59b6' }}
          />
        )}
        {stats.other > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${otherPct}%` }}
            transition={{ duration: 0.6, ease, delay: 0.2 }}
            style={{ backgroundColor: '#7a8a8c' }}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <BreakdownCard
          icon={DollarSign}
          label="Paid"
          value={stats.paid}
          pct={paidPct}
          color={accent.primary}
          bg={accent.soft}
        />
        <BreakdownCard
          icon={Sparkles}
          label="Organic"
          value={stats.organic}
          pct={organicPct}
          color="#9b59b6"
          bg="#9b59b622"
        />
        {stats.other > 0 ? (
          <BreakdownCard
            icon={null}
            label="Other"
            value={stats.other}
            pct={otherPct}
            color="#7a8a8c"
            bg="#7a8a8c22"
          />
        ) : (
          <div />
        )}
      </div>

      {/* Source breakdown */}
      {stats.breakdown.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-[var(--border)]">
          {stats.breakdown.map(([source, count]) => {
            const kind = classifySource(source);
            const color = kind === 'paid' ? accent.primary
              : kind === 'organic' ? '#9b59b6'
              : '#7a8a8c';
            return (
              <div key={source} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 truncate">{source}</span>
                <span className="text-muted shrink-0">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}

function BreakdownCard({ icon: Icon, label, value, pct, color, bg }) {
  return (
    <div className="bg-[var(--bg)] rounded-xl p-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        {Icon && (
          <div
            className="w-4 h-4 rounded-md flex items-center justify-center"
            style={{ backgroundColor: bg, color }}
          >
            <Icon size={9} />
          </div>
        )}
        <div className="text-[9px] uppercase tracking-wider text-muted font-medium">
          {label}
        </div>
      </div>
      <div className="font-display text-lg leading-none" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-muted mt-0.5">{pct.toFixed(0)}%</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PENDING PAYOUTS (no period — always shows current pending)
// ════════════════════════════════════════════════════════════════════
function PendingPayouts({ accent }) {
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const payroll = useStore((s) => s.business?.staffPayroll || []);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const { fmtCompact } = useAvsCurrency();

  const stats = useMemo(() => {
    const pendingCommissions = commissions
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0);
    const pendingPayroll = payroll
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => {
        const amtHTG = p.currency === 'USD'
          ? (Number(p.amount) || 0) * HTG_PER_USD
          : (Number(p.amount) || 0);
        return s + amtHTG;
      }, 0);
    return {
      total: pendingCommissions + pendingPayroll,
      pendingCommissions,
      pendingPayroll,
      commCount: commissions.filter((c) => c.status === 'pending').length,
      payrollCount: payroll.filter((p) => p.status === 'pending').length,
    };
  }, [commissions, payroll]);

  if (stats.total === 0) return null;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.08 }}
      className="mb-4"
    >
      <button
        onClick={() => setActiveTab('financials')}
        className="w-full surface border rounded-2xl p-4 flex items-center gap-3 hover:shadow-sm active:scale-[0.99] transition-all text-left"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}
        >
          <Clock size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Owed to staff
          </div>
          <div className="font-display text-xl leading-tight">
            {fmtCompact(stats.total, 'HTG')}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {stats.commCount > 0 && <>{stats.commCount} commissions</>}
            {stats.commCount > 0 && stats.payrollCount > 0 && <> · </>}
            {stats.payrollCount > 0 && <>{stats.payrollCount} payroll</>}
          </div>
        </div>
        <ChevronRight size={16} className="text-muted shrink-0" />
      </button>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// DAILY LEAD VOLUME (30d)
// ════════════════════════════════════════════════════════════════════
function DailyLeadVolume({ accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const data = useMemo(() => {
    const buckets = {};
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const k = d.toISOString().slice(0, 10);
      buckets[k] = { date: k, day: d.getDate(), leads: 0, ma: 0 };
    }
    leads.forEach((l) => {
      const d = parseDate(l.date);
      if (!d) return;
      const k = d.toISOString().slice(0, 10);
      if (buckets[k]) buckets[k].leads += 1;
    });
    const arr = Object.values(buckets);
    for (let i = 0; i < arr.length; i++) {
      const slice = arr.slice(Math.max(0, i - 6), i + 1);
      arr[i].ma = slice.reduce((s, x) => s + x.leads, 0) / slice.length;
    }
    return arr;
  }, [leads]);

  const total = data.reduce((s, x) => s + x.leads, 0);
  const avg = total / 30;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.10 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Lead volume · 30d
          </div>
          <div className="font-display text-xl leading-tight mt-0.5">
            {total} <span className="text-xs text-muted font-sans">total · {avg.toFixed(1)}/day</span>
          </div>
        </div>
      </div>
      <div className="h-32 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelFormatter={(d) => `Day ${d}`}
              formatter={(v, name) => [Math.round(v * 10) / 10, name === 'ma' ? '7d avg' : 'leads']}
            />
            <Bar dataKey="leads" fill={accent.primary} radius={[3, 3, 0, 0]} />
            <Line dataKey="ma" stroke="#d4a942" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// CONVERSION FUNNEL
// ════════════════════════════════════════════════════════════════════
function ConversionFunnel({ accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const stages = useMemo(() => {
    const statuses = ws().leadStatuses;
    const counts = {};
    statuses.forEach((s) => { counts[s.label] = 0; });

    const order = {
      '🔴 À Faire': 0,
      '📅 Rdv Fixé': 1,
      '🟡 Envoi Atelier': 2,
      '✅ Terminé': 3,
      '❌ Perdu': -1,
    };
    leads.forEach((l) => {
      const curr = order[l.leadStatus];
      if (curr === undefined || curr < 0) return;
      for (let i = 0; i <= curr; i++) {
        const stage = statuses[i];
        if (stage) counts[stage.label] += 1;
      }
    });

    return statuses
      .filter((s) => s.label !== '❌ Perdu')
      .map((s) => ({ label: s.label, count: counts[s.label], color: s.color }));
  }, [leads]);

  const top = stages[0]?.count || 0;

  if (top === 0) return null;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.12 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Conversion funnel
      </div>
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const pct = top > 0 ? (stage.count / top) * 100 : 0;
          const dropFromPrev = i > 0 && stages[i - 1].count > 0
            ? Math.round(((stages[i - 1].count - stage.count) / stages[i - 1].count) * 100)
            : 0;
          return (
            <div key={stage.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs">{stage.label}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-sm">{stage.count}</span>
                  {i > 0 && stage.count > 0 && (
                    <span className="text-[10px] text-muted">
                      -{dropFromPrev}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease, delay: 0.15 + i * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// TOP STAFF (period-driven)
// ════════════════════════════════════════════════════════════════════
function TopStaff({ period, accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const ranking = useMemo(() => {
    const r = periodRange(period);
    const stats = {};

    leads.forEach((l) => {
      const created = parseDate(l.date);
      if (!created || created < r.from || created > r.to) return;
      const sales = l.assistantResponsible;
      if (sales) {
        if (!stats[sales]) stats[sales] = { name: sales, role: 'Sales', leads: 0, cards: 0, revenue: 0 };
        stats[sales].leads += 1;
        if (l.leadStatus === '✅ Terminé') {
          stats[sales].cards += 1;
          stats[sales].revenue += Number(l.totalPrice) || 0;
        }
      }
      const ops = l.assignedOps;
      if (ops && l.leadStatus === '✅ Terminé') {
        if (!stats[ops]) stats[ops] = { name: ops, role: 'Ops', leads: 0, cards: 0, revenue: 0 };
        if (stats[ops].role !== 'Sales') stats[ops].cards += 1;
      }
    });

    return Object.values(stats)
      .sort((a, b) => (b.role === 'Ops' ? b.cards : b.leads) - (a.role === 'Ops' ? a.cards : a.leads))
      .slice(0, 4);
  }, [period, leads]);

  if (ranking.length === 0) return null;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.14 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Top staff · {periodRange(period).label}
      </div>
      <div className="space-y-2">
        {ranking.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-3 p-2 rounded-xl bg-[var(--bg)]"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-display text-sm shrink-0"
              style={{
                backgroundColor: accent.soft,
                color: accent.primary,
              }}
            >
              {s.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-[10px] text-muted">{s.role}</div>
            </div>
            <div className="text-right shrink-0">
              {s.role === 'Sales' ? (
                <>
                  <div className="font-display text-base leading-none">
                    {s.leads}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">
                    {s.cards} closed
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display text-base leading-none">
                    {s.cards}
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">
                    cards
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// ROAS RANKINGS
// ════════════════════════════════════════════════════════════════════
function ROASRankings({ accent }) {
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const leads = useStore((s) => s.business?.leads || []);

  const rankings = useMemo(() => {
    return adSpend
      .filter((a) => a.kind === 'paid' && a.spendAmount > 0)
      .map((campaign) => {
        const matches = leads.filter((l) => {
          const src = String(l.source || '').toLowerCase();
          const name = String(campaign.campaignName || '').toLowerCase();
          return name && src.includes(name);
        });
        const completed = matches.filter((l) => l.leadStatus === '✅ Terminé');
        const revenueUSD = completed.reduce(
          (s, l) => s + (Number(l.totalPrice) || 0) / HTG_PER_USD, 0
        );
        const spendUSD = campaign.spendCurrency === 'HTG'
          ? Number(campaign.spendAmount) / HTG_PER_USD
          : Number(campaign.spendAmount);
        const roas = spendUSD > 0 ? revenueUSD / spendUSD : 0;
        return {
          name: campaign.campaignName,
          spend: spendUSD,
          roas,
          conversions: completed.length,
        };
      })
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 5);
  }, [adSpend, leads]);

  if (rankings.length === 0) return null;

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.18 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        ROAS · top campaigns
      </div>
      <div className="space-y-1.5">
        {rankings.map((r) => {
          const color = r.roas >= 3 ? '#3d8b5f'
            : r.roas >= 1.5 ? '#d4a942'
            : '#c2452f';
          return (
            <div key={r.name} className="flex items-center gap-3 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted">
                  ${r.spend.toFixed(0)} · {r.conversions} cards
                </div>
              </div>
              <div className="font-display text-lg shrink-0" style={{ color }}>
                {r.roas.toFixed(1)}×
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// LEAD SOURCES (period-driven)
// ════════════════════════════════════════════════════════════════════
function LeadSources({ period, accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const data = useMemo(() => {
    const r = periodRange(period);
    const counts = {};
    leads.forEach((l) => {
      const d = parseDate(l.date);
      if (!d || d < r.from || d > r.to) return;
      const src = l.source || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    const palette = ['#2D5F4F', '#5b8def', '#d4a942', '#9b59b6', '#e07a5f', '#7a8a8c'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, color: palette[i] }));
  }, [period, leads]);

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.22 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Lead sources · {periodRange(period).label}
      </div>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={44}
                paddingAngle={2}
              >
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {data.map((d) => {
            const pct = Math.round((d.value / total) * 100);
            return (
              <div key={d.name} className="flex items-center gap-2 text-[11px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-muted shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// CONTENT STREAK
// ════════════════════════════════════════════════════════════════════
function ContentStreak({ accent }) {
  const adherence = useStore((s) => s.business?.contentAdherence || []);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const { streak, rate30, todayPosts } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      if (entry && entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY) {
        streak += 1;
      } else if (i === 0 && !entry) {
        continue;
      } else {
        break;
      }
    }

    let logged = 0, hit = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      if (entry) {
        logged += 1;
        if (entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY) hit += 1;
      }
    }
    const rate30 = logged > 0 ? Math.round((hit / logged) * 100) : 0;
    const todayEntry = adherence.find((a) => String(a.date).slice(0, 10) === today);
    return { streak, rate30, todayPosts: todayEntry?.actualPosts || 0 };
  }, [adherence]);

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.26 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Sarah's content
          </div>
          <div className="font-display text-base leading-tight mt-0.5">
            {todayPosts}/{CONTENT_REQUIRED_POSTS_PER_DAY} today
          </div>
        </div>
        <button
          onClick={() => setActiveTab('financials')}
          className="text-[11px] flex items-center gap-0.5"
          style={{ color: accent.primary }}
        >
          Log <ChevronRight size={11} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--bg)] rounded-xl p-2.5 text-center">
          <div
            className="font-display text-xl leading-none"
            style={{ color: streak > 0 ? '#3d8b5f' : 'var(--text-muted, #7a8a8c)' }}
          >
            {streak}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-medium mt-1">
            day streak
          </div>
        </div>
        <div className="bg-[var(--bg)] rounded-xl p-2.5 text-center">
          <div
            className="font-display text-xl leading-none"
            style={{ color: rate30 >= 80 ? '#3d8b5f' : rate30 >= 50 ? '#d4a942' : '#c2452f' }}
          >
            {rate30}%
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted font-medium mt-1">
            30-day rate
          </div>
        </div>
      </div>
    </motion.section>
  );
}
