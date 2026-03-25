// LEGACY: PerformanceBenchmarks uses file-level suppression for intentional patterns.
// loadBenchmarks is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
} from 'lucide-react';
import { Flex } from '@radix-ui/themes';
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
import { CHART_COLORS, CHART_AXIS } from '../lib/chartTheme';
import ErrorDisplay from './ErrorDisplay';

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
  const [error, setError] = useState<Error | null>(null);
  const [compareMode, setCompareMode] = useState<'wow' | 'mom' | 'yoy'>('wow'); // Week/Month/Year over X
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [metrics, setMetrics] = useState<ComparisonMetric[]>([]);

  useEffect(() => {
    loadBenchmarks();
  }, [compareMode]);

  const loadBenchmarks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetch(`/api/analytics/benchmarks?mode=${compareMode}`).then(r => r.ok ? r.json() : null).catch(() => null);

      if (!result) {
        // No benchmark data — compute from task stats
        const taskStats = await fetch('/api/analytics/task-stats').then(r => r.ok ? r.json() : null).catch(() => null);
        const completed = taskStats?.completedToday || 0;
        const total = (taskStats?.active || 0) + completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const periods: BenchmarkData[] = [{
          period: 'Current',
          tasksCompleted: completed,
          completionRate: rate,
          avgCompletionTime: 0,
          totalHours: 0,
          activeAgents: taskStats?.activeAgents || 0,
        }];
        setBenchmarks(periods);
        setMetrics([]);
        setLoading(false);
        return;
      }

      const periods: BenchmarkData[] = (result.periods || []) as BenchmarkData[];
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
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
      return <Minus size={16} className="text-mission-control-text-dim" />;
    if (trend === 'up')
      return (
        <ArrowUp
          size={16}
          className={positive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}
        />
      );
    return (
      <ArrowDown
        size={16}
        className={positive ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}
      />
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Flex align="center" gap="2" className="text-mission-control-text-dim">
          <RefreshCw size={20} className="animate-spin" />
          Loading benchmarks...
        </Flex>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={loadBenchmarks} context={{ action: 'load performance benchmarks' }} />;
  }

  return (
    <Flex direction="column" height="100%" className="overflow-y-auto">
      {/* Header */}
      <Flex align="center" justify="between" className="mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="text-mission-control-accent" size={20} />
            Performance Benchmarks
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Track performance trends over time
          </p>
        </div>

        <Flex align="center" gap="3">
          <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
            {(['wow', 'mom', 'yoy'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCompareMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  compareMode === mode
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
                }`}
              >
                {mode === 'wow' ? 'Week/Week' : mode === 'mom' ? 'Month/Month' : 'Year/Year'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadBenchmarks}
            title="Refresh"
            aria-label="Refresh"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </Flex>
      </Flex>

      {/* Comparison Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => {
          const deltaColor =
            metric.trend === 'up'
              ? metric.positive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
              : metric.trend === 'down'
              ? metric.positive ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'
              : 'text-mission-control-text-dim';
          const deltaSign = metric.changePercent > 0 ? '+' : '';
          return (
            <div
              key={metric.label}
              className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-4"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">{metric.label}</div>
              <Flex align="baseline" gap="1.5" className="mb-2">
                <span className="text-2xl font-bold tabular-nums text-mission-control-text">
                  {metric.current.toLocaleString()}
                </span>
                <span className="text-sm text-mission-control-text-dim">{metric.unit}</span>
              </Flex>
              <Flex align="center" gap="1.5">
                {getTrendIcon(metric.trend, metric.positive)}
                <span className={`text-xs font-medium tabular-nums ${deltaColor}`}>
                  {deltaSign}{metric.changePercent.toFixed(1)}%
                </span>
              </Flex>
              <div className="text-[10px] text-mission-control-text-dim/70 mt-1">
                vs previous period
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend Charts */}
      <div className="space-y-6">
        {/* Tasks Completed Trend */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-4">Tasks Completed Trend</div>
          <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={benchmarks}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
              <XAxis dataKey="period" stroke={CHART_AXIS.stroke} />
              <YAxis stroke={CHART_AXIS.stroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--mission-control-surface)',
                  border: '1px solid var(--mission-control-border)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="tasksCompleted"
                stroke={CHART_COLORS.accent}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.accent }}
                name="Tasks Completed"
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Completion Rate Trend */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-4">Completion Rate Trend</div>
          <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={benchmarks}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
              <XAxis dataKey="period" stroke={CHART_AXIS.stroke} />
              <YAxis stroke={CHART_AXIS.stroke} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--mission-control-surface)',
                  border: '1px solid var(--mission-control-border)',
                  borderRadius: '8px',
                }}
                formatter={(value: any) => `${value}%`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="completionRate"
                stroke={CHART_COLORS.purple}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.purple }}
                name="Completion Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Average Time & Total Hours */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-4">Avg Completion Time</div>
            <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={benchmarks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
                <XAxis dataKey="period" stroke={CHART_AXIS.stroke} />
                <YAxis stroke={CHART_AXIS.stroke} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--mission-control-surface)',
                    border: '1px solid var(--mission-control-border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => `${value}h`}
                />
                <Line
                  type="monotone"
                  dataKey="avgCompletionTime"
                  stroke={CHART_COLORS.amber}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.amber }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-4">Total Hours Logged</div>
            <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={benchmarks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
                <XAxis dataKey="period" stroke={CHART_AXIS.stroke} />
                <YAxis stroke={CHART_AXIS.stroke} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--mission-control-surface)',
                    border: '1px solid var(--mission-control-border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => `${value}h`}
                />
                <Line
                  type="monotone"
                  dataKey="totalHours"
                  stroke={CHART_COLORS.blue}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.blue }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
        <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-4 flex items-center gap-2">
          <Calendar size={12} className="text-mission-control-accent" />
          Period Insights
        </div>
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
                    ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/30'
                    : isNegative
                    ? 'bg-[var(--color-error)]/10 border border-[var(--color-error)]/30'
                    : 'bg-mission-control-bg border border-mission-control-border'
                }`}
              >
                <Flex align="center" justify="between">
                  <span className="font-medium">{metric.label}</span>
                  <Flex align="center" gap="2">
                    {getTrendIcon(metric.trend, metric.positive)}
                    <span
                      className={
                        isPositive
                          ? 'text-[var(--color-success)]'
                          : isNegative
                          ? 'text-[var(--color-error)]'
                          : 'text-mission-control-text-dim'
                      }
                    >
                      {metric.trend === 'up'
                        ? 'Increased'
                        : metric.trend === 'down'
                        ? 'Decreased'
                        : 'Stable'}{' '}
                      by <span className="tabular-nums font-mono">{Math.abs(metric.changePercent).toFixed(1)}%</span>
                    </span>
                  </Flex>
                </Flex>
              </div>
            );
          })}
        </div>
      </div>
    </Flex>
  );
}
