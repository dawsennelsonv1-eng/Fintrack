// src/components/FilterPill.jsx
//
// Ship 3 — Subtle filter indicator
//
// Renders a small muted pill at the top of a filtered module, e.g.
// "Since Mar 1, 2026". Reads like a date label, not a warning.
// Tappable to open Settings.
//
// USAGE:
//   import FilterPill from '../../components/FilterPill';
//   import { useWorkspaceFilter } from '../../lib/workspaceFilter';
//   ...
//   const filter = useWorkspaceFilter('recharge');
//   <FilterPill filter={filter} />     // null if no filter active
//
import { Calendar } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatFilterPill } from '../lib/workspaceFilter';

export default function FilterPill({ filter, className = '' }) {
  const openSettings = useStore((s) => s.openSettings);
  if (!filter?.active) return null;
  const label = formatFilterPill(filter);
  if (!label) return null;
  return (
    <button
      onClick={() => openSettings && openSettings()}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-muted hover:bg-[var(--bg)] transition-colors ${className}`}
      style={{ opacity: 0.6 }}
      aria-label="Date filter is active. Tap to manage in Settings."
    >
      <Calendar size={9} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
