// LEGACY: TaskTrendsChart uses file-level suppression for intentional patterns.
// loadData is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, BarChart2, Activity } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { getTaskCompletionTrends, TaskCompletionTrend } from '../services/analyticsService';
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_AXIS,
  CHART_MARGIN,
  premiumAreaProps,
  premiumLineProps,
} from '../lib/chartTheme';
import ChartTooltip from './charts/ChartTooltip';
import StatCard from './charts/StatCard';

type ChartType = 'area' | 'line' | 'bar';

const VIEWS: Array<{ key: ChartType; icon: typeof Activity }> = [
  { key: 'area', icon: Activity },
  { key: 'line', icon: TrendingUp },
  { key: 'bar',  icon: BarChart2 },
];

export default function TaskTrendsChart({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<TaskCompletionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('area');

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const trends = await getTaskCompletionTrends(days);
      setData(trends);
    } catch (err) {
      console.warn('[TaskTrendsChart] Non-critical:', err);
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  const chartData = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const totalCreated   = data.reduce((s, d) => s + d.created, 0);
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const avgRate        = data.length
    ? Math.round(data.reduce((s, d) => s + d.completionRate, 0) / data.length)
    : 0;

  // Sparkline data
  const createdSpark   = data.map(d => ({ v: d.created }));
  const completedSpark = data.map(d => ({ v: d.completed }));
  const rateSpark      = data.map(d => ({ v: d.completionRate }));

  const renderChart = () => {
    if (chartType === 'line') {
      return (
        <LineChart data={chartData} margin={CHART_MARGIN}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="date" {...CHART_AXIS} />
          <YAxis {...CHART_AXIS} width={28} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Line dataKey="created"        name="Created"         {...premiumLineProps(CHART_COLORS.blue)}   />
          <Line dataKey="completed"      name="Completed"       {...premiumLineProps(CHART_COLORS.accent)} />
          <Line dataKey="completionRate" name="Completion Rate" {...premiumLineProps(CHART_COLORS.violet)} />
        </LineChart>
      );
    }

    if (chartType === 'bar') {
      return (
        <BarChart data={chartData} margin={CHART_MARGIN} barGap={4} barCategoryGap="28%">
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="date" {...CHART_AXIS} />
          <YAxis {...CHART_AXIS} width={28} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Bar dataKey="created"   name="Created"   fill={CHART_COLORS.blue}   radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }

    // area (default)
    return (
      <AreaChart data={chartData} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id="ttGradCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CHART_COLORS.blue}   stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.blue}   stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="ttGradCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={CHART_COLORS.accent} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART_GRID} />
        <XAxis dataKey="date" {...CHART_AXIS} />
        <YAxis {...CHART_AXIS} width={28} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Area dataKey="created"   name="Created"   {...premiumAreaProps(CHART_COLORS.blue,   'ttGradCreated')}   />
        <Area dataKey="completed" name="Completed" {...premiumAreaProps(CHART_COLORS.accent, 'ttGradCompleted')} />
      </AreaChart>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-mission-control-accent border-t-transparent animate-spin" />
          <span className="text-xs text-mission-control-text-dim">Loading trends…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Header */}
      <Flex align="center" justify="between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-mission-control-accent" />
            Task Completion Trends
          </h2>
          <p className="text-xs text-mission-control-text-dim mt-0.5">
            Creation and completion over the last {days} days
          </p>
        </div>

        {/* Chart type selector — tab style */}
        <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
          {VIEWS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setChartType(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs capitalize transition-colors ${
                chartType === key
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/50'
              }`}
            >
              <Icon size={12} />
              {key}
            </button>
          ))}
        </div>
      </Flex>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Created"
          value={totalCreated}
          color={CHART_COLORS.blue}
          sparkData={createdSpark}
        />
        <StatCard
          label="Total Completed"
          value={totalCompleted}
          color={CHART_COLORS.accent}
          sparkData={completedSpark}
        />
        <StatCard
          label="Avg Completion Rate"
          value={avgRate}
          unit="%"
          color={CHART_COLORS.violet}
          sparkData={rateSpark}
        />
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
