// src/modules/avs/financials/Salaries.jsx
// Ship 2 — Salaries hub with onboarding + edit/delete + currency-aware
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Check, Clock, Coins, Calendar as CalIcon,
  Video, Sparkles, Trash2, Edit3, RotateCcw, Wand2,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import { useAvsCurrency } from '../useAvsCurrency';
import {
  SALES_BIWEEKLY_HTG,
  CONTENT_MONTHLY_HTG,
  CONTENT_REQUIRED_POSTS_PER_DAY,
} from '../../../store/businessSlice';

const ws = () => getWorkspace('avs');

const SECTIONS = [
  { id: 'commissions', label: 'Commissions', icon: Coins },
  { id: 'payroll',     label: 'Payroll',     icon: CalIcon },
  { id: 'content',     label: 'Content',     icon: Video },
];

export default function Salaries() {
  const [section, setSection] = useState('commissions');
  const accent = ws().accent;

  return (
    <div className="space-y-4">
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

// COMMISSIONS
function CommissionsView() {
  const commissions = useStore((s) => s.business?.staffCommissions || []);
  const markPaid = useStore((s) => s.markCommissionPaid);
  const markUnpaid = useStore((s) => s.markCommissionUnpaid);
  const removeCommission = useStore((s) => s.removeCommission);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const [editId, setEditId] = useState(null);

  const pending = useMemo(() => commissions.filter((c) => c.status === 'pending'), [commissions]);
  const paid = useMemo(() => commissions.filter((c) => c.status === 'paid').slice(0, 30), [commissions]);
  const totalPending = pending.reduce((s, c) => s + Number(c.commissionAmount), 0);
  const totalPaidMTD = useMemo(() => {
    const start = new Date(); start.setDate(1);
    return commissions
      .filter((c) => c.status === 'paid' && new Date(c.paidDate) >= start)
      .reduce((s, c) => s + Number(c.commissionAmount), 0);
  }, [commissions]);

  const editing = commissions.find((c) => c.id === editId);
  const markAllPaid = () => {
    if (pending.length === 0) return;
    if (!confirm(`Mark all ${pending.length} pending commissions as paid?`)) return;
    pending.forEach((c) => markPaid(c.id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Clock} label="Pending" value={fmtCompact(totalPending, 'HTG')}
          sub={`${pending.length} ${pending.length === 1 ? 'card' : 'cards'}`}
          accent={accent} highlight={pending.length > 0} />
        <StatCard icon={Check} label="Paid MTD" value={fmtCompact(totalPaidMTD, 'HTG')}
          sub="this month" accent={accent} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">Pending payouts</div>
          {pending.length > 0 && (
            <button onClick={markAllPaid} className="text-[11px] font-medium" style={{ color: accent.primary }}>
              Mark all paid
            </button>
          )}
        </div>
        {pending.length === 0 ? (
          <EmptyCard icon={Check} title="All caught up" hint="Commissions auto-generate when leads hit ✅ Terminé" />
        ) : (
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {pending.map((c) => (
              <CommissionRow key={c.id} comm={c}
                onPay={() => markPaid(c.id)}
                onEdit={() => setEditId(c.id)}
                accent={accent} />
            ))}
          </div>
        )}
      </div>

      {paid.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">Recently paid</div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {paid.map((c) => (
              <CommissionRow key={c.id} comm={c} paid
                onUnpay={() => markUnpaid(c.id)}
                onEdit={() => setEditId(c.id)}
                accent={accent} />
            ))}
          </div>
        </div>
      )}

      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5" style={{ color: 'var(--text)' }}>Marc's commission rules</div>
        <div className="space-y-0.5">
          <div>• 750 HTG · Physique + Virtuel</div>
          <div>• 500 HTG · Physique only</div>
          <div>• 500 HTG · Virtuel only</div>
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          Auto-generated when a lead's status changes to ✅ Terminé. Stays pending until you mark it paid.
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <CommissionEditSheet comm={editing}
            onClose={() => setEditId(null)}
            onDelete={() => {
              if (confirm(`Delete commission for ${editing.staffName}?`)) {
                removeCommission(editing.id);
                setEditId(null);
              }
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CommissionRow({ comm, onPay, onUnpay, onEdit, paid, accent }) {
  const { fmtCompact } = useAvsCurrency();
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {comm.staffName}
          <span className="text-muted font-normal text-[11px] ml-1">
            · {fmtCompact(comm.commissionAmount, comm.currency || 'HTG')}
          </span>
        </div>
        <div className="text-[11px] text-muted truncate">{comm.notes}</div>
        <div className="text-[10px] text-muted mt-0.5">{fmtDateTime(paid ? comm.paidDate : comm.date)}</div>
      </div>
      <button onClick={onEdit}
        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg)] shrink-0"
        aria-label="Edit">
        <Edit3 size={12} className="text-muted" />
      </button>
      {!paid ? (
        <button onClick={onPay}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
          Paid
        </button>
      ) : (
        <button onClick={onUnpay}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg)] shrink-0"
          aria-label="Mark unpaid">
          <RotateCcw size={12} className="text-muted" />
        </button>
      )}
    </div>
  );
}

function CommissionEditSheet({ comm, onClose, onDelete }) {
  const updateCommission = useStore((s) => s.updateCommission);
  const [form, setForm] = useState({
    commissionAmount: comm.commissionAmount,
    notes: comm.notes || '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => {
    updateCommission(comm.id, {
      commissionAmount: Number(form.commissionAmount) || 0,
      notes: form.notes,
    });
    onClose();
  };
  return (
    <BottomSheet onClose={onClose} title={`Edit · ${comm.staffName}`} onSave={handleSave}>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        <Field label="Amount (HTG)">
          <input type="number" inputMode="decimal" value={form.commissionAmount}
            onChange={(e) => set('commissionAmount', e.target.value)} className="form-input" />
        </Field>
        <Field label="Notes">
          <input type="text" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} className="form-input" />
        </Field>
      </div>
      <button onClick={onDelete}
        className="w-full py-3 mt-4 rounded-xl border text-sm flex items-center justify-center gap-2"
        style={{ borderColor: 'var(--border)', color: '#c2452f' }}>
        <Trash2 size={14} />
        Delete commission
      </button>
    </BottomSheet>
  );
}

// PAYROLL
function PayrollView() {
  const payroll = useStore((s) => s.business?.staffPayroll || []);
  const recordPayroll = useStore((s) => s.recordPayroll);
  const markPaid = useStore((s) => s.markPayrollPaid);
  const markUnpaid = useStore((s) => s.markPayrollUnpaid);
  const removePayroll = useStore((s) => s.removePayroll);
  const payrollSetupComplete = useStore((s) => s.business?.payrollSetupComplete || false);
  const resetPayrollSetup = useStore((s) => s.resetPayrollSetup);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);

  const addBiweeklyFor = (staffName) => {
    const today = new Date();
    const periodEnd = today.toISOString().slice(0, 10);
    const start = new Date(today); start.setDate(start.getDate() - 14);
    recordPayroll({
      staffName, periodStart: start.toISOString().slice(0, 10), periodEnd,
      amount: SALES_BIWEEKLY_HTG, currency: 'HTG', type: 'salary', notes: 'Bi-weekly salary',
    });
  };
  const addMonthlySarah = () => {
    const today = new Date();
    const start = new Date(today); start.setMonth(start.getMonth() - 1);
    recordPayroll({
      staffName: 'Sarah', periodStart: start.toISOString().slice(0, 10),
      periodEnd: today.toISOString().slice(0, 10),
      amount: CONTENT_MONTHLY_HTG, currency: 'HTG', type: 'salary',
      notes: 'Monthly content/marketing salary',
    });
  };

  const pending = payroll.filter((p) => p.status === 'pending')
    .sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
  const paid = payroll.filter((p) => p.status === 'paid')
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate)).slice(0, 30);
  const totalPending = pending.reduce((s, p) => s + Number(p.amount), 0);
  const editing = payroll.find((p) => p.id === editId);

  if (!payrollSetupComplete) {
    return <PayrollOnboardingCard />;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">Quick add (manual)</div>
        <div className="grid grid-cols-3 gap-2">
          <QuickAddButton label="Jémima" sub="2500 HTG" onClick={() => addBiweeklyFor('Jémima')} accent={accent} />
          <QuickAddButton label="Christelle" sub="2500 HTG" onClick={() => addBiweeklyFor('Christelle')} accent={accent} />
          <QuickAddButton label="Sarah" sub="7500 HTG" onClick={addMonthlySarah} accent={accent} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
            Upcoming · {fmtCompact(totalPending, 'HTG')} total
          </div>
          <button onClick={() => setAdding(true)}
            className="text-[11px] font-medium flex items-center gap-1" style={{ color: accent.primary }}>
            <Plus size={11} /> Custom
          </button>
        </div>
        {pending.length === 0 ? (
          <EmptyCard icon={CalIcon} title="No upcoming payments" hint="Quick-add above or tap Custom to log one" />
        ) : (
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {pending.map((p) => (
              <PayrollRow key={p.id} pay={p}
                onPay={() => markPaid(p.id)}
                onEdit={() => setEditId(p.id)}
                accent={accent} />
            ))}
          </div>
        )}
      </div>

      {paid.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">Recently paid</div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {paid.map((p) => (
              <PayrollRow key={p.id} pay={p} paid
                onUnpay={() => markUnpaid(p.id)}
                onEdit={() => setEditId(p.id)}
                accent={accent} />
            ))}
          </div>
        </div>
      )}

      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5 flex items-center justify-between" style={{ color: 'var(--text)' }}>
          Payment cadence
          <button onClick={resetPayrollSetup}
            className="text-[10px] font-medium" style={{ color: accent.primary }}>
            Redo setup
          </button>
        </div>
        <div className="space-y-0.5">
          <div>• Sales · 2500 HTG every 2 weeks · Jémima ↔ Christelle alternate</div>
          <div>• Content (Sarah) · 7500 HTG monthly</div>
          <div>• Ops (Marc) · per-card, see Commissions tab</div>
        </div>
      </div>

      <AnimatePresence>
        {adding && <PayrollAddSheet onClose={() => setAdding(false)} />}
        {editing && (
          <PayrollEditSheet pay={editing}
            onClose={() => setEditId(null)}
            onDelete={() => {
              if (confirm(`Delete payroll for ${editing.staffName}?`)) {
                removePayroll(editing.id);
                setEditId(null);
              }
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PayrollOnboardingCard() {
  const accent = ws().accent;
  const setupPayrollSchedule = useStore((s) => s.setupPayrollSchedule);
  const skipPayrollSetup = useStore((s) => s.skipPayrollSetup);

  const nextTuesday = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilTue = (2 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilTue);
    return d.toISOString().slice(0, 10);
  }, []);
  const tuesdayAfter = useMemo(() => {
    const d = new Date(nextTuesday);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [nextTuesday]);
  const nextMonth = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [form, setForm] = useState({
    jemimaNext: nextTuesday, christelleNext: tuesdayAfter, sarahNext: nextMonth,
    jemimaLast: '', christelleLast: '', sarahLast: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleGenerate = () => {
    if (!form.jemimaNext || !form.christelleNext || !form.sarahNext) {
      alert('Next pay dates for all three are required.');
      return;
    }
    setupPayrollSchedule({
      'Jémima':     { nextPayDate: form.jemimaNext,     intervalDays: 14, amount: SALES_BIWEEKLY_HTG, currency: 'HTG' },
      'Christelle': { nextPayDate: form.christelleNext, intervalDays: 14, amount: SALES_BIWEEKLY_HTG, currency: 'HTG' },
      'Sarah':      { nextPayDate: form.sarahNext,      intervalDays: 30, amount: CONTENT_MONTHLY_HTG, currency: 'HTG' },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 border"
        style={{ backgroundColor: accent.soft, borderColor: accent.primary + '44' }}>
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
            <Wand2 size={18} />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg leading-tight">Set up payroll schedule</div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Tell us when each person's next pay date is. We'll auto-generate the next 6 months of upcoming payroll entries. You can edit, delete, or shift any of them later.
            </p>
          </div>
        </div>
      </div>

      <Section title="Required · next pay dates">
        <Field label="Jémima's next pay date">
          <input type="date" value={form.jemimaNext}
            onChange={(e) => set('jemimaNext', e.target.value)} className="form-input" />
        </Field>
        <Field label="Christelle's next pay date">
          <input type="date" value={form.christelleNext}
            onChange={(e) => set('christelleNext', e.target.value)} className="form-input" />
        </Field>
        <Field label="Sarah's next pay date">
          <input type="date" value={form.sarahNext}
            onChange={(e) => set('sarahNext', e.target.value)} className="form-input" />
        </Field>
      </Section>

      <Section title="Optional · last paid dates (for context)">
        <Field label="Jémima · last paid">
          <input type="date" value={form.jemimaLast}
            onChange={(e) => set('jemimaLast', e.target.value)} className="form-input" />
        </Field>
        <Field label="Christelle · last paid">
          <input type="date" value={form.christelleLast}
            onChange={(e) => set('christelleLast', e.target.value)} className="form-input" />
        </Field>
        <Field label="Sarah · last paid">
          <input type="date" value={form.sarahLast}
            onChange={(e) => set('sarahLast', e.target.value)} className="form-input" />
        </Field>
      </Section>

      <button onClick={handleGenerate}
        className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
        <Wand2 size={14} />
        Generate next 6 months
      </button>

      <button onClick={skipPayrollSetup} className="w-full py-2 text-xs text-muted">
        Skip for now — I'll log payroll manually
      </button>
    </div>
  );
}

function QuickAddButton({ label, sub, onClick, accent }) {
  return (
    <button onClick={onClick}
      className="surface border rounded-2xl p-3 text-center active:scale-95 transition-transform">
      <div className="w-8 h-8 rounded-xl mx-auto mb-1.5 flex items-center justify-center text-sm font-display"
        style={{ backgroundColor: accent.soft, color: accent.primary }}>
        {label[0]}
      </div>
      <div className="font-medium text-xs">{label}</div>
      <div className="text-[10px] text-muted mt-0.5">{sub}</div>
    </button>
  );
}

function PayrollRow({ pay, onPay, onUnpay, onEdit, paid, accent }) {
  const { fmtCompact } = useAvsCurrency();
  const isAutoGen = pay.notes?.includes('Auto-generated');
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm">{pay.staffName}</span>
          <span className="text-muted font-normal text-[11px]">
            · {fmtCompact(pay.amount, pay.currency || 'HTG')}
          </span>
          {isAutoGen && !paid && <Wand2 size={9} className="text-muted" />}
        </div>
        <div className="text-[11px] text-muted truncate">
          {pay.periodEnd ? `Pay date: ${fmtDate(pay.periodEnd)}` : pay.notes}
        </div>
      </div>
      <button onClick={onEdit}
        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg)] shrink-0"
        aria-label="Edit">
        <Edit3 size={12} className="text-muted" />
      </button>
      {!paid ? (
        <button onClick={onPay}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
          Paid
        </button>
      ) : (
        <button onClick={onUnpay}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg)] shrink-0"
          aria-label="Mark unpaid">
          <RotateCcw size={12} className="text-muted" />
        </button>
      )}
    </div>
  );
}

function PayrollAddSheet({ onClose }) {
  const recordPayroll = useStore((s) => s.recordPayroll);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    staffName: 'Jémima', periodStart: '', periodEnd: today,
    amount: SALES_BIWEEKLY_HTG, currency: 'HTG', type: 'salary', notes: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => { recordPayroll(form); onClose(); };
  return (
    <BottomSheet onClose={onClose} title="Custom payroll entry" onSave={handleSave}>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        <Field label="Staff"><input type="text" value={form.staffName}
          onChange={(e) => set('staffName', e.target.value)} className="form-input" /></Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className="form-input">
            <option value="salary">Salary</option>
            <option value="commission_payout">Commission payout</option>
            <option value="bonus">Bonus</option>
          </select>
        </Field>
        <Field label="Amount"><input type="number" inputMode="decimal" value={form.amount}
          onChange={(e) => set('amount', Number(e.target.value))} className="form-input" /></Field>
        <Field label="Currency">
          <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="form-input">
            <option value="HTG">HTG</option><option value="USD">USD</option><option value="HTD">HTD</option>
          </select>
        </Field>
        <Field label="Pay date"><input type="date" value={form.periodEnd}
          onChange={(e) => set('periodEnd', e.target.value)} className="form-input" /></Field>
        <Field label="Notes"><input type="text" value={form.notes}
          onChange={(e) => set('notes', e.target.value)} className="form-input" /></Field>
      </div>
    </BottomSheet>
  );
}

function PayrollEditSheet({ pay, onClose, onDelete }) {
  const updatePayroll = useStore((s) => s.updatePayroll);
  const [form, setForm] = useState({
    staffName: pay.staffName, amount: pay.amount, currency: pay.currency,
    periodEnd: pay.periodEnd ? pay.periodEnd.slice(0, 10) : '', notes: pay.notes,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => {
    updatePayroll(pay.id, {
      staffName: form.staffName, amount: Number(form.amount) || 0,
      currency: form.currency, periodEnd: form.periodEnd, notes: form.notes,
    });
    onClose();
  };
  return (
    <BottomSheet onClose={onClose} title={`Edit · ${pay.staffName}`} onSave={handleSave}>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        <Field label="Staff"><input type="text" value={form.staffName}
          onChange={(e) => set('staffName', e.target.value)} className="form-input" /></Field>
        <Field label="Amount"><input type="number" inputMode="decimal" value={form.amount}
          onChange={(e) => set('amount', e.target.value)} className="form-input" /></Field>
        <Field label="Currency">
          <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="form-input">
            <option value="HTG">HTG</option><option value="USD">USD</option><option value="HTD">HTD</option>
          </select>
        </Field>
        <Field label="Pay date"><input type="date" value={form.periodEnd}
          onChange={(e) => set('periodEnd', e.target.value)} className="form-input" /></Field>
        <Field label="Notes"><input type="text" value={form.notes}
          onChange={(e) => set('notes', e.target.value)} className="form-input" /></Field>
      </div>
      <button onClick={onDelete}
        className="w-full py-3 mt-4 rounded-xl border text-sm flex items-center justify-center gap-2"
        style={{ borderColor: 'var(--border)', color: '#c2452f' }}>
        <Trash2 size={14} />
        Delete entry
      </button>
    </BottomSheet>
  );
}

// CONTENT
function ContentView() {
  const adherence = useStore((s) => s.business?.contentAdherence || []);
  const removeContentAdherence = useStore((s) => s.removeContentAdherence);
  const [showLog, setShowLog] = useState(false);
  const [editId, setEditId] = useState(null);
  const accent = ws().accent;
  const today = new Date().toISOString().slice(0, 10);

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      days.push({
        date: key,
        dayLabel: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        actualPosts: entry?.actualPosts || 0,
        hit: entry ? entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY : null,
      });
    }
    return days;
  }, [adherence]);

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      if (entry && entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY) s++;
      else if (i === 0) continue;
      else break;
    }
    return s;
  }, [adherence]);

  const adherenceRate = useMemo(() => {
    let logged = 0, hit = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = adherence.find((a) => String(a.date).slice(0, 10) === key);
      if (entry) { logged++; if (entry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY) hit++; }
    }
    return logged > 0 ? Math.round((hit / logged) * 100) : 0;
  }, [adherence]);

  const todayEntry = adherence.find((a) => String(a.date).slice(0, 10) === today);
  const editing = adherence.find((a) => a.id === editId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Sparkles} label="Streak" value={`${streak}d`} sub="6+ posts" accent={accent} highlight={streak > 0} />
        <StatCard icon={Check} label="30d rate" value={`${adherenceRate}%`} sub="adherence" accent={accent} />
        <StatCard icon={Video} label="Today" value={String(todayEntry?.actualPosts || 0)} sub={`/ ${CONTENT_REQUIRED_POSTS_PER_DAY}`} accent={accent}
          highlight={todayEntry && todayEntry.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY} />
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">Last 7 days</div>
        <div className="surface border rounded-2xl p-3 flex items-end gap-1.5 h-32">
          {last7Days.map((d, i) => {
            const pct = d.actualPosts > 0 ? Math.min(100, (d.actualPosts / CONTENT_REQUIRED_POSTS_PER_DAY) * 100) : 0;
            const isToday = i === last7Days.length - 1;
            const color = d.hit === true ? '#3d8b5f'
              : d.hit === false ? '#c2452f'
              : isToday ? accent.primary + '66' : '#7a8a8c33';
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] text-muted">{d.actualPosts || '—'}</div>
                <div className="w-full rounded-md transition-all"
                  style={{ height: `${pct}%`, minHeight: '4px', backgroundColor: color }} />
                <div className={`text-[9px] font-medium ${isToday ? '' : 'text-muted'}`}>{d.dayLabel}</div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => setShowLog(true)}
        className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
        style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
        <Plus size={14} /> Log today's posts
      </button>

      {adherence.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">Recent</div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {adherence.slice(0, 15).map((a) => (
              <div key={a.id} className="px-3 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-display shrink-0"
                  style={a.actualPosts >= CONTENT_REQUIRED_POSTS_PER_DAY
                    ? { backgroundColor: '#3d8b5f22', color: '#3d8b5f' }
                    : { backgroundColor: '#c2452f22', color: '#c2452f' }}>
                  {a.actualPosts}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {a.staffName} · {a.actualPosts}/{CONTENT_REQUIRED_POSTS_PER_DAY}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {fmtDate(a.date)}{a.notes && <> · {a.notes}</>}
                  </div>
                </div>
                <button onClick={() => setEditId(a.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg)] shrink-0"
                  aria-label="Edit">
                  <Edit3 size={12} className="text-muted" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5" style={{ color: 'var(--text)' }}>Sarah's requirement</div>
        <div>3 posts × 2 TikTok accounts = {CONTENT_REQUIRED_POSTS_PER_DAY} posts/day</div>
        <div className="mt-1">Salary: {CONTENT_MONTHLY_HTG} HTG/month</div>
      </div>

      <AnimatePresence>
        {showLog && <ContentLogSheet onClose={() => setShowLog(false)} />}
        {editing && (
          <ContentEditSheet entry={editing}
            onClose={() => setEditId(null)}
            onDelete={() => {
              if (confirm('Delete this content log entry?')) {
                removeContentAdherence(editing.id);
                setEditId(null);
              }
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ContentLogSheet({ onClose }) {
  const logContent = useStore((s) => s.logContentAdherence);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today, staffName: 'Sarah', actualPosts: 6, accounts: 'Both', notes: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => { logContent(form); onClose(); };
  return (
    <BottomSheet onClose={onClose} title="Log content" onSave={handleSave}>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        <Field label="Date"><input type="date" value={form.date}
          onChange={(e) => set('date', e.target.value)} className="form-input" /></Field>
        <Field label="Staff"><input type="text" value={form.staffName}
          onChange={(e) => set('staffName', e.target.value)} className="form-input" /></Field>
        <Field label="Actual posts"><input type="number" inputMode="numeric" value={form.actualPosts}
          onChange={(e) => set('actualPosts', Number(e.target.value))} className="form-input" /></Field>
        <Field label="Accounts">
          <select value={form.accounts} onChange={(e) => set('accounts', e.target.value)} className="form-input">
            <option value="Both">Both TikTok accounts</option>
            <option value="Account 1">Account 1 only</option>
            <option value="Account 2">Account 2 only</option>
          </select>
        </Field>
        <Field label="Notes"><input type="text" value={form.notes}
          onChange={(e) => set('notes', e.target.value)} className="form-input" /></Field>
      </div>
    </BottomSheet>
  );
}

function ContentEditSheet({ entry, onClose, onDelete }) {
  const updateContentAdherence = useStore((s) => s.updateContentAdherence);
  const [form, setForm] = useState({
    date: entry.date ? entry.date.slice(0, 10) : '',
    staffName: entry.staffName, actualPosts: entry.actualPosts,
    accounts: entry.accounts, notes: entry.notes || '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => {
    updateContentAdherence(entry.id, {
      date: form.date, staffName: form.staffName,
      actualPosts: Number(form.actualPosts) || 0,
      accounts: form.accounts, notes: form.notes,
    });
    onClose();
  };
  return (
    <BottomSheet onClose={onClose} title="Edit content log" onSave={handleSave}>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        <Field label="Date"><input type="date" value={form.date}
          onChange={(e) => set('date', e.target.value)} className="form-input" /></Field>
        <Field label="Staff"><input type="text" value={form.staffName}
          onChange={(e) => set('staffName', e.target.value)} className="form-input" /></Field>
        <Field label="Actual posts"><input type="number" inputMode="numeric" value={form.actualPosts}
          onChange={(e) => set('actualPosts', e.target.value)} className="form-input" /></Field>
        <Field label="Accounts">
          <select value={form.accounts} onChange={(e) => set('accounts', e.target.value)} className="form-input">
            <option value="Both">Both TikTok accounts</option>
            <option value="Account 1">Account 1 only</option>
            <option value="Account 2">Account 2 only</option>
          </select>
        </Field>
        <Field label="Notes"><input type="text" value={form.notes}
          onChange={(e) => set('notes', e.target.value)} className="form-input" /></Field>
      </div>
      <button onClick={onDelete}
        className="w-full py-3 mt-4 rounded-xl border text-sm flex items-center justify-center gap-2"
        style={{ borderColor: 'var(--border)', color: '#c2452f' }}>
        <Trash2 size={14} />
        Delete entry
      </button>
    </BottomSheet>
  );
}

// SHARED
function StatCard({ icon: Icon, label, value, sub, accent, highlight }) {
  return (
    <div className="surface border rounded-2xl p-3"
      style={highlight ? { borderColor: accent.primary + '66' } : undefined}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accent.soft, color: accent.primary }}>
          <Icon size={11} />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      </div>
      <div className="font-display text-lg leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyCard({ icon: Icon, title, hint }) {
  const accent = ws().accent;
  return (
    <div className="surface border rounded-2xl p-6 text-center">
      <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
        style={{ backgroundColor: accent.soft, color: accent.primary }}>
        <Icon size={16} />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted mt-0.5">{hint}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
        {title}
      </div>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="px-3 py-2.5">
      {label && <div className="text-[11px] text-muted mb-1">{label}</div>}
      {children}
    </div>
  );
}

function BottomSheet({ onClose, title, onSave, children }) {
  const accent = ws().accent;
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-50" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh]">
        <div className="surface border-t rounded-t-3xl flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm truncate px-2">{title}</div>
            {onSave ? (
              <button onClick={onSave}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
                Save
              </button>
            ) : <div className="w-9" />}
          </div>
          <div className="p-4 overflow-y-auto">
            {children}
            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
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
