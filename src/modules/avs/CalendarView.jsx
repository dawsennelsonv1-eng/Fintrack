// src/modules/avs/CalendarView.jsx
// Tier 5d — AVS Calendar
//
// Same Month/Compare toggle as Personal, but bound to leads instead of
// transactions. The calendar surfaces three event types per day:
//   • New leads created (lead.date)
//   • RDV appointments scheduled (lead.rdvDate)
//   • Card deliveries (lead.dateReception)
//
// Tap a day → see all events for that day with quick jumps to the lead.
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon,
  Plus, MapPin, Package,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';

const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const ws = () => getWorkspace('avs');

const ease = [0.16, 1, 0.3, 1];
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function parseLeadDate(v) {
  if (!v) return null;
  // Handle Excel serial dates that occasionally come from the sheet
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    // Excel epoch starts 1900-01-01, JS Date starts 1970-01-01
    const ms = (v - 25569) * 86400 * 1000;
    return new Date(ms);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

export default function AvsCalendarView() {
  const leads = useStore((s) => s.business?.leads || []);
  const accent = ws().accent;

  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [selected, setSelected] = useState(() => new Date());

  // Build day cells for current month
  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDate; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  // Map of dateKey → {newLeads, rdvs, deliveries, completed} for current month
  const dayMap = useMemo(() => {
    const map = {};
    const isCurrentMonth = (d) =>
      d && d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();

    leads.forEach((lead) => {
      const created = parseLeadDate(lead.date);
      if (isCurrentMonth(created)) {
        const k = created.getDate();
        if (!map[k]) map[k] = { newLeads: 0, rdvs: 0, deliveries: 0, completed: 0 };
        map[k].newLeads += 1;
        if (lead.leadStatus === '✅ Terminé') map[k].completed += 1;
      }
      const rdv = parseLeadDate(lead.rdvDate);
      if (isCurrentMonth(rdv)) {
        const k = rdv.getDate();
        if (!map[k]) map[k] = { newLeads: 0, rdvs: 0, deliveries: 0, completed: 0 };
        map[k].rdvs += 1;
      }
      const recv = parseLeadDate(lead.dateReception);
      if (isCurrentMonth(recv)) {
        const k = recv.getDate();
        if (!map[k]) map[k] = { newLeads: 0, rdvs: 0, deliveries: 0, completed: 0 };
        map[k].deliveries += 1;
      }
    });
    return map;
  }, [leads, cursor]);

  // Month totals
  const monthTotals = useMemo(() => {
    return Object.values(dayMap).reduce(
      (acc, d) => ({
        newLeads: acc.newLeads + d.newLeads,
        rdvs: acc.rdvs + d.rdvs,
        deliveries: acc.deliveries + d.deliveries,
        completed: acc.completed + d.completed,
      }),
      { newLeads: 0, rdvs: 0, deliveries: 0, completed: 0 }
    );
  }, [dayMap]);

  // Selected day events
  const selectedEvents = useMemo(() => {
    const evts = [];
    leads.forEach((lead) => {
      const created = parseLeadDate(lead.date);
      if (isSameDay(created, selected)) {
        evts.push({ type: 'created', lead, time: created });
      }
      const rdv = parseLeadDate(lead.rdvDate);
      if (isSameDay(rdv, selected)) {
        evts.push({ type: 'rdv', lead, time: rdv });
      }
      const recv = parseLeadDate(lead.dateReception);
      if (isSameDay(recv, selected)) {
        evts.push({ type: 'delivery', lead, time: recv });
      }
    });
    // Sort by time within the day
    return evts.sort((a, b) => (a.time || 0) - (b.time || 0));
  }, [leads, selected]);

  const monthLabel = cursor.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const navMonth = (delta) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  };
  const goToday = () => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    setCursor(first);
    setSelected(today);
  };

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease }}
        className="flex items-end justify-between mb-4"
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
            Calendar
          </div>
          <h1 className="font-display text-3xl leading-tight">Schedule</h1>
        </div>
        <button
          onClick={goToday}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: accent.soft, color: accent.primary }}
        >
          Today
        </button>
      </motion.section>

      {/* Month totals — 4-up */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease, delay: 0.04 }}
        className="grid grid-cols-4 gap-2 mb-4"
      >
        <MiniStat label="Leads" value={monthTotals.newLeads} color="#7a8a8c" />
        <MiniStat label="RDVs" value={monthTotals.rdvs} color="#5b8def" />
        <MiniStat label="Delivered" value={monthTotals.deliveries} color="#d4a942" />
        <MiniStat label="Done" value={monthTotals.completed} color="#3d8b5f" />
      </motion.section>

      {/* Calendar grid */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.5, ease, delay: 0.08 }}
        className="surface border rounded-2xl p-4 mb-5"
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navMonth(-1)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="font-display text-xl">{monthLabel}</div>
          <button
            onClick={() => navMonth(1)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK.map((w) => (
            <div
              key={w}
              className="text-center text-[10px] text-muted font-medium uppercase tracking-wider py-1"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const data = dayMap[d.getDate()];
            const isToday = isSameDay(d, new Date());
            const isSelected = isSameDay(d, selected);
            const hasRdv = data?.rdvs > 0;
            const hasDelivery = data?.deliveries > 0;
            const hasLead = data?.newLeads > 0;
            const hasCompleted = data?.completed > 0;

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelected(d)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${
                  isToday && !isSelected ? 'bg-[var(--bg)] ring-1 ring-[var(--border)]' : ''
                } ${!isSelected ? 'hover:bg-[var(--bg)]' : ''}`}
                style={
                  isSelected
                    ? { backgroundColor: accent.primary, color: accent.primaryFg }
                    : undefined
                }
              >
                <span className="relative text-sm font-medium">{d.getDate()}</span>
                {(hasLead || hasRdv || hasDelivery || hasCompleted) && (
                  <div className="relative flex gap-0.5 mt-0.5">
                    {hasLead && (
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? accent.primaryFg : '#7a8a8c' }}
                      />
                    )}
                    {hasRdv && (
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? accent.primaryFg : '#5b8def' }}
                      />
                    )}
                    {hasDelivery && (
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? accent.primaryFg : '#d4a942' }}
                      />
                    )}
                    {hasCompleted && (
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? accent.primaryFg : '#3d8b5f' }}
                      />
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted">
          <Dot color="#7a8a8c" label="Lead" />
          <Dot color="#5b8def" label="RDV" />
          <Dot color="#d4a942" label="Delivery" />
          <Dot color="#3d8b5f" label="Done" />
        </div>
      </motion.section>

      {/* Selected day events */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.12 }}>
        <div className="flex items-baseline justify-between mb-3 px-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
              {selected.toLocaleDateString('en', { weekday: 'long' })}
            </div>
            <h2 className="font-display text-2xl">
              {selected.toLocaleDateString('en', { month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <span className="text-[11px] text-muted">
            {selectedEvents.length} {selectedEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {selectedEvents.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="surface border rounded-2xl p-8 text-center"
            >
              <CalIcon size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
              <div className="font-display text-xl mb-1">Free day</div>
              <div className="text-sm text-muted">No leads or appointments</div>
            </motion.div>
          ) : (
            <motion.ul
              key={selected.toISOString()}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden"
            >
              {selectedEvents.map((e, i) => (
                <EventRow key={`${e.lead.id}:${e.type}:${i}`} event={e} />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ════════════════════════════════════════════════════════════════════
function MiniStat({ label, value, color }) {
  return (
    <div className="surface border rounded-xl p-2.5 text-center">
      <div
        className="font-display text-xl leading-none"
        style={{ color: value > 0 ? color : 'var(--text-muted, #7a8a8c)' }}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted font-medium mt-1">
        {label}
      </div>
    </div>
  );
}

function Dot({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function EventRow({ event }) {
  const { type, lead, time } = event;
  const setActiveTab = useStore((s) => s.setActiveTab);

  const config = {
    created: {
      icon: Plus,
      color: '#7a8a8c',
      label: 'New lead',
    },
    rdv: {
      icon: MapPin,
      color: '#5b8def',
      label: 'Appointment',
    },
    delivery: {
      icon: Package,
      color: '#d4a942',
      label: 'Card delivery',
    },
  }[type];

  const Icon = config.icon;
  const timeLabel = time
    ? time.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <button
      onClick={() => setActiveTab('clients')}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: config.color + '22', color: config.color }}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{lead.client || '(no name)'}</div>
        <div className="text-[11px] text-muted truncate">
          {config.label}
          {lead.pack && <> · {lead.pack}</>}
          {timeLabel && <> · {timeLabel}</>}
        </div>
      </div>
      <div className="text-[10px] text-muted shrink-0">
        {lead.leadStatus}
      </div>
    </button>
  );
}
