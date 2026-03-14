// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XEngagementChart — pure SVG line chart for X engagement analytics.
// Shows impressions, likes, and retweets over time with toggle buttons.

import { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart2, Eye, Heart, Repeat2, RefreshCw, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DailyData {
  date: string;
  posts: number;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
}

interface AnalyticsSummary {
  totalPosts: number;
  avgEngagement: number;
  topPost: { date: string | null; impressions: number };
  totalImpressions: number;
  totalLikes: number;
  totalRetweets: number;
}

type MetricKey = 'impressions' | 'likes' | 'retweets';

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  Icon: React.ElementType;
}

const METRICS: MetricConfig[] = [
  { key: 'impressions', label: 'Impressions', color: '#8b5cf6', Icon: Eye },
  { key: 'likes', label: 'Likes', color: '#ec4899', Icon: Heart },
  { key: 'retweets', label: 'Retweets', color: '#10b981', Icon: Repeat2 },
];

// ─── SVG Chart ────────────────────────────────────────────────────────────────

const CHART_H = 200;
const PADDING = { top: 16, right: 16, bottom: 40, left: 52 };

interface ChartProps {
  data: DailyData[];
  visible: Record<MetricKey, boolean>;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function SVGLineChart({ data, visible }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = CHART_H - PADDING.top - PADDING.bottom;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: 'var(--color-mission-control-text-dim)' }}>
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  const activeMetrics = METRICS.filter((m) => visible[m.key]);
  const allValues = activeMetrics.flatMap((m) => data.map((d) => d[m.key]));
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const xStep = chartW / Math.max(data.length - 1, 1);
  const toX = (i: number) => PADDING.left + i * xStep;
  const toY = (v: number) => PADDING.top + chartH - ((v - minVal) / range) * chartH;

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => minVal + (range / yTickCount) * i);

  // X-axis labels — show at most 7
  const xLabelStep = Math.max(1, Math.floor(data.length / 7));
  const xLabels = data
    .map((d, i) => ({ i, label: shortDate(d.date) }))
    .filter((_, i) => i % xLabelStep === 0 || i === data.length - 1);

  const buildPath = (metric: MetricKey) => {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(d[metric]).toFixed(1)}`)
      .join(' ');
  };

  const buildArea = (metric: MetricKey, color: string) => {
    const linePts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d[metric]).toFixed(1)}`).join(' L ');
    const bottom = toY(0).toFixed(1);
    return (
      <path
        d={`M ${toX(0).toFixed(1)},${bottom} L ${linePts} L ${toX(data.length - 1).toFixed(1)},${bottom} Z`}
        fill={color}
        fillOpacity={0.08}
      />
    );
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width={width} height={CHART_H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              y1={toY(tick)}
              x2={PADDING.left + chartW}
              y2={toY(tick)}
              stroke="var(--color-mission-control-border)"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '4 4'}
            />
            <text
              x={PADDING.left - 6}
              y={toY(tick) + 4}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-mission-control-text-dim)"
            >
              {formatNum(tick)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={toX(i)}
            y={CHART_H - 6}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-mission-control-text-dim)"
          >
            {label}
          </text>
        ))}

        {/* Areas + Lines */}
        {activeMetrics.map(({ key, color }) => (
          <g key={key}>
            {buildArea(key, color)}
            <path
              d={buildPath(key)}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* Data points */}
        {activeMetrics.map(({ key, color }) =>
          data.map((d, i) => (
            <circle
              key={`${key}-${i}`}
              cx={toX(i)}
              cy={toY(d[key])}
              r={3}
              fill={color}
              stroke="var(--color-mission-control-bg)"
              strokeWidth={1.5}
            />
          ))
        )}
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface XEngagementChartProps {
  days?: number;
}

export function XEngagementChart({ days = 30 }: XEngagementChartProps) {
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Record<MetricKey, boolean>>({
    impressions: true,
    likes: true,
    retweets: true,
  });
  const [selectedDays, setSelectedDays] = useState(days);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/analytics?days=${selectedDays}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setDaily(data.daily ?? []);
      setSummary(data.summary ?? null);
    } catch {
      // non-fatal — keep previous data
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleMetric = (key: MetricKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // At least one must be visible
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const totalImpressions = summary?.totalImpressions ?? 0;
  const totalLikes = summary?.totalLikes ?? 0;
  const totalRetweets = summary?.totalRetweets ?? 0;
  const avgLikes = daily.length > 0 ? Math.round(totalLikes / daily.length) : 0;
  const avgRetweets = daily.length > 0 ? Math.round(totalRetweets / daily.length) : 0;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'var(--color-mission-control-surface)',
        borderColor: 'var(--color-mission-control-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--color-mission-control-border)' }}
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={16} style={{ color: 'var(--color-info)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-mission-control-text)' }}>
            Engagement Over Time
          </span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-mission-control-text-dim)' }} />}
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded border"
            style={{
              background: 'var(--color-mission-control-bg)',
              borderColor: 'var(--color-mission-control-border)',
              color: 'var(--color-mission-control-text)',
            }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            onClick={loadData}
            className="p-1.5 rounded hover:opacity-70"
            style={{ color: 'var(--color-mission-control-text-dim)' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Summary stats bar */}
      <div
        className="grid grid-cols-3 border-b"
        style={{ borderColor: 'var(--color-mission-control-border)' }}
      >
        <div
          className="p-3 text-center border-r"
          style={{ borderColor: 'var(--color-mission-control-border)' }}
        >
          <div className="text-lg font-bold" style={{ color: '#8b5cf6' }}>
            {formatNum(totalImpressions)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-mission-control-text-dim)' }}>
            Total Impressions
          </div>
        </div>
        <div
          className="p-3 text-center border-r"
          style={{ borderColor: 'var(--color-mission-control-border)' }}
        >
          <div className="text-lg font-bold" style={{ color: '#ec4899' }}>
            {formatNum(avgLikes)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-mission-control-text-dim)' }}>
            Avg Likes / Day
          </div>
        </div>
        <div className="p-3 text-center">
          <div className="text-lg font-bold" style={{ color: '#10b981' }}>
            {formatNum(avgRetweets)}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-mission-control-text-dim)' }}>
            Avg Retweets / Day
          </div>
        </div>
      </div>

      {/* Toggle buttons */}
      <div className="flex items-center gap-2 px-4 pt-3">
        {METRICS.map(({ key, label, color, Icon }) => (
          <button
            key={key}
            onClick={() => toggleMetric(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={
              visible[key]
                ? { background: `${color}18`, color, borderColor: color }
                : {
                    background: 'var(--color-mission-control-surface)',
                    color: 'var(--color-mission-control-text-dim)',
                    borderColor: 'var(--color-mission-control-border)',
                    opacity: 0.6,
                  }
            }
          >
            <Icon size={12} style={{ color: visible[key] ? color : undefined }} />
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="p-4">
        <SVGLineChart data={daily} visible={visible} />
      </div>
    </div>
  );
}

export default XEngagementChart;
