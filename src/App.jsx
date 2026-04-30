// src/App.jsx
import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore, selectTheme, selectActiveTab } from './store/useStore';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import DebtPill from './components/DebtPill';
import QuickAdd from './components/QuickAdd';
import { UndoToast } from './components/TxActions';
import InstallPrompt from './components/InstallPrompt';

const Dashboard   = lazy(() => import('./modules/Dashboard'));
const Budgets     = lazy(() => import('./modules/Budgets'));
const Investments = lazy(() => import('./modules/Investments'));
const CalendarMod = lazy(() => import('./modules/CalendarView'));
const Debt        = lazy(() => import('./modules/Debt'));

const MODULES = {
  dashboard:   Dashboard,
  budgets:     Budgets,
  investments: Investments,
  calendar:    CalendarMod,
  debt:        Debt,
};

const slide = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

export default function App() {
  const theme = useStore(selectTheme);
  const activeTab = useStore(selectActiveTab);
  const Module = MODULES[activeTab] || Dashboard;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="min-h-screen font-sans">
      <Header />

      <div className="max-w-2xl mx-auto px-5 pt-3">
        <DebtPill />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...slide}>
          <Suspense fallback={<ModuleFallback />}>
            <Module />
          </Suspense>
        </motion.div>
      </AnimatePresence>

      <QuickAdd />
      <BottomNav />
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
