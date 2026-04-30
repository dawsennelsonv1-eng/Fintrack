// src/store/useStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, ApiError } from '../lib/api';
import { DEFAULT_RATES, convert } from '../lib/currency';

const uid = (prefix = 'tx') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeta = ({ _pending, ...rest }) => rest;
const nowISO = () => new Date().toISOString();

// Enqueue an operation tagged with its entity type.
// The Apps Script switches on `entity` to write to the right tab.
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
    queue: [],
    lastSyncAt: null,
    syncing: false,
    syncError: null,
    lastDeleted: null,
  },

  // ─── Transactions ─────────────────────────────────────────
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
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    return tx;
  },
  updateTransaction: (id, patch) => {
    let updated = null;
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.map((t) => {
          if (t.id !== id) return t;
          updated = {
            ...t, ...patch,
            amount: patch.amount !== undefined ? Number(patch.amount) : t.amount,
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

  // ─── Budgets ──────────────────────────────────────────────
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
      id: uid('debt'),
      creditor,
      principal: Number(principal),
      currency,
      dueDate: dueDate || '',
      notes,
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
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
      id: uid('devt'),
      debtId,
      type: 'repayment',
      amount: cappedAmount,
      currency: debt.currency,
      balanceAfter,
      balanceAfterBase,
      baseCurrency,
      notes: '',
      date: nowISO(),
      createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, debtEvents: [...s.personal.debtEvents, event] },
    }));
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
      units: Number(units),
      costBasis: Number(costBasis),
      currentPrice: Number(currentPrice ?? costBasis),
      currency,
      createdAt: nowISO(), updatedAt: nowISO(),
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
      id: uid('ievt'),
      investmentId: id,
      type: 'priceUpdate',
      price: newPrice,
      previousPrice,
      currency: inv.currency,
      notes: '',
      date: nowISO(),
      createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, investmentEvents: [...s.personal.investmentEvents, event] },
    }));
    enqueue(set, get, 'investmentEvent', 'create', event);
  },

  removeInvestment: (id) => {
    set((s) => ({ personal: { ...s.personal, investments: s.personal.investments.filter((i) => i.id !== id) } }));
    enqueue(set, get, 'investment', 'delete', { id });
  },

  // ─── Ventures ─────────────────────────────────────────────
  addVenture: ({ name, notes = '' }) => {
    const v = {
      id: uid('vnt'), name, notes,
      status: 'active',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, ventures: [...s.personal.ventures, v] } }));
    enqueue(set, get, 'venture', 'create', v);
    return v;
  },

  deployToVenture: (ventureId, { amount, currency = 'USD', note = '' }) => {
    const event = {
      id: uid('vevt'),
      ventureId,
      type: 'deploy',
      amount: Number(amount),
      currency,
      note,
      date: nowISO(),
      createdAt: nowISO(),
    };
    set((s) => ({
      personal: { ...s.personal, ventureEvents: [...s.personal.ventureEvents, event] },
    }));
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
      const txs = (data.transactions || []).map((t) => ({ ...t, currency: t.currency || 'USD' }));

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
      version: 3,
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
        };
        // Migrate v2 nested venture.deployed[] → flat ventureEvents
        if (Array.isArray(p.personal.ventures)) {
          const events = [...(p.personal.ventureEvents || [])];
          p.personal.ventures = p.personal.ventures.map((v) => {
            if (Array.isArray(v.deployed) && v.deployed.length) {
              for (const d of v.deployed) {
                events.push({
                  id: d.id || uid('vevt'),
                  ventureId: v.id,
                  type: 'deploy',
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
