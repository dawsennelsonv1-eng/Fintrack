// src/components/settings/DisplaySettings.jsx
import { Sun, Moon, Eye, EyeOff, Flame, CheckCircle2 } from 'lucide-react';
import {
useStore, selectTheme, selectBaseCurrency, selectPrivacyMask, selectDangerModeOverride,
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
const privacyMask = useStore(selectPrivacyMask);
const setPrivacyMask = useStore((s) => s.setPrivacyMask);
const dangerModeOverride = useStore(selectDangerModeOverride);
const setDangerModeOverride = useStore((s) => s.setDangerModeOverride);

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
{/* Danger Mode Protocol */}
<section>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
Danger Mode Protocol (40 / 25 / 20 / 10 / 5)
</div>
<div className="grid grid-cols-3 gap-2">
{[
{ id: 'auto',   label: 'Auto (When in Debt)', icon: Flame },
{ id: 'danger', label: 'Always Danger',       icon: Flame },
{ id: 'normal', label: 'Always Normal',       icon: CheckCircle2 },
].map((m) => {
const Icon = m.icon;
const selected = dangerModeOverride === m.id;
return (
<button
key={m.id}
onClick={() => setDangerModeOverride(m.id)}
className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all ${
selected
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
: 'surface hover:bg-[var(--bg)]'
}`}
>
<Icon size={15} />
<span className="text-[11px] font-medium">{m.label}</span>
</button>
);
})}
</div>
</section>
{/* Privacy Mask Vault */}
<section>
<div className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold mb-2 px-1">
Privacy Mask (Net Worth, Borrowed Capital & Cash Flow)
</div>
<div className="grid grid-cols-2 gap-2">
<button
onClick={() => setPrivacyMask(true)}
className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-medium ${
privacyMask
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
: 'surface'
}`}
>
<EyeOff size={14} /> Masked (Focus on Buckets)
</button>
<button
onClick={() => setPrivacyMask(false)}
className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-medium ${
!privacyMask
? 'bg-ink-900 dark:bg-ink-50 text-ink-50 dark:text-ink-900 border-transparent'
: 'surface'
}`}
>
<Eye size={14} /> Unmasked
</button>
</div>
</section>
    </div>
  );
}
