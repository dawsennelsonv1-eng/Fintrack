// src/modules/recharge/financials/Attribution.jsx
//
// Ship 3 — Tag-based ROAS for Recharge ads.
//
// How it works:
//   • Each recharge order has Tag_Info (the client's Wise/Meru tag)
//   • Each lead in SALES_PIPELINE has a Tag (set by Ops when card delivered)
//   • If order.Tag_Info matches a SALES_PIPELINE Tag → client is card-acquired
//     (excluded from Recharge ad attribution)
//   • If order.Tag_Info does NOT match → attributable to Recharge ads
//
// Caveat: older orders (and older leads) don't have Tags, which is why
// the workspace filter exists — set a cutoff date to start from clean
// data.
//
import { useMemo } from 'react';
import { Target, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { getWorkspace } from '../../../workspaces/registry';
import { useAvsCurrency } from '../../avs/useAvsCurrency';
import { useWorkspaceFilter, applyDateFilter } from '../../../lib/workspaceFilter';
import FilterPill from '../../../components/FilterPill';
import { isTermine } from '../useRechargeData';

const ws = () => getWorkspace('recharge');
const HTG_PER_USD = 150;

export default function Attribution() {
  const rawOrders = useStore((s) => s.business?.rechargeOrders || []);
  const adSpend = useStore((s) => s.business?.adSpend || []);
  const leads = useStore((s) => s.business?.leads || []);
  const wsFilter = useWorkspaceFilter('recharge');
  const accent = ws().accent;
  const { fmtCompact } = useAvsCurrency();

  const orders = useMemo(
    () => applyDateFilter(rawOrders, wsFilter, 'date'),
    [rawOrders, wsFilter]
  );

  // Card-acquired client tags (normalized to lowercase strings)
  const cardClientTags = useMemo(() => {
    const set = new Set();
    leads.forEach((l) => {
      const t = String(l.tag || '').trim().toLowerCase();
      if (t) set.add(t);
    });
    return set;
  }, [leads]);

  // Classify orders into: from card clients vs from recharge ads vs untagged
  const classified = useMemo(() => {
    const cardClients = [];
    const rechargeAds = [];
    const untagged = [];
    orders.forEach((o) => {
      if (!isTermine(o)) return;
      const tag = String(o.tagInfo || '').trim().toLowerCase();
      if (!tag) {
        untagged.push(o);
      } else if (cardClientTags.has(tag)) {
        cardClients.push(o);
      } else {
        rechargeAds.push(o);
      }
    });
    return { cardClients, rechargeAds, untagged };
  }, [orders, cardClientTags]);

  // Recharge ad spend (paid only) within filter window
  const rechargeAdSpend = useMemo(() => {
    const filtered = applyDateFilter(
      adSpend.filter((a) => a.workspace === 'recharge' && a.kind === 'paid'),
      wsFilter,
      'date'
    );
    return filtered.reduce((s, a) => {
      if (a.paymentStatus === 'pending') return s; // exclude unpaid
      const usd = a.spendCurrency === 'HTG'
        ? Number(a.spendAmount) / HTG_PER_USD
        : Number(a.spendAmount);
      return s + usd;
    }, 0);
  }, [adSpend, wsFilter]);

  const totals = useMemo(() => {
    const sum = (list) => list.reduce((s, o) => s + (Number(o.profit) || 0), 0);
    const cardBenefits = sum(classified.cardClients);
    const adBenefits = sum(classified.rechargeAds);
    const untaggedBenefits = sum(classified.untagged);
    const totalBenefits = cardBenefits + adBenefits + untaggedBenefits;
    const roas = rechargeAdSpend > 0 ? (adBenefits / HTG_PER_USD) / rechargeAdSpend : null;
    return {
      cardBenefits, adBenefits, untaggedBenefits, totalBenefits,
      rechargeAdSpend, roas,
      cardCount: classified.cardClients.length,
      adCount: classified.rechargeAds.length,
      untaggedCount: classified.untagged.length,
      cardPct: totalBenefits > 0 ? (cardBenefits / totalBenefits) * 100 : 0,
      adPct: totalBenefits > 0 ? (adBenefits / totalBenefits) * 100 : 0,
      untaggedPct: totalBenefits > 0 ? (untaggedBenefits / totalBenefits) * 100 : 0,
    };
  }, [classified, rechargeAdSpend]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
          Tag-based attribution
        </div>
        <FilterPill filter={wsFilter} />
      </div>

      {/* Headline */}
      <div className="rounded-2xl p-5 border"
        style={{ backgroundColor: accent.soft, borderColor: accent.primary + '44' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent.primary, color: accent.primaryFg }}>
            <Target size={14} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            Recharge ad ROAS
          </div>
        </div>
        <div className="font-display text-4xl leading-tight" style={{ color: accent.primary }}>
          {totals.roas != null ? `${totals.roas.toFixed(2)}×` : '—'}
        </div>
        <div className="text-xs text-muted mt-1">
          {totals.rechargeAdSpend > 0
            ? `$${totals.rechargeAdSpend.toFixed(0)} spent · ${fmtCompact(totals.adBenefits, 'HTG')} from recharge ads`
            : 'No recharge ad spend logged yet'}
        </div>
      </div>

      {/* Breakdown */}
      <div className="surface border rounded-2xl p-4 space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
          Where the benefits came from
        </div>

        <Segment label="From recharge ads"
          subtitle={`${totals.adCount} orders · attributable`}
          value={fmtCompact(totals.adBenefits, 'HTG')}
          pct={totals.adPct} color={accent.primary} />

        <Segment label="From card clients"
          subtitle={`${totals.cardCount} orders · existing customers`}
          value={fmtCompact(totals.cardBenefits, 'HTG')}
          pct={totals.cardPct} color="#3d8b5f" />

        {totals.untaggedCount > 0 && (
          <Segment label="Untagged"
            subtitle={`${totals.untaggedCount} orders · no tag info`}
            value={fmtCompact(totals.untaggedBenefits, 'HTG')}
            pct={totals.untaggedPct} color="#7a8a8c" />
        )}
      </div>

      {/* How it works */}
      <div className="surface border rounded-2xl p-3 text-[11px] text-muted">
        <div className="font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
          <Users size={11} />
          How tags work
        </div>
        <div className="space-y-1">
          <div>• When Ops delivers a card, they save the client's Wise/Meru tag in SALES_PIPELINE</div>
          <div>• When that same client recharges, their tag appears in WEB_INCOMING (Tag_Info)</div>
          <div>• If the tags match → card-acquired client → excluded from ad ROAS</div>
          <div>• If no match → likely came from a recharge ad → counted toward ROAS</div>
        </div>
      </div>

      {totals.untaggedCount > totals.adCount + totals.cardCount && (
        <div className="rounded-2xl p-3 border text-[11px]"
          style={{ borderColor: '#d4a94266', backgroundColor: '#d4a94215' }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5" style={{ color: '#d4a942' }} />
            <div>
              <div className="font-medium" style={{ color: '#d4a942' }}>
                Most orders are untagged
              </div>
              <div className="text-muted mt-0.5">
                Set a date filter in Settings to exclude older orders without tags. That will make attribution more accurate.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Segment({ label, subtitle, value, pct, color }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[10px] text-muted">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-base leading-none" style={{ color }}>{value}</div>
          <div className="text-[10px] text-muted mt-0.5">{pct.toFixed(0)}%</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
        <div className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
