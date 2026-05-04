// src/components/SyncBadge.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ChevronUp } from 'lucide-react';
import {
  useStore, selectQueueSize, selectIsSyncing, selectIsOnline,
} from '../store/useStore';

export default function SyncBadge() {
  const [open, setOpen] = useState(false);
  const queueSize = useStore(selectQueueSize);
  const syncing = useStore(selectIsSyncing);
  const online = useStore(selectIsOnline);
  const syncError = useStore((s) => s.personal.syncError);
  const queue = useStore((s) => s.personal.queue);
  const lastSyncAt = useStore((s) => s.personal.lastSyncAt);
  const triggerSync = useStore((s) => s.syncQueue);
  const triggerHydrate = useStore((s) => s.hydrate);
  const clearQueue = useStore((s) => s.clearQueue);

  let state = 'synced';
  if (!online) state = 'offline';
  else if (syncing) state = 'syncing';
  else if (syncError) state = 'error';
  else if (queueSize > 0) state = 'pending';

  const cfg = {
    synced:  { icon: Cloud,         text: 'Synced',                   tone: 'text-muted' },
    syncing: { icon: RefreshCw,     text: 'Syncing…',                 tone: 'text-muted' },
    pending: { icon: Cloud,         text: `${queueSize} pending`,     tone: 'text-amber-600 dark:text-amber-400' },
    offline: { icon: CloudOff,      text: 'Offline',                  tone: 'text-muted' },
    error:   { icon: AlertTriangle, text: 'Sync error',               tone: 'text-accent-expense' },
  }[state];

  const showDetail = state === 'pending' || state === 'error' || state === 'offline';

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.button
          key={state}
          onClick={() => showDetail && setOpen((v) => !v)}
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-1.5 text-[11px] ${cfg.tone} ${showDetail ? 'cursor-pointer hover:opacity-70' : ''}`}
        >
          <cfg.icon size={11} className={state === 'syncing' ? 'animate-spin' : ''} />
          <span>{cfg.text}</span>
          {showDetail && (
            <ChevronUp size={10} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
          )}
        </motion.button>
      </AnimatePresence>

      <AnimatePresence>
        {open && showDetail && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-full mt-2 z-40 w-72 surface border rounded-xl shadow-xl p-3 text-xs"
            >
              <div className="font-medium mb-2">Sync detail</div>

              {syncError && (
                <div className="mb-3 p-2 rounded-lg bg-accent-expense/10 text-accent-expense">
                  <div className="font-medium mb-0.5">Last error</div>
                  <div className="text-[11px] opacity-90 break-words">{syncError}</div>
                </div>
              )}

              <div className="space-y-1 text-muted">
                <Row label="Online">{online ? 'Yes' : 'No'}</Row>
                <Row label="Queue">{queueSize} item{queueSize === 1 ? '' : 's'}</Row>
                <Row label="Last sync">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('en') : 'never'}
                </Row>
              </div>

              {queue.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="font-medium mb-1.5">Queued operations</div>
                  <ul className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                    {queue.slice(0, 8).map((op, i) => (
                      <li key={i} className="text-[11px] text-muted truncate">
                        <span className="font-mono">{op.action}</span>
                        {op.entity && <span className="text-[10px] ml-1 text-[var(--text)]/60">[{op.entity}]</span>}
                        {op.amount !== undefined && ` · ${op.amount} ${op.currency || 'USD'}`}
                        {op.category && ` · ${op.category}`}
                        {op.name && ` · ${op.name}`}
                        {op.creditor && ` · ${op.creditor}`}
                      </li>
                    ))}
                    {queue.length > 8 && <li className="text-[10px] text-muted">+{queue.length - 8} more</li>}
                  </ul>
                  {syncError && (
                    <div className="mt-2 px-2 py-1.5 rounded-md bg-accent-expense/10 text-accent-expense text-[10px]">
                      {syncError}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-[var(--border)] flex gap-2">
                <button
                  onClick={() => { triggerSync(); }}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-[11px] font-medium"
                >
                  Retry sync
                </button>
                <button
                  onClick={() => { triggerHydrate(); }}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-[11px] font-medium"
                >
                  Pull from sheet
                </button>
              </div>
              {queue.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm(`Discard all ${queue.length} pending operations? This won't delete data already in the sheet, but unsynced changes will be lost.`)) {
                      clearQueue();
                    }
                  }}
                  className="w-full mt-2 px-2 py-1.5 rounded-lg text-accent-expense hover:bg-accent-expense/10 transition-colors text-[11px] font-medium"
                >
                  Clear stuck queue
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-[var(--text)] num">{children}</span>
    </div>
  );
}
