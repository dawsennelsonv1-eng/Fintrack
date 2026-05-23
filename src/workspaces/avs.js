// src/workspaces/avs.js
//
// Ship 3 — Kanban column order updated, default view = list (Table).
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

  accent: {
    primary:   '#2D5F4F',
    primaryFg: '#fffaf2',
    soft:      '#2D5F4F22',
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

  // Default view for Clients module — 'list' (Table) or 'kanban'
  defaultClientsView: 'list',

  // Kanban column order: Terminé → Envoi Atelier → Rdv Fixé → À Faire → Perdu
  leadStatuses: [
    { id: 'terminé',     label: '✅ Terminé',        color: '#3d8b5f' },
    { id: 'atelier',     label: '🟡 Envoi Atelier', color: '#d4a942' },
    { id: 'rdv',         label: '📅 Rdv Fixé',      color: '#5b8def' },
    { id: 'todo',        label: '🔴 À Faire',       color: '#c2452f' },
    { id: 'perdu',       label: '❌ Perdu',          color: '#7a8a8c' },
  ],

  opsStatuses: [
    { id: 'todo',  label: '🔴 À Faire',   color: '#c2452f' },
    { id: 'doing', label: '🟡 En Cours',  color: '#d4a942' },
    { id: 'done',  label: '✅ Fait',       color: '#3d8b5f' },
  ],

  cardTypes: ['Meru', 'Other'],

  packOptions: ['Physique', 'Virtuel', 'Physique + Virtuel'],

  staffRoles: ['Sales', 'Ops', 'Content', 'Admin'],

  defaultStaff: [
    { name: 'Marc',       role: 'Ops',     commissionType: 'per_card' },
    { name: 'Jémima',     role: 'Sales',   commissionType: 'biweekly' },
    { name: 'Christelle', role: 'Sales',   commissionType: 'biweekly' },
    { name: 'Sarah',      role: 'Content', commissionType: 'monthly'  },
    { name: 'Dawsen',     role: 'Admin',   commissionType: 'owner'    },
  ],
};
