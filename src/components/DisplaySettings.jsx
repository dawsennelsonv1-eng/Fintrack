// src/components/settings/DisplaySettings.jsx
import { Sun, Moon, Monitor, Coins } from 'lucide-react';
import {
  useStore, selectTheme, selectBaseCurrency,
} from '../../store/useStore';
import { CURRENCIES } from '../../lib/currency';

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark',  label: 'Dark',  icon: Moon },
];

export default function DisplaySettings() {
  const theme = useStore(selectTheme);
  const setTheme = useStore((s) => s.setTheme);
  const baseCurrency = useStore(selectBaseCurrency);
  const setBaseCurrency = useStore((s) => s.setBaseCurrency);

  return (
    <div className="space-y-5">
      {/* Theme */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">Theme</div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const selected = theme === t.id;
            return (
              <button
                key={t.id} onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border transition-all ${
                  selected
                    ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                    : 'surface hover:bg-[var(--bg)]'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Base currency */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">Base currency</div>
        <p className="text-[11px] text-muted px-1 mb-2 leading-relaxed">
          All totals on the Dashboard and reports display in this currency. Individual transactions keep their original currency.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(CURRENCIES).map((c) => {
            const selected = baseCurrency === c.code;
            return (
              <button
                key={c.code} onClick={() => setBaseCurrency(c.code)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                  selected
                    ? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
                    : 'surface hover:bg-[var(--bg)]'
                }`}
              >
                <span className="font-display text-lg">{c.code}</span>
                <span className="text-[10px] opacity-70">{c.label || c.name || c.code}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
