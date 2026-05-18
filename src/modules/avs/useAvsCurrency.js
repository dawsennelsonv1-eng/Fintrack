// src/modules/avs/useAvsCurrency.js
// Ship 2 — Shared currency hook for AVS modules
//
// All AVS data is stored in its source currency (mostly HTG for cards,
// USD for some ad spend). When the user changes the base currency at
// the top of the screen, every AVS display should follow.
//
// This hook returns:
//   • base — current base currency code
//   • rates — current rate table
//   • toBase(amount, fromCurrency) — convert any amount to base
//   • fmt(amount, fromCurrency, opts) — convert + format with currency symbol
//   • fmtCompact(amount, fromCurrency) — compact format (1.2k / 3.4M)
//
// Use these everywhere AVS displays money so the currency switcher works.
//
import { useStore, selectBaseCurrency, selectRates } from '../../store/useStore';
import { convert, formatMoney, formatCompact } from '../../lib/currency';

export function useAvsCurrency() {
  const base = useStore(selectBaseCurrency);
  const rates = useStore(selectRates);

  return {
    base,
    rates,
    toBase: (amount, fromCurrency = 'HTG') =>
      convert(Number(amount) || 0, fromCurrency, base, rates),
    fmt: (amount, fromCurrency = 'HTG', opts = {}) => {
      const converted = convert(Number(amount) || 0, fromCurrency, base, rates);
      return formatMoney(converted, base, opts);
    },
    fmtCompact: (amount, fromCurrency = 'HTG') => {
      const converted = convert(Number(amount) || 0, fromCurrency, base, rates);
      return formatCompact(converted, base);
    },
  };
}
