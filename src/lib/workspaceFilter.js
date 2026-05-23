// src/lib/workspaceFilter.js
//
// Ship 3 — Workspace UI filter
//
// Per-workspace cutoff date. When set, modules filter out rows older
// than the cutoff so users can "reset" their view after cleaning up
// old messy data. Pure UI — data on the sheet is never touched.
//
// USAGE in a module:
//   import { useWorkspaceFilter, applyDateFilter } from '../../lib/workspaceFilter';
//
//   const filter = useWorkspaceFilter('recharge');
//   const orders = useStore((s) => s.business?.rechargeOrders || []);
//   const visibleOrders = applyDateFilter(orders, filter, 'date');
//
// `filter` is `{ sinceDate: 'YYYY-MM-DD' | null, active: boolean }`.
// `applyDateFilter(list, filter, dateField)` returns the list as-is
// if no filter, else only rows whose dateField parses to >= sinceDate.
//
import { useStore } from '../store/useStore';

export function useWorkspaceFilter(workspace) {
  const filters = useStore((s) => s.business?.workspaceFilters || {});
  const sinceDate = filters[workspace]?.sinceDate || null;
  return {
    sinceDate,
    active: !!sinceDate,
  };
}

// Robust date parsing — handles ISO strings AND Excel serials
function parseAnyDate(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    // Excel serial date
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// Filter a list of records by date >= filter.sinceDate.
// If filter is inactive, returns the original list unchanged.
// If a record has no parseable date in `dateField`, it's INCLUDED
// (safer than excluding — we don't want to silently hide records
// just because their date column is wonky).
export function applyDateFilter(list, filter, dateField = 'date') {
  if (!filter?.active || !filter.sinceDate) return list || [];
  if (!Array.isArray(list)) return [];
  const cutoff = new Date(filter.sinceDate);
  cutoff.setHours(0, 0, 0, 0);
  if (isNaN(cutoff)) return list;
  return list.filter((row) => {
    const d = parseAnyDate(row?.[dateField]);
    if (!d) return true; // keep records with no parseable date
    return d >= cutoff;
  });
}

// Format the sinceDate for the subtle pill ("Since Mar 1, 2026")
export function formatFilterPill(filter) {
  if (!filter?.active || !filter.sinceDate) return '';
  try {
    const d = new Date(filter.sinceDate);
    return `Since ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return '';
  }
}
