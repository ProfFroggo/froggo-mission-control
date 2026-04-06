// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashSnapshotKPI — 4 bold KPI tiles.
 * Tasks completed · Active agents · X impressions (range-filtered) · Pending approvals
 */

import { useState, useMemo } from 'react';
import { CheckCircle, Bot, TrendingUp, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/store';
import { useXAnalytics } from '../../hooks/useXAnalytics';

interface DashSnapshotKPIProps {
  range: '24h' | '48h';
  onNavigate?: (view: string) => void;
}

type Urgency = 'normal' | 'active' | 'success' | 'warning' | 'urgent';

interface KPITileData {
  icon: React.ElementType;
  value: string | number;
  label: string;
  subtext?: string;
  urgency: Urgency;
  onClick?: () => void;
}

const VALUE_COLOR: Record<Urgency, string> = {
  normal:  'text-mission-control-text',
  active:  'text-info-DEFAULT',
  success: 'text-success-DEFAULT',
  warning: 'text-warning-DEFAULT',
  urgent:  'text-error-DEFAULT',
};

const BORDER_COLOR: Record<Urgency, string> = {
  normal:  'border-mission-control-border',
  active:  'border-info-border',
  success: 'border-success-border',
  warning: 'border-warning-border',
  urgent:  'border-error-border',
};

function KPITile({ icon: Icon, value, label, subtext, urgency, onClick }: KPITileData & { icon: React.ElementType }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 min-w-0 rounded-xl border bg-mission-control-surface p-4 text-left transition-colors hover:bg-mission-control-bg',
        BORDER_COLOR[urgency],
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].join(' ')}
    >
      <Icon size={18} className={`mb-3 ${VALUE_COLOR[urgency]} opacity-80`} />
      <div className={`text-2xl font-bold tabular-nums leading-none mb-1 ${VALUE_COLOR[urgency]}`}>
        {value}
      </div>
      <div className="text-xs font-semibold text-mission-control-text">{label}</div>
      {subtext && (
        <div className="text-[10px] text-mission-control-text-dim mt-0.5">{subtext}</div>
      )}
    </button>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export default function DashSnapshotKPI({ range, onNavigate }: DashSnapshotKPIProps) {
  const { tasks, agents, approvals } = useStore();

  const { data: xData } = useXAnalytics();

  const rangeHours = range === '24h' ? 24 : 48;
  const cutoff = Date.now() - rangeHours * 60 * 60 * 1000;

  // Derive impressions and tweet count from shared analytics data
  const { xImpressions, xTweetCount } = useMemo(() => {
    if (!xData?.success || !Array.isArray(xData.tweets)) {
      return { xImpressions: null as number | null, xTweetCount: null as number | null };
    }
    const inRange = xData.tweets.filter(
      (t) => t.created_at && new Date(t.created_at).getTime() >= cutoff,
    );
    const total = inRange.reduce((sum, t) => sum + (t.public_metrics?.impression_count ?? 0), 0);
    return { xImpressions: total, xTweetCount: inRange.length };
  }, [xData, cutoff]);

  const doneInRange = tasks.filter((t) => t.status === 'done' && t.updatedAt >= cutoff).length;
  const activeAgents = agents.filter(
    (a) => !['main', 'chat-agent'].includes(a.id) && (a.status === 'active' || a.status === 'busy'),
  ).length;
  const totalAgents = agents.filter((a) => !['main', 'chat-agent'].includes(a.id)).length;
  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length;

  const tiles: KPITileData[] = [
    {
      icon: CheckCircle,
      value: doneInRange,
      label: 'Tasks completed',
      subtext: range === '24h' ? 'since midnight' : 'last 48h',
      urgency: doneInRange > 0 ? 'success' : 'normal',
      onClick: () => onNavigate?.('kanban'),
    },
    {
      icon: Bot,
      value: `${activeAgents}/${totalAgents}`,
      label: 'Agents active',
      subtext: activeAgents > 0 ? `${activeAgents} running` : 'all standing by',
      urgency: activeAgents > 0 ? 'active' : 'normal',
      onClick: () => onNavigate?.('agents'),
    },
    {
      icon: TrendingUp,
      value: xImpressions !== null ? formatNumber(xImpressions) : '—',
      label: 'X impressions',
      subtext:
        xImpressions !== null && xTweetCount !== null
          ? `${xTweetCount} post${xTweetCount !== 1 ? 's' : ''} · ${range}`
          : `last ${range}`,
      urgency: 'normal',
      onClick: xImpressions !== null ? () => onNavigate?.('twitter') : undefined,
    },
    {
      icon: AlertCircle,
      value: pendingApprovals,
      label: 'Pending approvals',
      subtext: pendingApprovals === 0 ? 'all clear' : 'needs your decision',
      urgency: pendingApprovals > 0 ? 'urgent' : 'normal',
      onClick: pendingApprovals > 0 ? () => onNavigate?.('approvals') : undefined,
    },
  ];

  return (
    <div className="flex gap-4">
      {tiles.map((tile, i) => (
        <KPITile key={i} {...tile} />
      ))}
    </div>
  );
}
