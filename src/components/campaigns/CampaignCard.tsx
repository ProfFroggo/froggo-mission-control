'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { ChevronRight, Clock, Users, Zap, CalendarDays, Archive } from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatting';
import AgentAvatar from '../AgentAvatar';
import { CHANNEL_ICONS, CHANNEL_LABELS } from './channelIcons';
import type { Campaign } from '../../types/campaigns';

export const TYPE_COLORS: Record<string, string> = {
  paid:       'text-orange-400 bg-orange-400/10 border-orange-400/20',
  organic:    'text-green-400 bg-green-400/10 border-green-400/20',
  social:     'text-blue-400 bg-blue-400/10 border-blue-400/20',
  email:      'text-purple-400 bg-purple-400/10 border-purple-400/20',
  clm:        'text-pink-400 bg-pink-400/10 border-pink-400/20',
  content:    'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  pr:         'text-amber-400 bg-amber-400/10 border-amber-400/20',
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
  planning:  { label: 'Planning',  cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  live:      { label: 'Live',      cls: 'text-green-400 bg-green-400/10 border-green-400/20', dot: true },
  paused:    { label: 'Paused',    cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  completed: { label: 'Completed', cls: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
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

  // ── List view layout ────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className="group w-full text-left bg-mission-control-surface border border-mission-control-border rounded-lg px-4 py-3 hover:border-mission-control-accent/50 hover:bg-mission-control-surface/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mission-control-accent/30"
      >
        <div className="flex items-center gap-4">
          {/* Color dot */}
          <div
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${campaign.color}20`, border: `1px solid ${campaign.color}40` }}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: campaign.color }} />
          </div>

          {/* Name + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-mission-control-text truncate group-hover:text-mission-control-accent transition-colors">
                {campaign.name}
              </span>
              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tc}`}>
                {typeLabel}
              </span>
              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.cls}`}>
                {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                {sc.label}
              </span>
            </div>
            {campaign.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{campaign.description}</p>
            )}
          </div>

          {/* Task progress pill */}
          <div className="flex-shrink-0 w-28 hidden sm:block">
            {totalTasks > 0 ? (
              <div>
                <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-0.5">
                  <span>{doneTasks}/{totalTasks}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: campaign.color }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs text-mission-control-text-dim">No tasks</span>
            )}
          </div>

          {/* Members */}
          <div className="flex-shrink-0 flex items-center -space-x-1.5">
            {members.slice(0, 3).map((m: any) => (
              <AgentAvatar key={m.agentId} agentId={m.agentId} fallbackEmoji={m.agentEmoji} size="xs" className="ring-1 ring-mission-control-bg0" />
            ))}
            {members.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border flex items-center justify-center text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
                +{members.length - 3}
              </div>
            )}
            {members.length === 0 && (
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1"><Users size={11} /> 0</span>
            )}
          </div>

          {/* Date / time info */}
          <div className="flex-shrink-0 flex items-center gap-3 text-xs text-mission-control-text-dim">
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
          </div>

          {onArchive && campaign.status !== 'archived' && (
            <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="p-1 rounded hover:bg-mission-control-surface text-mission-control-text-dim hover:text-warning transition-colors" title="Archive">
              <Archive size={13} />
            </button>
          )}
          <ChevronRight size={14} className="flex-shrink-0 text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
        </div>
      </button>
    );
  }

  // ── Grid view layout ────────────────────────────────────────────────────────
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-mission-control-surface border border-mission-control-border rounded-lg p-5 hover:border-mission-control-accent/50 hover:bg-mission-control-surface/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mission-control-accent/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
            style={{ backgroundColor: `${campaign.color}20`, border: `1px solid ${campaign.color}40` }}
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: campaign.color }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-mission-control-text truncate group-hover:text-mission-control-accent transition-colors text-sm">
              {campaign.name}
            </h3>
            {campaign.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tc}`}>
            {typeLabel}
          </span>
          <ChevronRight size={14} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
        </div>
      </div>

      {/* Status + channels row */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.cls}`}>
          {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          {sc.label}
        </span>
        <div className="flex items-center gap-1 ml-1">
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
        </div>
      </div>

      {/* Task progress */}
      {totalTasks > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
            <span>{doneTasks}/{totalTasks} tasks</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: campaign.color }}
            />
          </div>
        </div>
      )}

      {/* Timeline progress — shown when campaign has start/end dates */}
      {timelineProgress !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
            <span className="flex items-center gap-1">
              <CalendarDays size={10} />
              {start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
            </span>
            <span className={isOverdue ? 'text-error' : daysRemaining !== null && daysRemaining <= 7 ? 'text-warning' : ''}>
              {isOverdue
                ? 'Overdue'
                : daysRemaining === 0
                  ? 'Ends today'
                  : daysRemaining !== null
                    ? `${daysRemaining}d left`
                    : `${timelineProgress}%`}
            </span>
          </div>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${timelineProgress}%`,
                backgroundColor: isOverdue
                  ? 'var(--color-error)'
                  : daysRemaining !== null && daysRemaining <= 7
                    ? 'var(--color-warning)'
                    : 'var(--color-info, #6366f1)',
              }}
            />
          </div>
        </div>
      )}

      {/* Budget bar */}
      {budget != null && budget > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
            <span>Budget</span>
            <span>{formatBudget(budgetSpent)} / {formatBudget(budget)}</span>
          </div>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${spendPct}%`,
                backgroundColor: spendPct > 90 ? 'var(--color-error)' : spendPct > 70 ? 'var(--color-warning)' : 'var(--color-success)',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Member avatars */}
        <div className="flex items-center -space-x-1.5">
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
            <div className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border flex items-center justify-center text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
              +{members.length - 4}
            </div>
          )}
          {members.length === 0 && (
            <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
              <Users size={11} /> No agents
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
          {inProgressTasks > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <Zap size={11} /> {inProgressTasks}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} /> {formatTimeAgo(lastActivity)}
          </span>
        </div>
      </div>
    </button>
  );
}
