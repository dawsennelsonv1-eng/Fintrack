// src/components/settings/BucketEditor.jsx
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Wallet, Shield, Heart, Sparkles, Plus, Trash2, Check,
  RotateCcw, Pencil, AlertTriangle,
} from 'lucide-react';
import { useStore, selectBuckets } from '../../store/useStore';

const ICON_MAP = { TrendingUp, Wallet, Shield, Heart, Sparkles };
const ICON_OPTIONS = ['Wallet', 'TrendingUp', 'Shield', 'Heart', 'Sparkles'];
const COLOR_OPTIONS = [
  '#d4a942', '#3d8b5f', '#5b8def', '#e07a5f', '#9b59b6',
  '#c2452f', '#7a8a8c', '#2c8d9c', '#a67c5a',
];

export default function BucketEditor() {
  const buckets = useStore(selectBuckets);
  const updateBucket = useStore((s) => s.updateBucket);
  const updateBucketPercentages = useStore((s) => s.updateBucketPercentages);
  const removeBucket = useStore((s) => s.removeBucket);
  const resetBucketsToDefaults = useStore((s) => s.resetBucketsToDefaults);

  const sorted = useMemo(
    () => [...buckets].sort((a, b) => a.order - b.order),
    [buckets]
  );

  const [draft, setDraft] = useState(() =>
    Object.fromEntries(sorted.map((b) => [b.id, b.percentage]))
  );
  const [editing, setEditing] = useState(null); // bucket id being edited
  const [confirmReset, setConfirmReset] = useState(false);

  // Recompute draft if buckets list structure changes (added/removed)
  useEffect(() => {
    const next = Object.fromEntries(sorted.map((b) => [b.id, b.percentage]));
    const draftKeys = Object.keys(draft).sort().join(',');
    const nextKeys = Object.keys(next).sort().join(',');
    if (draftKeys !== nextKeys) {
      setDraft(next);
    }
  }, [sorted]);

  const total = Object.values(draft).reduce((s, v) => s + Number(v || 0), 0);
  const remainder = 100 - total;
  const dirty = sorted.some((b) => Number(draft[b.id]) !== b.percentage);

  const updateDraft = (id, value) => {
    setDraft((d) => ({ ...d, [id]: Math.max(0, Math.min(100, Number(value) || 0)) }));
  };

  const save = () => {
    updateBucketPercentages(draft);
  };

  const distributeRemainder = () => {
    if (remainder === 0) return;
    // Distribute remainder evenly across all enabled buckets
    const enabled = sorted.filter((b) => b.enabled !== false);
    if (enabled.length === 0) return;
    const perBucket = remainder / enabled.length;
    const next = { ...draft };
    enabled.forEach((b) => {
      next[b.id] = Math.max(0, Math.round((Number(draft[b.id]) + perBucket) * 100) / 100);
    });
    setDraft(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted leading-relaxed">
        Income auto-splits across these buckets. Total must equal 100%.
      </p>

      {/* Total bar */}
      <div className="surface border rounded-xl p-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">Total allocation</span>
          <span className={`text-sm num font-medium ${
            total === 100 ? 'text-accent-income' : total > 100 ? 'text-accent-expense' : ''
          }`}>
            {total.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden flex">
          {sorted.map((b) => {
            const pct = Number(draft[b.id]) || 0;
            return (
              <div
                key={b.id}
                style={{ width: `${pct}%`, backgroundColor: b.color }}
                className="h-full transition-all"
              />
            );
          })}
        </div>
        {remainder !== 0 && (
          <button
            onClick={distributeRemainder}
            className="mt-2 text-[11px] text-muted hover:text-[var(--text)] underline underline-offset-2"
          >
            Distribute {remainder > 0 ? '+' : ''}{remainder.toFixed(1)}% evenly
          </button>
        )}
      </div>

      {/* Bucket rows */}
      <div className="space-y-2">
        {sorted.map((bucket) => (
          <BucketRow
            key={bucket.id}
            bucket={bucket}
            value={draft[bucket.id] || 0}
            onValueChange={(v) => updateDraft(bucket.id, v)}
            onEdit={() => setEditing(bucket.id)}
            isEditing={editing === bucket.id}
            onCloseEdit={() => setEditing(null)}
            onUpdate={(patch) => { updateBucket(bucket.id, patch); setEditing(null); }}
            onRemove={() => { removeBucket(bucket.id); setEditing(null); }}
            canRemove={sorted.length > 1}
          />
        ))}
      </div>

      {/* Save / Reset row */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={() => setConfirmReset(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium"
        >
          <RotateCcw size={14} />
          Reset defaults
        </button>
        <motion.button
          onClick={save}
          disabled={!dirty || total !== 100}
          whileTap={{ scale: 0.98 }}
          className="py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40"
        >
          Save percentages
        </motion.button>
      </div>

      {total !== 100 && dirty && (
        <div className="text-[11px] text-accent-expense flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>Total must equal exactly 100% to save.</span>
        </div>
      )}

      <AnimatePresence>
        {confirmReset && (
          <ConfirmDialog
            title="Reset to Carter NBA defaults?"
            body="This deletes all your custom buckets and re-creates the original 5: War Chest 50%, Operations 30%, Reserve 10%, Giving 5%, Baller 5%."
            confirmLabel="Reset"
            danger
            onCancel={() => setConfirmReset(false)}
            onConfirm={() => { resetBucketsToDefaults(); setConfirmReset(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BucketRow({ bucket, value, onValueChange, isEditing, onEdit, onCloseEdit, onUpdate, onRemove, canRemove }) {
  const Icon = ICON_MAP[bucket.icon] || Wallet;
  return (
    <motion.div layout className="surface border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
        >
          <Icon size={17} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-medium truncate">{bucket.name}</span>
            <div className="flex items-baseline gap-1 shrink-0">
              <input
                type="number" inputMode="decimal" step="0.5" min="0" max="100"
                value={value} onChange={(e) => onValueChange(e.target.value)}
                className="w-12 bg-[var(--bg)] outline-none rounded px-1.5 py-0.5 num text-right text-sm"
              />
              <span className="text-[11px] text-muted">%</span>
            </div>
          </div>
          <input
            type="range" min="0" max="100" step="0.5"
            value={value} onChange={(e) => onValueChange(e.target.value)}
            className="w-full h-1 accent-[var(--text)]"
            style={{ accentColor: bucket.color }}
          />
        </div>
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center shrink-0"
        >
          <Pencil size={13} />
        </button>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <BucketEditPanel
              bucket={bucket}
              onCancel={onCloseEdit}
              onSave={onUpdate}
              onRemove={canRemove ? onRemove : null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BucketEditPanel({ bucket, onCancel, onSave, onRemove }) {
  const [name, setName] = useState(bucket.name);
  const [icon, setIcon] = useState(bucket.icon);
  const [color, setColor] = useState(bucket.color);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="p-3 space-y-3 bg-[var(--bg)]/40">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Name</div>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm"
        />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Icon</div>
        <div className="grid grid-cols-5 gap-1.5">
          {ICON_OPTIONS.map((iconName) => {
            const I = ICON_MAP[iconName];
            const selected = icon === iconName;
            return (
              <button
                key={iconName} type="button" onClick={() => setIcon(iconName)}
                className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                  selected ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'bg-[var(--bg)]'
                }`}
              >
                <I size={16} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Color</div>
        <div className="grid grid-cols-9 gap-1.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c} type="button" onClick={() => setColor(c)}
              className={`aspect-square rounded-lg transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--text)]' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {!confirmDelete ? (
        <div className="flex gap-2 pt-1">
          {onRemove && (
            <button
              type="button" onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-lg hover:bg-accent-expense/10 text-accent-expense transition-colors flex items-center gap-1.5 text-xs"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button" onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-[var(--surface)] text-xs"
          >
            Cancel
          </button>
          <button
            type="button" onClick={() => onSave({ name, icon, color })}
            disabled={!name.trim()}
            className="px-3 py-2 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex gap-2 pt-1">
          <span className="text-[11px] text-muted flex-1 self-center">Delete this bucket?</span>
          <button
            type="button" onClick={() => setConfirmDelete(false)}
            className="px-3 py-2 rounded-lg bg-[var(--surface)] text-xs"
          >
            Cancel
          </button>
          <button
            type="button" onClick={onRemove}
            className="px-3 py-2 rounded-lg bg-accent-expense text-white text-xs font-medium"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, danger, onCancel, onConfirm }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm surface border rounded-2xl p-5"
      >
        <h3 className="font-display text-xl mb-1">{title}</h3>
        <p className="text-[13px] text-muted mb-4">{body}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="py-3 rounded-xl bg-[var(--bg)] text-sm font-medium">Cancel</button>
          <button
            onClick={onConfirm}
            className={`py-3 rounded-xl text-sm font-medium text-white ${
              danger ? 'bg-accent-expense' : 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
