import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, ApiError } from '../lib/api';

// Client-side ID — survives offline/reload roundtrips
const uid = () =>
  `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeta = ({ _pending, ...rest }) => rest;

// ────────────────────────────────────────────────────────────
// PERSONAL FINANCE SLICE
// ────────────────────────────────────────────────────────────
const personalSlice = (set, get) => ({
  personal: {
    transactions: [],
    queue: [],          // [{ action, ...payload }]
    lastSyncAt: null,
    syncing: false,
    syncError: null,
  },

  addTransaction: (input) => {
    const tx = {
      id: uid(),
      date: input.date || new Date().toISOString(),
      amount: Number(input.amount),
      category: input.category || 'Other',
      type: input.type, // 'income' | 'expense'
      notes: input.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

  deleteTransaction: (id) => {
    set((s) => ({
      personal: {
        ...s.personal,
        transactions: s.personal.transactions.filter((t) => t.id !== id),
        queue: [...s.personal.queue, { action: 'delete', id }],
      },
    }));
    get().syncQueue();
  },

  hydrate: async () => {
    try {
      const { transactions } = await api.fetchAll();
      const pendingIds = new Set(
        get().personal.queue
          .filter((op) => op.action === 'create')
          .map((op) => op.id)
      );
      const localPending = get().personal.transactions.filter((t) => pendingIds.has(t.id));

      set((s) => ({
        personal: {
          ...s.personal,
          transactions: [
            ...localPending,
            ...transactions.filter((t) => !pendingIds.has(t.id)),
          ].sort((a, b) => new Date(b.date) - new Date(a.date)),
          lastSyncAt: new Date().toISOString(),
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
    const { syncing } = get().personal;
    if (syncing) return;

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
          lastSyncAt: new Date().toISOString(),
          syncing: false,
        },
        app: { ...s.app, online: true },
      }));
    } catch (err) {
      // Network failed → keep queue intact, mark offline, retry later
      set((s) => ({
        personal: { ...s.personal, syncing: false, syncError: err.message },
        app: { ...s.app, online: !(err instanceof ApiError && err.status === 0) },
      }));
    }
  },
});

// ────────────────────────────────────────────────────────────
// BUSINESS SLICE (stub for Phase 2 — AVS Solution HT)
// ────────────────────────────────────────────────────────────
const businessSlice = () => ({
  business: {
    enabled: false,
    transactions: [],
    queue: [],
  },
});

// ────────────────────────────────────────────────────────────
// APP SLICE (workspace, theme, connectivity)
// ────────────────────────────────────────────────────────────
const appSlice = (set, get) => ({
  app: {
    workspace: 'personal',
    theme: 'light',
    online: true,
  },
  setWorkspace: (workspace) => set((s) => ({ app: { ...s.app, workspace } })),
  toggleTheme: () =>
    set((s) => ({ app: { ...s.app, theme: s.app.theme === 'light' ? 'dark' : 'light' } })),
});

// ────────────────────────────────────────────────────────────
// COMPOSED STORE
// ────────────────────────────────────────────────────────────
export const useStore = create()(
  persist(
    (set, get) => ({
      ...appSlice(set, get),
      ...personalSlice(set, get),
      ...businessSlice(set, get),
    }),
    {
      name: 'fintrack-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        app: { workspace: state.app.workspace, theme: state.app.theme },
        personal: {
          transactions: state.personal.transactions,
          queue: state.personal.queue,
          lastSyncAt: state.personal.lastSyncAt,
        },
        business: state.business,
      }),
      version: 1,
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        app: { ...current.app, ...(persisted?.app || {}) },
        personal: {
          ...current.personal,
          ...(persisted?.personal || {}),
          syncing: false,
          syncError: null,
        },
      }),
    }
  )
);

// Selectors
export const selectTransactions = (s) => s.personal.transactions;
export const selectQueueSize = (s) => s.personal.queue.length;
export const selectIsSyncing = (s) => s.personal.syncing;
export const selectIsOnline = (s) => s.app.online;
export const selectTheme = (s) => s.app.theme;

// Side-effects: connectivity + initial hydrate + periodic sync
if (typeof window !== 'undefined') {
  const triggerSync = () => useStore.getState().syncQueue();

  window.addEventListener('online', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: true } }));
    triggerSync();
  });
  window.addEventListener('offline', () => {
    useStore.setState((s) => ({ app: { ...s.app, online: false } }));
  });

  // Hydrate on boot (will detect real connectivity by trying)
  useStore.getState().hydrate();

  // Background drain every 20s
  setInterval(triggerSync, 20_000);
}
