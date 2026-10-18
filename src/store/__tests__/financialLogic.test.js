// src/store/__tests__/financialLogic.test.js
// Authoritative financial-logic tests. All amounts in USD so convert() is
// identity; rates are irrelevant but passed for realism.
import { describe, it, expect } from 'vitest';
import {
  selectNetWorth,
  selectTotalAssets,
  selectTotalLiabilities,
  computeTotalAssets,
  computeTotalLiabilities,
  computeBorrowedPool,
  computeNetCash,
  computeBucketBalances,
  computeMonthSummary,
  computeMonthCashFlow,
  computeRecurringRevenueMonthly,
} from '../useStore';

const RATES = { USD: 150, HTD: 5, HTG: 1 };

function makeState(personal = {}) {
  return {
    app: { baseCurrency: 'USD', rates: RATES },
    personal: {
      transactions: [],
      investments: [],
      ventures: [],
      debts: [],
      debtEvents: [],
      borrowedDeployments: [],
      recurring: [],
      ...personal,
    },
  };
}

describe('Net Worth = Total Assets − Total Liabilities', () => {
  it('always equals assets minus liabilities', () => {
    const states = [
      makeState(),
      makeState({
        transactions: [{ type: 'income', amount: 1000, currency: 'USD', buckets: { warChest: 1000 }, category: 'Salary' }],
        debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],
      }),
      makeState({
        investments: [{ id: 'i1', units: 10, currentPrice: 50, currency: 'USD' }],
        debts: [{ id: 'd1', direction: 'owe', principal: 300, currency: 'USD', status: 'active' }],
      }),
    ];
    for (const s of states) {
      expect(selectNetWorth(s)).toBeCloseTo(selectTotalAssets(s) - selectTotalLiabilities(s), 6);
    }
  });
});

describe('Borrowed money', () => {
  it('retained borrowed cash increases assets and liabilities equally (net worth unchanged)', () => {
    const s = makeState({
      debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],
    });
    const assets = computeTotalAssets(s.personal, 'USD', RATES);
    const liabilities = computeTotalLiabilities(s.personal.debts, s.personal.debtEvents, 'USD', RATES);
    expect(assets).toBeCloseTo(1000, 6);
    expect(liabilities).toBeCloseTo(1000, 6);
    expect(selectNetWorth(s)).toBeCloseTo(0, 6);
  });

  it('spent borrowed money leaves the liability outstanding and drops net worth', () => {
    const s = makeState({
      debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],
      borrowedDeployments: [
        { sourceDebtId: 'd1', destinationType: 'spent', amount: 1000, currency: 'USD' },
      ],
    });
    // Pool is fully deployed → no cash asset; debt remains.
    expect(computeBorrowedPool(s.personal.debts, s.personal.debtEvents, s.personal.borrowedDeployments, 'USD', RATES)).toBeCloseTo(0, 6);
    expect(computeTotalLiabilities(s.personal.debts, s.personal.debtEvents, 'USD', RATES)).toBeCloseTo(1000, 6);
    expect(selectNetWorth(s)).toBeCloseTo(-1000, 6);
  });

  it('borrowing to buy an asset records both the asset and the debt', () => {
    const s = makeState({
      debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],
      borrowedDeployments: [
        { sourceDebtId: 'd1', destinationType: 'investment', destinationId: 'i1', amount: 1000, currency: 'USD' },
      ],
      investments: [{ id: 'i1', units: 10, currentPrice: 100, currency: 'USD' }],
    });
    // Pool 0 (deployed), investment 1000, debt 1000 → net worth 0.
    expect(computeTotalAssets(s.personal, 'USD', RATES)).toBeCloseTo(1000, 6);
    expect(computeTotalLiabilities(s.personal.debts, s.personal.debtEvents, 'USD', RATES)).toBeCloseTo(1000, 6);
    expect(selectNetWorth(s)).toBeCloseTo(0, 6);
  });
});

describe('Buckets and transfers', () => {
  it('bucket allocations do not inflate net worth (re-allocating is neutral)', () => {
    const before = makeState({
      transactions: [{ type: 'income', amount: 1000, currency: 'USD', buckets: { warChest: 1000 }, category: 'Salary' }],
    });
    const after = makeState({
      transactions: [
        { type: 'income', amount: 1000, currency: 'USD', buckets: { warChest: 1000 }, category: 'Salary' },
        { type: 'transfer', amount: 500, currency: 'USD', buckets: { warChest: -500, operations: 500 } },
      ],
    });
    expect(selectNetWorth(before)).toBeCloseTo(selectNetWorth(after), 6);
    expect(computeNetCash(after.personal.transactions, 'USD', RATES)).toBeCloseTo(1000, 6);
  });

  it('internal transfers do not create income or wealth', () => {
    const s = makeState({
      transactions: [
        { type: 'income', amount: 1000, currency: 'USD', buckets: { warChest: 1000 }, category: 'Salary' },
        { type: 'transfer', amount: 500, currency: 'USD', buckets: { warChest: -500, operations: 500 } },
      ],
    });
    const summary = computeMonthSummary(s.personal.transactions, 'USD', RATES);
    expect(summary.income).toBeCloseTo(1000, 6); // only the salary, not the transfer
    expect(summary.expense).toBeCloseTo(0, 6);
    expect(selectNetWorth(s)).toBeCloseTo(1000, 6);
  });
});

describe('Debt repayment', () => {
  it('principal repayment reduces both cash and outstanding debt', () => {
    const s = makeState({
      transactions: [
        { type: 'expense', amount: 400, currency: 'USD', buckets: { operations: -400 }, category: 'Repayment', interestAmount: 0 },
      ],
      debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],
      debtEvents: [{ id: 'e1', debtId: 'd1', type: 'repayment', amount: 400, currency: 'USD' }],
    });
    expect(computeNetCash(s.personal.transactions, 'USD', RATES)).toBeCloseTo(-400, 6);
    expect(computeTotalLiabilities(s.personal.debts, s.personal.debtEvents, 'USD', RATES)).toBeCloseTo(600, 6);
    // Borrowed 1000 (pool +1000, debt +1000), repaid 400 from cash (cash −400, debt −400) → net worth 0.
    expect(selectNetWorth(s)).toBeCloseTo(0, 6);
  });

  it('interest is recorded separately and does not reduce principal', () => {
    const s = makeState({
      transactions: [
        { type: 'expense', amount: 450, currency: 'USD', buckets: { operations: -450 }, category: 'Repayment', interestAmount: 50 },
      ],
      debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],
      debtEvents: [{ id: 'e1', debtId: 'd1', type: 'repayment', amount: 400, currency: 'USD' }],
    });
    // Principal reduced by 400 (not 450); interest is a separate expense.
    expect(computeTotalLiabilities(s.personal.debts, s.personal.debtEvents, 'USD', RATES)).toBeCloseTo(600, 6);
    const summary = computeMonthSummary(s.personal.transactions, 'USD', RATES);
    expect(summary.expense).toBeCloseTo(50, 6); // only the interest counts as expense
  });
});

describe('Recurring revenue', () => {
  it('is a separate metric and never added to net worth', () => {
    const s = makeState({
      recurring: [{ type: 'income', amount: 500, currency: 'USD', frequency: 'monthly', interval: 1 }],
    });
    expect(computeRecurringRevenueMonthly(s.personal.recurring, 'USD', RATES)).toBeCloseTo(500, 6);
    expect(selectNetWorth(s)).toBeCloseTo(0, 6);
  });
});

describe('Historical accuracy', () => {
  it('backdated transactions are included in balances (edits recalculate)', () => {
    const past = new Date('2020-01-15T12:00:00Z').toISOString();
    const s = makeState({
      transactions: [{ type: 'income', amount: 250, currency: 'USD', buckets: { warChest: 250 }, category: 'Salary', date: past }],
    });
    expect(computeNetCash(s.personal.transactions, 'USD', RATES)).toBeCloseTo(250, 6);
    expect(computeBucketBalances(s.personal.transactions, 'USD', RATES).warChest).toBeCloseTo(250, 6);
  });

  it('borrowed money is not counted as earned income', () => {
    const s = makeState({
      transactions: [
        { type: 'income', amount: 1000, currency: 'USD', buckets: {}, category: 'Borrowed' },
        { type: 'income', amount: 2000, currency: 'USD', buckets: { warChest: 2000 }, category: 'Salary' },
      ],
    });
    const summary = computeMonthSummary(s.personal.transactions, 'USD', RATES);
    expect(summary.income).toBeCloseTo(2000, 6); // borrowed excluded
    const cashFlow = computeMonthCashFlow(s.personal.transactions, 'USD', RATES);
    expect(cashFlow.cashIn).toBeCloseTo(3000, 6); // but it IS cash movement
  });
});