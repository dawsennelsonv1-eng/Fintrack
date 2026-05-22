// src/modules/recharge/useRechargeData.js
//
// Centralized Recharge data + analytics hook.
// Used by every Recharge module so the math stays consistent.
//
import { useMemo } from 'react';
import { useStore } from '../../store/useStore';

const HTG_PER_USD = 150;

// ─── DATE HELPERS ────────────────────────────────────────
export function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    // Excel serial date
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}
export function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
export function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function startOfPrev(period) {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); return d;
  }
  if (period === 'week') {
    const w = startOfWeek(now); w.setDate(w.getDate() - 7); return w;
  }
  if (period === 'month') {
    const m = startOfMonth(now); m.setMonth(m.getMonth() - 1); return m;
  }
  return now;
}
export function endOfPrev(period) {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now); d.setDate(d.getDate() - 1); d.setHours(23, 59, 59, 999); return d;
  }
  if (period === 'week') {
    const w = startOfWeek(now); w.setDate(w.getDate() - 1); w.setHours(23, 59, 59, 999); return w;
  }
  if (period === 'month') {
    const m = startOfMonth(now); m.setDate(m.getDate() - 1); m.setHours(23, 59, 59, 999); return m;
  }
  return now;
}

export function periodRange(period) {
  const now = new Date();
  switch (period) {
    case 'today': return {
      from: startOfDay(now), to: endOfDay(now),
      prevFrom: startOfPrev('today'), prevTo: endOfPrev('today'),
      label: 'today', prevLabel: 'yesterday',
    };
    case 'week': return {
      from: startOfWeek(now), to: endOfDay(now),
      prevFrom: startOfPrev('week'), prevTo: endOfPrev('week'),
      label: 'this week', prevLabel: 'last week',
    };
    case 'month':
    default: return {
      from: startOfMonth(now), to: endOfMonth(now),
      prevFrom: startOfPrev('month'), prevTo: endOfPrev('month'),
      label: 'this month', prevLabel: 'last month',
    };
  }
}

export function isTermine(order) {
  return String(order?.status || '').toLowerCase().includes('termin');
}

// ─── MAIN HOOK ───────────────────────────────────────────
export function useRechargeData(period = 'month') {
  const orders = useStore((s) => s.business?.rechargeOrders || []);
  const commissions = useStore((s) => s.business?.rechargeCommissions || []);
  const payouts = useStore((s) => s.business?.rechargePayouts || []);
  const businessExpenses = useStore((s) => s.business?.businessExpenses || []);
  const staffPayroll = useStore((s) => s.business?.staffPayroll || []);

  const stats = useMemo(() => {
    const r = periodRange(period);
    const inR = (d) => {
      if (!d) return false;
      const dt = parseDate(d);
      return dt && dt >= r.from && dt <= r.to;
    };
    const inPrev = (d) => {
      if (!d) return false;
      const dt = parseDate(d);
      return dt && dt >= r.prevFrom && dt <= r.prevTo;
    };

    let revenue = 0, benefits = 0, count = 0;
    let prevRevenue = 0, prevBenefits = 0, prevCount = 0;
    const terminé = [];

    orders.forEach((o) => {
      if (!isTermine(o)) return;
      const orderDate = o.date;
      if (inR(orderDate)) {
        revenue += Number(o.amountHtg) || 0;
        benefits += Number(o.profit) || 0;
        count += 1;
        terminé.push(o);
      }
      if (inPrev(orderDate)) {
        prevRevenue += Number(o.amountHtg) || 0;
        prevBenefits += Number(o.profit) || 0;
        prevCount += 1;
      }
    });

    // Marc's commissions paid in period
    let commissionsPaidPeriod = 0;
    commissions.forEach((c) => {
      if (c.status !== 'paid') return;
      if (!inR(c.paidDate)) return;
      commissionsPaidPeriod += Number(c.commissionAmount) || 0;
    });

    // Recharge-tagged expenses in period
    let expensesPeriod = 0;
    businessExpenses.forEach((e) => {
      if (!inR(e.date)) return;
      const tag = (String(e.notes || '') + ' ' + String(e.description || '')).toLowerCase();
      if (!tag.includes('recharge')) return;
      const amtHtg = e.currency === 'USD' ? (Number(e.amount) || 0) * HTG_PER_USD : (Number(e.amount) || 0);
      expensesPeriod += amtHtg;
    });

    const netProfit = benefits - commissionsPaidPeriod - expensesPeriod;

    // Pending Marc commissions (total)
    const pendingCommissions = commissions
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0);

    // Loss orders (negative profit) in period
    const lossOrders = terminé.filter((o) => (Number(o.profit) || 0) < 0);

    // Delta
    const benefitsDelta = prevBenefits !== 0
      ? ((benefits - prevBenefits) / Math.abs(prevBenefits)) * 100
      : null;
    const countDelta = prevCount > 0
      ? ((count - prevCount) / prevCount) * 100
      : null;

    return {
      period: r,
      revenue, benefits, count,
      prevRevenue, prevBenefits, prevCount,
      benefitsDelta, countDelta,
      commissionsPaidPeriod, expensesPeriod, netProfit,
      pendingCommissions, lossOrders,
      terminéInPeriod: terminé,
    };
  }, [period, orders, commissions, businessExpenses]);

  return {
    orders, commissions, payouts, businessExpenses, staffPayroll,
    ...stats,
  };
}

// ─── CLIENT ANALYTICS ────────────────────────────────────
// Aggregates orders per client, computing total revenue/benefits/order count/avg days between.
// Keyed by `tagInfo` (the platform handle, e.g. @robertoc1988) since "Client" name is messy.
// Fallback to Client name if tagInfo is blank.
export function clientAnalytics(orders) {
  const buckets = {};
  orders.forEach((o) => {
    if (!isTermine(o)) return;
    const key = o.tagInfo || o.client || '(no id)';
    if (!buckets[key]) {
      buckets[key] = {
        key,
        name: o.client || key,
        tagInfo: o.tagInfo || '',
        whatsapp: o.whatsapp || '',
        platform: o.platform || '',
        orderCount: 0,
        revenue: 0,
        benefits: 0,
        lossCount: 0,
        firstOrder: null,
        lastOrder: null,
        dates: [],
      };
    }
    const b = buckets[key];
    b.orderCount += 1;
    b.revenue += Number(o.amountHtg) || 0;
    const profit = Number(o.profit) || 0;
    b.benefits += profit;
    if (profit < 0) b.lossCount += 1;
    const dt = parseDate(o.date);
    if (dt) {
      b.dates.push(dt);
      if (!b.firstOrder || dt < b.firstOrder) b.firstOrder = dt;
      if (!b.lastOrder || dt > b.lastOrder) b.lastOrder = dt;
    }
  });

  // Compute avg days between for each
  Object.values(buckets).forEach((b) => {
    if (b.dates.length < 2) {
      b.avgDaysBetween = null;
      return;
    }
    const sorted = b.dates.sort((a, z) => a - z);
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
      total += (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
    }
    b.avgDaysBetween = total / (sorted.length - 1);
  });

  return Object.values(buckets);
}
