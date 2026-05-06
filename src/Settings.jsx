// src/components/Settings.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Coins, Layers, Tags, Download, Palette, AlertOctagon, ChevronRight,
} from 'lucide-react';
import { useStore, selectSettingsOpen } from '../store/useStore';
import RatesEditor from './settings/RatesEditor';
import BucketEditor from './settings/BucketEditor';
import CategoryEditor from './settings/CategoryEditor';
import DataExport from './settings/DataExport';
import DisplaySettings from './settings/DisplaySettings';
import DangerZone from './settings/DangerZone';

const SECTIONS = [
  { id: 'rates',      label: 'Currency rates',  icon: Coins,        desc: 'USD ↔ HTG ↔ HTD' },
  { id: 'buckets',    label: 'Buckets',         icon: Layers,       desc: 'Allocation percentages' },
  { id: 'categories', label: 'Categories',      icon: Tags,         desc: 'Income & expense categories' },
  { id: 'display',    label: 'Display',         icon: Palette,      desc: 'Theme, currency, behavior' },
  { id: 'export',     label: 'Export data',     icon: Download,     desc: 'Download as JSON or CSV' },
  { id: 'danger',     label: 'Reset local data', icon: AlertOctagon, desc: 'Re-sync from sheet', danger: true },
];

export default function Settings() {
  const open = useStore(selectSettingsOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [activeSection, setActiveSection] = useState(null);

  const close = () => {
    setSettingsOpen(false);
    setActiveSection(null);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'rates':      return <RatesEditor />;
      case 'buckets':    return <BucketEditor />;
      case 'categories': return <CategoryEditor />;
      case 'display':    return <DisplaySettings />;
      case 'export':     return <DataExport />;
      case 'danger':     return <DangerZone onDone={close} />;
      default:           return null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>

            <div className="px-5 pt-2 pb-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
                    {activeSection ? 'Settings · ' + (SECTIONS.find((s) => s.id === activeSection)?.label || '') : 'Settings'}
                  </div>
                  <h2 className="font-display text-3xl mt-0.5">
                    {activeSection ? SECTIONS.find((s) => s.id === activeSection)?.label : 'Preferences'}
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  {activeSection && (
                    <button
                      onClick={() => setActiveSection(null)}
                      className="px-3 h-8 rounded-full text-xs hover:bg-[var(--bg)] transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button onClick={close}
                    className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                {activeSection ? (
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderSection()}
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2"
                  >
                    {SECTIONS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActiveSection(s.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                            s.danger
                              ? 'border-accent-expense/20 hover:bg-accent-expense/5 text-accent-expense'
                              : 'border-transparent bg-[var(--bg)] hover:border-[var(--border)]'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            s.danger ? 'bg-accent-expense/10' : 'bg-[var(--surface)]'
                          }`}>
                            <Icon size={18} strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{s.label}</div>
                            <div className="text-[11px] text-muted">{s.desc}</div>
                          </div>
                          <ChevronRight size={16} className="text-muted shrink-0" />
                        </button>
                      );
                    })}

                    <div className="pt-4 text-[10px] text-muted text-center">
                      FinTrack · v5
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
