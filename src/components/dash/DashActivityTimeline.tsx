// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashActivityTimeline — 24-bar activity chart showing task creations and
 * completions over the last 24h (1h buckets) or 48h (2h buckets).
 * Data is derived entirely client-side from the store's task array.
 */
import { Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../../store/store';

export interface DashActivityTimelineProps {
  range: '24h' | '48h';
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-mission-control-text-dim mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: p.fill }}
          />
          <span className="text-mission-control-text">
            {p.value} {p.dataKey}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DashActivityTimeline({ range }: DashActivityTimelineProps) {
  const { tasks } = useStore();

  const bucketMs =
    range === '24h' ? 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff =
    now - (range === '24h' ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000);
  const NUM_BUCKETS = 24;

  const buckets = Array.from({ length: NUM_BUCKETS }, (_, i) => {
    const bucketStart = cutoff + i * bucketMs;
    const bucketEnd = bucketStart + bucketMs;
    const label = new Date(bucketStart).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    });

    const created = tasks.filter(
      (t) => t.createdAt >= bucketStart && t.createdAt < bucketEnd,
    ).length;

    const completed = tasks.filter(
      (t) =>
        t.status === 'done' &&
        t.updatedAt >= bucketStart &&
        t.updatedAt < bucketEnd,
    ).length;

    return { label, created, completed, bucketStart };
  });

  const isEmpty = buckets.every((b) => b.created === 0 && b.completed === 0);

  // Show every 4th x-axis label to avoid crowding
  const tickFormatter = (_: string, index: number) =>
    index % 4 === 0 ? buckets[index]?.label ?? '' : '';

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Activity size={16} className="text-info-DEFAULT" />
          Task Activity
        </h2>
        <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
          <span className="w-2 h-2 rounded-full bg-info-DEFAULT inline-block" />
          <span>Created</span>
          <span className="w-2 h-2 rounded-full bg-success-DEFAULT inline-block ml-2" />
          <span>Completed</span>
        </div>
      </div>

      {/* Chart or empty state */}
      {isEmpty ? (
        <div className="flex items-center justify-center h-32 text-mission-control-text-dim/50">
          <div className="text-center">
            <Activity size={20} className="mx-auto mb-1 opacity-30" />
            <p className="text-xs">No activity in this period</p>
          </div>
        </div>
      ) : (
        <div className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={buckets}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tickFormatter={tickFormatter}
                tick={{ fontSize: 10, fill: 'var(--mission-control-text-dim)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                hide
                allowDecimals={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              {/* created (blue) renders first — sits at the bottom of the stack */}
              <Bar
                dataKey="created"
                stackId="a"
                fill="var(--color-info)"
                radius={[0, 0, 0, 0]}
              />
              {/* completed (green) renders on top */}
              <Bar
                dataKey="completed"
                stackId="a"
                fill="var(--color-success)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default DashActivityTimeline;
