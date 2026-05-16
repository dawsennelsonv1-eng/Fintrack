// src/modules/avs/Dashboard.jsx
// Tier 5a — placeholder shell. Real implementation in Tier 5h.
//
// Shows the layout structure that final dashboard will have, with
// "Coming in 5h" markers on each card so Christian can see the
// planned graph slots.
//
import { Sparkles, TrendingUp, Users, DollarSign, Target, BarChart3 } from 'lucide-react';
import { getWorkspace } from '../../workspaces/registry';

const PLANNED_CARDS = [
  {
    icon: DollarSign,
    title: 'Cash · Today / Week / Month',
    description: 'Toggle period. Revenue, gross profit, MTD trends.',
  },
  {
    icon: TrendingUp,
    title: 'Conversion Funnel',
    description: 'À Faire → Rdv → Atelier → Terminé. % drop-off per stage.',
  },
  {
    icon: Users,
    title: 'Top Sources & Staff',
    description: 'Which ad source converts best. Top closer this period.',
  },
  {
    icon: Target,
    title: 'ROAS per Campaign',
    description: 'Active ads ranked by return on spend.',
  },
  {
    icon: BarChart3,
    title: 'Revenue Trend (90d)',
    description: 'Daily revenue chart with 7-day moving average.',
  },
];

export default function AvsDashboard() {
  const ws = getWorkspace('avs');

  return (
    <div className="max-w-2xl mx-auto px-5 pt-6 pb-32">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl leading-tight">AVS Solution HT</h1>
        <p className="text-sm text-muted mt-1">Cards business — performance overview</p>
      </div>

      {/* Welcome card */}
      <div
        className="rounded-2xl p-5 mb-6 border"
        style={{
          backgroundColor: ws.accent.soft,
          borderColor: ws.accent.primary + '33',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: ws.accent.primary, color: ws.accent.primaryFg }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div className="font-medium text-sm">Workspace switcher live</div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Tier 5a shipped. Each module below gets built out in the next tiers.
              Tap the workspace name in the header to jump back to Personal anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Planned dashboard cards */}
      <div className="space-y-3">
        {PLANNED_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="surface border rounded-2xl p-4 flex items-start gap-3"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: ws.accent.soft,
                  color: ws.accent.primary,
                }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{card.title}</div>
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
                <p className="text-xs text-muted mt-1 leading-relaxed">{card.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
