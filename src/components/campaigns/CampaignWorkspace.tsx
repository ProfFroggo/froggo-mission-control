// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { ArrowLeft, Megaphone } from 'lucide-react';
import type { Campaign } from '../../types/campaigns';

interface Props {
  campaign: Campaign;
  onBack: () => void;
  onUpdated: () => void;
}

export default function CampaignWorkspace({ campaign, onBack }: Props) {
  return (
    <div className="flex flex-col h-full bg-mission-control-bg0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <button
          onClick={onBack}
          className="icon-btn-sm text-mission-control-text-dim hover:text-mission-control-text"
          aria-label="Back to campaigns"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="p-2 rounded-xl" style={{ background: campaign.color + '33' }}>
          <Megaphone size={20} style={{ color: campaign.color }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-mission-control-text">{campaign.name}</h1>
          <p className="text-xs text-mission-control-text-dim capitalize">{campaign.type} · {campaign.status}</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-mission-control-text-dim text-sm">Campaign workspace coming soon.</p>
      </div>
    </div>
  );
}
