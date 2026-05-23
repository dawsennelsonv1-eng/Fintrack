// src/modules/recharge/Orders.jsx
//
// Recharge orders monitoring view. Marc manages status in his own app;
// this is your read view with filters and search. You CAN manually
// flip a status (e.g. to backfill) — that fires Marc's commission.
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Zap, AlertTriangle, ArrowLeft, Check, Clock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import { parseDate, isTermine } from './useRechargeData';
import { useAvsCurrency } from '../avs/useAvsCurrency';
import { useWorkspaceFilter, applyDateFilter } from '../../lib/workspaceFilter';
import FilterPill from '../../components/FilterPill';

const ws = () => getWorkspace('recharge');

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'pending',  label: 'En attente' },
  { id: 'termine',  label: 'Terminé' },
  { id: 'loss',     label: 'Loss orders' },
];

function fmtDate(s) {
  const d = parseDate(s);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function RechargeOrders() {
  const allOrders = useStore((s) => s.business?.rechargeOrders || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const orders = useMemo(() => applyDateFilter(allOrders, wsFilter, 'date'), [allOrders, wsFilter]);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (filter === 'pending' && isTermine(o)) return false;
        if (filter === 'termine' && !isTermine(o)) return false;
        if (filter === 'loss' && (!isTermine(o) || (Number(o.profit) || 0) >= 0)) return false;
        if (!q) return true;
        return (
          String(o.client || '').toLowerCase().includes(q) ||
          String(o.tagInfo || '').toLowerCase().includes(q) ||
          String(o.platform || '').toLowerCase().includes(q) ||
          String(o.supplierName || '').toLowerCase().includes(q) ||
          String(o.id || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = parseDate(a.date); const db = parseDate(b.date);
        return (db || 0) - (da || 0);
      });
  }, [orders, filter, search]);

  const openOrder = orders.find((o) => o.id === openId);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl leading-tight">Orders</h1>
          <FilterPill filter={wsFilter} />
        </div>
        <p className="text-xs text-muted mt-0.5">Marc manages from his app · this is your read view</p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, tag, platform..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl surface border text-sm focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
            <X size={12} className="text-muted" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="overflow-x-auto -mx-1 px-1 mb-4">
        <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                filter === f.id ? '' : 'surface border text-muted'
              }`}
              style={filter === f.id
                ? { backgroundColor: accent.primary, color: accent.primaryFg }
                : undefined}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
        {filtered.length} {filtered.length === 1 ? 'order' : 'orders'}
      </div>

      {filtered.length === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <div className="text-sm text-muted">No orders match</div>
        </div>
      ) : (
        <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {filtered.slice(0, 100).map((o) => (
            <OrderRow key={o.id} order={o} fmt={fmtCompact}
              onTap={() => setOpenId(o.id)} accent={accent} />
          ))}
          {filtered.length > 100 && (
            <div className="px-3 py-2 text-[11px] text-muted text-center">
              Showing first 100 · refine search to see more
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {openOrder && (
          <OrderDetail order={openOrder} onClose={() => setOpenId(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}

function OrderRow({ order, fmt, onTap, accent }) {
  const done = isTermine(order);
  const profit = Number(order.profit) || 0;
  const isLoss = done && profit < 0;
  return (
    <button onClick={onTap}
      className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isLoss ? '#c2452f22' : done ? '#3d8b5f22' : '#d4a94222',
          color: isLoss ? '#c2452f' : done ? '#3d8b5f' : '#d4a942',
        }}>
        {isLoss ? <AlertTriangle size={13} /> : done ? <Check size={13} /> : <Clock size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {order.client || order.tagInfo || '(no name)'}
        </div>
        <div className="text-[11px] text-muted truncate">
          {fmtDate(order.date)}
          {order.platform && <> · {order.platform}</>}
          {order.speed && <> · {String(order.speed).replace(/\s*\([^)]*\)/, '')}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-sm leading-tight">
          {fmt(order.amountHtg || 0, 'HTG')}
        </div>
        {done && (
          <div className="text-[10px]" style={{ color: profit >= 0 ? '#3d8b5f' : '#c2452f' }}>
            {profit >= 0 ? '+' : ''}{fmt(profit, 'HTG')}
          </div>
        )}
      </div>
    </button>
  );
}

function OrderDetail({ order, onClose }) {
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const updateRechargeOrderStatus = useStore((s) => s.updateRechargeOrderStatus);
  const done = isTermine(order);

  const flipStatus = () => {
    const newStatus = done ? 'En Attente' : 'Terminé';
    if (!confirm(`Mark this order as ${newStatus}? Marc handles this in his app — only flip here for corrections.`)) return;
    updateRechargeOrderStatus(order.id, newStatus);
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-50" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col">
        <div className="surface border-t rounded-t-3xl flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">{order.client || order.tagInfo || 'Order'}</div>
            <div className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <DetailRow label="Order ID" value={order.id} />
            <DetailRow label="Date" value={fmtDate(order.date)} />
            <DetailRow label="Status" value={done ? '✅ Terminé' : '⏳ En Attente'} />
            <DetailRow label="Client" value={order.client} />
            <DetailRow label="Tag" value={order.tagInfo} />
            <DetailRow label="WhatsApp" value={order.whatsapp} />
            <DetailRow label="Service" value={order.service} />
            <DetailRow label="Platform" value={order.platform} />
            <DetailRow label="Speed" value={order.speed} />
            <DetailRow label="Email" value={order.email} />
            <hr className="border-[var(--border)]" />
            <DetailRow label="Amount" value={`${fmtCompact(order.amountHtg || 0, 'HTG')}${order.amountUsd ? ' · $' + order.amountUsd + ' USD' : ''}`} />
            <DetailRow label="Fees" value={order.fees ? fmtCompact(order.fees, 'HTG') : '—'} />
            <DetailRow label="Payment" value={order.paymentMethod} />
            <DetailRow label="Promo" value={order.promoCode} />
            <hr className="border-[var(--border)]" />
            <DetailRow label="Supplier" value={order.supplierName} />
            <DetailRow label="Supplier fee" value={order.supplierFee ? fmtCompact(order.supplierFee, 'HTG') : '—'} />
            <DetailRow label="Profit"
              value={order.profit != null ? `${Number(order.profit) >= 0 ? '+' : ''}${fmtCompact(order.profit, 'HTG')}` : '—'}
              valueColor={order.profit == null ? undefined : Number(order.profit) >= 0 ? '#3d8b5f' : '#c2452f'} />
            {order.notes && (
              <>
                <hr className="border-[var(--border)]" />
                <DetailRow label="Notes" value={order.notes} />
              </>
            )}

            <button onClick={flipStatus}
              className="w-full mt-4 py-3 rounded-xl border text-sm flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--border)', color: accent.primary }}>
              Mark as {done ? 'En Attente' : 'Terminé'}
            </button>

            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function DetailRow({ label, value, valueColor }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-[11px] text-muted w-24 shrink-0">{label}</div>
      <div className="text-sm flex-1 min-w-0 break-words" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  );
}
