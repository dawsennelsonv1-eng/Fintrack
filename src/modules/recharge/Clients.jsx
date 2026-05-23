// src/modules/recharge/Clients.jsx
//
// Client analytics for Recharge — aggregated per client (keyed by tagInfo).
// Three sort modes:
//   • Benefits — who makes us the most money
//   • Orders   — who reloads the most often (count)
//   • Frequency — who reloads most regularly (lowest avg days between)
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ArrowLeft, TrendingUp, Hash, Calendar as CalIcon,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import { clientAnalytics, isTermine } from './useRechargeData';
import { useAvsCurrency } from '../avs/useAvsCurrency';
import { useWorkspaceFilter, applyDateFilter } from '../../lib/workspaceFilter';
import FilterPill from '../../components/FilterPill';

const ws = () => getWorkspace('recharge');

const SORT_MODES = [
  { id: 'benefits',  label: 'Benefits',  icon: TrendingUp, hint: 'Most $ to us' },
  { id: 'orders',    label: 'Orders',    icon: Hash,       hint: 'Most reloads' },
  { id: 'frequency', label: 'Frequency', icon: CalIcon,    hint: 'Most regular' },
];

function fmtDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function RechargeClients() {
  const allOrders = useStore((s) => s.business?.rechargeOrders || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const orders = useMemo(() => applyDateFilter(allOrders, wsFilter, 'date'), [allOrders, wsFilter]);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const [sortMode, setSortMode] = useState('benefits');
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const allClients = useMemo(() => clientAnalytics(orders), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? allClients.filter((c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.tagInfo || '').toLowerCase().includes(q) ||
          (c.whatsapp || '').toLowerCase().includes(q)
        )
      : allClients;

    // Sort
    list = [...list].sort((a, b) => {
      if (sortMode === 'benefits') return b.benefits - a.benefits;
      if (sortMode === 'orders') return b.orderCount - a.orderCount;
      // frequency: lowest avgDaysBetween wins, but only count clients with 2+ orders
      const aDays = a.avgDaysBetween ?? Infinity;
      const bDays = b.avgDaysBetween ?? Infinity;
      return aDays - bDays;
    });

    // For frequency, hide single-order clients (no frequency data)
    if (sortMode === 'frequency') {
      list = list.filter((c) => c.avgDaysBetween != null);
    }

    return list;
  }, [allClients, search, sortMode]);

  const openClient = allClients.find((c) => c.key === openKey);

  const total = useMemo(() => ({
    totalBenefits: allClients.reduce((s, c) => s + c.benefits, 0),
    totalOrders: allClients.reduce((s, c) => s + c.orderCount, 0),
    uniqueClients: allClients.length,
    repeatClients: allClients.filter((c) => c.orderCount > 1).length,
  }), [allClients]);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <div className="mb-4">
        <h1 className="font-display text-3xl leading-tight">Clients</h1>
        <p className="text-xs text-muted mt-0.5">Analytics across all Terminé orders</p>
      </div>

      {/* Top totals strip */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniStat label="Unique" value={total.uniqueClients} color="#7a8a8c" />
        <MiniStat label="Repeat" value={total.repeatClients} color={accent.primary} />
        <MiniStat label="Orders" value={total.totalOrders} color="#5b8def" />
        <MiniStat label="Total HTG" value={fmtCompact(total.totalBenefits, 'HTG')} color="#3d8b5f" />
      </div>

      {/* Sort mode toggle */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {SORT_MODES.map((m) => {
          const Icon = m.icon;
          const active = sortMode === m.id;
          return (
            <button key={m.id} onClick={() => setSortMode(m.id)}
              className="surface border rounded-2xl py-3 px-2 flex flex-col items-center gap-1"
              style={active
                ? { backgroundColor: accent.soft, borderColor: accent.primary + '66' }
                : undefined}>
              <Icon size={14} style={{ color: active ? accent.primary : 'var(--text-muted, #7a8a8c)' }} />
              <div className="text-[11px] font-medium" style={{ color: active ? accent.primary : 'var(--text)' }}>
                {m.label}
              </div>
              <div className="text-[9px] text-muted">{m.hint}</div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl surface border text-sm focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
            <X size={12} className="text-muted" />
          </button>
        )}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
        {filtered.length} {filtered.length === 1 ? 'client' : 'clients'} · sorted by {sortMode}
      </div>

      {filtered.length === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <div className="text-sm text-muted">No clients match</div>
        </div>
      ) : (
        <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {filtered.slice(0, 100).map((c, i) => (
            <ClientRow key={c.key} client={c} rank={i + 1}
              sortMode={sortMode} accent={accent} fmt={fmtCompact}
              onTap={() => setOpenKey(c.key)} />
          ))}
          {filtered.length > 100 && (
            <div className="px-3 py-2 text-[11px] text-muted text-center">
              Showing first 100 · search to narrow
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {openClient && (
          <ClientDetail client={openClient} onClose={() => setOpenKey(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="surface border rounded-xl p-2.5 text-center">
      <div className="font-display text-base leading-tight" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted font-medium mt-1">{label}</div>
    </div>
  );
}

function ClientRow({ client, rank, sortMode, accent, fmt, onTap }) {
  const primaryValue = sortMode === 'benefits'
    ? fmt(client.benefits, 'HTG')
    : sortMode === 'orders'
    ? `${client.orderCount}`
    : client.avgDaysBetween != null ? `${client.avgDaysBetween.toFixed(0)}d` : '—';
  const primaryLabel = sortMode === 'benefits'
    ? 'benefits'
    : sortMode === 'orders'
    ? 'orders'
    : 'avg gap';
  const primaryColor = sortMode === 'benefits'
    ? (client.benefits >= 0 ? '#3d8b5f' : '#c2452f')
    : 'var(--text)';

  return (
    <button onClick={onTap}
      className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-display text-sm shrink-0"
        style={{
          backgroundColor: rank <= 3 ? accent.soft : 'var(--bg)',
          color: rank <= 3 ? accent.primary : 'var(--text-muted, #7a8a8c)',
        }}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{client.name}</div>
        <div className="text-[11px] text-muted truncate">
          {client.tagInfo && <>{client.tagInfo} · </>}
          {client.orderCount} {client.orderCount === 1 ? 'order' : 'orders'}
          {client.lossCount > 0 && <> · {client.lossCount} loss</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-base leading-tight" style={{ color: primaryColor }}>
          {primaryValue}
        </div>
        <div className="text-[10px] text-muted mt-0.5">{primaryLabel}</div>
      </div>
    </button>
  );
}

function ClientDetail({ client, onClose }) {
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const rawOrders = useStore((s) => s.business?.rechargeOrders || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const allOrders = useMemo(() => applyDateFilter(rawOrders, wsFilter, 'date'), [rawOrders, wsFilter]);

  const clientOrders = useMemo(() => {
    return allOrders
      .filter((o) => {
        const key = o.tagInfo || o.client || '(no id)';
        return key === client.key;
      })
      .sort((a, b) => {
        const da = new Date(a.date); const db = new Date(b.date);
        return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
      });
  }, [allOrders, client.key]);

  const avgOrderValue = client.orderCount > 0
    ? client.revenue / client.orderCount
    : 0;
  const profitMargin = client.revenue > 0
    ? (client.benefits / client.revenue) * 100
    : 0;

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
            <div className="font-medium text-sm truncate px-2">{client.name}</div>
            <div className="w-9" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <DetailStat label="Total benefits"
                value={fmtCompact(client.benefits, 'HTG')}
                color={client.benefits >= 0 ? '#3d8b5f' : '#c2452f'} />
              <DetailStat label="Total revenue"
                value={fmtCompact(client.revenue, 'HTG')}
                color={accent.primary} />
              <DetailStat label="Orders"
                value={String(client.orderCount)} color="#5b8def" />
              <DetailStat label="Avg gap"
                value={client.avgDaysBetween != null ? `${client.avgDaysBetween.toFixed(0)} days` : '—'}
                color="#7a8a8c" />
              <DetailStat label="Avg order"
                value={fmtCompact(avgOrderValue, 'HTG')} color="#7a8a8c" />
              <DetailStat label="Margin"
                value={`${profitMargin.toFixed(0)}%`}
                color={profitMargin >= 0 ? '#3d8b5f' : '#c2452f'} />
            </div>

            {/* Meta */}
            <div className="surface border rounded-2xl divide-y divide-[var(--border)]">
              {client.tagInfo && <Row label="Tag" value={client.tagInfo} />}
              {client.whatsapp && <Row label="WhatsApp" value={client.whatsapp} />}
              {client.platform && <Row label="Main platform" value={client.platform} />}
              <Row label="First order" value={fmtDate(client.firstOrder)} />
              <Row label="Last order" value={fmtDate(client.lastOrder)} />
              {client.lossCount > 0 && (
                <Row label="Loss orders" value={`${client.lossCount} of ${client.orderCount}`}
                  valueColor="#c2452f" />
              )}
            </div>

            {/* Order history */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
                Order history ({clientOrders.length})
              </div>
              <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                {clientOrders.slice(0, 30).map((o) => {
                  const done = isTermine(o);
                  const profit = Number(o.profit) || 0;
                  return (
                    <div key={o.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {fmtCompact(o.amountHtg || 0, 'HTG')}
                          <span className="text-muted font-normal text-[11px] ml-1.5">
                            · {o.platform}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted">
                          {fmtDate(new Date(o.date))} · {done ? '✅' : '⏳'}
                        </div>
                      </div>
                      {done && profit !== 0 && (
                        <div className="text-right shrink-0">
                          <div className="font-display text-sm leading-tight"
                            style={{ color: profit >= 0 ? '#3d8b5f' : '#c2452f' }}>
                            {profit >= 0 ? '+' : ''}{fmtCompact(profit, 'HTG')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function DetailStat({ label, value, color }) {
  return (
    <div className="surface border rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{label}</div>
      <div className="font-display text-xl leading-tight" style={{ color }}>{value}</div>
    </div>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <div className="px-3 py-2.5 flex items-baseline gap-3">
      <div className="text-[11px] text-muted w-28 shrink-0">{label}</div>
      <div className="text-sm flex-1 min-w-0 break-words" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  );
}
