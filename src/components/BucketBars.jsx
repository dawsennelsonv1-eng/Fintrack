// src/components/BucketBars.jsx
//
// Round E: Home section showing each bucket's current balance and
// progress against its recommended monthly outflow.
//
// Recommended outflow = (% of monthly income × monthly income).
// "Used this month" = bucket's monthly outflow.
// The bar visualizes used / recommended.
//
// Color tone:
//   green   — under 75% of recommended
//   amber   — 75% to 100%
//   red     — over 100% (overspent)
//
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import {
  useStore,
  selectTransactions, selectBuckets, selectBaseCurrency, selectRates,
  computeBucketBalances, computeBucketMTD, computeMonthSummary,
} from '../store/useStore';
import { formatMoney, formatCompact } from '../lib/currency';
import { fadeUp, ease } from '../lib/util';

export default function BucketBars() {
  const transactions = useStore(selectTransactions);
  const buckets      = useStore(selectBuckets);
  const baseCurrency = useStore(selectBaseCurrency);
  const rates        = useStore(selectRates);

  const balances = useMemo(() => computeBucketBalances(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const mtd      = useMemo(() => computeBucketMTD(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);
  const monthly  = useMemo(() => computeMonthSummary(transactions, baseCurrency, rates), [transactions, baseCurrency, rates]);

  const sorted = useMemo(() => {
    if (!Array.isArray(buckets)) return [];
    return [...buckets]
      .filter((b) => b && b.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [buckets]);

  if (sorted.length === 0) return null;

  return (
    <div className="surface border rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">Buckets</div>
          <div className="font-display text-2xl mt-0.5">Money in each pocket</div>
        </div>
        <span className="text-[11px] text-muted">This month</span>
      </div>

      <ul className="space-y-3.5">
        {sorted.map((bucket, idx) => {
          const balance = balances[bucket.key] || 0;
          const bucketMtd = mtd[bucket.key] || { inflow: 0, outflow: 0 };
          const used = bucketMtd.outflow;
          // Recommended monthly outflow = bucket's % of this month's income
          const recommended = monthly.income > 0
            ? monthly.income * (bucket.percentage / 100)
            : 0;
          const usedRatio = recommended > 0 ? used / recommended : 0;
          const fillPct = Math.min(100, usedRatio * 100);

          const tone =
            recommended === 0 ? 'neutral' :
            usedRatio < 0.75  ? 'safe'    :
            usedRatio < 1.0   ? 'warn'    :
            'over';

          const fillColor = {
            safe:    bucket.color,
            warn:    '#d4a942',
            over:    '#c2452f',
            neutral: bucket.color,
          }[tone];

          const balanceColorClass =
            balance < 0       ? 'text-accent-expense' :
            balance === 0     ? 'text-muted'          :
            '';

          return (
            <motion.li
              key={bucket.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.4, ease }}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: bucket.color }}
                />
                <span className="text-[12px] font-medium flex-1 truncate">{bucket.name}</span>
                {tone === 'over' && (
                  <AlertTriangle size={11} className="text-accent-expense shrink-0" />
                )}
                <span className={`text-[11px] num font-medium ${balanceColorClass}`}>
                  {formatMoney(balance, baseCurrency)}
                </span>
              </div>

              <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden mb-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ duration: 0.7, delay: idx * 0.06 + 0.1, ease }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: fillColor }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted num">
                <span>
                  Spent {formatCompact(used, baseCurrency)}
                  {recommended > 0 && (
                    <> · {Math.round(fillPct)}% of recommended</>
                  )}
                </span>
                <span>
                  {recommended > 0
                    ? `cap ${formatCompact(recommended, baseCurrency)}`
                    : `${bucket.percentage}% allocation`}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
