import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  MessageSquare,
  Zap,
  Clock,
  Calendar,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Users,
  FolderKanban,
  CheckCircle,
  PlusCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Flex } from '@radix-ui/themes';
import { analyticsApi, taskApi, inboxApi, sessionApi, agentApi } from '../lib/api';
import { createLogger } from '../utils/logger';
import { CHART_COLORS, CHART_GRID, CHART_AXIS, CHART_MARGIN } from '../lib/chartTheme';
import ChartTooltip from './charts/ChartTooltip';

const logger = createLogger('Analytics');

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────

interface Stat {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: any;
  color: string;
}

interface DailyActivity {
  date: string;
  label: string;
  completed: number;
  created: number;
}

interface AgentData {
  agent: string;
  total: number;
  completed: number;
}

interface ProjectData {
  project: string;
  total: number;
  completed: number;
  completion_rate: number;
}

/** One bar in the 14-day pipeline velocity chart */
interface VelocityDay {
  date: string;
  dayLabel: string;   // e.g. "Mon"
  count: number;
}

/** Row in the agent performance leaderboard */
interface AgentLeaderboardRow {
  id: string;
  name: string;
  color: string;
  tasksDone: number;
  tasksInProgress: number;
  avgCompletionMs: number | null;
  online: boolean;
}

/** Slice in the status donut */
interface StatusSlice {
  status: string;
  label: string;
  count: number;
  color: string;
}

// ──────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  'todo':             { label: 'Todo',           color: CHART_COLORS.gray   },
  'internal-review':  { label: 'Pre-review',     color: CHART_COLORS.amber  },
  'in-progress':      { label: 'In Progress',    color: CHART_COLORS.blue   },
  'review':           { label: 'Review',         color: CHART_COLORS.violet },
  'done':             { label: 'Done',           color: CHART_COLORS.accent },
  'human-review':     { label: 'Human Review',   color: CHART_COLORS.orange },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ──────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────

/** 14-day pipeline velocity — pure SVG bar chart */
function PipelineVelocityChart({ days }: { days: VelocityDay[] }) {
  const chartWidth  = 560;
  const chartHeight = 160;
  const padLeft     = 24;
  const padBottom   = 20;
  const innerW      = chartWidth - padLeft;
  const innerH      = chartHeight - padBottom;
  const n           = 14;
  const barW        = Math.floor(innerW / n) - 2;
  const maxVal      = Math.max(...days.map((d) => d.count), 1);

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="h-full"
      style={{ overflow: 'visible' }}
      aria-label="14-day pipeline velocity"
    >
      {/* Y-axis max label */}
      <text
        x={padLeft - 4}
        y={6}
        textAnchor="end"
        fontSize={9}
        fill="var(--mission-control-text-dim)"
      >
        {maxVal}
      </text>

      {days.map((day, idx) => {
        const barH  = maxVal > 0 ? Math.max(2, (day.count / maxVal) * innerH) : 2;
        const x     = padLeft + idx * (innerW / n) + 1;
        const y     = innerH - barH;

        return (
          <g key={day.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill="var(--mission-control-accent)"
              opacity={day.count === 0 ? 0.08 : 0.85}
              rx={2}
            >
              <title>{`${day.date}: ${day.count} completed`}</title>
            </rect>
            {/* X-axis day label — show every other to avoid crowding */}
            {idx % 2 === 0 && (
              <text
                x={x + barW / 2}
                y={innerH + 14}
                textAnchor="middle"
                fontSize={8}
                fill="var(--mission-control-text-dim)"
              >
                {day.dayLabel}
              </text>
            )}
          </g>
        );
      })}

      {/* Baseline */}
      <line
        x1={padLeft}
        y1={innerH}
        x2={chartWidth}
        y2={innerH}
        stroke="var(--mission-control-border)"
        strokeWidth={1}
      />
    </svg>
  );
}

/** SVG donut chart for task status distribution */
function StatusDonutChart({ slices }: { slices: StatusSlice[] }) {
  const total     = slices.reduce((s, sl) => s + sl.count, 0);
  const r         = 50;
  const cx        = 65;
  const cy        = 65;
  const stroke    = 18;
  const circ      = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-mission-control-text-dim">
        No task data
      </div>
    );
  }

  let offset = 0;
  const arcs = slices
    .filter((sl) => sl.count > 0)
    .map((sl) => {
      const pct   = sl.count / total;
      const dash  = pct * circ;
      const arc   = { ...sl, dash, offset: circ - offset, pct };
      offset += dash;
      return arc;
    });

  return (
    <div className="space-y-4">
      {/* Horizontal bar breakdown */}
      <div className="flex rounded-full overflow-hidden h-3" title={`${total} total tasks`}>
        {arcs.map((arc) => (
          <div
            key={arc.status}
            className="h-full transition-colors"
            style={{ width: `${arc.pct * 100}%`, backgroundColor: arc.color }}
            title={`${arc.label}: ${arc.count} (${Math.round(arc.pct * 100)}%)`}
          />
        ))}
      </div>

      {/* Legend rows with counts + percentages */}
      <div className="space-y-2">
        {arcs.map((arc) => (
          <Flex key={arc.status} align="center" gap="3">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: arc.color }} />
            <span className="text-sm text-mission-control-text flex-1">{arc.label}</span>
            <span className="text-sm font-medium tabular-nums text-mission-control-text">{arc.count}</span>
            <span className="text-xs tabular-nums text-mission-control-text-dim w-10 text-right">{Math.round(arc.pct * 100)}%</span>
          </Flex>
        ))}
        <Flex align="center" gap="3" className="pt-2 border-t border-mission-control-border">
          <span className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="text-sm font-medium text-mission-control-text-dim flex-1">Total</span>
          <span className="text-sm font-bold tabular-nums text-mission-control-text">{total}</span>
          <span className="text-xs tabular-nums text-mission-control-text-dim w-10 text-right">100%</span>
        </Flex>
      </div>
    </div>
  );

}

/** Agent performance leaderboard table */
function AgentLeaderboard({ rows }: { rows: AgentLeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-mission-control-text-dim py-6 text-center">
        No agent task data available
      </div>
    );
  }

  function fmtDuration(ms: number | null): string {
    if (ms === null || ms <= 0) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return '<1m';
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-mission-control-text-dim border-b border-mission-control-border">
            <th className="text-left pb-2 font-medium">Agent</th>
            <th className="text-right pb-2 font-medium">Done this wk</th>
            <th className="text-right pb-2 font-medium">In progress</th>
            <th className="text-right pb-2 font-medium">Avg time</th>
            <th className="text-right pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-border/40 transition-colors"
            >
              <td className="py-2.5">
                <Flex align="center" gap="2">
                  <span
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: row.color || 'var(--mission-control-accent)' }}
                  >
                    {row.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[120px]">{row.name}</span>
                </Flex>
              </td>
              <td className="py-2.5 text-right font-medium text-[var(--color-success)] tabular-nums">{row.tasksDone}</td>
              <td className="py-2.5 text-right tabular-nums">{row.tasksInProgress}</td>
              <td className="py-2.5 text-right tabular-nums text-mission-control-text-dim">
                {fmtDuration(row.avgCompletionMs)}
              </td>
              <td className="py-2.5 text-right">
                {row.online ? (
                  <span className="inline-flex items-center gap-1 text-[var(--color-success)] text-xs">
                    <Wifi size={11} />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-mission-control-text-dim text-xs">
                    <WifiOff size={11} />
                    Offline
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Fill-gap helper (kept from original)
// ──────────────────────────────────────────────────

function fillDateRange(
  data: { date: string; [key: string]: any }[],
  days: number,
  valueKey: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of data) {
    if (row.date && row.date !== '1970-01-01') {
      map.set(row.date, row[valueKey] || 0);
    }
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    if (!map.has(key)) map.set(key, 0);
  }
  return map;
}

// ──────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────

export default function AnalyticsOverview({ days = 30 }: { days?: number }) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [dailyData, setDailyData] = useState<DailyActivity[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [_loading, setLoading] = useState(false);

  // New state for the four new panels
  const [velocityDays, setVelocityDays] = useState<VelocityDay[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentLeaderboardRow[]>([]);
  const [statusSlices, setStatusSlices] = useState<StatusSlice[]>([]);

  // Weekly summary
  const [weekDone, setWeekDone]         = useState(0);
  const [prevWeekDone, setPrevWeekDone] = useState(0);
  const [weekCreated, setWeekCreated]   = useState(0);
  const [agentUtil, setAgentUtil]       = useState<{ active: number; total: number }>({ active: 0, total: 0 });

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const analyticsResult = await analyticsApi
        .getTaskStats()
        .catch((err: any) => { logger.error('Failed to get analytics data:', err); return null; });

      const sessionsResult = await sessionApi
        .getAll()
        .catch((err: any) => { logger.error('Failed to list sessions:', err); return null; });
      const sessionsCount = Array.isArray(sessionsResult) ? sessionsResult.length : 0;

      const tasksResult = await taskApi
        .getAll()
        .catch((err: any) => { logger.error('Failed to list tasks:', err); return null; });
      const tasksArr: any[] = Array.isArray(tasksResult)
        ? tasksResult
        : (tasksResult as any)?.tasks || [];

      const inboxResult = await inboxApi
        .getAll()
        .catch((err: any) => { logger.error('Failed to list inbox:', err); return null; });
      const inboxArr: any[] = Array.isArray(inboxResult)
        ? inboxResult
        : (inboxResult as any)?.items || [];
      const pendingApprovals = inboxArr.filter((i: any) => i.status === 'pending').length;

      const agentsResult = await agentApi
        .getAll()
        .catch((err: any) => { logger.error('Failed to list agents:', err); return null; });
      const agentsArr: any[] = Array.isArray(agentsResult) ? agentsResult : [];

      // ── Status distribution ──────────────────────────
      const slices: StatusSlice[] = Object.entries(STATUS_META).map(([status, meta]) => ({
        status,
        label: meta.label,
        color: meta.color,
        count: tasksArr.filter((t: any) => t.status === status).length,
      }));
      setStatusSlices(slices);

      // ── 14-day velocity ──────────────────────────────
      const now = new Date();
      const velocity: VelocityDay[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = isoDate(d);
        velocity.push({
          date: key,
          dayLabel: DAY_NAMES[d.getDay()],
          count: 0,
        });
      }
      // Count done tasks by completedAt / updatedAt date
      for (const task of tasksArr) {
        if (task.status !== 'done') continue;
        const raw = task.completedAt || task.updatedAt || task.updated_at;
        if (!raw) continue;
        const key = isoDate(new Date(raw));
        const slot = velocity.find((v) => v.date === key);
        if (slot) slot.count++;
      }
      setVelocityDays(velocity);

      // ── Weekly summary ───────────────────────────────
      const thisWeekStart = startOfWeek(now);
      const prevWeekStart = new Date(thisWeekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(thisWeekStart);
      prevWeekEnd.setMilliseconds(-1);

      let wDone = 0;
      let pwDone = 0;
      let wCreated = 0;

      for (const task of tasksArr) {
        // Done this week
        if (task.status === 'done') {
          const raw = task.completedAt || task.updatedAt || task.updated_at;
          if (raw) {
            const d = new Date(raw);
            if (d >= thisWeekStart) wDone++;
            else if (d >= prevWeekStart && d <= prevWeekEnd) pwDone++;
          }
        }
        // Created this week
        const created = task.createdAt || task.created_at;
        if (created && new Date(created) >= thisWeekStart) wCreated++;
      }

      setWeekDone(wDone);
      setPrevWeekDone(pwDone);
      setWeekCreated(wCreated);

      // ── Agent leaderboard ────────────────────────────
      const HEARTBEAT_THRESHOLD_MS = 5 * 60 * 1000; // 5 min
      const lbRows: AgentLeaderboardRow[] = agentsArr.map((ag: any) => {
        const agTasks = tasksArr.filter(
          (t: any) => t.assignedTo === ag.id || t.agent === ag.id || t.agentId === ag.id,
        );

        // Done this week
        const doneThisWeek = agTasks.filter((t: any) => {
          if (t.status !== 'done') return false;
          const raw = t.completedAt || t.updatedAt || t.updated_at;
          if (!raw) return false;
          return new Date(raw) >= thisWeekStart;
        }).length;

        const inProg = agTasks.filter((t: any) => t.status === 'in-progress').length;

        // Average completion time (createdAt → completedAt)
        const completionTimes: number[] = agTasks
          .filter((t: any) => t.status === 'done' && t.createdAt && (t.completedAt || t.updatedAt))
          .map((t: any) => {
            return new Date(t.completedAt || t.updatedAt).getTime() - new Date(t.createdAt).getTime();
          })
          .filter((ms: number) => ms > 0);

        const avgMs =
          completionTimes.length > 0
            ? completionTimes.reduce((a: number, b: number) => a + b, 0) / completionTimes.length
            : null;

        const lastHeartbeat = ag.lastHeartbeat || ag.last_heartbeat;
        const online = lastHeartbeat
          ? Date.now() - new Date(lastHeartbeat).getTime() < HEARTBEAT_THRESHOLD_MS
          : ag.status === 'active' || ag.status === 'online';

        return {
          id: ag.id,
          name: ag.name || ag.id,
          color: ag.color || '#6366F1',
          tasksDone: doneThisWeek,
          tasksInProgress: inProg,
          avgCompletionMs: avgMs,
          online,
        };
      });

      // Sort: most done this week first
      lbRows.sort((a, b) => b.tasksDone - a.tasksDone || b.tasksInProgress - a.tasksInProgress);
      setLeaderboard(lbRows);

      // Agent utilisation
      const onlineCount = lbRows.filter((r) => r.online).length;
      setAgentUtil({ active: onlineCount, total: agentsArr.length });

      // ── Original stats / daily chart ─────────────────
      const tasksCount = tasksArr.length;
      const completedTasks = tasksArr.filter((t: any) => t.status === 'done').length;

      if (analyticsResult?.success) {
        const fetchDays = analyticsResult.days || days;

        const completionsMap = fillDateRange(analyticsResult.completions || [], fetchDays, 'tasks_completed');
        const createdMap     = fillDateRange(analyticsResult.created || [], fetchDays, 'tasks_created');

        const allDates: string[] = [];
        for (let i = fetchDays - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          allDates.push(isoDate(d));
        }

        const daily: DailyActivity[] = allDates.map((date) => ({
          date,
          label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          completed: completionsMap.get(date) || 0,
          created:   createdMap.get(date) || 0,
        }));
        setDailyData(daily);

        setAgents(analyticsResult.agents || []);
        setProjects(analyticsResult.projects || []);

        const totalCompleted = daily.reduce((s, d) => s + d.completed, 0);
        const avgPerDay = daily.length > 0 ? Math.round((totalCompleted / daily.length) * 10) / 10 : 0;
        const mid         = Math.floor(daily.length / 2);
        const firstHalf   = daily.slice(0, mid).reduce((s, d) => s + d.completed, 0);
        const secondHalf  = daily.slice(mid).reduce((s, d) => s + d.completed, 0);
        const completionTrend = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;

        setStats([
          {
            label: 'Active Sessions',
            value: sessionsCount,
            trend: sessionsCount > 0 ? 'up' : 'neutral',
            icon: MessageSquare,
            color: 'text-[var(--color-info)]',
          },
          {
            label: 'Tasks Completed',
            value: `${completedTasks}/${tasksCount}`,
            change: completionTrend > 0 ? completionTrend : undefined,
            trend: completionTrend > 0 ? 'up' : completionTrend < 0 ? 'down' : 'neutral',
            icon: Zap,
            color: 'text-[var(--color-success)]',
          },
          {
            label: 'Avg/Day',
            value: avgPerDay,
            trend: avgPerDay > 3 ? 'up' : avgPerDay > 0 ? 'neutral' : 'down',
            icon: Activity,
            color: 'text-[var(--color-review)]',
          },
          {
            label: 'Pending Approvals',
            value: pendingApprovals,
            trend: pendingApprovals > 5 ? 'down' : 'neutral',
            icon: Clock,
            color: 'text-[var(--color-warning)]',
          },
        ]);
      } else {
        setStats([
          {
            label: 'Active Sessions',
            value: sessionsCount,
            trend: 'neutral',
            icon: MessageSquare,
            color: 'text-[var(--color-info)]',
          },
          {
            label: 'Tasks Completed',
            value: `${completedTasks}/${tasksCount}`,
            trend: completedTasks > 0 ? 'up' : 'neutral',
            icon: Zap,
            color: 'text-[var(--color-success)]',
          },
          {
            label: 'Pending Approvals',
            value: pendingApprovals,
            trend: pendingApprovals > 5 ? 'down' : 'neutral',
            icon: Clock,
            color: 'text-[var(--color-warning)]',
          },
          {
            label: 'Total Tasks',
            value: tasksCount,
            trend: 'neutral',
            icon: Activity,
            color: 'text-[var(--color-review)]',
          },
        ]);
        setDailyData([]);
        setAgents([]);
        setProjects([]);
      }
    } catch (error) {
      // failed to load analytics
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Weekly delta arrow
  const weekDelta = weekDone - prevWeekDone;
  const utilPct   = agentUtil.total > 0 ? Math.round((agentUtil.active / agentUtil.total) * 100) : 0;

  const hasVelocityData = velocityDays.some((d) => d.count > 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* ── Weekly Summary Card ──────────────────────────────── */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">This Week</span>
          </div>
        </div>
        <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tasks done vs last week */}
          <div className="flex flex-col gap-1">
            <Flex align="center" gap="2">
              <CheckCircle size={14} className="text-[var(--color-success)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Tasks completed</span>
            </Flex>
            <Flex align="baseline" gap="2">
              <span className="text-3xl font-bold tabular-nums text-mission-control-text">{weekDone}</span>
              {weekDelta !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                    weekDelta > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
                  }`}
                >
                  {weekDelta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {Math.abs(weekDelta)} vs last wk
                </span>
              )}
              {weekDelta === 0 && (
                <span className="flex items-center gap-0.5 text-xs text-mission-control-text-dim">
                  <Minus size={12} />
                  same as last wk
                </span>
              )}
            </Flex>
          </div>

          {/* New tasks created */}
          <div className="flex flex-col gap-1">
            <Flex align="center" gap="2">
              <PlusCircle size={14} className="text-[var(--color-info)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">New tasks</span>
            </Flex>
            <div className="text-3xl font-bold tabular-nums text-mission-control-text">{weekCreated}</div>
          </div>

          {/* Agent utilisation */}
          <div className="flex flex-col gap-1">
            <Flex align="center" gap="2">
              <Users size={14} className="text-mission-control-accent" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Agent utilisation</span>
            </Flex>
            <Flex align="baseline" gap="2">
              <span className="text-3xl font-bold tabular-nums text-mission-control-text">{utilPct}%</span>
              <span className="text-xs text-mission-control-text-dim tabular-nums">
                {agentUtil.active}/{agentUtil.total} online
              </span>
            </Flex>
            <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-mission-control-accent rounded-full transition-colors"
                style={{ width: `${utilPct}%` }}
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-4 bg-mission-control-surface border border-mission-control-border rounded-xl"
            >
              <Flex align="center" justify="between" mb="3">
                <Icon size={20} className={stat.color} />
                {stat.trend && (
                  <Flex
                    align="center"
                    gap="1"
                    className={`text-xs ${
                      stat.trend === 'up'
                        ? 'text-[var(--color-success)]'
                        : stat.trend === 'down'
                        ? 'text-[var(--color-error)]'
                        : 'text-mission-control-text-dim'
                    }`}
                  >
                    {stat.trend === 'up' && <ArrowUp size={14} />}
                    {stat.trend === 'down' && <ArrowDown size={14} />}
                    {stat.trend === 'neutral' && <Minus size={14} />}
                    {stat.change !== undefined && `${stat.change}%`}
                  </Flex>
                )}
              </Flex>
              <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Pipeline Velocity + Status Donut ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pipeline velocity — 2 cols wide */}
        <div className="lg:col-span-2 bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden min-h-[280px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-mission-control-text-dim" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Pipeline Velocity</span>
            </div>
            <span className="text-xs text-mission-control-text-dim">last 14 days</span>
          </div>
          <div className="px-4 pt-3 pb-4 flex-1 min-h-0 flex flex-col">
          {hasVelocityData ? (
            <div className="flex-1 min-h-0">
              <PipelineVelocityChart days={velocityDays} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[160px] text-sm text-mission-control-text-dim">
              No completed tasks in the last 14 days
            </div>
          )}
          </div>
        </div>

        {/* Status donut — 1 col wide */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden min-h-[280px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-mission-control-text-dim" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Status Distribution</span>
            </div>
          </div>
          <div className="px-4 pt-3 pb-4 flex-1 flex items-center">
            <StatusDonutChart slices={statusSlices} />
          </div>
        </div>
      </div>

      {/* ── Agent Performance Leaderboard ────────────────────── */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Agent Performance</span>
          </div>
          <span className="text-xs text-mission-control-text-dim">this week</span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <AgentLeaderboard rows={leaderboard} />
        </div>
      </div>

      {/* ── Activity Chart — Real Data ────────────────────────── */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Task Activity</span>
          </div>
          <Flex align="center" gap="3">
            <Flex align="center" gap="1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.accent }} />
              <span className="text-xs text-mission-control-text-dim">Completed</span>
            </Flex>
            <Flex align="center" gap="1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.blue }} />
              <span className="text-xs text-mission-control-text-dim">Created</span>
            </Flex>
          </Flex>
        </div>
        <div className="px-4 pt-3 pb-4">
        {dailyData.length > 0 ? (
          <div className="w-full" style={{ minHeight: 256 }}>
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={dailyData} margin={CHART_MARGIN} barGap={3} barCategoryGap="30%">
                <CartesianGrid {...CHART_GRID} />
                <XAxis
                  dataKey="label"
                  {...CHART_AXIS}
                  interval={Math.floor(dailyData.length / 10)}
                  angle={dailyData.length > 14 ? -45 : 0}
                  textAnchor={dailyData.length > 14 ? 'end' : 'middle'}
                  height={dailyData.length > 14 ? 50 : 30}
                />
                <YAxis {...CHART_AXIS} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
                <Bar dataKey="created"   name="Created"   fill={CHART_COLORS.blue}   radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Flex align="center" justify="center" className="text-mission-control-text-dim" style={{ minHeight: 256 }}>
            No task data available for this period
          </Flex>
        )}
        </div>
      </div>

      {/* ── Agent Activity + Project Progress ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Agent Utilization */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border">
            <Users size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Agent Activity</span>
          </div>
          <div className="px-4 pt-3 pb-4">
          {agents.length > 0 ? (
            <div className="space-y-3">
              {agents.slice(0, 6).map((agent, idx) => {
                const pct =
                  agent.total > 0 ? Math.round((agent.completed / agent.total) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <Flex align="center" justify="between" className="text-sm">
                      <span className="truncate max-w-[150px]">{agent.agent}</span>
                      <span className="text-xs text-mission-control-text-dim tabular-nums">
                        {agent.completed}/{agent.total} ({pct}%)
                      </span>
                    </Flex>
                    <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-mission-control-accent rounded-full transition-colors"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-mission-control-text-dim py-4 text-center">
              No agent data for this period
            </div>
          )}
          </div>
        </div>

        {/* Project Progress */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border">
            <FolderKanban size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Project Progress</span>
          </div>
          <div className="px-4 pt-3 pb-4">
          {projects.length > 0 ? (
            <div className="space-y-3">
              {projects.slice(0, 6).map((proj, idx) => (
                <div key={idx} className="space-y-1">
                  <Flex align="center" justify="between" className="text-sm">
                    <span className="truncate max-w-[150px]">{proj.project}</span>
                    <span className="text-xs text-mission-control-text-dim tabular-nums">
                      {proj.completed}/{proj.total} ({proj.completion_rate}%)
                    </span>
                  </Flex>
                  <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mission-control-accent rounded-full transition-colors"
                      style={{ width: `${proj.completion_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-mission-control-text-dim py-4 text-center">
              No project data for this period
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ── Insights + Top Agents ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border">
            <TrendingUp size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Insights</span>
          </div>
          <div className="px-4 pt-3 pb-4 space-y-2">
            <Flex align="center" justify="between" className="p-2 bg-mission-control-border/10 rounded-lg">
              <span className="text-sm">Most productive day</span>
              <span className="text-sm font-medium text-mission-control-accent tabular-nums">
                {dailyData.length > 0
                  ? (() => {
                      const best = dailyData.reduce(
                        (max, d) => (d.completed > max.completed ? d : max),
                        dailyData[0],
                      );
                      return best.completed > 0 ? `${best.label} (${best.completed})` : 'No data yet';
                    })()
                  : 'No data yet'}
              </span>
            </Flex>
            <Flex align="center" justify="between" className="p-2 bg-mission-control-border/10 rounded-lg">
              <span className="text-sm">Total completed</span>
              <span className="text-sm font-medium text-mission-control-accent tabular-nums">
                {dailyData.reduce((sum, d) => sum + d.completed, 0)} tasks
              </span>
            </Flex>
            <Flex align="center" justify="between" className="p-2 bg-mission-control-border/10 rounded-lg">
              <span className="text-sm">Total created</span>
              <span className="text-sm font-medium text-mission-control-accent tabular-nums">
                {dailyData.reduce((sum, d) => sum + d.created, 0)} tasks
              </span>
            </Flex>
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border">
            <Calendar size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Top Agents</span>
          </div>
          <div className="px-4 pt-3 pb-4 space-y-2">
            {agents.length > 0 ? (
              agents.slice(0, 3).map((agent, idx) => (
                <Flex
                  key={idx}
                  align="center"
                  justify="between"
                  className="p-2 bg-mission-control-border/10 rounded-lg"
                >
                  <Flex align="center" gap="2">
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-mission-control-text-dim">
                      {idx + 1}.
                    </span>
                    <span className="text-sm truncate max-w-[150px]">{agent.agent}</span>
                  </Flex>
                  <span className="text-sm font-medium tabular-nums text-mission-control-accent">
                    {agent.completed} done
                  </span>
                </Flex>
              ))
            ) : (
              <div className="text-sm text-mission-control-text-dim py-4 text-center">
                No agent data
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
