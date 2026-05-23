// src/modules/recharge/Ads.jsx
// Ship 3 — Recharge-scoped ad spend tracking.
//
// Difference from AVS Solution Ads:
//   • Every new entry tagged workspace: 'recharge'
//   • Filtered to show ONLY workspace === 'recharge'
//   • ROAS attribution uses RECHARGE orders, not card leads
//     - Excludes recharge orders from clients with a Tag matching
//       SALES_PIPELINE (because those are card-acquired, not from
//       recharge ads)
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Trash2, TrendingUp, Megaphone,
  DollarSign, Sparkles,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';
import { useAvsCurrency } from '../avs/useAvsCurrency';
import { useWorkspaceFilter, applyDateFilter } from '../../lib/workspaceFilter';
import FilterPill from '../../components/FilterPill';
import { parseDate, isTermine } from './useRechargeData';

const ws = () => getWorkspace('recharge');
const HTG_PER_USD = 150;

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

export default function RechargeAds() {
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const rawOrders = useStore((s) => s.business?.rechargeOrders || []);
  const leads = useStore((s) => s.business?.leads || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const orders = useMemo(() => applyDateFilter(rawOrders, wsFilter, 'date'), [rawOrders, wsFilter]);
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  // Recharge-scoped campaigns only
  const campaigns = useMemo(
    () => adSpend.filter((a) => (a.workspace || '') === 'recharge'),
    [adSpend]
  );

  // Set of Tags that appear in SALES_PIPELINE (card-acquired clients).
  // Orders with these tags are EXCLUDED from recharge ad attribution.
  const cardClientTags = useMemo(() => {
    const s = new Set();
    leads.forEach((l) => {
      const t = String(l.tag || '').trim().toLowerCase();
      if (t) s.add(t);
    });
    return s;
  }, [leads]);

  // For each campaign, compute its date window and attribute Terminé
  // recharge orders whose date falls within window AND whose tag
  // is NOT in cardClientTags.
  const campaignsWithROAS = useMemo(() => {
    return campaigns.map((c) => {
      const start = parseDate(c.date);
      // Window: 30 days from start (simple default)
      const end = start ? new Date(start.getTime() + 30 * 86400 * 1000) : null;

      const inWindow = (o) => {
        const d = parseDate(o.date);
        if (!d || !start) return false;
        return d >= start && (!end || d <= end);
      };

      // Attribution: in-window + Terminé + tag NOT in card client tags
      const attributed = orders.filter((o) => {
        if (!isTermine(o)) return false;
        if (!inWindow(o)) return false;
        const tag = String(o.tagInfo || '').trim().toLowerCase();
        if (!tag) return true;                       // no tag = attributable
        return !cardClientTags.has(tag);             // tag known as card client = excluded
      });

      const benefitsHTG = attributed.reduce((s, o) => s + (Number(o.profit) || 0), 0);
      const spendUSD = c.spendCurrency === 'HTG'
        ? Number(c.spendAmount) / HTG_PER_USD
        : Number(c.spendAmount);
      const benefitsUSD = benefitsHTG / HTG_PER_USD;
      const spendUSDPaid = c.paymentStatus === 'pending' ? 0 : spendUSD;
      const roas = spendUSD > 0 ? benefitsUSD / spendUSD : null;

      return {
        ...c,
        attributedCount: attributed.length,
        benefitsHTG,
        spendUSD,
        spendUSDPaid,
        roas,
      };
    });
  }, [campaigns, orders, cardClientTags]);

  const sorted = useMemo(() => {
    return [...campaignsWithROAS].sort((a, b) => {
      const da = parseDate(a.date); const db = parseDate(b.date);
      return (db || 0) - (da || 0);
    });
  }, [campaignsWithROAS]);

  const totals = useMemo(() => {
    const paid = campaignsWithROAS.filter((c) => c.kind === 'paid');
    const totalSpend = paid.reduce((s, c) => s + c.spendUSDPaid, 0);
    const totalSpendIncludingOwed = paid.reduce((s, c) => s + c.spendUSD, 0);
    const totalBenefitsHTG = paid.reduce((s, c) => s + c.benefitsHTG, 0);
    const totalAttributed = paid.reduce((s, c) => s + c.attributedCount, 0);
    return { totalSpend, totalSpendIncludingOwed, totalBenefitsHTG, totalAttributed };
  }, [campaignsWithROAS]);

  const openCampaign = campaigns.find((c) => c.id === editingId);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl leading-tight">Ads</h1>
            <FilterPill filter={wsFilter} />
          </div>
          <p className="text-xs text-muted mt-0.5">
            {sorted.length} {sorted.length === 1 ? 'campaign' : 'campaigns'} ·
            attribution excludes card-acquired clients
          </p>
        </div>
        <button onClick={() => setAddingNew(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
          aria-label="Add campaign">
          <Plus size={18} />
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard icon={DollarSign} label="Spent (paid)"
          value={`$${totals.totalSpend.toFixed(0)}`}
          sub={totals.totalSpendIncludingOwed > totals.totalSpend
            ? `$${(totals.totalSpendIncludingOwed - totals.totalSpend).toFixed(0)} owed`
            : null}
          accent={accent} />
        <StatCard icon={Sparkles} label="Attributed"
          value={String(totals.totalAttributed)}
          sub="orders"
          accent={accent} />
        <StatCard icon={TrendingUp} label="ROAS"
          value={totals.totalSpend > 0
            ? `${((totals.totalBenefitsHTG / HTG_PER_USD) / totals.totalSpend).toFixed(2)}×`
            : '—'}
          sub={fmtCompact(totals.totalBenefitsHTG, 'HTG')}
          accent={accent} />
      </div>

      {sorted.length === 0 ? (
        <div className="surface border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: accent.soft, color: accent.primary }}>
            <Megaphone size={20} />
          </div>
          <div className="font-medium text-sm">No recharge campaigns yet</div>
          <p className="text-xs text-muted mt-1">Tap + to log your first one</p>
        </div>
      ) : (
        <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {sorted.map((c) => (
            <CampaignRow key={c.id} c={c} accent={accent}
              fmt={fmtCompact}
              onTap={() => setEditingId(c.id)} />
          ))}
        </div>
      )}

      <div className="surface border rounded-2xl p-3 text-[11px] text-muted mt-4">
        <div className="font-medium mb-1" style={{ color: 'var(--text)' }}>
          How attribution works
        </div>
        <div>
          A recharge order counts toward a campaign's ROAS only if:
        </div>
        <div className="mt-1 space-y-0.5">
          <div>• The order falls within 30 days of the campaign's start date</div>
          <div>• The client's Tag does NOT match a Tag in your SALES_PIPELINE (which would mean they're a card client, not from a recharge ad)</div>
          <div>• The order's Statut is Terminé</div>
        </div>
      </div>

      <AnimatePresence>
        {(openCampaign || addingNew) && (
          <CampaignSheet
            campaign={openCampaign}
            onClose={() => { setEditingId(null); setAddingNew(false); }} />
        )}
      </AnimatePresence>
    </main>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="surface border rounded-2xl p-3">
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

function CampaignRow({ c, accent, fmt, onTap }) {
  const roasColor = c.roas == null
    ? 'var(--text-muted, #7a8a8c)'
    : c.roas >= 2 ? '#3d8b5f'
    : c.roas >= 1 ? '#d4a942'
    : '#c2452f';
  return (
    <button onClick={onTap}
      className="w-full px-3 py-3 flex items-center gap-3 hover:bg-[var(--bg)] active:bg-[var(--bg)] transition-colors text-left">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent.soft, color: accent.primary }}>
        <Megaphone size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">
            {c.campaignName || '(unnamed)'}
          </span>
          {c.paymentStatus === 'pending' && c.kind === 'paid' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider shrink-0"
              style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}>
              owed
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted truncate">
          {c.platform || '—'} · {fmtDate(c.date)}
          {c.kind === 'paid' && c.spendUSD > 0 && <> · ${c.spendUSD.toFixed(0)}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {c.kind === 'paid' && (
          <div className="text-sm font-display leading-none" style={{ color: roasColor }}>
            {c.roas != null ? `${c.roas.toFixed(2)}×` : '—'}
          </div>
        )}
        <div className="text-[10px] text-muted mt-1">
          {c.attributedCount} {c.attributedCount === 1 ? 'order' : 'orders'}
        </div>
      </div>
    </button>
  );
}

function CampaignSheet({ campaign, onClose }) {
  const isNew = !campaign;
  const addAdSpend = useStore((s) => s.addAdSpend);
  const updateAdSpend = useStore((s) => s.updateAdSpend);
  const removeAdSpend = useStore((s) => s.removeAdSpend);
  const accent = ws().accent;

  const [form, setForm] = useState(() => ({
    kind: campaign?.kind || 'paid',
    campaignName: campaign?.campaignName || '',
    platform: campaign?.platform || 'facebook',
    date: campaign?.date ? campaign.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    spendAmount: campaign?.spendAmount || 0,
    spendCurrency: campaign?.spendCurrency || 'USD',
    notes: campaign?.notes || '',
    paymentStatus: campaign?.paymentStatus || 'paid',
    workspace: 'recharge',  // always recharge for this module
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    const payload = {
      ...form,
      spendAmount: form.kind === 'organic' ? 0 : Number(form.spendAmount),
    };
    if (isNew) addAdSpend(payload);
    else updateAdSpend(campaign.id, payload);
    onClose();
  };

  const handleDelete = () => {
    if (!campaign) return;
    if (!confirm(`Delete "${campaign.campaignName}"?`)) return;
    removeAdSpend(campaign.id);
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-50" />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] flex flex-col">
        <div className="surface border-t rounded-t-3xl flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">
              {isNew ? 'New campaign' : form.campaignName || 'Campaign'}
            </div>
            <button onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <Section title="Campaign">
              <Field label="Name">
                <input type="text" value={form.campaignName}
                  onChange={(e) => set('campaignName', e.target.value)}
                  className="form-input" placeholder="e.g. Recharge — Jan 2026" />
              </Field>
              <Field label="Platform">
                <select value={form.platform}
                  onChange={(e) => set('platform', e.target.value)} className="form-input">
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="google">Google</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Date launched">
                <input type="date" value={form.date}
                  onChange={(e) => set('date', e.target.value)} className="form-input" />
              </Field>
              <Field label="Kind">
                <select value={form.kind}
                  onChange={(e) => set('kind', e.target.value)} className="form-input">
                  <option value="paid">Paid</option>
                  <option value="organic">Organic</option>
                </select>
              </Field>
            </Section>

            {form.kind === 'paid' && (
              <Section title="Spend">
                <Field label="Amount">
                  <input type="number" inputMode="decimal" value={form.spendAmount}
                    onChange={(e) => set('spendAmount', e.target.value)}
                    className="form-input" />
                </Field>
                <Field label="Currency">
                  <select value={form.spendCurrency}
                    onChange={(e) => set('spendCurrency', e.target.value)} className="form-input">
                    <option value="USD">USD</option>
                    <option value="HTG">HTG</option>
                  </select>
                </Field>
              </Section>
            )}

            <Section title="Payment status">
              <Field>
                <div className="grid grid-cols-2 gap-2 p-2">
                  <button type="button"
                    onClick={() => set('paymentStatus', 'paid')}
                    className="py-2 rounded-xl text-xs font-medium border"
                    style={form.paymentStatus === 'paid'
                      ? { backgroundColor: '#3d8b5f', color: '#fff', borderColor: '#3d8b5f' }
                      : { borderColor: 'var(--border)', color: 'var(--text-muted, #7a8a8c)' }}>
                    Paid
                  </button>
                  <button type="button"
                    onClick={() => set('paymentStatus', 'pending')}
                    className="py-2 rounded-xl text-xs font-medium border"
                    style={form.paymentStatus === 'pending'
                      ? { backgroundColor: '#d4a942', color: '#fff', borderColor: '#d4a942' }
                      : { borderColor: 'var(--border)', color: 'var(--text-muted, #7a8a8c)' }}>
                    Owed (debt)
                  </button>
                </div>
                <div className="px-3 pb-2 text-[10px] text-muted">
                  {form.paymentStatus === 'pending'
                    ? 'Shows as a debt until paid. Doesn\'t hit P&L until you mark paid.'
                    : 'Counts as a normal ad expense in P&L.'}
                </div>
              </Field>
            </Section>

            <Section title="Notes">
              <Field>
                <textarea value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3} className="form-input resize-none"
                  placeholder="Audience, hypothesis, what worked..." />
              </Field>
            </Section>

            {!isNew && (
              <button onClick={handleDelete}
                className="w-full py-3 rounded-xl border text-sm flex items-center justify-center gap-2"
                style={{ borderColor: 'var(--border)', color: '#c2452f' }}>
                <Trash2 size={14} />
                Delete campaign
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
