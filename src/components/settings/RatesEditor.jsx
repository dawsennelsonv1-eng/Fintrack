// src/components/settings/RatesEditor.jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Check } from 'lucide-react';
import { useStore, selectRates } from '../../store/useStore';
import { CURRENCIES, DEFAULT_RATES } from '../../lib/currency';

export default function RatesEditor() {
  const rates = useStore(selectRates);
  const setRate = useStore((s) => s.setRate);

  const [draft, setDraft] = useState(() => ({
    USD: String(rates.USD),
    HTG: String(rates.HTG),
    HTD: String(rates.HTD),
  }));
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = Object.keys(draft).some(
    (k) => parseFloat(draft[k]) !== rates[k]
  );

  const save = () => {
    Object.keys(draft).forEach((k) => {
      const n = parseFloat(draft[k]);
      if (!isNaN(n) && n > 0) setRate(k, n);
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  const reset = () => {
    setDraft({
      USD: String(DEFAULT_RATES.USD),
      HTG: String(DEFAULT_RATES.HTG),
      HTD: String(DEFAULT_RATES.HTD),
    });
  };

  const previewUSDtoHTG = (() => {
    const usd = parseFloat(draft.USD), htg = parseFloat(draft.HTG);
    if (!usd || !htg) return null;
    return (usd / htg).toFixed(2);
  })();

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted leading-relaxed">
        Rates are stored in HTG-equivalents. <span className="text-[var(--text)]/80">1 HTG = 1 HTG.</span> Higher numbers mean stronger purchasing power per unit.
      </p>

      <div className="space-y-3">
        {Object.values(CURRENCIES).map((c) => (
          <div key={c.code} className="surface border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-xl">{c.code}</span>
                <span className="text-[11px] text-muted">{c.label || c.name || c.code}</span>
              </div>
              <span className="text-[10px] text-muted">in HTG</span>
            </div>
            <div className="flex items-baseline gap-1 px-3 py-2.5 rounded-lg bg-[var(--bg)]">
              <span className="text-muted text-sm shrink-0">1 {c.code} =</span>
              <input
                type="number" inputMode="decimal" step="0.01" min="0"
                value={draft[c.code]}
                onChange={(e) => setDraft((d) => ({ ...d, [c.code]: e.target.value }))}
                className="flex-1 min-w-0 bg-transparent outline-none num text-right"
              />
              <span className="text-muted text-sm shrink-0">HTG</span>
            </div>
          </div>
        ))}
      </div>

      {previewUSDtoHTG && (
        <div className="text-center text-[11px] text-muted">
          <span className="num">$1 USD ≈ {previewUSDtoHTG} HTG</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={reset}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--bg)] hover:bg-[var(--border)] transition-colors text-sm font-medium"
        >
          <RotateCcw size={14} />
          Reset to defaults
        </button>
        <motion.button
          onClick={save}
          disabled={!dirty}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 text-sm font-medium disabled:opacity-40"
        >
          {savedFlash ? <><Check size={14} /> Saved</> : 'Save rates'}
        </motion.button>
      </div>
    </div>
  );
}
