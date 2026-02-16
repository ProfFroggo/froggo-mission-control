import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, MessageSquare, Zap, Clock, Calendar, Activity, ArrowUp, ArrowDown, Minus, Users, FolderKanban } from 'lucide-react';
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

export default function AnalyticsOverview() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [stats, setStats] = useState<Stat[]>([]);
  const [dailyData, setDailyData] = useState<DailyActivity[]>([]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [_loading, setLoading] = useState(false);

  // Fill gaps in date range with zeros
  function fillDateRange(data: { date: string; [key: string]: any }[], days: number, valueKey: string): Map<string, number> {
    const map = new Map<string, number>();
    // Build map from data
    for (const row of data) {
      if (row.date && row.date !== '1970-01-01') {
        map.set(row.date, row[valueKey] || 0);
      }
    }
    // Fill missing dates
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, 0);
    }
    return map;
  }

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real analytics data from froggo.db
      const analyticsResult = await (window as any).clawdbot?.analytics?.getData(timeRange).catch(() => null);

      // Also get current stats
      const sessionsResult = await (window as any).clawdbot?.sessions?.list().catch(() => null);
      const sessionsCount = sessionsResult?.sessions?.length || 0;
      const tasksResult = await (window as any).clawdbot?.tasks?.list().catch(() => null);
      const tasksCount = tasksResult?.tasks?.length || 0;
      const completedTasks = tasksResult?.tasks?.filter((t: any) => t.status === 'done')?.length || 0;
      const inboxResult = await (window as any).clawdbot?.inbox?.list().catch(() => null);
      const pendingApprovals = inboxResult?.items?.filter((i: any) => i.status === 'pending')?.length || 0;

      if (analyticsResult?.success) {
        const days = analyticsResult.days || (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90);

        // Build daily data from real completions + creations
        const completionsMap = fillDateRange(analyticsResult.completions || [], days, 'tasks_completed');
        const createdMap = fillDateRange(analyticsResult.created || [], days, 'tasks_created');

        // Generate complete date range (fillDateRange already filled all dates, just use one map's keys)
        const allDates: string[] = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          allDates.push(d.toISOString().split('T')[0]);
        }
        
        const daily: DailyActivity[] = allDates.map(date => ({
          date,
          label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          completed: completionsMap.get(date) || 0,
          created: createdMap.get(date) || 0,
        }));
        setDailyData(daily);

        // Agent data
        setAgents(analyticsResult.agents || []);

        // Project data
        setProjects(analyticsResult.projects || []);

        // Compute trends from real data
        const totalCompleted = daily.reduce((s, d) => s + d.completed, 0);
        const avgPerDay = daily.length > 0 ? Math.round(totalCompleted / daily.length * 10) / 10 : 0;

        // Compare first half vs second half for trend
        const mid = Math.floor(daily.length / 2);
        const firstHalf = daily.slice(0, mid).reduce((s, d) => s + d.completed, 0);
        const secondHalf = daily.slice(mid).reduce((s, d) => s + d.completed, 0);
        const completionTrend = firstHalf > 0 ? Math.round((secondHalf - firstHalf) / firstHalf * 100) : 0;

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
        // Fallback: use basic task data if analytics IPC not available
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
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const maxValue = Math.max(...dailyData.map(d => Math.max(d.completed, d.created)), 1);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Time range selector */}
      <div className="flex justify-end mb-6">
        <div className="flex bg-clawd-border rounded-xl p-1">
          {(['7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                timeRange === range
                  ? 'bg-clawd-accent text-white'
                  : 'text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-4 bg-clawd-surface border border-clawd-border rounded-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={20} className={stat.color} />
                {stat.trend && (
                  <div className={`flex items-center gap-1 text-xs ${
                    stat.trend === 'up' ? 'text-success' :
                    stat.trend === 'down' ? 'text-error' :
                    'text-clawd-text-dim'
                  }`}>
                    {stat.trend === 'up' && <ArrowUp size={14} />}
                    {stat.trend === 'down' && <ArrowDown size={14} />}
                    {stat.trend === 'neutral' && <Minus size={14} />}
                    {stat.change !== undefined && `${stat.change}%`}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-clawd-text-dim">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Activity Chart - Real Data */}
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Task Activity</h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
              <span className="text-clawd-text-dim">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span className="text-clawd-text-dim">Created</span>
            </div>
          </div>
        </div>

        {dailyData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="#9CA3AF" 
                  fontSize={10}
                  interval={Math.floor(dailyData.length / 10)}
                  angle={dailyData.length > 14 ? -45 : 0}
                  textAnchor={dailyData.length > 14 ? 'end' : 'middle'}
                  height={dailyData.length > 14 ? 50 : 30}
                />
                <YAxis stroke="#9CA3AF" fontSize={10} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="created" name="Created" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-clawd-text-dim">
            No task data available for this period
          </div>
        )}
      </div>

      {/* Agent Activity + Project Progress */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Agent Utilization */}
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-clawd-accent" />
            Agent Activity
          </h3>
          {agents.length > 0 ? (
            <div className="space-y-3">
              {agents.slice(0, 6).map((agent, idx) => {
                const pct = agent.total > 0 ? Math.round((agent.completed / agent.total) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[150px]">{agent.agent}</span>
                      <span className="text-clawd-text-dim">{agent.completed}/{agent.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-clawd-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-clawd-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-clawd-text-dim py-4 text-center">No agent data for this period</div>
          )}
        </div>

        {/* Project Progress */}
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FolderKanban size={16} className="text-clawd-accent" />
            Project Progress
          </h3>
          {projects.length > 0 ? (
            <div className="space-y-3">
              {projects.slice(0, 6).map((proj, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[150px]">{proj.project}</span>
                    <span className="text-clawd-text-dim">{proj.completed}/{proj.total} ({proj.completion_rate}%)</span>
                  </div>
                  <div className="h-2 bg-clawd-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${proj.completion_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-clawd-text-dim py-4 text-center">No project data for this period</div>
          )}
        </div>
      </div>

      {/* Real insights from data */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-clawd-accent" />
            Insights
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Most productive day</span>
              <span className="text-sm font-medium text-clawd-accent">
                {dailyData.length > 0
                  ? (() => {
                      const best = dailyData.reduce((max, d) => d.completed > max.completed ? d : max, dailyData[0]);
                      return best.completed > 0 ? `${best.label} (${best.completed})` : '-';
                    })()
                  : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Total completed</span>
              <span className="text-sm font-medium text-clawd-accent">
                {dailyData.reduce((sum, d) => sum + d.completed, 0)} tasks
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Total created</span>
              <span className="text-sm font-medium text-clawd-accent">
                {dailyData.reduce((sum, d) => sum + d.created, 0)} tasks
              </span>
            </div>
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-clawd-accent" />
            Top Agents
          </h3>
          <div className="space-y-3">
            {agents.length > 0 ? agents.slice(0, 3).map((agent, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
                <span className="text-sm truncate max-w-[150px]">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {agent.agent}
                </span>
                <span className="text-sm font-medium text-clawd-accent">
                  {agent.completed} done
                </span>
              </div>
            )) : (
              <div className="text-sm text-clawd-text-dim py-4 text-center">No agent data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
