// src/store/useStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, ApiError } from '../lib/api';
import { DEFAULT_RATES, convert } from '../lib/currency';

const uid = (prefix = 'tx') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeta = ({ _pending, ...rest }) => rest;
const nowISO = () => new Date().toISOString();

function enqueue(set, get, entity, action, payload) {
  set((s) => ({
    personal: {
      ...s.personal,
      queue: [...s.personal.queue, { entity, action, ...payload }],
    },
  }));
  Promise.resolve().then(() => get().syncQueue());
}

// ════════════════════════════════════════════════════════════════════
// CONSTANTS — Round D
// ════════════════════════════════════════════════════════════════════
//
// These two category names trigger special behavior in addTransaction:
//
//   BORROWED (income type)
//     - Money borrowed from someone (you now owe them)
//     - Routes 100% to the Holding bucket — no auto-split into goal buckets
//     - Auto-creates a debt row with direction='owe'
//
//   LENT (expense type)
//     - Money loaned out to someone (they now owe you)
//     - Debits from a source bucket the user picks at log time
//     - Auto-creates a debt row with direction='receivable'
//
// Both categories require a counterparty (from-whom / to-whom). The
// Borrowed flow optionally accepts a due date.
//
export const BORROWED_CATEGORY = 'Borrowed';
export const LENT_CATEGORY     = 'Lent';
export const HOLDING_BUCKET_KEY = 'holding';

// ════════════════════════════════════════════════════════════════════
// DEFAULT BUCKETS — Round D adds Holding
// ════════════════════════════════════════════════════════════════════
//
// "Holding" is a capital bucket. It does NOT participate in auto-split
// (its percentage is 0) and exists to hold un-allocated funds like
// borrowed money before deployment.
//
export const DEFAULT_BUCKETS = [
  { key: 'warChest',   name: 'War Chest',          percentage: 50, color: '#d4a942', icon: 'TrendingUp', order: 1 },
  { key: 'operations', name: 'Operations',         percentage: 30, color: '#3d8b5f', icon: 'Wallet',     order: 2 },
  { key: 'reserve',    name: 'Reserve & Friction', percentage: 10, color: '#5b8def', icon: 'Shield',     order: 3 },
  { key: 'giving',     name: 'Giving',             percentage: 5,  color: '#e07a5f', icon: 'Heart',      order: 4 },
  { key: 'baller',     name: 'Baller',             percentage: 5,  color: '#9b59b6', icon: 'Sparkles',   order: 5 },
  // Holding — un-allocated capital, never receives auto-split
  { key: HOLDING_BUCKET_KEY, name: 'Holding', percentage: 0, color: '#7a8a8c', icon: 'Archive', order: 6 },
];

// ════════════════════════════════════════════════════════════════════
// DEFAULT CATEGORIES — Round D adds Borrowed and Lent
// ════════════════════════════════════════════════════════════════════
export const DEFAULT_CATEGORIES = [
  // Expenses
  { name: 'Food & Dining',  type: 'expense', icon: 'UtensilsCrossed', color: '#e07a5f', bucketKey: 'operations', order: 1 },
  { name: 'Transport',      type: 'expense', icon: 'Car',             color: '#5b8def', bucketKey: 'operations', order: 2 },
  { name: 'Housing',        type: 'expense', icon: 'Home',            color: '#a67c5a', bucketKey: 'operations', order: 3 },
  { name: 'Health',         type: 'expense', icon: 'Heart',           color: '#c2452f', bucketKey: 'operations', order: 4 },
  { name: 'Subscriptions',  type: 'expense', icon: 'CreditCard',      color: '#7a8a8c', bucketKey: 'operations', order: 5 },
  { name: 'Shopping',       type: 'expense', icon: 'ShoppingBag',     color: '#9b59b6', bucketKey: 'operations', order: 6 },
  { name: 'Education',      type: 'expense', icon: 'BookOpen',        color: '#d4a942', bucketKey: 'warChest',   order: 7 },
  { name: 'Investment',     type: 'expense', icon: 'TrendingUp',      color: '#d4a942', bucketKey: 'warChest',   order: 8 },
  { name: 'Entertainment',  type: 'expense', icon: 'Sparkles',        color: '#9b59b6', bucketKey: 'baller',     order: 9 },
  { name: 'Gift',           type: 'expense', icon: 'Gift',            color: '#e07a5f', bucketKey: 'giving',     order: 10 },
  // Round D: lending out money to someone = expense
  { name: LENT_CATEGORY,    type: 'expense', icon: 'HandCoins',       color: '#5b8def', bucketKey: 'operations', order: 11 },
  { name: 'Other',          type: 'expense', icon: 'MoreHorizontal',  color: '#7a8a8c', bucketKey: 'operations', order: 99 },
  // Income
  { name: 'Salary',         type: 'income',  icon: 'Briefcase',       color: '#3d8b5f', bucketKey: '', order: 1 },
  { name: 'Freelance',      type: 'income',  icon: 'Laptop',          color: '#3d8b5f', bucketKey: '', order: 2 },
  { name: 'Investment',     type: 'income',  icon: 'TrendingUp',      color: '#d4a942', bucketKey: '', order: 3 },
  { name: 'Gift',           type: 'income',  icon: 'Gift',            color: '#e07a5f', bucketKey: '', order: 4 },
  // Round D: borrowing from someone = income (capital injection)
  { name: BORROWED_CATEGORY, type: 'income', icon: 'HandCoins',       color: '#d4a942', bucketKey: HOLDING_BUCKET_KEY, order: 5 },
  { name: 'Other',          type: 'income',  icon: 'MoreHorizontal',  color: '#7a8a8c', bucketKey: '', order: 99 },
];

export const CATEGORY_TO_BUCKET = {
  'Food & Dining':  'operations',
  'Transport':      'operations',
  'Housing':        'operations',
  'Health':         'operations',
  'Subscriptions':  'operations',
  'Shopping':       'operations',
  'Education':      'warChest',
  'Investment':     'warChest',
  'Entertainment':  'baller',
  'Gift':           'giving',
  [LENT_CATEGORY]:  'operations', // default source if user doesn't pick
  'Other':          'operations',
  'Salary':         null,
  'Freelance':      null,
  [BORROWED_CATEGORY]: null, // handled specially — goes to Holding
};

// Build runtime category-to-bucket map from user's custom categories,
// falling back to defaults
export function buildCategoryToBucket(categories) {
  const map = { ...CATEGORY_TO_BUCKET };
  for (const c of categories) {
    if (c.type === 'expense' && c.bucketKey) map[c.name] = c.bucketKey;
  }
  return map;
}

// Round D: income auto-split now EXCLUDES the Holding bucket. Holding
// only receives money when explicitly routed (e.g., Borrowed category).
export function autoSplitIncome(amount, buckets) {
  const enabled = buckets
    .filter((b) => b.enabled !== false)
    .filter((b) => b.key !== HOLDING_BUCKET_KEY)
    .sort((a, b) => a.order - b.order);
  const totalPct = enabled.reduce((sum, b) => sum + b.percentage, 0);
  if (totalPct === 0) return {};
  const split = {};
  let allocated = 0;
  enabled.forEach((b, i) => {
    if (i === enabled.length - 1) {
      split[b.key] = Math.round((amount - allocated) * 100) / 100;
    } else {
      const portion = Math.round((amount * b.percentage / totalPct) * 100) / 100;
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

// ════════════════════════════════════════════════════════════════════
// RECURRING ENGINE — compute next due date based on frequency
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
    baseCurrency: 'USD',
    rates: { ...DEFAULT_RATES },
    debtAcknowledged: false,
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
  setBaseCurrency: (c) => set((s) => ({ app: { ...s.app, baseCurrency: c } })),
  setRate: (currency, value) =>
    set((s) => ({ app: { ...s.app, rates: { ...s.app.rates, [currency]: Number(value) } } })),
  acknowledgeDebt: () => set((s) => ({ app: { ...s.app, debtAcknowledged: true } })),
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
    queue: [],
    lastSyncAt: null,
    lastTickAt: null,
    syncing: false,
    syncError: null,
    syncLog: [],
    lastDeleted: null,
  },

  // Round D: initializeBuckets now MIGRATES existing stores too — if the
  // user has buckets but is missing Holding, add it without wiping.
  initializeBuckets: () => {
    const existing = get().personal.buckets;
    if (existing.length === 0) {
      const newBuckets = DEFAULT_BUCKETS.map((b) => ({
        ...b,
        id: uid('bkt'),
        enabled: true,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }));
      set((s) => ({ personal: { ...s.personal, buckets: newBuckets } }));
      newBuckets.forEach((b) => enqueue(set, get, 'bucket', 'create', b));
      return;
    }
    // Migration: add Holding bucket if missing
    if (!existing.some((b) => b.key === HOLDING_BUCKET_KEY)) {
      const holding = {
        ...DEFAULT_BUCKETS.find((b) => b.key === HOLDING_BUCKET_KEY),
        id: uid('bkt'),
        enabled: true,
        order: Math.max(...existing.map((b) => b.order || 0)) + 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      set((s) => ({ personal: { ...s.personal, buckets: [...s.personal.buckets, holding] } }));
      enqueue(set, get, 'bucket', 'create', holding);
    }
  },

  // Round D: initializeCategories also migrates — adds Borrowed/Lent if
  // they're not present.
  initializeCategories: () => {
    const existing = get().personal.categories;
    if (existing.length === 0) {
      const newCats = DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        id: uid('cat'),
        enabled: true,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }));
      set((s) => ({ personal: { ...s.personal, categories: newCats } }));
      newCats.forEach((c) => enqueue(set, get, 'category', 'create', c));
      return;
    }
    // Migration: add Borrowed/Lent if missing
    const toAdd = [];
    if (!existing.some((c) => c.name === BORROWED_CATEGORY && c.type === 'income')) {
      const tpl = DEFAULT_CATEGORIES.find((c) => c.name === BORROWED_CATEGORY);
      toAdd.push({
        ...tpl,
        id: uid('cat'),
        enabled: true,
        order: Math.max(...existing.filter((c) => c.type === 'income').map((c) => c.order || 0), 0) + 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
    }
    if (!existing.some((c) => c.name === LENT_CATEGORY && c.type === 'expense')) {
      const tpl = DEFAULT_CATEGORIES.find((c) => c.name === LENT_CATEGORY);
      toAdd.push({
        ...tpl,
        id: uid('cat'),
        enabled: true,
        order: Math.max(...existing.filter((c) => c.type === 'expense').map((c) => c.order || 0), 0) + 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
    }
    if (toAdd.length > 0) {
      set((s) => ({ personal: { ...s.personal, categories: [...s.personal.categories, ...toAdd] } }));
      toAdd.forEach((c) => enqueue(set, get, 'category', 'create', c));
    }
  },

  // ─── Transactions ─────────────────────────────────────────
  //
  // Round D: addTransaction now detects Borrowed (income) and Lent
  // (expense) categories and:
  //   1) routes money to the correct bucket (Holding for Borrowed,
  //      user-picked source bucket for Lent — defaults to Operations)
  //   2) auto-creates a linked debt row with the right direction
  //   3) stores linkedDebtId on the transaction so deletion cascades
  //
  // Extra input fields supported for these categories:
  //   counterparty:    string  (required for both)
  //   dueDate:         ISO date string (optional, Borrowed only typically)
  //   sourceBucketKey: bucket key (Lent only — where the money comes from)
  //
  addTransaction: (input) => {
    const buckets = get().personal.buckets;
    const categories = get().personal.categories;
    const categoryMap = buildCategoryToBucket(categories);

    const isBorrowed = input.type === 'income'  && input.category === BORROWED_CATEGORY;
    const isLent     = input.type === 'expense' && input.category === LENT_CATEGORY;

    let bucketAllocation = input.buckets;
    if (!bucketAllocation) {
      if (isBorrowed) {
        // All borrowed money lands in Holding — no auto-split
        bucketAllocation = { [HOLDING_BUCKET_KEY]: Number(input.amount) };
      } else if (isLent) {
        // Debit from user-chosen source bucket (default Operations)
        const sourceKey = input.sourceBucketKey || 'operations';
        bucketAllocation = { [sourceKey]: -Math.abs(Number(input.amount)) };
      } else if (input.type === 'income') {
        bucketAllocation = autoSplitIncome(Number(input.amount), buckets);
      } else if (input.type === 'expense') {
        bucketAllocation = autoSplitExpense(Number(input.amount), input.category, categoryMap);
      } else {
        bucketAllocation = {};
      }
    }

    // Normalize tags: array → comma-separated string for storage
    let tagsStr = '';
    if (Array.isArray(input.tags)) tagsStr = input.tags.filter(Boolean).join(',');
    else if (typeof input.tags === 'string') tagsStr = input.tags;

    const txId = input.id || uid('tx');

    // Round D: auto-create linked debt for Borrowed/Lent
    let linkedDebtId = '';
    if ((isBorrowed || isLent) && input.counterparty) {
      const direction = isBorrowed ? 'owe' : 'receivable';
      const debt = {
        id: uid('debt'),
        creditor: input.counterparty,
        principal: Number(input.amount),
        currency: input.currency || 'USD',
        dueDate: input.dueDate || '',
        notes: input.notes || '',
        status: 'active',
        direction,
        linkedTxId: txId,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      linkedDebtId = debt.id;
      set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, debt] } }));
      enqueue(set, get, 'debt', 'create', debt);
    }

    const tx = {
      id: txId,
      date: input.date || nowISO(),
      amount: Number(input.amount),
      currency: input.currency || 'USD',
      category: input.category || 'Other',
      type: input.type,
      notes: input.notes || '',
      tags: tagsStr,
      buckets: bucketAllocation,
      linkedDebtId, // empty string if not borrow/lend
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
    const buckets = get().personal.buckets;
    const categories = get().personal.categories;
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
            // Re-route allocations on the same Round D rules
            const isBorrowedNow = newType === 'income'  && newCategory === BORROWED_CATEGORY;
            const isLentNow     = newType === 'expense' && newCategory === LENT_CATEGORY;
            if (isBorrowedNow) {
              newBuckets = { [HOLDING_BUCKET_KEY]: newAmount };
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

  // Round D: also delete the linked debt if there is one.
  deleteTransaction: (id) => {
    const tx = get().personal.transactions.find((t) => t.id === id);

    // Goal un-claim logic (preserved from previous round)
    let unclaimedGoal = null;
    if (tx && tx.category === 'Goal' && typeof tx.notes === 'string' && tx.notes.startsWith('🎯')) {
      const goalName = tx.notes.replace(/^🎯\s*/, '').trim();
      const linkedGoal = get().personal.goals.find(
        (g) => g.name === goalName && g.status === 'claimed'
      );
      if (linkedGoal) {
        unclaimedGoal = {
          ...linkedGoal,
          status: 'active',
          claimedAt: '',
          claimedAmount: 0,
          updatedAt: nowISO(),
        };
      }
    }

    // Round D: find linked debt for cascade delete
    let linkedDebt = null;
    if (tx && tx.linkedDebtId) {
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
        lastDeleted: tx
          ? { tx, unclaimedGoal, linkedDebt, deletedAt: Date.now() }
          : s.personal.lastDeleted,
      },
    }));
    enqueue(set, get, 'transaction', 'delete', { id });
    if (unclaimedGoal) enqueue(set, get, 'goal', 'update', unclaimedGoal);
    if (linkedDebt) enqueue(set, get, 'debt', 'delete', { id: linkedDebt.id });
  },

  undoDelete: () => {
    const last = get().personal.lastDeleted;
    if (!last) return null;
    const tx = { ...last.tx, _pending: true, updatedAt: nowISO() };

    let reclaimed = null;
    if (last.unclaimedGoal) {
      reclaimed = {
        ...last.unclaimedGoal,
        status: 'claimed',
        claimedAt: tx.date || nowISO(),
        claimedAmount: tx.amount,
        updatedAt: nowISO(),
      };
    }

    // Round D: restore linked debt too
    const restoredDebt = last.linkedDebt
      ? { ...last.linkedDebt, updatedAt: nowISO() }
      : null;

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
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    if (reclaimed) enqueue(set, get, 'goal', 'update', reclaimed);
    if (restoredDebt) enqueue(set, get, 'debt', 'create', restoredDebt);
    return tx;
  },

  clearLastDeleted: () => set((s) => ({ personal: { ...s.personal, lastDeleted: null } })),

  // ─── Buckets ──────────────────────────────────────────────
  updateBucket: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        buckets: s.personal.buckets.map((b) => {
          if (b.id !== id) return b;
          updated = { ...b, ...patch, updatedAt: nowISO() };
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
  addGoal: ({ bucketKey, name, target, currency = 'USD', priority, parallel = false }) => {
    const bucketGoals = get().personal.goals.filter((g) => g.bucketKey === bucketKey && g.status === 'active');
    const nextPriority = priority || bucketGoals.length + 1;
    const goal = {
      id: uid('goal'), bucketKey, name,
      target: Number(target), currency,
      priority: nextPriority, parallel,
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
    updates.forEach((g) => enqueue(set, get, 'goal', 'update', g));
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
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));
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
    enqueue(set, get, 'goal', 'update', updated);
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
      createdAt: nowISO(),
      updatedAt: nowISO(),
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
          if (
            patch.frequency !== undefined ||
            patch.interval !== undefined ||
            patch.dayOfMonth !== undefined ||
            patch.daysOfWeek !== undefined
          ) {
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

    newPending.forEach((p) => enqueue(set, get, 'pending', 'create', p));
    updates.forEach((r) => enqueue(set, get, 'recurring', 'update', r));
  },

  // ─── Pending entries ──────────────────────────────────────
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
      id: uid('tpl'),
      name,
      amount: Number(amount),
      currency,
      type,
      category,
      notes,
      tags: Array.isArray(tags) ? tags.join(',') : tags,
      icon,
      color,
      useCount: 0,
      lastUsedAt: '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
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
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      category: t.category,
      notes: t.notes,
      tags: t.tags,
    });
    const upd = {
      ...t,
      useCount: (Number(t.useCount) || 0) + 1,
      lastUsedAt: nowISO(),
      updatedAt: nowISO(),
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
      createdAt: nowISO(),
      updatedAt: nowISO(),
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
    updates.forEach((c) => enqueue(set, get, 'category', 'update', c));
  },

  // ─── Bucket CRUD ──────────────────────────────────────────
  addBucket: ({ key, name, percentage, color = '#7a8a8c', icon = 'Wallet' }) => {
    const existing = get().personal.buckets;
    const order = existing.length + 1;
    const b = {
      id: uid('bkt'), key, name, percentage: Number(percentage),
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
    const existing = get().personal.buckets;
    existing.forEach((b) => enqueue(set, get, 'bucket', 'delete', { id: b.id }));
    const defaults = DEFAULT_BUCKETS.map((b) => ({
      ...b, id: uid('bkt'), enabled: true,
      createdAt: nowISO(), updatedAt: nowISO(),
    }));
    set((s) => ({ personal: { ...s.personal, buckets: defaults } }));
    defaults.forEach((b) => enqueue(set, get, 'bucket', 'create', b));
  },

  updateBucketPercentages: (updates) => {
    const updated = [];
    set((s) => ({
      personal: {
        ...s.personal,
        buckets: s.personal.buckets.map((b) => {
          if (updates[b.id] === undefined) return b;
          const pct = Math.max(0, Math.min(100, Number(updates[b.id])));
          if (pct === b.percentage) return b;
          const upd = { ...b, percentage: pct, updatedAt: nowISO() };
          updated.push(upd);
          return upd;
        }),
      },
    }));
    updated.forEach((b) => enqueue(set, get, 'bucket', 'update', b));
  },

  // ─── Local data utilities ─────────────────────────────────
  exportAllData: () => {
    const s = get();
    return {
      exportedAt: nowISO(),
      version: 6,
      personal: {
        transactions:     s.personal.transactions,
        budgets:          s.personal.budgets,
        debts:            s.personal.debts,
        debtEvents:       s.personal.debtEvents,
        investments:      s.personal.investments,
        investmentEvents: s.personal.investmentEvents,
        ventures:         s.personal.ventures,
        ventureEvents:    s.personal.ventureEvents,
        buckets:          s.personal.buckets,
        goals:            s.personal.goals,
        recurring:        s.personal.recurring,
        templates:        s.personal.templates,
        categories:       s.personal.categories,
      },
      app: {
        baseCurrency: s.app.baseCurrency,
        rates:        s.app.rates,
        theme:        s.app.theme,
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
        transactions: [], budgets: [], debts: [], debtEvents: [],
        investments: [], investmentEvents: [],
        ventures: [], ventureEvents: [],
        buckets: [], goals: [],
        recurring: [], pending: [], templates: [], categories: [],
        queue: [], lastDeleted: null,
      },
    }));
    await get().hydrate();
  },

  // ─── Budgets (legacy) ─────────────────────────────────────
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

  // ─── Debts ────────────────────────────────────────────────
  // Round D: addDebt now accepts direction ('owe' | 'receivable') and
  // an optional linkedTxId back-reference. Preserved for direct calls
  // (e.g., from the Debt module's manual debt creation if ever needed).
  addDebt: ({ creditor, principal, currency = 'USD', dueDate, notes = '', direction = 'owe', linkedTxId = '' }) => {
    const d = {
      id: uid('debt'), creditor, principal: Number(principal), currency,
      dueDate: dueDate || '', notes, status: 'active',
      direction,
      linkedTxId,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, d] } }));
    enqueue(set, get, 'debt', 'create', d);
    return d;
  },

  // Round D: recordRepayment now ALSO creates an audit-trail transaction
  // so the repayment shows up in History. For direction='owe', it's an
  // expense (money leaving you). For 'receivable', it's an income
  // (money coming back). The audit tx has buckets={} so it doesn't
  // re-route through allocations (bucket balances are updated by the
  // original borrow/lend tx already; repayment is reflected in the debt
  // event log, not in bucket balances).
  recordRepayment: (debtId, amount) => {
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

    // Audit-trail transaction so this shows up in History
    const auditTx = {
      id: uid('tx'),
      date: nowISO(),
      amount: cappedAmount,
      currency: debt.currency,
      category: direction === 'owe' ? 'Repayment' : 'Repayment received',
      type: direction === 'owe' ? 'expense' : 'income',
      notes: direction === 'owe'
        ? `Paid ${debt.creditor}`
        : `${debt.creditor} repaid`,
      tags: '',
      buckets: {}, // no allocation — repayment is tracked in debt events
      linkedDebtId: debtId,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [auditTx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(auditTx));

    const event = {
      id: uid('devt'), debtId, type: 'repayment',
      amount: cappedAmount, currency: debt.currency,
      balanceAfter, balanceAfterBase, baseCurrency,
      notes: '', date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debtEvents: [...s.personal.debtEvents, event] } }));
    enqueue(set, get, 'debtEvent', 'create', event);

    if (balanceAfter <= 0 && debt.status !== 'paid') {
      const updated = { ...debt, status: 'paid', updatedAt: nowISO() };
      set((s) => ({
        personal: {
          ...s.personal,
          debts: s.personal.debts.map((d) => (d.id === debtId ? updated : d)),
        },
      }));
      enqueue(set, get, 'debt', 'update', updated);
    }
    return event;
  },

  removeDebt: (id) => {
    set((s) => ({ personal: { ...s.personal, debts: s.personal.debts.filter((d) => d.id !== id) } }));
    enqueue(set, get, 'debt', 'delete', { id });
  },

  // ─── Investments ──────────────────────────────────────────
  addInvestment: ({ kind, name, units, costBasis, currentPrice, currency = 'USD' }) => {
    const inv = {
      id: uid('inv'), kind, name,
      units: Number(units), costBasis: Number(costBasis),
      currentPrice: Number(currentPrice ?? costBasis),
      currency, createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, investments: [...s.personal.investments, inv] } }));
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
    enqueue(set, get, 'investment', 'update', updated);
    const event = {
      id: uid('ievt'), investmentId: id, type: 'priceUpdate',
      price: newPrice, previousPrice, currency: inv.currency,
      notes: '', date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, investmentEvents: [...s.personal.investmentEvents, event] } }));
    enqueue(set, get, 'investmentEvent', 'create', event);
  },

  removeInvestment: (id) => {
    set((s) => ({ personal: { ...s.personal, investments: s.personal.investments.filter((i) => i.id !== id) } }));
    enqueue(set, get, 'investment', 'delete', { id });
  },

  // ─── Ventures ─────────────────────────────────────────────
  addVenture: ({ name, notes = '' }) => {
    const v = { id: uid('vnt'), name, notes, status: 'active', createdAt: nowISO(), updatedAt: nowISO() };
    set((s) => ({ personal: { ...s.personal, ventures: [...s.personal.ventures, v] } }));
    enqueue(set, get, 'venture', 'create', v);
    return v;
  },
  deployToVenture: (ventureId, { amount, currency = 'USD', note = '' }) => {
    const event = {
      id: uid('vevt'), ventureId, type: 'deploy',
      amount: Number(amount), currency, note,
      date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, ventureEvents: [...s.personal.ventureEvents, event] } }));
    enqueue(set, get, 'ventureEvent', 'create', event);
    return event;
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

  // ─── Sync ─────────────────────────────────────────────────
  hydrate: async () => {
    try {
      const data = await api.fetchAll();
      const pendingIds = new Set(
        get().personal.queue.filter((op) => op.action === 'create').map((op) => op.id)
      );
      const localPendingTx = get().personal.transactions.filter((t) => pendingIds.has(t.id));
      const txs = (data.transactions || []).map((t) => ({
        ...t,
        currency: t.currency || 'USD',
        buckets: t.buckets || {},
        tags: t.tags || '',
        linkedDebtId: t.linkedDebtId || '',
      }));

      // Round D: default missing direction on debts to 'owe' for legacy rows
      const debts = (data.debts || []).map((d) => ({
        ...d,
        direction: d.direction || 'owe',
        linkedTxId: d.linkedTxId || '',
      }));

      set((s) => ({
        personal: {
          ...s.personal,
          transactions: [
            ...localPendingTx,
            ...txs.filter((t) => !pendingIds.has(t.id)),
          ].sort((a, b) => new Date(b.date) - new Date(a.date)),
          budgets:          data.budgets          || s.personal.budgets,
          debts:            debts.length ? debts  : s.personal.debts,
          debtEvents:       data.debtEvents       || s.personal.debtEvents,
          investments:      data.investments      || s.personal.investments,
          investmentEvents: data.investmentEvents || s.personal.investmentEvents,
          ventures:         data.ventures         || s.personal.ventures,
          ventureEvents:    data.ventureEvents    || s.personal.ventureEvents,
          buckets:          (data.buckets && data.buckets.length) ? data.buckets : s.personal.buckets,
          goals:            data.goals            || s.personal.goals,
          recurring:        data.recurring        || s.personal.recurring,
          pending:          data.pending          || s.personal.pending,
          templates:        data.templates        || s.personal.templates,
          categories:       (data.categories && data.categories.length) ? data.categories : s.personal.categories,
          lastSyncAt: nowISO(),
          syncError: null,
        },
        app: { ...s.app, online: true },
      }));

      // Round D: always run migrations to ensure Holding bucket and
      // Borrowed/Lent categories exist
      get().initializeBuckets();
      get().initializeCategories();
    } catch (err) {
      set((s) => ({
        personal: { ...s.personal, syncError: err.message },
        app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
      }));
      get().initializeBuckets();
      get().initializeCategories();
    }
  },

  syncQueue: async () => {
    if (get().personal.syncing) return;
    const queue = get().personal.queue;
    if (queue.length === 0) return;

    const startedAt = new Date();
    const sendingIds = new Set(queue.map((op) => `${op.entity || 'transaction'}:${op.id}`));
    const queueSnapshot = queue.map((op) => ({
      id: op.id, entity: op.entity, action: op.action,
      summary: op.name || op.category || op.creditor || ''
    }));

    set((s) => ({ personal: { ...s.personal, syncing: true, syncError: null } }));
    try {
      const { results = [] } = await api.bulk(queue);

      const logEntries = queueSnapshot.map((q, i) => {
        const r = results[i];
        return {
          time: startedAt.toLocaleTimeString(),
          op: `${q.action} ${q.entity}`,
          summary: q.summary,
          id: q.id,
          status: r?.status ?? '?',
          message: r?.message || r?.error || (r ? 'no message' : 'NO RESULT'),
        };
      });

      const failedOps = queue.filter((_, i) => results[i]?.status >= 400);

      set((s) => ({
        personal: {
          ...s.personal,
          queue: [
            ...failedOps,
            ...s.personal.queue.filter((op) => !sendingIds.has(`${op.entity || 'transaction'}:${op.id}`)),
          ],
          transactions: s.personal.transactions.map((t) => ({ ...t, _pending: false })),
          lastSyncAt: nowISO(),
          syncing: false,
          syncLog: [...logEntries, ...s.personal.syncLog].slice(0, 30),
        },
        app: { ...s.app, online: true },
      }));
    } catch (err) {
      try {
        const data = await api.fetchAll();
        const seenIds = new Set();
        const collectIds = (arr) => { if (Array.isArray(arr)) for (const o of arr) if (o && o.id) seenIds.add(o.id); };
        collectIds(data.transactions); collectIds(data.budgets);
        collectIds(data.debts); collectIds(data.investments); collectIds(data.ventures);
        collectIds(data.buckets); collectIds(data.goals);
        collectIds(data.recurring); collectIds(data.pending);
        collectIds(data.templates); collectIds(data.categories);

        const stillPending = queue.filter((op) => {
          if (op.action === 'create') return !seenIds.has(op.id);
          if (op.action === 'update') return !seenIds.has(op.id);
          if (op.action === 'delete') return false;
          return true;
        });

        const logEntries = queueSnapshot.map((q) => ({
          time: startedAt.toLocaleTimeString(),
          op: `${q.action} ${q.entity}`,
          summary: q.summary,
          id: q.id,
          status: 'NET-ERR',
          message: seenIds.has(q.id) ? 'verified in sheet → drop' : 'not in sheet → retry',
        }));

        const queueNow = get().personal.queue;
        const newDuringSync = queueNow.filter((op) => !sendingIds.has(`${op.entity || 'transaction'}:${op.id}`));

        set((s) => ({
          personal: {
            ...s.personal,
            queue: [...stillPending, ...newDuringSync],
            syncing: false,
            syncError: stillPending.length > 0 ? `${stillPending.length} need retry` : null,
            syncLog: [...logEntries, ...s.personal.syncLog].slice(0, 30),
          },
          app: { ...s.app, online: true },
        }));
      } catch (verifyErr) {
        const logEntries = queueSnapshot.map((q) => ({
          time: startedAt.toLocaleTimeString(),
          op: `${q.action} ${q.entity}`,
          summary: q.summary,
          id: q.id,
          status: 'TOTAL-FAIL',
          message: err.message + ' / verify: ' + verifyErr.message,
        }));
        set((s) => ({
          personal: {
            ...s.personal, syncing: false, syncError: err.message,
            syncLog: [...logEntries, ...s.personal.syncLog].slice(0, 30),
          },
          app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
        }));
      }
    }
  },

  clearQueue: () => set((s) => ({ personal: { ...s.personal, queue: [], syncError: null } })),
  clearSyncLog: () => set((s) => ({ personal: { ...s.personal, syncLog: [] } })),
});

const businessSlice = () => ({
  business: { enabled: false, transactions: [], queue: [] },
});

// ════════════════════════════════════════════════════════════════════
// COMPOSED STORE
// ════════════════════════════════════════════════════════════════════
export const useStore = create()(
  persist(
    (set, get) => ({
      ...appSlice(set, get),
      ...personalSlice(set, get),
      ...businessSlice(set, get),
    }),
    {
      name: 'fintrack-v2',
      storage: createJSONStorage(() => localStorage),
      version: 6, // Round D bump
      partialize: (s) => ({
        app: {
          workspace: s.app.workspace,
          theme: s.app.theme,
          activeTab: s.app.activeTab,
          baseCurrency: s.app.baseCurrency,
          rates: s.app.rates,
          debtAcknowledged: s.app.debtAcknowledged,
        },
        personal: {
          transactions:     s.personal.transactions,
          budgets:          s.personal.budgets,
          debts:            s.personal.debts,
          debtEvents:       s.personal.debtEvents,
          investments:      s.personal.investments,
          investmentEvents: s.personal.investmentEvents,
          ventures:         s.personal.ventures,
          ventureEvents:    s.personal.ventureEvents,
          buckets:          s.personal.buckets,
          goals:            s.personal.goals,
          recurring:        s.personal.recurring,
          pending:          s.personal.pending,
          templates:        s.personal.templates,
          categories:       s.personal.categories,
          queue:            s.personal.queue,
          lastSyncAt:       s.personal.lastSyncAt,
          lastTickAt:       s.personal.lastTickAt,
        },
        business: s.business,
      }),
      migrate: (persisted, version) => {
        if (!persisted) return persisted;
        const p = { ...persisted };
        if (!p.personal) return p;
        p.personal = {
          ...p.personal,
          debtEvents:       p.personal.debtEvents       || [],
          investmentEvents: p.personal.investmentEvents || [],
          ventureEvents:    p.personal.ventureEvents    || [],
          buckets:          p.personal.buckets          || [],
          goals:            p.personal.goals            || [],
          recurring:        p.personal.recurring        || [],
          pending:          p.personal.pending          || [],
          templates:        p.personal.templates        || [],
          categories:       p.personal.categories       || [],
        };
        if (Array.isArray(p.personal.ventures)) {
          const events = [...(p.personal.ventureEvents || [])];
          p.personal.ventures = p.personal.ventures.map((v) => {
            if (Array.isArray(v.deployed) && v.deployed.length) {
              for (const d of v.deployed) {
                events.push({
                  id: d.id || uid('vevt'),
                  ventureId: v.id, type: 'deploy',
                  amount: Number(d.amount) || 0,
                  currency: d.currency || 'USD',
                  note: d.note || '',
                  date: d.date || nowISO(),
                  createdAt: d.date || nowISO(),
                });
              }
            }
            const { deployed, ...rest } = v;
            return rest;
          });
          p.personal.ventureEvents = events;
        }
        if (Array.isArray(p.personal.transactions)) {
          p.personal.transactions = p.personal.transactions.map((t) => ({
            ...t,
            buckets: t.buckets || {},
            tags: t.tags || '',
            linkedDebtId: t.linkedDebtId || '',
          }));
        }
        // Round D: default direction='owe' on existing debts
        if (Array.isArray(p.personal.debts)) {
          p.personal.debts = p.personal.debts.map((d) => ({
            ...d,
            direction: d.direction || 'owe',
            linkedTxId: d.linkedTxId || '',
          }));
        }
        return p;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        app: { ...current.app, ...(persisted?.app || {}), editingTxId: null, searchOpen: false, searchQuery: '', settingsOpen: false },
        personal: {
          ...current.personal,
          ...(persisted?.personal || {}),
          syncing: false,
          syncError: null,
          lastDeleted: null,
        },
      }),
    }
  )
);

// ════════════════════════════════════════════════════════════════════
// COMPUTATIONS
// ════════════════════════════════════════════════════════════════════
export function computeDebtRepaid(debtEvents, debtId) {
  return debtEvents
    .filter((e) => e.debtId === debtId && e.type === 'repayment')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function computeVentureDeployed(ventureEvents, ventureId) {
  return ventureEvents
    .filter((e) => e.ventureId === ventureId && e.type === 'deploy')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function computeBucketBalances(transactions, base, rates) {
  const balances = {};
  for (const tx of transactions) {
    const txCurrency = tx.currency || 'USD';
    const allocations = tx.buckets || {};
    for (const [bucketKey, amount] of Object.entries(allocations)) {
      const baseAmount = convert(Number(amount) || 0, txCurrency, base, rates);
      balances[bucketKey] = (balances[bucketKey] || 0) + baseAmount;
    }
  }
  return balances;
}

// Round D: total liquid = sum of POSITIVE bucket balances. This is the
// "Available to spend" hero number on Home.
export function computeTotalLiquid(transactions, base, rates) {
  const balances = computeBucketBalances(transactions, base, rates);
  let total = 0;
  for (const v of Object.values(balances)) {
    if (v > 0) total += v;
  }
  return total;
}

export function computeBucketMTD(transactions, base, rates) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const mtd = {};
  for (const tx of transactions) {
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
  const active = goals
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
      ...g,
      filledBase: filled,
      targetBase,
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
      ...g,
      filledBase: filled,
      targetBase,
      progress: targetBase > 0 ? filled / targetBase : 0,
      ready: filled >= targetBase,
    });
  }
  return result.sort((a, b) => a.priority - b.priority);
}

export function gatherTags(transactions) {
  const tagSet = new Set();
  for (const t of transactions) {
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
  return transactions.filter((t) => {
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
export const selectDebts            = (s) => s.personal.debts;
export const selectDebtEvents       = (s) => s.personal.debtEvents;
export const selectInvestments      = (s) => s.personal.investments;
export const selectInvestmentEvents = (s) => s.personal.investmentEvents;
export const selectVentures         = (s) => s.personal.ventures;
export const selectVentureEvents    = (s) => s.personal.ventureEvents;
export const selectBuckets          = (s) => s.personal.buckets;
export const selectGoals            = (s) => s.personal.goals;
export const selectRecurring        = (s) => s.personal.recurring;
export const selectPending          = (s) => s.personal.pending;
export const selectTemplates        = (s) => s.personal.templates;
export const selectCategories       = (s) => s.personal.categories;
export const selectActiveTab        = (s) => s.app.activeTab;
export const selectBaseCurrency     = (s) => s.app.baseCurrency;
export const selectRates            = (s) => s.app.rates;
export const selectTheme            = (s) => s.app.theme;
export const selectQueueSize        = (s) => s.personal.queue.length;
export const selectSyncLog          = (s) => s.personal.syncLog;
export const selectIsSyncing        = (s) => s.personal.syncing;
export const selectIsOnline         = (s) => s.app.online;
export const selectEditingTxId      = (s) => s.app.editingTxId;
export const selectLastDeleted      = (s) => s.personal.lastDeleted;
export const selectSearchQuery      = (s) => s.app.searchQuery;
export const selectSearchOpen       = (s) => s.app.searchOpen;
export const selectSettingsOpen     = (s) => s.app.settingsOpen;

// Round D: only count direction='owe' debts toward "you owe" total
export const selectTotalDebtInBase = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  let sum = 0;
  for (const d of state.personal.debts) {
    if ((d.direction || 'owe') !== 'owe') continue;
    const repaid = computeDebtRepaid(state.personal.debtEvents, d.id);
    const remaining = d.principal - repaid;
    if (remaining > 0) sum += convert(remaining, d.currency, base, rates);
  }
  return sum;
};

// Round D: receivables — money owed TO you
export const selectTotalReceivableInBase = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  let sum = 0;
  for (const d of state.personal.debts) {
    if (d.direction !== 'receivable') continue;
    const repaid = computeDebtRepaid(state.personal.debtEvents, d.id);
    const remaining = d.principal - repaid;
    if (remaining > 0) sum += convert(remaining, d.currency, base, rates);
  }
  return sum;
};

export function computeMonthSummary(transactions, base, rates) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let income = 0, expense = 0;
  for (const t of transactions) {
    if (new Date(t.date) < monthStart) continue;
    if (t.type === 'transfer') continue;
    const v = convert(Math.abs(t.amount), t.currency || 'USD', base, rates);
    if (t.type === 'income') income += v;
    else if (t.type === 'expense') expense += v;
  }
  return { income, expense, net: income - expense };
}

export function computeInvestmentTotals(investments, base, rates) {
  let cost = 0, value = 0;
  for (const inv of investments) {
    cost  += convert(inv.units * inv.costBasis,    inv.currency, base, rates);
    value += convert(inv.units * inv.currentPrice, inv.currency, base, rates);
  }
  return { cost, value, gain: value - cost, gainPct: cost > 0 ? (value - cost) / cost : 0 };
}

export function computeVentureTotals(ventures, ventureEvents, base, rates) {
  return ventures.map((v) => {
    const events = ventureEvents.filter((e) => e.ventureId === v.id);
    let total = 0;
    for (const e of events) {
      if (e.type === 'deploy') total += convert(e.amount, e.currency, base, rates);
    }
    return { ...v, deployedTotal: total, deployments: events };
  });
}

// Round D: surface direction in the computed shape too
export function computeDebtsWithStatus(debts, debtEvents, base, rates) {
  return debts.map((d) => {
    const repaid = computeDebtRepaid(debtEvents, d.id);
    const remaining = d.principal - repaid;
    const remainingBase = convert(remaining, d.currency, base, rates);
    const events = debtEvents
      .filter((e) => e.debtId === d.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return { ...d, direction: d.direction || 'owe', repaid, remaining, remainingBase, events };
  });
}

if (typeof window !== 'undefined') {
  const triggerSync = () => useStore.getState().syncQueue();
  const triggerTick = () => useStore.getState().tickRecurringSchedules();
  window.addEventListener('online', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: true } }));
    triggerSync();
  });
  window.addEventListener('offline', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: false } }));
  });
  useStore.getState().hydrate().then(() => {
    setTimeout(triggerTick, 1000);
  });
  setInterval(triggerSync, 20_000);
  setInterval(triggerTick, 60_000);
}
