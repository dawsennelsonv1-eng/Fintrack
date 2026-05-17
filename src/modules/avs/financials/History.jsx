// src/modules/avs/financials/History.jsx
// Tier 5f-finalize — Unified AVS event timeline
//
// Pulls events from every AVS collection and merges them into one
// chronologically-sorted, filterable log:
//   • Card sales (Terminé leads w/ totalPrice)
//   • Commission payouts to Marc
//   • Payroll payouts to Jémima/Christelle/Sarah
//   • Ad spend entries
//   • Content adherence logs
//
// Searchable + filterable by kind. No writes happen here — pure read.
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X,
  CreditCard, Coins, Users, Megaphone, Video,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';

const ws = () => getWorkspace('avs');
const HTG_PER_USD = 150;

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtHTG(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

const KINDS = [
  { id: 'all',         label: 'All',         icon: null },
  { id: 'sale',        label: 'Sales',       icon: CreditCard },
  { id: 'commission',  label: 'Commissions', icon: Coins },
  { id: 'payroll',     label: 'Payroll',     icon: Users },
  { id: 'ad',          label: 'Ads',         icon: Megaphone },
  { id: 'content',     label: 'Content',     icon: Video },
];

export default function HistoryView() {
  const leads = useStore((s) => s.business?.leads || []);
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const payroll = useStore((s) => s.business?.staffPayroll || []);
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const contentAdherence = useStore((s) => s.business?.contentAdherence || []);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const accent = ws().accent;

  const events = useMemo(() => {
    const evts = [];

    // Card sales (only Terminé)
    leads.forEach((l) => {
      if (l.leadStatus !== '✅ Terminé') return;
      const d = parseDate(l.datePaidFull) || parseDate(l.date);
      if (!d) return;
      evts.push({
        id: `sale:${l.id}`,
        kind: 'sale',
        date: d,
        title: l.client || '(no name)',
        subtitle: `${l.pack || ''} · ${l.cardType || 'Card'}`,
        amount: Number(l.totalPrice) || 0,
        currency: 'HTG',
        flow: 'in',
      });
    });

    // Commissions (paid + pending)
    commissions.forEach((c) => {
      const d = parseDate(c.paidDate) || parseDate(c.date);
      if (!d) return;
      evts.push({
        id: `comm:${c.id}`,
        kind: 'commission',
        date: d,
        title: `${c.staffName} commission`,
        subtitle: c.status === 'paid' ? 'Paid' : 'Pending · not yet paid',
        amount: Number(c.commissionAmount) || 0,
        currency: c.currency || 'HTG',
        flow: c.status === 'paid' ? 'out' : 'pending',
      });
    });

    // Payroll
    payroll.forEach((p) => {
      const d = parseDate(p.paidDate) || parseDate(p.date);
      if (!d) return;
      const amtHTG = p.currency === 'USD'
        ? (Number(p.amount) || 0) * HTG_PER_USD
        : (Number(p.amount) || 0);
      evts.push({
        id: `pay:${p.id}`,
        kind: 'payroll',
        date: d,
        title: `${p.staffName} payroll`,
        subtitle: p.status === 'paid'
          ? `Paid · ${p.type || 'salary'}`
          : `Pending · ${p.type || 'salary'}`,
        amount: amtHTG,
        currency: 'HTG',
        flow: p.status === 'paid' ? 'out' : 'pending',
      });
    });

    // Ad spend
    adSpend.forEach((a) => {
      const d = parseDate(a.date);
      if (!d) return;
      const amtHTG = a.spendCurrency === 'USD'
        ? (Number(a.spendAmount) || 0) * HTG_PER_USD
        : (Number(a.spendAmount) || 0);
      evts.push({
        id: `ad:${a.id}`,
        kind: 'ad',
        date: d,
        title: a.campaignName || '(unnamed campaign)',
        subtitle: `${a.platform || ''} · ${a.kind || 'paid'}`,
        amount: amtHTG,
        currency: 'HTG',
        flow: a.kind === 'organic' ? 'neutral' : 'out',
      });
    });

    // Content adherence
    contentAdherence.forEach((c) => {
      const d = parseDate(c.date);
      if (!d) return;
      evts.push({
        id: `cnt:${c.id}`,
        kind: 'content',
        date: d,
        title: `${c.staffName || 'Sarah'} · ${c.actualPosts}/${c.requiredPosts} posts`,
        subtitle: c.accounts || '',
        amount: 0,
        currency: '',
        flow: 'neutral',
      });
    });

    return evts.sort((a, b) => b.date - a.date);
  }, [leads, commissions, payroll, adSpend, contentAdherence]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== 'all' && e.kind !== filter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q)
      );
    });
  }, [events, filter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((e) => {
      const key = e.date.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).map(([date, items]) => ({ date, items }));
  }, [filtered]);

  // Period totals (visible filtered set)
  const totals = useMemo(() => {
    let inflow = 0, outflow = 0;
    filtered.forEach((e) => {
      if (e.flow === 'in') inflow += e.amount;
      else if (e.flow === 'out') outflow += e.amount;
    });
    return { inflow, outflow, net: inflow - outflow };
  }, [filtered]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl surface border text-sm focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-[var(--bg)] flex items-center justify-center"
          >
            <X size={12} className="text-muted" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
          {KINDS.map((k) => {
            const Icon = k.icon;
            const isActive = filter === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setFilter(k.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 ${
                  isActive ? '' : 'surface border text-muted'
                }`}
                style={isActive
                  ? { backgroundColor: accent.primary, color: accent.primaryFg }
                  : undefined
                }
              >
                {Icon && <Icon size={11} />}
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Totals strip */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="In" value={`+${fmtHTG(totals.inflow)}`} color="#3d8b5f" />
          <MiniStat label="Out" value={`−${fmtHTG(totals.outflow)}`} color="#c2452f" />
          <MiniStat
            label="Net"
            value={`${totals.net >= 0 ? '+' : '−'}${fmtHTG(Math.abs(totals.net))}`}
            color={totals.net >= 0 ? '#3d8b5f' : '#c2452f'}
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <div className="text-sm text-muted">No events match</div>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {grouped.map(({ date, items }) => (
              <motion.div
                key={date}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5 px-1">
                  {fmtDateHeader(date)}
                </div>
                <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                  {items.map((e) => <EventRow key={e.id} event={e} accent={accent} />)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="surface border rounded-xl p-2.5 text-center">
      <div className="font-display text-base leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mt-1">
        {label}
      </div>
    </div>
  );
}

function EventRow({ event, accent }) {
  const config = {
    sale:       { icon: CreditCard, color: '#3d8b5f', bg: '#3d8b5f22' },
    commission: { icon: Coins,      color: '#d4a942', bg: '#d4a94222' },
    payroll:    { icon: Users,      color: '#5b8def', bg: '#5b8def22' },
    ad:         { icon: Megaphone,  color: '#9b59b6', bg: '#9b59b622' },
    content:    { icon: Video,      color: '#7a8a8c', bg: '#7a8a8c22' },
  }[event.kind] || { icon: CreditCard, color: '#7a8a8c', bg: '#7a8a8c22' };

  const Icon = config.icon;
  const isIn = event.flow === 'in';
  const isOut = event.flow === 'out';
  const isPending = event.flow === 'pending';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{event.title}</div>
        <div className="text-[11px] text-muted truncate">
          {event.subtitle}
          {' · '}
          {event.date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>
      {event.amount > 0 && (
        <div className="text-right shrink-0">
          <div
            className="font-display text-sm leading-tight"
            style={{
              color: isIn ? '#3d8b5f' : isOut ? '#c2452f' : 'var(--text)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isIn ? '+' : isOut || isPending ? '−' : ''}{fmtHTG(event.amount)}
          </div>
          <div className="text-[10px] text-muted">{event.currency}</div>
        </div>
      )}
    </div>
  );
}

function fmtDateHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
}
