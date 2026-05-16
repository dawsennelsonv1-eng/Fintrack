// src/modules/avs/CalendarView.jsx
// Tier 5a placeholder. Real build in Tier 5c (reuses Personal CalendarView pattern).
import { Calendar } from 'lucide-react';
import Placeholder from './_Placeholder';

export default function AvsCalendar() {
  return (
    <Placeholder
      title="Calendar"
      subtitle="RDV schedule + delivery dates"
      icon={Calendar}
      tier="5c"
      sections={[
        {
          title: 'Month view',
          description: 'Same component as Personal Calendar. Shows RDV Fixé appointments and Date_Reception deliveries.',
        },
        {
          title: 'Today / Week / Month toggle',
          description: 'Switch granularity. Tap a day to see all events.',
        },
        {
          title: 'Event detail',
          description: 'Tap an event to jump straight to that client/lead.',
        },
      ]}
    />
  );
}
