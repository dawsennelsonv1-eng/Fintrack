// src/components/BottomNav.jsx
// Tier 5a — workspace-aware bottom nav
//
// Tabs are now pulled from the active workspace's registry entry.
// Icons are looked up by string from lucide-react. The active-tab
// pill background uses workspace accent color (subtle wash).
//
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useStore, selectActiveTab, selectTotalDebtInBase } from '../store/useStore';
import { getWorkspace } from '../workspaces/registry';

// Map alertKey string → selector function. Add more here if other
// workspaces want red-dot alerts on tabs.
const ALERT_SELECTORS = {
  totalDebtInBase: selectTotalDebtInBase,
};

function useAlert(alertKey) {
  const selector = alertKey ? ALERT_SELECTORS[alertKey] : null;
  // Always call a hook (rules of hooks), but feed it a no-op selector
  // when none requested, so nothing re-renders unnecessarily.
  return useStore(selector || (() => 0));
}

function NavTab({ tab, isActive, onClick, accent }) {
  // Icon lookup — fall back to a sensible default if string typo'd
  const Icon = Icons[tab.icon] || Icons.Circle;
  const alertValue = useAlert(tab.alertKey);
  const showAlert = tab.alertKey && alertValue > 0;

  return (
    <button
      onClick={onClick}
      className="flex-1 relative flex flex-col items-center justify-center py-2.5 px-1"
      aria-label={tab.label}
      aria-current={isActive ? 'page' : undefined}
    >
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-1 rounded-xl"
          style={{ backgroundColor: accent.soft }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}

      <div className="relative flex flex-col items-center gap-0.5">
        <div className="relative">
          <motion.div
            animate={{ scale: isActive ? 1 : 0.92, y: isActive ? -1 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.25 : 1.75}
              className={isActive ? 'text-[var(--text)]' : 'text-muted'}
              style={isActive ? { color: accent.primary } : undefined}
            />
          </motion.div>
          {showAlert && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-expense ring-2 ring-[var(--surface)]"
            />
          )}
        </div>
        <motion.span
          animate={{ opacity: isActive ? 1 : 0.6 }}
          className={`text-[10px] font-medium tracking-tight ${
            isActive ? 'text-[var(--text)]' : 'text-muted'
          }`}
          style={isActive ? { color: accent.primary } : undefined}
        >
          {tab.label}
        </motion.span>
      </div>
    </button>
  );
}

export default function BottomNav() {
  const activeTab = useStore(selectActiveTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const workspace = useStore((s) => s.app.workspace);
  const ws = getWorkspace(workspace);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-3 pb-3 pt-2">
        <div className="relative surface border rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/40 overflow-hidden">
          <div className="flex items-stretch relative">
            {ws.tabs.map((tab) => (
              <NavTab
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                accent={ws.accent}
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
