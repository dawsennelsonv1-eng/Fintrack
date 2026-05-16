// src/workspaces/avs.js
//
// AVS Solution HT workspace config — cards business.
//
// Bottom nav (5 tabs, mobile-optimized):
//   • Home       — graphs, KPIs, conversion funnel
//   • Clients    — merged leads + clients (filter by status)
//   • Calendar   — RDV schedule
//   • Ads        — campaign spend, ROAS, lead source attribution
//   • Financials — debts owed/receivable, expenses, salaries, P&L, full history
//
// History is a TAB inside Financials, not a top-level nav.
// Debt is a TAB inside Financials, not a top-level nav.
//
import { lazy } from 'react';

const AvsDashboard  = lazy(() => import('../modules/avs/Dashboard'));
const AvsClients    = lazy(() => import('../modules/avs/Clients'));
const AvsCalendar   = lazy(() => import('../modules/avs/CalendarView'));
const AvsAds        = lazy(() => import('../modules/avs/Ads'));
const AvsFinancials = lazy(() => import('../modules/avs/Financials'));

export default {
  id: 'avs',
  label: 'AVS Solution HT',
  sublabel: 'Cards · Business',
  enabled: true,

  // Deep forest green — reads as serious money, pairs cleanly with
  // cream/ink. Used in:
  //   • header workspace pill (background)
  //   • active bottom-nav tab indicator
  //   • accent dots, focus rings, "active" highlights inside AVS modules
  accent: {
    primary:   '#2D5F4F',   // forest green
    primaryFg: '#fffaf2',   // cream
    soft:      '#2D5F4F22', // 13% alpha for subtle washes
  },

  tabs: [
    { id: 'dashboard',  label: 'Home',       icon: 'LayoutGrid' },
    { id: 'clients',    label: 'Clients',    icon: 'Users' },
    { id: 'calendar',   label: 'Calendar',   icon: 'Calendar' },
    { id: 'ads',        label: 'Ads',        icon: 'Megaphone' },
    { id: 'financials', label: 'Finances',   icon: 'Wallet' },
  ],

  modules: {
    dashboard:  AvsDashboard,
    clients:    AvsClients,
    calendar:   AvsCalendar,
    ads:        AvsAds,
    financials: AvsFinancials,
  },

  defaultTab: 'dashboard',

  // ─── Canonical status enums for cards funnel ──────────────
  //
  // These match the existing Google Sheet exactly. The kanban in
  // Clients module (Tier 5c) renders columns in this order.
  //
  leadStatuses: [
    { id: 'todo',        label: '🔴 À Faire',       color: '#c2452f' },
    { id: 'rdv',         label: '📅 Rdv Fixé',      color: '#5b8def' },
    { id: 'atelier',     label: '🟡 Envoi Atelier', color: '#d4a942' },
    { id: 'terminé',     label: '✅ Terminé',        color: '#3d8b5f' },
    { id: 'perdu',       label: '❌ Perdu',          color: '#7a8a8c' },
  ],

  opsStatuses: [
    { id: 'todo',  label: '🔴 À Faire',   color: '#c2452f' },
    { id: 'doing', label: '🟡 En Cours',  color: '#d4a942' },
    { id: 'done',  label: '✅ Fait',       color: '#3d8b5f' },
  ],

  // Card types observed in the data
  cardTypes: ['Meru', 'Other'],

  // Pack options observed in the data
  packOptions: ['Physique', 'Virtuel', 'Physique + Virtuel'],

  // Staff roles for AVS (used by commissions module in 5f)
  staffRoles: ['Sales', 'Ops', 'Admin'],

  // Default staff seed — matches your team
  defaultStaff: [
    { name: 'Marc',      role: 'Ops',   commissionType: 'per_card' },
    { name: 'Jémima',    role: 'Sales', commissionType: 'per_card' },
    { name: 'Christelle', role: 'Sales', commissionType: 'per_card' },
    { name: 'Dawsen',    role: 'Admin', commissionType: 'salary' },
  ],
};
