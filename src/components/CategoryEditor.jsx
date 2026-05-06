// src/components/settings/CategoryEditor.jsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Pencil, ChevronUp, ChevronDown, Check, X,
  ArrowDownLeft, ArrowUpRight, EyeOff, Eye,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useStore, selectCategories, selectBuckets } from '../../store/useStore';

// A reasonable curated set of icons that look good in our context
const ICON_OPTIONS = [
  'UtensilsCrossed', 'Coffee', 'Pizza', 'Wine', 'Apple',
  'Car', 'Bus', 'Plane', 'Bike', 'Fuel',
  'Home', 'Building', 'Hotel', 'Tent',
  'Heart', 'Stethoscope', 'Pill', 'Activity',
  'CreditCard', 'Banknote', 'Receipt', 'Wallet',
  'ShoppingBag', 'ShoppingCart', 'Package', 'Gift',
  'BookOpen', 'GraduationCap', 'Briefcase', 'Laptop',
  'Sparkles', 'Music', 'Gamepad2', 'Film',
  'Smartphone', 'Wifi', 'Zap', 'Droplets',
  'TrendingUp', 'PiggyBank', 'DollarSign', 'Coins',
  'Tag', 'Flag', 'Star', 'MoreHorizontal',
];

const COLOR_OPTIONS = [
  '#e07a5f', '#5b8def', '#a67c5a', '#c2452f', '#7a8a8c',
  '#9b59b6', '#d4a942', '#3d8b5f', '#2c8d9c', '#9aa3ad',
];

export default function CategoryEditor() {
  const categories = useStore(selectCategories);
  const buckets = useStore(selectBuckets);
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const reorderCategories = useStore((s) => s.reorderCategories);

  const [activeType, setActiveType] = useState('expense');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const filtered = useMemo(
    () => categories
      .filter((c) => c.type === activeType)
      .sort((a, b) => a.order - b.order),
    [categories, activeType]
  );

  const moveCategory = (id, direction) => {
    const idx = filtered.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= filtered.length) return;
    const reordered = [...filtered];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderCategories(reordered.map((c) => c.id));
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted leading-relaxed">
        Categories organize your transactions and route them to buckets. Disable a category to hide it from the picker without losing history.
      </p>

      {/* Type tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
        <button
          onClick={() => { setActiveType('expense'); setAdding(false); setEditingId(null); }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeType === 'expense' ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
          }`}
        >
          <ArrowUpRight size={13} /> Expense
        </button>
        <button
          onClick={() => { setActiveType('income'); setAdding(false); setEditingId(null); }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeType === 'income' ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
          }`}
        >
          <ArrowDownLeft size={13} /> Income
        </button>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {filtered.map((cat, i) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            buckets={buckets}
            isFirst={i === 0}
            isLast={i === filtered.length - 1}
            isEditing={editingId === cat.id}
            onEdit={() => { setEditingId(cat.id); setAdding(false); }}
            onCloseEdit={() => setEditingId(null)}
            onSave={(patch) => { updateCategory(cat.id, patch); setEditingId(null); }}
            onRemove={() => { removeCategory(cat.id); setEditingId(null); }}
            onToggle={() => updateCategory(cat.id, { enabled: cat.enabled === false })}
            onMoveUp={() => moveCategory(cat.id, 'up')}
            onMoveDown={() => moveCategory(cat.id, 'down')}
          />
        ))}
      </div>

      {/* Add */}
      <AnimatePresence mode="wait">
        {!adding ? (
          <motion.button
            key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium"
          >
            <Plus size={15} /> Add a category
          </motion.button>
        ) : (
          <NewCategoryForm
            key="form"
            type={activeType}
            buckets={buckets}
            onSave={(data) => { addCategory(data); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryRow({ category, buckets, isFirst, isLast, isEditing, onEdit, onCloseEdit, onSave, onRemove, onToggle, onMoveUp, onMoveDown }) {
  const Icon = Icons[category.icon] || Icons.Tag;
  const dimmed = category.enabled === false;
  const linkedBucket = buckets.find((b) => b.key === category.bucketKey);

  return (
    <motion.div layout className={`surface border rounded-xl overflow-hidden ${dimmed ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2.5 p-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${category.color}1f`, color: category.color }}
        >
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{category.name}</div>
          {linkedBucket && (
            <div className="text-[10px] text-muted truncate">→ {linkedBucket.name}</div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={isFirst}
            className="w-6 h-5 rounded hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-20">
            <ChevronUp size={11} />
          </button>
          <button onClick={onMoveDown} disabled={isLast}
            className="w-6 h-5 rounded hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-20">
            <ChevronDown size={11} />
          </button>
        </div>
        <button onClick={onToggle}
          className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center shrink-0">
          {dimmed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={onEdit}
          className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center shrink-0">
          <Pencil size={13} />
        </button>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <CategoryEditPanel
              category={category}
              buckets={buckets}
              onCancel={onCloseEdit}
              onSave={onSave}
              onRemove={onRemove}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CategoryEditPanel({ category, buckets, onCancel, onSave, onRemove }) {
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);
  const [bucketKey, setBucketKey] = useState(category.bucketKey || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="p-3 space-y-3 bg-[var(--bg)]/40">
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Category name"
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm"
      />

      <IconPicker selected={icon} onSelect={setIcon} />

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Color</div>
        <div className="grid grid-cols-10 gap-1.5">
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

      {category.type === 'expense' && buckets.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Routes to bucket</div>
          <div className="grid grid-cols-2 gap-1.5">
            {buckets.sort((a, b) => a.order - b.order).map((b) => {
              const selected = bucketKey === b.key;
              return (
                <button
                  key={b.id} type="button" onClick={() => setBucketKey(b.key)}
                  className={`px-2 py-2 rounded-lg text-xs text-left flex items-center gap-1.5 transition-all ${
                    selected ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'bg-[var(--bg)]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="truncate">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!confirmDelete ? (
        <div className="flex gap-2 pt-1">
          <button
            type="button" onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-lg hover:bg-accent-expense/10 text-accent-expense transition-colors flex items-center gap-1.5 text-xs"
          >
            <Trash2 size={12} /> Delete
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-[var(--surface)] text-xs">
            Cancel
          </button>
          <button
            type="button" onClick={() => onSave({ name: name.trim(), icon, color, bucketKey })}
            disabled={!name.trim()}
            className="px-3 py-2 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium disabled:opacity-40"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex gap-2 items-center pt-1">
          <span className="text-[11px] text-muted flex-1">Existing transactions keep this category name.</span>
          <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg bg-[var(--surface)] text-xs">Cancel</button>
          <button type="button" onClick={onRemove} className="px-3 py-2 rounded-lg bg-accent-expense text-white text-xs font-medium">Delete</button>
        </div>
      )}
    </div>
  );
}

function NewCategoryForm({ type, buckets, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [bucketKey, setBucketKey] = useState(type === 'expense' ? (buckets[0]?.key || '') : '');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(), type, icon, color, bucketKey,
    });
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="surface border rounded-xl p-4 space-y-3">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
          placeholder="Category name (e.g., Coffee)"
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] outline-none text-sm"
        />

        <IconPicker selected={icon} onSelect={setIcon} />

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Color</div>
          <div className="grid grid-cols-10 gap-1.5">
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

        {type === 'expense' && buckets.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Routes to bucket</div>
            <div className="grid grid-cols-2 gap-1.5">
              {buckets.sort((a, b) => a.order - b.order).map((b) => {
                const selected = bucketKey === b.key;
                return (
                  <button
                    key={b.id} type="button" onClick={() => setBucketKey(b.key)}
                    className={`px-2 py-2 rounded-lg text-xs text-left flex items-center gap-1.5 transition-all ${
                      selected ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'bg-[var(--bg)]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="truncate">{b.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="py-2.5 rounded-lg bg-[var(--bg)] text-sm font-medium">Cancel</button>
          <button type="submit" disabled={!name.trim()}
            className="py-2.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
            Add category
          </button>
        </div>
      </div>
    </motion.form>
  );
}

function IconPicker({ selected, onSelect }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Icon</div>
      <div className="grid grid-cols-10 gap-1 max-h-40 overflow-y-auto no-scrollbar">
        {ICON_OPTIONS.map((iconName) => {
          const I = Icons[iconName] || Icons.Tag;
          const isSelected = selected === iconName;
          return (
            <button
              key={iconName} type="button" onClick={() => onSelect(iconName)}
              className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                isSelected ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900' : 'bg-[var(--bg)] hover:bg-[var(--border)]'
              }`}
            >
              <I size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
