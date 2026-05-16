// src/workspaces/personal.js
//
// Personal workspace config. This replaces the hard-coded module list
// that used to live in App.jsx. The lazy imports stay the same — we're
// just relocating the registration.
//
import { lazy } from 'react';

const Dashboard   = lazy(() => import('../modules/Dashboard'));
const Budgets     = lazy(() => import('../modules/Budgets'));
const Investments = lazy(() => import('../modules/Investments'));
const CalendarMod = lazy(() => import('../modules/CalendarView'));
const Debt        = lazy(() => import('../modules/Debt'));

export default {
  id: 'personal',
  label: 'Personal',
  sublabel: 'Finance',
  enabled: true,

  // Accent color set — used to tint header pill, active nav, and a few
  // small UI accents. Personal keeps the existing cream/ink feel — no
  // accent override needed beyond the default ink color.
  accent: {
    primary:   '#1a1a1a',   // ink
    primaryFg: '#fffaf2',   // cream
    soft:      '#7a8a8c33', // subtle wash for active pills
  },

  // Bottom-nav tabs in display order. Each `id` must match a key in
  // `modules` below. `alertKey` is consulted by BottomNav to decide
  // whether to show a red dot (e.g. unpaid debt).
  tabs: [
    { id: 'dashboard',   label: 'Home',     icon: 'LayoutGrid' },
    { id: 'budgets',     label: 'Budgets',  icon: 'Target' },
    { id: 'calendar',    label: 'Calendar', icon: 'Calendar' },
    { id: 'investments', label: 'Wealth',   icon: 'TrendingUp' },
    { id: 'debt',        label: 'Debt',     icon: 'AlertCircle', alertKey: 'totalDebtInBase' },
  ],

  modules: {
    dashboard:   Dashboard,
    budgets:     Budgets,
    investments: Investments,
    calendar:    CalendarMod,
    debt:        Debt,
  },

  // Default tab when entering this workspace
  defaultTab: 'dashboard',
};
