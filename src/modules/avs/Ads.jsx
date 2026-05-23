// src/modules/avs/Ads.jsx
// Tier 5e — Ads & Campaigns
//
// Two ad kinds:
//   • paid    — Facebook ads, Instagram ads, TikTok ads (spend + leads)
//   • organic — TikTok organic, Instagram organic (no spend, lead source only)
//
// ROAS = revenue attributed to campaign / spend.
// Revenue is computed by matching SALES_PIPELINE leads on `source`
// containing the campaignName, and summing totalPrice of leads that
// reached ✅ Terminé.
//
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ArrowLeft, Megaphone, TrendingUp, DollarSign,
  Trash2, Sparkles, Target, Zap,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getWorkspace } from '../../workspaces/registry';

const ws = () => getWorkspace('avs');

const HTG_PER_USD = 150;

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok',    label: 'TikTok' },
  { id: 'google',    label: 'Google' },
  { id: 'other',     label: 'Other' },
];

const PRODUCTS = ['Carte', 'Shipp', 'Recharge', 'Other'];

export default function AvsAds() {
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const leads = useStore((s) => s.business?.leads || []);
  const [kindFilter, setKindFilter] = useState('all'); // 'all' | 'paid' | 'organic'
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const accent = ws().accent;

  const filtered = useMemo(() => {
    return adSpend.filter((a) => {
      // Workspace scope: legacy rows with no workspace = AVS by default
      const aw = a.workspace || 'avs';
      if (aw !== 'avs') return false;
      if (kindFilter === 'paid' && a.kind !== 'paid') return false;
      if (kindFilter === 'organic' && a.kind !== 'organic') return false;
      return true;
    });
  }, [adSpend, kindFilter]);

  // Compute ROAS per campaign
  const campaignsWithROAS = useMemo(() => {
    return filtered.map((campaign) => {
      const matches = leads.filter((l) => {
        const src = String(l.source || '').toLowerCase();
        const name = String(campaign.campaignName || '').toLowerCase();
        return name && src.includes(name);
      });
      const completed = matches.filter((l) => l.leadStatus === '✅ Terminé');
      // Lead revenue is in HTG; convert to USD for ROAS comparison
      const revenueUSD = completed.reduce(
        (sum, l) => sum + (Number(l.totalPrice) || 0) / HTG_PER_USD, 0
      );
      const spendUSD = campaign.spendCurrency === 'HTG'
        ? Number(campaign.spendAmount) / HTG_PER_USD
        : Number(campaign.spendAmount);
      // Ship 3: only count actually-paid spend in the "money out" math.
      // Pending ones surface in Debts instead.
      const spendUSDPaid = campaign.paymentStatus === 'pending' ? 0 : spendUSD;
      const roas = spendUSD > 0 ? revenueUSD / spendUSD : null;
      const conversionRate = matches.length > 0
        ? completed.length / matches.length
        : 0;
      return {
        ...campaign,
        leadsCount: matches.length,
        conversions: completed.length,
        revenueUSD,
        spendUSD,
        spendUSDPaid,
        roas,
        conversionRate,
      };
    });
  }, [filtered, leads]);

  // Sort by best ROAS first, organic last
  const sorted = useMemo(() => {
    return [...campaignsWithROAS].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'paid' ? -1 : 1;
      if (a.roas === null && b.roas === null) return 0;
      if (a.roas === null) return 1;
      if (b.roas === null) return -1;
      return b.roas - a.roas;
    });
  }, [campaignsWithROAS]);

  const openCampaign = adSpend.find((a) => a.id === editingId);

  // Totals
  const totals = useMemo(() => {
    const paid = campaignsWithROAS.filter(c => c.kind === 'paid');
    const totalSpend = paid.reduce((s, c) => s + c.spendUSD, 0);
    const totalRevenue = paid.reduce((s, c) => s + c.revenueUSD, 0);
    const totalLeads = campaignsWithROAS.reduce((s, c) => s + c.leadsCount, 0);
    const totalConv = campaignsWithROAS.reduce((s, c) => s + c.conversions, 0);
    return { totalSpend, totalRevenue, totalLeads, totalConv };
  }, [campaignsWithROAS]);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl leading-tight">Ads & Campaigns</h1>
          <p className="text-xs text-muted mt-0.5">
            {adSpend.length} campaigns · ROAS by attribution
          </p>
        </div>
        <button
          onClick={() => setAddingNew(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95"
          style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
          aria-label="Add campaign"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatCard
          icon={DollarSign}
          label="Paid spend"
          value={`$${totals.totalSpend.toFixed(0)}`}
          accent={accent}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg ROAS"
          value={
            totals.totalSpend > 0
              ? `${(totals.totalRevenue / totals.totalSpend).toFixed(2)}×`
              : '—'
          }
          accent={accent}
        />
        <StatCard
          icon={Target}
          label="Leads"
          value={String(totals.totalLeads)}
          accent={accent}
        />
        <StatCard
          icon={Zap}
          label="Conversions"
          value={String(totals.totalConv)}
          accent={accent}
        />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
        {[
          { id: 'all',     label: 'All',     icon: null },
          { id: 'paid',    label: 'Paid',    icon: DollarSign },
          { id: 'organic', label: 'Organic', icon: Sparkles },
        ].map((p) => {
          const I = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => setKindFilter(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 ${
                kindFilter === p.id ? '' : 'surface border text-muted'
              }`}
              style={
                kindFilter === p.id
                  ? { backgroundColor: accent.primary, color: accent.primaryFg }
                  : undefined
              }
            >
              {I && <I size={11} />}
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Campaign list */}
      {sorted.length === 0 && (
        <div className="surface border rounded-2xl p-8 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: accent.soft, color: accent.primary }}
          >
            <Megaphone size={20} />
          </div>
          <div className="font-medium text-sm">No campaigns yet</div>
          <p className="text-xs text-muted mt-1">Tap + to log your first one</p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((c) => (
          <CampaignRow key={c.id} campaign={c} onOpen={() => setEditingId(c.id)} accent={accent} />
        ))}
      </div>

      <AnimatePresence>
        {openCampaign && (
          <CampaignDetail
            campaign={openCampaign}
            onClose={() => setEditingId(null)}
          />
        )}
        {addingNew && (
          <CampaignDetail
            campaign={null}
            onClose={() => setAddingNew(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ════════════════════════════════════════════════════════════════════
function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="surface border rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accent.soft, color: accent.primary }}
        >
          <Icon size={12} />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      </div>
      <div className="font-display text-xl leading-tight">{value}</div>
    </div>
  );
}

function CampaignRow({ campaign, onOpen, accent }) {
  const roasColor = campaign.roas === null
    ? '#7a8a8c'
    : campaign.roas >= 3 ? '#3d8b5f'
    : campaign.roas >= 1.5 ? '#d4a942'
    : '#c2452f';

  return (
    <button
      onClick={onOpen}
      className="w-full text-left surface border rounded-2xl p-3 hover:shadow-sm active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm truncate">{campaign.campaignName || '(unnamed)'}</div>
            {campaign.kind === 'organic' ? (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider"
                style={{ backgroundColor: '#9b59b622', color: '#9b59b6' }}
              >
                organic
              </span>
            ) : (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider"
                style={{ backgroundColor: accent.soft, color: accent.primary }}
              >
                paid
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {campaign.platform || '—'}
            {campaign.product && <> · {campaign.product}</>}
            {campaign.kind === 'paid' && campaign.spendUSD > 0 && (
              <> · ${campaign.spendUSD.toFixed(0)}</>
            )}
            {campaign.paymentStatus === 'pending' && campaign.kind === 'paid' && (
              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider"
                style={{ backgroundColor: '#d4a94222', color: '#d4a942' }}>
                owed
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {campaign.kind === 'paid' && (
            <div
              className="text-sm font-display leading-none"
              style={{ color: roasColor }}
            >
              {campaign.roas !== null ? `${campaign.roas.toFixed(1)}×` : '—'}
            </div>
          )}
          <div className="text-[10px] text-muted mt-0.5">
            {campaign.conversions}/{campaign.leadsCount}
          </div>
        </div>
      </div>
    </button>
  );
}

function CampaignDetail({ campaign, onClose }) {
  const isNew = !campaign;
  const addAdSpend = useStore((s) => s.addAdSpend);
  const updateAdSpend = useStore((s) => s.updateAdSpend);
  const removeAdSpend = useStore((s) => s.removeAdSpend);
  const accent = ws().accent;

  const [form, setForm] = useState(() => ({
    kind: campaign?.kind || 'paid',
    campaignName: campaign?.campaignName || '',
    product: campaign?.product || 'Carte',
    platform: campaign?.platform || 'facebook',
    date: campaign?.date ? campaign.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    spendAmount: campaign?.spendAmount || 0,
    spendCurrency: campaign?.spendCurrency || 'USD',
    leadsAttributed: campaign?.leadsAttributed || 0,
    notes: campaign?.notes || '',
    paymentStatus: campaign?.paymentStatus || 'paid',  // 'paid' | 'pending'
    workspace: campaign?.workspace || 'avs',
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
    if (!confirm(`Delete campaign "${campaign.campaignName}"?`)) return;
    removeAdSpend(campaign.id);
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
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--bg)]">
              <ArrowLeft size={16} />
            </button>
            <div className="font-medium text-sm">{isNew ? 'New campaign' : form.campaignName || 'Campaign'}</div>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: accent.primary, color: accent.primaryFg }}
            >
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Kind toggle */}
            <div className="surface border rounded-2xl p-1 grid grid-cols-2 gap-0.5">
              <button
                onClick={() => set('kind', 'paid')}
                className="py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                style={form.kind === 'paid'
                  ? { backgroundColor: accent.primary, color: accent.primaryFg }
                  : { color: 'var(--text-muted, #7a8a8c)' }}
              >
                <DollarSign size={12} />
                Paid
              </button>
              <button
                onClick={() => set('kind', 'organic')}
                className="py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                style={form.kind === 'organic'
                  ? { backgroundColor: '#9b59b6', color: '#fff' }
                  : { color: 'var(--text-muted, #7a8a8c)' }}
              >
                <Sparkles size={12} />
                Organic
              </button>
            </div>

            <Section title="Campaign">
              <Field label="Name">
                <input
                  type="text" value={form.campaignName}
                  onChange={(e) => set('campaignName', e.target.value)}
                  className="form-input" placeholder="e.g. Jémima Dumé"
                />
              </Field>
              <Field label="Product">
                <select value={form.product} onChange={(e) => set('product', e.target.value)} className="form-input">
                  {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Platform">
                <select value={form.platform} onChange={(e) => set('platform', e.target.value)} className="form-input">
                  {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Date">
                <input
                  type="date" value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  className="form-input"
                />
              </Field>
            </Section>

            {form.kind === 'paid' && (
              <Section title="Spend">
                <Field label="Amount">
                  <input
                    type="number" inputMode="decimal"
                    value={form.spendAmount}
                    onChange={(e) => set('spendAmount', e.target.value)}
                    className="form-input"
                  />
                </Field>
                <Field label="Currency">
                  <select value={form.spendCurrency} onChange={(e) => set('spendCurrency', e.target.value)} className="form-input">
                    <option value="USD">USD</option>
                    <option value="HTG">HTG</option>
                    <option value="HTD">HTD</option>
                  </select>
                </Field>
              </Section>
            )}

            <Section title="Attribution">
              <Field label="Leads attributed (manual)">
                <input
                  type="number" inputMode="numeric"
                  value={form.leadsAttributed}
                  onChange={(e) => set('leadsAttributed', e.target.value)}
                  className="form-input"
                  placeholder="Auto-counted from Source field; override if needed"
                />
              </Field>
            </Section>

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
                <textarea
                  value={form.notes} onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Audience, ad copy, hypothesis..."
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
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-2 px-1">{title}</div>
      <div className="surface border rounded-2xl overflow-hidden divide-y divide-[var(--border)]">{children}</div>
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
