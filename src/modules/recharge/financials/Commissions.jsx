// src/modules/recharge/financials/Commissions.jsx
//
// Marc's recharge commissions (25% of each Terminé order's profit).
// Auto-created when order flips to Terminé. Stays pending until you
// mark paid. Edit, delete, mark unpaid all supported.
//
// First-time use: a "Backfill" button creates commissions for all
// existing historical Terminé orders that don't have one yet.
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Clock, ArrowLeft, Trash2, Edit3, RotateCcw, Sparkles,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import { useAvsCurrency } from '../../avs/useAvsCurrency';

const ws = () => getWorkspace('recharge');

function fmtDateTime(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function Commissions() {
  const commissions = useStore((s) => s.business?.rechargeCommissions || []);
  const markPaid = useStore((s) => s.markRechargeCommissionPaid);
  const markUnpaid = useStore((s) => s.markRechargeCommissionUnpaid);
  const removeCommission = useStore((s) => s.removeRechargeCommission);
  const backfill = useStore((s) => s.backfillRechargeCommissions);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const [editId, setEditId] = useState(null);

  const pending = useMemo(() => commissions.filter((c) => c.status === 'pending'), [commissions]);
  const paid = useMemo(() => commissions.filter((c) => c.status === 'paid').slice(0, 50), [commissions]);

  const totalPending = pending.reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0);
  const totalPaidMTD = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    return commissions
      .filter((c) => c.status === 'paid' && new Date(c.paidDate) >= start)
      .reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0);
  }, [commissions]);

  const editing = commissions.find((c) => c.id === editId);
  const bulkPay = useStore((s) => s.bulkPayRechargeCommissions);

  const markAllPaid = () => {
    if (pending.length === 0) return;
    if (!confirm(`Mark all ${pending.length} pending commissions as paid? This will create one bulk payroll expense for the total.`)) return;
    bulkPay();
  };

  const runBackfill = () => {
    if (!confirm("Create Marc commissions for every existing Terminé order that doesn't have one yet? Run this once.")) return;
    const created = backfill();
    alert(`Created ${created} commissions.`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Clock} label="Pending" value={fmtCompact(totalPending, 'HTG')}
          sub={`${pending.length} ${pending.length === 1 ? 'order' : 'orders'}`}
          accent={accent} highlight={pending.length > 0} />
        <StatCard icon={Check} label="Paid MTD" value={fmtCompact(totalPaidMTD, 'HTG')}
          sub="this month" accent={accent} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
            Pending payouts to Marc
          </div>
          {pending.length > 0 && (
            <button onClick={markAllPaid}
              className="text-[11px] font-medium" style={{ color: accent.primary }}>
              Mark all paid
            </button>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="surface border rounded-2xl p-6 text-center">
            <Check size={20} className="mx-auto text-muted mb-2" />
            <div className="text-sm font-medium">All caught up</div>
            <div className="text-xs text-muted mt-1">
              Commissions auto-generate when orders hit Terminé
            </div>
          </div>
        ) : (
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {pending.map((c) => (
              <CommissionRow key={c.id} comm={c}
                onPay={() => markPaid(c.id)} onEdit={() => setEditId(c.id)}
                accent={accent} fmt={fmtCompact} />
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
            {paid.map((c) => (
              <CommissionRow key={c.id} comm={c} paid
                onUnpay={() => markUnpaid(c.id)} onEdit={() => setEditId(c.id)}
                accent={accent} fmt={fmtCompact} />
            ))}
          </div>
        </div>
      )}

      <button onClick={runBackfill}
        className="w-full py-2.5 rounded-xl border text-xs flex items-center justify-center gap-1.5"
        style={{ borderColor: 'var(--border)', color: accent.primary }}>
        <Sparkles size={12} />
        Backfill commissions for historical orders
      </button>

      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5" style={{ color: 'var(--text)' }}>
          How Marc's recharge commissions work
        </div>
        <div className="space-y-0.5">
          <div>• 25% of each order's benefits (revenue − supplier cost)</div>
          <div>• Auto-created when order's Statut flips to Terminé</div>
          <div>• Skipped on loss orders (negative profit)</div>
          <div>• Stays pending until you mark paid</div>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <CommissionEditSheet comm={editing}
            onClose={() => setEditId(null)}
            onDelete={() => {
              if (confirm('Delete this commission?')) {
                removeCommission(editing.id);
                setEditId(null);
              }
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

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

function CommissionRow({ comm, onPay, onUnpay, onEdit, paid, accent, fmt }) {
  return (
    <div className="px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {fmt(comm.commissionAmount, comm.currency || 'HTG')}
          <span className="text-muted font-normal text-[11px] ml-1.5">
            on {fmt(comm.orderBenefit, 'HTG')} benefit
          </span>
        </div>
        <div className="text-[11px] text-muted truncate">{comm.notes}</div>
        <div className="text-[10px] text-muted mt-0.5">
          {fmtDateTime(paid ? comm.paidDate : comm.date)}
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

function CommissionEditSheet({ comm, onClose, onDelete }) {
  const accent = ws().accent;
  const updateCommission = useStore((s) => s.updateRechargeCommission);
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
            <div className="font-medium text-sm truncate px-2">Edit commission</div>
            <button onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
              Save
            </button>
          </div>
          <div className="p-4 overflow-y-auto">
            <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">Amount (HTG)</div>
                <input type="number" inputMode="decimal" value={form.commissionAmount}
                  onChange={(e) => set('commissionAmount', e.target.value)}
                  className="form-input text-lg font-display" />
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">Notes</div>
                <input type="text" value={form.notes}
                  onChange={(e) => set('notes', e.target.value)} className="form-input" />
              </div>
            </div>
            <button onClick={onDelete}
              className="w-full py-3 mt-4 rounded-xl border text-sm flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--border)', color: '#c2452f' }}>
              <Trash2 size={14} />
              Delete commission
            </button>
            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}
