import { useEffect, useState, useMemo, useCallback } from 'react';
import { formatTimeAgo } from '../utils/formatting';
import {
  Wifi, WifiOff, CheckCircle, Bot, ArrowRight, Calendar,
  Zap, Shield, AlertTriangle, Inbox,
  ListTodo, Activity, MapPin, Video, ChevronRight,
  Loader2, XCircle, DollarSign,
  MessageSquare, Mail, Twitter, FileText, Clipboard, Radio, type LucideIcon,
  Eye, UserCheck, Plus, BookOpen, FolderKanban, Search, BarChart2, Trophy
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentDetailModal from './AgentDetailModal';
import { useStore } from '../store/store';
import type { ApprovalItem, Task, Agent, GatewaySession } from '../store/store';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'voicechat' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'analytics' | 'comms' | 'contacts' | 'accounts' | 'sessions' | 'calendar' | 'templates' | 'finance' | 'writing';

interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

// ── Utilities ──────────────────────────────────────────────

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

const APPROVAL_ICONS: Record<string, LucideIcon> = {
  tweet: Twitter,
  reply: Twitter,
  email: Mail,
  message: MessageSquare,
  task: ListTodo,
  action: Zap,
};

const PHANTOM_AGENTS = ['main', 'chat-agent'];

// ── HeaderBar ──────────────────────────────────────────────

function HeaderBar({ connected }: { connected: boolean }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-mission-control-border/50">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-mission-control-text to-mission-control-accent bg-clip-text text-transparent">
          {greeting}
        </h1>
        <p className="text-sm text-mission-control-text-dim mt-0.5">{dateStr}</p>
      </div>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
        connected
          ? 'bg-success-subtle text-success border border-success-border'
          : 'bg-error-subtle text-error border border-error-border'
      }`}>
        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {connected ? 'Online' : 'Connecting...'}
      </div>
    </div>
  );
}

// ── StatStrip ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  pulse?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  sub?: string;
  agents?: Agent[];
}

function StatCard({ label, value, icon: Icon, color, pulse, highlight, onClick, sub, agents }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 p-4 backdrop-blur-xl rounded-xl border transition-all group text-left ${
        highlight && value > 0
          ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400/70 shadow-lg shadow-amber-500/5'
          : 'bg-mission-control-surface/80 border-mission-control-border hover:border-mission-control-accent/50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={color} />
        {pulse && value > 0 && (
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
        )}
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-mission-control-text-dim mt-1 font-medium">{label}</div>
      {sub && <div className="text-xs text-mission-control-text-dim/70 mt-0.5">{sub}</div>}
      {agents && agents.length > 0 && (
        <div className="flex -space-x-1.5 mt-2">
          {agents.slice(0, 4).map(a => (
            <AgentAvatar key={a.id} agentId={a.id} fallbackEmoji={a.avatar} size="xs" />
          ))}
          {agents.length > 4 && (
            <span className="w-5 h-5 rounded-full bg-mission-control-border text-mission-control-text-dim text-[9px] flex items-center justify-center flex-shrink-0 ring-1 ring-mission-control-bg">
              +{agents.length - 4}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function StatStrip({
  inProgressCount,
  reviewCount,
  internalReviewCount,
  humanReviewCount,
  doneTodayCount,
  inProgressAgents,
  onNavigate,
}: {
  inProgressCount: number;
  reviewCount: number;
  internalReviewCount: number;
  humanReviewCount: number;
  doneTodayCount: number;
  inProgressAgents: Agent[];
  onNavigate?: (view: View) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 sm:px-6 py-4">
      <StatCard
        label="Active Tasks"
        value={inProgressCount}
        icon={Activity}
        color={inProgressCount > 0 ? 'text-blue-400' : 'text-mission-control-text-dim'}
        agents={inProgressAgents}
        sub={doneTodayCount > 0 ? `${doneTodayCount} completed today` : undefined}
        onClick={() => onNavigate?.('kanban')}
      />
      <StatCard
        label="Awaiting Review"
        value={reviewCount}
        icon={Eye}
        color={reviewCount > 0 ? 'text-violet-400' : 'text-mission-control-text-dim'}
        onClick={() => onNavigate?.('kanban')}
      />
      <StatCard
        label="Pre-Review Queue"
        value={internalReviewCount}
        icon={UserCheck}
        color={internalReviewCount > 0 ? 'text-cyan-400' : 'text-mission-control-text-dim'}
        onClick={() => onNavigate?.('kanban')}
      />
      <StatCard
        label="Human Attention"
        value={humanReviewCount}
        icon={AlertTriangle}
        color={humanReviewCount > 0 ? 'text-amber-400' : 'text-mission-control-text-dim'}
        highlight={humanReviewCount > 0}
        pulse={humanReviewCount > 0}
        onClick={() => onNavigate?.('kanban')}
      />
    </div>
  );
}

// ── QuickActions row ────────────────────────────────────────

function QuickActionsRow({ onNavigate }: { onNavigate?: (view: View) => void }) {
  return (
    <div className="px-4 sm:px-6 pb-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-mission-control-surface/80 backdrop-blur-xl rounded-xl border border-mission-control-border">
        <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mr-1 hidden sm:block">
          Quick Actions
        </span>
        <button
          onClick={() => onNavigate?.('kanban')}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-mission-control-accent text-white text-sm font-medium rounded-lg hover:bg-mission-control-accent/80 transition-colors"
        >
          <Plus size={14} />
          New Task
        </button>
        <button
          onClick={() => onNavigate?.('chat')}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm font-medium rounded-lg hover:bg-mission-control-border transition-colors"
        >
          <MessageSquare size={14} />
          Chat
        </button>
        <button
          onClick={() => onNavigate?.('kanban')}
          className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm font-medium rounded-lg hover:bg-mission-control-border transition-colors"
        >
          <FolderKanban size={14} />
          View Board
        </button>
        <button
          onClick={() => onNavigate?.('library')}
          className="hidden md:flex items-center gap-2 px-3 sm:px-4 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm font-medium rounded-lg hover:bg-mission-control-border transition-colors"
        >
          <BookOpen size={14} />
          Browse Library
        </button>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-mission-control-text-dim">
          <Search size={12} />
          <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded text-[10px]">⌘K</kbd>
          <span className="hidden sm:inline">to search</span>
        </div>
      </div>
    </div>
  );
}

// ── ApprovalsQueue ─────────────────────────────────────────

function ApprovalCard({
  item,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const Icon = APPROVAL_ICONS[item.type] || FileText;

  return (
    <div className="p-4 border-b border-mission-control-border/30 hover:bg-mission-control-bg/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="mt-1 p-2 rounded-lg bg-mission-control-bg/50">
          <Icon size={16} className="text-mission-control-text-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">
                {item.type}
              </span>
              <h4 className="font-medium text-mission-control-text mt-0.5 line-clamp-1">{item.title}</h4>
            </div>
            <span className="text-xs text-mission-control-text-dim flex-shrink-0">
              {formatTimeAgo(item.createdAt)}
            </span>
          </div>
          <p className="text-sm text-mission-control-text-dim mt-1 line-clamp-2">{item.content}</p>
          {item.metadata?.to && (
            <p className="text-xs text-mission-control-text-dim/70 mt-1">To: {item.metadata.to}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onApprove(item.id)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(item.id)}
              className="px-4 py-1.5 bg-mission-control-bg hover:bg-red-500/20 text-mission-control-text-dim hover:text-red-400 text-xs font-medium rounded-lg border border-mission-control-border transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalsQueue({
  approvals,
  onApprove,
  onReject,
  onNavigate,
}: {
  approvals: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onNavigate?: (view: View) => void;
}) {
  // Memoized so the filter only re-runs when approvals array reference changes
  const pending = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals]);

  return (
    <div className={`bg-mission-control-surface/80 backdrop-blur-xl rounded-xl border overflow-hidden flex flex-col ${
      pending.length > 0 ? 'border-orange-500/50 shadow-lg shadow-orange-500/5' : 'border-mission-control-border'
    }`}>
      <div className="p-4 border-b border-mission-control-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={16} className={pending.length > 0 ? 'text-orange-400' : 'text-mission-control-text-dim'} />
          <h2 className="font-semibold text-sm">Needs Your Decision</h2>
          {pending.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
              {pending.length}
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate?.('approvals')}
          className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent-dim transition-colors"
        >
          View All <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {pending.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400/50" />
            <p className="text-sm text-mission-control-text-dim font-medium">All caught up</p>
            <p className="text-xs text-mission-control-text-dim/70 mt-1">No pending approvals</p>
          </div>
        ) : (
          pending.slice(0, 10).map(item => (
            <ApprovalCard
              key={item.id}
              item={item}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── ActivityFeed ───────────────────────────────────────────

const ACTIVITY_VERBS: Record<string, string> = {
  chat: 'sent a message',
  task: 'updated task',
  agent: 'agent status changed',
  error: 'reported an error',
  system: 'system event',
};

function ActivityFeed({
  inProgressTasks,
  agentMap,
  activities,
  allTasks,
  onNavigate,
  onAgentClick,
}: {
  inProgressTasks: Task[];
  agentMap: Map<string, Agent>;
  activities: { id: string; type: string; message: string; timestamp: number }[];
  allTasks: Task[];
  onNavigate?: (view: View) => void;
  onAgentClick?: (agentId: string) => void;
}) {
  // Agent leaderboard: count tasks completed today per agent (status = done, completedAt today)
  const agentLeaderboard = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    const counts = new Map<string, number>();
    for (const t of allTasks) {
      if (!t.assignedTo) continue;
      // Count tasks that are done and updated today, or in-progress updated today
      const updatedToday = (typeof t.updatedAt === 'number' ? t.updatedAt : new Date(t.updatedAt).getTime()) >= todayTs;
      if (updatedToday && (t.status === 'done' || t.status === 'in-progress' || t.status === 'review')) {
        counts.set(t.assignedTo, (counts.get(t.assignedTo) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([agentId, count]) => ({ agentId, count }));
  }, [allTasks]);

  // Merge in-progress tasks and recent activity into a single feed, last 10 items
  const feedItems = useMemo(() => {
    const taskItems = inProgressTasks.map(t => ({
      id: `task-${t.id}`,
      kind: 'task' as const,
      task: t,
      timestamp: typeof t.updatedAt === 'number' ? t.updatedAt : new Date(t.updatedAt).getTime(),
    }));
    const activityItems = activities.slice(0, 10 - Math.min(taskItems.length, 4)).map(a => ({
      id: `activity-${a.id}`,
      kind: 'activity' as const,
      activity: a,
      timestamp: a.timestamp,
    }));
    return [...taskItems, ...activityItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }, [inProgressTasks, activities]);

  return (
    <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-xl border border-mission-control-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-mission-control-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          <h2 className="font-semibold text-sm">Activity Feed</h2>
          {inProgressTasks.length > 0 && (
            <span className="px-2 py-0.5 bg-info-subtle text-info text-xs font-medium rounded-full">
              {inProgressTasks.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate?.('kanban')}
          className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent-dim transition-colors"
        >
          All Tasks <ArrowRight size={12} />
        </button>
      </div>

      {/* Agent leaderboard — top 3 most active today */}
      {agentLeaderboard.length > 0 && (
        <div className="px-4 py-3 border-b border-mission-control-border/30 bg-mission-control-bg/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy size={12} className="text-amber-400" />
            <span className="text-[11px] font-semibold text-mission-control-text-dim uppercase tracking-wider">Most Active Today</span>
          </div>
          <div className="flex items-center gap-3">
            {agentLeaderboard.map(({ agentId, count }, idx) => {
              const agent = agentMap.get(agentId);
              const rankColors = ['text-amber-400', 'text-slate-400', 'text-amber-700'];
              return (
                <button
                  key={agentId}
                  onClick={() => onAgentClick?.(agentId)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-mission-control-surface/60 border border-mission-control-border hover:border-mission-control-accent/50 hover:bg-mission-control-accent/5 transition-all group flex-1 min-w-0"
                  title={`Open ${agent?.name || agentId} details`}
                >
                  <span className={`text-xs font-bold ${rankColors[idx]}`}>{idx + 1}</span>
                  <AgentAvatar agentId={agentId} fallbackEmoji={agent?.avatar} size="xs" />
                  <span className="text-xs font-medium text-mission-control-text truncate group-hover:text-mission-control-accent transition-colors">
                    {agent?.name || agentId}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-mission-control-text-dim flex-shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {feedItems.length === 0 ? (
          <div className="p-8 text-center">
            <Activity size={32} className="mx-auto mb-2 text-mission-control-text-dim/30" />
            <p className="text-sm text-mission-control-text-dim">No active work right now</p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border/20">
            {feedItems.map(item => {
              if (item.kind === 'task') {
                const task = item.task;
                const agent = agentMap.get(task.assignedTo ?? '');
                return (
                  <div
                    key={item.id}
                    className="px-4 py-3 hover:bg-mission-control-bg/30 transition-colors cursor-pointer"
                    onClick={() => onNavigate?.('kanban')}
                    onKeyDown={e => { if (e.key === 'Enter') onNavigate?.('kanban'); }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {agent ? (
                          <button
                            onClick={e => { e.stopPropagation(); onAgentClick?.(agent.id); }}
                            className="hover:opacity-80 transition-opacity"
                            title={`Open ${agent.name} details`}
                          >
                            <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="sm" />
                          </button>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-mission-control-border flex items-center justify-center">
                            <Bot size={12} className="text-mission-control-text-dim" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-mission-control-text-dim">
                          {agent ? (
                            <button
                              onClick={e => { e.stopPropagation(); onAgentClick?.(agent.id); }}
                              className="font-medium text-mission-control-text hover:text-mission-control-accent transition-colors"
                            >
                              {agent.name}
                            </button>
                          ) : (
                            <span className="font-medium text-mission-control-text">Agent</span>
                          )}
                          {' '}is working on{' '}
                          <span className="font-medium text-mission-control-text truncate">{task.title}</span>
                        </p>
                        <p className="text-xs text-mission-control-text-dim/60 mt-0.5">
                          {formatTimeAgo(item.timestamp)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="px-1.5 py-0.5 bg-info-subtle text-info text-[10px] font-medium rounded-full">
                          in progress
                        </span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const a = item.activity;
                const ActivityIcon = a.type === 'chat' ? MessageSquare
                  : a.type === 'task' ? Clipboard
                  : a.type === 'agent' ? Bot
                  : a.type === 'error' ? AlertTriangle
                  : Radio;
                return (
                  <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 p-1 rounded-md bg-mission-control-bg/50">
                      <ActivityIcon size={12} className="text-mission-control-text-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-mission-control-text-dim line-clamp-2">{a.message}</p>
                      {ACTIVITY_VERBS[a.type] && (
                        <p className="text-[10px] text-mission-control-text-dim/50 mt-0.5 uppercase tracking-wide">
                          {ACTIVITY_VERBS[a.type]}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-mission-control-text-dim/50 flex-shrink-0">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── TaskThroughputChart ────────────────────────────────────

function TaskThroughputChart({ tasks }: { tasks: Task[] }) {
  // Build last-7-days completed task counts (SVG bar chart, no external library)
  const chartData = useMemo(() => {
    const days: { label: string; date: Date; count: number; isToday: boolean }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 86400000;
      const isToday = i === 0;
      const count = tasks.filter(t => {
        if (t.status !== 'done') return false;
        const ts = t.completedAt ?? t.updatedAt;
        const tsNum = typeof ts === 'number' ? ts : (ts ? new Date(ts).getTime() : 0);
        return tsNum >= dayStart && tsNum < dayEnd;
      }).length;
      days.push({
        label: isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d,
        count,
        isToday,
      });
    }
    return days;
  }, [tasks]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);
  const chartH = 48; // px height of bar area
  const barW = 20;
  const gap = 6;
  const totalW = (barW + gap) * 7 - gap;

  return (
    <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-xl border border-mission-control-border overflow-hidden">
      <div className="p-4 border-b border-mission-control-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-violet-400" />
          <h2 className="font-semibold text-sm">Tasks Completed</h2>
          <span className="text-xs text-mission-control-text-dim">last 7 days</span>
        </div>
        <span className="text-xs font-semibold text-mission-control-text">
          {chartData.reduce((s, d) => s + d.count, 0)} total
        </span>
      </div>
      <div className="px-4 pt-4 pb-3">
        <svg
          width={totalW}
          height={chartH + 20}
          viewBox={`0 0 ${totalW} ${chartH + 20}`}
          className="w-full"
          style={{ maxWidth: totalW }}
          aria-label="Tasks completed per day"
        >
          {chartData.map((day, i) => {
            const barH = maxCount === 0 ? 2 : Math.max(2, Math.round((day.count / maxCount) * chartH));
            const x = i * (barW + gap);
            const y = chartH - barH;
            return (
              <g key={day.label}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={3}
                  fill={day.isToday ? 'var(--color-accent, #6366f1)' : day.count > 0 ? '#6366f130' : '#6366f115'}
                  stroke={day.isToday ? 'var(--color-accent, #6366f1)' : 'transparent'}
                  strokeWidth={day.isToday ? 1 : 0}
                />
                {day.count > 0 && (
                  <text
                    x={x + barW / 2}
                    y={y - 3}
                    textAnchor="middle"
                    fontSize={9}
                    fill={day.isToday ? 'var(--color-accent, #6366f1)' : 'var(--color-text-dim, #888)'}
                    fontWeight={day.isToday ? 'bold' : 'normal'}
                  >
                    {day.count}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={chartH + 15}
                  textAnchor="middle"
                  fontSize={9}
                  fill={day.isToday ? 'var(--color-accent, #6366f1)' : 'var(--color-text-dim, #888)'}
                  fontWeight={day.isToday ? 'bold' : 'normal'}
                >
                  {day.label === 'Today' ? 'Today' : day.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── TodaySchedule ──────────────────────────────────────────

function TodaySchedule({ onNavigate }: { onNavigate?: (view: View) => void }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const data = await res.json();
        const todayEvents = (data?.events || data || []) as CalendarEvent[];
        const sorted = todayEvents.sort((a: CalendarEvent, b: CalendarEvent) => {
          const aTime = a.start.dateTime || a.start.date || '';
          const bTime = b.start.dateTime || b.start.date || '';
          return aTime.localeCompare(bTime);
        });
        setEvents(sorted);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadEvents]);

  const formatTime = (event: CalendarEvent): string => {
    if (event.start.date && !event.start.dateTime) return 'All day';
    if (event.start.dateTime) {
      return new Date(event.start.dateTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    }
    return '';
  };

  const isNow = (event: CalendarEvent): boolean => {
    const start = event.start.dateTime;
    const end = event.end?.dateTime;
    if (!start || !end) return false;
    const now = Date.now();
    return now >= new Date(start).getTime() && now <= new Date(end).getTime();
  };

  const getMeetingLink = (event: CalendarEvent): string | null => {
    if (!event.conferenceData?.entryPoints) return null;
    const videoEntry = event.conferenceData.entryPoints.find(e =>
      e.entryPointType === 'video' || e.uri.includes('meet.google.com') || e.uri.includes('zoom.us')
    );
    return videoEntry?.uri || null;
  };

  // Pre-compute meeting links once per events change — avoids calling getMeetingLink per item in render
  const eventsWithLinks = useMemo(() =>
    events.map(e => ({ ...e, _link: getMeetingLink(e) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [events]);

  return (
    <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-xl border border-mission-control-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-mission-control-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" />
          <h2 className="font-semibold text-sm">Today&apos;s Schedule</h2>
        </div>
        <button
          onClick={() => onNavigate?.('schedule')}
          className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent-dim transition-colors"
        >
          Full Calendar <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px]">
        {loading ? (
          <div className="p-6 text-center">
            <Loader2 size={20} className="mx-auto mb-2 animate-spin text-mission-control-text-dim" />
            <p className="text-xs text-mission-control-text-dim">Loading events...</p>
          </div>
        ) : eventsWithLinks.length === 0 ? (
          <div className="p-6 text-center">
            <Calendar size={28} className="mx-auto mb-2 text-mission-control-text-dim/30" />
            <p className="text-sm text-mission-control-text-dim">No events today</p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border/30">
            {eventsWithLinks.slice(0, 6).map(event => {
              const happening = isNow(event);
              const meetingLink = event._link;
              return (
                <div
                  key={event.id}
                  className={`p-3 hover:bg-mission-control-bg/30 transition-colors ${
                    happening ? 'bg-info-subtle/30 border-l-2 border-l-blue-400' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-14 text-right flex-shrink-0 ${
                      happening ? 'text-blue-400 font-semibold' : 'text-mission-control-text-dim'
                    }`}>
                      <span className="text-xs">{formatTime(event)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${happening ? 'text-blue-400' : 'text-mission-control-text'}`}>
                        {event.summary}
                        {happening && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-bold">
                            NOW
                          </span>
                        )}
                      </p>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-mission-control-text-dim">
                          <MapPin size={10} />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    {meetingLink && (
                      <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1.5 bg-mission-control-accent/20 text-mission-control-accent rounded-lg hover:bg-mission-control-accent hover:text-white transition-all"
                        title="Join meeting"
                        onClick={e => e.stopPropagation()}
                      >
                        <Video size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {eventsWithLinks.length > 6 && (
              <div className="p-2 text-center">
                <button
                  onClick={() => onNavigate?.('schedule')}
                  className="text-xs text-mission-control-accent hover:underline"
                >
                  +{eventsWithLinks.length - 6} more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SystemHealth ───────────────────────────────────────────

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
  inProgressTasks: number;
}

interface TokenSummary {
  totalTokens: number;
  totalCost: number;
  topAgent?: string;
  topAgentTokens?: number;
}

function SystemHealth({ gatewaySessions, connected }: { gatewaySessions: GatewaySession[]; connected: boolean }) {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);

  const loadAll = useCallback(async () => {
    // System status
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const s: SystemStatus = {
          watcherRunning: data?.watcherRunning ?? true,
          killSwitchOn: data?.killSwitchOn ?? false,
          inProgressTasks: data?.inProgressTasks ?? 0,
        };
        setSysStatus(s);
      }
    } catch { /* ignore */ }

    // Token summary
    try {
      const res = await fetch('/api/analytics/token-usage?period=day');
      if (res.ok) {
        const result = await res.json();
        if (result?.by_agent && result.by_agent.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totalTokens = result.by_agent.reduce((sum: number, a: any) => sum + a.total_all, 0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totalCost = result.by_agent.reduce((sum: number, a: any) => sum + (a.total_cost || 0), 0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sorted = [...result.by_agent].sort((a: any, b: any) => b.total_all - a.total_all);
          setTokenSummary({
            totalTokens,
            totalCost,
            topAgent: sorted[0]?.agent,
            topAgentTokens: sorted[0]?.total_all,
          });
        } else {
          setTokenSummary({ totalTokens: 0, totalCost: 0 });
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const activeSessions = gatewaySessions.filter(s => s.isActive);
  const health = sysStatus
    ? sysStatus.killSwitchOn ? 'critical' : !sysStatus.watcherRunning ? 'warning' : 'healthy'
    : 'unknown';

  return (
    <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-xl border border-mission-control-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-mission-control-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className={
            health === 'healthy' ? 'text-emerald-400' :
            health === 'warning' ? 'text-yellow-400' :
            health === 'critical' ? 'text-red-400' :
            'text-mission-control-text-dim'
          } />
          <h2 className="font-semibold text-sm">System Health</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          health === 'healthy' ? 'text-emerald-400' :
          health === 'warning' ? 'text-yellow-400' :
          health === 'critical' ? 'text-red-400' :
          'text-mission-control-text-dim'
        }`}>
          {health === 'healthy' ? <CheckCircle size={12} /> :
           health === 'warning' ? <AlertTriangle size={12} /> :
           health === 'critical' ? <XCircle size={12} /> :
           <Loader2 size={12} className="animate-spin" />}
          {health === 'healthy' ? 'All Good' :
           health === 'warning' ? 'Warning' :
           health === 'critical' ? 'Critical' : 'Loading'}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Gateway */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-mission-control-text-dim">Gateway</span>
          <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Sessions */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-mission-control-text-dim">Active Sessions</span>
          <span className="text-mission-control-text">{activeSessions.length}</span>
        </div>

        {/* Watcher */}
        {sysStatus && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-mission-control-text-dim">Task Watcher</span>
              <span className={sysStatus.watcherRunning ? 'text-emerald-400' : 'text-red-400'}>
                {sysStatus.watcherRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-mission-control-text-dim">Safety Lock</span>
              <span className={sysStatus.killSwitchOn ? 'text-red-400' : 'text-emerald-400'}>
                {sysStatus.killSwitchOn ? 'Engaged' : 'Normal'}
              </span>
            </div>
          </>
        )}

        {/* Token usage */}
        {tokenSummary && (
          <div className="pt-3 border-t border-mission-control-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-mission-control-text-dim flex items-center gap-1">
                <Zap size={10} /> Tokens Today
              </span>
              <span className="text-mission-control-text font-medium">{formatTokens(tokenSummary.totalTokens)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-mission-control-text-dim flex items-center gap-1">
                <DollarSign size={10} /> Cost
              </span>
              <span className="text-mission-control-text font-medium">{formatCost(tokenSummary.totalCost)}</span>
            </div>
            {tokenSummary.topAgent && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-mission-control-text-dim">Top Agent</span>
                <span className="text-mission-control-text capitalize">
                  {tokenSummary.topAgent} ({formatTokens(tokenSummary.topAgentTokens || 0)})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────

export default function DashboardRedesigned({ onNavigate }: DashboardProps) {
  const connected = useStore(s => s.connected);
  const tasks = useStore(s => s.tasks);
  const agents = useStore(s => s.agents);
  const activities = useStore(s => s.activities);
  const approvals = useStore(s => s.approvals);
  const fetchAgents = useStore(s => s.fetchAgents);
  const gatewaySessions = useStore(s => s.gatewaySessions);
  const loadGatewaySessions = useStore(s => s.loadGatewaySessions);
  const approveItem = useStore(s => s.approveItem);
  const rejectItem = useStore(s => s.rejectItem);
  const loadApprovals = useStore(s => s.loadApprovals);

  // Load data on mount
  useEffect(() => {
    fetchAgents().catch(() => {});
    loadApprovals().catch(() => {});
  }, [fetchAgents, loadApprovals]);

  useEffect(() => {
    if (connected) {
      loadGatewaySessions().catch(() => {});
      const interval = setInterval(() => loadGatewaySessions().catch(() => {}), 30000);
      return () => clearInterval(interval);
    }
  }, [connected, loadGatewaySessions]);

  // Computed metrics — consolidated into grouped memos to reduce memo overhead
  const derived = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const reviewTasks = tasks.filter(t => t.status === 'review');
    const internalReviewTasks = tasks.filter(t => t.status === 'internal-review');
    const humanReviewTasks = tasks.filter(t => t.status === 'human-review');
    const realAgents = agents.filter(a => !PHANTOM_AGENTS.includes(a.id));
    const doneTodayCount = tasks.filter(t => {
      if (t.status !== 'done') return false;
      const ts = t.completedAt ?? t.updatedAt;
      const tsNum = typeof ts === 'number' ? ts : (ts ? new Date(ts).getTime() : 0);
      return tsNum >= todayTs;
    }).length;
    return { inProgressTasks, reviewTasks, internalReviewTasks, humanReviewTasks, realAgents, doneTodayCount };
  }, [tasks, agents]);

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals]);

  // Pre-sliced activities list — avoids re-slicing on every render
  const recentActivities = useMemo(() => activities.slice(0, 10), [activities]);

  // Agent lookup map — O(1) agent resolution instead of O(n) find() in render loops
  const agentMap = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);

  // Agents working on in-progress tasks
  const inProgressAgents = useMemo(() => {
    const agentIds = new Set(derived.inProgressTasks.map(t => t.assignedTo).filter(Boolean) as string[]);
    return Array.from(agentIds).map(id => agentMap.get(id)).filter(Boolean) as Agent[];
  }, [derived.inProgressTasks, agentMap]);

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-mission-control-bg to-mission-control-surface">
      {/* Header */}
      <HeaderBar connected={connected} />

      {/* Command Centre Stat Strip */}
      <StatStrip
        inProgressCount={derived.inProgressTasks.length}
        reviewCount={derived.reviewTasks.length}
        internalReviewCount={derived.internalReviewTasks.length}
        humanReviewCount={derived.humanReviewTasks.length}
        doneTodayCount={derived.doneTodayCount}
        inProgressAgents={inProgressAgents}
        onNavigate={onNavigate}
      />

      {/* Quick Actions */}
      <QuickActionsRow onNavigate={onNavigate} />

      {/* Main content: Approvals + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 sm:px-6 pb-4">
        <ApprovalsQueue
          approvals={approvals}
          onApprove={approveItem}
          onReject={rejectItem}
          onNavigate={onNavigate}
        />
        <ActivityFeed
          inProgressTasks={derived.inProgressTasks}
          agentMap={agentMap}
          activities={recentActivities}
          allTasks={tasks}
          onNavigate={onNavigate}
        />
      </div>

      {/* Bottom row: Schedule + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 sm:px-6 pb-6">
        <TodaySchedule onNavigate={onNavigate} />
        <SystemHealth gatewaySessions={gatewaySessions} connected={connected} />
      </div>
    </div>
  );
}
