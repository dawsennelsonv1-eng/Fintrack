// src/modules/Investments.jsx
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plus, X, TrendingUp, TrendingDown, Briefcase, Coins, LineChart as LineIcon, Trash2, Rocket, ArrowUpRight } from 'lucide-react';
import {
  useStore,
  selectInvestments, selectVentures, selectInvestmentTotals, selectVentureTotals,
  selectBaseCurrency, selectRates,
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

export default function Investments() {
  const investments  = useStore(selectInvestments);
  const totals       = useStore(selectInvestmentTotals);
  const ventures     = useStore(selectVentureTotals);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

  const [addingAsset, setAddingAsset] = useState(false);
  const [addingVenture, setAddingVenture] = useState(false);

  // Pie data — by asset kind
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

  const venturePie = useMemo(() => ventures
    .filter((v) => v.deployedTotal > 0)
    .map((v, i) => ({
      name: v.name, value: v.deployedTotal, color: VENTURE_PALETTE[i % VENTURE_PALETTE.length],
    })), [ventures]);

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Wealth</div>
        <h1 className="font-display text-4xl">The empire</h1>
      </motion.section>

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

      {/* Allocation pie */}
      {allocation.length > 0 && (
        <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }}
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
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.15 }} className="mb-5">
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

      {/* ═══ VENTURES — seed capital tracker ═══ */}
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.2 }}
        className="mb-4">
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
            <div className="text-sm text-muted">Track capital deployed into side-hustles</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="surface border rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Total Capital Deployed</div>
                  <div className="font-display text-3xl num mt-1">{formatMoney(totalDeployed, baseCurrency)}</div>
                </div>
                <span className="text-[11px] text-muted num">{ventures.length} ventures</span>
              </div>

              {venturePie.length > 0 && (
                <div className="flex items-center gap-5 mt-4">
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

            {/* Venture detail cards */}
            {ventures.map((v, idx) => (
              <VentureCard key={v.id} venture={v} accent={VENTURE_PALETTE[idx % VENTURE_PALETTE.length]}
                baseCurrency={baseCurrency} rates={rates} totalDeployed={totalDeployed} />
            ))}
          </div>
        )}
      </motion.section>

      <AddAssetSheet   open={addingAsset}   onClose={() => setAddingAsset(false)} />
      <AddVentureSheet open={addingVenture} onClose={() => setAddingVenture(false)} />
    </main>
  );
}

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
      {(inv.currency !== baseCurrency || true) && (
        <div className="flex items-center gap-2 mt-2 pl-12 text-[11px] text-muted">
          {inv.currency !== baseCurrency && (
            <span className="num">≈ {formatMoney(valueBase, baseCurrency)}</span>
          )}
          <button onClick={() => setEditing((v) => !v)} className="ml-auto hover:text-[var(--text)] transition-colors">
            {editing ? 'cancel' : 'update price'}
          </button>
        </div>
      )}
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

function VentureCard({ venture, accent, baseCurrency, rates, totalDeployed }) {
  const setStatus = useStore((s) => s.setVentureStatus);
  const remove = useStore((s) => s.removeVenture);
  const deploy = useStore((s) => s.deployToVenture);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [note, setNote] = useState('');

  const pct = totalDeployed > 0 ? (venture.deployedTotal / totalDeployed) * 100 : 0;
  const recent = venture.deployed.slice(-5).reverse();

  const handleDeploy = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    deploy(venture.id, { amount: v, currency, note });
    setAmount(''); setNote(''); setOpen(false);
  };

  return (
    <motion.div layout className="surface border rounded-2xl p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{venture.name}</h3>
            <StatusPill status={venture.status} onChange={(s) => setStatus(venture.id, s)} />
          </div>
          {venture.notes && <p className="text-[11px] text-muted mt-0.5 truncate">{venture.notes}</p>}
        </div>
        <button onClick={() => remove(venture.id)}
          className="w-7 h-7 rounded-lg hover:bg-accent-expense/10 text-muted hover:text-accent-expense flex items-center justify-center transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <div className="font-display text-2xl num">{formatMoney(venture.deployedTotal, baseCurrency)}</div>
        <div className="text-[11px] text-muted num">{pct.toFixed(0)}% of pool</div>
      </div>

      <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden mb-3">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full" style={{ backgroundColor: accent }} />
      </div>

      {recent.length > 0 && (
        <div className="space-y-1 mb-2 text-[11px]">
          {recent.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-muted">
              <ArrowUpRight size={10} />
              <span className="num">{formatMoney(d.amount, d.currency)}</span>
              <span className="truncate">{d.note || 'capital'}</span>
              <span className="ml-auto">{new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setOpen((v) => !v)}
        className="w-full text-xs py-2 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)] transition-colors">
        {open ? 'Cancel' : '+ Deploy capital'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleDeploy}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[var(--bg)]">
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
                placeholder={`Amount (${currency})`}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm num focus:ring-2 focus:ring-[var(--border)]" />
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Note (e.g. inventory, ads)"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />
              <button type="submit" disabled={!amount || parseFloat(amount) <= 0}
                className="w-full py-2 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40">
                Confirm deployment
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusPill({ status, onChange }) {
  const cycle = () => {
    const order = ['active', 'paused', 'returned', 'failed'];
    onChange(order[(order.indexOf(status) + 1) % order.length]);
  };
  const cfg = {
    active:   { label: 'Active',   cls: 'bg-accent-income/10 text-accent-income' },
    paused:   { label: 'Paused',   cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    returned: { label: 'Returned', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    failed:   { label: 'Failed',   cls: 'bg-accent-expense/10 text-accent-expense' },
  }[status] || { label: status, cls: 'bg-[var(--bg)] text-muted' };
  return (
    <button onClick={cycle}
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.cls} hover:scale-105 transition-transform`}>
      {cfg.label}
    </button>
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
  const [kind, setKind] = useState('stock');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('USD');

  const submit = (e) => {
    e.preventDefault();
    if (!name || !units || !costBasis) return;
    addInvestment({
      kind, name,
      units: parseFloat(units),
      costBasis: parseFloat(costBasis),
      currentPrice: parseFloat(currentPrice || costBasis),
      currency,
    });
    setName(''); setUnits(''); setCostBasis(''); setCurrentPrice('');
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
  const [notes, setNotes] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name) return;
    addVenture({ name, notes });
    setName(''); setNotes(''); onClose();
  };
  return (
    <SheetShell open={open} onClose={onClose} title="New venture">
      <form onSubmit={submit} className="space-y-4">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Venture name"
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg)] outline-none text-sm focus:ring-2 focus:ring-[var(--border)]" />
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Description (optional)"
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
