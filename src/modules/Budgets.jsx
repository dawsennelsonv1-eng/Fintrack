// src/modules/Budgets.jsx
// The "Budgets" tab is the home of the Buckets & Goals system.
// (Name kept as Budgets in the bottom nav for familiarity.)
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Wallet, Shield, Heart, Sparkles,
  Plus, X, ArrowRight, ArrowLeftRight, Target, Trash2, Check,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  useStore,
  selectBuckets, selectGoals, selectTransactions,
  selectBaseCurrency, selectRates,
  computeBucketBalances, computeBucketMTD, computeGoalsForBucket,
} from '../store/useStore';
import { CURRENCIES, convert, formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

const ICON_MAP = {
  TrendingUp, Wallet, Shield, Heart, Sparkles,
};

export default function BudgetsModule() {
  const buckets      = useStore(selectBuckets);
  const goals        = useStore(selectGoals);
  const transactions = useStore(selectTransactions);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

  const balances = useMemo(
    () => computeBucketBalances(transactions, baseCurrency, rates),
    [transactions, baseCurrency, rates]
  );
  const mtd = useMemo(
    () => computeBucketMTD(transactions, baseCurrency, rates),
    [transactions, baseCurrency, rates]
  );

  const sortedBuckets = useMemo(
    () => [...buckets].filter((b) => b.enabled !== false).sort((a, b) => a.order - b.order),
    [buckets]
  );

  const totalBalance = useMemo(
    () => sortedBuckets.reduce((sum, b) => sum + (balances[b.key] || 0), 0),
    [sortedBuckets, balances]
  );

  const [transferOpen, setTransferOpen] = useState(false);
  const [activeBucket, setActiveBucket] = useState(null); // for goals sheet

  if (sortedBuckets.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Buckets</div>
        <h1 className="font-display text-4xl mb-6">Budgets</h1>
        <div className="surface border rounded-2xl p-8 text-center">
          <Wallet size={28} className="mx-auto text-muted mb-3" strokeWidth={1.5} />
          <div className="font-display text-xl mb-1">Setting up buckets…</div>
          <div className="text-sm text-muted">If this persists, pull from sheet via the sync badge.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-5 pt-4 pb-32">
      <motion.section {...fadeUp} transition={{ duration: 0.5, ease }} className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-1">Buckets</div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-4xl">Budgets</h1>
          <button
            onClick={() => setTransferOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeftRight size={13} /> Transfer
          </button>
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.05 }} className="mb-5">
        <div className="surface border rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Total across buckets</div>
          <div className={`font-display text-4xl num mt-1 ${totalBalance < 0 ? 'text-accent-expense' : ''}`}>
            {formatMoney(totalBalance, baseCurrency)}
          </div>
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ duration: 0.5, ease, delay: 0.1 }}
        className="space-y-3 mb-6">
        {sortedBuckets.map((bucket, i) => (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            balance={balances[bucket.key] || 0}
            mtd={mtd[bucket.key] || { inflow: 0, outflow: 0 }}
            goals={goals}
            baseCurrency={baseCurrency}
            rates={rates}
            onOpenGoals={() => setActiveBucket(bucket)}
            delay={0.12 + i * 0.05}
          />
        ))}
      </motion.section>

      <p className="text-[11px] text-muted text-center">
        Buckets fill automatically when you log income.
        Tap a bucket to manage goals.
      </p>

      <BucketTransferSheet
        open={transferOpen}
        buckets={sortedBuckets}
        balances={balances}
        baseCurrency={baseCurrency}
        rates={rates}
        onClose={() => setTransferOpen(false)}
      />

      <GoalsSheet
        bucket={activeBucket}
        balance={activeBucket ? (balances[activeBucket.key] || 0) : 0}
        onClose={() => setActiveBucket(null)}
      />
    </main>
  );
}

// ════════════════════════════════════════════════════════════════════
// BUCKET CARD
// ════════════════════════════════════════════════════════════════════
function BucketCard({ bucket, balance, mtd, goals, baseCurrency, rates, onOpenGoals, delay }) {
  const Icon = ICON_MAP[bucket.icon] || Wallet;

  const bucketGoals = useMemo(
    () => computeGoalsForBucket(goals, bucket.key, balance, baseCurrency, rates),
    [goals, bucket.key, balance, baseCurrency, rates]
  );

  const activeGoals = bucketGoals.filter((g) => g.status === 'active');
  const claimedGoals = goals.filter((g) => g.bucketKey === bucket.key && g.status === 'claimed').length;
  const readyCount = activeGoals.filter((g) => g.ready).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay }}
      className="surface border rounded-2xl overflow-hidden"
    >
      <button
        onClick={onOpenGoals}
        className="w-full text-left active:bg-[var(--bg)] transition-colors"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
            >
              <Icon size={20} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{bucket.name}</div>
                  <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">
                    {bucket.percentage}% of income
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-xl num ${balance < 0 ? 'text-accent-expense' : ''}`}>
                    {formatMoney(balance, baseCurrency)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted num">
                {mtd.inflow > 0 && (
                  <span className="text-accent-income">+{formatCompact(mtd.inflow, baseCurrency)} in</span>
                )}
                {mtd.outflow > 0 && (
                  <span className="text-accent-expense">−{formatCompact(mtd.outflow, baseCurrency)} out</span>
                )}
                {mtd.inflow === 0 && mtd.outflow === 0 && (
                  <span>No activity this month</span>
                )}
              </div>

              {/* Mini progress bar showing % of total */}
              <div className="h-1 bg-[var(--bg)] rounded-full overflow-hidden mt-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, (balance / Math.max(1, balance + mtd.outflow)) * 100))}%` }}
                  transition={{ duration: 0.8, ease }}
                  className="h-full"
                  style={{ backgroundColor: bucket.color }}
                />
              </div>
            </div>
          </div>

          {/* Goals summary */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border)] text-[11px]">
            {activeGoals.length === 0 && claimedGoals === 0 ? (
              <span className="text-muted flex items-center gap-1.5">
                <Plus size={12} /> Add a goal
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-muted">
                  <Target size={12} />
                  {activeGoals.length} active
                </span>
                {readyCount > 0 && (
                  <span className="text-accent-income font-medium">
                    {readyCount} ready ✦
                  </span>
                )}
                {claimedGoals > 0 && (
                  <span className="text-muted">{claimedGoals} claimed</span>
                )}
                <ArrowRight size={12} className="ml-auto text-muted" />
              </>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════
// BUCKET TRANSFER SHEET
// ════════════════════════════════════════════════════════════════════
function BucketTransferSheet({ open, buckets, balances, baseCurrency, rates, onClose }) {
  const transfer = useStore((s) => s.transferBetweenBuckets);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);

  const reset = () => { setFrom(''); setTo(''); setAmount(''); setCurrency(baseCurrency); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!from || !to || from === to || !v || v <= 0) return;
    transfer({ fromKey: from, toKey: to, amount: v, currency, notes: '' });
    reset();
    onClose();
  };

  const fromBalance = from ? (balances[from] || 0) : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
            </div>
            <div className="px-5 pt-2 pb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl">Transfer between buckets</h2>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <BucketSelect label="From" value={from} onChange={setFrom} buckets={buckets} balances={balances} baseCurrency={baseCurrency} />
                <div className="flex justify-center">
                  <ArrowLeftRight size={18} className="text-muted rotate-90" />
                </div>
                <BucketSelect label="To" value={to} onChange={setTo} buckets={buckets} balances={balances} baseCurrency={baseCurrency} excludeKey={from} />

                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg)]">
                  {Object.values(CURRENCIES).map((c) => (
                    <button
                      key={c.code} type="button" onClick={() => setCurrency(c.code)}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        currency === c.code ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-muted'
                      }`}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>

                <div className="bg-[var(--bg)] rounded-2xl px-5 py-5 text-center">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Amount</div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display text-2xl text-muted">{CURRENCIES[currency].prefix}</span>
                    <input
                      type="number" inputMode="decimal" step="0.01" min="0"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full max-w-[160px] bg-transparent outline-none font-display text-4xl text-center num"
                    />
                    {CURRENCIES[currency].suffix && (
                      <span className="font-display text-2xl text-muted">{CURRENCIES[currency].suffix}</span>
                    )}
                  </div>
                </div>

                <button type="submit"
                  disabled={!from || !to || from === to || !amount || parseFloat(amount) <= 0}
                  className="w-full py-3.5 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 font-medium text-sm disabled:opacity-40 active:scale-[0.99] transition-transform"
                >
                  Transfer
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BucketSelect({ label, value, onChange, buckets, balances, baseCurrency, excludeKey }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2 px-1">{label}</div>
      <div className="grid grid-cols-1 gap-1.5">
        {buckets
          .filter((b) => b.key !== excludeKey)
          .map((b) => {
            const Icon = ICON_MAP[b.icon] || Wallet;
            const selected = value === b.key;
            return (
              <button
                key={b.key} type="button" onClick={() => onChange(b.key)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  selected
                    ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                    : 'bg-[var(--bg)] border-transparent hover:border-[var(--border)]'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={selected ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'currentColor' } : { backgroundColor: `${b.color}1f`, color: b.color }}
                >
                  <Icon size={15} />
                </div>
                <span className="text-sm font-medium flex-1 text-left">{b.name}</span>
                <span className={`text-xs num ${selected ? '' : 'text-muted'}`}>
                  {formatMoney(balances[b.key] || 0, baseCurrency)}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// GOALS SHEET — opens when you tap a bucket card
// ════════════════════════════════════════════════════════════════════
function GoalsSheet({ bucket, balance, onClose }) {
  const goals = useStore(selectGoals);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);
  const addGoal = useStore((s) => s.addGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const claimGoal = useStore((s) => s.claimGoal);
  const updateGoal = useStore((s) => s.updateGoal);
  const reorderGoals = useStore((s) => s.reorderGoals);

  const [adding, setAdding] = useState(false);
  const [claiming, setClaiming] = useState(null); // goal being claimed

  const computed = useMemo(() => {
    if (!bucket) return [];
    return computeGoalsForBucket(goals, bucket.key, balance, baseCurrency, rates);
  }, [bucket, goals, balance, baseCurrency, rates]);

  const claimedGoals = useMemo(() => {
    if (!bucket) return [];
    return goals
      .filter((g) => g.bucketKey === bucket.key && g.status === 'claimed')
      .sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt));
  }, [bucket, goals]);

  const moveGoal = (goalId, direction) => {
    const active = computed.filter((g) => g.status === 'active').sort((a, b) => a.priority - b.priority);
    const idx = active.findIndex((g) => g.id === goalId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= active.length) return;
    const reordered = [...active];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderGoals(bucket.key, reordered.map((g) => g.id));
  };

  if (!bucket) return null;
  const Icon = ICON_MAP[bucket.icon] || Wallet;
  const activeComputed = computed.filter((g) => g.status === 'active');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-50 surface border-t rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[92vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>
        <div className="px-5 pt-2 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${bucket.color}1f`, color: bucket.color }}
            >
              <Icon size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-2xl">{bucket.name}</h2>
              <div className="text-[11px] text-muted">
                {formatMoney(balance, baseCurrency)} · {bucket.percentage}% of income
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[var(--bg)] flex items-center justify-center">
              <X size={16} />
            </button>
          </div>

          {/* Active goals */}
          {activeComputed.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                Goals · in priority order
              </div>
              <div className="space-y-2">
                {activeComputed.map((goal, i) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    isFirst={i === 0}
                    isLast={i === activeComputed.length - 1}
                    bucketColor={bucket.color}
                    baseCurrency={baseCurrency}
                    onClaim={() => setClaiming(goal)}
                    onRemove={() => removeGoal(goal.id)}
                    onMoveUp={() => moveGoal(goal.id, 'up')}
                    onMoveDown={() => moveGoal(goal.id, 'down')}
                    onToggleParallel={() => updateGoal(goal.id, { parallel: !goal.parallel })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add goal button */}
          <AnimatePresence mode="wait">
            {!adding ? (
              <motion.button
                key="add"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium"
              >
                <Plus size={15} /> Add a goal
              </motion.button>
            ) : (
              <NewGoalForm
                key="form"
                bucketKey={bucket.key}
                onSave={(data) => { addGoal(data); setAdding(false); }}
                onCancel={() => setAdding(false)}
              />
            )}
          </AnimatePresence>

          {/* Claimed goals (history) */}
          {claimedGoals.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
                Claimed · {claimedGoals.length}
              </div>
              <div className="space-y-1.5">
                {claimedGoals.slice(0, 5).map((g) => (
                  <div key={g.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg)] text-sm">
                    <div className="w-7 h-7 rounded-lg bg-accent-income/10 text-accent-income flex items-center justify-center">
                      <Check size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate">{g.name}</div>
                      <div className="text-[10px] text-muted">
                        {new Date(g.claimedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-[11px] num text-muted">
                      {formatMoney(g.claimedAmount, g.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Claim confirmation overlay */}
      <ClaimDialog
        goal={claiming}
        baseCurrency={baseCurrency}
        rates={rates}
        onCancel={() => setClaiming(null)}
        onConfirm={(actualAmount) => { claimGoal(claiming.id, { actualAmount }); setClaiming(null); }}
      />
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════════
// GOAL ROW with FILLING RING
// ════════════════════════════════════════════════════════════════════
function GoalRow({ goal, isFirst, isLast, bucketColor, baseCurrency, onClaim, onRemove, onMoveUp, onMoveDown, onToggleParallel }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const progress = Math.min(1, goal.progress);

  return (
    <motion.div
      layout
      className="surface border rounded-xl p-3"
      style={{ borderColor: goal.ready ? bucketColor : undefined }}
    >
      <div className="flex items-center gap-3">
        {/* Filling ring */}
        <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
          <svg viewBox="0 0 56 56" className="-rotate-90 absolute inset-0">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="3.5" />
            <motion.circle
              cx="28" cy="28" r="24" fill="none"
              stroke={bucketColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 24 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - progress) }}
              transition={{ duration: 0.8, ease }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {goal.ready ? (
              <span className="text-[18px]">✦</span>
            ) : (
              <span className="text-[10px] num font-medium">{Math.round(progress * 100)}%</span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted font-medium">#{goal.priority}</span>
            <span className="text-sm font-medium truncate">{goal.name}</span>
            {goal.parallel && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg)] text-muted">
                parallel
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted num mt-0.5">
            {formatMoney(goal.filledBase, baseCurrency)} / {formatMoney(goal.targetBase, baseCurrency)}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp} disabled={isFirst}
            className="w-6 h-5 rounded hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-20"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={onMoveDown} disabled={isLast}
            className="w-6 h-5 rounded hover:bg-[var(--bg)] flex items-center justify-center disabled:opacity-20"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!confirmingDelete ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 mt-3"
          >
            <button
              onClick={onClaim} disabled={!goal.ready}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{
                backgroundColor: goal.ready ? bucketColor : 'var(--bg)',
                color: goal.ready ? '#fff' : 'inherit',
              }}
            >
              {goal.ready ? '✦ Claim' : 'Not ready'}
            </button>
            <button
              onClick={onToggleParallel}
              className="px-3 py-2 rounded-lg bg-[var(--bg)] text-xs hover:bg-[var(--border)] transition-colors"
              title="Toggle parallel filling"
            >
              {goal.parallel ? 'Sequential' : 'Parallel'}
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-9 h-9 rounded-lg hover:bg-accent-expense/10 hover:text-accent-expense transition-colors flex items-center justify-center"
            >
              <Trash2 size={13} />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-3 grid grid-cols-2 gap-2"
          >
            <button
              onClick={() => setConfirmingDelete(false)}
              className="py-2 rounded-lg bg-[var(--bg)] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onRemove}
              className="py-2 rounded-lg bg-accent-expense text-white text-xs font-medium"
            >
              Delete goal
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════
// NEW GOAL FORM
// ════════════════════════════════════════════════════════════════════
function NewGoalForm({ bucketKey, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [parallel, setParallel] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
    onSave({ bucketKey, name: name.trim(), target: t, currency, parallel });
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="overflow-hidden"
    >
      <div className="space-y-3 surface border rounded-xl p-4">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Goal name (e.g., PS4, MacBook)"
          autoFocus
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-[var(--border)]"
        />

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[var(--bg)]">
          {Object.values(CURRENCIES).map((c) => (
            <button
              key={c.code} type="button" onClick={() => setCurrency(c.code)}
              className={`py-1.5 rounded-md text-xs font-medium transition-all ${
                currency === c.code ? 'bg-[var(--surface)] shadow-sm' : 'text-muted'
              }`}
            >
              {c.code}
            </button>
          ))}
        </div>

        <div className="flex items-baseline gap-1 px-3 py-2.5 rounded-lg bg-[var(--bg)]">
          <span className="text-muted text-sm">{CURRENCIES[currency].prefix}</span>
          <input
            type="number" inputMode="decimal" step="0.01" min="0"
            value={target} onChange={(e) => setTarget(e.target.value)}
            placeholder="Target amount"
            className="flex-1 bg-transparent outline-none text-sm num"
          />
          {CURRENCIES[currency].suffix && (
            <span className="text-muted text-sm">{CURRENCIES[currency].suffix}</span>
          )}
        </div>

        <label className="flex items-center gap-2 text-[12px] text-muted cursor-pointer select-none">
          <input
            type="checkbox" checked={parallel} onChange={(e) => setParallel(e.target.checked)}
            className="rounded"
          />
          Fill in parallel with other parallel goals
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button" onClick={onCancel}
            className="py-2.5 rounded-lg bg-[var(--bg)] text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={!name.trim() || !target || parseFloat(target) <= 0}
            className="py-2.5 rounded-lg bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40"
          >
            Add goal
          </button>
        </div>
      </div>
    </motion.form>
  );
}

// ════════════════════════════════════════════════════════════════════
// CLAIM DIALOG
// ════════════════════════════════════════════════════════════════════
function ClaimDialog({ goal, baseCurrency, rates, onCancel, onConfirm }) {
  const [actual, setActual] = useState('');

  if (!goal) return null;

  const target = goal.target;
  const final = actual ? parseFloat(actual) : target;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm surface border rounded-2xl p-5"
        >
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">✦</div>
            <h3 className="font-display text-2xl">Claim {goal.name}</h3>
            <p className="text-[12px] text-muted mt-1">
              This creates an expense in this bucket and marks the goal as claimed.
            </p>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Target</span>
              <span className="num">{formatMoney(target, goal.currency)}</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5">Actual amount paid</div>
              <div className="flex items-baseline gap-1 px-3 py-2.5 rounded-lg bg-[var(--bg)]">
                <span className="text-muted text-sm">{CURRENCIES[goal.currency].prefix}</span>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0"
                  value={actual} onChange={(e) => setActual(e.target.value)}
                  placeholder={String(target)}
                  className="flex-1 bg-transparent outline-none num"
                />
                {CURRENCIES[goal.currency].suffix && (
                  <span className="text-muted text-sm">{CURRENCIES[goal.currency].suffix}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onCancel}
              className="py-3 rounded-xl bg-[var(--bg)] text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(final)}
              className="py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium active:scale-[0.99]"
            >
              ✦ Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
