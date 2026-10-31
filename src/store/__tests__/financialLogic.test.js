// src/store/__tests__/financialLogic.test.js

import { describe, it, expect } from 'vitest';
import {
  selectNetWorth,
  selectTotalAssets,
  selectTotalLiabilities,
selectIsDangerMode,
selectActiveBuckets,
  computeTotalAssets,
  computeTotalLiabilities,
  computeBorrowedPool,
computeBorrowedSummary,
  computeNetCash,
  computeBucketBalances,
  computeMonthSummary,
  computeMonthCashFlow,
  computeRecurringRevenueMonthly,
computeBucketBudgetSummary,
computeWalletsWithReconciliation,
computePeriodLedger,
detectCurrencyAnomalies,
computeDebtPayoffPlan,
reconcileHistoricalSheetData,
autoSplitIncome,
DANGER_MODE_BUCKETS,
NORMAL_MODE_BUCKETS,
DEFAULT_WALLETS,
} from '../useStore';

const RATES = { USD: 150, HTD: 5, HTG: 1 };

function makeState(personal = {}, app = {}) {
  return {
app: { baseCurrency: 'USD', rates: RATES, dangerModeOverride: 'auto', privacyMask: true, ...app },
    personal: {
      transactions: [],
      investments: [],
      ventures: [],
      debts: [],
      debtEvents: [],
      borrowedDeployments: [],
      recurring: [],
buckets: [],
goals: [],
budgetItems: [],
wallets: DEFAULT_WALLETS,
conversions: [],
      ...personal,
    },
  };
}

describe('Danger Mode (In-Debt 5-Bucket Protocol: 40/25/20/10/5)', () => {
it('automatically activates Danger Mode when owed debt > 0 with 40/25/20/10/5 split', () => {
const inDebtState = makeState({
debts: [{ id: 'd1', direction: 'owe', principal: 500, currency: 'USD', status: 'active' }],
});
expect(selectIsDangerMode(inDebtState)).toBe(true);
const active = selectActiveBuckets(inDebtState);
expect(active.map((b) => [b.key, b.percentage])).toEqual([
['debtRepayment', 40],
['warChest', 25],
['operations', 20],
['reserve', 10],
['baller', 5],
]);
const split = autoSplitIncome(1000, active);
expect(split).toEqual({
debtRepayment: 400,
warChest: 250,
operations: 200,
reserve: 100,
baller: 50,
});
});
it('switches to Normal Mode (50/30/10/5/5) when debt is 0', () => {
const debtFreeState = makeState({ debts: [] });
expect(selectIsDangerMode(debtFreeState)).toBe(false);
const active = selectActiveBuckets(debtFreeState);
expect(active.map((b) => [b.key, b.percentage])).toEqual([
['warChest', 50],
['operations', 30],
['reserve', 10],
['giving', 5],
['baller', 5],
]);
});
});
describe('Daily Calendar Ledger, Wallets Reconciliation & Conversions with Fees', () => {
it('computes Daily Income, Spendings (including Debt Repayments & Conversion Fees), and Wallet Discrepancy', () => {
const txs = [
{ id: 't1', date: '2026-10-30T10:00:00.000Z', amount: 1500, currency: 'HTG', category: 'Salary', type: 'income', walletId: 'w_moncash', buckets: { operations: 1500 } },
{ id: 't2', date: '2026-10-30T12:00:00.000Z', amount: 300, currency: 'HTG', category: 'Repayment', type: 'expense', walletId: 'w_moncash', buckets: { debtRepayment: -300 } },
{ id: 't3', date: '2026-10-30T13:00:00.000Z', amount: 100, currency: 'HTG', category: 'Conversion Fee', type: 'expense', walletId: 'w_moncash', buckets: { operations: -100 } },
];
const conversions = [
{ id: 'c1', date: '2026-10-30T13:00:00.000Z', fromWalletId: 'w_wise', fromAmount: 10, fromCurrency: 'USD', toWalletId: 'w_moncash', toAmount: 1500, toCurrency: 'HTG', feeAmount: 100, feeCurrency: 'HTG' },
];
const customWallets = DEFAULT_WALLETS.map((w) =>
w.id === 'w_moncash'
? { ...w, balance: 900, manualUpdatedAt: '2026-10-30T14:00:00.000Z' }
: { ...w, balance: 0, manualUpdatedAt: '2026-10-30T14:00:00.000Z' }
);
const ledger = computePeriodLedger(txs, conversions, customWallets, 'HTG', RATES, '2026-10-30', '2026-10-30');
expect(ledger.totalIncomeBase).toBeCloseTo(1500, 2);
expect(ledger.totalSpendingBase).toBeCloseTo(400, 2); // 300 debt repayment + 100 fee
expect(ledger.netForPeriodBase).toBeCloseTo(1100, 2);
expect(ledger.walletRecon.totalWalletsBase).toBeCloseTo(900, 2);
expect(ledger.walletRecon.missingAmountBase).toBeCloseTo(200, 2);
});
});
describe('Borrowed Capital Pool & Net Worth', () => {
it('accurately tracks partial spending of borrowed capital and updates pool', () => {
const debts = [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }];
const deps = [{ sourceDebtId: 'd1', destinationType: 'spent', amount: 350, currency: 'USD' }];
const bSum = computeBorrowedSummary(debts, [], deps, 'USD', RATES);
expect(bSum.totalPrincipalBase).toBeCloseTo(1000, 2);
expect(bSum.totalDeployedOrSpentBase).toBeCloseTo(350, 2);
expect(bSum.undeployedPoolBase).toBeCloseTo(650, 2);
});
it('Net Worth always equals Total Assets minus Total Liabilities', () => {
    const states = [
      makeState(),
      makeState({
        transactions: [{ type: 'income', amount: 1000, currency: 'USD', buckets: { warChest: 1000 }, category: 'Salary' }],
        debts: [{ id: 'd1', direction: 'owe', principal: 1000, currency: 'USD', status: 'active' }],

      }),
    ];
    for (const s of states) {
      expect(selectNetWorth(s)).toBeCloseTo(selectTotalAssets(s) - selectTotalLiabilities(s), 6);
    }
  });
});

