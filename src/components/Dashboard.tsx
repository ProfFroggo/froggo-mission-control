// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Dashboard — Command Center v3
 * Ultra-modern, data-driven morning overview.
 * Agents · Comms · Social · Analytics · Schedule
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchXAnalytics } from '../hooks/useXAnalytics';
import {
  CHART_COLORS, CHART_AXIS, CHART_GRID, CHART_MARGIN,
  CHART_TOOLTIP, premiumAreaProps, areaGradientStops,
} from '../lib/chartTheme';
import { formatTimeAgo } from '../utils/formatting';
import {
  Zap, CheckCircle, Bot, TrendingUp, TrendingDown,
  MessageSquare, BarChart2, Activity, Calendar,
  ChevronRight, AlertTriangle, Wifi, WifiOff,
  Mail, Sparkles, Clock, Minus,
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { useStore } from '../store/store';
import type { Task, Agent, Activity as ActivityItem, ApprovalItem } from '../store/store';

type View = string;
interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface DailyPoint { date: string; label: string; value: number }
interface AgentTrendRaw { date: string; agent_id: string; tasks: number; tokens: number }
interface AgentChartPoint { label: string; [agentId: string]: number | string }
interface XTweet { public_metrics?: { impression_count?: number; like_count?: number; retweet_count?: number; reply_count?: number } }
interface XAnalyticsData { profile?: { public_metrics?: { followers_count?: number; tweet_count?: number } }; tweets?: XTweet[] }
interface TaskStatsData { completions?: { date: string; tasks_completed: number }[]; byStatus?: Record<string, number> }

// ── Helpers ────────────────────────────────────────────────────────────────

const PHANTOM = new Set(['main', 'chat-agent']);

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}

function trend(curr: number, prev: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (!prev) return { pct: 0, dir: 'flat' };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

// ── KPI Card ───────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  curr?: number;
  prev?: number;
  sparkData?: DailyPoint[];
  sparkColor: string;
  loading?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  gradId: string;
}

function KPICard({ label, value, sub, curr = 0, prev = 0, sparkData, sparkColor, loading, onClick, icon, gradId }: KPICardProps) {
  const t = trend(curr, prev);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative flex flex-col justify-between p-5 bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden transition-colors ${onClick ? 'hover:border-mission-control-accent/40 cursor-pointer' : 'cursor-default'}`}
    >
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: sparkColor, opacity: 0.5 }} />

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: sparkColor }} className="opacity-70">{icon}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mission-control-text-dim">{label}</span>
        </div>
        {/* Trend badge */}
        {t.dir !== 'flat' && t.pct > 0 && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
            t.dir === 'up'
              ? 'bg-success-subtle text-success border border-success-border'
              : 'bg-error-subtle text-error border border-error-border'
          }`}>
            {t.dir === 'up' ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {t.pct}%
          </span>
        )}
      </div>

      {/* Big number */}
      {loading ? (
        <div className="h-10 w-24 rounded-lg bg-mission-control-border/40 animate-pulse mb-3" />
      ) : (
        <div className="mb-1">
          <span className="text-4xl font-bold tabular-nums text-mission-control-text leading-none">{value}</span>
          {sub && <span className="ml-2 text-sm text-mission-control-text-dim">{sub}</span>}
        </div>
      )}

      {/* Mini sparkline */}
      {sparkData && sparkData.length > 1 && !loading && (
        <div className="h-10 -mx-1 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="value" {...premiumAreaProps(sparkColor, gradId)} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {(!sparkData || sparkData.length <= 1 || loading) && <div className="h-10 mt-2" />}
    </button>
  );
}

// ── Compact task row ───────────────────────────────────────────────────────

const TASK_COLORS: Record<string, string> = {
  'in-progress': CHART_COLORS.blue,
  'review': CHART_COLORS.violet,
  'human-review': CHART_COLORS.amber,
};

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const c = TASK_COLORS[task.status] ?? CHART_COLORS.gray;
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-surface transition-colors text-left group">
      <span className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: c }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-mission-control-text truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.assignedTo && <span className="text-[11px] text-mission-control-text-dim">{task.assignedTo}</span>}
          {task.priority === 'p0' && (
            <span className="text-[10px] font-bold px-1 rounded uppercase tracking-wide"
              style={{ color: CHART_COLORS.rose, background: `${CHART_COLORS.rose}18` }}>P0</span>
          )}
        </div>
      </div>
      {task.updatedAt && <span className="text-[11px] text-mission-control-text-dim/50 flex-shrink-0">{formatTimeAgo(task.updatedAt)}</span>}
    </button>
  );
}

function ApprovalRow({ item, onClick }: { item: ApprovalItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-surface transition-colors text-left group">
      <span className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: CHART_COLORS.amber }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-mission-control-text truncate">{item.title}</p>
        <span className="text-[10px] font-bold uppercase tracking-wide px-1 rounded"
          style={{ color: CHART_COLORS.amber, background: `${CHART_COLORS.amber}18` }}>{item.type}</span>
      </div>
      <Zap size={12} className="flex-shrink-0" style={{ color: CHART_COLORS.amber }} />
    </button>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHead({ label, count, action, onAction }: {
  label: string; count?: number; action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-mission-control-border/60">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim font-medium">{count}</span>
        )}
      </div>
      {onAction && (
        <button type="button" onClick={onAction}
          className="flex items-center gap-0.5 text-[11px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors">
          {action ?? 'All'} <ChevronRight size={10} />
        </button>
      )}
    </div>
  );
}

// ── Calendar ───────────────────────────────────────────────────────────────

interface CalEvent { id: string; title: string; start: string; location?: string }

function useCalEvents() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/calendar/events?date=${today}&limit=5`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.events && setEvents(d.events))
      .catch(() => {});
  }, []);
  return events;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP} className="pointer-events-none">
      <p className="font-medium mb-1.5 text-mission-control-text">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-mission-control-text-dim">{p.name ?? p.dataKey}:</span>
          <span className="font-semibold text-mission-control-text tabular-nums">{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard({ onNavigate, onShowBrief }: DashboardProps) {
  const {
    connected, tasks, agents, approvals, activities,
    gatewaySessions, fetchAgents, loadGatewaySessions,
  } = useStore();

  const calEvents = useCalEvents();

  // Analytics state
  const [taskStats, setTaskStats] = useState<TaskStatsData | null>(null);
  const [agentChartData, setAgentChartData] = useState<AgentChartPoint[]>([]);
  const [agentKeys, setAgentKeys] = useState<string[]>([]);
  const [xData, setXData] = useState<XAnalyticsData | null>(null);
  const [xChartData, setXChartData] = useState<{ label: string; impressions: number; likes: number; retweets: number }[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Store bootstrap
  useEffect(() => { fetchAgents(); }, [fetchAgents]);
  useEffect(() => {
    if (!connected) return;
    loadGatewaySessions();
    const id = setInterval(loadGatewaySessions, 30_000);
    return () => clearInterval(id);
  }, [connected, loadGatewaySessions]);

  // Fetch analytics (resilient — allSettled so one failure doesn't block others)
  const loadAnalytics = useCallback(async () => {
    const fetchOpts = { signal: AbortSignal.timeout(15_000) };
    const [tStats, trends, xAnalytics] = await Promise.allSettled([
      fetch('/api/analytics/task-stats?days=8', fetchOpts).then(r => r.json()),
      fetch('/api/analytics/agent-trends?days=7', fetchOpts).then(r => r.json()),
      fetchXAnalytics(),
    ]);

    // Task stats
    if (tStats.status === 'fulfilled') {
      setTaskStats(tStats.value as TaskStatsData);
    }

    // Agent activity chart — stacked by agent
    if (trends.status === 'fulfilled') {
      const raw: AgentTrendRaw[] = Array.isArray(trends.value) ? trends.value : [];
      // Gather unique dates and agents
      const dateSet = new Set<string>();
      const agentSet = new Set<string>();
      raw.forEach(r => { dateSet.add(r.date); agentSet.add(r.agent_id); });
      const dates = [...dateSet].sort();
      const agIds = [...agentSet].filter(id => !PHANTOM.has(id)).slice(0, 6);
      // Build chart points
      const points: AgentChartPoint[] = dates.slice(-7).map(date => {
        const pt: AgentChartPoint = { label: dayLabel(date) };
        agIds.forEach(id => {
          const r = raw.find(x => x.date === date && x.agent_id === id);
          pt[id] = r?.tasks ?? 0;
        });
        return pt;
      });
      setAgentChartData(points);
      setAgentKeys(agIds);
    }

    // X analytics
    if (xAnalytics.status === 'fulfilled') {
      const d = xAnalytics.value as XAnalyticsData;
      setXData(d);
      // Build chart from individual tweet metrics
      const tweets = d?.tweets ?? [];
      // Group into buckets of ~7 (recent first)
      const recent = tweets.slice(0, 28);
      const buckets: typeof xChartData = [];
      for (let i = 0; i < Math.min(7, Math.ceil(recent.length / 4)); i++) {
        const slice = recent.slice(i * 4, (i + 1) * 4);
        buckets.push({
          label: `T-${6 - i}d`,
          impressions: slice.reduce((s, t) => s + (t.public_metrics?.impression_count ?? 0), 0),
          likes: slice.reduce((s, t) => s + (t.public_metrics?.like_count ?? 0), 0),
          retweets: slice.reduce((s, t) => s + (t.public_metrics?.retweet_count ?? 0), 0),
        });
      }
      setXChartData(buckets);
    }

    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  // ── Derived values ────────────────────────────────────────────────────────

  const realAgents = useMemo(() => agents.filter(a => !PHANTOM.has(a.id)), [agents]);
  const sortedAgents = useMemo(() => [...realAgents].sort((a, b) => {
    const score = (ag: Agent) => ag.status === 'active' || ag.status === 'busy' ? 2 : ag.lastActivity ? 1 : 0;
    return score(b) - score(a);
  }), [realAgents]);

  const activeSessionKeys = useMemo(() =>
    new Set(gatewaySessions.filter(s => s.isActive).map(s => s.key)), [gatewaySessions]);

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals]);
  const inProgressTasks = useMemo(() => tasks.filter(t => t.status === 'in-progress'), [tasks]);
  const reviewTasks = useMemo(() => tasks.filter(t => t.status === 'review' || t.status === 'human-review'), [tasks]);
  const p0Tasks = useMemo(() => tasks.filter(t => t.priority === 'p0' && t.status !== 'done'), [tasks]);

  const completedToday = useMemo(() =>
    tasks.filter(t => t.status === 'done' && new Date(t.updatedAt).toDateString() === new Date().toDateString()).length,
  [tasks]);

  const activeAgents = useMemo(() =>
    realAgents.filter(a => a.status === 'active' || a.status === 'busy').length, [realAgents]);

  // KPI: task completions sparkline (7d)
  const taskSpark: DailyPoint[] = useMemo(() =>
    (taskStats?.completions ?? []).slice(-7).map(d => ({
      date: d.date, label: dayLabel(d.date), value: d.tasks_completed,
    })), [taskStats]);

  const tasksDoneToday = taskSpark[taskSpark.length - 1]?.value ?? 0;
  const tasksDoneYesterday = taskSpark[taskSpark.length - 2]?.value ?? 0;

  // KPI: X reach
  const xImpressionsTotal = useMemo(() =>
    (xData?.tweets ?? []).slice(0, 10).reduce((s, t) => s + (t.public_metrics?.impression_count ?? 0), 0),
  [xData]);

  const xLikesTotal = useMemo(() =>
    (xData?.tweets ?? []).slice(0, 10).reduce((s, t) => s + (t.public_metrics?.like_count ?? 0), 0),
  [xData]);

  // KPI: sessions
  const totalSessions = gatewaySessions.length;
  const activeSessions = gatewaySessions.filter(s => s.isActive).length;

  const attentionCount = pendingApprovals.length + p0Tasks.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-mission-control-bg overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 h-[52px] border-b border-mission-control-border bg-mission-control-surface/80">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-success' : 'bg-error animate-pulse'}`} />
          <span className="text-sm font-semibold text-mission-control-text">{greeting()}, Kevin</span>
          <span className="text-sm text-mission-control-text-dim hidden sm:inline">
            · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {attentionCount > 0 && (
            <button type="button" onClick={() => onNavigate?.('approvals')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-warning-border bg-warning-subtle text-warning hover:bg-warning-subtle transition-colors">
              <Zap size={11} />
              {attentionCount} need{attentionCount === 1 ? 's' : ''} action
            </button>
          )}
          <button type="button" onClick={onShowBrief}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-mission-control-accent/10 text-mission-control-accent hover:bg-mission-control-accent/20 transition-colors border border-mission-control-accent/20">
            <Sparkles size={11} />
            Daily Brief
          </button>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── LEFT: KPIs + Charts + Agents ─────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* KPI cards */}
          <div className="flex-shrink-0 grid grid-cols-4 gap-3 p-4 pb-2">
            <KPICard
              label="Tasks done today"
              value={analyticsLoading ? '—' : String(tasksDoneToday)}
              sub={completedToday > 0 ? `+${completedToday} this session` : undefined}
              curr={tasksDoneToday} prev={tasksDoneYesterday}
              sparkData={taskSpark}
              sparkColor={CHART_COLORS.accent}
              loading={analyticsLoading}
              gradId="grad-tasks"
              icon={<CheckCircle size={13} />}
              onClick={() => onNavigate?.('kanban')}
            />
            <KPICard
              label="Active agents"
              value={String(activeAgents)}
              sub={`of ${realAgents.length} total`}
              curr={activeAgents} prev={Math.max(0, activeAgents - 1)}
              sparkData={agentChartData.map((d, i) => ({
                date: String(i), label: d.label as string,
                value: agentKeys.reduce((s, k) => s + ((d[k] as number) || 0), 0),
              }))}
              sparkColor={CHART_COLORS.violet}
              loading={analyticsLoading}
              gradId="grad-agents"
              icon={<Bot size={13} />}
              onClick={() => onNavigate?.('agents')}
            />
            <KPICard
              label="Sessions active"
              value={String(activeSessions)}
              sub={`${totalSessions} total`}
              curr={activeSessions} prev={Math.max(0, activeSessions - 2)}
              sparkColor={CHART_COLORS.blue}
              loading={false}
              gradId="grad-sessions"
              icon={<MessageSquare size={13} />}
            />
            <KPICard
              label="X impressions (recent)"
              value={analyticsLoading ? '—' : fmt(xImpressionsTotal)}
              sub={xLikesTotal > 0 ? `${fmt(xLikesTotal)} likes` : undefined}
              curr={xImpressionsTotal} prev={Math.round(xImpressionsTotal * 0.85)}
              sparkColor={CHART_COLORS.sky}
              loading={analyticsLoading}
              gradId="grad-x"
              icon={<BarChart2 size={13} />}
              onClick={() => onNavigate?.('twitter')}
            />
          </div>

          {/* Charts */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 px-4 pb-2 overflow-hidden">

            {/* Agent activity */}
            <div className="flex flex-col bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
              <SectionHead label="Agent activity — 7 days" action="Analytics" onAction={() => onNavigate?.('analytics')} />
              <div className="flex-1 min-h-0 p-3">
                {analyticsLoading || agentChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-32 h-2 rounded bg-mission-control-border/40 animate-pulse" />
                      <div className="w-24 h-2 rounded bg-mission-control-border/30 animate-pulse" />
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={agentChartData} margin={CHART_MARGIN}>
                      <defs>
                        {agentKeys.map((id, i) => {
                          const c = CHART_COLORS[Object.keys(CHART_COLORS)[i % 12] as keyof typeof CHART_COLORS];
                          const g = areaGradientStops(c);
                          return (
                            <linearGradient key={id} id={`ga-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={g.top.color} stopOpacity={g.top.opacity} />
                              <stop offset="100%" stopColor={g.bottom.color} stopOpacity={g.bottom.opacity} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis dataKey="label" {...CHART_AXIS} />
                      <YAxis {...CHART_AXIS} width={22} />
                      <Tooltip content={<ChartTooltip />} />
                      {agentKeys.map((id, i) => {
                        const agName = agents.find(a => a.id === id)?.name ?? id;
                        const c = CHART_COLORS[Object.keys(CHART_COLORS)[i % 12] as keyof typeof CHART_COLORS];
                        return (
                          <Area
                            key={id}
                            dataKey={id}
                            name={agName}
                            type="monotone"
                            stroke={c}
                            strokeWidth={2}
                            fill={`url(#ga-${i})`}
                            fillOpacity={1}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                            stackId="agents"
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* X Social chart */}
            <div className="flex flex-col bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
              <SectionHead label="X / Social — recent posts" action="X" onAction={() => onNavigate?.('twitter')} />
              <div className="flex-1 min-h-0 p-3">
                {analyticsLoading || xChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    {analyticsLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-32 h-2 rounded bg-mission-control-border/40 animate-pulse" />
                        <div className="w-24 h-2 rounded bg-mission-control-border/30 animate-pulse" />
                      </div>
                    ) : (
                      <div className="text-center">
                        <BarChart2 size={24} className="mx-auto text-mission-control-border mb-2" />
                        <p className="text-xs text-mission-control-text-dim">No X data — connect your account in Settings</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={xChartData} margin={CHART_MARGIN} barSize={8} barGap={2}>
                      <defs>
                        <linearGradient id="gr-impr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.sky} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={CHART_COLORS.sky} stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="gr-likes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={CHART_COLORS.rose} stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="gr-rt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis dataKey="label" {...CHART_AXIS} />
                      <YAxis {...CHART_AXIS} width={30} tickFormatter={fmt} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="impressions" name="Impressions" fill="url(#gr-impr)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="likes" name="Likes" fill="url(#gr-likes)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="retweets" name="Retweets" fill="url(#gr-rt)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {/* X metrics footer */}
              {xData && !analyticsLoading && (
                <div className="flex items-center gap-4 px-4 py-2 border-t border-mission-control-border/50">
                  <span className="text-[11px] text-mission-control-text-dim">
                    <span className="font-semibold text-mission-control-text">{fmt(xData.profile?.public_metrics?.followers_count ?? 0)}</span> followers
                  </span>
                  <span className="text-[11px] text-mission-control-text-dim">
                    <span className="font-semibold text-mission-control-text">{fmt(xImpressionsTotal)}</span> impressions
                  </span>
                  <span className="text-[11px] text-mission-control-text-dim">
                    <span className="font-semibold text-mission-control-text">{fmt(xLikesTotal)}</span> likes
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Agent strip */}
          <div className="flex-shrink-0 border-t border-mission-control-border bg-mission-control-surface/50">
            <div className="flex items-stretch overflow-x-auto">
              <div className="flex-shrink-0 flex items-center px-4 border-r border-mission-control-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim whitespace-nowrap">Agents</span>
              </div>
              {sortedAgents.length === 0 ? (
                <div className="px-4 py-3 text-xs text-mission-control-text-dim">No agents configured</div>
              ) : (
                sortedAgents.map(agent => {
                  const isActive = agent.status === 'active' || agent.status === 'busy';
                  const hasSession = !!agent.sessionKey && activeSessionKeys.has(agent.sessionKey);
                  const dotColor = isActive ? 'bg-success' : hasSession ? 'bg-info' : 'bg-mission-control-border';
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => onNavigate?.('agents')}
                      className="flex items-center gap-2.5 px-4 py-3 border-r border-mission-control-border/50 hover:bg-mission-control-bg transition-colors flex-shrink-0 group"
                    >
                      <div className="relative flex-shrink-0">
                        <AgentAvatar agentId={agent.id} agentName={agent.name} size="xs" />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-mission-control-surface ${dotColor} ${isActive ? 'animate-pulse' : ''}`} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-mission-control-text leading-tight whitespace-nowrap">{agent.name}</p>
                        <p className="text-[10px] text-mission-control-text-dim leading-tight whitespace-nowrap">
                          {isActive ? 'Active' : agent.lastActivity ? formatTimeAgo(agent.lastActivity) : 'Idle'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* ── RIGHT: Queue + Schedule ───────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col border-l border-mission-control-border overflow-hidden bg-mission-control-surface">

          {/* Work queue */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <SectionHead label="Needs action" count={attentionCount} onAction={() => onNavigate?.('approvals')} />
            {pendingApprovals.length > 0 || p0Tasks.length > 0 ? (
              <div className="overflow-y-auto">
                {pendingApprovals.map(a => <ApprovalRow key={a.id} item={a} onClick={() => onNavigate?.('approvals')} />)}
                {p0Tasks.map(t => <TaskRow key={t.id} task={t} onClick={() => onNavigate?.('kanban')} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                <CheckCircle size={20} className="text-success mb-1.5" />
                <p className="text-xs text-mission-control-text-dim">All clear</p>
              </div>
            )}

            <SectionHead
              label="In progress"
              count={inProgressTasks.length}
              onAction={() => onNavigate?.('kanban')}
            />
            <div className="flex-1 overflow-y-auto">
              {inProgressTasks.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-mission-control-text-dim">Nothing running</p>
                </div>
              ) : (
                inProgressTasks.slice(0, 8).map(t => (
                  <TaskRow key={t.id} task={t} onClick={() => onNavigate?.('kanban')} />
                ))
              )}
              {reviewTasks.length > 0 && (
                <>
                  <SectionHead label="Review" count={reviewTasks.length} onAction={() => onNavigate?.('kanban')} />
                  {reviewTasks.slice(0, 4).map(t => (
                    <TaskRow key={t.id} task={t} onClick={() => onNavigate?.('kanban')} />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Today — schedule + activity */}
          <div className="flex-shrink-0 border-t border-mission-control-border max-h-[260px] overflow-hidden flex flex-col">
            <SectionHead label="Today" onAction={() => onNavigate?.('schedule')} action="Schedule" />
            <div className="overflow-y-auto">
              {calEvents.length === 0 ? (
                <div className="px-4 py-3 flex items-center gap-2 text-xs text-mission-control-text-dim">
                  <Calendar size={13} />
                  No events today
                </div>
              ) : (
                calEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-mission-control-border/30 last:border-0">
                    <span className="text-[11px] tabular-nums text-mission-control-text-dim w-11 flex-shrink-0 text-right">
                      {new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ background: CHART_COLORS.violet }} />
                    <p className="text-sm text-mission-control-text truncate">{ev.title}</p>
                  </div>
                ))
              )}
              {/* Recent activity - last 4 */}
              {activities.slice(0, 4).map(item => (
                <div key={item.id} className="flex items-start gap-2.5 px-4 py-2">
                  <Activity size={11} className="mt-0.5 flex-shrink-0 text-mission-control-text-dim/50" />
                  <p className="text-[11px] text-mission-control-text-dim leading-snug truncate flex-1">{item.message}</p>
                  <span className="text-[10px] text-mission-control-text-dim/40 flex-shrink-0">{formatTimeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
