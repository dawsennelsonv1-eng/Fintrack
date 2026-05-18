// src/App.jsx
// Ship 1 — Removes CombinedWealthStrip per Christian's feedback.
// Adds AvsSyncDebug overlay (triple-tap top of screen to open).
//
import { useEffect, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore, selectTheme, selectActiveTab } from './store/useStore';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import DebtPill from './components/DebtPill';
import QuickAdd from './components/QuickAdd';
import { UndoToast } from './components/TxActions';
import InstallPrompt from './components/InstallPrompt';
import SearchOverlay from './components/SearchOverlay';
import Settings from './components/Settings';
import AvsSyncDebug from './components/AvsSyncDebug';
import { getWorkspace } from './workspaces/registry';

const slide = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

export default function App() {
  const theme = useStore(selectTheme);
  const activeTab = useStore(selectActiveTab);
  const workspace = useStore((s) => s.app.workspace);
  const setActiveTab = useStore((s) => s.setActiveTab);

  const ws = getWorkspace(workspace);
  const Module = ws.modules[activeTab] || ws.modules[ws.defaultTab];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--workspace-accent',    ws.accent.primary);
    root.style.setProperty('--workspace-accent-fg', ws.accent.primaryFg);
    root.style.setProperty('--workspace-accent-soft', ws.accent.soft);
    root.setAttribute('data-workspace', ws.id);
  }, [ws]);

  useEffect(() => {
    if (!ws.modules[activeTab]) {
      setActiveTab(ws.defaultTab);
    }
  }, [workspace, ws, activeTab, setActiveTab]);

  return (
    <div className="min-h-screen font-sans">
      <Header />

      {/* DebtPill is Personal-only; AVS hides it */}
      {workspace === 'personal' && (
        <div className="max-w-2xl mx-auto px-5 pt-3">
          <DebtPill />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={`${workspace}:${activeTab}`} {...slide}>
          <Suspense fallback={<ModuleFallback />}>
            <Module />
          </Suspense>
        </motion.div>
      </AnimatePresence>

      {workspace === 'personal' && <QuickAdd />}

      <BottomNav />

      <SearchOverlay />
      <Settings />
      <UndoToast />
      <InstallPrompt />
      <AvsSyncDebug />
    </div>
  );
}

function ModuleFallback() {
  return (
    <div className="max-w-2xl mx-auto px-5 pt-8 pb-32">
      <div className="space-y-3">
        <div className="h-10 w-40 rounded-lg bg-[var(--surface)] animate-pulse" />
        <div className="h-32 rounded-2xl bg-[var(--surface)] animate-pulse" />
        <div className="h-48 rounded-2xl bg-[var(--surface)] animate-pulse" />
      </div>
    </div>
  );
}
