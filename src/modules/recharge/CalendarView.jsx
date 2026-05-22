// src/modules/recharge/CalendarView.jsx
//
// Same calendar nav as AVS Solution HT, showing recharge orders by date.
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Zap,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import { parseDate, isTermine } from './useRechargeData';
import { useAvsCurrency } from '../avs/useAvsCurrency';

const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ws = () => getWorkspace('recharge');
const ease = [0.16, 1, 0.3, 1];
const fadeUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function RechargeCalendar() {
  const orders = useStore((s) => s.business?.rechargeOrders || []);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();

  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [selected, setSelected] = useState(() => new Date());

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

  const dayMap = useMemo(() => {
    const map = {};
    const isCurrentMonth = (d) =>
      d && d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();

    orders.forEach((o) => {
      const dt = parseDate(o.date);
      if (!isCurrentMonth(dt)) return;
      const k = dt.getDate();
      if (!map[k]) map[k] = { ordersTotal: 0, termine: 0, pending: 0, benefits: 0 };
      map[k].ordersTotal += 1;
      if (isTermine(o)) {
        map[k].termine += 1;
        map[k].benefits += Number(o.profit) || 0;
      } else {
        map[k].pending += 1;
      }
    });
    return map;
  }, [orders, cursor]);

  const totals = useMemo(() => Object.values(dayMap).reduce(
    (acc, d) => ({
      ordersTotal: acc.ordersTotal + d.ordersTotal,
      termine: acc.termine + d.termine,
      benefits: acc.benefits + d.benefits,
    }),
    { ordersTotal: 0, termine: 0, benefits: 0 }
  ), [dayMap]);

  const selectedOrders = useMemo(() => {
    return orders.filter((o) => isSameDay(parseDate(o.date), selected))
      .sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
  }, [orders, selected]);

  const monthLabel = cursor.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const navMonth = (delta) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(next);
  };
  const goToday = () => {
    const today = new Date();
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }}
        className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">
            Calendar
          </div>
          <h1 className="font-display text-3xl leading-tight">Schedule</h1>
        </div>
        <button onClick={goToday}
          className="px-3 py-1.5 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: accent.soft, color: accent.primary }}>
          Today
        </button>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.04 }}
        className="grid grid-cols-3 gap-2 mb-4">
        <MiniStat label="Orders" value={totals.ordersTotal} color="#7a8a8c" />
        <MiniStat label="Done" value={totals.termine} color="#3d8b5f" />
        <MiniStat label="Benefits" value={fmtCompact(totals.benefits, 'HTG')} color={accent.primary} />
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.08 }}
        className="surface border rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navMonth(-1)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center">
            <ChevronLeft size={16} />
          </button>
          <div className="font-display text-xl">{monthLabel}</div>
          <button onClick={() => navMonth(1)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg)] flex items-center justify-center">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK.map((w) => (
            <div key={w}
              className="text-center text-[10px] text-muted font-medium uppercase tracking-wider py-1">
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
            return (
              <motion.button key={i} whileTap={{ scale: 0.92 }}
                onClick={() => setSelected(d)}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-colors ${
                  isToday && !isSelected ? 'bg-[var(--bg)] ring-1 ring-[var(--border)]' : ''
                } ${!isSelected ? 'hover:bg-[var(--bg)]' : ''}`}
                style={isSelected
                  ? { backgroundColor: accent.primary, color: accent.primaryFg }
                  : undefined}>
                <span className="relative text-sm font-medium">{d.getDate()}</span>
                {data && (
                  <div className="relative flex gap-0.5 mt-0.5">
                    {data.termine > 0 && (
                      <span className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? accent.primaryFg : '#3d8b5f' }} />
                    )}
                    {data.pending > 0 && (
                      <span className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: isSelected ? accent.primaryFg : '#d4a942' }} />
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-muted">
          <Dot color="#3d8b5f" label="Terminé" />
          <Dot color="#d4a942" label="En attente" />
        </div>
      </motion.section>

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
            {selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {selectedOrders.length === 0 ? (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="surface border rounded-2xl p-8 text-center">
              <CalIcon size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
              <div className="font-display text-xl mb-1">Free day</div>
              <div className="text-sm text-muted">No recharge orders</div>
            </motion.div>
          ) : (
            <motion.ul key={selected.toISOString()}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
              {selectedOrders.map((o) => (
                <OrderRow key={o.id} order={o} fmt={fmtCompact} />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.section>
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

function Dot({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function OrderRow({ order, fmt }) {
  const isDone = isTermine(order);
  const setActiveTab = useStore((s) => s.setActiveTab);
  return (
    <button onClick={() => setActiveTab('orders')}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isDone ? '#3d8b5f22' : '#d4a94222',
          color: isDone ? '#3d8b5f' : '#d4a942',
        }}>
        <Zap size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {order.client || order.tagInfo || '(no name)'}
        </div>
        <div className="text-[11px] text-muted truncate">
          {order.platform || order.service} · {order.speed || ''}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-sm leading-tight">
          {fmt(order.amountHtg || 0, 'HTG')}
        </div>
        {order.profit != null && (
          <div className="text-[10px]"
            style={{ color: Number(order.profit) >= 0 ? '#3d8b5f' : '#c2452f' }}>
            {Number(order.profit) >= 0 ? '+' : ''}{fmt(order.profit, 'HTG')}
          </div>
        )}
      </div>
    </button>
  );
}
