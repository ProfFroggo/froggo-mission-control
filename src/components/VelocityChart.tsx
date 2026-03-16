// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Loader2, Download, Copy, Check } from 'lucide-react';

interface WeekBucket {
  weekStart: string;
  created: number;
  completed: number;
  inProgress: number;
}

interface Props {
  weeks?: number;
}

const CHART_H = 280;
const CHART_PADDING = { top: 16, right: 16, bottom: 40, left: 48 };
const BAR_GAP = 4;

const COLORS = {
  created: 'var(--color-info, #3b82f6)',
  completed: 'var(--color-success, #22c55e)',
  inProgress: 'var(--color-warning, #f59e0b)',
};

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

function buildBomCsv(data: WeekBucket[]): string {
  const BOM = '\uFEFF';
  const header = 'Week Start,Created,Completed,In Progress\n';
  const rows = data
    .map((w) => `${w.weekStart},${w.created},${w.completed},${w.inProgress}`)
    .join('\n');
  return BOM + header + rows;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VelocityChart({ weeks = 8 }: Props) {
  const [data, setData] = useState<WeekBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/velocity?weeks=${weeks}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { weeks: WeekBucket[] };
      setData(json.weeks ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => {
    load();
  }, [load]);

  function handleExportCsv() {
    downloadCsv(buildBomCsv(data), `velocity-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async function handleCopy() {
    const csv = buildBomCsv(data);
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-mission-control-text-dim" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-mission-control-text-dim">
        {error ? 'Failed to load velocity data.' : 'No data for this period.'}
      </div>
    );
  }

  // Compute chart dimensions
  const maxVal = Math.max(...data.map((w) => w.created + w.completed + w.inProgress), 1);
  const chartW = 700; // viewBox units
  const innerW = chartW - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;
  const groupW = innerW / data.length;
  const barW = Math.max(groupW - BAR_GAP * 2, 6);

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxVal * i) / tickCount)
  );

  function yPos(val: number): number {
    return CHART_PADDING.top + innerH - (val / maxVal) * innerH;
  }

  function barX(groupIdx: number): number {
    return CHART_PADDING.left + groupIdx * groupW + (groupW - barW) / 2;
  }

  // Stacked bars: created (bottom), completed (middle), inProgress (top)
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-mission-control-accent" />
          <span className="font-medium">Task Velocity</span>
          <span className="text-xs text-mission-control-text-dim">last {weeks} weeks</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
            title="Export velocity as CSV"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.created }} />
          Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.completed }} />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORS.inProgress }} />
          In Progress
        </span>
      </div>

      {/* SVG chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${CHART_H}`}
          className="w-full min-w-[360px]"
          aria-label="Task velocity stacked bar chart"
        >
          {/* Y-axis ticks & grid lines */}
          {yTicks.map((tick) => {
            const y = yPos(tick);
            return (
              <g key={tick}>
                <line
                  x1={CHART_PADDING.left}
                  y1={y}
                  x2={chartW - CHART_PADDING.right}
                  y2={y}
                  stroke="var(--color-border, #334155)"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
                <text
                  x={CHART_PADDING.left - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="var(--color-text-dim, #64748b)"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Stacked bars */}
          {data.map((w, i) => {
            const x = barX(i);
            const stackedTotal = w.created + w.completed + w.inProgress;
            const h_created = (w.created / maxVal) * innerH;
            const h_completed = (w.completed / maxVal) * innerH;
            const h_inProgress = (w.inProgress / maxVal) * innerH;
            const baseY = yPos(0);
            const label = formatWeek(w.weekStart);

            return (
              <g key={w.weekStart}>
                {/* created segment (bottom) */}
                {w.created > 0 && (
                  <rect
                    x={x}
                    y={baseY - h_created}
                    width={barW}
                    height={h_created}
                    fill={COLORS.created}
                    opacity={0.85}
                    rx={1}
                  />
                )}
                {/* completed segment (middle) */}
                {w.completed > 0 && (
                  <rect
                    x={x}
                    y={baseY - h_created - h_completed}
                    width={barW}
                    height={h_completed}
                    fill={COLORS.completed}
                    opacity={0.85}
                    rx={1}
                  />
                )}
                {/* inProgress segment (top) */}
                {w.inProgress > 0 && (
                  <rect
                    x={x}
                    y={baseY - h_created - h_completed - h_inProgress}
                    width={barW}
                    height={h_inProgress}
                    fill={COLORS.inProgress}
                    opacity={0.85}
                    rx={1}
                  />
                )}
                {/* Total label above bar */}
                {stackedTotal > 0 && (
                  <text
                    x={x + barW / 2}
                    y={baseY - h_created - h_completed - h_inProgress - 3}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--color-text-dim, #64748b)"
                  >
                    {stackedTotal}
                  </text>
                )}
                {/* X-axis label */}
                <text
                  x={x + barW / 2}
                  y={baseY + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--color-text-dim, #64748b)"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* X-axis baseline */}
          <line
            x1={CHART_PADDING.left}
            y1={yPos(0)}
            x2={chartW - CHART_PADDING.right}
            y2={yPos(0)}
            stroke="var(--color-border, #334155)"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
}
