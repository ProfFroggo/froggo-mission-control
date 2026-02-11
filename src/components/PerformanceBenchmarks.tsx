import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface BenchmarkData {
  period: string;
  tasksCompleted: number;
  completionRate: number;
  avgCompletionTime: number;
  totalHours: number;
  activeAgents: number;
}

interface ComparisonMetric {
  label: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  positive: boolean; // Is increase good?
}

export default function PerformanceBenchmarks() {
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState<'wow' | 'mom' | 'yoy'>('wow'); // Week/Month/Year over X
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [metrics, setMetrics] = useState<ComparisonMetric[]>([]);

  useEffect(() => {
    loadBenchmarks();
  }, [compareMode]);

  const loadBenchmarks = async () => {
    setLoading(true);
    try {
      const dbExec = (window as any).clawdbot?.db?.exec;
      if (!dbExec) throw new Error('Database not available');

      let periods: BenchmarkData[] = [];

      if (compareMode === 'wow') {
        // Week over week - last 8 weeks
        for (let i = 7; i >= 0; i--) {
          const weekEnd = new Date();
          weekEnd.setDate(weekEnd.getDate() - i * 7);
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekEnd.getDate() - 6);

          const data = await getPeriodData(dbExec, weekStart.getTime(), weekEnd.getTime());
          periods.push({
            period: `W${8 - i}`,
            ...data,
          });
        }
      } else if (compareMode === 'mom') {
        // Month over month - last 6 months
        for (let i = 5; i >= 0; i--) {
          const monthEnd = new Date();
          monthEnd.setMonth(monthEnd.getMonth() - i);
          monthEnd.setDate(0); // Last day of previous month
          const monthStart = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), 1);

          const data = await getPeriodData(dbExec, monthStart.getTime(), monthEnd.getTime());
          periods.push({
            period: monthStart.toLocaleDateString('en-US', { month: 'short' }),
            ...data,
          });
        }
      } else {
        // Year over year - last 3 years
        for (let i = 2; i >= 0; i--) {
          const year = new Date().getFullYear() - i;
          const yearStart = new Date(year, 0, 1).getTime();
          const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

          const data = await getPeriodData(dbExec, yearStart, yearEnd);
          periods.push({
            period: year.toString(),
            ...data,
          });
        }
      }

      setBenchmarks(periods);

      // Calculate comparison metrics (current vs previous period)
      if (periods.length >= 2) {
        const current = periods[periods.length - 1];
        const previous = periods[periods.length - 2];

        const compareMetrics: ComparisonMetric[] = [
          {
            label: 'Tasks Completed',
            current: current.tasksCompleted,
            previous: previous.tasksCompleted,
            change: current.tasksCompleted - previous.tasksCompleted,
            changePercent:
              previous.tasksCompleted > 0
                ? ((current.tasksCompleted - previous.tasksCompleted) /
                    previous.tasksCompleted) *
                  100
                : 0,
            unit: 'tasks',
            trend: getTrend(current.tasksCompleted, previous.tasksCompleted),
            positive: true,
          },
          {
            label: 'Completion Rate',
            current: current.completionRate,
            previous: previous.completionRate,
            change: current.completionRate - previous.completionRate,
            changePercent:
              previous.completionRate > 0
                ? ((current.completionRate - previous.completionRate) /
                    previous.completionRate) *
                  100
                : 0,
            unit: '%',
            trend: getTrend(current.completionRate, previous.completionRate),
            positive: true,
          },
          {
            label: 'Avg Completion Time',
            current: current.avgCompletionTime,
            previous: previous.avgCompletionTime,
            change: current.avgCompletionTime - previous.avgCompletionTime,
            changePercent:
              previous.avgCompletionTime > 0
                ? ((current.avgCompletionTime - previous.avgCompletionTime) /
                    previous.avgCompletionTime) *
                  100
                : 0,
            unit: 'h',
            trend: getTrend(previous.avgCompletionTime, current.avgCompletionTime), // Reversed - lower is better
            positive: false, // Lower is better
          },
          {
            label: 'Total Hours',
            current: current.totalHours,
            previous: previous.totalHours,
            change: current.totalHours - previous.totalHours,
            changePercent:
              previous.totalHours > 0
                ? ((current.totalHours - previous.totalHours) / previous.totalHours) *
                  100
                : 0,
            unit: 'h',
            trend: getTrend(current.totalHours, previous.totalHours),
            positive: true,
          },
        ];

        setMetrics(compareMetrics);
      }
    } catch (error) {
      console.error('Failed to load benchmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodData = async (
    dbExec: (query: string, params?: any[]) => Promise<any>,
    startTime: number,
    endTime: number
  ): Promise<Omit<BenchmarkData, 'period'>> => {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
        ROUND(
          AVG(
            CASE 
              WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
              THEN (completed_at - started_at) / 1000.0 / 3600.0
              ELSE NULL 
            END
          ),
          2
        ) as avgTime,
        ROUND(
          SUM(
            CASE 
              WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
              THEN (completed_at - started_at) / 1000.0 / 3600.0
              ELSE 0 
            END
          ),
          2
        ) as totalTime,
        COUNT(DISTINCT assigned_to) as agents
      FROM tasks
      WHERE created_at BETWEEN ? AND ?
    `;

    const result = await dbExec(statsQuery, [startTime, endTime]);
    const row = result?.result?.[0] || {};

    return {
      tasksCompleted: row.completed || 0,
      completionRate:
        row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
      avgCompletionTime: row.avgTime || 0,
      totalHours: row.totalTime || 0,
      activeAgents: row.agents || 0,
    };
  };

  const getTrend = (
    current: number,
    previous: number
  ): 'up' | 'down' | 'stable' => {
    const diff = current - previous;
    const threshold = Math.abs(previous * 0.05); // 5% threshold

    if (Math.abs(diff) < threshold) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', positive: boolean) => {
    if (trend === 'stable')
      return <Minus size={16} className="text-clawd-text-dim" />;
    if (trend === 'up')
      return (
        <ArrowUp
          size={16}
          className={positive ? 'text-green-400' : 'text-red-400'}
        />
      );
    return (
      <ArrowDown
        size={16}
        className={positive ? 'text-red-400' : 'text-green-400'}
      />
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-clawd-text-dim">
          <RefreshCw size={20} className="animate-spin" />
          Loading benchmarks...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="text-clawd-accent" size={20} />
            Performance Benchmarks
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Track performance trends over time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-clawd-border rounded-lg p-1">
            {(['wow', 'mom', 'yoy'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCompareMode(mode)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  compareMode === mode
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {mode === 'wow'
                  ? 'Week/Week'
                  : mode === 'mom'
                  ? 'Month/Month'
                  : 'Year/Year'}
              </button>
            ))}
          </div>

          <button
            onClick={loadBenchmarks}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-clawd-surface border border-clawd-border rounded-xl p-4"
          >
            <div className="text-sm text-clawd-text-dim mb-1">{metric.label}</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold">
                {metric.current.toLocaleString()}
              </span>
              <span className="text-sm text-clawd-text-dim">{metric.unit}</span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon(metric.trend, metric.positive)}
              <span
                className={`text-sm font-medium ${
                  metric.trend === 'up'
                    ? metric.positive
                      ? 'text-green-400'
                      : 'text-red-400'
                    : metric.trend === 'down'
                    ? metric.positive
                      ? 'text-red-400'
                      : 'text-green-400'
                    : 'text-clawd-text-dim'
                }`}
              >
                {metric.change > 0 ? '+' : ''}
                {metric.change.toLocaleString()} ({metric.changePercent > 0 ? '+' : ''}
                {metric.changePercent.toFixed(1)}%)
              </span>
            </div>
            <div className="text-xs text-clawd-text-dim mt-1">
              vs previous period
            </div>
          </div>
        ))}
      </div>

      {/* Trend Charts */}
      <div className="space-y-6">
        {/* Tasks Completed Trend */}
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Tasks Completed Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={benchmarks}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
              <XAxis dataKey="period" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--clawd-surface)',
                  border: '1px solid var(--clawd-border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="tasksCompleted"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981' }}
                name="Tasks Completed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Completion Rate Trend */}
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Completion Rate Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={benchmarks}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
              <XAxis dataKey="period" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--clawd-surface)',
                  border: '1px solid var(--clawd-border)',
                  borderRadius: '8px',
                }}
                formatter={(value: any) => `${value}%`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="completionRate"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ fill: '#8B5CF6' }}
                name="Completion Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Average Time & Total Hours */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Avg Completion Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={benchmarks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
                <XAxis dataKey="period" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--clawd-surface)',
                    border: '1px solid var(--clawd-border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => `${value}h`}
                />
                <Line
                  type="monotone"
                  dataKey="avgCompletionTime"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Total Hours Logged</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={benchmarks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
                <XAxis dataKey="period" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--clawd-surface)',
                    border: '1px solid var(--clawd-border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => `${value}h`}
                />
                <Line
                  type="monotone"
                  dataKey="totalHours"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 bg-clawd-surface border border-clawd-border rounded-2xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-clawd-accent" />
          Period Insights
        </h3>
        <div className="space-y-3">
          {metrics.map((metric) => {
            const isPositive =
              (metric.trend === 'up' && metric.positive) ||
              (metric.trend === 'down' && !metric.positive);
            const isNegative =
              (metric.trend === 'up' && !metric.positive) ||
              (metric.trend === 'down' && metric.positive);

            return (
              <div
                key={metric.label}
                className={`p-3 rounded-lg ${
                  isPositive
                    ? 'bg-green-500/10 border border-green-500/20'
                    : isNegative
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-clawd-bg border border-clawd-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(metric.trend, metric.positive)}
                    <span
                      className={
                        isPositive
                          ? 'text-green-400'
                          : isNegative
                          ? 'text-red-400'
                          : 'text-clawd-text-dim'
                      }
                    >
                      {metric.trend === 'up'
                        ? 'Increased'
                        : metric.trend === 'down'
                        ? 'Decreased'
                        : 'Stable'}{' '}
                      by {Math.abs(metric.changePercent).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
