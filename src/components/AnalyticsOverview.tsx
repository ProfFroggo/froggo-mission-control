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
import { analyticsApi, taskApi, inboxApi, sessionApi, agentApi } from '../lib/api';
import { createLogger } from '../utils/logger';
import { CHART_COLORS, CHART_GRID, CHART_AXIS, CHART_TOOLTIP } from '../lib/chartTheme';

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
  'todo':             { label: 'Todo',           color: '#6B7280' },
  'internal-review':  { label: 'Pre-review',     color: '#F59E0B' },
  'in-progress':      { label: 'In Progress',    color: '#3B82F6' },
  'review':           { label: 'Review',         color: '#8B5CF6' },
  'done':             { label: 'Done',           color: '#10B981' },
  'human-review':     { label: 'Human Review',   color: '#F97316' },
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
  const chartHeight = 100;
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
      height={chartHeight}
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
              opacity={day.count === 0 ? 0.25 : 0.85}
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
    <div className="flex items-center gap-6">
      <svg width={130} height={130} viewBox="0 0 130 130" aria-label="Task status distribution">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--mission-control-border)"
          strokeWidth={stroke}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.status}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
            strokeDashoffset={arc.offset}
            strokeLinecap="butt"
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          >
            <title>{`${arc.label}: ${arc.count} (${Math.round(arc.pct * 100)}%)`}</title>
          </circle>
        ))}
        {/* Centre total */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={18} fontWeight="700" fill="var(--mission-control-text)">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="var(--mission-control-text-dim)">tasks</text>
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {arcs.map((arc) => (
          <div key={arc.status} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: arc.color }}
              />
              <span className="text-mission-control-text-dim truncate">{arc.label}</span>
            </div>
            <span className="font-medium tabular-nums">{arc.count}</span>
          </div>
        ))}
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
              className="border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-bg/60 transition-colors"
            >
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: row.color || 'var(--mission-control-accent)' }}
                  >
                    {row.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[120px]">{row.name}</span>
                </div>
              </td>
              <td className="py-2.5 text-right font-medium text-success">{row.tasksDone}</td>
              <td className="py-2.5 text-right tabular-nums">{row.tasksInProgress}</td>
              <td className="py-2.5 text-right tabular-nums text-mission-control-text-dim">
                {fmtDuration(row.avgCompletionMs)}
              </td>
              <td className="py-2.5 text-right">
                {row.online ? (
                  <span className="inline-flex items-center gap-1 text-success text-xs">
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

export default function AnalyticsOverview() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
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
        const days =
          analyticsResult.days || (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90);

        const completionsMap = fillDateRange(analyticsResult.completions || [], days, 'tasks_completed');
        const createdMap     = fillDateRange(analyticsResult.created || [], days, 'tasks_created');

        const allDates: string[] = [];
        for (let i = days - 1; i >= 0; i--) {
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
            color: 'text-info',
          },
          {
            label: 'Tasks Completed',
            value: `${completedTasks}/${tasksCount}`,
            change: completionTrend > 0 ? completionTrend : undefined,
            trend: completionTrend > 0 ? 'up' : completionTrend < 0 ? 'down' : 'neutral',
            icon: Zap,
            color: 'text-success',
          },
          {
            label: 'Avg/Day',
            value: avgPerDay,
            trend: avgPerDay > 3 ? 'up' : avgPerDay > 0 ? 'neutral' : 'down',
            icon: Activity,
            color: 'text-review',
          },
          {
            label: 'Pending Approvals',
            value: pendingApprovals,
            trend: pendingApprovals > 5 ? 'down' : 'neutral',
            icon: Clock,
            color: 'text-warning',
          },
        ]);
      } else {
        setStats([
          {
            label: 'Active Sessions',
            value: sessionsCount,
            trend: 'neutral',
            icon: MessageSquare,
            color: 'text-info',
          },
          {
            label: 'Tasks Completed',
            value: `${completedTasks}/${tasksCount}`,
            trend: completedTasks > 0 ? 'up' : 'neutral',
            icon: Zap,
            color: 'text-success',
          },
          {
            label: 'Pending Approvals',
            value: pendingApprovals,
            trend: pendingApprovals > 5 ? 'down' : 'neutral',
            icon: Clock,
            color: 'text-warning',
          },
          {
            label: 'Total Tasks',
            value: tasksCount,
            trend: 'neutral',
            icon: Activity,
            color: 'text-review',
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
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Weekly delta arrow
  const weekDelta = weekDone - prevWeekDone;
  const utilPct   = agentUtil.total > 0 ? Math.round((agentUtil.active / agentUtil.total) * 100) : 0;

  const hasVelocityData = velocityDays.some((d) => d.count > 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Time range selector */}
      <div className="flex justify-end mb-6">
        <div className="flex bg-mission-control-border rounded-xl p-1">
          {(['7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                timeRange === range
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Weekly Summary Card ──────────────────────────────── */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wide text-mission-control-text-dim">
          <Calendar size={14} />
          This Week
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Tasks done vs last week */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-success" />
              <span className="text-sm text-mission-control-text-dim">Tasks completed</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{weekDone}</span>
              {weekDelta !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    weekDelta > 0 ? 'text-success' : 'text-error'
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
            </div>
          </div>

          {/* New tasks created */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <PlusCircle size={16} className="text-info" />
              <span className="text-sm text-mission-control-text-dim">New tasks</span>
            </div>
            <div className="text-3xl font-bold">{weekCreated}</div>
          </div>

          {/* Agent utilisation */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-review" />
              <span className="text-sm text-mission-control-text-dim">Agent utilisation</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{utilPct}%</span>
              <span className="text-xs text-mission-control-text-dim">
                {agentUtil.active}/{agentUtil.total} online
              </span>
            </div>
            <div className="h-1.5 bg-mission-control-bg rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-mission-control-accent rounded-full transition-all"
                style={{ width: `${utilPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-4 bg-mission-control-surface border border-mission-control-border rounded-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={20} className={stat.color} />
                {stat.trend && (
                  <div
                    className={`flex items-center gap-1 text-xs ${
                      stat.trend === 'up'
                        ? 'text-success'
                        : stat.trend === 'down'
                        ? 'text-error'
                        : 'text-mission-control-text-dim'
                    }`}
                  >
                    {stat.trend === 'up' && <ArrowUp size={14} />}
                    {stat.trend === 'down' && <ArrowDown size={14} />}
                    {stat.trend === 'neutral' && <Minus size={14} />}
                    {stat.change !== undefined && `${stat.change}%`}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-mission-control-text-dim">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Pipeline Velocity + Status Donut ─────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Pipeline velocity — 2 cols wide */}
        <div className="col-span-2 bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-mission-control-accent" />
            Pipeline Velocity
          </h2>
          <p className="text-xs text-mission-control-text-dim mb-4">
            Tasks completed per day — last 14 days
          </p>
          {hasVelocityData ? (
            <PipelineVelocityChart days={velocityDays} />
          ) : (
            <div className="flex items-center justify-center h-24 text-sm text-mission-control-text-dim">
              No completed tasks in the last 14 days
            </div>
          )}
        </div>

        {/* Status donut — 1 col wide */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Activity size={16} className="text-mission-control-accent" />
            Status Distribution
          </h2>
          <p className="text-xs text-mission-control-text-dim mb-4">
            Current task breakdown by status
          </p>
          <StatusDonutChart slices={statusSlices} />
        </div>
      </div>

      {/* ── Agent Performance Leaderboard ────────────────────── */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <Users size={16} className="text-mission-control-accent" />
          Agent Performance
        </h2>
        <p className="text-xs text-mission-control-text-dim mb-4">
          Tasks completed this week, in-progress workload, and average completion time per agent
        </p>
        <AgentLeaderboard rows={leaderboard} />
      </div>

      {/* ── Activity Chart — Real Data ────────────────────────── */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Task Activity</h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.green }} />
              <span className="text-mission-control-text-dim">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.blue }} />
              <span className="text-mission-control-text-dim">Created</span>
            </div>
          </div>
        </div>

        {dailyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray={CHART_GRID.strokeDasharray}
                  stroke={CHART_GRID.stroke}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={CHART_AXIS.stroke}
                  fontSize={CHART_AXIS.fontSize}
                  interval={Math.floor(dailyData.length / 10)}
                  angle={dailyData.length > 14 ? -45 : 0}
                  textAnchor={dailyData.length > 14 ? 'end' : 'middle'}
                  height={dailyData.length > 14 ? 50 : 30}
                />
                <YAxis stroke={CHART_AXIS.stroke} fontSize={CHART_AXIS.fontSize} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_TOOLTIP.backgroundColor,
                    border: CHART_TOOLTIP.border,
                    borderRadius: CHART_TOOLTIP.borderRadius,
                  }}
                  labelStyle={{ color: CHART_AXIS.stroke }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="created" name="Created" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-mission-control-text-dim">
            No task data available for this period
          </div>
        )}
      </div>

      {/* ── Agent Activity + Project Progress ────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Agent Utilization */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-mission-control-accent" />
            Agent Activity
          </h3>
          {agents.length > 0 ? (
            <div className="space-y-3">
              {agents.slice(0, 6).map((agent, idx) => {
                const pct =
                  agent.total > 0 ? Math.round((agent.completed / agent.total) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[150px]">{agent.agent}</span>
                      <span className="text-mission-control-text-dim">
                        {agent.completed}/{agent.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-mission-control-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-mission-control-accent rounded-full transition-all"
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

        {/* Project Progress */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FolderKanban size={16} className="text-mission-control-accent" />
            Project Progress
          </h3>
          {projects.length > 0 ? (
            <div className="space-y-3">
              {projects.slice(0, 6).map((proj, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[150px]">{proj.project}</span>
                    <span className="text-mission-control-text-dim">
                      {proj.completed}/{proj.total} ({proj.completion_rate}%)
                    </span>
                  </div>
                  <div className="h-2 bg-mission-control-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
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

      {/* ── Insights + Top Agents ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-mission-control-accent" />
            Insights
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-mission-control-bg rounded-lg">
              <span className="text-sm">Most productive day</span>
              <span className="text-sm font-medium text-mission-control-accent">
                {dailyData.length > 0
                  ? (() => {
                      const best = dailyData.reduce(
                        (max, d) => (d.completed > max.completed ? d : max),
                        dailyData[0],
                      );
                      return best.completed > 0 ? `${best.label} (${best.completed})` : '—';
                    })()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-mission-control-bg rounded-lg">
              <span className="text-sm">Total completed</span>
              <span className="text-sm font-medium text-mission-control-accent">
                {dailyData.reduce((sum, d) => sum + d.completed, 0)} tasks
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-mission-control-bg rounded-lg">
              <span className="text-sm">Total created</span>
              <span className="text-sm font-medium text-mission-control-accent">
                {dailyData.reduce((sum, d) => sum + d.created, 0)} tasks
              </span>
            </div>
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-mission-control-accent" />
            Top Agents
          </h3>
          <div className="space-y-3">
            {agents.length > 0 ? (
              agents.slice(0, 3).map((agent, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-mission-control-bg rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-mission-control-text-dim">
                      {idx + 1}.
                    </span>
                    <span className="text-sm truncate max-w-[150px]">{agent.agent}</span>
                  </div>
                  <span className="text-sm font-medium text-mission-control-accent">
                    {agent.completed} done
                  </span>
                </div>
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
