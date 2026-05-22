// src/workspaces/recharge.js
// AVS Recharge workspace — third workspace, monitoring-focused
//
// Marc runs the orders in his own app. This is YOUR view:
//   • Daily/weekly/monthly benefits with period toggle
//   • Calendar nav (like AVS)
//   • Orders (monitoring + filter, can manually flip status if needed)
//   • Clients (analytics — most benefits, most orders, most frequent)
//   • Financials (P&L, benefits vs expenses chart, Marc commissions, CEO payouts)
//
import { lazy } from 'react';

const Home       = lazy(() => import('../modules/recharge/Home'));
const Calendar   = lazy(() => import('../modules/recharge/CalendarView'));
const Orders     = lazy(() => import('../modules/recharge/Orders'));
const ClientsRC  = lazy(() => import('../modules/recharge/Clients'));
const Financials = lazy(() => import('../modules/recharge/Financials'));

export const rechargeWorkspace = {
  id: 'recharge',
  label: 'AVS Recharge',
  shortLabel: 'Recharge',
  accent: {
    primary:   '#2D4F7C',   // deep blue
    primaryFg: '#ffffff',
    soft:      '#2D4F7C15',
  },
  defaultTab: 'home',
  modules: {
    home:        Home,
    calendar:    Calendar,
    orders:      Orders,
    clients:     ClientsRC,
    financials:  Financials,
  },
  tabs: [
    { id: 'home',       label: 'Home',     icon: 'Home' },
    { id: 'calendar',   label: 'Calendar', icon: 'Calendar' },
    { id: 'orders',     label: 'Orders',   icon: 'List' },
    { id: 'clients',    label: 'Clients',  icon: 'Users' },
    { id: 'financials', label: 'Finances', icon: 'PieChart' },
  ],

  // Order statuses — match WEB_INCOMING reality
  orderStatuses: [
    { id: 'pending',  label: 'En Attente', color: '#d4a942' },
    { id: 'termine',  label: 'Terminé',    color: '#3d8b5f' },
  ],
};
