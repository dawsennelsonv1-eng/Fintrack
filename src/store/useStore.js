// ═══════════════════════════════════════════════════════════════════════════
// FINTRACK ROUND B — STEP 3a
// File: src/store/useStore.js
// Apply 6 changes below. Each is marked "FIND / REPLACE WITH" or "ADD".
// Order matters: do them top to bottom, save once at the end, commit, push.
// ═══════════════════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────────────────
// CHANGE 1 — REPLACE  recordRepayment
// ───────────────────────────────────────────────────────────────────────────
// FIND the existing recordRepayment block (starts: "recordRepayment: (debtId, amount) => {")
// inside personalSlice. REPLACE the entire function with this version.
// What changed: now also creates a transaction in history. Direction-aware:
// if debt.direction === 'receivable' (someone repaying you), the tx is income.
// Otherwise (you repaying), it's an expense. Either way buckets={} (no auto-route)
// — repayments are an audit-trail concern, not a bucket-allocation concern.

  recordRepayment: (debtId, amount) => {
    const debt = get().personal.debts.find((d) => d.id === debtId);
    if (!debt) return null;

    const currentRepaid = computeDebtRepaid(get().personal.debtEvents, debtId);
    const cappedAmount  = Math.min(Number(amount), debt.principal - currentRepaid);
    if (cappedAmount <= 0) return null;

    const newRepaid    = currentRepaid + cappedAmount;
    const balanceAfter = debt.principal - newRepaid;
    const baseCurrency = get().app.baseCurrency;
    const rates        = get().app.rates;
    const balanceAfterBase = convert(balanceAfter, debt.currency, baseCurrency, rates);

    // 1. Debt event (existing behavior, unchanged)
    const event = {
      id: uid('devt'), debtId, type: 'repayment',
      amount: cappedAmount, currency: debt.currency,
      balanceAfter, balanceAfterBase, baseCurrency,
      notes: '', date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debtEvents: [...s.personal.debtEvents, event] } }));
    enqueue(set, get, 'debtEvent', 'create', event);

    // 2. NEW — transaction in history
    const direction = debt.direction || 'owe';
    const isReceiving = direction === 'receivable';
    const tx = {
      id: uid('tx'),
      date: nowISO(),
      amount: cappedAmount,
      currency: debt.currency,
      category: 'Debt repayment',
      type: isReceiving ? 'income' : 'expense',
      notes: isReceiving
        ? `💰 Repayment received from ${debt.creditor}`
        : `💸 Repayment to ${debt.creditor}`,
      tags: '',
      buckets: {}, // intentionally empty — pure audit trail
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));

    // 3. Mark debt paid (existing behavior, unchanged)
    if (balanceAfter <= 0 && debt.status !== 'paid') {
      const updated = { ...debt, status: 'paid', updatedAt: nowISO() };
      set((s) => ({
        personal: {
          ...s.personal,
          debts: s.personal.debts.map((d) => (d.id === debtId ? updated : d)),
        },
      }));
      enqueue(set, get, 'debt', 'update', updated);
    }
    return event;
  },


// ───────────────────────────────────────────────────────────────────────────
// CHANGE 2 — REPLACE  addInvestment
// ───────────────────────────────────────────────────────────────────────────
// FIND "addInvestment: ({ kind, name, units, costBasis, currentPrice, currency = 'USD' }) => {"
// REPLACE the entire function. What changed: also creates a transaction
// deducting (units × costBasis) from the warChest bucket. The investment
// itself is the asset; the transaction is the cash that left War Chest.

  addInvestment: ({ kind, name, units, costBasis, currentPrice, currency = 'USD' }) => {
    const inv = {
      id: uid('inv'), kind, name,
      units: Number(units), costBasis: Number(costBasis),
      currentPrice: Number(currentPrice ?? costBasis),
      currency, createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, investments: [...s.personal.investments, inv] } }));
    enqueue(set, get, 'investment', 'create', inv);

    // NEW — transaction deducting total cost from War Chest
    const totalCost = Number(units) * Number(costBasis);
    if (totalCost > 0) {
      const tx = {
        id: uid('tx'),
        date: nowISO(),
        amount: totalCost,
        currency,
        category: 'Investment',
        type: 'expense',
        notes: `📈 ${name}`,
        tags: '',
        buckets: { warChest: -Math.abs(totalCost) },
        createdAt: nowISO(),
        updatedAt: nowISO(),
        _pending: true,
      };
      set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
      enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    }

    return inv;
  },


// ───────────────────────────────────────────────────────────────────────────
// CHANGE 3 — REPLACE  deployToVenture
// ───────────────────────────────────────────────────────────────────────────
// FIND "deployToVenture: (ventureId, { amount, currency = 'USD', note = '' }) => {"
// REPLACE the entire function. What changed: also creates a transaction
// deducting from War Chest. Notes carry the venture name for searchability.

  deployToVenture: (ventureId, { amount, currency = 'USD', note = '' }) => {
    const venture = get().personal.ventures.find((v) => v.id === ventureId);

    const event = {
      id: uid('vevt'), ventureId, type: 'deploy',
      amount: Number(amount), currency, note,
      date: nowISO(), createdAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, ventureEvents: [...s.personal.ventureEvents, event] } }));
    enqueue(set, get, 'ventureEvent', 'create', event);

    // NEW — transaction deducting from War Chest
    const v = Number(amount);
    if (v > 0) {
      const tx = {
        id: uid('tx'),
        date: nowISO(),
        amount: v,
        currency,
        category: 'Venture',
        type: 'expense',
        notes: `🚀 ${venture ? venture.name : 'Venture'}${note ? ' — ' + note : ''}`,
        tags: '',
        buckets: { warChest: -Math.abs(v) },
        createdAt: nowISO(),
        updatedAt: nowISO(),
        _pending: true,
      };
      set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
      enqueue(set, get, 'transaction', 'create', stripMeta(tx));
    }

    return event;
  },


// ───────────────────────────────────────────────────────────────────────────
// CHANGE 4 — REPLACE  addDebt   (adds direction support)
// ───────────────────────────────────────────────────────────────────────────
// FIND "addDebt: ({ creditor, principal, currency = 'USD', dueDate, notes = '' }) => {"
// REPLACE with this version. What changed: accepts optional `direction`
// param, defaults to 'owe' (the existing behavior — backward compatible).

  addDebt: ({ creditor, principal, currency = 'USD', dueDate, notes = '', direction = 'owe' }) => {
    const d = {
      id: uid('debt'), creditor, principal: Number(principal), currency,
      dueDate: dueDate || '', notes,
      direction,                  // NEW: 'owe' or 'receivable'
      status: 'active',
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, d] } }));
    enqueue(set, get, 'debt', 'create', d);
    return d;
  },


// ───────────────────────────────────────────────────────────────────────────
// CHANGE 5 — ADD  borrowMoney  +  lendMoney
// ───────────────────────────────────────────────────────────────────────────
// ADD these TWO new actions inside personalSlice, immediately after removeDebt.
// borrowMoney   — creates a debt (direction='owe') + a transaction in Holding bucket
// lendMoney     — creates a debt (direction='receivable') + a transaction debiting source bucket
//
// Holding bucket: borrowed money is capital, not income. It must NOT auto-split.
// The Holding key is just 'holding' — it'll appear in computeBucketBalances
// once any transaction references it. No bucket entity needed.

  borrowMoney: ({ from, amount, currency = 'USD', dueDate = '', notes = '' }) => {
    const v = Number(amount);
    if (!v || v <= 0) return null;

    // 1. Debt with direction='owe'
    const debt = {
      id: uid('debt'),
      creditor: from,
      principal: v,
      currency,
      dueDate,
      notes,
      direction: 'owe',
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, debt] } }));
    enqueue(set, get, 'debt', 'create', debt);

    // 2. Transaction lands in Holding (no auto-split — capital, not income)
    const tx = {
      id: uid('tx'),
      date: nowISO(),
      amount: v,
      currency,
      category: 'Borrowed',
      type: 'income',
      notes: `📥 Borrowed from ${from}${notes ? ' — ' + notes : ''}`,
      tags: '',
      buckets: { holding: v },
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));

    return { debt, tx };
  },

  lendMoney: ({ to, amount, currency = 'USD', sourceBucketKey = 'warChest', dueDate = '', notes = '' }) => {
    const v = Number(amount);
    if (!v || v <= 0) return null;

    // 1. Debt with direction='receivable' (they owe you)
    const debt = {
      id: uid('debt'),
      creditor: to, // the counterparty's name — same field for both directions
      principal: v,
      currency,
      dueDate,
      notes,
      direction: 'receivable',
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    set((s) => ({ personal: { ...s.personal, debts: [...s.personal.debts, debt] } }));
    enqueue(set, get, 'debt', 'create', debt);

    // 2. Transaction debits the chosen source bucket
    const tx = {
      id: uid('tx'),
      date: nowISO(),
      amount: v,
      currency,
      category: 'Lent',
      type: 'expense',
      notes: `📤 Lent to ${to}${notes ? ' — ' + notes : ''}`,
      tags: '',
      buckets: { [sourceBucketKey]: -Math.abs(v) },
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ personal: { ...s.personal, transactions: [tx, ...s.personal.transactions] } }));
    enqueue(set, get, 'transaction', 'create', stripMeta(tx));

    return { debt, tx };
  },


// ───────────────────────────────────────────────────────────────────────────
// CHANGE 6 — ADD  computeBucketImpact   (top-level export, NOT inside slice)
// ───────────────────────────────────────────────────────────────────────────
// ADD this near the bottom of the file, in the COMPUTATIONS section,
// right after computeGoalsForBucket. It's a pure function — no store access.
//
// QuickAdd will import it like:  import { computeBucketImpact } from '../store/useStore'
//
// Returns null when the warning is unnecessary (no goal in target bucket,
// or no goal actually impacted by this expense). When it returns a value,
// QuickAdd shows the warning overlay.

export function computeBucketImpact({
  transactions,
  goals,
  categories,
  base,
  rates,
  category,         // category name from the form
  amount,           // positive number
  currency,         // 'USD' | 'HTG' | 'HTD'
  bucketKey,        // optional override — if not set, derived from category
}) {
  // 1. Resolve which bucket this expense routes to
  const categoryMap = buildCategoryToBucket(categories);
  const resolvedKey = bucketKey || categoryMap[category] || 'operations';

  // 2. Active goals in that bucket (sorted by priority)
  const activeGoals = goals
    .filter((g) => g.bucketKey === resolvedKey && g.status === 'active')
    .sort((a, b) => a.priority - b.priority);

  if (activeGoals.length === 0) return null; // no goals → no warning needed

  // 3. Current bucket balance and post-expense balance, both in base currency
  const allBalances  = computeBucketBalances(transactions, base, rates);
  const balance      = allBalances[resolvedKey] || 0;
  const expenseBase  = convert(amount, currency, base, rates);
  const balanceAfter = balance - expenseBase;

  // 4. Average daily inflow into this bucket over last 30 days
  //    (used to estimate days-of-delay caused by this expense)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let inflow30 = 0;
  for (const tx of transactions) {
    if (new Date(tx.date) < thirtyDaysAgo) continue;
    const v = (tx.buckets || {})[resolvedKey];
    if (v && v > 0) {
      inflow30 += convert(v, tx.currency || 'USD', base, rates);
    }
  }
  const dailyInflow = inflow30 / 30;

  // 5. Helper — compute how each goal fills given an available balance
  const computeFills = (available) => {
    let remaining = Math.max(0, available);
    const sequential = activeGoals.filter((g) => !g.parallel);
    const parallel   = activeGoals.filter((g) =>  g.parallel);
    const out = {};

    for (const g of sequential) {
      const targetBase = convert(g.target, g.currency, base, rates);
      const filled     = Math.min(remaining, targetBase);
      remaining       -= filled;
      out[g.id] = { filled, targetBase };
    }

    const parallelTotalTarget = parallel.reduce(
      (s, g) => s + convert(g.target, g.currency, base, rates), 0
    );
    for (const g of parallel) {
      const targetBase = convert(g.target, g.currency, base, rates);
      const share      = parallelTotalTarget > 0 ? targetBase / parallelTotalTarget : 0;
      const filled     = Math.min(targetBase, remaining * share);
      out[g.id] = { filled, targetBase };
    }
    return out;
  };

  const fillsBefore = computeFills(balance);
  const fillsAfter  = computeFills(balanceAfter);

  // 6. Per-goal impact summary
  const affectedGoals = activeGoals.map((g) => {
    const before = fillsBefore[g.id] || { filled: 0, targetBase: 0 };
    const after  = fillsAfter[g.id]  || { filled: 0, targetBase: 0 };
    const deficit  = Math.max(0, after.targetBase - after.filled);
    const fillDrop = before.filled - after.filled;

    // Days of delay = how long to recover the drop at current daily inflow rate.
    // No inflow + a real drop → flag with a sentinel large number; UI handles it.
    let delayDays = 0;
    if (fillDrop > 0) {
      delayDays = dailyInflow > 0
        ? Math.round(fillDrop / dailyInflow)
        : 999; // sentinel: "indefinite"
    }

    return {
      id:           g.id,
      name:         g.name,
      target:       g.target,
      currency:     g.currency,
      filledBefore: before.filled,
      filledAfter:  after.filled,
      targetBase:   after.targetBase,
      deficit,
      delayDays,
      wasReady:     before.filled >= before.targetBase && before.targetBase > 0,
      stillReady:   after.filled  >= after.targetBase  && after.targetBase  > 0,
    };
  });

  // 7. Filter to only goals actually impacted by this expense
  const impacted = affectedGoals.filter(
    (g) => g.filledBefore !== g.filledAfter || g.deficit > 0
  );

  if (impacted.length === 0) return null;

  return {
    bucketKey:     resolvedKey,
    balance,
    balanceAfter,
    expenseBase,
    dailyInflow,
    affectedGoals: impacted,
  };
}
