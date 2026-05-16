// src/modules/avs/Clients.jsx
// Tier 5a placeholder. Real build in Tiers 5b + 5c (merged module).
import { Users } from 'lucide-react';
import Placeholder from './_Placeholder';

export default function AvsClients() {
  return (
    <Placeholder
      title="Clients"
      subtitle="Leads + active clients — one searchable list"
      icon={Users}
      tier="5b"
      sections={[
        {
          title: 'Kanban view',
          description: 'Drag cards across statuses: À Faire → Rdv → Atelier → Terminé. Tap a card to edit.',
        },
        {
          title: 'List view',
          description: 'Filterable table with search by name, WhatsApp, Ad source. Sort by date / status / amount.',
        },
        {
          title: 'Client detail',
          description: 'Tap any client to see history: every card bought, payments, Notes timeline, linked recharges (when AVS Recharge ships).',
        },
        {
          title: 'Quick add lead',
          description: 'Floating + button. Name + WhatsApp + source + card type. Auto-creates lead in À Faire.',
        },
        {
          title: 'Migration: import 74 existing leads',
          description: 'One-tap import from your current AVS sheet. Status mapping preserved.',
        },
      ]}
    />
  );
}
