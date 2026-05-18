// src/modules/avs/financials/Expenses.jsx
// Tier 5f-final — AVS Operating Expenses
//
// Tracks recurring + one-off business costs that aren't already covered
// by Salaries (commissions/payroll) or Ads (ad spend). Things like:
//   • Rent, internet, phone
//   • Equipment, transport
//   • Office supplies, software subscriptions
//
// MTD total surfaces in the Dashboard's profit calculation automatically
// once the businessSlice is wired and the expenses flow through P&L.
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Trash2, Receipt, Repeat, Calendar,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import { useAvsCurrency } from '../useAvsCurrency';

const ws = () => getWorkspace('avs');
const HTG_PER_USD = 150;

const CATEGORIES = [
  { id: 'rent',         label: 'Rent',         emoji: '🏠' },
  { id: 'internet',     label: 'Internet',     emoji: '📶' },
  { id: 'phone',        label: 'Phone',        emoji: '📞' },
  { id: 'equipment',    label: 'Equipment',    emoji: '🛠️' },
  { id: 'transport',    label: 'Transport',    emoji: '🚗' },
  { id: 'supplies',     label: 'Supplies',     emoji: '📦' },
  { id: 'software',     label: 'Software',     emoji: '💻' },
  { id: 'utilities',    label: 'Utilities',    emoji: '⚡' },
  { id: 'professional', label: 'Pro services', emoji: '💼' },
  { id: 'other',        label: 'Other',        emoji: '📋' },
];

const RECURRENCES = [
  { id: 'one-off', label: 'One-off' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 25000 && v < 100000) {
    return new Date((v - 25569) * 86400 * 1000);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function Expenses() {
  const expenses = useStore((s) => s.business?.businessExpenses || []);
  const [filter, setFilter] = useState('all'); // 'all' | 'recurring' | 'one-off' | <category>
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();

  const filtered = useMemo(() => {
    return [...expenses]
      .filter((e) => {
        if (filter === 'all') return true;
        if (filter === 'recurring') return e.recurring && e.recurring !== 'one-off';
        if (filter === 'one-off') return !e.recurring || e.recurring === 'one-off';
        return e.category === filter;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, filter]);

  const monthStats = useMemo(() => {
    const from = startOfMonth();
    let mtdTotal = 0;
    expenses.forEach((e) => {
      const d = parseDate(e.date);
      if (!d || d < from) return;
      const inHTG = e.currency === 'USD'
        ? (Number(e.amount) || 0) * HTG_PER_USD
        : (Number(e.amount) || 0);
      mtdTotal += inHTG;
    });

    // Estimated monthly recurring (sum of all monthlies + weekly*4)
    let monthlyEstimate = 0;
    expenses.forEach((e) => {
      const inHTG = e.currency === 'USD'
        ? (Number(e.amount) || 0) * HTG_PER_USD
        : (Number(e.amount) || 0);
      if (e.recurring === 'monthly') monthlyEstimate += inHTG;
      else if (e.recurring === 'weekly') monthlyEstimate += inHTG * 4;
    });

    return { mtdTotal, monthlyEstimate, count: expenses.length };
  }, [expenses]);

  const openExpense = expenses.find((e) => e.id === editingId);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="surface border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#c2452f22', color: '#c2452f' }}
            >
              <Calendar size={11} />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">MTD</div>
          </div>
          <div className="font-display text-lg leading-tight">
            {fmtCompact(monthStats.mtdTotal, 'HTG')}
          </div>
        </div>
        <div className="surface border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: accent.soft, color: accent.primary }}
            >
              <Repeat size={11} />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Monthly est.</div>
          </div>
          <div className="font-display text-lg leading-tight">
            {fmtCompact(monthStats.monthlyEstimate, 'HTG')}
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
          {filter === 'all' ? `${filtered.length} expenses` :
           filter === 'recurring' ? 'Recurring' :
           filter === 'one-off' ? 'One-off' :
           CATEGORIES.find((c) => c.id === filter)?.label || filter}
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

      {/* Filter pills */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1.5" style={{ minWidth: 'min-content' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'recurring', label: 'Recurring' },
            { id: 'one-off', label: 'One-off' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                filter === f.id ? '' : 'surface border text-muted'
              }`}
              style={filter === f.id
                ? { backgroundColor: accent.primary, color: accent.primaryFg }
                : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: accent.soft, color: accent.primary }}
          >
            <Receipt size={20} />
          </div>
          <div className="font-medium text-sm">No expenses logged</div>
          <p className="text-xs text-muted mt-1">Tap + to log your first one</p>
        </div>
      ) : (
        <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {filtered.map((e) => (
            <ExpenseRow key={e.id} exp={e} onOpen={() => setEditingId(e.id)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {openExpense && <ExpenseDetail expense={openExpense} onClose={() => setEditingId(null)} />}
        {addingNew && <ExpenseDetail expense={null} onClose={() => setAddingNew(false)} />}
      </AnimatePresence>
    </div>
  );
}

function ExpenseRow({ exp, onOpen }) {
  const cat = CATEGORIES.find((c) => c.id === exp.category) || CATEGORIES[CATEGORIES.length - 1];
  const { fmtCompact } = useAvsCurrency();

  return (
    <button
      onClick={onOpen}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-[var(--bg)] flex items-center justify-center shrink-0 text-base">
        {cat.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">
            {exp.description || cat.label}
          </div>
          {exp.recurring && exp.recurring !== 'one-off' && (
            <Repeat size={10} className="text-muted shrink-0" />
          )}
        </div>
        <div className="text-[11px] text-muted truncate">
          {cat.label} · {fmtDate(exp.date)}
          {exp.paidTo && <> · {exp.paidTo}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-base leading-tight">
          {fmtCompact(exp.amount, exp.currency || 'HTG')}
        </div>
      </div>
    </button>
  );
}

function ExpenseDetail({ expense, onClose }) {
  const isNew = !expense;
  const addBusinessExpense = useStore((s) => s.addBusinessExpense);
  const updateBusinessExpense = useStore((s) => s.updateBusinessExpense);
  const removeBusinessExpense = useStore((s) => s.removeBusinessExpense);
  const accent = ws().accent;

  const [form, setForm] = useState(() => ({
    date: expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    category: expense?.category || 'rent',
    description: expense?.description || '',
    amount: expense?.amount || 0,
    currency: expense?.currency || 'HTG',
    recurring: expense?.recurring || 'one-off',
    paidTo: expense?.paidTo || '',
    paymentMethod: expense?.paymentMethod || '',
    notes: expense?.notes || '',
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.amount || Number(form.amount) <= 0) {
      alert('Enter an amount greater than 0.');
      return;
    }
    if (isNew) addBusinessExpense(form);
    else updateBusinessExpense(expense.id, form);
    onClose();
  };

  const handleDelete = () => {
    if (!expense) return;
    if (!confirm('Delete this expense?')) return;
    removeBusinessExpense(expense.id);
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
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col"
      >
        <div className="surface border-t rounded-t-3xl flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">
              {isNew ? 'New expense' : form.description || 'Expense'}
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
            {/* Category grid */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">
                Category
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => set('category', c.id)}
                    className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-95"
                    style={form.category === c.id
                      ? { backgroundColor: accent.soft, borderColor: accent.primary + '66' }
                      : { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }
                    }
                  >
                    <span className="text-lg">{c.emoji}</span>
                    <span className="text-[8px] text-muted font-medium leading-none">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Section title="Amount">
              <Field label="Amount">
                <input
                  type="number" inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  className="form-input text-xl font-display"
                />
              </Field>
              <Field label="Currency">
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="form-input">
                  <option value="HTG">HTG</option>
                  <option value="USD">USD</option>
                  <option value="HTD">HTD</option>
                </select>
              </Field>
              <Field label="Date">
                <input type="date" value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="Recurring?">
                <select value={form.recurring} onChange={(e) => set('recurring', e.target.value)} className="form-input">
                  {RECURRENCES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Field>
            </Section>

            <Section title="Details">
              <Field label="Description">
                <input type="text" value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="form-input" placeholder="What was this for?"
                />
              </Field>
              <Field label="Paid to">
                <input type="text" value={form.paidTo}
                  onChange={(e) => set('paidTo', e.target.value)}
                  className="form-input" placeholder="Vendor / landlord / provider"
                />
              </Field>
              <Field label="Payment method">
                <input type="text" value={form.paymentMethod}
                  onChange={(e) => set('paymentMethod', e.target.value)}
                  className="form-input" placeholder="MonCash, cash, bank transfer..."
                />
              </Field>
              <Field label="Notes">
                <textarea value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2} className="form-input resize-none"
                />
              </Field>
            </Section>

            {!isNew && (
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl border text-sm flex items-center justify-center gap-2"
                style={{ borderColor: 'var(--border)', color: '#c2452f' }}
              >
                <Trash2 size={14} />
                Delete expense
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
