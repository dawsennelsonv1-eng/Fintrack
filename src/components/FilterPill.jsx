// src/components/FilterPill.jsx
//
// Ship 3 — Subtle filter indicator
//
// Renders a small muted pill near a module's title, e.g.
// "Since Mar 1, 2026". Reads like a date label, not a warning.
// Tappable → opens Settings (where the filter can be edited or removed).
//
// USAGE:
//   import FilterPill from '../../components/FilterPill';
//   import { useWorkspaceFilter } from '../../lib/workspaceFilter';
//   const filter = useWorkspaceFilter('recharge');
//   <FilterPill filter={filter} />     // renders null if filter inactive
//
import { Calendar } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function FilterPill({ filter, className = '' }) {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  if (!filter?.active) return null;
  const label = formatPillLabel(filter);
  if (!label) return null;
  return (
    <button
      onClick={() => setSettingsOpen && setSettingsOpen(true)}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-muted hover:bg-[var(--bg)] transition-colors ${className}`}
      style={{ opacity: 0.6 }}
      aria-label="Date filter active. Tap to manage in Settings."
    >
      <Calendar size={9} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}

function formatPillLabel(filter) {
  if (!filter?.sinceDate) return '';
  try {
    const d = new Date(filter.sinceDate);
    if (isNaN(d)) return '';
    return `Since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return '';
  }
}
