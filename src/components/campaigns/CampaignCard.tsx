'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { ChevronRight, Clock, Users, Zap, CalendarDays, Archive } from 'lucide-react';
import { Box, Flex } from '@radix-ui/themes';
import { formatTimeAgo } from '../../utils/formatting';
import AgentAvatar from '../AgentAvatar';
import { CHANNEL_ICONS, CHANNEL_LABELS } from './channelIcons';
import type { Campaign } from '../../types/campaigns';

export const TYPE_COLORS: Record<string, string> = {
  paid:       'text-danger bg-danger/10 border-danger/20',
  organic:    'text-success bg-success/10 border-success/20',
  social:     'text-info bg-info/10 border-info/20',
  email:      'text-review bg-review/10 border-review/20',
  clm:        'text-pink-400 bg-pink-400/10 border-pink-400/20',
  content:    'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  pr:         'text-warning bg-warning/10 border-warning/20',
  influencer: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  seo:        'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  product:    'text-mission-control-accent bg-mission-control-accent/10 border-mission-control-accent/20',
  general:    'text-mission-control-text-dim bg-muted-subtle border-muted-border',
};

export const TYPE_LABELS: Record<string, string> = {
  paid:       'Paid',
  organic:    'Organic',
  social:     'Social',
  email:      'Email',
  clm:        'CLM',
  content:    'Content',
  pr:         'PR',
  influencer: 'Influencer',
  seo:        'SEO',
  product:    'Product',
  general:    'General',
};

export const STATUS_CONFIG: Record<string, { label: string; cls: string; dot?: boolean }> = {
  draft:     { label: 'Draft',     cls: 'text-mission-control-text-dim bg-muted-subtle border-muted-border' },
  planning:  { label: 'Planning',  cls: 'text-info bg-info/10 border-info/20' },
  live:      { label: 'Live',      cls: 'text-success bg-success/10 border-success/20', dot: true },
  paused:    { label: 'Paused',    cls: 'text-warning bg-warning/10 border-warning/20' },
  completed: { label: 'Completed', cls: 'text-review bg-review/10 border-review/20' },
  archived:  { label: 'Archived',  cls: 'text-mission-control-text-dim/50 bg-muted-subtle/50 border-muted-border/50' },
};

function formatBudget(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
  onArchive?: () => void;
  viewMode?: 'grid' | 'list';
}

export default function CampaignCard({ campaign, onClick, onArchive, viewMode = 'grid' }: CampaignCardProps) {
  const sc = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  // Support both legacy `type: string` and new `types: string[]`
  const primaryType = (campaign.types && campaign.types.length > 0) ? campaign.types[0] : campaign.type;
  const tc = TYPE_COLORS[primaryType] ?? TYPE_COLORS.general;
  const typeLabel = campaign.types && campaign.types.length > 1
    ? campaign.types.map(t => TYPE_LABELS[t] ?? t).join(', ')
    : (TYPE_LABELS[primaryType] ?? primaryType);

  const totalTasks = campaign.totalTasks ?? 0;
  const doneTasks = campaign.doneTasks ?? 0;
  const inProgressTasks = campaign.inProgressTasks ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const members = campaign.members ?? [];
  const channels = campaign.channels ?? [];
  const budget = campaign.budget;
  const budgetSpent = campaign.budgetSpent ?? 0;
  const spendPct = budget && budget > 0 ? Math.min(100, Math.round((budgetSpent / budget) * 100)) : 0;

  const lastActivity = campaign.lastTaskActivity || campaign.updatedAt;

  const now = Date.now();
  const start = campaign.startDate;
  const end = campaign.endDate;
  const timelineProgress = start && end && end > start
    ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
    : null;
  const daysRemaining = end ? Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24))) : null;
  const isOverdue = end != null && now > end && campaign.status !== 'completed' && campaign.status !== 'archived';

  // ROI: (revenue - spend) / spend * 100. Show if we have both.
  const revenueActual = campaign.kpis?.revenue?.actual ?? 0;
  const roiPct = budgetSpent > 0 && revenueActual > 0
    ? Math.round(((revenueActual - budgetSpent) / budgetSpent) * 100)
    : null;

  // ── List view layout ────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group w-full text-left bg-mission-control-surface border border-mission-control-border rounded-xl px-4 py-3 hover:border-mission-control-accent/50 hover:bg-mission-control-border/10 transition-colors duration-200 focus:outline-none"
      >
        <Flex align="center" gap="4">
          {/* Color dot */}
          <Flex
            align="center"
            justify="center"
            className="flex-shrink-0 w-7 h-7 rounded-lg"
            style={{ backgroundColor: `${campaign.color}20`, border: `1px solid ${campaign.color}40` }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: campaign.color }} />
          </Flex>

          {/* Name + description */}
          <Box className="flex-1 min-w-0">
            <Flex align="center" gap="2">
              <span className="font-medium text-sm text-mission-control-text truncate group-hover:text-mission-control-accent transition-colors">
                {campaign.name}
              </span>
              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tc}`}>
                {typeLabel}
              </span>
              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.cls}`}>
                {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                {sc.label}
              </span>
            </Flex>
            {campaign.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{campaign.description}</p>
            )}
          </Box>

          {/* Task progress pill */}
          <div className="flex-shrink-0 w-28 hidden sm:block">
            {totalTasks > 0 ? (
              <div>
                <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-0.5">
                  <span>{doneTasks}/{totalTasks}</span>
                  <span>{progress}%</span>
                </Flex>
                <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-colors duration-500"
                    style={{ width: `${progress}%`, backgroundColor: campaign.color }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs text-mission-control-text-dim">No tasks</span>
            )}
          </div>

          {/* Members */}
          <Flex align="center" className="flex-shrink-0 -space-x-1.5">
            {members.slice(0, 3).map((m: any) => (
              <AgentAvatar key={m.agentId} agentId={m.agentId} fallbackEmoji={m.agentEmoji} size="xs" className="ring-1 ring-mission-control-bg0" />
            ))}
            {members.length > 3 && (
              <Flex align="center" justify="center" className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
                +{members.length - 3}
              </Flex>
            )}
            {members.length === 0 && (
              <Flex align="center" gap="1" className="text-xs text-mission-control-text-dim"><Users size={11} /> 0</Flex>
            )}
          </Flex>

          {/* Date / time info */}
          <Flex align="center" gap="3" className="flex-shrink-0 text-xs text-mission-control-text-dim">
            {daysRemaining !== null && campaign.status !== 'completed' && campaign.status !== 'archived' && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-error' : daysRemaining <= 7 ? 'text-warning' : ''}`}>
                <CalendarDays size={11} />
                {isOverdue ? 'Overdue' : daysRemaining === 0 ? 'Today' : `${daysRemaining}d`}
              </span>
            )}
            {inProgressTasks > 0 && (
              <span className="flex items-center gap-1 text-warning"><Zap size={11} /> {inProgressTasks}</span>
            )}
            <span className="flex items-center gap-1"><Clock size={11} /> {formatTimeAgo(lastActivity)}</span>
          </Flex>

          {onArchive && campaign.status !== 'archived' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              title="Archive"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <Archive size={13} />
            </button>
          )}
          <ChevronRight size={14} className="flex-shrink-0 text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
        </Flex>
      </button>
    );
  }

  // ── Grid view layout ────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/50 transition-colors duration-200 focus:outline-none"
    >
      {/* Header */}
      <Flex align="start" justify="between" gap="3" mb="3">
        <Flex align="start" gap="3" className="min-w-0">
          <Flex
            align="center"
            justify="center"
            className="flex-shrink-0 w-9 h-9 rounded-lg mt-0.5"
            style={{ backgroundColor: `${campaign.color}20`, border: `1px solid ${campaign.color}40` }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: campaign.color }} />
          </Flex>
          <Box className="min-w-0">
            <h3 className="font-semibold text-mission-control-text truncate group-hover:text-mission-control-accent transition-colors text-sm">
              {campaign.name}
            </h3>
            {campaign.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{campaign.description}</p>
            )}
          </Box>
        </Flex>
        <Flex align="center" gap="2" className="flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tc}`}>
            {typeLabel}
          </span>
          <ChevronRight size={14} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
        </Flex>
      </Flex>

      {/* Status + channels row */}
      <Flex align="center" gap="2" mb="3">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.cls}`}>
          {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
          {sc.label}
        </span>
        <Flex align="center" gap="1" className="ml-1">
          {channels.slice(0, 5).map((ch: string) => {
            const Icon = CHANNEL_ICONS[ch];
            if (!Icon) return null;
            return (
              <span key={ch} title={CHANNEL_LABELS[ch] ?? ch}>
                <Icon size={11} className="text-mission-control-text-dim" />
              </span>
            );
          })}
          {channels.length > 5 && (
            <span className="text-xs text-mission-control-text-dim">+{channels.length - 5}</span>
          )}
        </Flex>
      </Flex>

      {/* Task progress */}
      {totalTasks > 0 && (
        <Box mb="3">
          <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-1">
            <span>{doneTasks}/{totalTasks} tasks</span>
            <span>{progress}%</span>
          </Flex>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-colors duration-500"
              style={{ width: `${progress}%`, backgroundColor: campaign.color }}
            />
          </div>
        </Box>
      )}

      {/* Timeline progress — shown when campaign has start/end dates */}
      {timelineProgress !== null && (
        <Box mb="3">
          <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-1">
            <Flex align="center" gap="1">
              <CalendarDays size={10} />
              {start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
            </Flex>
            <span className={isOverdue ? 'text-error' : daysRemaining !== null && daysRemaining <= 7 ? 'text-warning' : ''}>
              {isOverdue
                ? 'Overdue'
                : daysRemaining === 0
                  ? 'Ends today'
                  : daysRemaining !== null
                    ? `${daysRemaining}d left`
                    : `${timelineProgress}%`}
            </span>
          </Flex>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-colors duration-500"
              style={{
                width: `${timelineProgress}%`,
                backgroundColor: isOverdue
                  ? 'var(--color-error)'
                  : daysRemaining !== null && daysRemaining <= 7
                    ? 'var(--color-warning)'
                    : 'var(--color-info)',
              }}
            />
          </div>
        </Box>
      )}

      {/* Budget bar */}
      {budget != null && budget > 0 && (
        <Box mb="3">
          <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-1">
            <span>Budget</span>
            <span>{formatBudget(budgetSpent)} / {formatBudget(budget)}</span>
          </Flex>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-colors duration-500"
              style={{
                width: `${spendPct}%`,
                backgroundColor: spendPct > 90 ? 'var(--color-error)' : spendPct > 70 ? 'var(--color-warning)' : 'var(--color-success)',
              }}
            />
          </div>
        </Box>
      )}

      {/* Footer */}
      <Flex align="center" justify="between">
        {/* Member avatars */}
        <Flex align="center" className="-space-x-1.5">
          {members.slice(0, 4).map((m: any) => (
            <AgentAvatar
              key={m.agentId}
              agentId={m.agentId}
              fallbackEmoji={m.agentEmoji}
              size="xs"
              className="ring-1 ring-mission-control-bg0"
            />
          ))}
          {members.length > 4 && (
            <Flex align="center" justify="center" className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
              +{members.length - 4}
            </Flex>
          )}
          {members.length === 0 && (
            <Flex align="center" gap="1" className="text-xs text-mission-control-text-dim">
              <Users size={11} /> No agents
            </Flex>
          )}
        </Flex>

        {/* Stats */}
        <Flex align="center" gap="3" className="text-xs text-mission-control-text-dim">
          {roiPct !== null && (
            <span className={`font-medium tabular-nums ${roiPct >= 0 ? 'text-success' : 'text-error'}`}>
              {roiPct >= 0 ? '+' : ''}{roiPct}% ROI
            </span>
          )}
          {inProgressTasks > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <Zap size={11} /> {inProgressTasks}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} /> {formatTimeAgo(lastActivity)}
          </span>
        </Flex>
      </Flex>
    </button>
  );
}
