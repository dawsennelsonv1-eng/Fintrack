// src/modules/recharge/financials/Payouts.jsx
//
// CEO payout system for Recharge.
//   • Config card: cycleDays (15 or 30), ceoSplitPct (default 0.75), commissionRate (default 0.25)
//   • Propose payout card: shows current cycle bounds + computed amounts
//     - tap Record to confirm taking the payout (creates Personal income tx + Recharge payout entry)
//     - tap Skip to mark cycle as skipped (you didn't take it)
//   • History: previous payouts (recorded + skipped), edit, delete
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowLeft, Trash2, CheckCircle2, Settings, ChevronRight,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import { useAvsCurrency } from '../../avs/useAvsCurrency';
import { parseDate, isTermine } from '../useRechargeData';

const ws = () => getWorkspace('recharge');
const HTG_PER_USD = 150;

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return ''; }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Payouts() {
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  // BUG FIX: don't call an action inside a selector. Select raw state,
  // compute the config object inside useMemo so it's stable across renders.
  const rechargeConfigArr = useStore((s) => s.business?.rechargeConfig || []);
  const saveConfig = useStore((s) => s.saveRechargeConfig);
  const recordPayout = useStore((s) => s.recordRechargePayout);
  const updatePayout = useStore((s) => s.updateRechargePayout);
  const removePayout = useStore((s) => s.removeRechargePayout);
  const payouts = useStore((s) => s.business?.rechargePayouts || []);
  const orders = useStore((s) => s.business?.rechargeOrders || []);
  const commissions = useStore((s) => s.business?.rechargeCommissions || []);
  const expenses = useStore((s) => s.business?.businessExpenses || []);
  const addTransaction = useStore((s) => s.addTransaction);

  const config = useMemo(() => {
    if (Array.isArray(rechargeConfigArr) && rechargeConfigArr.length > 0) {
      return rechargeConfigArr[0];
    }
    return {
      id: 'default',
      cycleDays: 30,
      ceoSplitPct: 0.75,
      commissionRate: 0.25,
      cycleStartDate: todayISO(),
      lastPayoutDate: '',
      currency: 'HTG',
      notes: '',
    };
  }, [rechargeConfigArr]);

  const [showConfig, setShowConfig] = useState(false);
  const [editId, setEditId] = useState(null);

  // Compute current cycle window
  const cycle = useMemo(() => {
    const cycleDays = Number(config.cycleDays) || 30;
    const lastPayout = config.lastPayoutDate || config.cycleStartDate || todayISO();
    const cycleStart = lastPayout;
    const cycleEnd = addDays(cycleStart, cycleDays);
    const today = todayISO();
    const isDue = today >= cycleEnd;
    const daysUntilDue = Math.max(0, Math.ceil(
      (new Date(cycleEnd) - new Date(today)) / (1000 * 60 * 60 * 24)
    ));
    return { cycleStart, cycleEnd, cycleDays, isDue, daysUntilDue };
  }, [config]);

  // Compute proposed payout amounts (preview)
  const proposed = useMemo(() => {
    const from = new Date(cycle.cycleStart);
    const to = new Date(cycle.cycleEnd);
    to.setHours(23, 59, 59, 999);
    const inR = (v) => {
      if (!v) return false;
      const d = parseDate(v);
      return d && d >= from && d <= to;
    };

    let benefitsTotal = 0;
    orders.forEach((o) => {
      if (!isTermine(o)) return;
      if (!inR(o.date)) return;
      benefitsTotal += Number(o.profit) || 0;
    });

    let commissionsPaid = 0;
    commissions.forEach((c) => {
      if (c.status !== 'paid') return;
      if (!inR(c.paidDate)) return;
      commissionsPaid += Number(c.commissionAmount) || 0;
    });

    let expensesPaid = 0;
    expenses.forEach((e) => {
      if (!inR(e.date)) return;
      const tag = (String(e.notes || '') + ' ' + String(e.description || '')).toLowerCase();
      if (!tag.includes('recharge')) return;
      const amtHtg = e.currency === 'USD'
        ? (Number(e.amount) || 0) * HTG_PER_USD
        : (Number(e.amount) || 0);
      expensesPaid += amtHtg;
    });

    const netAfterCosts = benefitsTotal - commissionsPaid - expensesPaid;
    const ceoSplit = Number(config.ceoSplitPct) || 0.75;
    const ceoAmount = Math.round(netAfterCosts * ceoSplit);
    const businessReserve = Math.round(netAfterCosts * (1 - ceoSplit));

    return {
      benefitsTotal: Math.round(benefitsTotal),
      commissionsPaid: Math.round(commissionsPaid),
      expensesPaid: Math.round(expensesPaid),
      netAfterCosts: Math.round(netAfterCosts),
      ceoAmount,
      businessReserve,
    };
  }, [cycle.cycleStart, cycle.cycleEnd, orders, commissions, expenses, config.ceoSplitPct]);

  const handleRecord = () => {
    if (!confirm(`Record CEO payout of ${fmtCompact(proposed.ceoAmount, 'HTG')}? This adds an income transaction to your Personal workspace and updates the cycle clock.`)) return;
    const payout = recordPayout({
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: 'recorded',
      notes: 'Recharge CEO payout',
    });

    // Add Personal income tx
    if (proposed.ceoAmount > 0) {
      addTransaction({
        type: 'income',
        category: 'Salary',
        amount: proposed.ceoAmount,
        currency: 'HTG',
        date: cycle.cycleEnd,
        notes: `Recharge CEO payout · cycle ${cycle.cycleStart} → ${cycle.cycleEnd}`,
      });
    }
  };

  const handleSkip = () => {
    if (!confirm("Skip this cycle? Marks it as skipped (you didn't take the payout) but advances the cycle clock.")) return;
    recordPayout({
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: 'skipped',
      notes: 'Skipped',
    });
  };

  const editing = payouts.find((p) => p.id === editId);

  return (
    <div className="space-y-4">
      {/* Config card */}
      <div className="surface border rounded-2xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: accent.soft, color: accent.primary }}>
          <Settings size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {cycle.cycleDays}-day cycle · {Math.round((Number(config.ceoSplitPct) || 0.75) * 100)}% to you
          </div>
          <div className="text-[11px] text-muted">
            Marc gets {Math.round((Number(config.commissionRate) || 0.25) * 100)}% of each order's benefit
          </div>
        </div>
        <button onClick={() => setShowConfig(true)}
          className="text-[11px] font-medium" style={{ color: accent.primary }}>
          Edit
        </button>
      </div>

      {/* Proposed payout card */}
      <div className="rounded-2xl p-5 border"
        style={{
          backgroundColor: cycle.isDue ? accent.soft : 'var(--surface)',
          borderColor: cycle.isDue ? accent.primary + '66' : 'var(--border)',
        }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
            <Wallet size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-0.5">
              {cycle.isDue ? 'Payout ready' : 'Current cycle'}
            </div>
            <div className="font-display text-2xl leading-tight" style={{ color: accent.primary }}>
              {fmtCompact(proposed.ceoAmount, 'HTG')}
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              {fmtDate(cycle.cycleStart)} → {fmtDate(cycle.cycleEnd)}
              {!cycle.isDue && (
                <> · {cycle.daysUntilDue} days remaining</>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1 mb-3 text-[12px]">
          <RowMini label="Benefits in cycle" value={fmtCompact(proposed.benefitsTotal, 'HTG')} />
          <RowMini label="−  Marc paid" value={fmtCompact(proposed.commissionsPaid, 'HTG')} sign="−" />
          <RowMini label="−  Expenses paid" value={fmtCompact(proposed.expensesPaid, 'HTG')} sign="−" />
          <div className="h-px bg-[var(--border)] my-1" />
          <RowMini label="Net after costs"
            value={fmtCompact(proposed.netAfterCosts, 'HTG')} bold />
          <RowMini label={`Your share (${Math.round((Number(config.ceoSplitPct) || 0.75) * 100)}%)`}
            value={fmtCompact(proposed.ceoAmount, 'HTG')}
            color={accent.primary} bold />
          <RowMini label={`Business reserve (${Math.round((1 - (Number(config.ceoSplitPct) || 0.75)) * 100)}%)`}
            value={fmtCompact(proposed.businessReserve, 'HTG')} />
        </div>

        <div className="flex gap-2">
          <button onClick={handleRecord}
            disabled={proposed.ceoAmount <= 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
            <CheckCircle2 size={14} />
            Record payout
          </button>
          <button onClick={handleSkip}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted, #7a8a8c)' }}>
            Skip
          </button>
        </div>

        {proposed.ceoAmount <= 0 && (
          <div className="text-[10px] text-muted mt-2 text-center">
            No payout available — net is zero or negative
          </div>
        )}
      </div>

      {/* History */}
      {payouts.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
            Payout history
          </div>
          <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
            {payouts.slice(0, 20).map((p) => (
              <PayoutRow key={p.id} payout={p}
                onEdit={() => setEditId(p.id)}
                fmt={fmtCompact} accent={accent} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showConfig && (
          <ConfigSheet config={config} onSave={saveConfig} onClose={() => setShowConfig(false)} />
        )}
        {editing && (
          <PayoutEditSheet payout={editing}
            onClose={() => setEditId(null)}
            onDelete={() => {
              if (confirm('Delete this payout record? The Personal income tx is NOT removed.')) {
                removePayout(editing.id);
                setEditId(null);
              }
            }}
            onSave={(patch) => {
              updatePayout(editing.id, patch);
              setEditId(null);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function RowMini({ label, value, color, bold, sign }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted">{label}</div>
      <div className={bold ? 'font-medium' : ''} style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function PayoutRow({ payout, onEdit, fmt, accent }) {
  const recorded = payout.status === 'recorded';
  return (
    <button onClick={onEdit}
      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: recorded ? '#3d8b5f22' : '#7a8a8c22',
          color: recorded ? '#3d8b5f' : '#7a8a8c',
        }}>
        {recorded ? <CheckCircle2 size={13} /> : <ChevronRight size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {recorded ? fmt(payout.ceoAmount, 'HTG') : 'Skipped'}
          {recorded && <span className="text-[10px] text-muted ml-1.5">payout</span>}
        </div>
        <div className="text-[11px] text-muted truncate">
          {fmtDate(payout.cycleStart)} → {fmtDate(payout.cycleEnd)}
        </div>
      </div>
      <div className="text-[10px] text-muted shrink-0">
        {payout.netAfterCosts != null && (
          <>net {fmt(payout.netAfterCosts, 'HTG')}</>
        )}
      </div>
    </button>
  );
}

function ConfigSheet({ config, onSave, onClose }) {
  const accent = ws().accent;
  const [form, setForm] = useState({
    cycleDays: config.cycleDays || 30,
    ceoSplitPct: Math.round((Number(config.ceoSplitPct) || 0.75) * 100),
    commissionRate: Math.round((Number(config.commissionRate) || 0.25) * 100),
    cycleStartDate: config.cycleStartDate || todayISO(),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => {
    onSave({
      cycleDays: Number(form.cycleDays),
      ceoSplitPct: Number(form.ceoSplitPct) / 100,
      commissionRate: Number(form.commissionRate) / 100,
      cycleStartDate: form.cycleStartDate,
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
            <div className="font-medium text-sm">Payout config</div>
            <button onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
              Save
            </button>
          </div>
          <div className="p-4 overflow-y-auto space-y-3">
            <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-2">Cycle length</div>
                <div className="grid grid-cols-2 gap-2">
                  {[15, 30].map((days) => (
                    <button key={days} onClick={() => set('cycleDays', days)}
                      className="py-2 rounded-xl text-sm font-medium border"
                      style={Number(form.cycleDays) === days
                        ? { backgroundColor: accent.primary, color: accent.primaryFg, borderColor: accent.primary }
                        : { borderColor: 'var(--border)' }}>
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">CEO share (%)</div>
                <input type="number" inputMode="decimal" min={0} max={100}
                  value={form.ceoSplitPct}
                  onChange={(e) => set('ceoSplitPct', e.target.value)}
                  className="form-input" />
                <div className="text-[10px] text-muted mt-1">
                  Business reserve gets the rest ({100 - Number(form.ceoSplitPct)}%)
                </div>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">Marc's commission (%)</div>
                <input type="number" inputMode="decimal" min={0} max={100}
                  value={form.commissionRate}
                  onChange={(e) => set('commissionRate', e.target.value)}
                  className="form-input" />
                <div className="text-[10px] text-muted mt-1">
                  Of each order's benefits — applies to new commissions only
                </div>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">Cycle anchor date</div>
                <input type="date" value={form.cycleStartDate}
                  onChange={(e) => set('cycleStartDate', e.target.value)}
                  className="form-input" />
              </div>
            </div>
            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}

function PayoutEditSheet({ payout, onClose, onSave, onDelete }) {
  const accent = ws().accent;
  const [form, setForm] = useState({
    notes: payout.notes || '',
    status: payout.status,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
            <div className="font-medium text-sm">Edit payout</div>
            <button onClick={() => onSave(form)}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
              Save
            </button>
          </div>
          <div className="p-4 overflow-y-auto space-y-3">
            <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">Status</div>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}
                  className="form-input">
                  <option value="recorded">Recorded</option>
                  <option value="skipped">Skipped</option>
                  <option value="proposed">Proposed</option>
                </select>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[11px] text-muted mb-1">Notes</div>
                <input type="text" value={form.notes}
                  onChange={(e) => set('notes', e.target.value)} className="form-input" />
              </div>
            </div>

            <div className="surface border rounded-2xl p-3 text-[11px] text-muted space-y-1">
              <div>Cycle: {fmtDate(payout.cycleStart)} → {fmtDate(payout.cycleEnd)}</div>
              <div>Benefits in cycle: {payout.benefitsTotal} HTG</div>
              <div>Marc paid: {payout.commissionsPaid} HTG</div>
              <div>Expenses: {payout.expensesPaid} HTG</div>
              <div>Net: {payout.netAfterCosts} HTG</div>
              <div>Your share: {payout.ceoAmount} HTG</div>
              <div>Reserve: {payout.businessReserve} HTG</div>
            </div>

            <button onClick={onDelete}
              className="w-full py-3 rounded-xl border text-sm flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--border)', color: '#c2452f' }}>
              <Trash2 size={14} />
              Delete payout record
            </button>

            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}
