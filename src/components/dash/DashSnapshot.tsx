// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { lazy, Suspense, useState, useEffect } from 'react';
import DashSnapshotKPI from './DashSnapshotKPI';
import DashInterventionQueue from './DashInterventionQueue';
import DashXMetrics from './DashXMetrics';
import DashAgentPerf from './DashAgentPerf';
import DashInboxCard from './DashInboxCard';
import DashCalendarCard from './DashCalendarCard';

// Lazy-load DashMixpanelCard: it imports Recharts (~325 KB) which is not needed
// for the initial Dashboard render. Deferring it keeps Recharts out of the
// Dashboard preload chunk, reducing the critical-path JS by ~325 KB.
const DashMixpanelCard = lazy(() => import('./DashMixpanelCard'));

/**
 * Defers rendering of children until the browser is idle after mount.
 * Prevents the DashMixpanelCard lazy import from triggering during the
 * LCP-critical render pass — the Recharts chunk (~102 KB compressed)
 * downloads only after the main content has painted.
 */
function DeferredRender({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setReady(true));
      return () => cancelIdleCallback(id);
    }
    // Fallback for browsers without requestIdleCallback
    const timer = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(timer);
  }, []);
  return <>{ready ? children : fallback}</>;
}

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
        <DeferredRender fallback={<div className="h-48 rounded-xl bg-mission-control-surface animate-pulse" />}>
          <Suspense fallback={<div className="h-48 rounded-xl bg-mission-control-surface animate-pulse" />}>
            <DashMixpanelCard range={range} onNavigate={onNavigate} />
          </Suspense>
        </DeferredRender>
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
