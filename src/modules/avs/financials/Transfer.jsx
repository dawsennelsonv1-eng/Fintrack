// src/modules/avs/financials/Transfer.jsx
// Tier 5f-finalize — Cross-workspace transfer
//
// Two flows:
//   1. Owner Draw      — AVS → Personal (you take money out of business)
//      • AVS side: payroll entry, staffName='Dawsen', type='owner_draw', status='paid'
//      • Personal side: income tx, category='Salary' (or chosen), notes auto-tagged
//
//   2. Capital Injection — Personal → AVS (you put money into business)
//      • Personal side: expense tx, category='Investment'
//      • AVS side: payroll entry with NEGATIVE amount + type='capital_injection'
//        OR if we want it cleaner we just log it as a paid ad spend with
//        kind='capital'. For now using payroll-negative which doesn't
//        affect MTD payroll math (it's filtered by type).
//
// Both create a paired ID so they can be linked in the audit trail.
//
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight, ArrowRight, ArrowLeft, Briefcase, Wallet,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';

const ws = () => getWorkspace('avs');
const HTG_PER_USD = 150;

export default function Transfer() {
  const [direction, setDirection] = useState('draw'); // 'draw' | 'injection'
  const [form, setForm] = useState({
    amount: 0,
    currency: 'HTG',
    notes: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [confirmation, setConfirmation] = useState(null);
  const accent = ws().accent;

  const recordPayroll = useStore((s) => s.recordPayroll);
  const markPayrollPaid = useStore((s) => s.markPayrollPaid);
  const addTransaction = useStore((s) => s.addTransaction);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.amount || Number(form.amount) <= 0) {
      alert('Enter an amount greater than 0.');
      return;
    }

    const amountNum = Number(form.amount);
    const tagId = `xfer_${Date.now().toString(36)}`;

    if (direction === 'draw') {
      // AVS side: payroll entry, marked paid, owner_draw type
      const avsEntry = recordPayroll({
        staffName: 'Dawsen',
        type: 'owner_draw',
        amount: amountNum,
        currency: form.currency,
        periodStart: form.date,
        periodEnd: form.date,
        notes: `Owner draw → Personal · ${tagId}${form.notes ? ' · ' + form.notes : ''}`,
        status: 'pending',
      });
      // Mark as paid immediately
      if (avsEntry) markPayrollPaid(avsEntry.id);

      // Personal side: income tx
      addTransaction({
        type: 'income',
        category: 'Salary',
        amount: amountNum,
        currency: form.currency,
        date: form.date,
        notes: `AVS owner draw · ${tagId}${form.notes ? ' · ' + form.notes : ''}`,
      });

      setConfirmation({
        kind: 'draw',
        amount: amountNum,
        currency: form.currency,
        tagId,
      });
    } else {
      // Capital injection: Personal → AVS
      // Personal side: expense tx
      addTransaction({
        type: 'expense',
        category: 'Investment',
        amount: amountNum,
        currency: form.currency,
        date: form.date,
        notes: `Capital injection → AVS · ${tagId}${form.notes ? ' · ' + form.notes : ''}`,
      });

      // AVS side: payroll entry with type=capital_injection, marked paid
      // (using negative amount so it doesn't add to "owed staff" math —
      // payroll filters by type when displaying)
      const avsEntry = recordPayroll({
        staffName: 'Dawsen',
        type: 'capital_injection',
        amount: -amountNum,  // negative = money coming IN to AVS
        currency: form.currency,
        periodStart: form.date,
        periodEnd: form.date,
        notes: `Capital from Personal · ${tagId}${form.notes ? ' · ' + form.notes : ''}`,
        status: 'pending',
      });
      if (avsEntry) markPayrollPaid(avsEntry.id);

      setConfirmation({
        kind: 'injection',
        amount: amountNum,
        currency: form.currency,
        tagId,
      });
    }

    // Reset form
    setForm({
      amount: 0,
      currency: 'HTG',
      notes: '',
      date: new Date().toISOString().slice(0, 10),
    });

    // Auto-dismiss confirmation after 4s
    setTimeout(() => setConfirmation(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Confirmation toast */}
      <AnimatePresence>
        {confirmation && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl p-4 border flex items-center gap-3"
            style={{
              backgroundColor: '#3d8b5f15',
              borderColor: '#3d8b5f44',
            }}
          >
            <CheckCircle2 size={18} className="shrink-0" style={{ color: '#3d8b5f' }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                {confirmation.kind === 'draw' ? 'Owner draw recorded' : 'Capital injection recorded'}
              </div>
              <div className="text-[11px] text-muted">
                {confirmation.amount} {confirmation.currency} ·
                {confirmation.kind === 'draw'
                  ? ' AVS → Personal'
                  : ' Personal → AVS'}
                {' · paired '}
                <span className="font-mono">{confirmation.tagId.slice(-6)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Direction toggle */}
      <div className="surface border rounded-2xl overflow-hidden">
        <button
          onClick={() => setDirection('draw')}
          className="w-full px-4 py-3 flex items-center gap-3 text-left"
          style={direction === 'draw'
            ? { backgroundColor: accent.soft }
            : undefined
          }
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: direction === 'draw' ? accent.primary : 'var(--bg)',
              color: direction === 'draw' ? accent.primaryFg : 'var(--text-muted, #7a8a8c)',
            }}
          >
            <Briefcase size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium flex items-center gap-1.5">
              Owner draw
              <ArrowRight size={11} className="text-muted" />
              <span className="text-muted text-xs">Personal</span>
            </div>
            <div className="text-[11px] text-muted">
              Take money out of AVS into your Personal pool
            </div>
          </div>
        </button>

        <div className="h-px bg-[var(--border)]" />

        <button
          onClick={() => setDirection('injection')}
          className="w-full px-4 py-3 flex items-center gap-3 text-left"
          style={direction === 'injection'
            ? { backgroundColor: accent.soft }
            : undefined
          }
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: direction === 'injection' ? accent.primary : 'var(--bg)',
              color: direction === 'injection' ? accent.primaryFg : 'var(--text-muted, #7a8a8c)',
            }}
          >
            <Wallet size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium flex items-center gap-1.5">
              Capital injection
              <ArrowLeft size={11} className="text-muted" />
              <span className="text-muted text-xs">Personal</span>
            </div>
            <div className="text-[11px] text-muted">
              Fund AVS from your Personal savings
            </div>
          </div>
        </button>
      </div>

      {/* Form */}
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
        <FormRow label="Amount">
          <input
            type="number"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0"
            className="form-input text-xl font-display"
          />
        </FormRow>
        <FormRow label="Currency">
          <select
            value={form.currency}
            onChange={(e) => set('currency', e.target.value)}
            className="form-input"
          >
            <option value="HTG">HTG</option>
            <option value="USD">USD</option>
            <option value="HTD">HTD</option>
          </select>
        </FormRow>
        <FormRow label="Date">
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="form-input"
          />
        </FormRow>
        <FormRow label="Notes">
          <input
            type="text"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Reason for transfer..."
            className="form-input"
          />
        </FormRow>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!form.amount || Number(form.amount) <= 0}
        className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
        style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
      >
        <ArrowLeftRight size={14} />
        {direction === 'draw' ? 'Record owner draw' : 'Record capital injection'}
      </button>

      {/* Info card */}
      <div
        className="rounded-2xl p-3 border flex items-start gap-2"
        style={{
          backgroundColor: '#d4a94215',
          borderColor: '#d4a94244',
        }}
      >
        <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: '#d4a942' }} />
        <div className="text-[11px] leading-relaxed text-muted">
          <span className="font-medium" style={{ color: 'var(--text)' }}>How this works:</span>{' '}
          A single transfer creates TWO linked entries — one in each workspace — sharing a tag ID.
          Both update sync independently, so a sync error on one side won't corrupt the other.
          The pair will appear in both AVS History and Personal History tabs.
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[11px] text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}
