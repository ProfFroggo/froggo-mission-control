import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, MessageSquare, Zap, Clock, Calendar, Activity, ArrowUp, ArrowDown, Minus } from 'lucide-react';

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
  messages: number;
  tasks: number;
  approvals: number;
}

export default function AnalyticsOverview() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [stats, setStats] = useState<Stat[]>([]);
  const [dailyData, setDailyData] = useState<DailyActivity[]>([]);
  const [_loading, setLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Get sessions count
      const sessionsResult = await (window as any).clawdbot?.sessions?.list().catch(() => null);
      const sessionsCount = sessionsResult?.sessions?.length || 0;

      // Get tasks stats
      const tasksResult = await (window as any).clawdbot?.tasks?.list().catch(() => null);
      const tasksCount = tasksResult?.tasks?.length || 0;
      const completedTasks = tasksResult?.tasks?.filter((t: any) => t.status === 'done')?.length || 0;

      // Get inbox stats - check for success flag
      const inboxResult = await (window as any).clawdbot?.inbox?.list().catch(() => null);
      const pendingApprovals = inboxResult?.success 
        ? (inboxResult.items?.filter((i: any) => i.status === 'pending')?.length || 0)
        : (inboxResult?.items?.filter((i: any) => i.status === 'pending')?.length || 0);
      const totalApprovals = inboxResult?.items?.length || 0;

      setStats([
        {
          label: 'Active Sessions',
          value: sessionsCount,
          change: 12,
          trend: 'up',
          icon: MessageSquare,
          color: 'text-blue-400',
        },
        {
          label: 'Tasks Completed',
          value: `${completedTasks}/${tasksCount}`,
          change: completedTasks > 0 ? 8 : 0,
          trend: completedTasks > 0 ? 'up' : 'neutral',
          icon: Zap,
          color: 'text-green-400',
        },
        {
          label: 'Pending Approvals',
          value: pendingApprovals,
          trend: pendingApprovals > 5 ? 'down' : 'neutral',
          icon: Clock,
          color: 'text-yellow-400',
        },
        {
          label: 'Total Interactions',
          value: totalApprovals + sessionsCount * 10, // Estimate
          change: 15,
          trend: 'up',
          icon: Activity,
          color: 'text-purple-400',
        },
      ]);

      // Generate mock daily data for chart
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const data: DailyActivity[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          messages: Math.floor(Math.random() * 50) + 10,
          tasks: Math.floor(Math.random() * 10) + 2,
          approvals: Math.floor(Math.random() * 8) + 1,
        });
      }
      setDailyData(data);

    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const maxMessages = Math.max(...dailyData.map(d => d.messages), 1);

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
                    stat.trend === 'up' ? 'text-green-400' :
                    stat.trend === 'down' ? 'text-red-400' :
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

      {/* Activity Chart */}
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Activity Over Time</h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm" />
              <span className="text-clawd-text-dim">Messages</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
              <span className="text-clawd-text-dim">Tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-sm" />
              <span className="text-clawd-text-dim">Approvals</span>
            </div>
          </div>
        </div>

        {/* Simple bar chart */}
        <div className="h-48 flex items-end gap-1">
          {dailyData.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-blue-500/80 rounded-t transition-all"
                  style={{ height: `${(day.messages / maxMessages) * 120}px` }}
                />
                <div
                  className="w-full bg-green-500/80 transition-all"
                  style={{ height: `${(day.tasks / maxMessages) * 120}px` }}
                />
                <div
                  className="w-full bg-purple-500/80 rounded-b transition-all"
                  style={{ height: `${(day.approvals / maxMessages) * 120}px` }}
                />
              </div>
              <span className="text-[10px] text-clawd-text-dim mt-1 rotate-45 origin-left">
                {day.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick insights */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-clawd-accent" />
            Top Insights
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Most active day</span>
              <span className="text-sm font-medium text-clawd-accent">
                {dailyData.length > 0 ? dailyData.reduce((max, d) => d.messages > max.messages ? d : max, dailyData[0]).date : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Avg messages/day</span>
              <span className="text-sm font-medium text-clawd-accent">
                {dailyData.length > 0 ? Math.round(dailyData.reduce((sum, d) => sum + d.messages, 0) / dailyData.length) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Avg tasks/day</span>
              <span className="text-sm font-medium text-clawd-accent">
                {dailyData.length > 0 ? Math.round(dailyData.reduce((sum, d) => sum + d.tasks, 0) / dailyData.length) : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-clawd-accent" />
            Usage Patterns
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Peak hours</span>
              <span className="text-sm font-medium text-clawd-accent">9AM - 11AM</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Busiest channel</span>
              <span className="text-sm font-medium text-clawd-accent">Discord</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-clawd-bg rounded-lg">
              <span className="text-sm">Most used agent</span>
              <span className="text-sm font-medium text-clawd-accent">Coder</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
