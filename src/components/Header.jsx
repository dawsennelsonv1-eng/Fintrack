import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sun, Moon, Check, Lock } from 'lucide-react';
import { useStore, selectTheme } from '../store/useStore';

const WORKSPACES = [
  { id: 'personal', label: 'Personal', sublabel: 'Finance', enabled: true },
  { id: 'business', label: 'AVS Solution HT', sublabel: 'Business · soon', enabled: false },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const workspace = useStore((s) => s.app.workspace);
  const setWorkspace = useStore((s) => s.setWorkspace);
  const theme = useStore(selectTheme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const active = WORKSPACES.find((w) => w.id === workspace) || WORKSPACES[0];

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg)]/80 border-b border-[var(--border)]">
      <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between">
        {/* Workspace switcher */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="group flex items-center gap-2.5 px-3 py-1.5 -ml-3 rounded-xl hover:bg-[var(--surface)] transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-ink-900 dark:bg-ink-50 flex items-center justify-center">
              <span className="font-display text-base text-ink-50 dark:text-ink-900 leading-none">
                {active.label[0]}
              </span>
            </div>
            <div className="text-left">
              <div className="font-medium text-sm leading-none">{active.label}</div>
              <div className="text-[11px] text-muted leading-none mt-0.5">
                {active.sublabel}
              </div>
            </div>
            <ChevronDown
              size={14}
              className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-full left-0 mt-2 w-64 surface border rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="p-1.5">
                  {WORKSPACES.map((w) => (
                    <button
                      key={w.id}
                      disabled={!w.enabled}
                      onClick={() => {
                        if (w.enabled) {
                          setWorkspace(w.id);
                          setOpen(false);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        w.enabled
                          ? 'hover:bg-[var(--bg)] cursor-pointer'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center">
                        <span className="font-display text-base">{w.label[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{w.label}</div>
                        <div className="text-[11px] text-muted">{w.sublabel}</div>
                      </div>
                      {w.id === workspace && <Check size={14} className="text-muted" />}
                      {!w.enabled && <Lock size={12} className="text-muted" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full surface border flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>
    </header>
  );
}
