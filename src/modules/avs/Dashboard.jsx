// src/modules/avs/Dashboard.jsx
// Tier 5h — AVS Dashboard
//
// Mobile-optimized graph-heavy home screen. 8 panels:
//   1. Revenue MTD + vs last month delta
//   2. Pending payouts (Marc + Sales + Sarah)
//   3. Daily lead volume (30d, bar chart + 7d MA)
//   4. Conversion funnel
//   5. Top staff this period
//   6. ROAS per campaign (top 5)
//   7. Lead sources breakdown
//   8. Sarah's content streak
//
// All graphs use Recharts for consistency with Personal Dashboard.
//
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip,
  Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Coins,
  ChevronRight, Clock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import {
  CONTENT_REQUIRED_POSTS_PER_DAY,
  computeOpsCommission,
  SALES_BIWEEKLY_HTG,
  CONTENT_MONTHLY_HTG,
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

function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfPrevMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function endOfPrevMonth() {
  const d = new Date();
  const e = new Date(d.getFullYear(), d.getMonth(), 0);
  e.setHours(23, 59, 59, 999);
  return e;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtHTG(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
export default function AvsDashboard() {
  const accent = ws().accent;

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease }}
        className="mb-5"
      >
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
          AVS Solution HT
        </div>
        <h1 className="font-display text-3xl leading-tight">Command center</h1>
      </motion.section>

      <RevenueAndPayouts accent={accent} />
      <DailyLeadVolume accent={accent} />
      <ConversionFunnel accent={accent} />
      <TopStaff accent={accent} />
      <ROASRankings accent={accent} />
      <LeadSources accent={accent} />
      <ContentStreak accent={accent} />
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════
// PANEL 1 + 2: REVENUE MTD + PENDING PAYOUTS
// ════════════════════════════════════════════════════════════════════
function RevenueAndPayouts({ accent }) {
  const leads = useStore((s) => s.business?.leads || []);
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const payroll = useStore((s) => s.business?.staffPayroll || []);

  const stats = useMemo(() => {
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();
    const prevStart = startOfPrevMonth();
    const prevEnd = endOfPrevMonth();

    let revenueMTD = 0, revenuePrev = 0, cardsMTD = 0;
    leads.forEach((l) => {
      if (l.leadStatus !== '✅ Terminé') return;
      const paid = parseDate(l.datePaidFull) || parseDate(l.date);
      if (!paid) return;
      const amt = Number(l.totalPrice) || 0;
      if (paid >= monthStart && paid <= monthEnd) {
        revenueMTD += amt;
        cardsMTD += 1;
      } else if (paid >= prevStart && paid <= prevEnd) {
        revenuePrev += amt;
      }
    });

    const pendingCommissions = commissions
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0);
    const pendingPayroll = payroll
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const delta = revenuePrev > 0
      ? ((revenueMTD - revenuePrev) / revenuePrev) * 100
      : null;

    return {
      revenueMTD,
      revenuePrev,
      cardsMTD,
      delta,
      pendingTotal: pendingCommissions + pendingPayroll,
      pendingCommissions,
      pendingPayroll,
    };
  }, [leads, commissions, payroll]);

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.04 }}
      className="grid grid-cols-2 gap-3 mb-4"
    >
      {/* Revenue MTD */}
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
            Revenue MTD
          </div>
        </div>
        <div className="font-display text-2xl leading-tight">
          {fmtHTG(stats.revenueMTD)}
          <span className="text-xs text-muted font-sans ml-1">HTG</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
          <span className="text-muted">{stats.cardsMTD} cards</span>
          {stats.delta !== null && (
            <>
              <span className="text-muted">·</span>
              <span
                className="flex items-center gap-0.5 font-medium"
                style={{ color: stats.delta >= 0 ? '#3d8b5f' : '#c2452f' }}
              >
                {stats.delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(stats.delta).toFixed(0)}%
              </span>
            </>
          )}
        </div>
      </div>

      {/* Pending payouts */}
      <div className="surface border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}
          >
            <Clock size={12} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Owed staff
          </div>
        </div>
        <div className="font-display text-2xl leading-tight">
          {fmtHTG(stats.pendingTotal)}
          <span className="text-xs text-muted font-sans ml-1">HTG</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted">
          {stats.pendingCommissions > 0 && (
            <>
              <Coins size={10} />
              <span>{fmtHTG(stats.pendingCommissions)} comm</span>
            </>
          )}
          {stats.pendingPayroll > 0 && (
            <>
              {stats.pendingCommissions > 0 && <span>·</span>}
              <span>{fmtHTG(stats.pendingPayroll)} payroll</span>
            </>
          )}
          {stats.pendingTotal === 0 && <span>All paid</span>}
        </div>
      </div>
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════════════
// PANEL 3: DAILY LEAD VOLUME (30d)
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
    // 7-day moving average
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
      transition={{ duration: 0.5, ease, delay: 0.08 }}
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
// PANEL 4: CONVERSION FUNNEL
// ════════════════════════════════════════════════════════════════════
function ConversionFunnel({ accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const stages = useMemo(() => {
    const statuses = ws().leadStatuses;
    const counts = {};
    statuses.forEach((s) => { counts[s.label] = 0; });

    // A lead "reached" a stage if it's currently at that stage OR a later one.
    // Order: À Faire(0) → Rdv(1) → Atelier(2) → Terminé(3). Perdu is dropout.
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
      // Count this lead in every stage up to and including its current
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
// PANEL 5: TOP STAFF THIS PERIOD
// ════════════════════════════════════════════════════════════════════
function TopStaff({ accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const ranking = useMemo(() => {
    const monthStart = startOfMonth();
    const stats = {};

    leads.forEach((l) => {
      const created = parseDate(l.date);
      if (!created || created < monthStart) return;
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
  }, [leads]);

  if (ranking.length === 0) {
    return null;
  }

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.16 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Top staff · this month
      </div>
      <div className="space-y-2">
        {ranking.map((s, i) => (
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
// PANEL 6: ROAS PER CAMPAIGN
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
      transition={{ duration: 0.5, ease, delay: 0.20 }}
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
// PANEL 7: LEAD SOURCES
// ════════════════════════════════════════════════════════════════════
function LeadSources({ accent }) {
  const leads = useStore((s) => s.business?.leads || []);

  const data = useMemo(() => {
    const counts = {};
    leads.forEach((l) => {
      const src = l.source || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    const palette = ['#2D5F4F', '#5b8def', '#d4a942', '#9b59b6', '#e07a5f', '#7a8a8c'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, color: palette[i] }));
  }, [leads]);

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.5, ease, delay: 0.24 }}
      className="surface border rounded-2xl p-4 mb-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
        Lead sources
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
// PANEL 8: SARAH'S CONTENT STREAK
// ════════════════════════════════════════════════════════════════════
function ContentStreak({ accent }) {
  const adherence = useStore((s) => s.business?.contentAdherence || []);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const { streak, rate30, todayPosts } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
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
      const d = new Date();
      d.setDate(d.getDate() - i);
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
      transition={{ duration: 0.5, ease, delay: 0.28 }}
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
