// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Dashboard — Command Center
 *
 * Three-column layout: Agents | Work Queue | Today + Activity
 * Dense, actionable, no decorative hero sections.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { formatTimeAgo } from '../utils/formatting';
import {
  Wifi, WifiOff, Bot, CheckCircle, AlertTriangle, Clock,
  MessageSquare, Mail, Zap, Calendar, Activity, RefreshCw,
  ChevronRight, ArrowRight, Inbox,
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { useStore } from '../store/store';
import type { Task, Agent, Activity as ActivityItem, ApprovalItem } from '../store/store';

type View = string;

interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const PHANTOM_AGENTS = new Set(['main', 'chat-agent']);

const STATUS_COLORS: Record<string, string> = {
  'in-progress': 'var(--color-info)',
  'review':      'var(--color-review)',
  'human-review': 'var(--color-warning)',
  'internal-review': 'var(--mission-control-text-dim)',
  'todo':        'var(--mission-control-text-dim)',
  'done':        'var(--color-success)',
  'failed':      'var(--color-error)',
};

const PRIORITY_COLORS: Record<string, string> = {
  p0: 'var(--color-error)',
  p1: 'var(--color-warning)',
  p2: 'var(--color-info)',
  p3: 'var(--mission-control-text-dim)',
};

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label, count, onAction, actionLabel }: {
  label: string;
  count?: number;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 sticky top-0 bg-mission-control-surface z-10">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
          {label}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim">
            {count}
          </span>
        )}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-[10px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-0.5"
        >
          {actionLabel ?? 'See all'}
          <ChevronRight size={10} />
        </button>
      )}
    </div>
  );
}

function AgentRow({ agent, isActive, onClick }: {
  agent: Agent;
  isActive: boolean;
  onClick: () => void;
}) {
  const dot = agent.status === 'active' || agent.status === 'busy'
    ? 'bg-[var(--color-success)]'
    : isActive
      ? 'bg-[var(--color-info)]'
      : 'bg-mission-control-border';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors text-left group"
    >
      <div className="relative flex-shrink-0">
        <AgentAvatar agentId={agent.id} agentName={agent.name} size="sm" />
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-mission-control-surface ${dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-mission-control-text truncate leading-tight">
          {agent.name}
        </div>
        <div className="text-[11px] text-mission-control-text-dim truncate leading-tight">
          {agent.currentTaskId
            ? 'Working on task'
            : agent.lastActivity
              ? `Last active ${formatTimeAgo(agent.lastActivity)}`
              : agent.status}
        </div>
      </div>
      <ChevronRight size={12} className="text-mission-control-border group-hover:text-mission-control-text-dim transition-colors flex-shrink-0" />
    </button>
  );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const statusColor = STATUS_COLORS[task.status] ?? 'var(--mission-control-text-dim)';
  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors text-left group"
    >
      {/* left accent bar */}
      <span
        className="w-0.5 rounded-full flex-shrink-0 mt-1 self-stretch"
        style={{ background: priorityColor ?? statusColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-mission-control-text truncate leading-tight">
          {task.title}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {task.assignedTo && (
            <span className="text-[11px] text-mission-control-text-dim truncate">
              {task.assignedTo}
            </span>
          )}
          {task.priority === 'p0' && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1 rounded"
              style={{ color: PRIORITY_COLORS.p0, background: `color-mix(in srgb, ${PRIORITY_COLORS.p0} 12%, transparent)` }}>
              P0
            </span>
          )}
          {task.updatedAt && (
            <span className="text-[11px] text-mission-control-text-dim/60 ml-auto flex-shrink-0">
              {formatTimeAgo(task.updatedAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ApprovalRow({ approval, onClick }: { approval: ApprovalItem; onClick: () => void }) {
  const typeLabel: Record<string, string> = {
    tweet: 'Post',
    reply: 'Reply',
    email: 'Email',
    message: 'Message',
    task: 'Task',
    action: 'Action',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors text-left group"
    >
      <span className="w-0.5 rounded-full bg-[var(--color-warning)] flex-shrink-0 mt-1 self-stretch" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-mission-control-text truncate leading-tight">
          {approval.title}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1 rounded"
            style={{ color: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}>
            {typeLabel[approval.type] ?? approval.type}
          </span>
          <span className="text-[11px] text-mission-control-text-dim/60 ml-auto flex-shrink-0">
            {formatTimeAgo(approval.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const icon = {
    task:   <CheckCircle size={11} className="text-[var(--color-success)]" />,
    chat:   <MessageSquare size={11} className="text-[var(--color-info)]" />,
    agent:  <Bot size={11} className="text-[var(--color-review)]" />,
    system: <Activity size={11} className="text-mission-control-text-dim" />,
    error:  <AlertTriangle size={11} className="text-[var(--color-error)]" />,
  }[item.type] ?? <Activity size={11} />;

  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-mission-control-text leading-snug truncate">
          {item.message}
        </p>
        <span className="text-[10px] text-mission-control-text-dim/60">
          {formatTimeAgo(item.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ── Calendar events (fetched inline) ───────────────────────────────────────

interface CalEvent { id: string; title: string; start: string; end?: string; location?: string }

function useCalendarEvents() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const fetch = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const r = await window.fetch(`/api/calendar/events?date=${today}&limit=5`);
      if (r.ok) setEvents((await r.json()).events ?? []);
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return events;
}

function CalEventRow({ event }: { event: CalEvent }) {
  const time = new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-[11px] tabular-nums text-mission-control-text-dim w-12 flex-shrink-0 text-right">
        {time}
      </span>
      <span className="w-0.5 h-4 rounded-full bg-mission-control-accent flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-mission-control-text truncate leading-tight">{event.title}</p>
        {event.location && (
          <p className="text-[11px] text-mission-control-text-dim truncate">{event.location}</p>
        )}
      </div>
    </div>
  );
}

// ── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({ icon, value, label, urgent, onClick }: {
  icon: React.ReactNode;
  value: number;
  label: string;
  urgent?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
        ${urgent && value > 0
          ? 'bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]'
          : 'bg-mission-control-border/40 text-mission-control-text-dim hover:bg-mission-control-border/70'
        } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {icon}
      <span className="tabular-nums font-semibold">{value}</span>
      <span>{label}</span>
    </Tag>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard({ onNavigate, onShowBrief }: DashboardProps) {
  const {
    connected,
    tasks,
    agents,
    activities,
    approvals,
    gatewaySessions,
    fetchAgents,
    loadGatewaySessions,
  } = useStore();

  const calEvents = useCalendarEvents();

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  useEffect(() => {
    if (!connected) return;
    loadGatewaySessions();
    const id = setInterval(loadGatewaySessions, 30_000);
    return () => clearInterval(id);
  }, [connected, loadGatewaySessions]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const realAgents = useMemo(
    () => agents.filter(a => !PHANTOM_AGENTS.has(a.id)),
    [agents]
  );

  const activeSessionKeys = useMemo(
    () => new Set(gatewaySessions.filter(s => s.isActive).map(s => s.key)),
    [gatewaySessions]
  );

  // Sort: active first, then by lastActivity desc
  const sortedAgents = useMemo(
    () => [...realAgents].sort((a, b) => {
      const aActive = a.status === 'active' || a.status === 'busy' ? 1 : 0;
      const bActive = b.status === 'active' || b.status === 'busy' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
    }),
    [realAgents]
  );

  const pendingApprovals = useMemo(
    () => approvals.filter(a => a.status === 'pending'),
    [approvals]
  );

  const p0Tasks = useMemo(
    () => tasks.filter(t => t.priority === 'p0' && t.status !== 'done' && t.status !== 'cancelled'),
    [tasks]
  );

  const inProgressTasks = useMemo(
    () => tasks.filter(t => t.status === 'in-progress'),
    [tasks]
  );

  const reviewTasks = useMemo(
    () => tasks.filter(t => t.status === 'review' || t.status === 'human-review'),
    [tasks]
  );

  const completedToday = useMemo(
    () => tasks.filter(t =>
      t.status === 'done' &&
      new Date(t.updatedAt).toDateString() === new Date().toDateString()
    ).length,
    [tasks]
  );

  const activeAgentCount = useMemo(
    () => realAgents.filter(a => a.status === 'active' || a.status === 'busy').length,
    [realAgents]
  );

  // Attention = approvals + p0 tasks (deduplicated)
  const attentionCount = pendingApprovals.length + p0Tasks.length;

  const recentActivity = useMemo(() => activities.slice(0, 12), [activities]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-mission-control-bg overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          {/* Connection dot */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)] animate-pulse'}`} />
          <div>
            <span className="text-sm font-semibold text-mission-control-text">
              {greeting()}, Kevin
            </span>
            <span className="text-sm text-mission-control-text-dim ml-2">{formatDate()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatPill
            icon={<Bot size={12} />}
            value={activeAgentCount}
            label={activeAgentCount === 1 ? 'agent' : 'agents'}
            onClick={() => onNavigate?.('agents')}
          />
          {attentionCount > 0 && (
            <StatPill
              icon={<Zap size={12} />}
              value={attentionCount}
              label={attentionCount === 1 ? 'action' : 'actions'}
              urgent
              onClick={() => onNavigate?.('approvals')}
            />
          )}
          <StatPill
            icon={<CheckCircle size={12} />}
            value={completedToday}
            label="today"
          />
          <button
            type="button"
            onClick={onShowBrief}
            className="ml-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-mission-control-accent/10 text-mission-control-accent hover:bg-mission-control-accent/20 transition-colors border border-mission-control-accent/20"
          >
            <Mail size={12} />
            Daily Brief
          </button>
        </div>
      </div>

      {/* ── Three-column body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex divide-x divide-mission-control-border overflow-hidden">

        {/* ── Column 1: Agents ─────────────────────────────────────────── */}
        <div className="w-[220px] flex-shrink-0 flex flex-col bg-mission-control-surface overflow-hidden">
          <SectionHeader
            label="Agents"
            count={realAgents.length}
            onAction={() => onNavigate?.('agents')}
          />
          <div className="flex-1 overflow-y-auto">
            {sortedAgents.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bot size={24} className="mx-auto text-mission-control-border mb-2" />
                <p className="text-xs text-mission-control-text-dim">No agents yet</p>
              </div>
            ) : (
              sortedAgents.map(agent => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  isActive={!!agent.sessionKey && activeSessionKeys.has(agent.sessionKey)}
                  onClick={() => onNavigate?.('agents')}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Column 2: Work queue ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col bg-mission-control-bg overflow-hidden">
          <div className="flex-1 overflow-y-auto">

            {/* Needs action */}
            {(pendingApprovals.length > 0 || p0Tasks.length > 0) && (
              <div>
                <SectionHeader
                  label="Needs action"
                  count={attentionCount}
                  onAction={() => onNavigate?.('approvals')}
                />
                {pendingApprovals.map(a => (
                  <ApprovalRow
                    key={a.id}
                    approval={a}
                    onClick={() => onNavigate?.('approvals')}
                  />
                ))}
                {p0Tasks.map(t => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onClick={() => onNavigate?.('kanban')}
                  />
                ))}
              </div>
            )}

            {/* In progress */}
            <div>
              <SectionHeader
                label="In progress"
                count={inProgressTasks.length}
                onAction={() => onNavigate?.('kanban')}
              />
              {inProgressTasks.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-mission-control-text-dim">Nothing in progress</p>
                </div>
              ) : (
                inProgressTasks.slice(0, 10).map(t => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onClick={() => onNavigate?.('kanban')}
                  />
                ))
              )}
            </div>

            {/* In review */}
            {reviewTasks.length > 0 && (
              <div>
                <SectionHeader
                  label="In review"
                  count={reviewTasks.length}
                  onAction={() => onNavigate?.('kanban')}
                />
                {reviewTasks.slice(0, 8).map(t => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onClick={() => onNavigate?.('kanban')}
                  />
                ))}
              </div>
            )}

          </div>
        </div>

        {/* ── Column 3: Today + Activity ───────────────────────────────── */}
        <div className="w-[280px] flex-shrink-0 flex flex-col bg-mission-control-surface overflow-hidden">
          <div className="flex-1 overflow-y-auto">

            {/* Calendar */}
            <SectionHeader
              label="Today"
              onAction={() => onNavigate?.('schedule')}
              actionLabel="Calendar"
            />
            {calEvents.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Calendar size={20} className="mx-auto text-mission-control-border mb-1.5" />
                <p className="text-xs text-mission-control-text-dim">No events today</p>
              </div>
            ) : (
              calEvents.map(ev => <CalEventRow key={ev.id} event={ev} />)
            )}

            {/* Activity */}
            <SectionHeader label="Activity" count={recentActivity.length} />
            {recentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Activity size={20} className="mx-auto text-mission-control-border mb-1.5" />
                <p className="text-xs text-mission-control-text-dim">No recent activity</p>
              </div>
            ) : (
              recentActivity.map(item => <ActivityRow key={item.id} item={item} />)
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
