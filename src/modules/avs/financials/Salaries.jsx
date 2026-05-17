// src/modules/avs/financials/Salaries.jsx
// Tier 5f — Salaries hub inside Financials
//
// 3 sections:
//   • Commissions — Marc's per-card commissions (auto-generated when
//                   leads hit ✅ Terminé; mark as paid here)
//   • Payroll     — Jémima/Christelle bi-weekly (2500 HTG every Tuesday),
//                   Sarah monthly (7500 HTG)
//   • Content     — Sarah's daily 6-posts adherence log
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Check, Clock,
  Coins, Calendar, Video, Sparkles,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import {
  SALES_BIWEEKLY_HTG,
  CONTENT_MONTHLY_HTG,
  CONTENT_REQUIRED_POSTS_PER_DAY,
} from '../../../store/businessSlice';

const ws = () => getWorkspace('avs');

const SECTIONS = [
  { id: 'commissions', label: 'Commissions', icon: Coins },
  { id: 'payroll',     label: 'Payroll',     icon: Calendar },
  { id: 'content',     label: 'Content',     icon: Video },
];

export default function Salaries() {
  const [section, setSection] = useState('commissions');
  const accent = ws().accent;

  return (
    <div className="space-y-4">
      {/* Section toggle */}
      <div className="surface border rounded-2xl p-1 grid grid-cols-3 gap-0.5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="py-2 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5"
              style={active
                ? { backgroundColor: accent.primary, color: accent.primaryFg }
                : { color: 'var(--text-muted, #7a8a8c)' }
              }
            >
              <Icon size={11} />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === 'commissions' && <CommissionsView />}
      {section === 'payroll' && <PayrollView />}
      {section === 'content' && <ContentView />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMMISSIONS — Marc's per-card payouts
// ════════════════════════════════════════════════════════════════════
function CommissionsView() {
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const markPaid = useStore((s) => s.markCommissionPaid);
  const accent = ws().accent;

  const pending = useMemo(
    () => commissions.filter((c) => c.status === 'pending'),
    [commissions]
  );
  const paid = useMemo(
    () => commissions.filter((c) => c.status === 'paid').slice(0, 20),
    [commissions]
  );
  const totalPending = pending.reduce((s, c) => s + Number(c.commissionAmount), 0);
  const totalPaidMTD = useMemo(() => {
    const start = new Date(); start.setDate(1);
    return commissions
      .filter((c) => c.status === 'paid' && new Date(c.paidDate) >= start)
      .reduce((s, c) => s + Number(c.commissionAmount), 0);
  }, [commissions]);

  const markAllPaid = () => {
    if (pending.length === 0) return;
    if (!confirm(`Mark all ${pending.length} pending commissions as paid?`)) return;
    pending.forEach((c) => markPaid(c.id));
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={Clock}
          label="Pending"
          value={`${totalPending.toFixed(0)} HTG`}
          sub={`${pending.length} ${pending.length === 1 ? 'card' : 'cards'}`}
          accent={accent}
          highlight={pending.length > 0}
        />
        <StatCard
          icon={Check}
          label="Paid MTD"
          value={`${totalPaidMTD.toFixed(0)} HTG`}
          sub="this month"
          accent={accent}
        />
      </div>

      {/* Pending queue */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
            Pending payouts
          </div>
          {pending.length > 0 && (
            <button
              onClick={markAllPaid}
              className="text-[11px] font-medium"
              style={{ color: accent.primary }}
            >
              Mark all paid
            </button>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="surface border rounded-2xl p-6 text-center">
            <div
              className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
              style={{ backgroundColor: accent.soft, color: accent.primary }}
            >
              <Check size={16} />
            </div>
            <div className="text-sm font-medium">All caught up</div>
            <div className="text-xs text-muted mt-0.5">
              Commissions auto-generate when leads hit ✅ Terminé
            </div>
          </div>
        ) : (
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {pending.map((c) => (
              <CommissionRow
                key={c.id}
                comm={c}
                onPay={() => markPaid(c.id)}
                accent={accent}
              />
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {paid.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
            Recently paid
          </div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {paid.map((c) => (
              <CommissionRow key={c.id} comm={c} paid accent={accent} />
            ))}
          </div>
        </div>
      )}

      {/* Rules legend */}
      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5" style={{ color: 'var(--text)' }}>
          Marc's commission rules
        </div>
        <div className="space-y-0.5">
          <div>• 750 HTG · Physique + Virtuel</div>
          <div>• 500 HTG · Physique only</div>
          <div>• 500 HTG · Virtuel only</div>
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          Auto-generated when a lead's status changes to ✅ Terminé.
        </div>
      </div>
    </div>
  );
}

function CommissionRow({ comm, onPay, paid, accent }) {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {comm.staffName}
          <span className="text-muted font-normal text-[11px] ml-1">
            · {comm.commissionAmount} HTG
          </span>
        </div>
        <div className="text-[11px] text-muted truncate">{comm.notes}</div>
        <div className="text-[10px] text-muted mt-0.5">
          {fmtDateTime(paid ? comm.paidDate : comm.date)}
        </div>
      </div>
      {!paid ? (
        <button
          onClick={onPay}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
        >
          Mark paid
        </button>
      ) : (
        <Check size={14} className="text-muted" />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// PAYROLL — bi-weekly + monthly
// ════════════════════════════════════════════════════════════════════
function PayrollView() {
  const payroll = useStore((s) => s.business?.staffPayroll || []);
  const recordPayroll = useStore((s) => s.recordPayroll);
  const markPaid = useStore((s) => s.markPayrollPaid);
  const [adding, setAdding] = useState(false);
  const accent = ws().accent;

  // Next Tuesday — used as default for new bi-weekly entries
  const nextTuesday = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilTue = (2 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilTue);
    return d.toISOString().slice(0, 10);
  }, []);

  // Quick actions
  const addBiweeklyFor = (staffName) => {
    const today = new Date();
    const periodEnd = today.toISOString().slice(0, 10);
    const start = new Date(today);
    start.setDate(start.getDate() - 14);
    recordPayroll({
      staffName,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd,
      amount: SALES_BIWEEKLY_HTG,
      currency: 'HTG',
      type: 'salary',
      notes: 'Bi-weekly salary',
    });
  };

  const addMonthlySarah = () => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 1);
    recordPayroll({
      staffName: 'Sarah',
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: today.toISOString().slice(0, 10),
      amount: CONTENT_MONTHLY_HTG,
      currency: 'HTG',
      type: 'salary',
      notes: 'Monthly content/marketing salary',
    });
  };

  const pending = payroll.filter((p) => p.status === 'pending');
  const paid = payroll.filter((p) => p.status === 'paid').slice(0, 20);
  const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      {/* Quick add */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
          Quick add
        </div>
        <div className="grid grid-cols-3 gap-2">
          <QuickAddButton
            label="Jémima"
            sub="2500 HTG"
            onClick={() => addBiweeklyFor('Jémima')}
            accent={accent}
          />
          <QuickAddButton
            label="Christelle"
            sub="2500 HTG"
            onClick={() => addBiweeklyFor('Christelle')}
            accent={accent}
          />
          <QuickAddButton
            label="Sarah"
            sub="7500 HTG"
            onClick={addMonthlySarah}
            accent={accent}
          />
        </div>
      </div>

      {/* Pending */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
            Pending · {totalPending.toFixed(0)} HTG
          </div>
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] font-medium flex items-center gap-1"
            style={{ color: accent.primary }}
          >
            <Plus size={11} />
            Custom
          </button>
        </div>
        {pending.length === 0 ? (
          <div className="surface border rounded-2xl p-6 text-center">
            <div className="text-sm text-muted">No pending payments</div>
          </div>
        ) : (
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {pending.map((p) => (
              <PayrollRow
                key={p.id}
                pay={p}
                onPay={() => markPaid(p.id)}
                accent={accent}
              />
            ))}
          </div>
        )}
      </div>

      {paid.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
            Recently paid
          </div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {paid.map((p) => <PayrollRow key={p.id} pay={p} paid accent={accent} />)}
          </div>
        </div>
      )}

      {/* Schedule legend */}
      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5" style={{ color: 'var(--text)' }}>
          Payment cadence
        </div>
        <div className="space-y-0.5">
          <div>• Sales (Jémima, Christelle) · 2500 HTG every 2 weeks · Tuesdays</div>
          <div>• Pay staggered: Jémima one Tuesday, Christelle the next</div>
          <div>• Content (Sarah) · 7500 HTG monthly</div>
          <div>• Ops (Marc) · per-card, see Commissions tab</div>
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          Next Tuesday: {nextTuesday}
        </div>
      </div>

      <AnimatePresence>
        {adding && (
          <PayrollAddSheet onClose={() => setAdding(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickAddButton({ label, sub, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className="surface border rounded-2xl p-3 text-center active:scale-95 transition-transform"
    >
      <div
        className="w-8 h-8 rounded-xl mx-auto mb-1.5 flex items-center justify-center text-sm font-display"
        style={{ backgroundColor: accent.soft, color: accent.primary }}
      >
        {label[0]}
      </div>
      <div className="font-medium text-xs">{label}</div>
      <div className="text-[10px] text-muted mt-0.5">{sub}</div>
    </button>
  );
}

function PayrollRow({ pay, onPay, paid, accent }) {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {pay.staffName}
          <span className="text-muted font-normal text-[11px] ml-1">
            · {pay.amount} {pay.currency}
          </span>
        </div>
        <div className="text-[11px] text-muted truncate">
          {pay.periodStart && pay.periodEnd
            ? `${pay.periodStart} → ${pay.periodEnd}`
            : pay.notes}
        </div>
      </div>
      {!paid ? (
        <button
          onClick={onPay}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
        >
          Mark paid
        </button>
      ) : (
        <span className="text-[10px] text-muted">
          {fmtDate(pay.paidDate)}
        </span>
      )}
    </div>
  );
}

function PayrollAddSheet({ onClose }) {
  const recordPayroll = useStore((s) => s.recordPayroll);
  const accent = ws().accent;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    staffName: 'Jémima',
    periodStart: '',
    periodEnd: today,
    amount: SALES_BIWEEKLY_HTG,
    currency: 'HTG',
    type: 'salary',
    notes: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    recordPayroll(form);
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh]"
      >
        <div className="surface border-t rounded-t-3xl flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">Custom payroll entry</div>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
            >
              Add
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              <FormField label="Staff">
                <input type="text" value={form.staffName} onChange={(e) => set('staffName', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Type">
                <select value={form.type} onChange={(e) => set('type', e.target.value)} className="form-input">
                  <option value="salary">Salary</option>
                  <option value="commission_payout">Commission payout</option>
                  <option value="bonus">Bonus</option>
                </select>
              </FormField>
              <FormField label="Amount">
                <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', Number(e.target.value))} className="form-input" />
              </FormField>
              <FormField label="Currency">
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="form-input">
                  <option value="HTG">HTG</option>
                  <option value="USD">USD</option>
                  <option value="HTD">HTD</option>
                </select>
              </FormField>
              <FormField label="Period start">
                <input type="date" value={form.periodStart} onChange={(e) => set('periodStart', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Period end">
                <input type="date" value={form.periodEnd} onChange={(e) => set('periodEnd', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Notes">
                <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="form-input" />
              </FormField>
            </div>
            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// CONTENT — Sarah's daily 6-posts adherence
// ════════════════════════════════════════════════════════════════════
function ContentView() {
  const adherence = useStore((s) => s.business?.contentAdherence || []);
  const logContent = useStore((s) => s.logContentAdherence);
  const [showLog, setShowLog] = useState(false);
  const accent = ws().accent;
  const today = new Date().toISOString().slice(0, 10);

  // Build last 7 days
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      days.push({
        date: key,
        dayLabel: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        entry,
        actualPosts: entry?.actualPosts || 0,
        hit: entry ? entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY : null,
      });
    }
    return days;
  }, [adherence]);

  // Streak calculation: consecutive days hitting 6+
  const streak = useMemo(() => {
    let count = 0;
    for (let i = adherence.length - 1; i >= 0; i--) {
      // walk back through sorted history
    }
    // Simpler: count from today backwards
    let s = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      if (entry && entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY) {
        s++;
      } else if (i === 0) {
        continue; // today might not be logged yet
      } else {
        break;
      }
    }
    return s;
  }, [adherence]);

  // Adherence rate last 30 days
  const adherenceRate = useMemo(() => {
    let logged = 0, hit = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      if (entry) {
        logged++;
        if (entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY) hit++;
      }
    }
    return logged > 0 ? Math.round((hit / logged) * 100) : 0;
  }, [adherence]);

  const todayEntry = adherence.find((a) => String(a.date).slice(0, 10) === today);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={Sparkles}
          label="Streak"
          value={`${streak}d`}
          sub="6+ posts"
          accent={accent}
          highlight={streak > 0}
        />
        <StatCard
          icon={Check}
          label="30d rate"
          value={`${adherenceRate}%`}
          sub="adherence"
          accent={accent}
        />
        <StatCard
          icon={Video}
          label="Today"
          value={String(todayEntry?.actualPosts || 0)}
          sub={`/ ${CONTENT_REQUIRED_POSTS_PER_DAY}`}
          accent={accent}
          highlight={todayEntry && todayEntry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY}
        />
      </div>

      {/* 7-day visual */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
          Last 7 days
        </div>
        <div className="surface border rounded-2xl p-3 flex items-end gap-1.5 h-32">
          {last7Days.map((d, i) => {
            const pct = d.actualPosts > 0
              ? Math.min(100, (d.actualPosts / CONTENT_REQUIRED_POSTS_PER_DAY) * 100)
              : 0;
            const isToday = i === last7Days.length - 1;
            const color = d.hit === true ? '#3d8b5f'
              : d.hit === false ? '#c2452f'
              : d.hit === null && isToday ? accent.primary + '66'
              : '#7a8a8c33';
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] text-muted">{d.actualPosts || '—'}</div>
                <div
                  className="w-full rounded-md transition-all"
                  style={{
                    height: `${pct}%`,
                    minHeight: '4px',
                    backgroundColor: color,
                  }}
                />
                <div className={`text-[9px] font-medium ${isToday ? '' : 'text-muted'}`}>
                  {d.dayLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log today button */}
      <button
        onClick={() => setShowLog(true)}
        className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
      >
        <Plus size={14} />
        Log today's posts
      </button>

      {/* Recent log */}
      {adherence.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
            Recent
          </div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {adherence.slice(0, 10).map((a) => (
              <div key={a.id} className="px-3 py-2.5 flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-display"
                  style={
                    a.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY
                      ? { backgroundColor: '#3d8b5f22', color: '#3d8b5f' }
                      : { backgroundColor: '#c2452f22', color: '#c2452f' }
                  }
                >
                  {a.actualPosts}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {a.staffName} · {a.actualPosts}/{CONTENT_REQUIRED_POSTS_PER_DAY}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {fmtDate(a.date)}
                    {a.notes && <> · {a.notes}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5" style={{ color: 'var(--text)' }}>
          Sarah's requirement
        </div>
        <div>3 posts × 2 TikTok accounts = {CONTENT_REQUIRED_POSTS_PER_DAY} posts/day</div>
        <div className="mt-1">Salary: {CONTENT_MONTHLY_HTG} HTG/month</div>
      </div>

      <AnimatePresence>
        {showLog && (
          <ContentLogSheet onClose={() => setShowLog(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ContentLogSheet({ onClose }) {
  const logContent = useStore((s) => s.logContentAdherence);
  const accent = ws().accent;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    date: today,
    staffName: 'Sarah',
    actualPosts: 6,
    accounts: 'Both',
    notes: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    logContent(form);
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh]"
      >
        <div className="surface border-t rounded-t-3xl flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">Log content</div>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
            >
              Save
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              <FormField label="Date">
                <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Staff">
                <input type="text" value={form.staffName} onChange={(e) => set('staffName', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Actual posts">
                <input type="number" inputMode="numeric" value={form.actualPosts} onChange={(e) => set('actualPosts', Number(e.target.value))} className="form-input" />
              </FormField>
              <FormField label="Accounts">
                <select value={form.accounts} onChange={(e) => set('accounts', e.target.value)} className="form-input">
                  <option value="Both">Both TikTok accounts</option>
                  <option value="Account 1">Account 1 only</option>
                  <option value="Account 2">Account 2 only</option>
                </select>
              </FormField>
              <FormField label="Notes">
                <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="form-input" placeholder="What worked, what didn't..." />
              </FormField>
            </div>
            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// SHARED
// ════════════════════════════════════════════════════════════════════
function StatCard({ icon: Icon, label, value, sub, accent, highlight }) {
  return (
    <div
      className="surface border rounded-2xl p-3"
      style={highlight ? { borderColor: accent.primary + '66' } : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accent.soft, color: accent.primary }}
        >
          <Icon size={11} />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      </div>
      <div className="font-display text-lg leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className="px-3 py-2.5">
      {label && <div className="text-[11px] text-muted mb-1">{label}</div>}
      {children}
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

function fmtDateTime(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}
