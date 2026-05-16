// src/modules/avs/Ads.jsx
// Tier 5a placeholder. Real build in Tier 5e.
import { Megaphone } from 'lucide-react';
import Placeholder from './_Placeholder';

export default function AvsAds() {
  return (
    <Placeholder
      title="Ads & Campaigns"
      subtitle="Manual spend entry · ROAS per campaign"
      icon={Megaphone}
      tier="5e"
      sections={[
        {
          title: 'Add ad spend',
          description: 'Quick entry: campaign name, platform (FB/IG/TikTok), date range, amount, leads attributed.',
        },
        {
          title: 'Campaign ROAS table',
          description: 'Per campaign: spend, leads, conversions, revenue, ROAS. Sortable. Color-coded winners/losers.',
        },
        {
          title: 'Source attribution',
          description: 'Which Source brings cards: Facebook ads vs Instagram vs Word of mouth vs other.',
        },
        {
          title: 'Future · FB Ads API',
          description: 'Manual entry for now. Direct API hookup deferred to Tier 7 alongside real FX rates.',
        },
      ]}
    />
  );
}
