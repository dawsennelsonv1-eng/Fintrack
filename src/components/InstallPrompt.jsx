// src/components/InstallPrompt.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'fintrack-install-dismissed';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Already installed?
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      // Wait a bit so we don't startle the user with a popup on first load
      setTimeout(() => setVisible(true), 4000);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    }
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && deferred && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="fixed bottom-28 left-4 right-4 z-50 surface border rounded-2xl shadow-2xl p-4 max-w-md mx-auto"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 flex items-center justify-center shrink-0">
              <Download size={18} strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Install FinTrack</div>
              <div className="text-[12px] text-muted mt-0.5">
                Use it like an app. Works offline, opens fullscreen.
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={install}
                  className="px-4 py-2 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium active:scale-[0.98] transition-transform"
                >
                  Install
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-2 rounded-lg text-xs text-muted hover:text-[var(--text)]"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="w-7 h-7 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center text-muted shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
