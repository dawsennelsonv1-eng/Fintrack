// src/modules/avs/_Placeholder.jsx
//
// Shared shell for AVS modules that haven't been built yet (5b–5g).
// Gives a polished feel during 5a testing instead of a blank screen.
//
import { getWorkspace } from '../../workspaces/registry';

export default function Placeholder({ title, subtitle, icon: Icon, sections, tier }) {
  const ws = getWorkspace('avs');

  return (
    <div className="max-w-2xl mx-auto px-5 pt-6 pb-32">
      <div className="mb-6">
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>

      <div
        className="rounded-2xl p-5 mb-5 border flex items-start gap-3"
        style={{
          backgroundColor: ws.accent.soft,
          borderColor: ws.accent.primary + '33',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: ws.accent.primary, color: ws.accent.primaryFg }}
        >
          {Icon && <Icon size={18} />}
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">Building in Tier {tier}</div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            This module's structure is ready. Real implementation is the next ship.
          </p>
        </div>
      </div>

      {sections && (
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={i} className="surface border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-medium">{s.title}</div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{
                    backgroundColor: ws.accent.soft,
                    color: ws.accent.primary,
                  }}
                >
                  soon
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
