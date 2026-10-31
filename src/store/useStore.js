
//

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, ApiError, SYSTEM_STATE_ROW_ID } from '../lib/api';
import { DEFAULT_RATES, convert } from '../lib/currency';
import { businessSlice, startAvsSyncLoop } from './businessSlice';

const uid = (prefix = 'tx') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeta = ({ _pending, ...rest }) => rest;
const nowISO = () => new Date().toISOString();

function enqueue(set, get, entity, action, payload) {
  set((s) => ({
    personal: {
      ...s.personal,
queue: [...(s.personal.queue || []), { entity, action, ...payload }],
    },
  }));
  Promise.resolve().then(() => get().syncQueue());
}

// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
export const BORROWED_CATEGORY = 'Borrowed';
export const LENT_CATEGORY     = 'Lent';

export const HOLDING_BUCKET_KEY = 'holding';


export const VENTURE_TYPES = [
  { id: 'business',    label: 'Other Business' },
  { id: 'partnership', label: 'Partnership' },
  { id: 'equity',      label: 'Equity Stake' },
  { id: 'sideHustle',  label: 'Side Hustle' },
{ id: 'investing',   label: 'Investing in Other' },
  { id: 'other',       label: 'Other' },
];

export const DEFAULT_WALLETS = [
{ id: 'w_cash',    name: 'Cash',           currency: 'HTG', allowAnyCurrency: true,  color: '#27ae60', icon: 'Banknote',   order: 1, balance: 0 },
{ id: 'w_moncash', name: 'MonCash',        currency: 'HTG', allowAnyCurrency: false, color: '#c2452f', icon: 'Smartphone', order: 2, balance: 0 },
{ id: 'w_natcash', name: 'NatCash',        currency: 'HTG', allowAnyCurrency: false, color: '#5b8def', icon: 'Smartphone', order: 3, balance: 0 },
{ id: 'w_wise',    name: 'Wise',           currency: 'USD', allowAnyCurrency: false, color: '#3d8b5f', icon: 'Globe',      order: 4, balance: 0 },
{ id: 'w_meru',    name: 'Meru',           currency: 'USD', allowAnyCurrency: false, color: '#9b59b6', icon: 'CreditCard', order: 5, balance: 0 },
{ id: 'w_marc',    name: "Marc's Account", currency: 'HTG', allowAnyCurrency: true,  color: '#d4a942', icon: 'UserCheck',  order: 6, balance: 0 },
{ id: 'w_mom',     name: "Mom's Account",  currency: 'HTG', allowAnyCurrency: false, color: '#e07a5f', icon: 'Heart',      order: 7, balance: 0 },
];

export const EMPTY_ARRAY = Object.freeze([]);
export const EMPTY_OBJECT = Object.freeze({});
export const DEFAULT_TODAY_STR = new Date().toISOString().slice(0, 10);

export function ensureDefaultWallets(wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) return DEFAULT_WALLETS;
  const byId = new Map(wallets.filter(Boolean).map((w) => [w.id, w]));
  const merged = DEFAULT_WALLETS.map((def) => ({
    ...def,
    ...(byId.get(def.id) || {}),
  }));
  for (const w of wallets) {
    if (w && w.id && !DEFAULT_WALLETS.some((d) => d.id === w.id)) {
      merged.push(w);
    }
  }
  return merged;
}

export const DANGER_MODE_BUCKETS = [
{ key: 'debtRepayment', name: 'Debt Repayment',         percentage: 40, dangerPercentage: 40, normalPercentage: 0,  color: '#c2452f', icon: 'Flame',      order: 1, enabled: true },
{ key: 'warChest',      name: 'Investment (War Chest)', percentage: 25, dangerPercentage: 25, normalPercentage: 50, color: '#d4a942', icon: 'TrendingUp', order: 2, enabled: true },
{ key: 'operations',    name: 'Operations',             percentage: 20, dangerPercentage: 20, normalPercentage: 30, color: '#3d8b5f', icon: 'Wallet',     order: 3, enabled: true },
{ key: 'reserve',       name: 'Reserve',                percentage: 10, dangerPercentage: 10, normalPercentage: 10, color: '#5b8def', icon: 'Shield',     order: 4, enabled: true },
{ key: 'baller',        name: 'Fun',                    percentage: 5,  dangerPercentage: 5,  normalPercentage: 5,  color: '#9b59b6', icon: 'Sparkles',   order: 5, enabled: true },
];
export const NORMAL_MODE_BUCKETS = [
{ key: 'warChest',      name: 'Investment (War Chest)', percentage: 50, dangerPercentage: 25, normalPercentage: 50, color: '#d4a942', icon: 'TrendingUp', order: 1, enabled: true },
{ key: 'operations',    name: 'Operations',             percentage: 30, dangerPercentage: 20, normalPercentage: 30, color: '#3d8b5f', icon: 'Wallet',     order: 2, enabled: true },
{ key: 'reserve',       name: 'Reserve',                percentage: 10, dangerPercentage: 10, normalPercentage: 10, color: '#5b8def', icon: 'Shield',     order: 3, enabled: true },
{ key: 'giving',        name: 'Giving',                 percentage: 5,  dangerPercentage: 0,  normalPercentage: 5,  color: '#e07a5f', icon: 'Heart',      order: 4, enabled: true },
{ key: 'baller',        name: 'Fun',                    percentage: 5,  dangerPercentage: 5,  normalPercentage: 5,  color: '#9b59b6', icon: 'Sparkles',   order: 5, enabled: true },
];
export const DEFAULT_BUCKETS = DANGER_MODE_BUCKETS;
export function dedupeBuckets(buckets) {
  const seen = new Set();
  const out = [];
  for (const b of (buckets || [])) {
    if (!b || !b.key || seen.has(b.key)) continue;
    seen.add(b.key);
    out.push(b);
  }
  return out;
}

export function resolveModeBuckets(buckets, isDangerMode) {
const template = isDangerMode ? DANGER_MODE_BUCKETS : NORMAL_MODE_BUCKETS;
const byKey = {};
for (const b of (buckets || [])) {
if (b && b.key) byKey[b.key] = b;
}
return template.map((tpl, idx) => {
const existing = byKey[tpl.key] || {};
const customPct = isDangerMode
? (existing.dangerPercentage !== undefined ? Number(existing.dangerPercentage) : tpl.percentage)
: (existing.normalPercentage !== undefined ? Number(existing.normalPercentage) : tpl.percentage);
return {
...tpl,
...existing,
id: existing.id || `bkt_${tpl.key}`,
key: tpl.key,
name: tpl.key === 'baller' && existing.name === 'Baller' ? 'Fun'
: tpl.key === 'warChest' && existing.name === 'War Chest' ? 'Investment (War Chest)'
: tpl.key === 'reserve' && existing.name === 'Reserve & Friction' ? 'Reserve'
: (existing.name || tpl.name),
percentage: customPct > 0 ? customPct : tpl.percentage,
dangerPercentage: existing.dangerPercentage ?? tpl.dangerPercentage,
normalPercentage: existing.normalPercentage ?? tpl.normalPercentage,
color: existing.color || tpl.color,
icon: existing.icon || tpl.icon,
order: idx + 1,
enabled: true,
};
});
}
// ════════════════════════════════════════════════════════════════════
// DEFAULT CATEGORIES
// ════════════════════════════════════════════════════════════════════
export const DEFAULT_CATEGORIES = [
  // Expenses
{ name: 'Food & Dining',  type: 'expense', icon: 'UtensilsCrossed', color: '#e07a5f', bucketKey: 'operations',    order: 1 },
{ name: 'Transport',      type: 'expense', icon: 'Car',             color: '#5b8def', bucketKey: 'operations',    order: 2 },
{ name: 'Housing',        type: 'expense', icon: 'Home',            color: '#a67c5a', bucketKey: 'operations',    order: 3 },
{ name: 'Health',         type: 'expense', icon: 'Heart',           color: '#c2452f', bucketKey: 'reserve',       order: 4 },
{ name: 'Subscriptions',  type: 'expense', icon: 'CreditCard',      color: '#7a8a8c', bucketKey: 'operations',    order: 5 },
{ name: 'Shopping',       type: 'expense', icon: 'ShoppingBag',     color: '#9b59b6', bucketKey: 'baller',        order: 6 },
{ name: 'Education',      type: 'expense', icon: 'BookOpen',        color: '#d4a942', bucketKey: 'warChest',      order: 7 },
{ name: 'Investment',     type: 'expense', icon: 'TrendingUp',      color: '#d4a942', bucketKey: 'warChest',      order: 8 },
{ name: 'Entertainment',  type: 'expense', icon: 'Sparkles',        color: '#9b59b6', bucketKey: 'baller',        order: 9 },
{ name: 'Repayment',      type: 'expense', icon: 'Flame',           color: '#c2452f', bucketKey: 'debtRepayment', order: 10 },
{ name: 'Conversion Fee', type: 'expense', icon: 'ArrowLeftRight',  color: '#7a8a8c', bucketKey: 'operations',    order: 11 },
{ name: 'Gift',           type: 'expense', icon: 'Gift',            color: '#e07a5f', bucketKey: 'baller',        order: 12 },
{ name: LENT_CATEGORY,    type: 'expense', icon: 'HandCoins',       color: '#5b8def', bucketKey: 'operations',    order: 13 },
{ name: 'Other',          type: 'expense', icon: 'MoreHorizontal',  color: '#7a8a8c', bucketKey: 'operations',    order: 99 },
  // Income
  { name: 'Salary',         type: 'income',  icon: 'Briefcase',       color: '#3d8b5f', bucketKey: '', order: 1 },
  { name: 'Freelance',      type: 'income',  icon: 'Laptop',          color: '#3d8b5f', bucketKey: '', order: 2 },
  { name: 'Investment',     type: 'income',  icon: 'TrendingUp',      color: '#d4a942', bucketKey: '', order: 3 },
  { name: 'Gift',           type: 'income',  icon: 'Gift',            color: '#e07a5f', bucketKey: '', order: 4 },
  { name: BORROWED_CATEGORY, type: 'income', icon: 'HandCoins',       color: '#d4a942', bucketKey: '', order: 5 },
  { name: 'Other',          type: 'income',  icon: 'MoreHorizontal',  color: '#7a8a8c', bucketKey: '', order: 99 },
];

export const CATEGORY_TO_BUCKET = {
'Food & Dining':     'operations',
'Transport':         'operations',
'Housing':           'operations',
'Health':            'reserve',
'Subscriptions':     'operations',
'Shopping':          'baller',
'Education':         'warChest',
'Investment':        'warChest',
'Entertainment':     'baller',
'Repayment':         'debtRepayment',
'Conversion Fee':    'operations',
'Gift':              'baller',
[LENT_CATEGORY]:     'operations',
'Expected expense':  'operations',
'Other':             'operations',
'Salary':            null,
'Freelance':         null,
'Expected income':   null,
[BORROWED_CATEGORY]: null,
};

export function buildCategoryToBucket(categories) {
  const map = { ...CATEGORY_TO_BUCKET };
for (const c of (categories || [])) {
    if (c.type === 'expense' && c.bucketKey) map[c.name] = c.bucketKey;
  }
  return map;
}

export function autoSplitIncome(amount, buckets) {
const list = Array.isArray(buckets) && buckets.length > 0 ? buckets : DANGER_MODE_BUCKETS;
const enabled = list
.filter((b) => b && b.enabled !== false && Number(b.percentage) > 0)
.sort((a, b) => (a.order || 0) - (b.order || 0));
const totalPct = enabled.reduce((sum, b) => sum + Number(b.percentage || 0), 0);
  if (totalPct === 0) return {};
  const split = {};
  let allocated = 0;
  enabled.forEach((b, i) => {
    if (i === enabled.length - 1) {
      split[b.key] = Math.round((amount - allocated) * 100) / 100;
    } else {
const portion = Math.round((amount * Number(b.percentage) / totalPct) * 100) / 100;
      split[b.key] = portion;
      allocated += portion;
    }
  });
  return split;
}

export function autoSplitExpense(amount, category, categoryMap = CATEGORY_TO_BUCKET) {
  const bucketKey = categoryMap[category] || 'operations';
  return { [bucketKey]: -Math.abs(amount) };
}

export function inferWalletIdForTx(tx) {
if (tx.walletId) return tx.walletId;
const n = String(tx.notes || '').toLowerCase();
if (n.includes('moncash')) return 'w_moncash';
if (n.includes('natcom') || n.includes('natcash')) return 'w_natcash';
if (n.includes('cash') || n.includes('especes') || n.includes('hand')) return 'w_cash';
if (n.includes('wise')) return 'w_wise';
if (n.includes('meru')) return 'w_meru';
if (n.includes('marc')) return 'w_marc';
if (n.includes('mom')) return 'w_mom';
if (tx.currency === 'USD') return 'w_wise';
return 'w_moncash';
}
export function reconcileHistoricalSheetData(transactions, existingDebts, existingDebtEvents, activeBuckets, categories) {
const categoryMap = buildCategoryToBucket(categories);
const debts = [...(existingDebts || [])];
const debtEvents = [...(existingDebtEvents || [])];
const linkedTxIds = new Set(debts.map((d) => d.linkedTxId).filter(Boolean));
const extractCreditor = (notes = '') => {
const raw = String(notes || '').trim();
if (!raw) return 'Loan';
let cleaned = raw
.replace(/^paid\s+/i, '')
.replace(/^debt\s+/i, '')
.replace(/\s+debt$/i, '')
.replace(/\s+book\s+money$/i, '')
.trim();
if (/weekly\s+(family\s+)?money(\s+loan)?/i.test(cleaned) || /weekly\s+family\s+money/i.test(raw)) {
return 'Weekly Money Loan';
}
if (/^jude/i.test(cleaned)) return 'Jude';
if (/^marc/i.test(cleaned)) return 'Marc';
if (/^jemima/i.test(cleaned)) return 'Jemima';
if (/^mom/i.test(cleaned)) return 'Mom';
return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};
const sortedTxs = [...(transactions || [])].sort(
(a, b) => new Date(a.date || 0) - new Date(b.date || 0)
);
for (const tx of sortedTxs) {
if (tx.type === 'income' && tx.category === BORROWED_CATEGORY) {
if (linkedTxIds.has(tx.id) || tx.linkedDebtId) continue;
const creditor = extractCreditor(tx.notes);
const debtId = `debt_hist_${tx.id}`;
tx.linkedDebtId = debtId;
linkedTxIds.add(tx.id);
debts.push({
id: debtId,
creditor,
principal: Math.abs(Number(tx.amount) || 0),
currency: tx.currency || 'USD',
dueDate: '',
notes: tx.notes || '',
status: 'active',
direction: 'owe',
interestRate: 0,
interestType: 'simple',
linkedTxId: tx.id,
createdAt: tx.createdAt || tx.date || nowISO(),
updatedAt: tx.updatedAt || tx.date || nowISO(),
});
}
}
const recordedRepaymentTxIds = new Set(debtEvents.map((e) => e.linkedTxId || e.id));
for (const tx of sortedTxs) {
if (tx.type === 'expense' && tx.category === 'Repayment') {
const evtId = `devt_hist_${tx.id}`;
if (recordedRepaymentTxIds.has(evtId) || recordedRepaymentTxIds.has(tx.id)) continue;
const creditor = extractCreditor(tx.notes);
const candidates = debts.filter(
(d) =>
(d.direction || 'owe') === 'owe' &&
d.creditor.toLowerCase() === creditor.toLowerCase() &&
(d.currency || 'USD') === (tx.currency || 'USD')
);
const targetDebt = candidates[0] || debts.find(
(d) => (d.direction || 'owe') === 'owe' && d.creditor.toLowerCase().includes(creditor.toLowerCase())
);
if (targetDebt) {
const alreadyRepaid = computeDebtRepaid(debtEvents, targetDebt.id);
const amt = Math.min(Math.abs(Number(tx.amount) || 0), Math.max(0, targetDebt.principal - alreadyRepaid));
if (amt > 0) {
const balanceAfter = targetDebt.principal - (alreadyRepaid + amt);
debtEvents.push({
id: evtId,
debtId: targetDebt.id,
linkedTxId: tx.id,
type: 'repayment',
amount: amt,
currency: tx.currency || targetDebt.currency || 'USD',
balanceAfter,
balanceAfterBase: balanceAfter,
baseCurrency: tx.currency || 'USD',
interestPaid: Number(tx.interestAmount) || 0,
notes: tx.notes || '',
date: tx.date || nowISO(),
createdAt: tx.createdAt || tx.date || nowISO(),
});
tx.linkedDebtId = targetDebt.id;
if (balanceAfter <= 0) targetDebt.status = 'paid';
}
}
}
}
const enrichedTransactions = (transactions || []).map((tx) => {
const walletId = inferWalletIdForTx(tx);
const hasBuckets = tx.buckets && Object.keys(tx.buckets).length > 0;
if (hasBuckets) return { ...tx, walletId };
const amt = Math.abs(Number(tx.amount) || 0);
if (amt <= 0) return { ...tx, buckets: {}, walletId };
if (tx.type === 'income' && tx.category === BORROWED_CATEGORY) {
return { ...tx, buckets: {}, walletId };
}
if (tx.type === 'income') {
return {
...tx,
walletId,
buckets: autoSplitIncome(amt, activeBuckets),
};
}
if (tx.type === 'expense') {
const targetKey = tx.category === 'Repayment'
? 'debtRepayment'
: (categoryMap[tx.category] || 'operations');
return {
...tx,
walletId,
buckets: { [targetKey]: -amt },
};
}
return { ...tx, walletId };
});
return {
transactions: enrichedTransactions,
debts,
debtEvents,
};
}
// ════════════════════════════════════════════════════════════════════
// INTEREST math
// ════════════════════════════════════════════════════════════════════

export function computeAccruedInterest(debt, asOf = new Date()) {
  const rate = (Number(debt.interestRate) || 0) / 100;
  if (rate <= 0) return 0;
  const start = new Date(debt.createdAt || asOf);
  const end = new Date(asOf);
  if (end <= start) return 0;
  const yearsElapsed = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  const type = debt.interestType || 'simple';
  const p = Number(debt.principal) || 0;
  if (type === 'compound') {
    return p * Math.pow(1 + rate, yearsElapsed) - p;
  }
  return p * rate * yearsElapsed;
}


export function computeProjectedPayback(debt) {
  const rate = (Number(debt.interestRate) || 0) / 100;
  const p = Number(debt.principal) || 0;
  if (rate <= 0) return p;
  const start = new Date(debt.createdAt || new Date());
  const end = debt.dueDate ? new Date(debt.dueDate) : new Date();
  if (end <= start) return p;
  const yearsElapsed = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  const type = debt.interestType || 'simple';
  if (type === 'compound') return p * Math.pow(1 + rate, yearsElapsed);
  return p * (1 + rate * yearsElapsed);
}

// ════════════════════════════════════════════════════════════════════
// RECURRING ENGINE
// ════════════════════════════════════════════════════════════════════
export function computeNextDueAt(recurring, fromDate = new Date()) {
  const from = new Date(fromDate);
  const interval = Math.max(1, Number(recurring.interval) || 1);
  const result = new Date(from);

  switch (recurring.frequency) {
    case 'daily': {
      result.setDate(result.getDate() + interval);
      break;
    }
    case 'weekly': {
      const days = (recurring.daysOfWeek || '').split(',').map(Number).filter(d => !isNaN(d) && d >= 0 && d <= 6);
      if (days.length > 0) {
        let addDays = 1;
        while (addDays <= 7 * interval) {
          const candidate = new Date(from);
          candidate.setDate(candidate.getDate() + addDays);
          if (days.includes(candidate.getDay())) {
            return candidate.toISOString();
          }
          addDays++;
        }
      }
      result.setDate(result.getDate() + 7 * interval);
      break;
    }
    case 'monthly': {
      result.setMonth(result.getMonth() + interval);
      const targetDay = Number(recurring.dayOfMonth) || from.getDate();
      const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(targetDay, lastDayOfMonth));
      break;
    }
    case 'yearly': {
      result.setFullYear(result.getFullYear() + interval);
      break;
    }
    default:
      result.setMonth(result.getMonth() + 1);
  }
  return result.toISOString();
}

export function tickRecurring(recurring, existingPending) {
  const now = new Date();
  const newPending = [];
  const updates = [];

  for (const r of recurring) {
    if (r.paused) continue;
    if (r.endDate && new Date(r.endDate) < now) continue;
    if (!r.nextDueAt) continue;

    let nextDue = new Date(r.nextDueAt);
    let lastFired = r.lastFiredAt;
    let firedThisTick = false;

    while (nextDue <= now) {
      const dupe = existingPending.find(
        (p) => p.recurringId === r.id && p.dueAt === nextDue.toISOString()
      );
      if (!dupe) {
        newPending.push({
          id: uid('pnd'),
          recurringId: r.id,
          name: r.name,
          amount: r.amount,
          currency: r.currency,
          type: r.type,
          category: r.category,
          notes: r.notes || '',
          tags: r.tags || '',
          dueAt: nextDue.toISOString(),
          status: 'pending',
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
      }
      lastFired = nextDue.toISOString();
      const next = computeNextDueAt(r, nextDue);
      nextDue = new Date(next);
      firedThisTick = true;
      if (newPending.length > 50) break;
    }

    if (firedThisTick) {
      updates.push({
        ...r,
        lastFiredAt: lastFired,
        nextDueAt: nextDue.toISOString(),
        updatedAt: nowISO(),
      });
    }
  }

  return { newPending, updates };
}

// ════════════════════════════════════════════════════════════════════
// APP SLICE
// ════════════════════════════════════════════════════════════════════
const appSlice = (set, get) => ({
  app: {
    workspace: 'personal',
    theme: 'dark',
    online: true,
    activeTab: 'dashboard',
baseCurrency: 'HTG',
    rates: { ...DEFAULT_RATES },
    debtAcknowledged: false,
dangerModeOverride: 'auto', // 'auto' | 'danger' | 'normal'
privacyMask: true,          // Hides less-interesting noisy charts behind a toggle while keeping accurate secondary cards below Buckets
quickSpendBucketKey: null,
selectedCalendarDate: new Date().toISOString().slice(0, 10),
calendarViewMode: 'day',    // 'day' | 'week' | 'month' | 'compare'
highlightedTxId: null,
    editingTxId: null,
    searchQuery: '',
    searchOpen: false,
    settingsOpen: false,
  },
  setWorkspace: (workspace) => set((s) => ({ app: { ...s.app, workspace } })),
  setTheme: (theme) => set((s) => ({ app: { ...s.app, theme } })),
  toggleTheme: () =>
    set((s) => ({ app: { ...s.app, theme: s.app.theme === 'light' ? 'dark' : 'light' } })),
  setActiveTab: (tab) => set((s) => ({ app: { ...s.app, activeTab: tab } })),
openCalendarOnDate: (dateInput, viewMode = 'day') => {
let dateKey = '';
if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
dateKey = dateInput.slice(0, 10);
} else {
const d = new Date(dateInput || new Date());
if (!isNaN(d)) {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, '0');
const day = String(d.getDate()).padStart(2, '0');
dateKey = `${y}-${m}-${day}`;
} else {
dateKey = new Date().toISOString().slice(0, 10);
}
}
set((s) => ({
app: {
...s.app,
selectedCalendarDate: dateKey,
calendarViewMode: viewMode,
activeTab: 'calendar',
},
}));
},
setSelectedCalendarDate: (dateKey) =>
set((s) => ({ app: { ...s.app, selectedCalendarDate: dateKey } })),
setCalendarViewMode: (mode) =>
set((s) => ({ app: { ...s.app, calendarViewMode: mode } })),
setHighlightedTxId: (txId) =>
set((s) => ({ app: { ...s.app, highlightedTxId: txId } })),
  setBaseCurrency: (c) => set((s) => ({ app: { ...s.app, baseCurrency: c } })),
  setRate: (currency, value) =>
    set((s) => ({ app: { ...s.app, rates: { ...s.app.rates, [currency]: Number(value) } } })),
  acknowledgeDebt: () => set((s) => ({ app: { ...s.app, debtAcknowledged: true } })),
setDangerModeOverride: (mode) => {
set((s) => ({ app: { ...s.app, dangerModeOverride: mode } }));
get().syncBucketMode();
},
setPrivacyMask: (masked) => set((s) => ({ app: { ...s.app, privacyMask: Boolean(masked) } })),
togglePrivacyMask: () => set((s) => ({ app: { ...s.app, privacyMask: !s.app.privacyMask } })),
setQuickSpendBucket: (bucketKey) => set((s) => ({ app: { ...s.app, quickSpendBucketKey: bucketKey } })),
  setEditingTx: (id) => set((s) => ({ app: { ...s.app, editingTxId: id } })),
  setSearchQuery: (q) => set((s) => ({ app: { ...s.app, searchQuery: q } })),
  setSearchOpen: (open) => set((s) => ({ app: { ...s.app, searchOpen: open, searchQuery: open ? s.app.searchQuery : '' } })),
  setSettingsOpen: (open) => set((s) => ({ app: { ...s.app, settingsOpen: open } })),
});

// ════════════════════════════════════════════════════════════════════
// PERSONAL SLICE
// ════════════════════════════════════════════════════════════════════
const personalSlice = (set, get) => ({
  personal: {
    transactions:     [],
    budgets:          [],
    budgetItems:      [],
    debts:            [],
    debtEvents:       [],
    investments:      [],
    investmentEvents: [],
    ventures:         [],
    ventureEvents:    [],
    buckets:          [],
    goals:            [],
    recurring:        [],
    pending:          [],
    templates:        [],
    categories:       [],

    borrowedDeployments:   [],
    ventureDistributions:  [],
    ventureMilestones:     [],
    ventureJournal:        [],
wallets:               DEFAULT_WALLETS, // The 6 places money can be (MonCash, NatCash, Wise, Meru, Marc's Account, Mom's Account)
conversions:           [],              // Currency / wallet conversions + fees taken
bucketNotes:           {},
dismissedAnomalies:    [],
    queue: [],
    lastSyncAt: null,
    lastTickAt: null,
    syncing: false,
    syncError: null,
    syncLog: [],
    lastDeleted: null,
  },

syncBucketMode: () => {
const state = get();
const isDanger = selectIsDangerMode(state);
const resolved = resolveModeBuckets(state.personal.buckets, isDanger);
set((s) => ({
personal: {
...s.personal,
buckets: resolved,
},
}));
},
  initializeBuckets: () => {
const state = get();
const isDanger = selectIsDangerMode(state);
const existing = dedupeBuckets(state.personal.buckets).filter((b) => b.key !== 'holding');
const resolved = resolveModeBuckets(existing, isDanger);
set((s) => ({
personal: {
...s.personal,
buckets: resolved,
},
}));
},
initializeWallets: () => {
const existing = get().personal.wallets || [];
if (existing.length === 0) {
set((s) => ({ personal: { ...s.personal, wallets: DEFAULT_WALLETS } }));
return;
    }
const byId = new Map(existing.map((w) => [w.id, w]));
const merged = DEFAULT_WALLETS.map((def) => ({
...def,
...(byId.get(def.id) || {}),
}));
for (const w of existing) {
if (!DEFAULT_WALLETS.some((d) => d.id === w.id)) {
merged.push(w);
}
    }
set((s) => ({ personal: { ...s.personal, wallets: merged } }));
  },

  initializeCategories: () => {
    const existing = get().personal.categories;
    if (existing.length === 0) {
      const newCats = DEFAULT_CATEGORIES.map((c) => ({
        ...c, id: uid('cat'), enabled: true, createdAt: nowISO(), updatedAt: nowISO(),
      }));
      set((s) => ({ personal: { ...s.personal, categories: newCats } }));

      return;
    }

    const toAdd = [];
for (const reqName of [BORROWED_CATEGORY, LENT_CATEGORY, 'Repayment', 'Conversion Fee']) {
const tpl = DEFAULT_CATEGORIES.find((c) => c.name === reqName);
if (tpl && !existing.some((c) => c.name === tpl.name && c.type === tpl.type)) {
toAdd.push({
...tpl, id: uid('cat'), enabled: true,
order: existing.filter((c) => c.type === tpl.type).length + 1,
createdAt: nowISO(), updatedAt: nowISO(),
});
}
    }
    if (toAdd.length > 0) {
      set((s) => ({ personal: { ...s.personal, categories: [...s.personal.categories, ...toAdd] } }));

    }
  },

updateWalletBalance: (walletId, newBalance, newCurrency) => {
set((s) => ({
personal: {
...s.personal,
wallets: (s.personal.wallets || DEFAULT_WALLETS).map((w) => {
if (w.id !== walletId) return w;
return {
...w,
balance: Number(newBalance) || 0,
currency: newCurrency || w.currency,
manualUpdatedAt: nowISO(),
};
}),
},
}));
enqueue(set, get, 'state', 'update', { id: SYSTEM_STATE_ROW_ID });
},
addCustomWallet: ({ name, currency = 'HTG', allowAnyCurrency = true, color = '#5b8def' }) => {
const w = {
id: uid('wlt'),
name: name.trim(),
currency,
allowAnyCurrency,
color,
icon: 'Wallet',
order: (get().personal.wallets || []).length + 1,
balance: 0,
manualUpdatedAt: nowISO(),
};
set((s) => ({
personal: {
...s.personal,
wallets: [...(s.personal.wallets || DEFAULT_WALLETS), w],
},
}));
enqueue(set, get, 'state', 'update', { id: SYSTEM_STATE_ROW_ID });
return w;
},
reconcileWalletDifference: ({ diffBase, actionType = 'expense', bucketKey = 'operations', date, notes = '' }) => {
const baseCurrency = get().app.baseCurrency;
const absDiff = Math.round(Math.abs(Number(diffBase) || 0) * 100) / 100;
if (absDiff <= 0.01) return null;
if (actionType === 'expense') {
return get().addTransaction({
date: date || nowISO(),
amount: absDiff,
currency: baseCurrency,
category: 'Other',
type: 'expense',
notes: notes || 'Wallet reconciliation adjustment (untracked spend/fee)',
buckets: { [bucketKey]: -absDiff },
skipWalletDelta: true, // Wallets already reflect this lower balance
});
} else {
const state = get();
const activeBuckets = selectActiveBuckets(state);
return get().addTransaction({
date: date || nowISO(),
amount: absDiff,
currency: baseCurrency,
category: 'Other',
type: 'income',
notes: notes || 'Wallet reconciliation adjustment (unallocated funds)',
buckets: bucketKey === 'auto' ? autoSplitIncome(absDiff, activeBuckets) : { [bucketKey]: absDiff },
skipWalletDelta: true,
});
}
},
addConversion: ({
date,
fromWalletId = 'w_wise',
fromAmount,
fromCurrency = 'USD',
toWalletId = 'w_moncash',
toAmount,
toCurrency = 'HTG',
feeAmount = 0,
feeCurrency = 'HTG',
feeBucketKey = 'operations',
notes = '',
}) => {
const convId = uid('cnv');
const effectiveDate = date || nowISO();
const fAmt = Math.abs(Number(fromAmount) || 0);
const tAmt = Math.abs(Number(toAmount) || 0);
const fee  = Math.abs(Number(feeAmount) || 0);
const rates = get().app.rates;
set((s) => ({
personal: {
...s.personal,
wallets: (s.personal.wallets || DEFAULT_WALLETS).map((w) => {
if (w.id === fromWalletId && w.manualUpdatedAt) {
const delta = convert(fAmt, fromCurrency, w.currency, rates);
return { ...w, balance: Math.max(0, (Number(w.balance) || 0) - delta) };
}
if (w.id === toWalletId && w.manualUpdatedAt) {
const delta = convert(tAmt, toCurrency, w.currency, rates);
return { ...w, balance: (Number(w.balance) || 0) + delta };
}
return w;
}),
},
}));
let feeTxId = '';
if (fee > 0) {
const fromWallet = (get().personal.wallets || DEFAULT_WALLETS).find((w) => w.id === fromWalletId);
const toWallet   = (get().personal.wallets || DEFAULT_WALLETS).find((w) => w.id === toWalletId);
const feeTx = get().addTransaction({
date: effectiveDate,
amount: fee,
currency: feeCurrency,
category: 'Conversion Fee',
type: 'expense',
walletId: toWalletId,
notes: notes
? `Fee · ${notes}`
: `Conversion fee (${fromWallet?.name || fromCurrency} → ${toWallet?.name || toCurrency})`,
buckets: { [feeBucketKey]: -fee },
skipWalletDelta: true,
});
feeTxId = feeTx?.id || '';
}
const conv = {
id: convId,
date: effectiveDate,
fromWalletId,
fromAmount: fAmt,
fromCurrency,
toWalletId,
toAmount: tAmt,
toCurrency,
feeAmount: fee,
feeCurrency,
feeTxId,
notes,
createdAt: nowISO(),
};
set((s) => ({
personal: {
...s.personal,
conversions: [conv, ...(s.personal.conversions || [])],
},
}));
enqueue(set, get, 'state', 'update', { id: SYSTEM_STATE_ROW_ID });
return conv;
},
removeConversion: (id) => {
const conv = (get().personal.conversions || []).find((c) => c.id === id);
if (conv?.feeTxId) {
get().deleteTransaction(conv.feeTxId);
}
set((s) => ({
personal: {
...s.personal,
conversions: (s.personal.conversions || []).filter((c) => c.id !== id),
},
}));
enqueue(set, get, 'state', 'update', { id: SYSTEM_STATE_ROW_ID });
},
spendFromBorrowedCapital: ({ amount, currency = 'HTG', note = 'Borrowed capital spent', debtId = '' }) => {
const state = get();
const rates = state.app.rates;
const debts = (state.personal.debts || []).filter(
(d) => (d.direction || 'owe') === 'owe' && d.status !== 'paid'
);
let remainingToDeploy = Math.abs(Number(amount) || 0);
if (remainingToDeploy <= 0) return [];
const createdDeps = [];
const targetDebts = debtId ? debts.filter((d) => d.id === debtId) : debts;
for (const d of targetDebts) {
if (remainingToDeploy <= 0.001) break;
const repaid = computeDebtRepaid(state.personal.debtEvents || [], d.id);
const remPrincipal = Math.max(0, (Number(d.principal) || 0) - repaid);
const alreadyDeployed = (state.personal.borrowedDeployments || [])
.filter((dep) => dep.sourceDebtId === d.id)
.reduce((sum, dep) => sum + convert(Number(dep.amount) || 0, dep.currency || 'USD', d.currency, rates), 0);
const availableInDebt = Math.max(0, remPrincipal - alreadyDeployed);
if (availableInDebt <= 0.001) continue;
const neededInDebtCurr = convert(remainingToDeploy, currency, d.currency, rates);
const takeInDebtCurr = Math.min(availableInDebt, neededInDebtCurr);
if (takeInDebtCurr > 0) {
const dep = get().recordBorrowedDeployment({
sourceDebtId: d.id,
destinationType: 'spent',
destinationLabel: note || 'Spent from borrowed capital',
amount: Math.round(takeInDebtCurr * 100) / 100,
currency: d.currency,
note,
});
createdDeps.push(dep);
remainingToDeploy -= convert(takeInDebtCurr, d.currency, currency, rates);
}
}
return createdDeps;
},
setRemainingBorrowedCapital: (desiredRemaining, currency) => {
const state = get();
const base = currency || state.app.baseCurrency;
const rates = state.app.rates;
const currentPool = computeBorrowedPool(
state.personal.debts,
state.personal.debtEvents,
state.personal.borrowedDeployments,
base,
rates
);
const target = Math.max(0, Number(desiredRemaining) || 0);
const diff = currentPool - target;
if (diff > 0.01) {
get().spendFromBorrowedCapital({
amount: diff,
currency: base,
note: 'Adjusted remaining borrowed capital',
});
} else if (diff < -0.01) {
let toRestoreBase = Math.abs(diff);
const updatedDeps = [];
const currentDeps = [...(state.personal.borrowedDeployments || [])].reverse();
for (const dep of currentDeps) {
if (dep.destinationType === 'spent' && toRestoreBase > 0.01) {
const depBase = convert(Number(dep.amount) || 0, dep.currency || 'USD', base, rates);
if (depBase <= toRestoreBase + 0.01) {
toRestoreBase -= depBase;
continue; // drop this 'spent' marker
} else {
const newAmtBase = depBase - toRestoreBase;
const newAmt = convert(newAmtBase, base, dep.currency || 'USD', rates);
updatedDeps.push({ ...dep, amount: Math.round(newAmt * 100) / 100 });
toRestoreBase = 0;
continue;
}
}
updatedDeps.push(dep);
}
set((s) => ({
personal: {
...s.personal,
borrowedDeployments: updatedDeps.reverse(),
},
}));
enqueue(set, get, 'state', 'update', { id: SYSTEM_STATE_ROW_ID });
}
},
setBucketNote: (bucketKey, note) => {
set((s) => ({
personal: {
...s.personal,
bucketNotes: { ...(s.personal.bucketNotes || {}), [bucketKey]: note },
},
}));
enqueue(set, get, 'state', 'update', { id: SYSTEM_STATE_ROW_ID });
},
fixTransactionCurrency: (txId, newCurrency) => {
const tx = get().personal.transactions.find((t) => t.id === txId);
if (!tx) return null;
return get().updateTransaction(txId, { currency: newCurrency });
},
dismissAnomaly: (txId) => {
set((s) => ({
personal: {
...s.personal,
dismissedAnomalies: [...new Set([...(s.personal.dismissedAnomalies || []), txId])],
},
}));
},
  // ─── Transactions ─────────────────────────────────────────

  addTransaction: (input) => {
const state = get();
const isDanger = selectIsDangerMode(state);
const buckets = resolveModeBuckets(state.personal.buckets, isDanger);
const categories = state.personal.categories;
    const categoryMap = buildCategoryToBucket(categories);

    const isBorrowed = input.type === 'income'  && input.category === BORROWED_CATEGORY;
    const isLent     = input.type === 'expense' && input.category === LENT_CATEGORY;

    let bucketAllocation = input.buckets;
    if (!bucketAllocation) {
      if (isBorrowed) {

        bucketAllocation = {};
      } else if (isLent) {
        if (input.bucketSplit && typeof input.bucketSplit === 'object') {

          bucketAllocation = {};
          for (const [k, v] of Object.entries(input.bucketSplit)) {
            bucketAllocation[k] = -Math.abs(Number(v) || 0);
          }
        } else {
          const sourceKey = input.sourceBucketKey || 'operations';
          bucketAllocation = { [sourceKey]: -Math.abs(Number(input.amount)) };
        }
      } else if (input.type === 'income') {
        bucketAllocation = autoSplitIncome(Number(input.amount), buckets);
      } else if (input.type === 'expense') {
if (input.sourceBucketKey === 'borrowedPool') {
bucketAllocation = {};
get().spendFromBorrowedCapital({
amount: Number(input.amount),
currency: input.currency || 'USD',
note: input.notes || input.category || 'Expense from borrowed capital',
});
} else if (input.sourceBucketKey) {
bucketAllocation = { [input.sourceBucketKey]: -Math.abs(Number(input.amount)) };
} else {
bucketAllocation = autoSplitExpense(Number(input.amount), input.category, categoryMap);
}
      } else {
        bucketAllocation = {};
      }
    }

    let tagsStr = '';
    if (Array.isArray(input.tags)) tagsStr = input.tags.filter(Boolean).join(',');
    else if (typeof input.tags === 'string') tagsStr = input.tags;

    const txId = input.id || uid('tx');
const walletId = input.walletId || inferWalletIdForTx(input);
if (!input.skipWalletDelta && walletId && input.type !== 'transfer') {
const rates = state.app.rates;
set((s) => ({
personal: {
...s.personal,
wallets: (s.personal.wallets || DEFAULT_WALLETS).map((w) => {
if (w.id !== walletId || !w.manualUpdatedAt) return w;
const delta = convert(Math.abs(Number(input.amount) || 0), input.currency || 'USD', w.currency, rates);
const nextBal = input.type === 'income'
? (Number(w.balance) || 0) + delta
: Math.max(0, (Number(w.balance) || 0) - delta);
return { ...w, balance: Math.round(nextBal * 100) / 100 };
}),
},
}));
}

    // Auto-create linked debt for Borrowed/Lent
let linkedDebtId = input.linkedDebtId || '';
if ((isBorrowed || isLent) && (input.counterparty || input.notes) && !linkedDebtId) {
      const direction = isBorrowed ? 'owe' : 'receivable';
const creditorName = (input.counterparty || input.notes || 'Loan').trim();
      const debt = {
        id: uid('debt'),
creditor: creditorName,
        principal: Number(input.amount),
        currency: input.currency || 'USD',
        dueDate: input.dueDate || '',
        notes: input.notes || '',
        status: 'active',
        direction,
        interestRate: Number(input.interestRate) || 0,
        interestType: input.interestType || 'simple',
        linkedTxId: txId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      linkedDebtId = debt.id;
      set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, debt] } }));
get().syncBucketMode();
    }

    const tx = {
      id: txId,
      date: input.date || nowISO(),
      amount: Number(input.amount),
      currency: input.currency || 'USD',
      category: input.category || 'Other',
      type: input.type,
walletId,
      notes: input.notes || '',
      tags: tagsStr,
      buckets: bucketAllocation,
      linkedDebtId,
interestAmount: Number(input.interestAmount) || 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    return tx;
  },

  updateTransaction: (id, patch) => {
    let updated = null;
const state = get();
const isDanger = selectIsDangerMode(state);
const buckets = resolveModeBuckets(state.personal.buckets, isDanger);
const categories = state.personal.categories;
    const categoryMap = buildCategoryToBucket(categories);

    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.map((t) => {
          if (t.id !== id) return t;
          const newAmount   = patch.amount   !== undefined ? Number(patch.amount) : t.amount;
          const newType     = patch.type     !== undefined ? patch.type     : t.type;
          const newCategory = patch.category !== undefined ? patch.category : t.category;

          let newBuckets = patch.buckets !== undefined ? patch.buckets : t.buckets;
          if (patch.buckets === undefined && (
            patch.amount !== undefined ||
            patch.type !== undefined ||
            patch.category !== undefined
          )) {
            const isBorrowedNow = newType === 'income'  && newCategory === BORROWED_CATEGORY;
            const isLentNow     = newType === 'expense' && newCategory === LENT_CATEGORY;
            if (isBorrowedNow) {
              newBuckets = {};
            } else if (isLentNow) {
              const sourceKey = patch.sourceBucketKey || 'operations';
              newBuckets = { [sourceKey]: -Math.abs(newAmount) };
            } else if (newType === 'income') {
              newBuckets = autoSplitIncome(newAmount, buckets);
            } else if (newType === 'expense') {
              newBuckets = autoSplitExpense(newAmount, newCategory, categoryMap);
            }
          }

          let newTags = t.tags;
          if (patch.tags !== undefined) {
            newTags = Array.isArray(patch.tags) ? patch.tags.filter(Boolean).join(',') : patch.tags;
          }

          updated = {
            ...t, ...patch,
            amount: newAmount,
            type: newType,
            category: newCategory,
            tags: newTags,
            buckets: newBuckets,
            updatedAt: nowISO(),
            _pending: true,
          };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'transaction', 'update', stripMeta(updated));
    return updated;
  },

  deleteTransaction: (id) => {
    const tx = get().personal.transactions.find((t) => t.id === id);

    let unclaimedGoal = null;
    if (tx && tx.category === 'Goal' && typeof tx.notes === 'string' && tx.notes.startsWith('🎯')) {
      const goalName = tx.notes.replace(/^🎯\s*/, '').trim();
      const linkedGoal = get().personal.goals.find(
        (g) => g.name === goalName && g.status === 'claimed'
      );
      if (linkedGoal) {
        unclaimedGoal = {
          ...linkedGoal, status: 'active', claimedAt: '', claimedAmount: 0, updatedAt: nowISO(),
        };
      }
    }

    let linkedDebt = null;
if (tx && tx.linkedDebtId && tx.category === BORROWED_CATEGORY) {
      linkedDebt = get().personal.debts.find((d) => d.id === tx.linkedDebtId);
    }

    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.filter((t) => t.id !== id),
        goals: unclaimedGoal
          ? s.personal.goals.map((g) => (g.id === unclaimedGoal.id ? unclaimedGoal : g))
          : s.personal.goals,
        debts: linkedDebt
          ? s.personal.debts.filter((d) => d.id !== linkedDebt.id)
          : s.personal.debts,
debtEvents: s.personal.debtEvents.filter((e) => e.linkedTxId !== id),
        lastDeleted: tx
          ? { tx, unclaimedGoal, linkedDebt, deletedAt: Date.now() }
          : s.personal.lastDeleted,
      },
    }));
get().syncBucketMode();
    enqueue(set, get, 'transaction', 'delete', { id });

  },

  undoDelete: () => {
    const last = get().personal.lastDeleted;
    if (!last) return null;
    const tx = { ...last.tx, _pending: true, updatedAt: nowISO() };

    let reclaimed = null;
    if (last.unclaimedGoal) {
      reclaimed = {
        ...last.unclaimedGoal, status: 'claimed',
        claimedAt: tx.date || nowISO(), claimedAmount: tx.amount, updatedAt: nowISO(),
      };
    }
    const restoredDebt = last.linkedDebt ? { ...last.linkedDebt, updatedAt: nowISO() } : null;

    set((s) => ({
      personal: {
        ...s.personal,
        transactions: [tx, ...s.personal.transactions]
          .sort((a, b) => new Date(b.date) - new Date(a.date)),
        goals: reclaimed
          ? s.personal.goals.map((g) => (g.id === reclaimed.id ? reclaimed : g))
          : s.personal.goals,
        debts: restoredDebt
          ? [...s.personal.debts, restoredDebt]
          : s.personal.debts,
        lastDeleted: null,
      },
    }));
get().syncBucketMode();
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));

    return tx;
  },

  clearLastDeleted: () => set((s) => ({ personal: { ...s.personal, lastDeleted: null } })),

  // ─── Buckets ──────────────────────────────────────────────
  updateBucket: (id, patch) => {
    let updated = null;
const isDanger = selectIsDangerMode(get());
    set((s) => ({
      personal: {
        ...s.personal,
        buckets: s.personal.buckets.map((b) => {
if (b.id !== id && b.key !== id) return b;
const pctPatch = patch.percentage !== undefined
? (isDanger ? { dangerPercentage: Number(patch.percentage) } : { normalPercentage: Number(patch.percentage) })
: {};
updated = { ...b, ...patch, ...pctPatch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'bucket', 'update', updated);
  },

  transferBetweenBuckets: ({ fromKey, toKey, amount, currency = 'USD', notes = '' }) => {
    const tx = {
      id: uid('tx'),
      date: nowISO(),
      amount: Number(amount),
      currency,
      category: 'Transfer',
      type: 'transfer',
      notes: notes || `${fromKey} → ${toKey}`,
      tags: '',
      buckets: { [fromKey]: -Math.abs(amount), [toKey]: Math.abs(amount) },
      linkedDebtId: '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    return tx;
  },

  // ─── Goals ────────────────────────────────────────────────
addGoal: ({ bucketKey, name, target, currency = 'USD', priority, parallel = false, notes = '', coolingOffDays = 0 }) => {
    const bucketGoals = get().personal.goals.filter((g) => g.bucketKey === bucketKey && g.status === 'active');
    const nextPriority = priority || bucketGoals.length + 1;
const coolingOffUntil = Number(coolingOffDays) > 0
? new Date(Date.now() + Number(coolingOffDays) * 86400 * 1000).toISOString()
: '';
    const goal = {
      id: uid('goal'), bucketKey, name,
      target: Number(target), currency,
      priority: nextPriority, parallel,
notes,
coolingOffUntil,
      status: 'active', claimedAt: '', claimedAmount: 0,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, goals: [...s.personal.goals, goal] } }));
    enqueue(set, get, 'goal', 'create', goal);
    return goal;
  },

  updateGoal: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        goals: s.personal.goals.map((g) => {
          if (g.id !== id) return g;
          updated = { ...g, ...patch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'goal', 'update', updated);
  },

  reorderGoals: (bucketKey, orderedIds) => {
    const updates = [];
    set((s) => ({
      personal: {
        ...s.personal,
        goals: s.personal.goals.map((g) => {
          if (g.bucketKey !== bucketKey || g.status !== 'active') return g;
          const newPriority = orderedIds.indexOf(g.id) + 1;
          if (newPriority === 0) return g;
          if (newPriority !== g.priority) {
            const upd = { ...g, priority: newPriority, updatedAt: nowISO() };
            updates.push(upd);
            return upd;
          }
          return g;
        }),
      },
    }));
if (updates.length > 0) enqueue(set, get, 'goal', 'update', updates[0]);
  },

  claimGoal: (id, { actualAmount } = {}) => {
    const goal = get().personal.goals.find((g) => g.id === id);
    if (!goal) return null;
    const amount = actualAmount !== undefined ? Number(actualAmount) : goal.target;
    const tx = {
      id: uid('tx'), date: nowISO(), amount,
      currency: goal.currency,
      category: 'Goal', type: 'expense',
      notes: `🎯 ${goal.name}`,
      tags: '',
      buckets: { [goal.bucketKey]: -Math.abs(amount) },
      linkedDebtId: '',
      createdAt: nowISO(), updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));

    const updated = {
      ...goal, status: 'claimed',
      claimedAt: nowISO(), claimedAmount: amount,
      updatedAt: nowISO(),
    };
    set((s) => ({
      personal: {
        ...s.personal,
        goals: s.personal.goals.map((g) => (g.id === id ? updated : g)),
      },
    }));
enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    return tx;
  },

  removeGoal: (id) => {
    set((s) => ({ personal: { ...s.personal, goals: s.personal.goals.filter((g) => g.id !== id) } }));
    enqueue(set, get, 'goal', 'delete', { id });
  },

  // ─── Recurring schedules ──────────────────────────────────
  addRecurring: (input) => {
    const startDate = input.startDate || nowISO();
    const recurring = {
      id: uid('rec'),
      name: input.name,
      amount: Number(input.amount),
      currency: input.currency || 'USD',
      type: input.type,
      category: input.category || 'Other',
      notes: input.notes || '',
      tags: Array.isArray(input.tags) ? input.tags.join(',') : (input.tags || ''),
      frequency: input.frequency || 'monthly',
      interval: Number(input.interval) || 1,
      dayOfMonth: Number(input.dayOfMonth) || new Date(startDate).getDate(),
      daysOfWeek: input.daysOfWeek || '',
      startDate,
      endDate: input.endDate || '',
      lastFiredAt: '',
      nextDueAt: input.nextDueAt || startDate,
      paused: false,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, recurring: [...s.personal.recurring, recurring] } }));
    enqueue(set, get, 'recurring', 'create', recurring);
    setTimeout(() => get().tickRecurringSchedules(), 50);
    return recurring;
  },

  updateRecurring: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        recurring: s.personal.recurring.map((r) => {
          if (r.id !== id) return r;
          updated = { ...r, ...patch, updatedAt: nowISO() };
          if (patch.frequency !== undefined || patch.interval !== undefined ||
              patch.dayOfMonth !== undefined || patch.daysOfWeek !== undefined) {
            updated.nextDueAt = computeNextDueAt(updated, new Date());
          }
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'recurring', 'update', updated);
  },

  toggleRecurringPaused: (id) => {
    const r = get().personal.recurring.find((x) => x.id === id);
    if (!r) return;
    get().updateRecurring(id, { paused: !r.paused });
  },

  removeRecurring: (id) => {
    set((s) => ({ personal: { ...s.personal, recurring: s.personal.recurring.filter((r) => r.id !== id) } }));
    enqueue(set, get, 'recurring', 'delete', { id });
  },

  tickRecurringSchedules: () => {
    const { recurring, pending } = get().personal;
    const { newPending, updates } = tickRecurring(recurring, pending);
    if (newPending.length === 0 && updates.length === 0) return;

    set((s) => ({
      personal: {
        ...s.personal,
        pending: [...s.personal.pending, ...newPending],
        recurring: s.personal.recurring.map((r) => {
          const upd = updates.find((u) => u.id === r.id);
          return upd || r;
        }),
        lastTickAt: nowISO(),
      },
    }));

if (newPending.length > 0) enqueue(set, get, 'pending', 'create', newPending[0]);
  },

  confirmPending: (id, overrides = {}) => {
    const p = get().personal.pending.find((x) => x.id === id);
    if (!p) return null;
    const date = overrides.date || p.dueAt;
    const tx = get().addTransaction({
      date,
      amount: overrides.amount !== undefined ? overrides.amount : p.amount,
      currency: overrides.currency || p.currency,
      type: overrides.type || p.type,
      category: overrides.category || p.category,
      notes: overrides.notes !== undefined ? overrides.notes : p.notes,
      tags: overrides.tags !== undefined ? overrides.tags : p.tags,
    });
    const upd = { ...p, status: 'confirmed', updatedAt: nowISO() };
    set((s) => ({
      personal: {
        ...s.personal,
        pending: s.personal.pending.filter((x) => x.id !== id),
      },
    }));
    enqueue(set, get, 'pending', 'update', upd);
    return tx;
  },

  skipPending: (id) => {
    const p = get().personal.pending.find((x) => x.id === id);
    if (!p) return;
    const upd = { ...p, status: 'skipped', updatedAt: nowISO() };
    set((s) => ({
      personal: {
        ...s.personal,
        pending: s.personal.pending.filter((x) => x.id !== id),
      },
    }));
    enqueue(set, get, 'pending', 'update', upd);
  },

  removePending: (id) => {
    set((s) => ({
      personal: { ...s.personal, pending: s.personal.pending.filter((x) => x.id !== id) },
    }));
    enqueue(set, get, 'pending', 'delete', { id });
  },

  // ─── Templates ────────────────────────────────────────────
  addTemplate: ({ name, amount, currency = 'USD', type, category, notes = '', tags = '', icon = 'Coffee', color = '#7a8a8c' }) => {
    const t = {
      id: uid('tpl'), name,
      amount: Number(amount), currency, type, category, notes,
      tags: Array.isArray(tags) ? tags.join(',') : tags,
      icon, color, useCount: 0, lastUsedAt: '',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, templates: [...s.personal.templates, t] } }));
    enqueue(set, get, 'template', 'create', t);
    return t;
  },

  updateTemplate: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        templates: s.personal.templates.map((t) => {
          if (t.id !== id) return t;
          updated = { ...t, ...patch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'template', 'update', updated);
  },

  removeTemplate: (id) => {
    set((s) => ({ personal: { ...s.personal, templates: s.personal.templates.filter((t) => t.id !== id) } }));
    enqueue(set, get, 'template', 'delete', { id });
  },

  useTemplate: (id, dateOverride) => {
    const t = get().personal.templates.find((x) => x.id === id);
    if (!t) return null;
    const tx = get().addTransaction({
      date: dateOverride || nowISO(),
      amount: t.amount, currency: t.currency, type: t.type,
      category: t.category, notes: t.notes, tags: t.tags,
    });
    const upd = {
      ...t, useCount: (Number(t.useCount) || 0) + 1,
      lastUsedAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({
      personal: {
        ...s.personal,
        templates: s.personal.templates.map((x) => (x.id === id ? upd : x)),
      },
    }));
    enqueue(set, get, 'template', 'update', upd);
    return tx;
  },

  // ─── Categories ───────────────────────────────────────────
  addCategory: ({ name, type, icon = 'Tag', color = '#7a8a8c', bucketKey = '' }) => {
    const c = {
      id: uid('cat'),
      name, type, icon, color, bucketKey,
      order: get().personal.categories.filter((x) => x.type === type).length + 1,
      enabled: true,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, categories: [...s.personal.categories, c] } }));
    enqueue(set, get, 'category', 'create', c);
    return c;
  },

  updateCategory: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        categories: s.personal.categories.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, ...patch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'category', 'update', updated);
  },

  removeCategory: (id) => {
    set((s) => ({ personal: { ...s.personal, categories: s.personal.categories.filter((c) => c.id !== id) } }));
    enqueue(set, get, 'category', 'delete', { id });
  },

  reorderCategories: (orderedIds) => {
    const updates = [];
    set((s) => ({
      personal: {
        ...s.personal,
        categories: s.personal.categories.map((c) => {
          const newOrder = orderedIds.indexOf(c.id) + 1;
          if (newOrder === 0 || newOrder === c.order) return c;
          const upd = { ...c, order: newOrder, updatedAt: nowISO() };
          updates.push(upd);
          return upd;
        }),
      },
    }));
if (updates.length > 0) enqueue(set, get, 'category', 'update', updates[0]);
  },

  // ─── Bucket CRUD ──────────────────────────────────────────
  addBucket: ({ key, name, percentage, color = '#7a8a8c', icon = 'Wallet' }) => {
    const existing = get().personal.buckets;
    const order = existing.length + 1;
    const b = {
      id: uid('bkt'), key, name, percentage: Number(percentage),
dangerPercentage: Number(percentage),
normalPercentage: Number(percentage),
      color, icon, order, enabled: true,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, buckets: [...s.personal.buckets, b] } }));
    enqueue(set, get, 'bucket', 'create', b);
    return b;
  },

  removeBucket: (id) => {
    set((s) => ({ personal: { ...s.personal, buckets: s.personal.buckets.filter((b) => b.id !== id) } }));
    enqueue(set, get, 'bucket', 'delete', { id });
  },

  resetBucketsToDefaults: () => {
const isDanger = selectIsDangerMode(get());
const defaults = (isDanger ? DANGER_MODE_BUCKETS : NORMAL_MODE_BUCKETS).map((b) => ({
      ...b, id: uid('bkt'), enabled: true, createdAt: nowISO(), updatedAt: nowISO(),
    }));
    set((s) => ({ personal: { ...s.personal, buckets: defaults } }));
enqueue(set, get, 'bucket', 'update', defaults[0]);
  },

  updateBucketPercentages: (updates) => {
const isDanger = selectIsDangerMode(get());
    const updated = [];
    set((s) => ({
      personal: {
        ...s.personal,
        buckets: s.personal.buckets.map((b) => {
const rawVal = updates[b.id] !== undefined ? updates[b.id] : updates[b.key];
if (rawVal === undefined) return b;
const pct = Math.max(0, Math.min(100, Number(rawVal)));
const modePatch = isDanger ? { dangerPercentage: pct } : { normalPercentage: pct };
const upd = { ...b, percentage: pct, ...modePatch, updatedAt: nowISO() };
          updated.push(upd);
          return upd;
        }),
      },
    }));
if (updated.length > 0) enqueue(set, get, 'bucket', 'update', updated[0]);
  },

  // ─── Local data utilities ─────────────────────────────────
  exportAllData: () => {
    const s = get();
    return {
      exportedAt: nowISO(),
version: 9,
personal: { ...s.personal },
      app: {
        baseCurrency: s.app.baseCurrency,
        rates: s.app.rates,
        theme: s.app.theme,
dangerModeOverride: s.app.dangerModeOverride,
privacyMask: s.app.privacyMask,
      },
    };
  },

  resetLocalData: async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('fintrack-v2');
    }
    set((s) => ({
      personal: {
        ...s.personal,
transactions: [], budgets: [], budgetItems: [], debts: [], debtEvents: [],
        investments: [], investmentEvents: [],
        ventures: [], ventureEvents: [],
        buckets: [], goals: [],
        recurring: [], pending: [], templates: [], categories: [],
        borrowedDeployments: [], ventureDistributions: [],
        ventureMilestones: [], ventureJournal: [],
wallets: DEFAULT_WALLETS, conversions: [],
bucketNotes: {}, dismissedAnomalies: [],
        queue: [], lastDeleted: null,
      },
    }));
    await get().hydrate();
  },

  addBudget: ({ category, limit, currency = 'USD', period = 'monthly' }) => {
    const b = { id: uid('bdg'), category, limit: Number(limit), currency, period, createdAt: nowISO(), updatedAt: nowISO() };
    set((s) => ({ personal: { ...s.personal, budgets: [...s.personal.budgets, b] } }));
    enqueue(set, get, 'budget', 'create', b);
    return b;
  },
  updateBudget: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        budgets: s.personal.budgets.map((b) => {
          if (b.id !== id) return b;
          updated = { ...b, ...patch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'budget', 'update', updated);
  },
  removeBudget: (id) => {
    set((s) => ({ personal: { ...s.personal, budgets: s.personal.budgets.filter((b) => b.id !== id) } }));
    enqueue(set, get, 'budget', 'delete', { id });
  },

addBudgetItem: ({ bucketKey, type = 'expense', name, amount, currency = 'HTG', frequency = 'weekly', dayOfWeek = 0, dayOfMonth = 1, startDate, notes = '' }) => {
    const item = {
id: uid('bdi'),
bucketKey: bucketKey || 'operations',
type,
name: name || (type === 'income' ? 'Expected income' : 'Planned expense'),
amount: Number(amount),
currency,
frequency,
dayOfWeek: Number(dayOfWeek) || 0,
dayOfMonth: Number(dayOfMonth) || 1,
      startDate: startDate || nowISO(),
notes,
      status: 'expected',
createdAt: nowISO(),
updatedAt: nowISO(),
    };
set((s) => ({ personal: { ...s.personal, budgetItems: [...(s.personal.budgetItems || []), item] } }));
    enqueue(set, get, 'budgetItem', 'create', item);
    return item;
  },

updateBudgetItem: (id, patch) => {
let updated = null;
set((s) => ({
personal: {
...s.personal,
budgetItems: (s.personal.budgetItems || []).map((b) => {
if (b.id !== id) return b;
updated = { ...b, ...patch, updatedAt: nowISO() };
return updated;
}),
},
}));
if (updated) enqueue(set, get, 'budgetItem', 'update', updated);
return updated;
},
  removeBudgetItem: (id) => {
set((s) => ({ personal: { ...s.personal, budgetItems: (s.personal.budgetItems || []).filter((b) => b.id !== id) } }));
    enqueue(set, get, 'budgetItem', 'delete', { id });
  },

confirmBudgetItem: (id, { date, keepRecurring = true } = {}) => {
const item = (get().personal.budgetItems || []).find((b) => b.id === id);
    if (!item) return null;
    const effectiveDate = date || nowISO();
const state = get();
const activeBuckets = selectActiveBuckets(state);
    const tx = get().addTransaction({
      type: item.type,
      amount: item.amount,
      currency: item.currency,
      category: item.type === 'income' ? 'Expected income' : 'Expected expense',
      notes: item.name,
      date: effectiveDate,
      buckets: item.type === 'income'
? autoSplitIncome(item.amount, activeBuckets)
        : { [item.bucketKey]: -Math.abs(item.amount) },
    });
const isOneTime = item.frequency === 'once';
    set((s) => ({
      personal: {
        ...s.personal,
budgetItems: (s.personal.budgetItems || []).map((b) =>
b.id === id
? {
...b,
status: isOneTime || !keepRecurring ? 'confirmed' : 'expected',
lastConfirmedAt: effectiveDate,
confirmedCount: (Number(b.confirmedCount) || 0) + 1,
linkedTxId: tx?.id || '',
updatedAt: nowISO(),
}
: b
        ),
      },
    }));
enqueue(set, get, 'budgetItem', 'update', { id, lastConfirmedAt: effectiveDate });
    return tx;
  },

  // ─── Debts ────────────────────────────────────────────────
  addDebt: ({ creditor, principal, currency = 'USD', dueDate, notes = '', direction = 'owe', interestRate = 0, interestType = 'simple', linkedTxId = '' }) => {
    const d = {
      id: uid('debt'), creditor,
      principal: Number(principal), currency,
      dueDate: dueDate || '', notes, status: 'active',
      direction,
      interestRate: Number(interestRate) || 0,
      interestType,
      linkedTxId,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, d] } }));
get().syncBucketMode();
    enqueue(set, get, 'debt', 'create', d);
    return d;
  },

  updateDebt: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        debts: s.personal.debts.map((d) => {
          if (d.id !== id) return d;
          updated = { ...d, ...patch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
get().syncBucketMode();
    if (updated) enqueue(set, get, 'debt', 'update', updated);
  },

recordRepayment: (debtId, amount, { interestPaid = 0, date, sourceBucketKey = 'debtRepayment', walletId } = {}) => {
    const debt = get().personal.debts.find((d) => d.id === debtId);
    if (!debt) return null;
    const direction = debt.direction || 'owe';
    const currentRepaid = computeDebtRepaid(get().personal.debtEvents, debtId);
    const cappedAmount  = Math.min(Number(amount), debt.principal - currentRepaid);
    if (cappedAmount <= 0) return null;
    const newRepaid    = currentRepaid + cappedAmount;
    const balanceAfter = debt.principal - newRepaid;
    const baseCurrency = get().app.baseCurrency;
    const rates        = get().app.rates;
    const balanceAfterBase = convert(balanceAfter, debt.currency, baseCurrency, rates);

    const effectiveDate = date || nowISO();


    const totalPaid = cappedAmount + (Number(interestPaid) || 0);
const resolvedWalletId = walletId || inferWalletIdForTx({ notes: debt.creditor, currency: debt.currency });
    const auditTx = {
      id: uid('tx'), date: effectiveDate,
      amount: totalPaid,
      currency: debt.currency,
      category: direction === 'owe' ? 'Repayment' : 'Repayment received',
      type: direction === 'owe' ? 'expense' : 'income',
walletId: resolvedWalletId,
      notes: direction === 'owe'
        ? `Paid ${debt.creditor}${interestPaid > 0 ? ` (incl. ${interestPaid} interest)` : ''}`
        : `${debt.creditor} repaid`,
tags: 'debt-repayment',
      buckets: { [sourceBucketKey]: direction === 'owe' ? -totalPaid : totalPaid },
      interestAmount: Number(interestPaid) || 0,
      linkedDebtId: debtId,
      createdAt: nowISO(), updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [auditTx, ...s.personal.transactions] } }));


    const event = {
id: uid('devt'),
debtId,
linkedTxId: auditTx.id,
type: 'repayment',
amount: cappedAmount,
currency: debt.currency,
balanceAfter,
balanceAfterBase,
baseCurrency,
      interestPaid: Number(interestPaid) || 0,
notes: auditTx.notes,
date: effectiveDate,
createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debtEvents: [...s.personal.debtEvents, event] } }));


    if (balanceAfter <= 0 && debt.status !== 'paid') {
      const updated = { ...debt, status: 'paid', updatedAt: nowISO() };
      set((s) => ({
        personal: {
          ...s.personal,
          debts: s.personal.debts.map((d) => (d.id === debtId ? updated : d)),
        },
      }));

    }
get().syncBucketMode();
enqueue(set, get, 'transaction', 'create', stripMeta(auditTx));
    return event;
  },

  removeDebt: (id) => {
    set((s) => ({ personal: { ...s.personal, debts: s.personal.debts.filter((d) => d.id !== id) } }));
get().syncBucketMode();
    enqueue(set, get, 'debt', 'delete', { id });
  },


  recordBorrowedDeployment: ({ sourceDebtId, destinationType, destinationId, destinationLabel, amount, currency = 'USD', note = '' }) => {
    const dep = {
      id: uid('bdep'),
      sourceDebtId,
destinationType,
      destinationId: destinationId || '',
      destinationLabel: destinationLabel || '',
      amount: Number(amount),
      currency,
      date: nowISO(),
      note,
      createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, borrowedDeployments: [...s.personal.borrowedDeployments, dep] },
    }));
    enqueue(set, get, 'borrowedDeployment', 'create', dep);
    return dep;
  },

  // ─── Investments ──────────────────────────────────────────
  addInvestment: ({ kind, name, units, costBasis, currentPrice, currency = 'USD', fundedByDebtId = '' }) => {
    const inv = {
      id: uid('inv'), kind, name,
      units: Number(units), costBasis: Number(costBasis),
      currentPrice: Number(currentPrice ?? costBasis),
      currency,
      fundedByDebtId,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, investments: [...s.personal.investments, inv] } }));



    if (fundedByDebtId) {
      get().recordBorrowedDeployment({
        sourceDebtId: fundedByDebtId,
        destinationType: 'investment',
        destinationId: inv.id,
        destinationLabel: name,
        amount: Number(units) * Number(costBasis),
        currency,
        note: 'Investment funded',
      });
    } else {

      const tx = {
        id: uid('tx'), date: nowISO(),
        amount: Number(units) * Number(costBasis),
        currency,
        category: 'Investment', type: 'expense',
        notes: `📈 ${name}`,
        tags: '',
        buckets: { warChest: -(Number(units) * Number(costBasis)) },
        linkedDebtId: '',
        createdAt: nowISO(), updatedAt: nowISO(),
        _pending: true,
      };
      set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
      enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    }
enqueue(set, get, 'investment', 'create', inv);
    return inv;
  },

  updateInvestmentPrice: (id, currentPrice) => {
    const inv = get().personal.investments.find((i) => i.id === id);
    if (!inv) return null;
    const previousPrice = inv.currentPrice;
    const newPrice = Number(currentPrice);
    const updated = { ...inv, currentPrice: newPrice, updatedAt: nowISO() };
    set((s) => ({
      personal: {
        ...s.personal,
        investments: s.personal.investments.map((i) => (i.id === id ? updated : i)),
      },
    }));

    const event = {
      id: uid('ievt'), investmentId: id, type: 'priceUpdate',
      price: newPrice, previousPrice, currency: inv.currency,
      notes: '', date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, investmentEvents: [...s.personal.investmentEvents, event] } }));
enqueue(set, get, 'investment', 'update', updated);
  },

  removeInvestment: (id) => {
    set((s) => ({ personal: { ...s.personal, investments: s.personal.investments.filter((i) => i.id !== id) } }));
    enqueue(set, get, 'investment', 'delete', { id });
  },


  addVenture: ({ name, type = 'other', notes = '', startDate = '', targetExitDate = '', currentValuation = 0, valuationCurrency = 'USD', targetMultiple = 0, partners = '' }) => {
    const v = {
      id: uid('vnt'), name, type, notes, status: 'active',
      startDate: startDate || nowISO(),
      targetExitDate: targetExitDate || '',
      currentValuation: Number(currentValuation) || 0,
      valuationCurrency, targetMultiple: Number(targetMultiple) || 0,
      partners,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, ventures: [...s.personal.ventures, v] } }));
    enqueue(set, get, 'venture', 'create', v);
    return v;
  },

  updateVenture: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        ventures: s.personal.ventures.map((v) => {
          if (v.id !== id) return v;
          updated = { ...v, ...patch, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'venture', 'update', updated);
  },

  deployToVenture: (ventureId, { amount, currency = 'USD', note = '', fundedByDebtId = '' }) => {
    const venture = get().personal.ventures.find((v) => v.id === ventureId);
    const event = {
      id: uid('vevt'), ventureId, type: 'deploy',
      amount: Number(amount), currency, note,
      fundedByDebtId,
      date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, ventureEvents: [...s.personal.ventureEvents, event] } }));


    if (fundedByDebtId) {
      get().recordBorrowedDeployment({
        sourceDebtId: fundedByDebtId,
        destinationType: 'venture',
        destinationId: ventureId,
        destinationLabel: venture?.name || 'Venture',
        amount: Number(amount), currency, note: 'Venture deployment',
      });
    } else {

      const tx = {
        id: uid('tx'), date: nowISO(),
        amount: Number(amount), currency,
        category: 'Venture', type: 'expense',
        notes: `🚀 ${venture?.name || 'Venture'}${note ? ' · ' + note : ''}`,
        tags: '',
        buckets: { warChest: -Math.abs(Number(amount)) },
        linkedDebtId: '',
        createdAt: nowISO(), updatedAt: nowISO(),
        _pending: true,
      };
      set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
      enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    }
enqueue(set, get, 'ventureEvent', 'create', event);
    return event;
  },


  recordVentureDistribution: (ventureId, { type = 'distribution', amount, currency = 'USD', note = '', date = nowISO() }) => {
    const v = get().personal.ventures.find((x) => x.id === ventureId);
    const dist = {
      id: uid('vdist'), ventureId, type, amount: Number(amount) || 0, currency,
      date, note,
      createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, ventureDistributions: [...s.personal.ventureDistributions, dist] },
    }));



    if (type === 'distribution' && Number(amount) > 0) {
      const tx = {
        id: uid('tx'), date,
        amount: Number(amount), currency,
        category: 'Investment', type: 'income',
        notes: `💰 ${v?.name || 'Venture'} distribution${note ? ' · ' + note : ''}`,
        tags: '',
        buckets: { warChest: Math.abs(Number(amount)) },
        linkedDebtId: '',
        createdAt: nowISO(), updatedAt: nowISO(),
        _pending: true,
      };
      set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
      enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    }
enqueue(set, get, 'ventureDistribution', 'create', dist);
    return dist;
  },


  revalueVenture: (ventureId, newValuation, currency, note = '') => {
    const v = get().personal.ventures.find((x) => x.id === ventureId);
    if (!v) return null;
    get().updateVenture(ventureId, {
      currentValuation: Number(newValuation),
      valuationCurrency: currency || v.valuationCurrency || 'USD',
    });

    const dist = {
      id: uid('vdist'), ventureId, type: 'revaluation',
      amount: Number(newValuation) || 0,
      currency: currency || v.valuationCurrency || 'USD',
      date: nowISO(), note,
      createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, ventureDistributions: [...s.personal.ventureDistributions, dist] },
    }));
    enqueue(set, get, 'ventureDistribution', 'create', dist);
    return dist;
  },

  setVentureStatus: (id, status) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        ventures: s.personal.ventures.map((v) => {
          if (v.id !== id) return v;
          updated = { ...v, status, updatedAt: nowISO() };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'venture', 'update', updated);
  },

  removeVenture: (id) => {
    set((s) => ({ personal: { ...s.personal, ventures: s.personal.ventures.filter((v) => v.id !== id) } }));
    enqueue(set, get, 'venture', 'delete', { id });
  },


  addVentureMilestone: (ventureId, { name, targetDate = '', note = '' }) => {
    const m = {
      id: uid('vmil'), ventureId, name,
      targetDate: targetDate || '',
      completedDate: '',
      status: 'pending', note,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, ventureMilestones: [...s.personal.ventureMilestones, m] },
    }));
    enqueue(set, get, 'ventureMilestone', 'create', m);
    return m;
  },

  toggleVentureMilestone: (id) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        ventureMilestones: s.personal.ventureMilestones.map((m) => {
          if (m.id !== id) return m;
          const wasDone = m.status === 'completed';
          updated = {
            ...m,
            status: wasDone ? 'pending' : 'completed',
            completedDate: wasDone ? '' : nowISO(),
            updatedAt: nowISO(),
          };
          return updated;
        }),
      },
    }));
    if (updated) enqueue(set, get, 'ventureMilestone', 'update', updated);
  },

  removeVentureMilestone: (id) => {
    set((s) => ({
      personal: { ...s.personal, ventureMilestones: s.personal.ventureMilestones.filter((m) => m.id !== id) },
    }));
    enqueue(set, get, 'ventureMilestone', 'delete', { id });
  },


  addVentureJournalEntry: (ventureId, entry) => {
    const j = {
      id: uid('vjnl'), ventureId, entry,
      date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, ventureJournal: [...s.personal.ventureJournal, j] },
    }));
    enqueue(set, get, 'ventureJournal', 'create', j);
    return j;
  },

  removeVentureJournalEntry: (id) => {
    set((s) => ({
      personal: { ...s.personal, ventureJournal: s.personal.ventureJournal.filter((j) => j.id !== id) },
    }));
    enqueue(set, get, 'ventureJournal', 'delete', { id });
  },

buildCloudStateRow: () => {
const s = get();
const p = s.personal;
const txMeta = {};
for (const t of (p.transactions || [])) {
if (!t || !t.id || t.id === SYSTEM_STATE_ROW_ID) continue;
if ((t.buckets && Object.keys(t.buckets).length > 0) || t.tags || t.linkedDebtId || t.interestAmount || t.walletId) {
txMeta[t.id] = {
b: t.buckets || {},
g: t.tags || '',
d: t.linkedDebtId || '',
i: t.interestAmount || 0,
w: t.walletId || '',
};
}
}
const payload = {
v: 9,
updatedAt: nowISO(),
app: {
baseCurrency: s.app.baseCurrency,
dangerModeOverride: s.app.dangerModeOverride,
privacyMask: s.app.privacyMask,
},
buckets: p.buckets || [],
goals: p.goals || [],
budgets: p.budgets || [],
budgetItems: p.budgetItems || [],
debts: p.debts || [],
debtEvents: p.debtEvents || [],
investments: p.investments || [],
investmentEvents: p.investmentEvents || [],
ventures: p.ventures || [],
ventureEvents: p.ventureEvents || [],
ventureDistributions: p.ventureDistributions || [],
ventureMilestones: p.ventureMilestones || [],
ventureJournal: p.ventureJournal || [],
borrowedDeployments: p.borrowedDeployments || [],
wallets: p.wallets || DEFAULT_WALLETS,
conversions: p.conversions || [],
recurring: p.recurring || [],
pending: p.pending || [],
templates: p.templates || [],
categories: p.categories || [],
bucketNotes: p.bucketNotes || {},
txMeta,
};
return {
id: SYSTEM_STATE_ROW_ID,
date: '1970-01-01T00:00:00.000Z',
amount: 0,
currency: 'USD',
category: '__system__',
type: 'meta',
notes: JSON.stringify(payload),
createdAt: '1970-01-01T00:00:00.000Z',
};
},
  hydrate: async () => {
    try {
      const data = await api.fetchAll();
const rawServerTxs = Array.isArray(data.transactions) ? data.transactions : [];
const stateRow = rawServerTxs.find(
(t) => t && (t.id === SYSTEM_STATE_ROW_ID || t.category === '__system__' || t.type === 'meta')
);
let cloudState = null;
if (stateRow && typeof stateRow.notes === 'string' && stateRow.notes.startsWith('{')) {
try {
cloudState = JSON.parse(stateRow.notes);
} catch (e) {
cloudState = null;
}
}
const txMeta = cloudState?.txMeta || {};
const localById = {};
for (const lt of (get().personal.transactions || [])) {
if (lt && lt.id) localById[lt.id] = lt;
}
      const pendingIds = new Set(
(get().personal.queue || [])
.filter((op) => (!op.entity || op.entity === 'transaction') && op.action === 'create')
.map((op) => op.id)
      );
      const localPendingTx = (get().personal.transactions || []).filter((t) => pendingIds.has(t.id));


const cleanServerTxs = rawServerTxs
.filter((t) => t && t.id !== SYSTEM_STATE_ROW_ID && t.category !== '__system__' && t.type !== 'meta')
.map((t) => {
const localTx = localById[t.id];
const meta = txMeta[t.id] || {};
const mergedBuckets =
(t.buckets && Object.keys(t.buckets).length > 0) ? t.buckets :
(localTx?.buckets && Object.keys(localTx.buckets).length > 0) ? localTx.buckets :
(meta.b && Object.keys(meta.b).length > 0) ? meta.b :
{};
return {
...t,
currency: localTx?.currency || t.currency || 'USD',
walletId: t.walletId || localTx?.walletId || meta.w || inferWalletIdForTx(t),
buckets: mergedBuckets,
tags: t.tags || localTx?.tags || meta.g || '',
linkedDebtId: t.linkedDebtId || localTx?.linkedDebtId || meta.d || '',
interestAmount: Number(t.interestAmount ?? localTx?.interestAmount ?? meta.i ?? 0),
};
});
      let mergedTransactions;
if (cleanServerTxs.length === 0) {
mergedTransactions = (get().personal.transactions || []).filter(
(t) => t.id !== SYSTEM_STATE_ROW_ID && t.category !== '__system__'
);
      } else {
const serverIds = new Set(cleanServerTxs.map((t) => t.id));
        const localOnly = (get().personal.transactions || []).filter(
(t) => t.id !== SYSTEM_STATE_ROW_ID && !serverIds.has(t.id) && !pendingIds.has(t.id)
        );
        mergedTransactions = [
          ...localPendingTx,
...cleanServerTxs.filter((t) => !pendingIds.has(t.id)),
          ...localOnly,
        ].sort((a, b) => new Date(b.date) - new Date(a.date));
      }

const mergeCollection = (localArr = [], serverArr = [], cloudArr = []) => {
const source = (Array.isArray(serverArr) && serverArr.length > 0)
? serverArr
: (Array.isArray(cloudArr) && cloudArr.length > 0)
? cloudArr
: [];
if (source.length === 0) return localArr || [];
const byId = new Map();
for (const item of source) {
if (item && item.id) byId.set(item.id, item);
}
for (const localItem of (localArr || [])) {
if (!localItem || !localItem.id) continue;
const existing = byId.get(localItem.id);
if (!existing) {
byId.set(localItem.id, localItem);
} else if (
localItem.updatedAt &&
existing.updatedAt &&
new Date(localItem.updatedAt) > new Date(existing.updatedAt)
) {
byId.set(localItem.id, localItem);
}
}
return Array.from(byId.values());
};
const s = get();
const mergedDebts = mergeCollection(s.personal.debts, data.debts, cloudState?.debts);
const mergedDebtEvents = mergeCollection(s.personal.debtEvents, data.debtEvents, cloudState?.debtEvents);
const mergedCategories = mergeCollection(s.personal.categories, data.categories, cloudState?.categories);
const mergedBudgetItems = mergeCollection(s.personal.budgetItems, data.budgetItems, cloudState?.budgetItems);
const mergedGoals = mergeCollection(s.personal.goals, data.goals, cloudState?.goals);
const mergedBuckets = dedupeBuckets(
mergeCollection(s.personal.buckets, data.buckets, cloudState?.buckets)
);
const mergedWallets = mergeCollection(s.personal.wallets, data.wallets, cloudState?.wallets);
const mergedConversions = mergeCollection(s.personal.conversions, data.conversions, cloudState?.conversions);
const tempIsDanger =
s.app.dangerModeOverride === 'danger' ? true :
s.app.dangerModeOverride === 'normal' ? false :
true;
const activeBuckets = resolveModeBuckets(mergedBuckets, tempIsDanger);
const reconciled = reconcileHistoricalSheetData(
mergedTransactions,
mergedDebts,
mergedDebtEvents,
activeBuckets,
mergedCategories.length > 0 ? mergedCategories : DEFAULT_CATEGORIES
);
let finalBudgetItems = mergedBudgetItems;
if (finalBudgetItems.length === 0 && reconciled.transactions.length > 0) {
finalBudgetItems = [
{
id: 'bdi_default_salary',
bucketKey: 'operations',
type: 'income',
name: 'Weekly salary from Avs recharge+',
amount: 1986,
currency: 'HTG',
frequency: 'weekly',
dayOfWeek: 0,
dayOfMonth: 1,
startDate: '2026-10-18T04:00:00.000Z',
status: 'expected',
createdAt: nowISO(),
updatedAt: nowISO(),
},
{
id: 'bdi_default_family',
bucketKey: 'operations',
type: 'expense',
name: 'Weekly Family money',
amount: 1500,
currency: 'HTG',
frequency: 'weekly',
dayOfWeek: 0,
dayOfMonth: 1,
startDate: '2026-10-18T04:00:00.000Z',
status: 'expected',
createdAt: nowISO(),
updatedAt: nowISO(),
},
{
id: 'bdi_default_housing',
bucketKey: 'operations',
type: 'expense',
name: 'Weekly housing Money',
amount: 500,
currency: 'HTG',
frequency: 'weekly',
dayOfWeek: 3,
dayOfMonth: 1,
startDate: '2026-09-16T00:00:00.000Z',
status: 'expected',
createdAt: nowISO(),
updatedAt: nowISO(),
},
{
id: 'bdi_default_natcom',
bucketKey: 'operations',
type: 'expense',
name: 'Plan Natcom',
amount: 33,
currency: 'HTG',
frequency: 'daily',
dayOfWeek: 0,
dayOfMonth: 1,
startDate: '2026-10-15T00:00:00.000Z',
status: 'expected',
createdAt: nowISO(),
updatedAt: nowISO(),
},
];
}
set((st) => ({
        personal: {
...st.personal,
transactions:         reconciled.transactions,
debts:                reconciled.debts,
debtEvents:           reconciled.debtEvents,
budgets:              mergeCollection(st.personal.budgets, data.budgets, cloudState?.budgets),
budgetItems:          finalBudgetItems,
investments:          mergeCollection(st.personal.investments, data.investments, cloudState?.investments),
investmentEvents:     mergeCollection(st.personal.investmentEvents, data.investmentEvents, cloudState?.investmentEvents),
ventures:             mergeCollection(st.personal.ventures, data.ventures, cloudState?.ventures),
ventureEvents:        mergeCollection(st.personal.ventureEvents, data.ventureEvents, cloudState?.ventureEvents),
buckets:              mergedBuckets,
goals:                mergedGoals,
recurring:            mergeCollection(st.personal.recurring, data.recurring, cloudState?.recurring),
pending:              mergeCollection(st.personal.pending, data.pending, cloudState?.pending),
templates:            mergeCollection(st.personal.templates, data.templates, cloudState?.templates),
categories:           mergedCategories,
borrowedDeployments:  mergeCollection(st.personal.borrowedDeployments, data.borrowedDeployments, cloudState?.borrowedDeployments),
ventureDistributions: mergeCollection(st.personal.ventureDistributions, data.ventureDistributions, cloudState?.ventureDistributions),
ventureMilestones:    mergeCollection(st.personal.ventureMilestones, data.ventureMilestones, cloudState?.ventureMilestones),
ventureJournal:       mergeCollection(st.personal.ventureJournal, data.ventureJournal, cloudState?.ventureJournal),
wallets:              ensureDefaultWallets(mergedWallets),
conversions:          mergedConversions,
bucketNotes:          { ...(cloudState?.bucketNotes || {}), ...(st.personal.bucketNotes || {}) },
          lastSyncAt: nowISO(),
          syncError: null,
        },
app: { ...st.app, online: true },
      }));

      get().initializeBuckets();
get().initializeWallets();
      get().initializeCategories();

      get().hydrateBusinessFromServer();
    } catch (err) {
      set((s) => ({
        personal: { ...s.personal, syncError: err.message },
        app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
      }));
      get().initializeBuckets();
get().initializeWallets();
      get().initializeCategories();
    }
  },

  syncQueue: async () => {
    if (get().personal.syncing) return;
const queue = get().personal.queue || [];
    if (queue.length === 0) return;

    const startedAt = new Date();
const sendingKeys = new Set(queue.map((op, idx) => `${op.entity || 'transaction'}:${op.id || idx}`));
const txOps = queue
.filter((op) => !op.entity || op.entity === 'transaction')
.map(({ entity, ...rest }) => rest);
const stateRow = get().buildCloudStateRow();
const opsToSend = [
...txOps,
{ action: 'update', ...stateRow },
];

    set((s) => ({ personal: { ...s.personal, syncing: true, syncError: null } }));
    try {
const { results = [] } = await api.bulk(opsToSend);

const retryCreates = [];
opsToSend.forEach((op, idx) => {
const res = results[idx];
if (op.action === 'update' && res?.status === 404) {
retryCreates.push({ ...op, action: 'create' });
}
});
if (retryCreates.length > 0) {
await api.bulk(retryCreates);
}
const logEntries = opsToSend.map((op, i) => {
        const r = results[i];
        return {
          time: startedAt.toLocaleTimeString(),
op: `${op.action} ${op.id === SYSTEM_STATE_ROW_ID ? 'cloudState' : 'transaction'}`,
summary: op.notes?.slice(0, 30) || op.category || '',
id: op.id,
status: r?.status === 404 && op.action === 'update' ? 200 : (r?.status ?? 200),
message: r?.status === 404 && op.action === 'update' ? 'Created in sheet' : (r?.message || 'OK'),
        };
      });


      set((s) => ({
        personal: {
          ...s.personal,
queue: (s.personal.queue || []).filter(
(op, idx) => !sendingKeys.has(`${op.entity || 'transaction'}:${op.id || idx}`)
),
          transactions: s.personal.transactions.map((t) => ({ ...t, _pending: false })),
          lastSyncAt: nowISO(),
          syncing: false,
syncError: null,
syncLog: [...logEntries, ...(s.personal.syncLog || [])].slice(0, 30),
        },
        app: { ...s.app, online: true },
      }));
    } catch (err) {
set((s) => ({
personal: {
...s.personal,
syncing: false,
syncError: err.message,
syncLog: [
{
time: startedAt.toLocaleTimeString(),
op: 'bulk sync',
summary: `${queue.length} ops`,
id: 'bulk',
status: 'ERR',
message: err.message,
},
...(s.personal.syncLog || []),
].slice(0, 30),
},
app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
}));
    }
  },

  clearQueue: () => set((s) => ({ personal: { ...s.personal, queue: [], syncError: null } })),
  clearSyncLog: () => set((s) => ({ personal: { ...s.personal, syncLog: [] } })),
});


// ════════════════════════════════════════════════════════════════════
// COMPOSED STORE
// ════════════════════════════════════════════════════════════════════
const rawUseStore = create()(
  persist(
    (set, get) => ({
      ...appSlice(set, get),
      ...personalSlice(set, get),
      ...businessSlice(set, get),
    }),
    {
      name: 'fintrack-v2',
      storage: createJSONStorage(() => localStorage),
version: 9,
      partialize: (s) => ({
        app: {
          workspace: s.app.workspace,
          theme: s.app.theme,
          activeTab: s.app.activeTab,
          baseCurrency: s.app.baseCurrency,
          rates: s.app.rates,
          debtAcknowledged: s.app.debtAcknowledged,
dangerModeOverride: s.app.dangerModeOverride,
privacyMask: s.app.privacyMask,
selectedCalendarDate: s.app.selectedCalendarDate,
calendarViewMode: s.app.calendarViewMode,
        },
        personal: {
transactions:         s.personal.transactions,
budgets:              s.personal.budgets,
budgetItems:          s.personal.budgetItems,
debts:                s.personal.debts,
debtEvents:           s.personal.debtEvents,
investments:          s.personal.investments,
investmentEvents:     s.personal.investmentEvents,
ventures:             s.personal.ventures,
ventureEvents:        s.personal.ventureEvents,
buckets:              s.personal.buckets,
goals:                s.personal.goals,
recurring:            s.personal.recurring,
pending:              s.personal.pending,
templates:            s.personal.templates,
categories:           s.personal.categories,
          borrowedDeployments:  s.personal.borrowedDeployments,
          ventureDistributions: s.personal.ventureDistributions,
          ventureMilestones:    s.personal.ventureMilestones,
          ventureJournal:       s.personal.ventureJournal,
wallets:              s.personal.wallets,
conversions:          s.personal.conversions,
bucketNotes:          s.personal.bucketNotes,
dismissedAnomalies:   s.personal.dismissedAnomalies,
queue:                s.personal.queue,
lastSyncAt:           s.personal.lastSyncAt,
lastTickAt:           s.personal.lastTickAt,
        },
        business: s.business,
      }),
migrate: (persisted) => {
        if (!persisted) return persisted;
        const p = { ...persisted };
        if (!p.personal) return p;
        p.personal = {
          ...p.personal,
transactions:         p.personal.transactions         || [],
budgets:              p.personal.budgets              || [],
budgetItems:          p.personal.budgetItems          || [],
debts:                p.personal.debts                || [],
debtEvents:           p.personal.debtEvents           || [],
investments:          p.personal.investments          || [],
investmentEvents:     p.personal.investmentEvents     || [],
ventures:             p.personal.ventures             || [],
ventureEvents:        p.personal.ventureEvents        || [],
buckets:              dedupeBuckets(p.personal.buckets || []).filter((b) => b.key !== 'holding'),
goals:                p.personal.goals                || [],
recurring:            p.personal.recurring            || [],
pending:              p.personal.pending              || [],
templates:            p.personal.templates            || [],
categories:           p.personal.categories           || [],
borrowedDeployments:  p.personal.borrowedDeployments  || [],
ventureDistributions: p.personal.ventureDistributions || [],
ventureMilestones:    p.personal.ventureMilestones    || [],
ventureJournal:       p.personal.ventureJournal       || [],
wallets:              ensureDefaultWallets(p.personal.wallets),
conversions:          p.personal.conversions          || [],
bucketNotes:          p.personal.bucketNotes          || {},
dismissedAnomalies:   p.personal.dismissedAnomalies   || [],
queue:                p.personal.queue                || [],
syncLog:              p.personal.syncLog              || [],
        };
p.app = {
...p.app,
dangerModeOverride: p.app?.dangerModeOverride || 'auto',
privacyMask: p.app?.privacyMask !== undefined ? p.app.privacyMask : true,
selectedCalendarDate: p.app?.selectedCalendarDate || new Date().toISOString().slice(0, 10),
calendarViewMode: p.app?.calendarViewMode || 'day',
};
        return p;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
app: {
...current.app,
...(persisted?.app || {}),
editingTxId: null,
searchOpen: false,
searchQuery: '',
settingsOpen: false,
quickSpendBucketKey: null,
},
        personal: {
          ...current.personal,
          ...(persisted?.personal || {}),
          wallets: ensureDefaultWallets(persisted?.personal?.wallets || current.personal.wallets),
          conversions: Array.isArray(persisted?.personal?.conversions) ? persisted.personal.conversions : (current.personal.conversions || []),
          bucketNotes: (persisted?.personal?.bucketNotes && typeof persisted.personal.bucketNotes === "object") ? persisted.personal.bucketNotes : (current.personal.bucketNotes || {}),
          dismissedAnomalies: Array.isArray(persisted?.personal?.dismissedAnomalies) ? persisted.personal.dismissedAnomalies : (current.personal.dismissedAnomalies || []),
          syncing: false,
          syncError: null,
          lastDeleted: null,
        },
      }),
    }
  )
);

function shallowEqualVal(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const k = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, k) || !Object.is(a[k], b[k])) return false;
  }
  return true;
}

export function useStore(selector) {
  if (typeof selector !== "function") return rawUseStore(selector);
  let wrapped = selector._stableWrapper;
  if (!wrapped) {
    let lastState;
    let lastResult;
    let hasRun = false;
    wrapped = (state) => {
      if (hasRun && state === lastState) {
        return lastResult;
      }
      const nextResult = selector(state);
      if (hasRun && shallowEqualVal(lastResult, nextResult)) {
        lastState = state;
        return lastResult;
      }
      hasRun = true;
      lastState = state;
      lastResult = nextResult;
      return nextResult;
    };
    selector._stableWrapper = wrapped;
  }
  return rawUseStore(wrapped);
}
Object.assign(useStore, rawUseStore);
useStore.getState = rawUseStore.getState;
useStore.setState = rawUseStore.setState;
useStore.subscribe = rawUseStore.subscribe;
useStore.getInitialState = rawUseStore.getInitialState;
useStore.persist = rawUseStore.persist;

// ════════════════════════════════════════════════════════════════════
// COMPUTATIONS
// ════════════════════════════════════════════════════════════════════
export function computeDebtRepaid(debtEvents, debtId) {
return (debtEvents || [])
    .filter((e) => e.debtId === debtId && e.type === 'repayment')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function computeVentureDeployed(ventureEvents, ventureId) {
return (ventureEvents || [])
    .filter((e) => e.ventureId === ventureId && e.type === 'deploy')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}


export function computeVentureDistributions(ventureDistributions, ventureId) {
  return (ventureDistributions || [])
    .filter((d) => d.ventureId === ventureId && d.type === 'distribution')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
}

export function computeBucketBalances(transactions, base, rates) {
  const balances = {};
for (const tx of (transactions || [])) {
if (!tx || tx.id === SYSTEM_STATE_ROW_ID || tx.type === 'meta') continue;
    const txCurrency = tx.currency || 'USD';
    const allocations = tx.buckets || {};
    for (const [bucketKey, amount] of Object.entries(allocations)) {
      const baseAmount = convert(Number(amount) || 0, txCurrency, base, rates);
      balances[bucketKey] = (balances[bucketKey] || 0) + baseAmount;
    }
  }
  return balances;
}


export function computeTotalLiquid(transactions, base, rates) {
  const balances = computeBucketBalances(transactions, base, rates);
  let total = 0;
  for (const v of Object.values(balances)) {
    if (v > 0) total += v;
  }
  return total;
}

export function computeWalletsWithReconciliation(wallets, transactions, conversions, base, rates, upToDateStr = null) {
const list = Array.isArray(wallets) && wallets.length > 0 ? wallets : DEFAULT_WALLETS;
const cutoffTs = upToDateStr ? new Date(`${upToDateStr}T23:59:59.999`).getTime() : Infinity;
const txNetByWalletInWalletCurr = {};
let overallAvailableBase = 0;
for (const tx of (transactions || [])) {
if (!tx || tx.id === SYSTEM_STATE_ROW_ID || tx.type === 'meta') continue;
const ts = new Date(tx.date).getTime();
if (!isNaN(ts) && ts > cutoffTs) continue;
if (tx.type === 'transfer') continue;
if (tx.category !== BORROWED_CATEGORY) {
const amtBase = convert(Math.abs(Number(tx.amount) || 0), tx.currency || 'USD', base, rates);
if (tx.type === 'income') overallAvailableBase += amtBase;
else if (tx.type === 'expense') overallAvailableBase -= amtBase;
}
const wId = tx.walletId || inferWalletIdForTx(tx);
const wObj = list.find((w) => w.id === wId) || list[0];
const wCurr = wObj?.currency || 'HTG';
const amtInW = convert(Math.abs(Number(tx.amount) || 0), tx.currency || 'USD', wCurr, rates);
if (!txNetByWalletInWalletCurr[wId]) txNetByWalletInWalletCurr[wId] = 0;
if (tx.type === 'income' && tx.category !== BORROWED_CATEGORY) {
txNetByWalletInWalletCurr[wId] += amtInW;
} else if (tx.type === 'expense') {
txNetByWalletInWalletCurr[wId] -= amtInW;
}
}
for (const c of (conversions || [])) {
const ts = new Date(c.date).getTime();
if (!isNaN(ts) && ts > cutoffTs) continue;
const fromW = list.find((w) => w.id === c.fromWalletId);
const toW   = list.find((w) => w.id === c.toWalletId);
if (fromW) {
const dec = convert(Number(c.fromAmount) || 0, c.fromCurrency || 'USD', fromW.currency, rates);
txNetByWalletInWalletCurr[fromW.id] = (txNetByWalletInWalletCurr[fromW.id] || 0) - dec;
}
if (toW) {
const inc = convert(Number(c.toAmount) || 0, c.toCurrency || 'HTG', toW.currency, rates);
txNetByWalletInWalletCurr[toW.id] = (txNetByWalletInWalletCurr[toW.id] || 0) + inc;
}
if (Number(c.feeAmount) > 0) {
const hasLinkedFeeTx = (transactions || []).some((t) => t && (t.linkedConversionId === c.id || (c.feeTxId && t.id === c.feeTxId) || ((t.category === "Conversion Fee" || t.category === "Fees") && Math.abs(Number(t.amount) - Number(c.feeAmount)) < 0.01)));
if (!hasLinkedFeeTx) {
overallAvailableBase -= convert(Number(c.feeAmount) || 0, c.feeCurrency || c.fromCurrency || 'USD', base, rates);
}
}
}
let totalWalletsBase = 0;
let anyManualSet = false;
const enrichedWallets = list.map((w) => {
const hasManual = Boolean(w.manualUpdatedAt || w.useManualBalance);
if (hasManual) anyManualSet = true;
const computedBal = Math.max(0, Math.round((txNetByWalletInWalletCurr[w.id] || 0) * 100) / 100);
const manualVal = w.balance !== undefined ? w.balance : w.manualBalance;
const effectiveBalance = hasManual ? Number(manualVal) || 0 : computedBal;
const balanceBase = convert(effectiveBalance, w.currency || 'HTG', base, rates);
totalWalletsBase += balanceBase;
return {
...w,
computedBalance: computedBal,
effectiveBalance,
balanceBase,
hasManual,
};
});
const positiveBucketsBase = computeTotalLiquid(
(transactions || []).filter((t) => {
const ts = new Date(t?.date).getTime();
return isNaN(ts) || ts <= cutoffTs;
}),
base,
rates
);
const expectedTotalBase = Math.max(0, overallAvailableBase);
const differenceBase = totalWalletsBase - expectedTotalBase;
const isBalanced = Math.abs(differenceBase) < 1;
return {
wallets: enrichedWallets,
totalWalletsBase,
expectedTotalBase,
overallAvailableBase,
differenceBase, // negative = missing money in wallets; positive = extra unallocated money in wallets
missingAmountBase: differenceBase < -1 ? Math.abs(differenceBase) : 0,
extraAmountBase: differenceBase > 1 ? differenceBase : 0,
isBalanced,
anyManualSet,
};
}
export function computePeriodLedger(transactions, conversions, wallets, base, rates, startDateStr, endDateStr) {
const startTs = new Date(`${startDateStr}T00:00:00.000`).getTime();
const endTs   = new Date(`${endDateStr}T23:59:59.999`).getTime();
const incomeTxs = [];
const spendingTxs = [];
let totalIncomeBase = 0;
let totalSpendingBase = 0;
for (const tx of (transactions || [])) {
if (!tx || tx.id === SYSTEM_STATE_ROW_ID || tx.type === 'meta' || tx.type === 'transfer') continue;
const ts = new Date(tx.date).getTime();
if (isNaN(ts) || ts < startTs || ts > endTs) continue;
if (tx.category === BORROWED_CATEGORY) continue; // Borrowed is liability/pool, not earned income
const amtBase = convert(Math.abs(Number(tx.amount) || 0), tx.currency || 'USD', base, rates);
if (tx.type === 'income') {
incomeTxs.push({ ...tx, amountBase: amtBase });
totalIncomeBase += amtBase;
} else if (tx.type === 'expense') {
spendingTxs.push({ ...tx, amountBase: amtBase });
totalSpendingBase += amtBase;
}
}
const periodConversions = (conversions || []).filter((c) => {
const ts = new Date(c.date).getTime();
return !isNaN(ts) && ts >= startTs && ts <= endTs;
});
const totalFeesBase = periodConversions.reduce(
(s, c) => s + convert(Math.abs(Number(c.feeAmount) || 0), c.feeCurrency || 'HTG', base, rates),
0
);
const unlinkedFeesBase = periodConversions.reduce((s, c) => {
if (!(Number(c.feeAmount) > 0)) return s;
const hasLinkedFeeTx = (transactions || []).some((t) => t && (t.linkedConversionId === c.id || (c.feeTxId && t.id === c.feeTxId) || ((t.category === "Conversion Fee" || t.category === "Fees") && Math.abs(Number(t.amount) - Number(c.feeAmount)) < 0.01)));
return hasLinkedFeeTx ? s : s + convert(Math.abs(Number(c.feeAmount) || 0), c.feeCurrency || 'HTG', base, rates);
}, 0);
const netForPeriodBase = totalIncomeBase - totalSpendingBase - unlinkedFeesBase;
const walletRecon = computeWalletsWithReconciliation(wallets, transactions, conversions, base, rates, endDateStr);
return {
startDateStr,
endDateStr,
incomeTxs,
spendingTxs,
periodConversions,
totalIncomeBase,
totalSpendingBase,
totalFeesBase,
netForPeriodBase,
overallAvailableBase: walletRecon.expectedTotalBase,
walletRecon,
};
}
export function computeItemMonthlyEquivalent(item, base, rates) {
const amtBase = convert(Math.abs(Number(item.amount) || 0), item.currency || 'USD', base, rates);
switch (item.frequency) {
case 'daily':    return amtBase * 30;
case 'weekly':   return amtBase * 4.345;
case 'biweekly': return amtBase * 2.1725;
case 'yearly':   return amtBase / 12;
case 'once':
case 'monthly':
default:         return amtBase;
}
}
export function computeItemWeeklyEquivalent(item, base, rates) {
const amtBase = convert(Math.abs(Number(item.amount) || 0), item.currency || 'USD', base, rates);
switch (item.frequency) {
case 'daily':    return amtBase * 7;
case 'weekly':   return amtBase;
case 'biweekly': return amtBase / 2;
case 'yearly':   return amtBase / 52.14;
case 'once':
case 'monthly':
default:         return amtBase / 4.345;
}
}
export function computeBucketBudgetSummary(buckets, transactions, goals, budgetItems, base, rates) {
const balances = computeBucketBalances(transactions, base, rates);
const mtd = computeBucketMTD(transactions, base, rates);
const cutoff30d = Date.now() - 30 * 24 * 3600 * 1000;
const rolling30d = {};
let totalEarnedIncome30d = 0;
for (const tx of (transactions || [])) {
if (!tx || tx.id === SYSTEM_STATE_ROW_ID || tx.type === 'meta') continue;
const ts = new Date(tx.date).getTime();
if (isNaN(ts) || ts < cutoff30d) continue;
const txCurrency = tx.currency || 'USD';
if (tx.type === 'income' && tx.category !== BORROWED_CATEGORY && tx.category !== 'Repayment received') {
totalEarnedIncome30d += convert(Math.abs(Number(tx.amount) || 0), txCurrency, base, rates);
}
for (const [k, v] of Object.entries(tx.buckets || {})) {
const amtBase = convert(Math.abs(Number(v) || 0), txCurrency, base, rates);
if (!rolling30d[k]) rolling30d[k] = { inflow: 0, outflow: 0 };
if (Number(v) > 0) rolling30d[k].inflow += amtBase;
if (Number(v) < 0) rolling30d[k].outflow += amtBase;
}
}
const expectedItems = (budgetItems || []).filter((b) => b && b.status === 'expected');
const totalExpectedMonthlyIncome = expectedItems
.filter((b) => b.type === 'income')
.reduce((s, b) => s + computeItemMonthlyEquivalent(b, base, rates), 0);
const baselineMonthlyIncome = Math.max(totalEarnedIncome30d, totalExpectedMonthlyIncome);
const sorted = [...(buckets || [])]
.filter((b) => b && b.enabled !== false)
.sort((a, b) => (a.order || 0) - (b.order || 0));
return sorted.map((bucket) => {
const balance = balances[bucket.key] || 0;
const positiveBalance = Math.max(0, balance);
const bucketMtd = mtd[bucket.key] || { inflow: 0, outflow: 0 };
const bucket30d = rolling30d[bucket.key] || { inflow: 0, outflow: 0 };
const computedGoals = computeGoalsForBucket(goals || [], bucket.key, positiveBalance, base, rates);
const activeGoals = computedGoals.filter((g) => g.status === 'active');
const goalsTotalTarget = activeGoals.reduce((s, g) => s + (g.targetBase || 0), 0);
const goalsFilled = activeGoals.reduce((s, g) => s + (g.filledBase || 0), 0);
const goalsRemaining = Math.max(0, goalsTotalTarget - goalsFilled);
const readyGoalsCount = activeGoals.filter((g) => g.ready).length;
const bucketPlannedExpenses = expectedItems.filter(
(b) => b.type === 'expense' && b.bucketKey === bucket.key
);
const plannedMonthlyOutflow = bucketPlannedExpenses.reduce(
(s, b) => s + computeItemMonthlyEquivalent(b, base, rates),
0
);
const plannedWeeklyOutflow = bucketPlannedExpenses.reduce(
(s, b) => s + computeItemWeeklyEquivalent(b, base, rates),
0
);
const targetMonthlyAllowance = baselineMonthlyIncome * ((Number(bucket.percentage) || 0) / 100);
const committedNow = goalsFilled + plannedWeeklyOutflow;
const safeToSpend = Math.max(0, balance - committedNow);
const uncommittedAfterMonth = balance - goalsTotalTarget - plannedMonthlyOutflow;
const dailyBurn = Math.max(bucket30d.outflow / 30, plannedMonthlyOutflow / 30);
const dailyInflow = Math.max(bucket30d.inflow / 30, targetMonthlyAllowance / 30);
const runwayDays = dailyBurn > 0 && balance > 0 ? Math.round(balance / dailyBurn) : (balance > 0 ? 999 : 0);
const daysToFundGoals =
goalsRemaining <= 0 ? 0 :
dailyInflow > 0 ? Math.ceil(goalsRemaining / dailyInflow) : null;
let healthScore = 85;
if (balance < 0) healthScore = Math.max(10, 45 - Math.min(35, Math.round((Math.abs(balance) / Math.max(1, targetMonthlyAllowance || 100)) * 30)));
else if (plannedMonthlyOutflow > targetMonthlyAllowance && targetMonthlyAllowance > 0) healthScore = 62;
else if (safeToSpend > 0 && readyGoalsCount > 0) healthScore = 96;
else if (balance > 0) healthScore = 88;
const statusTone =
balance < 0 ? 'danger' :
(plannedMonthlyOutflow > 0 && balance < plannedWeeklyOutflow) ? 'warn' :
'safe';
return {
...bucket,
balance,
positiveBalance,
inflowMTD: bucketMtd.inflow,
outflowMTD: bucketMtd.outflow,
inflow30d: bucket30d.inflow,
outflow30d: bucket30d.outflow,
dailyInflow,
dailyBurn,
runwayDays,
targetMonthlyAllowance,
plannedExpenses: bucketPlannedExpenses,
plannedMonthlyOutflow,
plannedWeeklyOutflow,
activeGoals,
goalsTotalTarget,
goalsFilled,
goalsRemaining,
readyGoalsCount,
daysToFundGoals,
committedNow,
safeToSpend,
uncommittedAfterMonth,
healthScore,
statusTone,
};
});
}
export function detectCurrencyAnomalies(transactions, dismissedIds = []) {
const dismissed = new Set(dismissedIds || []);
const byNote = {};
for (const tx of (transactions || [])) {
if (!tx || tx.id === SYSTEM_STATE_ROW_ID || tx.type === 'meta') continue;
const key = (tx.notes || '').trim().toLowerCase();
if (!key || key.length < 3) continue;
if (!byNote[key]) byNote[key] = [];
byNote[key].push(tx);
}
const anomalies = [];
for (const [, group] of Object.entries(byNote)) {
if (group.length < 2) continue;
const nonUsd = group.filter((t) => (t.currency || 'USD') !== 'USD');
const usd = group.filter((t) => (t.currency || 'USD') === 'USD');
if (nonUsd.length >= 1 && usd.length >= 1) {
const typicalCurrency = nonUsd[0].currency;
const avgNominal = nonUsd.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0) / nonUsd.length;
for (const u of usd) {
if (dismissed.has(u.id)) continue;
const uAmt = Math.abs(Number(u.amount) || 0);
if (Math.abs(uAmt - avgNominal) <= Math.max(10, avgNominal * 0.5)) {
anomalies.push({
txId: u.id,
notes: u.notes,
date: u.date,
amount: u.amount,
currentCurrency: u.currency || 'USD',
suggestedCurrency: typicalCurrency,
reason: `"${u.notes}" was logged as ${u.amount} USD, while similar "${u.notes}" entries were ${avgNominal} ${typicalCurrency}.`,
});
}
}
}
}
return anomalies;
}
export function computeDebtPayoffPlan(debts, debtEvents, transactions, budgetItems, base, rates, strategy = 'avalanche') {
const activeDebts = computeDebtsWithStatus(debts || [], debtEvents || [], base, rates)
.filter((d) => d.direction === 'owe' && d.remainingBase > 0.01);
const totalRemainingBase = activeDebts.reduce((s, d) => s + d.remainingBase, 0);
const cutoff30d = Date.now() - 30 * 24 * 3600 * 1000;
let earned30d = 0;
for (const t of (transactions || [])) {
if (!t || t.id === SYSTEM_STATE_ROW_ID || t.type === 'meta') continue;
if (new Date(t.date).getTime() < cutoff30d) continue;
if (t.type === 'income' && t.category !== BORROWED_CATEGORY && t.category !== 'Repayment received') {
earned30d += convert(Math.abs(Number(t.amount) || 0), t.currency || 'USD', base, rates);
}
}
const expectedMonthlyIncome = (budgetItems || [])
.filter((b) => b && b.status === 'expected' && b.type === 'income')
.reduce((s, b) => s + computeItemMonthlyEquivalent(b, base, rates), 0);
const monthlyIncomeBase = Math.max(earned30d, expectedMonthlyIncome);
const monthlyDebtPower = monthlyIncomeBase * 0.40;
const weeklyDebtPower = monthlyDebtPower / 4.345;
const ordered = [...activeDebts].sort((a, b) => {
if (strategy === 'snowball') {
return a.remainingBase - b.remainingBase;
}
if ((b.interestRate || 0) !== (a.interestRate || 0)) {
return (b.interestRate || 0) - (a.interestRate || 0);
}
return a.remainingBase - b.remainingBase;
});
let cumulativeDebt = 0;
const schedule = ordered.map((d, idx) => {
cumulativeDebt += d.remainingBase;
const monthsToClear = monthlyDebtPower > 0 ? cumulativeDebt / monthlyDebtPower : null;
const weeksToClear = weeklyDebtPower > 0 ? Math.ceil(cumulativeDebt / weeklyDebtPower) : null;
return {
...d,
order: idx + 1,
cumulativeDebtBase: cumulativeDebt,
monthsToClear,
weeksToClear,
};
});
return {
strategy,
totalRemainingBase,
monthlyIncomeBase,
monthlyDebtPower,
weeklyDebtPower,
estimatedMonthsToDebtFree: monthlyDebtPower > 0 ? totalRemainingBase / monthlyDebtPower : null,
estimatedWeeksToDebtFree: weeklyDebtPower > 0 ? Math.ceil(totalRemainingBase / weeklyDebtPower) : null,
schedule,
};
}
export function computeExpectedOccurrences(budgetItems, fromDate, toDate) {
  const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
  const to = new Date(toDate); to.setHours(23, 59, 59, 999);
  const map = {};
  const key = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  for (const item of (budgetItems || [])) {
    if (item.status !== 'expected') continue;
    const start = new Date(item.startDate);
    if (isNaN(start)) continue;
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= to && guard < 400) {
      if (cursor >= from) {
        const k = key(cursor);
        if (!map[k]) map[k] = { income: 0, expense: 0, items: [] };
        if (item.type === 'income') map[k].income += Number(item.amount) || 0;
        else map[k].expense += Number(item.amount) || 0;
        map[k].items.push(item.id);
      }
if (item.frequency === 'once') break;
      if (item.frequency === 'daily') {
        cursor.setDate(cursor.getDate() + 1);
      } else if (item.frequency === 'weekly') {
        cursor.setDate(cursor.getDate() + 7);
} else if (item.frequency === 'biweekly') {
cursor.setDate(cursor.getDate() + 14);
} else {
cursor.setMonth(cursor.getDate() + 1);
        const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        cursor.setDate(Math.min(Number(item.dayOfMonth) || 1, lastDay));
      }
      guard++;
    }
  }
  return map;
}


export function computeBorrowedPool(debts, debtEvents, borrowedDeployments, base, rates) {
  let total = 0;
for (const d of (debts || [])) {
    if ((d.direction || 'owe') !== 'owe') continue;
    if (d.status === 'paid') continue;
    const repaid = computeDebtRepaid(debtEvents, d.id);
const remainingDebt = (Number(d.principal) || 0) - repaid;
    if (remainingDebt <= 0) continue;

    const deployed = (borrowedDeployments || [])
      .filter((dep) => dep.sourceDebtId === d.id)
      .reduce((sum, dep) => sum + convert(Number(dep.amount) || 0, dep.currency || 'USD', d.currency, rates), 0);
const undeployed = Math.max(0, Math.min(remainingDebt, (Number(d.principal) || 0) - deployed));
    total += convert(undeployed, d.currency, base, rates);
  }
  return total;
}

export function computeBorrowedSummary(debts, debtEvents, borrowedDeployments, base, rates) {
let totalPrincipalBase = 0;
let totalRemainingDebtBase = 0;
let totalDeployedOrSpentBase = 0;
let undeployedPoolBase = 0;
for (const d of (debts || [])) {
if ((d.direction || 'owe') !== 'owe') continue;
if (d.status === 'paid') continue;
const repaid = computeDebtRepaid(debtEvents, d.id);
const remainingDebt = Math.max(0, (Number(d.principal) || 0) - repaid);
if (remainingDebt <= 0) continue;
const deployedInDebtCurr = (borrowedDeployments || [])
.filter((dep) => dep.sourceDebtId === d.id)
.reduce((sum, dep) => sum + convert(Number(dep.amount) || 0, dep.currency || 'USD', d.currency, rates), 0);
const undeployedInDebtCurr = Math.max(0, Math.min(remainingDebt, (Number(d.principal) || 0) - deployedInDebtCurr));
totalPrincipalBase += convert(Number(d.principal) || 0, d.currency, base, rates);
totalRemainingDebtBase += convert(remainingDebt, d.currency, base, rates);
totalDeployedOrSpentBase += convert(deployedInDebtCurr, d.currency, base, rates);
undeployedPoolBase += convert(undeployedInDebtCurr, d.currency, base, rates);
}
return {
totalPrincipalBase,
totalRemainingDebtBase,
totalDeployedOrSpentBase,
undeployedPoolBase,
};
}
export function computeDebtTrail(debt, borrowedDeployments, investments, ventures, ventureEvents, ventureDistributions, base, rates) {
  const myDeployments = (borrowedDeployments || []).filter((d) => d.sourceDebtId === debt.id);
  return myDeployments.map((d) => {
    const amountBase = convert(Number(d.amount) || 0, d.currency || 'USD', base, rates);
let currentValueBase = amountBase;
    let roi = 0;
    if (d.destinationType === 'investment') {
      const inv = (investments || []).find((i) => i.id === d.destinationId);
      if (inv) {
        const currentValue = inv.units * inv.currentPrice;
        currentValueBase = convert(currentValue * (Number(d.amount) / Math.max(1, inv.units * inv.costBasis)), inv.currency, base, rates);
        roi = currentValueBase - amountBase;
      }
    } else if (d.destinationType === 'venture') {
      const v = (ventures || []).find((x) => x.id === d.destinationId);
      if (v) {
        const totalDeployed = computeVentureDeployed(ventureEvents, v.id);
        const valuation = Number(v.currentValuation) || 0;
        const distributions = computeVentureDistributions(ventureDistributions, v.id);
        const shareOfPie = totalDeployed > 0 ? (Number(d.amount) / totalDeployed) : 0;
        const valuationShareBase = convert(valuation * shareOfPie, v.valuationCurrency || 'USD', base, rates);
        const distributionShareBase = convert(distributions * shareOfPie, v.valuationCurrency || 'USD', base, rates);
        currentValueBase = valuationShareBase + distributionShareBase;
        roi = currentValueBase - amountBase;
      }
    }
    return { ...d, amountBase, currentValueBase, roi };
  });
}

export function computeBucketMTD(transactions, base, rates) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const mtd = {};
for (const tx of (transactions || [])) {
if (!tx || tx.id === SYSTEM_STATE_ROW_ID || tx.type === 'meta') continue;
    if (new Date(tx.date) < monthStart) continue;
    const txCurrency = tx.currency || 'USD';
    const allocations = tx.buckets || {};
    for (const [bucketKey, amount] of Object.entries(allocations)) {
      const baseAmount = convert(Math.abs(Number(amount) || 0), txCurrency, base, rates);
      if (!mtd[bucketKey]) mtd[bucketKey] = { inflow: 0, outflow: 0 };
      if (amount > 0) mtd[bucketKey].inflow  += baseAmount;
      if (amount < 0) mtd[bucketKey].outflow += baseAmount;
    }
  }
  return mtd;
}

export function computeGoalsForBucket(goals, bucketKey, bucketBalance, base, rates) {
const active = (goals || [])
    .filter((g) => g.bucketKey === bucketKey && g.status === 'active')
    .sort((a, b) => a.priority - b.priority);
  let remaining = Math.max(0, bucketBalance);
  const result = [];
  for (const g of active) {
    if (g.parallel) continue;
    const targetBase = convert(g.target, g.currency, base, rates);
    const filled = Math.min(remaining, targetBase);
    remaining -= filled;
    result.push({
      ...g, filledBase: filled, targetBase,
      progress: targetBase > 0 ? filled / targetBase : 0,
      ready: filled >= targetBase,
    });
  }
  const parallelGoals = active.filter((g) => g.parallel);
  const parallelTotalTarget = parallelGoals.reduce((s, g) => s + convert(g.target, g.currency, base, rates), 0);
  for (const g of parallelGoals) {
    const targetBase = convert(g.target, g.currency, base, rates);
    const share = parallelTotalTarget > 0 ? targetBase / parallelTotalTarget : 0;
    const filled = Math.min(targetBase, remaining * share);
    result.push({
      ...g, filledBase: filled, targetBase,
      progress: targetBase > 0 ? filled / targetBase : 0,
      ready: filled >= targetBase,
    });
  }
  return result.sort((a, b) => a.priority - b.priority);
}


export function computeBucketImpact(transactions, goals, bucketKey, expenseAmount, expenseCurrency, base, rates) {
  const balances = computeBucketBalances(transactions, base, rates);
  const balance = balances[bucketKey] || 0;
  const expenseInBase = convert(Number(expenseAmount) || 0, expenseCurrency || 'USD', base, rates);
  const balanceAfter = balance - expenseInBase;


  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  let total30d = 0;
for (const t of (transactions || [])) {
    if (new Date(t.date).getTime() < cutoff) continue;
    const allocations = t.buckets || {};
    const v = allocations[bucketKey];
    if (typeof v === 'number' && v > 0) {
      total30d += convert(v, t.currency || 'USD', base, rates);
    }
  }
  const dailyInflow = total30d / 30;
  const delayDays = dailyInflow > 0 ? Math.round(expenseInBase / dailyInflow) : null;


  const goalsBefore = computeGoalsForBucket(goals, bucketKey, balance, base, rates);
  const goalsAfter  = computeGoalsForBucket(goals, bucketKey, balanceAfter, base, rates);
  const affectedGoals = goalsBefore.map((g) => {
    const after = goalsAfter.find((x) => x.id === g.id) || g;
    return {
      id: g.id, name: g.name,
      target: g.targetBase,
      filledBefore: g.filledBase,
      filledAfter: Math.max(0, after.filledBase),
      deficit: Math.max(0, g.targetBase - after.filledBase),
      wasReady: g.ready,
      stillReady: after.ready,
    };
  });

  return { balance, balanceAfter, dailyInflow, delayDays, affectedGoals };
}

export function gatherTags(transactions) {
  const tagSet = new Set();
for (const t of (transactions || [])) {
    const tagStr = t.tags || '';
    if (typeof tagStr !== 'string') continue;
    for (const tag of tagStr.split(',')) {
      const trimmed = tag.trim();
      if (trimmed) tagSet.add(trimmed);
    }
  }
  return Array.from(tagSet).sort();
}

export function searchTransactions(transactions, { query = '', type = null, category = null, tags = [], dateFrom = null, dateTo = null, minAmount = null, maxAmount = null }) {
  const q = query.toLowerCase().trim();
return (transactions || []).filter((t) => {
if (!t || t.id === SYSTEM_STATE_ROW_ID || t.type === 'meta') return false;
    if (type && t.type !== type) return false;
    if (category && t.category !== category) return false;
    if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.date) > new Date(dateTo)) return false;
    if (minAmount !== null && Math.abs(t.amount) < Number(minAmount)) return false;
    if (maxAmount !== null && Math.abs(t.amount) > Number(maxAmount)) return false;
    if (tags.length > 0) {
      const txTags = (t.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!tags.every((tag) => txTags.includes(tag))) return false;
    }
    if (q) {
      const haystack = [t.notes, t.category, t.tags, String(t.amount), t.currency].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ════════════════════════════════════════════════════════════════════
// SELECTORS
// ════════════════════════════════════════════════════════════════════
export const selectTransactions     = (s) => s.personal.transactions;
export const selectBudgets          = (s) => s.personal.budgets;
export const selectBudgetItems      = (s) => s.personal.budgetItems;
export const selectDebts            = (s) => s.personal.debts;
export const selectDebtEvents       = (s) => s.personal.debtEvents;
export const selectInvestments      = (s) => s.personal.investments;
export const selectInvestmentEvents = (s) => s.personal.investmentEvents;
export const selectVentures         = (s) => s.personal.ventures;
export const selectVentureEvents    = (s) => s.personal.ventureEvents;
export const selectBuckets          = (s) => selectActiveBuckets(s);
export const selectRawBuckets       = (s) => s.personal.buckets;
export const selectGoals            = (s) => s.personal.goals;
export const selectRecurring        = (s) => s.personal.recurring;
export const selectPending          = (s) => s.personal.pending;
export const selectTemplates        = (s) => s.personal.templates;
export const selectCategories       = (s) => s.personal.categories;

export const selectBorrowedDeployments  = (s) => s.personal.borrowedDeployments;
export const selectVentureDistributions = (s) => s.personal.ventureDistributions;
export const selectVentureMilestones    = (s) => s.personal.ventureMilestones;
export const selectVentureJournal       = (s) => s.personal.ventureJournal;
export const selectWallets          = (s) => (s.personal.wallets && s.personal.wallets.length > 0 ? s.personal.wallets : DEFAULT_WALLETS);
export const selectConversions      = (s) => s.personal.conversions || EMPTY_ARRAY;
export const selectBucketNotes      = (s) => s.personal.bucketNotes || EMPTY_OBJECT;
export const selectDismissedAnomalies = (s) => s.personal.dismissedAnomalies || EMPTY_ARRAY;
export const selectActiveTab        = (s) => s.app.activeTab;
export const selectBaseCurrency     = (s) => s.app.baseCurrency;
export const selectRates            = (s) => s.app.rates;
export const selectTheme            = (s) => s.app.theme;
export const selectDangerModeOverride = (s) => s.app.dangerModeOverride || 'auto';
export const selectPrivacyMask      = (s) => s.app.privacyMask !== false;
export const selectQuickSpendBucket = (s) => s.app.quickSpendBucketKey;
export const selectSelectedCalendarDate = (s) => s.app.selectedCalendarDate || DEFAULT_TODAY_STR;
export const selectCalendarViewMode = (s) => s.app.calendarViewMode || 'day';
export const selectHighlightedTxId  = (s) => s.app.highlightedTxId;
export const selectQueueSize        = (s) => (s.personal.queue || []).length;
export const selectSyncLog          = (s) => s.personal.syncLog;
export const selectIsSyncing        = (s) => s.personal.syncing;
export const selectIsOnline         = (s) => s.app.online;
export const selectEditingTxId      = (s) => s.app.editingTxId;
export const selectLastDeleted      = (s) => s.personal.lastDeleted;
export const selectSearchQuery      = (s) => s.app.searchQuery;
export const selectSearchOpen       = (s) => s.app.searchOpen;
export const selectSettingsOpen     = (s) => s.app.settingsOpen;


export const selectTotalDebtInBase = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  let sum = 0;
  for (const d of (state.personal.debts || [])) {
    if ((d.direction || 'owe') !== 'owe') continue;
if (d.status === 'paid') continue;
    const repaid = computeDebtRepaid(state.personal.debtEvents || [], d.id);
    const remaining = d.principal - repaid;
    if (remaining > 0) sum += convert(remaining, d.currency, base, rates);
  }
  return sum;
};
export const selectIsDangerMode = (state) => {
const override = state?.app?.dangerModeOverride || 'auto';
if (override === 'danger') return true;
if (override === 'normal') return false;
return selectTotalDebtInBase(state) > 0.005;
};
let _cachedBucketsInput = undefined;
let _cachedBucketsDanger = undefined;
let _cachedBucketsResult = null;

export const selectActiveBuckets = (state) => {
  const isDanger = selectIsDangerMode(state);
  const raw = state?.personal?.buckets || EMPTY_ARRAY;
  if (_cachedBucketsResult && _cachedBucketsInput === raw && _cachedBucketsDanger === isDanger) {
    return _cachedBucketsResult;
  }
  _cachedBucketsInput = raw;
  _cachedBucketsDanger = isDanger;
  _cachedBucketsResult = resolveModeBuckets(raw, isDanger);
  return _cachedBucketsResult;
};

export const selectTotalReceivableInBase = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  let sum = 0;
  for (const d of (state.personal.debts || [])) {
    if (d.direction !== 'receivable') continue;
    const repaid = computeDebtRepaid(state.personal.debtEvents || [], d.id);
    const remaining = d.principal - repaid;
    if (remaining > 0) sum += convert(remaining, d.currency, base, rates);
  }
  return sum;
};


export function computeTotalLiabilities(debts, debtEvents, base, rates) {
  let sum = 0;
  for (const d of (debts || [])) {
    if ((d.direction || 'owe') !== 'owe') continue;
    if (d.status === 'paid') continue;
    const repaid = computeDebtRepaid(debtEvents || [], d.id);
    const remaining = (Number(d.principal) || 0) - repaid;
    if (remaining > 0) sum += convert(remaining, d.currency || 'USD', base, rates);
  }
  return sum;
}

export function computeTotalReceivables(debts, debtEvents, base, rates) {
  let sum = 0;
  for (const d of (debts || [])) {
    if (d.direction !== 'receivable') continue;
    const repaid = computeDebtRepaid(debtEvents || [], d.id);
    const remaining = (Number(d.principal) || 0) - repaid;
    if (remaining > 0) sum += convert(remaining, d.currency || 'USD', base, rates);
  }
  return sum;
}

export function computeInvestmentsValue(investments, base, rates) {
  let sum = 0;
  for (const inv of (investments || [])) {
    sum += convert((Number(inv.units) || 0) * (Number(inv.currentPrice) || 0), inv.currency, base, rates);
  }
  return sum;
}

export function computeVenturesValue(ventures, base, rates) {
  let sum = 0;
  for (const v of (ventures || [])) {
    if (v.status === 'failed') continue;
    sum += convert(Number(v.currentValuation) || 0, v.valuationCurrency || 'USD', base, rates);
  }
  return sum;
}


export function computeNetCash(transactions, base, rates) {
  const balances = computeBucketBalances(transactions, base, rates);
  let total = 0;
  for (const v of Object.values(balances)) total += v;
  return total;
}

export function computeTotalAssets(personal, base, rates) {
  return computeNetCash(personal.transactions || [], base, rates)
    + computeBorrowedPool(
      personal.debts || [], personal.debtEvents || [], personal.borrowedDeployments || [], base, rates,
    )
    + computeInvestmentsValue(personal.investments || [], base, rates)
    + computeVenturesValue(personal.ventures || [], base, rates)
    + computeTotalReceivables(personal.debts || [], personal.debtEvents || [], base, rates);
}

export const selectTotalLiquidAssets = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  return computeTotalLiquid(state.personal.transactions || [], base, rates)
    + computeBorrowedPool(
      state.personal.debts || [], state.personal.debtEvents || [],
      state.personal.borrowedDeployments || [], base, rates,
    );
};

export const selectTotalAssets = (state) =>
  computeTotalAssets(state.personal, state.app.baseCurrency, state.app.rates);

export const selectTotalLiabilities = (state) =>
  computeTotalLiabilities(
    state.personal.debts || [], state.personal.debtEvents || [],
    state.app.baseCurrency, state.app.rates,
  );


export const selectNetWorth = (state) => selectTotalAssets(state) - selectTotalLiabilities(state);


export const selectBorrowedPool = (state) => computeBorrowedPool(
  state.personal.debts || [],
  state.personal.debtEvents || [],
  state.personal.borrowedDeployments || [],
  state.app.baseCurrency,
  state.app.rates,
);


export function computeMonthSummary(transactions, base, rates) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
let income = 0, expense = 0, repaymentExpense = 0;
for (const t of (transactions || [])) {
if (!t || t.id === SYSTEM_STATE_ROW_ID || t.type === 'meta') continue;
    if (new Date(t.date) < monthStart) continue;
    if (t.type === 'transfer') continue;
    if (t.category === BORROWED_CATEGORY || t.category === LENT_CATEGORY) continue;
    const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
    if (t.category === 'Repayment' || t.category === 'Repayment received') {
repaymentExpense += v;
      const interest = convert(Math.abs(Number(t.interestAmount) || 0), t.currency || 'USD', base, rates);
      if (interest > 0) expense += interest;
      continue;
    }
    if (t.type === 'income') income += v;
    else if (t.type === 'expense') expense += v;
  }
return {
income,
expense,
repaymentExpense,
totalSpendWithRepayments: expense + repaymentExpense,
net: income - expense,
netAfterRepayments: income - (expense + repaymentExpense),
};
}


export function computeMonthCashFlow(transactions, base, rates) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let cashIn = 0, cashOut = 0;
for (const t of (transactions || [])) {
if (!t || t.id === SYSTEM_STATE_ROW_ID || t.type === 'meta') continue;
    if (new Date(t.date) < monthStart) continue;
    if (t.type === 'transfer') continue;
    const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
    if (t.type === 'income') cashIn += v;
    else if (t.type === 'expense') cashOut += v;
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}


export function computeRecurringRevenueMonthly(recurring, base, rates) {
  let total = 0;
  for (const r of (recurring || [])) {
    if (r.type !== 'income') continue;
    if (r.enabled === false || r.status === 'paused') continue;
    const v = convert(Math.abs(Number(r.amount) || 0), r.currency || 'USD', base, rates);
    const interval = Math.max(1, Number(r.interval) || 1);
    let monthly = v;
    switch (r.frequency) {
      case 'daily':    monthly = v * (30 / interval); break;
      case 'weekly':   monthly = v * (4.345 / interval); break;
      case 'biweekly': monthly = v * (2.1725 / interval); break;
      case 'yearly':   monthly = v / (12 * interval); break;
      case 'monthly':
      default:         monthly = v / interval; break;
    }
    total += monthly;
  }
  return total;
}

export function computeInvestmentTotals(investments, base, rates) {
  let cost = 0, value = 0;
for (const inv of (investments || [])) {
    cost  += convert(inv.units * inv.costBasis,    inv.currency, base, rates);
    value += convert(inv.units * inv.currentPrice, inv.currency, base, rates);
  }
  return { cost, value, gain: value - cost, gainPct: cost > 0 ? (value - cost) / cost : 0 };
}


export function computeVentureTotals(ventures, ventureEvents, ventureDistributions, base, rates) {
return (ventures || []).map((v) => {
const deployEvents = (ventureEvents || []).filter((e) => e.ventureId === v.id && e.type === 'deploy');
    let deployedTotal = 0;
    for (const e of deployEvents) {
      deployedTotal += convert(e.amount, e.currency, base, rates);
    }
    let distributionsTotal = 0;
    const dists = (ventureDistributions || []).filter((d) => d.ventureId === v.id && d.type === 'distribution');
    for (const d of dists) {
      distributionsTotal += convert(d.amount, d.currency, base, rates);
    }
    const valuationBase = convert(Number(v.currentValuation) || 0, v.valuationCurrency || 'USD', base, rates);
    const currentValueBase = valuationBase + distributionsTotal;
    const roi = currentValueBase - deployedTotal;
    const roiPct = deployedTotal > 0 ? roi / deployedTotal : 0;
    const multiple = deployedTotal > 0 ? currentValueBase / deployedTotal : 0;
    return {
      ...v,
      deployedTotal,
      distributionsTotal,
      valuationBase,
      currentValueBase,
      roi,
      roiPct,
      multiple,
      deployments: deployEvents,
      distributions: dists,
    };
  });
}


export function computeDebtsWithStatus(debts, debtEvents, base, rates) {
  const now = new Date();
return (debts || []).map((d) => {
const repaid = computeDebtRepaid(debtEvents || [], d.id);
const remaining = Math.max(0, (Number(d.principal) || 0) - repaid);
const remainingBase = convert(remaining, d.currency || 'USD', base, rates);
const events = (debtEvents || [])
      .filter((e) => e.debtId === d.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
const latestRepayment = events[0] || null;
    const accruedInterest = computeAccruedInterest(d, now);
    const projectedPayback = computeProjectedPayback(d);
    return {
      ...d,
      direction: d.direction || 'owe',
      interestRate: Number(d.interestRate) || 0,
      interestType: d.interestType || 'simple',
repaid,
remaining,
remainingBase,
      accruedInterest,
      projectedPayback,
      events,
latestRepayment,
    };
  });
}

if (typeof window !== 'undefined') {
const sync = () => useStore.getState().syncQueue();
const tick = () => useStore.getState().tickRecurringSchedules();
  window.addEventListener('online', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: true } }));
sync();
  });
  window.addEventListener('offline', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: false } }));
  });
  useStore.getState().hydrate().then(() => {
setTimeout(tick, 1000);
  });
setInterval(sync, 20000);
setInterval(tick, 60000);
  startAvsSyncLoop(() => useStore.getState());
}
