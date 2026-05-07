// src/components/BottomNav.jsx
import { motion } from 'framer-motion';
import { LayoutGrid, Target, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { useStore, selectActiveTab, selectTotalDebtInBase } from '../store/useStore';

const TABS = [
  { id: 'dashboard',   label: 'Home',     icon: LayoutGrid },
  { id: 'budgets',     label: 'Budgets',  icon: Target },
  { id: 'calendar',    label: 'Calendar', icon: Calendar },
  { id: 'investments', label: 'Wealth',   icon: TrendingUp },
  { id: 'debt',        label: 'Debt',     icon: AlertCircle, alert: true },
];

export default function BottomNav() {
  const activeTab = useStore(selectActiveTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const totalDebt = useStore(selectTotalDebtInBase);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-3 pb-3 pt-2">
        <div className="relative surface border rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/40 overflow-hidden">
          <div className="flex items-stretch relative">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              const showAlert = tab.alert && totalDebt > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 relative flex flex-col items-center justify-center py-2.5 px-1"
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-1 bg-[var(--bg)] rounded-xl"
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
                    >
                      {tab.label}
                    </motion.span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
