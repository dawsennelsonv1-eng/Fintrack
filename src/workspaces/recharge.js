// src/workspaces/recharge.js
// Ship 3 — adds Ads module to Recharge workspace.
//
import { lazy } from 'react';

const Home       = lazy(() => import('../modules/recharge/Home'));
const Calendar   = lazy(() => import('../modules/recharge/CalendarView'));
const Orders     = lazy(() => import('../modules/recharge/Orders'));
const ClientsRC  = lazy(() => import('../modules/recharge/Clients'));
const Ads        = lazy(() => import('../modules/recharge/Ads'));
const Financials = lazy(() => import('../modules/recharge/Financials'));

export const rechargeWorkspace = {
  id: 'recharge',
  label: 'AVS Recharge',
  shortLabel: 'Recharge',
  accent: {
    primary:   '#2D4F7C',
    primaryFg: '#ffffff',
    soft:      '#2D4F7C15',
  },
  defaultTab: 'home',
  modules: {
    home:        Home,
    calendar:    Calendar,
    orders:      Orders,
    clients:     ClientsRC,
    ads:         Ads,
    financials:  Financials,
  },
  tabs: [
    { id: 'home',       label: 'Home',     icon: 'Home' },
    { id: 'calendar',   label: 'Calendar', icon: 'Calendar' },
    { id: 'orders',     label: 'Orders',   icon: 'List' },
    { id: 'clients',    label: 'Clients',  icon: 'Users' },
    { id: 'ads',        label: 'Ads',      icon: 'Megaphone' },
    { id: 'financials', label: 'Finances', icon: 'PieChart' },
  ],

  orderStatuses: [
    { id: 'pending',  label: 'En Attente', color: '#d4a942' },
    { id: 'termine',  label: 'Terminé',    color: '#3d8b5f' },
  ],
};
