// LEGACY: TaskTrendsChart uses file-level suppression for intentional patterns.
// loadData is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getTaskCompletionTrends, TaskCompletionTrend } from '../services/analyticsService';
import { CHART_COLORS, CHART_GRID, CHART_AXIS } from '../lib/chartTheme';

export default function TaskTrendsChart() {
  const [data, setData] = useState<TaskCompletionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('area');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const trends = await getTaskCompletionTrends(timeRange);
      setData(trends);
    } catch (error) {
      // 'Failed to load task trends:', error;
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-clawd-surface border border-clawd-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any) => (
            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === 'Completion Rate' && '%'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const chartData = data.map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
          <XAxis dataKey="date" stroke={CHART_AXIS.stroke} />
          <YAxis stroke={CHART_AXIS.stroke} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="created"
            stroke={CHART_COLORS.blue}
            name="Created"
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.blue }}
          />
          <Line
            type="monotone"
            dataKey="completed"
            stroke={CHART_COLORS.green}
            name="Completed"
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.green }}
          />
          <Line
            type="monotone"
            dataKey="completionRate"
            stroke={CHART_COLORS.purple}
            name="Completion Rate"
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.purple }}
          />
        </LineChart>
      );
    }

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
          <XAxis dataKey="date" stroke={CHART_AXIS.stroke} />
          <YAxis stroke={CHART_AXIS.stroke} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="created" fill={CHART_COLORS.blue} name="Created" />
          <Bar dataKey="completed" fill={CHART_COLORS.green} name="Completed" />
        </BarChart>
      );
    }

    // area chart
    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.8} />
            <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.8} />
            <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
        <XAxis dataKey="date" stroke={CHART_AXIS.stroke} />
        <YAxis stroke={CHART_AXIS.stroke} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Area
          type="monotone"
          dataKey="created"
          stroke={CHART_COLORS.blue}
          fillOpacity={1}
          fill="url(#colorCreated)"
          name="Created"
        />
        <Area
          type="monotone"
          dataKey="completed"
          stroke={CHART_COLORS.green}
          fillOpacity={1}
          fill="url(#colorCompleted)"
          name="Completed"
        />
      </AreaChart>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-clawd-text-dim">Loading trends...</div>
      </div>
    );
  }

  const totalCreated = data.reduce((sum, d) => sum + d.created, 0);
  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
  const avgCompletionRate = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.completionRate, 0) / data.length)
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="text-clawd-accent" size={20} />
            Task Completion Trends
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Track task creation and completion over time
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chart type selector */}
          <div className="flex bg-clawd-border rounded-lg p-1">
            {(['area', 'line', 'bar'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                  chartType === type
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Time range selector */}
          <div className="flex bg-clawd-border rounded-lg p-1">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  timeRange === days
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1">Total Created</div>
          <div className="text-2xl font-bold text-info">{totalCreated}</div>
        </div>
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1">Total Completed</div>
          <div className="text-2xl font-bold text-success">{totalCompleted}</div>
        </div>
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1">Avg Completion Rate</div>
          <div className="text-2xl font-bold text-review">{avgCompletionRate}%</div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 bg-clawd-surface border border-clawd-border rounded-2xl p-6">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
