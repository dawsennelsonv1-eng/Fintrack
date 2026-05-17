// src/App.jsx
// Tier 5g — adds CombinedWealthStrip below header
//
// Changes from Tier 5a:
//   • CombinedWealthStrip now renders between Header and DebtPill
//   • Strip shows both workspaces' key money number simultaneously
//   • Tapping either side jumps to that workspace's dashboard
//   • DebtPill still appears below the strip (Personal only)
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
import CombinedWealthStrip from './components/CombinedWealthStrip';
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

      {/* Tier 5g — Combined wealth strip below header, above DebtPill */}
      <div className="max-w-2xl mx-auto px-5 pt-3 space-y-2">
        <CombinedWealthStrip />
        {workspace === 'personal' && <DebtPill />}
      </div>

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
