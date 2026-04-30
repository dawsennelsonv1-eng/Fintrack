// src/lib/currency.js
// Multi-currency engine for USD / HTG / HTD
//
// Display formats:
//   USD: $1000          (prefix only)
//   HTG: HTG1000        (prefix only, "HTG" code itself as the symbol)
//   HTD: $1000 ht       (hybrid: "$" prefix + " ht" suffix)
//
// Default rates (user-editable in store):
//   1 USD = 150 HTG
//   1 HTD = 5 HTG  →  1 USD = 30 HTD

// `symbol` is the short label shown in pickers/chips.
// `prefix` + `suffix` are used when formatting amounts.
// USD uses $ as both. HTG uses "HTG" (no separate symbol). HTD uses "$ ht" as the symbol.
export const CURRENCIES = {
  USD: {
    code: 'USD',
    label: 'US Dollar',
    decimals: 2,
    prefix: '$',
    suffix: '',
    symbol: '$',
  },
  HTG: {
    code: 'HTG',
    label: 'Haitian Gourde',
    decimals: 0,
    prefix: '',
    suffix: ' HTG',
    symbol: 'HTG',
  },
  HTD: {
    code: 'HTD',
    label: 'Haitian Dollar',
    decimals: 0,
    prefix: '$',
    suffix: ' ht',
    symbol: '$ ht',
  },
};

export const DEFAULT_RATES = {
  // Rates expressed as: 1 unit of currency → X HTG (HTG is the pivot)
  USD: 150,
  HTD: 5,
  HTG: 1,
};

export function toHTG(amount, currency, rates = DEFAULT_RATES) {
  const r = rates[currency];
  if (r === undefined) throw new Error(`Unknown currency: ${currency}`);
  return Number(amount) * r;
}

export function fromHTG(htgAmount, targetCurrency, rates = DEFAULT_RATES) {
  const r = rates[targetCurrency];
  if (r === undefined) throw new Error(`Unknown currency: ${targetCurrency}`);
  return htgAmount / r;
}

export function convert(amount, from, to, rates = DEFAULT_RATES) {
  if (from === to) return Number(amount);
  return fromHTG(toHTG(amount, from, rates), to, rates);
}

export function formatMoney(amount, currency = 'USD', opts = {}) {
  const cfg = CURRENCIES[currency];
  if (!cfg) return String(amount);
  const decimals = opts.decimals ?? cfg.decimals;
  const sign = opts.sign === 'always' && amount > 0 ? '+' : amount < 0 ? '−' : '';
  const abs = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${cfg.prefix}${abs}${cfg.suffix}`;
}

// Compact form for hero displays
export function formatCompact(amount, currency = 'USD') {
  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  const abs = Math.abs(amount);
  let value, k;
  if (abs >= 1_000_000) { value = amount / 1_000_000; k = 'M'; }
  else if (abs >= 10_000) { value = amount / 1_000; k = 'K'; }
  else { return formatMoney(amount, currency); }
  const sign = amount < 0 ? '−' : '';
  const num = Math.abs(value).toFixed(value < 10 ? 1 : 0);
  return `${sign}${cfg.prefix}${num}${k}${cfg.suffix}`;
}
