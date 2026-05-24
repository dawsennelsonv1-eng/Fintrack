// src/components/settings/WorkspaceFilterSettings.jsx
//
// Ship 3 — Workspace filter section for the Settings panel.
// Lives inside the settings sub-folder alongside other section components
// (RatesEditor, BucketEditor, etc.) and is rendered as a section by
// Settings.jsx via its SECTIONS map.
//
// Per-workspace cutoff date for AVS Solution HT and AVS Recharge.
// Shows confirmation modal when applying or removing.
// Pure UI filter — never deletes data.
//
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, X, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';

const WORKSPACES = [
  { id: 'avs',      label: 'AVS Solution HT', accent: '#2D5F4F' },
  { id: 'recharge', label: 'AVS Recharge',    accent: '#2D4F7C' },
];

export default function WorkspaceFilterSettings() {
  const filters = useStore((s) => s.business?.workspaceFilters || {});
  const setFilter = useStore((s) => s.setWorkspaceFilter);
  const clearFilter = useStore((s) => s.clearWorkspaceFilter);

  // Modal state: { mode: 'apply' | 'remove', workspace, pendingDate }
  const [modal, setModal] = useState(null);

  const handleDateChange = (workspace, newDate) => {
    if (!newDate) {
      setModal({ mode: 'remove', workspace, pendingDate: null });
    } else {
      setModal({ mode: 'apply', workspace, pendingDate: newDate });
    }
  };

  const confirmApply = () => {
    if (modal?.workspace && modal?.pendingDate) {
      setFilter(modal.workspace, modal.pendingDate);
    }
    setModal(null);
  };

  const confirmRemove = () => {
    if (modal?.workspace) {
      clearFilter(modal.workspace);
    }
    setModal(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted leading-relaxed px-1">
        Show only data from a date forward. Data on the sheet is never touched — you can remove the filter anytime.
      </p>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        {WORKSPACES.map((ws) => {
          const sinceDate = filters[ws.id]?.sinceDate || '';
          return (
            <div key={ws.id} className="px-3 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ws.accent }}
                />
                <div className="text-sm font-medium flex-1">{ws.label}</div>
                {sinceDate && (
                  <button
                    onClick={() => handleDateChange(ws.id, '')}
                    className="text-[10px] text-muted hover:text-[var(--text)] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-muted shrink-0" />
                <input
                  type="date"
                  value={sinceDate}
                  onChange={(e) => handleDateChange(ws.id, e.target.value)}
                  className="flex-1 form-input text-xs py-1.5"
                  placeholder="No filter"
                />
              </div>
              <div className="text-[10px] text-muted mt-1.5">
                {sinceDate
                  ? `Showing data from this date onward.`
                  : `Showing all data.`}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {modal && (
          <ConfirmModal
            modal={modal}
            onCancel={() => setModal(null)}
            onConfirm={modal.mode === 'apply' ? confirmApply : confirmRemove}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmModal({ modal, onCancel, onConfirm }) {
  const wsLabel = WORKSPACES.find((w) => w.id === modal.workspace)?.label || 'this workspace';
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 z-[60]"
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] max-w-md mx-auto"
      >
        <div className="surface border rounded-3xl p-5 shadow-2xl">
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}
            >
              <AlertTriangle size={16} />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg leading-tight">
                {modal.mode === 'apply' ? 'Apply filter?' : 'Remove filter?'}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg)]"
            >
              <X size={14} />
            </button>
          </div>

          {modal.mode === 'apply' ? (
            <div className="text-xs text-muted leading-relaxed mb-4 space-y-2">
              <p>
                {wsLabel} will show only data from{' '}
                <span className="text-[var(--text)] font-medium">
                  {new Date(modal.pendingDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>{' '}
                onward. Older data stays in the sheet — you can remove this filter anytime to see everything again.
              </p>
              <p className="pt-1 border-t border-[var(--border)]">
                <span className="text-[var(--text)] font-medium">Note:</span>{' '}
                ROAS attribution depends on this filter for Recharge. Older clients won't have a Tag.
              </p>
            </div>
          ) : (
            <div className="text-xs text-muted leading-relaxed mb-4">
              Remove date filter for {wsLabel}? All data — including older entries without Tags — will show again.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{
                backgroundColor: modal.mode === 'apply' ? '#2D4F7C' : '#c2452f',
                color: '#fff',
              }}
            >
              {modal.mode === 'apply' ? 'Apply filter' : 'Remove filter'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
