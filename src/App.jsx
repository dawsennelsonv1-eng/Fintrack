import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore, selectTheme } from './store/useStore';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import QuickAdd from './components/QuickAdd';

export default function App() {
  const theme = useStore(selectTheme);
  const workspace = useStore((s) => s.app.workspace);

  // Sync theme to <html> class so Tailwind dark: works
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="min-h-screen font-sans">
      <Header />
      <AnimatePresence mode="wait">
        <motion.div
          key={workspace}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {workspace === 'personal' && <Dashboard />}
        </motion.div>
      </AnimatePresence>
      <QuickAdd />
    </div>
  );
}
