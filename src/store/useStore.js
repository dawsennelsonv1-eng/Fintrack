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
// DEFAULT BUCKETS — Carter's NBA Accounting (user's adjusted version)
// ════════════════════════════════════════════════════════════════════
export const DEFAULT_BUCKETS = [
  { key: 'warChest',   name: 'War Chest',          percentage: 50, color: '#d4a942', icon: 'TrendingUp', order: 1 },
  { key: 'operations', name: 'Operations',         percentage: 30, color: '#3d8b5f', icon: 'Wallet',     order: 2 },
  { key: 'reserve',    name: 'Reserve & Friction', percentage: 10, color: '#5b8def', icon: 'Shield',     order: 3 },
  { key: 'giving',     name: 'Giving',             percentage: 5,  color: '#e07a5f', icon: 'Heart',      order: 4 },
  { key: 'baller',     name: 'Baller',             percentage: 5,  color: '#9b59b6', icon: 'Sparkles',   order: 5 },
];

// Maps spending categories to default bucket keys.
// Used for auto-routing expenses. User can override per-transaction.
export const CATEGORY_TO_BUCKET = {
  // Operations — daily life
  'Food & Dining':  'operations',
  'Transport':      'operations',
  'Housing':        'operations',
  'Health':         'operations',
  'Subscriptions':  'operations',
  'Shopping':       'operations',
  // War Chest — investments in self/business
  'Education':      'warChest',
  'Investment':     'warChest',
  // Baller — fun
  'Entertainment':  'baller',
  // Giving
  'Gift':           'giving',
  // Default
  'Other':          'operations',
  // Income categories — N/A, income gets auto-split
  'Salary':         null,
  'Freelance':      null,
};

/**
 * Auto-split an income amount across the buckets by their percentages.
 * Returns { warChest: 50, operations: 30, ... }
 */
export function autoSplitIncome(amount, buckets) {
  const enabled = buckets.filter((b) => b.enabled !== false).sort((a, b) => a.order - b.order);
  const totalPct = enabled.reduce((sum, b) => sum + b.percentage, 0);
  if (totalPct === 0) return {};
  const split = {};
  let allocated = 0;
  enabled.forEach((b, i) => {
    if (i === enabled.length - 1) {
      // Last bucket gets the remainder to ensure exact total
      split[b.key] = Math.round((amount - allocated) * 100) / 100;
    } else {
      const portion = Math.round((amount * b.percentage / totalPct) * 100) / 100;
      split[b.key] = portion;
      allocated += portion;
    }
  });
  return split;
}

/**
 * Auto-route an expense to the appropriate bucket based on category.
 * Returns { operations: -80 } for an $80 grocery expense, etc.
 */
export function autoSplitExpense(amount, category) {
  const bucketKey = CATEGORY_TO_BUCKET[category] || 'operations';
  return { [bucketKey]: -Math.abs(amount) };
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
    queue: [],
    lastSyncAt: null,
    syncing: false,
    syncError: null,
    lastDeleted: null,
  },

  // ─── Initialize default buckets (call once on first load) ──
  initializeBuckets: () => {
    const existing = get().personal.buckets;
    if (existing.length > 0) return;
    const newBuckets = DEFAULT_BUCKETS.map((b) => ({
      ...b,
      id: uid('bkt'),
      enabled: true,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }));
    set((s) => ({ personal: { ...s.personal, buckets: newBuckets } }));
    newBuckets.forEach((b) => enqueue(set, get, 'bucket', 'create', b));
  },

  // ─── Transactions ─────────────────────────────────────────
  // Now auto-computes the buckets field for income (auto-split) and expenses (auto-route)
  addTransaction: (input) => {
    const buckets = get().personal.buckets;
    let bucketAllocation = input.buckets;

    // If no manual override, compute defaults
    if (!bucketAllocation) {
      if (input.type === 'income') {
        bucketAllocation = autoSplitIncome(Number(input.amount), buckets);
      } else if (input.type === 'expense') {
        bucketAllocation = autoSplitExpense(Number(input.amount), input.category);
      } else {
        bucketAllocation = {};
      }
    }

    const tx = {
      id: uid('tx'),
      date: input.date || nowISO(),
      amount: Number(input.amount),
      currency: input.currency || 'USD',
      category: input.category || 'Other',
      type: input.type,
      notes: input.notes || '',
      buckets: bucketAllocation,
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
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.map((t) => {
          if (t.id !== id) return t;
          const newAmount   = patch.amount   !== undefined ? Number(patch.amount) : t.amount;
          const newType     = patch.type     !== undefined ? patch.type     : t.type;
          const newCategory = patch.category !== undefined ? patch.category : t.category;

          // Recompute buckets if amount/type/category changed and no explicit buckets in patch
          let newBuckets = patch.buckets !== undefined ? patch.buckets : t.buckets;
          if (patch.buckets === undefined && (
            patch.amount !== undefined ||
            patch.type !== undefined ||
            patch.category !== undefined
          )) {
            if (newType === 'income') newBuckets = autoSplitIncome(newAmount, buckets);
            else if (newType === 'expense') newBuckets = autoSplitExpense(newAmount, newCategory);
          }

          updated = {
            ...t, ...patch,
            amount: newAmount,
            type: newType,
            category: newCategory,
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
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.filter((t) => t.id !== id),
        lastDeleted: tx ? { tx, deletedAt: Date.now() } : s.personal.lastDeleted,
      },
    }));
    enqueue(set, get, 'transaction', 'delete', { id });
  },

  undoDelete: () => {
    const last = get().personal.lastDeleted;
    if (!last) return null;
    const tx = { ...last.tx, _pending: true, updatedAt: nowISO() };
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: [tx, ...s.personal.transactions]
          .sort((a, b) => new Date(b.date) - new Date(a.date)),
        lastDeleted: null,
      },
    }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));
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

  // Special transaction type for moving money between buckets
  transferBetweenBuckets: ({ fromKey, toKey, amount, currency = 'USD', notes = '' }) => {
    const tx = {
      id: uid('tx'),
      date: nowISO(),
      amount: Number(amount),
      currency,
      category: 'Transfer',
      type: 'transfer',
      notes: notes || `${fromKey} → ${toKey}`,
      buckets: { [fromKey]: -Math.abs(amount), [toKey]: Math.abs(amount) },
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
      id: uid('goal'),
      bucketKey,
      name,
      target: Number(target),
      currency,
      priority: nextPriority,
      parallel,
      status: 'active',
      claimedAt: '',
      claimedAmount: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
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

  // Mark a goal as claimed — creates an expense transaction for it
  claimGoal: (id, { actualAmount } = {}) => {
    const goal = get().personal.goals.find((g) => g.id === id);
    if (!goal) return null;
    const amount = actualAmount !== undefined ? Number(actualAmount) : goal.target;

    // Create an expense transaction routed to the goal's bucket
    const tx = {
      id: uid('tx'),
      date: nowISO(),
      amount,
      currency: goal.currency,
      category: 'Goal',
      type: 'expense',
      notes: `🎯 ${goal.name}`,
      buckets: { [goal.bucketKey]: -Math.abs(amount) },
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));

    // Mark the goal as claimed
    const updated = {
      ...goal,
      status: 'claimed',
      claimedAt: nowISO(),
      claimedAmount: amount,
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

  // ─── Budgets (legacy — kept for category caps inside Operations) ──
  addBudget: ({ category, limit, currency = 'USD', period = 'monthly' }) => {
    const b = {
      id: uid('bdg'), category, limit: Number(limit), currency, period,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
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
  addDebt: ({ creditor, principal, currency = 'USD', dueDate, notes = '' }) => {
    const d = {
      id: uid('debt'), creditor, principal: Number(principal), currency,
      dueDate: dueDate || '', notes, status: 'active',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, d] } }));
    enqueue(set, get, 'debt', 'create', d);
    return d;
  },

  recordRepayment: (debtId, amount) => {
    const debt = get().personal.debts.find((d) => d.id === debtId);
    if (!debt) return null;
    const currentRepaid = computeDebtRepaid(get().personal.debtEvents, debtId);
    const cappedAmount  = Math.min(Number(amount), debt.principal - currentRepaid);
    if (cappedAmount <= 0) return null;
    const newRepaid    = currentRepaid + cappedAmount;
    const balanceAfter = debt.principal - newRepaid;
    const baseCurrency = get().app.baseCurrency;
    const rates        = get().app.rates;
    const balanceAfterBase = convert(balanceAfter, debt.currency, baseCurrency, rates);

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
    const v = {
      id: uid('vnt'), name, notes, status: 'active',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
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
      }));

      set((s) => ({
        personal: {
          ...s.personal,
          transactions: [
            ...localPendingTx,
            ...txs.filter((t) => !pendingIds.has(t.id)),
          ].sort((a, b) => new Date(b.date) - new Date(a.date)),
          budgets:          data.budgets          || s.personal.budgets,
          debts:            data.debts            || s.personal.debts,
          debtEvents:       data.debtEvents       || s.personal.debtEvents,
          investments:      data.investments      || s.personal.investments,
          investmentEvents: data.investmentEvents || s.personal.investmentEvents,
          ventures:         data.ventures         || s.personal.ventures,
          ventureEvents:    data.ventureEvents    || s.personal.ventureEvents,
          buckets:          (data.buckets && data.buckets.length) ? data.buckets : s.personal.buckets,
          goals:            data.goals            || s.personal.goals,
          lastSyncAt: nowISO(),
          syncError: null,
        },
        app: { ...s.app, online: true },
      }));

      // If buckets are still empty after sync, seed with defaults
      if (get().personal.buckets.length === 0) {
        get().initializeBuckets();
      }
    } catch (err) {
      set((s) => ({
        personal: { ...s.personal, syncError: err.message },
        app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
      }));
      // Even on hydrate failure, seed buckets so UI works offline
      if (get().personal.buckets.length === 0) {
        get().initializeBuckets();
      }
    }
  },

  syncQueue: async () => {
    if (get().personal.syncing) return;
    const queue = get().personal.queue;
    if (queue.length === 0) return;

    set((s) => ({ personal: { ...s.personal, syncing: true, syncError: null } }));
    try {
      const { results = [] } = await api.bulk(queue);
      const failedOps = queue.filter((_, i) => results[i]?.status >= 400);
      set((s) => ({
        personal: {
          ...s.personal,
          queue: failedOps,
          transactions: s.personal.transactions.map((t) => ({ ...t, _pending: false })),
          lastSyncAt: nowISO(),
          syncing: false,
        },
        app: { ...s.app, online: true },
      }));
    } catch (err) {
      set((s) => ({
        personal: { ...s.personal, syncing: false, syncError: err.message },
        app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
      }));
    }
  },

  clearQueue: () => set((s) => ({ personal: { ...s.personal, queue: [], syncError: null } })),
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
      version: 4,
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
          queue:            s.personal.queue,
          lastSyncAt:       s.personal.lastSyncAt,
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
        };
        // v2 → v3 venture migration
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
        // v3 → v4: ensure transactions have a buckets field (default empty)
        if (Array.isArray(p.personal.transactions)) {
          p.personal.transactions = p.personal.transactions.map((t) => ({
            ...t,
            buckets: t.buckets || {},
          }));
        }
        return p;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        app: { ...current.app, ...(persisted?.app || {}), editingTxId: null },
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
// EVENT-SOURCED COMPUTATIONS
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

/**
 * Compute current bucket balances by summing all transactions' bucket allocations.
 * Returns { warChest: 1234.56, operations: 567.89, ... } in base currency.
 */
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

/**
 * Compute month-to-date inflow and outflow per bucket.
 */
export function computeBucketMTD(transactions, base, rates) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const mtd = {}; // { bucketKey: { inflow, outflow } }
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

/**
 * Compute filling state for a bucket's goals based on current bucket balance.
 * Sequential goals fill in priority order. Parallel goals split remaining balance proportionally.
 */
export function computeGoalsForBucket(goals, bucketKey, bucketBalance, base, rates) {
  const active = goals
    .filter((g) => g.bucketKey === bucketKey && g.status === 'active')
    .sort((a, b) => a.priority - b.priority);

  let remaining = Math.max(0, bucketBalance);
  const result = [];

  // Phase 1: fill sequential (non-parallel) goals first, in priority order
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

  // Phase 2: parallel goals share whatever's left, proportional to their targets
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
export const selectActiveTab        = (s) => s.app.activeTab;
export const selectBaseCurrency     = (s) => s.app.baseCurrency;
export const selectRates            = (s) => s.app.rates;
export const selectTheme            = (s) => s.app.theme;
export const selectQueueSize        = (s) => s.personal.queue.length;
export const selectIsSyncing        = (s) => s.personal.syncing;
export const selectIsOnline         = (s) => s.app.online;
export const selectEditingTxId      = (s) => s.app.editingTxId;
export const selectLastDeleted      = (s) => s.personal.lastDeleted;

export const selectTotalDebtInBase = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  let sum = 0;
  for (const d of state.personal.debts) {
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

export function computeDebtsWithStatus(debts, debtEvents, base, rates) {
  return debts.map((d) => {
    const repaid = computeDebtRepaid(debtEvents, d.id);
    const remaining = d.principal - repaid;
    const remainingBase = convert(remaining, d.currency, base, rates);
    const events = debtEvents
      .filter((e) => e.debtId === d.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return { ...d, repaid, remaining, remainingBase, events };
  });
}

if (typeof window !== 'undefined') {
  const triggerSync = () => useStore.getState().syncQueue();
  window.addEventListener('online', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: true } }));
    triggerSync();
  });
  window.addEventListener('offline', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: false } }));
  });
  useStore.getState().hydrate();
  setInterval(triggerSync, 20_000);
}
