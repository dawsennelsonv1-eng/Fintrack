// src/modules/avs/Clients.jsx
// Tier 5c + Tier 5g — Clients module with long-press status menu
//
// Three views:
//   • Kanban — columns by leadStatus; tap = open detail, long-press = quick status menu
//   • List   — searchable filterable table
//   • Detail — full lead edit form, opened on tap
//
// Data source: useStore().business.leads (synced live from SALES_PIPELINE
// via businessSlice.hydrateBusinessFromServer)
//
// Long-press (450ms) on a kanban card surfaces a quick-status bottom sheet
// so you can move a lead between statuses without opening the full detail.
// Faster than drag-and-drop on mobile, more reliable than touch-DnD.
//
import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, X, ChevronRight, User, Trash2,
  LayoutGrid, List as ListIcon, ArrowLeft,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';

const ws = () => getWorkspace('avs');

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function AvsClients() {
  const leads = useStore((s) => s.business?.leads || []);
  const [view, setView] = useState('kanban');         // 'kanban' | 'list'
  const [filter, setFilter] = useState('all');         // 'all' | 'leads' | 'clients'
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);    // open detail
  const [addingNew, setAddingNew] = useState(false);

  const accent = ws().accent;

  // ─── Filtered list ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === 'clients' && l.leadStatus !== '✅ Terminé') return false;
      if (filter === 'leads' && l.leadStatus === '✅ Terminé') return false;
      if (!q) return true;
      return (
        String(l.client || '').toLowerCase().includes(q) ||
        String(l.whatsapp || '').toLowerCase().includes(q) ||
        String(l.source || '').toLowerCase().includes(q) ||
        String(l.notes || '').toLowerCase().includes(q)
      );
    });
  }, [leads, filter, search]);

  const openLead = leads.find((l) => l.id === editingId);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl leading-tight">Clients</h1>
          <p className="text-xs text-muted mt-0.5">
            {filtered.length} {filter === 'clients' ? 'clients' : 'leads'} ·{' '}
            {leads.filter((l) => l.leadStatus === '✅ Terminé').length} closed
          </p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
          aria-label="Add lead"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, WhatsApp, source..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl surface border text-sm focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': accent.primary }}
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

      {/* Filter pills + view toggle */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'leads', label: 'Leads' },
            { id: 'clients', label: 'Clients' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === p.id
                  ? 'text-white'
                  : 'surface border text-muted'
              }`}
              style={
                filter === p.id
                  ? { backgroundColor: accent.primary, color: accent.primaryFg }
                  : undefined
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 surface border rounded-full p-0.5 shrink-0">
          <button
            onClick={() => setView('kanban')}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={
              view === 'kanban'
                ? { backgroundColor: accent.soft, color: accent.primary }
                : undefined
            }
            aria-label="Kanban view"
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => setView('list')}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={
              view === 'list'
                ? { backgroundColor: accent.soft, color: accent.primary }
                : undefined
            }
            aria-label="List view"
          >
            <ListIcon size={13} />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {leads.length === 0 && (
        <div className="surface border rounded-2xl p-8 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: accent.soft, color: accent.primary }}
          >
            <User size={20} />
          </div>
          <div className="font-medium text-sm">No leads yet</div>
          <p className="text-xs text-muted mt-1">
            Tap + to add your first lead, or wait for the AVS sheet to sync (~20s)
          </p>
        </div>
      )}

      {leads.length > 0 && filtered.length === 0 && (
        <div className="surface border rounded-2xl p-6 text-center">
          <div className="text-sm text-muted">No matches</div>
        </div>
      )}

      {/* Body */}
      {filtered.length > 0 && (
        view === 'kanban'
          ? <KanbanView leads={filtered} onOpen={setEditingId} />
          : <ListView leads={filtered} onOpen={setEditingId} />
      )}

      {/* Detail sheet */}
      <AnimatePresence>
        {openLead && (
          <LeadDetail
            lead={openLead}
            onClose={() => setEditingId(null)}
          />
        )}
        {addingNew && (
          <LeadDetail
            lead={null}
            onClose={() => setAddingNew(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// KANBAN VIEW
// ════════════════════════════════════════════════════════════════════
function KanbanView({ leads, onOpen }) {
  const statuses = ws().leadStatuses;
  const accent = ws().accent;

  // Group leads by status
  const byStatus = useMemo(() => {
    const map = {};
    statuses.forEach((s) => { map[s.label] = []; });
    leads.forEach((l) => {
      const k = l.leadStatus || statuses[0].label;
      if (!map[k]) map[k] = [];
      map[k].push(l);
    });
    return map;
  }, [leads, statuses]);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-3 pb-2" style={{ minWidth: 'min-content' }}>
        {statuses.map((status) => {
          const cards = byStatus[status.label] || [];
          return (
            <div
              key={status.id}
              className="w-64 shrink-0 surface border rounded-2xl overflow-hidden"
            >
              <div
                className="px-3 py-2.5 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-xs font-medium">{status.label}</span>
                </div>
                <span className="text-[10px] text-muted">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                {cards.length === 0 && (
                  <div className="text-[10px] text-muted text-center py-4">empty</div>
                )}
                {cards.map((lead) => (
                  <KanbanCard key={lead.id} lead={lead} onOpen={() => onOpen(lead.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ lead, onOpen }) {
  const accent = ws().accent;
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  const handlePressStart = () => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen(true);
      // Haptic feedback (no-op on devices without vibrate)
      if (navigator.vibrate) navigator.vibrate(20);
    }, 450);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e) => {
    // Suppress click if long-press fired
    if (longPressFired.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressFired.current = false;
      return;
    }
    onOpen();
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full text-left bg-[var(--bg)] rounded-xl p-2.5 border hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer select-none"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="font-medium text-xs leading-tight truncate">
          {lead.client || '(no name)'}
        </div>
        <div className="text-[10px] text-muted mt-0.5 truncate">
          {lead.pack || lead.cardType || '—'}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted">
            {fmtDate(lead.date)}
          </span>
          {lead.totalPrice > 0 && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: accent.soft, color: accent.primary }}
            >
              {lead.totalPrice}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <QuickStatusMenu
            lead={lead}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// QUICK STATUS MENU (long-press)
// ════════════════════════════════════════════════════════════════════
function QuickStatusMenu({ lead, onClose }) {
  const statuses = ws().leadStatuses;
  const updateLead = useStore((s) => s.updateLead);
  const accent = ws().accent;

  const setStatus = (newStatus) => {
    if (newStatus !== lead.leadStatus) {
      updateLead(lead.id, { leadStatus: newStatus });
      if (navigator.vibrate) navigator.vibrate(15);
    }
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed inset-x-0 bottom-0 z-50 max-w-2xl mx-auto"
      >
        <div className="surface border-t rounded-t-3xl overflow-hidden mx-3 mb-3 rounded-3xl">
          <div className="px-4 pt-4 pb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
              Move to status
            </div>
            <div className="font-medium text-sm mt-0.5 truncate">
              {lead.client || '(no name)'}
            </div>
          </div>
          <div className="px-2 pb-2">
            {statuses.map((s) => {
              const isCurrent = s.label === lead.leadStatus;
              return (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.label)}
                  disabled={isCurrent}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                    isCurrent ? 'opacity-50' : 'hover:bg-[var(--bg)] active:bg-[var(--bg)]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1 text-left text-sm">{s.label}</span>
                  {isCurrent && (
                    <span className="text-[10px] text-muted">current</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 text-sm border-t font-medium"
            style={{
              color: 'var(--text-muted, #7a8a8c)',
              borderColor: 'var(--border)',
            }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// LIST VIEW
// ════════════════════════════════════════════════════════════════════
function ListView({ leads, onOpen }) {
  const sorted = useMemo(() =>
    [...leads].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [leads]
  );

  return (
    <div className="space-y-2">
      {sorted.map((lead) => (
        <ListRow key={lead.id} lead={lead} onOpen={() => onOpen(lead.id)} />
      ))}
    </div>
  );
}

function ListRow({ lead, onOpen }) {
  const status = ws().leadStatuses.find((s) => s.label === lead.leadStatus);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left surface border rounded-2xl p-3 flex items-center gap-3 hover:shadow-sm active:scale-[0.99] transition-all"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-display"
        style={{
          backgroundColor: (status?.color || '#7a8a8c') + '22',
          color: status?.color || '#7a8a8c',
        }}
      >
        {(lead.client || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm truncate">{lead.client || '(no name)'}</div>
          {lead.totalPrice > 0 && (
            <span className="text-[10px] text-muted shrink-0">
              {lead.totalPrice}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted truncate">
          <span>{lead.leadStatus}</span>
          {lead.pack && <><span>·</span><span>{lead.pack}</span></>}
          {lead.source && <><span>·</span><span className="truncate">{lead.source}</span></>}
        </div>
      </div>
      <ChevronRight size={14} className="text-muted shrink-0" />
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// LEAD DETAIL — slide-up sheet with full form
// ════════════════════════════════════════════════════════════════════
function LeadDetail({ lead, onClose }) {
  const isNew = !lead;
  const addLead = useStore((s) => s.addLead);
  const updateLead = useStore((s) => s.updateLead);
  const removeLead = useStore((s) => s.removeLead);
  const staffList = useStore((s) => s.business?.staff || []);
  const accent = ws().accent;

  const [form, setForm] = useState(() => ({
    client: lead?.client || '',
    whatsapp: lead?.whatsapp || '',
    leadStatus: lead?.leadStatus || '🔴 À Faire',
    opsStatus: lead?.opsStatus || '🔴 À Faire',
    source: lead?.source || 'Facebook ads',
    cardType: lead?.cardType || 'Meru',
    pack: lead?.pack || 'Physique',
    promo: lead?.promo || '',
    totalPrice: lead?.totalPrice || 0,
    passportAvailable: lead?.passportAvailable || '',
    paymentStatus: lead?.paymentStatus || '',
    rdvDate: lead?.rdvDate || '',
    assistantResponsible: lead?.assistantResponsible || '',
    assignedOps: lead?.assignedOps || 'Marc',
    rdvAideCommande: lead?.rdvAideCommande || '',
    dateReception: lead?.dateReception || '',
    datePaidDeposit: lead?.datePaidDeposit || '',
    datePaidFull: lead?.datePaidFull || '',
    notes: lead?.notes || '',
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (isNew) {
      addLead(form);
    } else {
      updateLead(lead.id, form);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!lead) return;
    if (!confirm(`Delete lead for ${lead.client || 'this client'}?`)) return;
    removeLead(lead.id);
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col"
      >
        <div className="surface border-t rounded-t-3xl flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
          {/* Sticky header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">
              {isNew ? 'New lead' : form.client || 'Lead detail'}
            </div>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
            >
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>

          {/* Form body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <Section title="Client">
              <Field label="Name">
                <input
                  type="text" value={form.client} onChange={(e) => set('client', e.target.value)}
                  className="form-input" placeholder="Full name"
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  type="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)}
                  className="form-input" placeholder="+509 ..."
                />
              </Field>
              <Field label="Source">
                <select
                  value={form.source} onChange={(e) => set('source', e.target.value)}
                  className="form-input"
                >
                  <option value="Facebook ads">Facebook ads</option>
                  <option value="TikTok organic">TikTok organic</option>
                  <option value="TikTok ads">TikTok ads</option>
                  <option value="Instagram ads">Instagram ads</option>
                  <option value="Instagram organic">Instagram organic</option>
                  <option value="Word of mouth">Word of mouth</option>
                  <option value="Existing client">Existing client</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </Section>

            <Section title="Card">
              <Field label="Type">
                <select
                  value={form.cardType} onChange={(e) => set('cardType', e.target.value)}
                  className="form-input"
                >
                  {ws().cardTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Pack">
                <select
                  value={form.pack} onChange={(e) => set('pack', e.target.value)}
                  className="form-input"
                >
                  {ws().packOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Passport available">
                <select
                  value={form.passportAvailable} onChange={(e) => set('passportAvailable', e.target.value)}
                  className="form-input"
                >
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </Field>
              <Field label="Promo">
                <input
                  type="text" value={form.promo} onChange={(e) => set('promo', e.target.value)}
                  className="form-input" placeholder="e.g. Direct (Promo)"
                />
              </Field>
              <Field label="Total price (HTG)">
                <input
                  type="number" inputMode="numeric"
                  value={form.totalPrice}
                  onChange={(e) => set('totalPrice', Number(e.target.value))}
                  className="form-input"
                />
              </Field>
            </Section>

            <Section title="Status">
              <Field label="Lead status">
                <select
                  value={form.leadStatus} onChange={(e) => set('leadStatus', e.target.value)}
                  className="form-input"
                >
                  {ws().leadStatuses.map((s) => (
                    <option key={s.id} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ops status">
                <select
                  value={form.opsStatus} onChange={(e) => set('opsStatus', e.target.value)}
                  className="form-input"
                >
                  {ws().opsStatuses.map((s) => (
                    <option key={s.id} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Payment status">
                <input
                  type="text" value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}
                  className="form-input" placeholder="e.g. Total Reçu, 250G Reçu"
                />
              </Field>
            </Section>

            <Section title="Schedule">
              <Field label="RDV date">
                <input
                  type="datetime-local"
                  value={toLocalDT(form.rdvDate)}
                  onChange={(e) => set('rdvDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="form-input"
                />
              </Field>
              <Field label="Date received">
                <input
                  type="date"
                  value={toLocalDate(form.dateReception)}
                  onChange={(e) => set('dateReception', e.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="Deposit paid date">
                <input
                  type="date"
                  value={toLocalDate(form.datePaidDeposit)}
                  onChange={(e) => set('datePaidDeposit', e.target.value)}
                  className="form-input"
                />
              </Field>
              <Field label="Full payment date">
                <input
                  type="date"
                  value={toLocalDate(form.datePaidFull)}
                  onChange={(e) => set('datePaidFull', e.target.value)}
                  className="form-input"
                />
              </Field>
            </Section>

            <Section title="Team">
              <Field label="Sales assistant">
                <select
                  value={form.assistantResponsible}
                  onChange={(e) => set('assistantResponsible', e.target.value)}
                  className="form-input"
                >
                  <option value="">—</option>
                  <option value="Jémima">Jémima</option>
                  <option value="Christelle">Christelle</option>
                  <option value="Dawsen">Dawsen</option>
                  {staffList.filter(s => s.role === 'Sales').map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned ops">
                <select
                  value={form.assignedOps}
                  onChange={(e) => set('assignedOps', e.target.value)}
                  className="form-input"
                >
                  <option value="">—</option>
                  <option value="Marc">Marc</option>
                  <option value="Dawsen">Dawsen</option>
                  {staffList.filter(s => s.role === 'Ops').map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Help with first order?">
                <select
                  value={form.rdvAideCommande}
                  onChange={(e) => set('rdvAideCommande', e.target.value)}
                  className="form-input"
                >
                  <option value="">—</option>
                  <option value="Oui">Oui</option>
                  <option value="Non">Non</option>
                </select>
              </Field>
            </Section>

            <Section title="Notes">
              <Field>
                <textarea
                  value={form.notes} onChange={(e) => set('notes', e.target.value)}
                  rows={4}
                  className="form-input resize-none"
                  placeholder="Anything to remember about this client..."
                />
              </Field>
            </Section>

            {!isNew && (
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl border text-sm text-accent-expense flex items-center justify-center gap-2 hover:bg-accent-expense/10"
                style={{ borderColor: 'var(--border)' }}
              >
                <Trash2 size={14} />
                Delete lead
              </button>
            )}

            <div className="h-8" />
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════
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
      {label && (
        <div className="text-[11px] text-muted mb-1">{label}</div>
      )}
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

function toLocalDT(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function toLocalDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  } catch { return ''; }
}
