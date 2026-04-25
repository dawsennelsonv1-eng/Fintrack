// src/lib/currency.js
// Multi-currency engine for USD / HTG / HTD ($ht — Haitian Dollar)
// Default rates (user-editable in store):
//   1 USD = 150 HTG
//   1 HTD = 5 HTG  →  1 USD = 30 HTD
//
// Strategy: every transaction stores `amount` and `currency` (original).
// All aggregations convert via `toBase()` using current rates.

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$',   label: 'US Dollar',       decimals: 2 },
  HTG: { code: 'HTG', symbol: 'G',   label: 'Haitian Gourde',  decimals: 0 },
  HTD: { code: 'HTD', symbol: '$ht', label: 'Haitian Dollar',  decimals: 0 },
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
  // Symbol position: USD/HTD prefix, HTG suffix
  if (currency === 'HTG') return `${sign}${abs} ${cfg.symbol}`;
  return `${sign}${cfg.symbol}${abs}`;
}

// Compact form for hero displays: $1.2K, $3.4M
export function formatCompact(amount, currency = 'USD') {
  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  const abs = Math.abs(amount);
  let value, suffix;
  if (abs >= 1_000_000) { value = amount / 1_000_000; suffix = 'M'; }
  else if (abs >= 10_000) { value = amount / 1_000; suffix = 'K'; }
  else { return formatMoney(amount, currency); }
  const sign = amount < 0 ? '−' : '';
  const num = Math.abs(value).toFixed(value < 10 ? 1 : 0);
  return currency === 'HTG'
    ? `${sign}${num}${suffix} ${cfg.symbol}`
    : `${sign}${cfg.symbol}${num}${suffix}`;
}
