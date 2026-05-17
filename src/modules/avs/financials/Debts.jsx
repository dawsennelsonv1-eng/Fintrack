// src/modules/avs/financials/Debts.jsx
// Tier 5f-final — AVS Debts sub-tab
//
// Tracks supplier debts and client deposits owed back, separate from
// Personal debts so AVS P&L stays clean.
//
// Two filter pills: 'You owe' vs 'Owed to you' (direction).
// Tap any debt → detail sheet with repayment history + log new payment.
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Trash2, CreditCard, ArrowDownLeft,
  ArrowUpRight, AlertCircle, Check,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';

const ws = () => getWorkspace('avs');
const HTG_PER_USD = 150;

const DEBT_KINDS = [
  { id: 'supplier',        label: 'Supplier' },
  { id: 'client_deposit',  label: 'Client deposit' },
  { id: 'loan',            label: 'Loan' },
  { id: 'other',           label: 'Other' },
];

function fmtAmount(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return ''; }
}

export default function Debts() {
  const debts = useStore((s) => s.business?.businessDebts || []);
  const events = useStore((s) => s.business?.businessDebtEvents || []);
  const [filter, setFilter] = useState('owe'); // 'owe' | 'receivable'
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const accent = ws().accent;

  // Compute balance for each debt
  const debtsWithBalance = useMemo(() => {
    return debts.map((d) => {
      const debtEvents = events.filter((e) => e.debtId === d.id);
      const repaid = debtEvents
        .filter((e) => e.type === 'repayment')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const balance = Math.max(0, (Number(d.principal) || 0) - repaid);
      return { ...d, balance, repaid, eventCount: debtEvents.length };
    });
  }, [debts, events]);

  const filtered = useMemo(() => {
    return debtsWithBalance
      .filter((d) => d.direction === filter)
      .sort((a, b) => {
        // Open first, paid last; within open, biggest balance first
        if (a.status === 'paid' && b.status !== 'paid') return 1;
        if (b.status === 'paid' && a.status !== 'paid') return -1;
        return b.balance - a.balance;
      });
  }, [debtsWithBalance, filter]);

  const totalOwed = useMemo(() => {
    return debtsWithBalance
      .filter((d) => d.direction === 'owe' && d.status !== 'paid')
      .reduce((s, d) => {
        const inHTG = d.currency === 'USD' ? d.balance * HTG_PER_USD : d.balance;
        return s + inHTG;
      }, 0);
  }, [debtsWithBalance]);

  const totalReceivable = useMemo(() => {
    return debtsWithBalance
      .filter((d) => d.direction === 'receivable' && d.status !== 'paid')
      .reduce((s, d) => {
        const inHTG = d.currency === 'USD' ? d.balance * HTG_PER_USD : d.balance;
        return s + inHTG;
      }, 0);
  }, [debtsWithBalance]);

  const openDebt = debtsWithBalance.find((d) => d.id === editingId);

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={ArrowUpRight}
          label="You owe"
          value={`${fmtAmount(totalOwed)} HTG`}
          color="#c2452f"
          active={filter === 'owe'}
          onClick={() => setFilter('owe')}
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Owed to you"
          value={`${fmtAmount(totalReceivable)} HTG`}
          color="#3d8b5f"
          active={filter === 'receivable'}
          onClick={() => setFilter('receivable')}
        />
      </div>

      {/* Add button + list header */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
          {filter === 'owe' ? 'Suppliers & loans' : 'Client deposits & receivables'}
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="text-[11px] font-medium flex items-center gap-1"
          style={{ color: accent.primary }}
        >
          <Plus size={11} />
          Add
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: accent.soft, color: accent.primary }}
          >
            <CreditCard size={20} />
          </div>
          <div className="font-medium text-sm">
            No {filter === 'owe' ? 'debts owed' : 'receivables'}
          </div>
          <p className="text-xs text-muted mt-1">Tap + to add one</p>
        </div>
      ) : (
        <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {filtered.map((d) => (
            <DebtRow key={d.id} debt={d} onOpen={() => setEditingId(d.id)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {openDebt && (
          <DebtDetail debt={openDebt} events={events.filter((e) => e.debtId === openDebt.id)} onClose={() => setEditingId(null)} />
        )}
        {addingNew && (
          <DebtDetail debt={null} events={[]} onClose={() => setAddingNew(false)} defaultDirection={filter} />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="surface border rounded-2xl p-3 text-left active:scale-[0.99] transition-transform"
      style={active ? { borderColor: color + '66', backgroundColor: color + '08' } : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '22', color }}
        >
          <Icon size={11} />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      </div>
      <div className="font-display text-lg leading-tight" style={{ color: active ? color : 'var(--text)' }}>
        {value}
      </div>
    </button>
  );
}

function DebtRow({ debt, onOpen }) {
  const accent = ws().accent;
  const isPaid = debt.status === 'paid';
  const isPartial = debt.status === 'partial';

  return (
    <button
      onClick={onOpen}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`text-sm font-medium truncate ${isPaid ? 'line-through opacity-60' : ''}`}>
            {debt.creditor || '(no creditor)'}
          </div>
          {isPartial && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider"
              style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}
            >
              partial
            </span>
          )}
          {isPaid && (
            <Check size={11} style={{ color: '#3d8b5f' }} />
          )}
        </div>
        <div className="text-[11px] text-muted truncate">
          {DEBT_KINDS.find((k) => k.id === debt.kind)?.label || debt.kind}
          {debt.dueDate && <> · due {fmtDate(debt.dueDate)}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-display text-base leading-tight ${isPaid ? 'opacity-50' : ''}`}>
          {fmtAmount(debt.balance)}
          <span className="text-[10px] text-muted font-sans ml-1">{debt.currency}</span>
        </div>
        {debt.repaid > 0 && !isPaid && (
          <div className="text-[10px] text-muted mt-0.5">
            of {fmtAmount(debt.principal)}
          </div>
        )}
      </div>
    </button>
  );
}

function DebtDetail({ debt, events, onClose, defaultDirection = 'owe' }) {
  const isNew = !debt;
  const addBusinessDebt = useStore((s) => s.addBusinessDebt);
  const updateBusinessDebt = useStore((s) => s.updateBusinessDebt);
  const removeBusinessDebt = useStore((s) => s.removeBusinessDebt);
  const repayBusinessDebt = useStore((s) => s.repayBusinessDebt);
  const accent = ws().accent;

  const [form, setForm] = useState(() => ({
    creditor: debt?.creditor || '',
    principal: debt?.principal || 0,
    currency: debt?.currency || 'HTG',
    direction: debt?.direction || defaultDirection,
    kind: debt?.kind || 'supplier',
    dueDate: debt?.dueDate ? debt.dueDate.slice(0, 10) : '',
    interestRate: debt?.interestRate || 0,
    interestType: debt?.interestType || 'simple',
    notes: debt?.notes || '',
  }));
  const [repayAmount, setRepayAmount] = useState('');
  const [repayNote, setRepayNote] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (isNew) {
      addBusinessDebt(form);
    } else {
      updateBusinessDebt(debt.id, form);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!debt) return;
    if (!confirm(`Delete debt for ${debt.creditor || 'this entry'}?`)) return;
    removeBusinessDebt(debt.id);
    onClose();
  };

  const handleRepay = () => {
    const amt = Number(repayAmount) || 0;
    if (amt <= 0) {
      alert('Enter a repayment amount greater than 0.');
      return;
    }
    repayBusinessDebt(debt.id, amt, repayNote);
    setRepayAmount('');
    setRepayNote('');
  };

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [events]
  );

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
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col"
      >
        <div className="surface border-t rounded-t-3xl flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">
              {isNew ? 'New debt' : form.creditor || 'Debt'}
            </div>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
            >
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Direction toggle */}
            <div className="surface border rounded-2xl p-1 grid grid-cols-2 gap-0.5">
              <button
                onClick={() => set('direction', 'owe')}
                className="py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                style={form.direction === 'owe'
                  ? { backgroundColor: '#c2452f', color: '#fff' }
                  : { color: 'var(--text-muted, #7a8a8c)' }
                }
              >
                <ArrowUpRight size={11} />
                You owe
              </button>
              <button
                onClick={() => set('direction', 'receivable')}
                className="py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                style={form.direction === 'receivable'
                  ? { backgroundColor: '#3d8b5f', color: '#fff' }
                  : { color: 'var(--text-muted, #7a8a8c)' }
                }
              >
                <ArrowDownLeft size={11} />
                Owed to you
              </button>
            </div>

            {/* Repayment section (only for existing debts that aren't paid) */}
            {!isNew && debt.status !== 'paid' && (
              <Section title={`Log ${debt.direction === 'owe' ? 'payment' : 'collection'}`}>
                <Field label="Amount">
                  <input
                    type="number" inputMode="decimal"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    placeholder={`Balance: ${fmtAmount(debt.balance)} ${debt.currency}`}
                    className="form-input"
                  />
                </Field>
                <Field label="Note">
                  <input
                    type="text"
                    value={repayNote}
                    onChange={(e) => setRepayNote(e.target.value)}
                    placeholder="optional"
                    className="form-input"
                  />
                </Field>
                <div className="px-3 py-2">
                  <button
                    onClick={handleRepay}
                    className="w-full py-2 rounded-xl text-xs font-medium"
                    style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
                  >
                    Record {debt.direction === 'owe' ? 'payment' : 'collection'}
                  </button>
                </div>
              </Section>
            )}

            <Section title="Debt details">
              <Field label="Creditor / debtor name">
                <input type="text" value={form.creditor}
                  onChange={(e) => set('creditor', e.target.value)}
                  className="form-input" placeholder="Supplier name, client name, etc."
                />
              </Field>
              <Field label="Kind">
                <select value={form.kind} onChange={(e) => set('kind', e.target.value)} className="form-input">
                  {DEBT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </Field>
              <Field label="Principal amount">
                <input type="number" inputMode="decimal" value={form.principal}
                  onChange={(e) => set('principal', Number(e.target.value))}
                  className="form-input"
                />
              </Field>
              <Field label="Currency">
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="form-input">
                  <option value="HTG">HTG</option>
                  <option value="USD">USD</option>
                  <option value="HTD">HTD</option>
                </select>
              </Field>
              <Field label="Due date">
                <input type="date" value={form.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="Interest rate (%)">
                <input type="number" inputMode="decimal" value={form.interestRate}
                  onChange={(e) => set('interestRate', Number(e.target.value))}
                  className="form-input"
                  placeholder="0 = no interest"
                />
              </Field>
              {form.interestRate > 0 && (
                <Field label="Interest type">
                  <select value={form.interestType} onChange={(e) => set('interestType', e.target.value)} className="form-input">
                    <option value="simple">Simple</option>
                    <option value="compound">Compound</option>
                  </select>
                </Field>
              )}
              <Field label="Notes">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
                  rows={2} className="form-input resize-none"
                />
              </Field>
            </Section>

            {/* Event history */}
            {!isNew && sortedEvents.length > 0 && (
              <Section title="History">
                {sortedEvents.map((e) => (
                  <div key={e.id} className="px-3 py-2.5 flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#3d8b5f22', color: '#3d8b5f' }}
                    >
                      <Check size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {fmtAmount(e.amount)} {e.currency}
                      </div>
                      <div className="text-[11px] text-muted">
                        {fmtDate(e.date)}
                        {e.notes && <> · {e.notes}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {!isNew && (
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl border text-sm flex items-center justify-center gap-2"
                style={{ borderColor: 'var(--border)', color: '#c2452f' }}
              >
                <Trash2 size={14} />
                Delete debt
              </button>
            )}

            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
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
