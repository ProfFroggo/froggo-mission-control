// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState } from 'react';
import DashSnapshotKPI from './DashSnapshotKPI';
import DashInterventionQueue from './DashInterventionQueue';
import DashXMetrics from './DashXMetrics';
import DashMixpanelCard from './DashMixpanelCard';
import DashAgentPerf from './DashAgentPerf';
import DashInboxCard from './DashInboxCard';
import DashCalendarCard from './DashCalendarCard';

interface DashSnapshotProps {
  onNavigate?: (view: string) => void;
}

export default function DashSnapshot({ onNavigate }: DashSnapshotProps) {
  const [range, setRange] = useState<'24h' | '48h'>('24h');

  return (
    <div className="flex-1 p-6 space-y-5 overflow-auto">

      {/* Header with time range toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-mission-control-text">Last {range} snapshot</h1>
          <p className="text-xs text-mission-control-text-dim mt-0.5">
            Agent activity · Communications · Social · Performance
          </p>
        </div>
        <div className="flex items-center gap-1 bg-mission-control-surface border border-mission-control-border rounded-lg p-0.5">
          {(['24h', '48h'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <DashSnapshotKPI range={range} onNavigate={onNavigate} />

      {/* Intervention queue — only renders when there are items */}
      <DashInterventionQueue onNavigate={onNavigate} />

      {/* Row 1: X / Twitter + Mixpanel (Mixpanel hidden when not configured) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DashXMetrics range={range} onNavigate={onNavigate} />
        <DashMixpanelCard range={range} onNavigate={onNavigate} />
      </div>

      {/* Row 2: Agent Performance + Inbox + Today */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <DashAgentPerf range={range} onNavigate={onNavigate} />
        <DashInboxCard onNavigate={onNavigate} />
        <DashCalendarCard onNavigate={onNavigate} />
      </div>

    </div>
  );
}
