// src/modules/avs/financials/_Placeholder.jsx
//
// Placeholder shell for Financials sub-tabs that ship in the next tier.
//
import { getWorkspace } from '../../../workspaces/registry';

export default function FinancialsPlaceholder({ icon: Icon, title, description, tier }) {
  const accent = getWorkspace('avs').accent;
  return (
    <div className="surface border rounded-2xl p-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ backgroundColor: accent.soft, color: accent.primary }}
      >
        {Icon && <Icon size={22} />}
      </div>
      <div className="font-medium text-base mb-1">{title}</div>
      <span
        className="inline-block text-[10px] px-1.5 py-0.5 rounded-md font-medium mb-3"
        style={{ backgroundColor: accent.soft, color: accent.primary }}
      >
        building in tier {tier}
      </span>
      <p className="text-xs text-muted leading-relaxed max-w-sm mx-auto">{description}</p>
    </div>
  );
}
