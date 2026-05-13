// src/modules/Investments.jsx — Round E
//
// Three sections:
//   1) Portfolio (assets / liquid investments) — preserved from Round D
//   2) Borrowed Capital pool — shows remaining undeployed borrowed money
//      with a quick-deploy CTA
//   3) Ventures — fully rewritten: types, dates, valuation, milestones,
//      distributions, journal, ROI tracking, IRR-ish multiple
//
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Plus, X, TrendingUp, TrendingDown, Briefcase, Coins, LineChart as LineIcon,
  Trash2, Rocket, ArrowUpRight, HandCoins, Calendar, Users, Target as TargetIcon,
  CheckCircle2, Circle, BookOpen, ChevronDown, ChevronUp, Banknote, Percent,
} from 'lucide-react';
import {
  useStore,
  selectInvestments, selectVentures, selectVentureEvents,
  selectBaseCurrency, selectRates, selectBorrowedPool, selectDebts,
  selectDebtEvents,
  selectVentureDistributions, selectVentureMilestones, selectVentureJournal,
  selectBorrowedDeployments,
  computeInvestmentTotals, computeVentureTotals,
  computeDebtRepaid,
  VENTURE_TYPES,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

const KIND_META = {
  stock:  { label: 'Stocks',   icon: LineIcon,   color: '#5b8def' },
  gold:   { label: 'Gold',     icon: Coins,      color: '#d4a942' },
  silver: { label: 'Silver',   icon: Coins,      color: '#9aa3ad' },
  crypto: { label: 'Crypto',   icon: Briefcase,  color: '#9b59b6' },
  other:  { label: 'Other',    icon: Briefcase,  color: '#7a8a8c' },
};

const VENTURE_PALETTE = ['#5b8def', '#d4a942', '#3d8b5f', '#9b59b6', '#e07a5f', '#9aa3ad', '#2c8d9c', '#c2452f'];

const VENTURE_STATUS = {
  active:   { label: 'Active',   cls: 'bg-accent-income/10 text-accent-income' },
  planning: { label: 'Planning', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  paused:   { label: 'Paused',   cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  exited:   { label: 'Exited',   cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  failed:   { label: 'Failed',   cls: 'bg-accent-expense/10 text-accent-expense' },
};

export default function Investments() {
  const investments       = useStore(selectInvestments);
  const venturesRaw       = useStore(selectVentures);
  const ventureEvents     = useStore(selectVentureEvents);
  const ventureDistributions = useStore(selectVentureDistributions);
  const baseCurrency      = useStore(selectBaseCurrency);
  const rates             = useStore(selectRates);
  const borrowedPool      = useStore(selectBorrowedPool);

  const totals   = useMemo(
    () => computeInvestmentTotals(investments, baseCurrency, rates),
    [investments, baseCurrency, rates]
  );
  const ventures = useMemo(
    () => computeVentureTotals(venturesRaw, ventureEvents, ventureDistributions, baseCurrency, rates),
    [venturesRaw, ventureEvents, ventureDistributions, baseCurrency, rates]
  );

  const [addingAsset, setAddingAsset] = useState(false);
  const [addingVenture, setAddingVenture] = useState(false);
  const [openVentureId, setOpenVentureId] = useState(null);

  const allocation = useMemo(() => {
    const map = {};
    for (const inv of investments) {
      const v = convert(inv.units * inv.currentPrice, inv.currency, baseCurrency, rates);
      map[inv.kind] = (map[inv.kind] || 0) + v;
    }
    return Object.entries(map).map(([kind, value]) => ({
      kind, value,
      name: KIND_META[kind]?.label || kind,
      color: KIND_META[kind]?.color || '#888',
    }));
  }, [investments, baseCurrency, rates]);

  const totalDeployed = useMemo(
    () => ventures.reduce((s, v) => s + v.deployedTotal, 0),
    [ventures]
  );
  const totalVentureValue = useMemo(
    () => ventures.reduce((s, v) => s + v.currentValueBase, 0),
    [ventures]
  );
  const totalDistributions = useMemo(
    () => ventures.reduce((s, v) => s + v.distributionsTotal, 0),
    [ventures]
  );
  const overallRoi = totalVentureValue - totalDeployed;
  const overallRoiPct = totalDeployed > 0 ? overallRoi / totalDeployed : 0;

  const venturePie = useMemo(() => ventures
    .filter((v) => v.deployedTotal > 0)
    .map((v, i) => ({
      name: v.name, value: v.deployedTotal,
      color: VENTURE_PALETTE[i % VENTURE_PALETTE.length],
    })), [ventures]);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Wealth</div>
        <h1 className="font-display text-4xl">The empire</h1>
      </motion.section>

      {/* Borrowed pool card */}
      {borrowedPool > 0.005 && (
        <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.03 }}
          className="surface border rounded-2xl p-4 mb-4"
          style={{ borderColor: 'rgba(212,169,66,0.4)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <HandCoins size={18} strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
                Borrowed Capital · Undeployed
              </div>
              <div className="font-display text-2xl num">{formatMoney(borrowedPool, baseCurrency)}</div>
              <div className="text-[11px] text-muted">Capital available to deploy into investments or ventures</div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Portfolio hero */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }}
        className="surface border rounded-2xl p-5 mb-4">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Portfolio Value</div>
        <div className="font-display text-5xl num leading-none mt-2">{formatMoney(totals.value, baseCurrency)}</div>
        <div className="flex items-center gap-2 mt-3 text-sm num">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            totals.gain >= 0 ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
          }`}>
            {totals.gain >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {totals.gain >= 0 ? '+' : '−'}{formatMoney(Math.abs(totals.gain), baseCurrency)}
          </span>
          <span className="text-muted">({(totals.gainPct * 100).toFixed(2)}%)</span>
        </div>
        <div className="text-[11px] text-muted mt-2">Cost basis · {formatMoney(totals.cost, baseCurrency)}</div>
      </motion.section>

      {allocation.length > 0 && (
        <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.08 }}
          className="surface border rounded-2xl p-5 mb-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-3">Allocation</div>
          <div className="flex items-center gap-5">
            <div className="w-32 h-32 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={allocation} dataKey="value" innerRadius={36} outerRadius={60}
                    paddingAngle={2} stroke="none" isAnimationActive animationDuration={700}>
                    {allocation.map((a) => <Cell key={a.kind} fill={a.color} />)}
                  </Pie>
                  <Tooltip content={<MoneyTooltip currency={baseCurrency} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {allocation.map((a) => (
                <div key={a.kind} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="num text-muted">{formatCompact(a.value, baseCurrency)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Assets list */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }} className="mb-5">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <h2 className="font-display text-2xl">Assets</h2>
          <button onClick={() => setAddingAsset(true)}
            className="text-xs text-muted hover:text-[var(--text)] flex items-center gap-1">
            <Plus size={12} /> Add
          </button>
        </div>
        {investments.length === 0 ? (
          <div className="surface border rounded-2xl p-8 text-center">
            <Briefcase size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
            <div className="font-display text-xl mb-1">No assets tracked</div>
            <div className="text-sm text-muted">Track stocks, gold, silver, crypto</div>
          </div>
        ) : (
          <ul className="surface border rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
            {investments.map((inv) => <AssetRow key={inv.id} inv={inv} baseCurrency={baseCurrency} rates={rates} />)}
          </ul>
        )}
      </motion.section>

      {/* VENTURES — Round E rewrite */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.12 }} className="mb-4">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Rocket size={16} className="text-muted" />
          <h2 className="font-display text-2xl flex-1">Ventures</h2>
          <button onClick={() => setAddingVenture(true)}
            className="text-xs text-muted hover:text-[var(--text)] flex items-center gap-1">
            <Plus size={12} /> Add
          </button>
        </div>

        {ventures.length === 0 ? (
          <div className="surface border rounded-2xl p-8 text-center">
            <Rocket size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
            <div className="font-display text-xl mb-1">No ventures yet</div>
            <div className="text-sm text-muted">Track partnerships, side hustles, equity stakes & more</div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Aggregate hero */}
            <div className="surface border rounded-2xl p-5">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Deployed</div>
                  <div className="font-display text-xl num">{formatCompact(totalDeployed, baseCurrency)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Now worth</div>
                  <div className="font-display text-xl num">{formatCompact(totalVentureValue, baseCurrency)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Distributions</div>
                  <div className="font-display text-xl num">{formatCompact(totalDistributions, baseCurrency)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm num pt-3 border-t border-[var(--border)]">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  overallRoi >= 0 ? 'bg-accent-income/10 text-accent-income' : 'bg-accent-expense/10 text-accent-expense'
                }`}>
                  {overallRoi >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {overallRoi >= 0 ? '+' : '−'}{formatMoney(Math.abs(overallRoi), baseCurrency)}
                </span>
                <span className="text-muted">({(overallRoiPct * 100).toFixed(1)}%)</span>
                <span className="text-muted ml-auto">{ventures.length} {ventures.length === 1 ? 'venture' : 'ventures'}</span>
              </div>

              {venturePie.length > 0 && (
                <div className="flex items-center gap-5 mt-4 pt-3 border-t border-[var(--border)]">
                  <div className="w-28 h-28 shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={venturePie} dataKey="value" innerRadius={32} outerRadius={54}
                          paddingAngle={2} stroke="none" isAnimationActive animationDuration={700}>
                          {venturePie.map((v, i) => <Cell key={i} fill={v.color} />)}
                        </Pie>
                        <Tooltip content={<MoneyTooltip currency={baseCurrency} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {venturePie.map((v) => (
                      <div key={v.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        <span className="flex-1 truncate">{v.name}</span>
                        <span className="num text-muted">{((v.value / totalDeployed) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Per-venture cards */}
            {ventures.map((v, idx) => (
              <VentureCard
                key={v.id} venture={v}
                accent={VENTURE_PALETTE[idx % VENTURE_PALETTE.length]}
                baseCurrency={baseCurrency} rates={rates}
                isExpanded={openVentureId === v.id}
                onToggleExpand={() => setOpenVentureId((cur) => (cur === v.id ? null : v.id))}
              />
            ))}
          </div>
        )}
      </motion.section>

      <AddAssetSheet   open={addingAsset}   onClose={() => setAddingAsset(false)} />
      <AddVentureSheet open={addingVenture} onClose={() => setAddingVenture(false)} />
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════
// VENTURE CARD — the new heart of this module
// ════════════════════════════════════════════════════════════════════
function VentureCard({ venture, accent, baseCurrency, rates, isExpanded, onToggleExpand }) {
  const setStatus = useStore((s) => s.setVentureStatus);
  const remove    = useStore((s) => s.removeVenture);

  const typeMeta = VENTURE_TYPES.find((t) => t.id === venture.type) || VENTURE_TYPES[VENTURE_TYPES.length - 1];
  const statusMeta = VENTURE_STATUS[venture.status] || VENTURE_STATUS.active;

  const startedDate = venture.startDate
    ? new Date(venture.startDate).toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : null;
  const exitDate = venture.targetExitDate
    ? new Date(venture.targetExitDate).toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : null;

  const roiPositive = venture.roi >= 0;
  const multipleDisplay = venture.multiple > 0 ? `${venture.multiple.toFixed(2)}x` : '—';

  const ageDays = venture.startDate
    ? Math.floor((Date.now() - new Date(venture.startDate).getTime()) / (24 * 3600 * 1000))
    : null;
  // Simple annualized ROI: ((value/cost)^(365/ageDays)) − 1, only if age > 30 days
  const annualized = (ageDays && ageDays > 30 && venture.deployedTotal > 0 && venture.currentValueBase > 0)
    ? Math.pow(venture.currentValueBase / venture.deployedTotal, 365 / ageDays) - 1
    : null;

  return (
    <motion.div layout className="surface border rounded-2xl overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{venture.name}</h3>
              <button
                onClick={() => {
                  const order = ['active', 'planning', 'paused', 'exited', 'failed'];
                  const next = order[(order.indexOf(venture.status) + 1) % order.length];
                  setStatus(venture.id, next);
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta.cls} hover:scale-105 transition-transform`}
              >
                {statusMeta.label}
              </button>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg)] text-muted">
                {typeMeta.label}
              </span>
            </div>
            {venture.notes && <p className="text-[11px] text-muted mt-0.5 truncate">{venture.notes}</p>}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted">
              {startedDate && (
                <span className="flex items-center gap-1"><Calendar size={9} /> Since {startedDate}</span>
              )}
              {exitDate && (
                <span className="flex items-center gap-1"><TargetIcon size={9} /> Exit target {exitDate}</span>
              )}
              {venture.partners && (
                <span className="flex items-center gap-1"><Users size={9} /> {venture.partners}</span>
              )}
            </div>
          </div>
          <button onClick={() => remove(venture.id)}
            className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center transition-colors">
            <Trash2 size={13} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
          <Metric label="Deployed" value={formatCompact(venture.deployedTotal, baseCurrency)} />
          <Metric label="Now worth" value={formatCompact(venture.currentValueBase, baseCurrency)} />
          <Metric label="Multiple" value={multipleDisplay} tone={roiPositive ? 'income' : 'expense'} />
        </div>

        <div className="flex items-baseline justify-between text-[11px] mb-2">
          <div className="text-muted flex items-center gap-2">
            <span className={`num font-medium ${roiPositive ? 'text-accent-income' : 'text-accent-expense'}`}>
              {roiPositive ? '+' : '−'}{formatCompact(Math.abs(venture.roi), baseCurrency)}
            </span>
            <span>ROI ({(venture.roiPct * 100).toFixed(1)}%)</span>
          </div>
          {annualized !== null && (
            <span className="text-muted num">
              ≈ {(annualized * 100).toFixed(1)}% / yr
            </span>
          )}
        </div>

        {venture.deployedTotal > 0 && (
          <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (venture.currentValueBase / venture.deployedTotal) * 100)}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ backgroundColor: roiPositive ? accent : '#c2452f' }}
            />
          </div>
        )}

        <button onClick={onToggleExpand}
          className="w-full text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors flex items-center justify-center gap-1.5">
          {isExpanded ? <><ChevronUp size={12} /> Collapse</> : <><ChevronDown size={12} /> Manage</>}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <VentureDetail venture={venture} accent={accent} baseCurrency={baseCurrency} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Metric({ label, value, tone }) {
  const toneClass = tone === 'income' ? 'text-accent-income' : tone === 'expense' ? 'text-accent-expense' : '';
  return (
    <div className="bg-[var(--bg)] rounded-lg p-2.5">
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">{label}</div>
      <div className={`font-display text-base num mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VENTURE DETAIL — expanded inline drawer
// ════════════════════════════════════════════════════════════════════
function VentureDetail({ venture, accent, baseCurrency }) {
  const milestones    = useStore(selectVentureMilestones);
  const journal       = useStore(selectVentureJournal);
  const distributions = useStore(selectVentureDistributions);
  const borrowedDeps  = useStore(selectBorrowedDeployments);
  const debts         = useStore(selectDebts);

  const myMilestones = useMemo(
    () => milestones.filter((m) => m.ventureId === venture.id)
      .sort((a, b) => {
        if (a.status === b.status) return new Date(a.targetDate || 0) - new Date(b.targetDate || 0);
        return a.status === 'completed' ? 1 : -1;
      }),
    [milestones, venture.id]
  );
  const myJournal = useMemo(
    () => journal.filter((j) => j.ventureId === venture.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [journal, venture.id]
  );
  const myDistributions = useMemo(
    () => distributions.filter((d) => d.ventureId === venture.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [distributions, venture.id]
  );
  const myDeployments = useMemo(
    () => (venture.deployments || []).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [venture.deployments]
  );
  // How much of this venture was funded by borrowed money
  const fundedFromBorrowed = useMemo(() => {
    return borrowedDeps
      .filter((d) => d.destinationType === 'venture' && d.destinationId === venture.id)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  }, [borrowedDeps, venture.id]);

  return (
    <div className="p-4 space-y-4">
      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <DeployButton venture={venture} debts={debts} />
        <DistributionButton venture={venture} />
        <RevalueButton venture={venture} />
      </div>

      {fundedFromBorrowed > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
          <HandCoins size={14} className="text-amber-700 dark:text-amber-400 shrink-0" />
          <span className="text-[11px] text-muted flex-1">
            <span className="num font-medium">{formatCompact(fundedFromBorrowed, venture.valuationCurrency || baseCurrency)}</span> funded from borrowed capital
          </span>
        </div>
      )}

      {/* Deployments */}
      <Section title="Capital deployed" count={myDeployments.length} accent={accent}>
        {myDeployments.length === 0 ? (
          <Empty text="No deployments yet" />
        ) : (
          <ul className="space-y-1.5">
            {myDeployments.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[11px]">
                <ArrowUpRight size={10} className="text-muted shrink-0" />
                <span className="num font-medium">{formatMoney(d.amount, d.currency)}</span>
                <span className="text-muted truncate flex-1">{d.note || 'capital'}</span>
                {d.fundedByDebtId && (
                  <HandCoins size={9} className="text-amber-700 dark:text-amber-400" title="From borrowed capital" />
                )}
                <span className="text-muted">{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
              </li>
            ))}
            {myDeployments.length > 5 && (
              <li className="text-[10px] text-muted pl-4">+{myDeployments.length - 5} more</li>
            )}
          </ul>
        )}
      </Section>

      {/* Distributions / revaluations */}
      <Section title="Returns & valuation" count={myDistributions.length} accent={accent}>
        {myDistributions.length === 0 ? (
          <Empty text="No distributions or revaluations yet" />
        ) : (
          <ul className="space-y-1.5">
            {myDistributions.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[11px]">
                {d.type === 'distribution' ? (
                  <Banknote size={10} className="text-accent-income shrink-0" />
                ) : (
                  <TrendingUp size={10} className="text-blue-600 shrink-0" />
                )}
                <span className={`num font-medium ${d.type === 'distribution' ? 'text-accent-income' : ''}`}>
                  {d.type === 'distribution' ? '+' : '~'}{formatMoney(d.amount, d.currency)}
                </span>
                <span className="text-muted truncate flex-1">
                  {d.type === 'distribution' ? 'Distribution' : 'Valuation'}
                  {d.note ? ` · ${d.note}` : ''}
                </span>
                <span className="text-muted">{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
              </li>
            ))}
            {myDistributions.length > 5 && (
              <li className="text-[10px] text-muted pl-4">+{myDistributions.length - 5} more</li>
            )}
          </ul>
        )}
      </Section>

      {/* Milestones */}
      <Section title="Milestones" count={myMilestones.length} accent={accent}
        action={<AddMilestoneInline ventureId={venture.id} />}
      >
        {myMilestones.length === 0 ? (
          <Empty text="No milestones set" />
        ) : (
          <MilestonesList milestones={myMilestones} />
        )}
      </Section>

      {/* Journal */}
      <Section title="Journal" count={myJournal.length} accent={accent}
        action={<AddJournalInline ventureId={venture.id} />}
      >
        {myJournal.length === 0 ? (
          <Empty text="No journal entries" />
        ) : (
          <JournalList journal={myJournal} />
        )}
      </Section>
    </div>
  );
}

function Section({ title, count, accent, action, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] text-muted">· {count}</span>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="text-[11px] text-muted text-center py-3 bg-[var(--bg)] rounded-lg">{text}</div>
  );
}

function MilestonesList({ milestones }) {
  const toggle = useStore((s) => s.toggleVentureMilestone);
  const remove = useStore((s) => s.removeVentureMilestone);
  return (
    <ul className="space-y-1.5">
      {milestones.map((m) => {
        const done = m.status === 'completed';
        const dueDate = m.targetDate
          ? new Date(m.targetDate).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
          : null;
        const isOverdue = m.targetDate && new Date(m.targetDate) < new Date() && !done;
        return (
          <li key={m.id} className="flex items-center gap-2 bg-[var(--bg)] rounded-lg px-3 py-2">
            <button onClick={() => toggle(m.id)} className="shrink-0">
              {done
                ? <CheckCircle2 size={14} className="text-accent-income" />
                : <Circle size={14} className="text-muted" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-[12px] truncate ${done ? 'line-through text-muted' : ''}`}>{m.name}</div>
              {dueDate && (
                <div className={`text-[10px] ${isOverdue ? 'text-accent-expense' : 'text-muted'}`}>
                  {done ? 'Completed' : (isOverdue ? `Overdue · ${dueDate}` : `Target ${dueDate}`)}
                </div>
              )}
            </div>
            <button onClick={() => remove(m.id)}
              className="w-6 h-6 rounded hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center">
              <Trash2 size={11} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AddMilestoneInline({ ventureId }) {
  const addMilestone = useStore((s) => s.addVentureMilestone);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');

  const submit = (e) => {
    e?.preventDefault?.();
    if (!name.trim()) return;
    addMilestone(ventureId, { name: name.trim(), targetDate: target ? new Date(target + 'T00:00:00').toISOString() : '' });
    setName(''); setTarget(''); setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-muted hover:text-[var(--text)] flex items-center gap-1">
        <Plus size={10} /> Add
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Milestone"
        className="w-24 px-2 py-1 rounded bg-[var(--bg)] outline-none text-[11px]"
        autoFocus
      />
      <input
        type="date" value={target} onChange={(e) => setTarget(e.target.value)}
        className="w-28 px-2 py-1 rounded bg-[var(--bg)] outline-none text-[11px] num"
      />
      <button type="submit" disabled={!name.trim()}
        className="px-2 py-1 rounded bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-[10px] font-medium disabled:opacity-40">
        OK
      </button>
      <button type="button" onClick={() => { setOpen(false); setName(''); setTarget(''); }}
        className="text-[10px] text-muted">×</button>
    </form>
  );
}

function JournalList({ journal }) {
  const remove = useStore((s) => s.removeVentureJournalEntry);
  return (
    <ul className="space-y-1.5">
      {journal.slice(0, 10).map((j) => (
        <li key={j.id} className="bg-[var(--bg)] rounded-lg px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] flex-1 leading-snug">{j.entry}</p>
            <button onClick={() => remove(j.id)}
              className="w-5 h-5 rounded hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center shrink-0">
              <Trash2 size={10} />
            </button>
          </div>
          <div className="text-[10px] text-muted mt-0.5">
            {new Date(j.date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </li>
      ))}
      {journal.length > 10 && (
        <li className="text-[10px] text-muted text-center">+{journal.length - 10} more</li>
      )}
    </ul>
  );
}

function AddJournalInline({ ventureId }) {
  const addJournal = useStore((s) => s.addVentureJournalEntry);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const submit = (e) => {
    e?.preventDefault?.();
    if (!text.trim()) return;
    addJournal(ventureId, text.trim());
    setText(''); setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-muted hover:text-[var(--text)] flex items-center gap-1">
        <BookOpen size={10} /> Write
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        type="text" value={text} onChange={(e) => setText(e.target.value)}
        placeholder="What happened?"
        className="w-40 px-2 py-1 rounded bg-[var(--bg)] outline-none text-[11px]"
        autoFocus
      />
      <button type="submit" disabled={!text.trim()}
        className="px-2 py-1 rounded bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-[10px] font-medium disabled:opacity-40">
        Save
      </button>
      <button type="button" onClick={() => { setOpen(false); setText(''); }}
        className="text-[10px] text-muted">×</button>
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════
// DEPLOY / DISTRIBUTION / REVALUE — quick-action buttons
// ════════════════════════════════════════════════════════════════════
function DeployButton({ venture, debts }) {
  const deploy = useStore((s) => s.deployToVenture);
  const debtEvents = useStore(selectDebtEvents);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(venture.valuationCurrency || 'USD');
  const [note, setNote] = useState('');
  const [sourceDebtId, setSourceDebtId] = useState('');

  // Debts that still have un-deployed borrowed capital
  const borrowedSources = useMemo(() => {
    const out = [];
    for (const d of debts) {
      if ((d.direction || 'owe') !== 'owe') continue;
      if (d.status === 'paid') continue;
      const repaid = computeDebtRepaid(debtEvents, d.id);
      const remaining = d.principal - repaid;
      if (remaining > 0) out.push(d);
    }
    return out;
  }, [debts, debtEvents]);

  const submit = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    deploy(venture.id, { amount: v, currency, note, fundedByDebtId: sourceDebtId || '' });
    setAmount(''); setNote(''); setSourceDebtId(''); setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-[11px] font-medium flex items-center justify-center gap-1">
        <ArrowUpRight size={11} /> Deploy
      </button>
      <SheetShell open={open} onClose={() => setOpen(false)} title={`Deploy to ${venture.name}`}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
            {Object.values(CURRENCIES).map((c) => (
              <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                className={`py-1.5 rounded text-[11px] font-medium ${
                  currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                }`}>
                {c.code}
              </button>
            ))}
          </div>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (${currency})`} autoFocus
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm num focus:ring-2 focus:ring-[var(--border)]" />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. inventory, ads, setup)"
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

          {borrowedSources.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 px-1 flex items-center gap-1">
                <HandCoins size={10} /> Source <span className="opacity-60 normal-case tracking-normal">(optional)</span>
              </div>
              <div className="space-y-1.5">
                <button type="button" onClick={() => setSourceDebtId('')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] ${
                    sourceDebtId === ''
                      ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
                      : 'bg-[var(--bg)]'
                  }`}
                >
                  <Banknote size={12} />
                  <span>From War Chest (your money)</span>
                </button>
                {borrowedSources.map((d) => (
                  <button key={d.id} type="button" onClick={() => setSourceDebtId(d.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] ${
                      sourceDebtId === d.id
                        ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
                        : 'bg-[var(--bg)]'
                    }`}
                  >
                    <HandCoins size={12} />
                    <span className="flex-1 truncate">Borrowed from {d.creditor}</span>
                    <span className="num text-muted text-[11px]">{formatCompact(d.principal, d.currency)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
            Confirm deployment
          </button>
        </form>
      </SheetShell>
    </>
  );
}

function DistributionButton({ venture }) {
  const record = useStore((s) => s.recordVentureDistribution);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(venture.valuationCurrency || 'USD');
  const [note, setNote] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    record(venture.id, { type: 'distribution', amount: v, currency, note });
    setAmount(''); setNote(''); setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-[11px] font-medium flex items-center justify-center gap-1">
        <Banknote size={11} /> Distribute
      </button>
      <SheetShell open={open} onClose={() => setOpen(false)} title={`Distribution from ${venture.name}`}>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[11px] text-muted">Cash returned from this venture. Goes into War Chest.</p>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
            {Object.values(CURRENCIES).map((c) => (
              <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                className={`py-1.5 rounded text-[11px] font-medium ${
                  currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                }`}>
                {c.code}
              </button>
            ))}
          </div>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (${currency})`} autoFocus
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm num focus:ring-2 focus:ring-[var(--border)]" />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. quarterly payout)"
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />
          <button type="submit" disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
            Record distribution
          </button>
        </form>
      </SheetShell>
    </>
  );
}

function RevalueButton({ venture }) {
  const revalue = useStore((s) => s.revalueVenture);
  const [open, setOpen] = useState(false);
  const [valuation, setValuation] = useState(String(venture.currentValuation || ''));
  const [currency, setCurrency] = useState(venture.valuationCurrency || 'USD');
  const [note, setNote] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const v = parseFloat(valuation);
    if (!v || v < 0) return;
    revalue(venture.id, v, currency, note);
    setNote(''); setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] text-[11px] font-medium flex items-center justify-center gap-1">
        <TrendingUp size={11} /> Revalue
      </button>
      <SheetShell open={open} onClose={() => setOpen(false)} title={`Revalue ${venture.name}`}>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[11px] text-muted">Update the current valuation (mark-to-market).</p>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
            {Object.values(CURRENCIES).map((c) => (
              <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
                className={`py-1.5 rounded text-[11px] font-medium ${
                  currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
                }`}>
                {c.code}
              </button>
            ))}
          </div>
          <input type="number" step="0.01" value={valuation} onChange={(e) => setValuation(e.target.value)}
            placeholder={`New valuation (${currency})`} autoFocus
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm num focus:ring-2 focus:ring-[var(--border)]" />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Why? (optional)"
            className="w-full px-3 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />
          <button type="submit" disabled={!valuation || parseFloat(valuation) < 0}
            className="w-full py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
            Update valuation
          </button>
        </form>
      </SheetShell>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ASSET row + add sheets (preserved)
// ════════════════════════════════════════════════════════════════════
function AssetRow({ inv, baseCurrency, rates }) {
  const removeInvestment = useStore((s) => s.removeInvestment);
  const updatePrice = useStore((s) => s.updateInvestmentPrice);
  const Meta = KIND_META[inv.kind] || KIND_META.other;
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(inv.currentPrice);

  const value   = inv.units * inv.currentPrice;
  const cost    = inv.units * inv.costBasis;
  const gain    = value - cost;
  const gainPct = cost > 0 ? gain / cost : 0;
  const valueBase = convert(value, inv.currency, baseCurrency, rates);

  const savePrice = () => { updatePrice(inv.id, price); setEditing(false); };

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${Meta.color}1f`, color: Meta.color }}>
          <Meta.icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{inv.name}</div>
          <div className="text-[11px] text-muted truncate num">
            {inv.units} × {formatMoney(inv.currentPrice, inv.currency)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium num">{formatMoney(value, inv.currency)}</div>
          <div className={`text-[11px] num ${gain >= 0 ? 'text-accent-income' : 'text-accent-expense'}`}>
            {gain >= 0 ? '+' : '−'}{(Math.abs(gainPct) * 100).toFixed(1)}%
          </div>
        </div>
        <button onClick={() => removeInvestment(inv.id)}
          className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2 pl-12 text-[11px] text-muted">
        {inv.currency !== baseCurrency && (
          <span className="num">≈ {formatMoney(valueBase, baseCurrency)}</span>
        )}
        {inv.fundedByDebtId && (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <HandCoins size={10} /> borrowed
          </span>
        )}
        <button onClick={() => setEditing((v) => !v)} className="ml-auto hover:text-[var(--text)] transition-colors">
          {editing ? 'cancel' : 'update price'}
        </button>
      </div>
      {editing && (
        <div className="flex items-center gap-2 mt-2 pl-12">
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg)] outline-none text-xs num focus:ring-2 focus:ring-[var(--border)]" />
          <button onClick={savePrice}
            className="px-3 py-1.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-xs font-medium">
            Save
          </button>
        </div>
      )}
    </li>
  );
}

function MoneyTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="surface border rounded-xl px-3 py-2 shadow-lg text-xs">
      <div className="font-medium">{p.name}</div>
      <div className="num text-muted mt-0.5">{formatMoney(p.value, currency)}</div>
    </div>
  );
}

function AddAssetSheet({ open, onClose }) {
  const addInvestment = useStore((s) => s.addInvestment);
  const debts = useStore(selectDebts);
  const debtEvents = useStore(selectDebtEvents);
  const [kind, setKind] = useState('stock');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [sourceDebtId, setSourceDebtId] = useState('');

  const borrowedSources = useMemo(() => {
    const out = [];
    for (const d of debts) {
      if ((d.direction || 'owe') !== 'owe') continue;
      if (d.status === 'paid') continue;
      const repaid = computeDebtRepaid(debtEvents, d.id);
      const remaining = d.principal - repaid;
      if (remaining > 0) out.push(d);
    }
    return out;
  }, [debts, debtEvents]);

  const submit = (e) => {
    e.preventDefault();
    if (!name || !units || !costBasis) return;
    addInvestment({
      kind, name,
      units: parseFloat(units),
      costBasis: parseFloat(costBasis),
      currentPrice: parseFloat(currentPrice || costBasis),
      currency,
      fundedByDebtId: sourceDebtId || '',
    });
    setName(''); setUnits(''); setCostBasis(''); setCurrentPrice(''); setSourceDebtId('');
    onClose();
  };

  return (
    <SheetShell open={open} onClose={onClose} title="New asset">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-[var(--bg)]">
          {Object.entries(KIND_META).map(([k, m]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`py-2 rounded-lg text-[11px] font-medium flex flex-col items-center gap-0.5 ${
                kind === k ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
              }`}>
              <m.icon size={14} style={{ color: kind === k ? m.color : undefined }} />
              {m.label}
            </button>
          ))}
        </div>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. AAPL, 1oz Gold)"
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
          {Object.values(CURRENCIES).map((c) => (
            <button key={c.code} type="button" onClick={() => setCurrency(c.code)}
              className={`py-2 rounded-lg text-xs font-medium ${
                currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
              }`}>
              {c.code}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <LabeledInput label="Units" value={units} onChange={setUnits} />
          <LabeledInput label="Cost / unit" value={costBasis} onChange={setCostBasis} />
          <LabeledInput label="Now / unit" value={currentPrice} onChange={setCurrentPrice} />
        </div>

        {borrowedSources.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 px-1 flex items-center gap-1">
              <HandCoins size={10} /> Source <span className="opacity-60 normal-case tracking-normal">(optional)</span>
            </div>
            <div className="space-y-1.5">
              <button type="button" onClick={() => setSourceDebtId('')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] ${
                  sourceDebtId === ''
                    ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
                    : 'bg-[var(--bg)]'
                }`}
              >
                <Banknote size={12} />
                <span>From War Chest (your money)</span>
              </button>
              {borrowedSources.map((d) => (
                <button key={d.id} type="button" onClick={() => setSourceDebtId(d.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[12px] ${
                    sourceDebtId === d.id
                      ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900'
                      : 'bg-[var(--bg)]'
                  }`}
                >
                  <HandCoins size={12} />
                  <span className="flex-1 truncate">Borrowed from {d.creditor}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={!name || !units || !costBasis}
          className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40">
          Add asset
        </button>
      </form>
    </SheetShell>
  );
}

function AddVentureSheet({ open, onClose }) {
  const addVenture = useStore((s) => s.addVenture);
  const [name, setName] = useState('');
  const [type, setType] = useState('business');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetExit, setTargetExit] = useState('');
  const [targetMultiple, setTargetMultiple] = useState('');
  const [partners, setPartners] = useState('');
  const [currentValuation, setCurrentValuation] = useState('');
  const [valuationCurrency, setValuationCurrency] = useState('USD');

  const submit = (e) => {
    e.preventDefault();
    if (!name) return;
    addVenture({
      name, type, notes,
      startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : '',
      targetExitDate: targetExit ? new Date(targetExit + 'T00:00:00').toISOString() : '',
      currentValuation: parseFloat(currentValuation || '0'),
      valuationCurrency,
      targetMultiple: parseFloat(targetMultiple || '0'),
      partners,
    });
    setName(''); setNotes(''); setTargetExit(''); setTargetMultiple(''); setPartners(''); setCurrentValuation('');
    onClose();
  };

  return (
    <SheetShell open={open} onClose={onClose} title="New venture">
      <form onSubmit={submit} className="space-y-4">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Venture name" autoFocus
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1.5 px-1">Type</div>
          <div className="grid grid-cols-2 gap-1.5">
            {VENTURE_TYPES.map((t) => {
              const sel = type === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className={`px-3 py-2.5 rounded-xl border text-[11px] font-medium transition-all ${
                    sel
                      ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                      : 'bg-[var(--bg)] border-transparent text-muted'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1 px-1">Start date</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] outline-none text-xs num" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1 px-1">Target exit</div>
            <input type="date" value={targetExit} onChange={(e) => setTargetExit(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] outline-none text-xs num" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
          {Object.values(CURRENCIES).map((c) => (
            <button key={c.code} type="button" onClick={() => setValuationCurrency(c.code)}
              className={`py-2 rounded-lg text-xs font-medium ${
                valuationCurrency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
              }`}>
              {c.code}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">Current valuation</div>
            <input type="number" step="0.01" value={currentValuation} onChange={(e) => setCurrentValuation(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent outline-none text-sm num mt-0.5" />
          </div>
          <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">Target multiple (x)</div>
            <input type="number" step="0.1" value={targetMultiple} onChange={(e) => setTargetMultiple(e.target.value)}
              placeholder="2"
              className="w-full bg-transparent outline-none text-sm num mt-0.5" />
          </div>
        </div>

        <input type="text" value={partners} onChange={(e) => setPartners(e.target.value)}
          placeholder="Partners (optional)"
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />

        <button type="submit" disabled={!name}
          className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40">
          Create venture
        </button>
      </form>
    </SheetShell>
  );
}

function LabeledInput({ label, value, onChange }) {
  return (
    <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-[0.1em] text-muted font-semibold">{label}</div>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full bg-transparent outline-none text-sm num mt-0.5" />
    </div>
  );
}

function SheetShell({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="px-5 pt-2 pb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl">{title}</h2>
                <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
