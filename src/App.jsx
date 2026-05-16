// src/App.jsx
// Tier 5a — workspace-aware module routing
//
// Changes from previous version:
//   • Module map no longer hard-coded; pulled from active workspace's registry
//   • Auto-resets activeTab to workspace's defaultTab when switching workspaces
//     if the current tab doesn't exist in the new workspace
//   • Applies workspace accent color as CSS variable on the root element
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

  // ─── Theme class on <html> ──────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ─── Accent color CSS vars per workspace ────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--workspace-accent',    ws.accent.primary);
    root.style.setProperty('--workspace-accent-fg', ws.accent.primaryFg);
    root.style.setProperty('--workspace-accent-soft', ws.accent.soft);
    root.setAttribute('data-workspace', ws.id);
  }, [ws]);

  // ─── Reset tab when switching to a workspace that doesn't
  //     have the current tab. Prevents black screen if user
  //     was on "investments" in Personal and switches to AVS.
  useEffect(() => {
    if (!ws.modules[activeTab]) {
      setActiveTab(ws.defaultTab);
    }
  }, [workspace, ws, activeTab, setActiveTab]);

  return (
    <div className="min-h-screen font-sans">
      <Header />

      {/* DebtPill is Personal-only; hide in AVS */}
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

      {/* QuickAdd is Personal-only for now; AVS gets its own action
          surfaces inside each module (5b+). */}
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
