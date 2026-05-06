// src/components/settings/DangerZone.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useStore, selectQueueSize } from '../../store/useStore';

export default function DangerZone({ onDone }) {
  const resetLocalData = useStore((s) => s.resetLocalData);
  const clearQueue = useStore((s) => s.clearQueue);
  const queueSize = useStore(selectQueueSize);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const handleReset = async () => {
    setWorking(true);
    try {
      await resetLocalData();
      onDone?.();
    } finally {
      setWorking(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-expense/30 bg-accent-expense/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-accent-expense shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-accent-expense mb-1">Clear local data</h3>
            <p className="text-[12px] text-muted leading-relaxed">
              This wipes everything stored on this device and re-fetches from your sheet. Your sheet data is not touched.
              Use this only if the app is misbehaving (stuck queue, weird state, ghost transactions).
            </p>
          </div>
        </div>
      </div>

      {queueSize > 0 && (
        <div className="rounded-xl border border-[var(--border)] p-4">
          <div className="text-sm font-medium mb-1">⚠ Pending sync queue</div>
          <p className="text-[12px] text-muted mb-3">
            You have {queueSize} unsynced operation{queueSize === 1 ? '' : 's'}. Clearing data will discard {queueSize === 1 ? 'it' : 'them'} permanently.
          </p>
          <button
            onClick={() => { clearQueue(); }}
            className="text-[12px] underline underline-offset-2 hover:no-underline"
          >
            Clear queue first ({queueSize})
          </button>
        </div>
      )}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-expense/10 text-accent-expense text-sm font-medium hover:bg-accent-expense/20 transition-colors"
        >
          <RefreshCw size={14} />
          Clear local data & re-sync
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <p className="text-[12px] text-center text-muted">
            Sure? You'll see a brief loading state while the app re-fetches from the sheet.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirming(false)} disabled={working}
              className="py-3 rounded-xl bg-[var(--bg)] text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReset} disabled={working}
              className="py-3 rounded-xl bg-accent-expense text-white text-sm font-medium flex items-center justify-center gap-2"
            >
              {working ? (<><Loader2 size={14} className="animate-spin" /> Clearing…</>) : 'Yes, clear'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
