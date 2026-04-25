// src/components/SyncBadge.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useStore, selectQueueSize, selectIsSyncing, selectIsOnline } from '../store/useStore';

export default function SyncBadge() {
  const queueSize = useStore(selectQueueSize);
  const syncing = useStore(selectIsSyncing);
  const online = useStore(selectIsOnline);

  let state = 'synced';
  if (!online) state = 'offline';
  else if (syncing) state = 'syncing';
  else if (queueSize > 0) state = 'pending';

  const cfg = {
    synced:  { icon: Cloud,    text: 'Synced',          tone: 'text-muted' },
    syncing: { icon: RefreshCw,text: 'Syncing…',        tone: 'text-muted' },
    pending: { icon: Cloud,    text: `${queueSize} pending`, tone: 'text-amber-600 dark:text-amber-400' },
    offline: { icon: CloudOff, text: 'Offline',         tone: 'text-muted' },
  }[state];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-1.5 text-[11px] ${cfg.tone}`}
      >
        <cfg.icon size={11} className={state === 'syncing' ? 'animate-spin' : ''} />
        <span>{cfg.text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
