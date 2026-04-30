// src/store/useStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, ApiError } from '../lib/api';
import { DEFAULT_RATES, convert } from '../lib/currency';

const uid = (prefix = 'tx') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeta = ({ _pending, ...rest }) => rest;
const nowISO = () => new Date().toISOString();

const appSlice = (set, get) => ({
  app: {
    workspace: 'personal',
    theme: 'dark',
    online: true,
    activeTab: 'dashboard',
    baseCurrency: 'USD',
    rates: { ...DEFAULT_RATES },
    debtAcknowledged: false,
    editingTxId: null,        // ← NEW: which transaction is being edited
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

const personalSlice = (set, get) => ({
  personal: {
    transactions: [],
    budgets: [],
    debts: [],
    investments: [],
    ventures: [],
    queue: [],
    lastSyncAt: null,
    syncing: false,
    syncError: null,
    lastDeleted: null,        // ← NEW: for undo
  },

  addTransaction: (input) => {
    const tx = {
      id: uid('tx'),
      date: input.date || nowISO(),
      amount: Number(input.amount),
      currency: input.currency || 'USD',
      category: input.category || 'Other',
      type: input.type,
      notes: input.notes || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: [tx, ...s.personal.transactions],
        queue: [...s.personal.queue, { action: 'create', ...stripMeta(tx) }],
      },
    }));
    get().syncQueue();
    return tx;
  },

  // NEW — edit an existing transaction
  updateTransaction: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.map((t) => {
          if (t.id !== id) return t;
          updated = {
            ...t,
            ...patch,
            amount: patch.amount !== undefined ? Number(patch.amount) : t.amount,
            updatedAt: nowISO(),
            _pending: true,
          };
          return updated;
        }),
      },
    }));
    if (updated) {
      set((s) => ({
        personal: {
          ...s.personal,
          queue: [...s.personal.queue, { action: 'update', ...stripMeta(updated) }],
        },
      }));
      get().syncQueue();
    }
    return updated;
  },

  deleteTransaction: (id) => {
    const tx = get().personal.transactions.find((t) => t.id === id);
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.filter((t) => t.id !== id),
        queue: [...s.personal.queue, { action: 'delete', id }],
        lastDeleted: tx ? { tx, deletedAt: Date.now() } : s.personal.lastDeleted,
      },
    }));
    get().syncQueue();
  },

  // NEW — undo the last delete (within 5s)
  undoDelete: () => {
    const last = get().personal.lastDeleted;
    if (!last) return null;
    const tx = { ...last.tx, _pending: true, updatedAt: nowISO() };
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: [tx, ...s.personal.transactions]
          .sort((a, b) => new Date(b.date) - new Date(a.date)),
        queue: [...s.personal.queue, { action: 'create', ...stripMeta(tx) }],
        lastDeleted: null,
      },
    }));
    get().syncQueue();
    return tx;
  },

  clearLastDeleted: () => {
    set((s) => ({ personal: { ...s.personal, lastDeleted: null } }));
  },

  // ─── Budgets ───────────────────────────────────────────────
  addBudget: ({ category, limit, currency = 'USD', period = 'monthly' }) => {
    const b = { id: uid('bdg'), category, limit: Number(limit), currency, period, createdAt: nowISO() };
    set((s) => ({ personal: { ...s.personal, budgets: [...s.personal.budgets, b] } }));
    return b;
  },
  updateBudget: (id, patch) => {
    set((s) => ({
      personal: { ...s.personal, budgets: s.personal.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)) },
    }));
  },
  removeBudget: (id) => {
    set((s) => ({ personal: { ...s.personal, budgets: s.personal.budgets.filter((b) => b.id !== id) } }));
  },

  // ─── Debts ─────────────────────────────────────────────────
  addDebt: ({ creditor, principal, currency = 'USD', dueDate, notes = '' }) => {
    const d = {
      id: uid('debt'), creditor, principal: Number(principal), currency,
      repaid: 0, dueDate: dueDate || null, notes, createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, d] } }));
    return d;
  },
  recordRepayment: (id, amount) => {
    set((s) => ({
      personal: {
        ...s.personal,
        debts: s.personal.debts.map((d) =>
          d.id === id ? { ...d, repaid: Math.min(d.principal, d.repaid + Number(amount)) } : d
        ),
      },
    }));
  },
  removeDebt: (id) => {
    set((s) => ({ personal: { ...s.personal, debts: s.personal.debts.filter((d) => d.id !== id) } }));
  },

  // ─── Investments ───────────────────────────────────────────
  addInvestment: ({ kind, name, units, costBasis, currentPrice, currency = 'USD' }) => {
    const inv = {
      id: uid('inv'), kind, name,
      units: Number(units),
      costBasis: Number(costBasis),
      currentPrice: Number(currentPrice ?? costBasis),
      currency, createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, investments: [...s.personal.investments, inv] } }));
    return inv;
  },
  updateInvestmentPrice: (id, currentPrice) => {
    set((s) => ({
      personal: {
        ...s.personal,
        investments: s.personal.investments.map((i) =>
          i.id === id ? { ...i, currentPrice: Number(currentPrice), updatedAt: nowISO() } : i
        ),
      },
    }));
  },
  removeInvestment: (id) => {
    set((s) => ({
      personal: { ...s.personal, investments: s.personal.investments.filter((i) => i.id !== id) },
    }));
  },

  // ─── Ventures ──────────────────────────────────────────────
  addVenture: ({ name, notes = '' }) => {
    const v = {
      id: uid('vnt'), name, notes,
      status: 'active', deployed: [], createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, ventures: [...s.personal.ventures, v] } }));
    return v;
  },
  deployToVenture: (id, { amount, currency = 'USD', note = '' }) => {
    const entry = { id: uid('dep'), amount: Number(amount), currency, date: nowISO(), note };
    set((s) => ({
      personal: {
        ...s.personal,
        ventures: s.personal.ventures.map((v) =>
          v.id === id ? { ...v, deployed: [...v.deployed, entry] } : v
        ),
      },
    }));
    return entry;
  },
  setVentureStatus: (id, status) => {
    set((s) => ({
      personal: {
        ...s.personal,
        ventures: s.personal.ventures.map((v) => (v.id === id ? { ...v, status } : v)),
      },
    }));
  },
  removeVenture: (id) => {
    set((s) => ({ personal: { ...s.personal, ventures: s.personal.ventures.filter((v) => v.id !== id) } }));
  },

  // ─── Sync ──────────────────────────────────────────────────
  hydrate: async () => {
    try {
      const { transactions } = await api.fetchAll();
      const pendingIds = new Set(
        get().personal.queue.filter((op) => op.action === 'create').map((op) => op.id)
      );
      const localPending = get().personal.transactions.filter((t) => pendingIds.has(t.id));
      set((s) => ({
        personal: {
          ...s.personal,
          transactions: [
            ...localPending,
            ...transactions
              .filter((t) => !pendingIds.has(t.id))
              .map((t) => ({ ...t, currency: t.currency || 'USD' })),
          ].sort((a, b) => new Date(b.date) - new Date(a.date)),
          lastSyncAt: nowISO(),
          syncError: null,
        },
        app: { ...s.app, online: true },
      }));
    } catch (err) {
      set((s) => ({
        personal: { ...s.personal, syncError: err.message },
        app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
      }));
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

  clearQueue: () => {
    set((s) => ({ personal: { ...s.personal, queue: [], syncError: null } }));
  },
});

const businessSlice = () => ({
  business: { enabled: false, transactions: [], queue: [] },
});

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
      version: 2,
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
          transactions: s.personal.transactions,
          budgets: s.personal.budgets,
          debts: s.personal.debts,
          investments: s.personal.investments,
          ventures: s.personal.ventures,
          queue: s.personal.queue,
          lastSyncAt: s.personal.lastSyncAt,
        },
        business: s.business,
      }),
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

// Selectors
export const selectTransactions = (s) => s.personal.transactions;
export const selectBudgets = (s) => s.personal.budgets;
export const selectDebts = (s) => s.personal.debts;
export const selectInvestments = (s) => s.personal.investments;
export const selectVentures = (s) => s.personal.ventures;
export const selectActiveTab = (s) => s.app.activeTab;
export const selectBaseCurrency = (s) => s.app.baseCurrency;
export const selectRates = (s) => s.app.rates;
export const selectTheme = (s) => s.app.theme;
export const selectQueueSize = (s) => s.personal.queue.length;
export const selectIsSyncing = (s) => s.personal.syncing;
export const selectIsOnline = (s) => s.app.online;
export const selectEditingTxId = (s) => s.app.editingTxId;
export const selectLastDeleted = (s) => s.personal.lastDeleted;

export const selectTotalDebtInBase = (state) => {
  const base = state.app.baseCurrency;
  const rates = state.app.rates;
  let sum = 0;
  for (const d of state.personal.debts) {
    sum += convert(d.principal - d.repaid, d.currency, base, rates);
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

export function computeVentureTotals(ventures, base, rates) {
  return ventures.map((v) => {
    let total = 0;
    for (const d of v.deployed) total += convert(d.amount, d.currency, base, rates);
    return { ...v, deployedTotal: total };
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
