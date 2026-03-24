// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Premium KPI stat card — large number + trend indicator + optional sparkline.
 *
 * Usage:
 *   <StatCard
 *     label="Total Completed"
 *     value={142}
 *     change={+12.4}
 *     color={CHART_COLORS.accent}
 *     sparkData={data.map(d => ({ v: d.completed }))}
 *   />
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Percentage change vs previous period. Omit to hide trend indicator. */
  change?: number;
  /** Color for the value text and sparkline. Defaults to accent. */
  color?: string;
  /** Array of objects with a `v` property for the sparkline. */
  sparkData?: Array<{ v: number }>;
  /** Optional icon shown beside the label */
  icon?: ReactNode;
  /** Optional suffix after value (e.g. "h", "%") */
  unit?: string;
  className?: string;
}

function TrendBadge({ change }: { change: number }) {
  const abs = Math.abs(change).toFixed(1);
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-success">
        <TrendingUp size={11} />
        {abs}%
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-error">
        <TrendingDown size={11} />
        {abs}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-mission-control-text-dim">
      <Minus size={11} />
      0%
    </span>
  );
}

export default function StatCard({
  label,
  value,
  change,
  color = 'var(--mission-control-accent)',
  sparkData,
  icon,
  unit,
  className = '',
}: StatCardProps) {
  const gradId = `spark-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      className={`relative overflow-hidden bg-mission-control-surface border border-mission-control-border rounded-xl p-4 flex flex-col gap-3 ${className}`}
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-mission-control-text-dim">{icon}</span>}
        <span className="text-xs font-medium text-mission-control-text-dim">{label}</span>
      </div>

      {/* Value + sparkline */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span
            className="text-3xl font-bold tabular-nums leading-none tracking-tight"
            style={{ color }}
          >
            {value}
            {unit && (
              <span className="text-lg font-semibold ml-0.5 opacity-70">{unit}</span>
            )}
          </span>
          {change !== undefined && (
            <div className="mt-1.5">
              <TrendBadge change={change} />
            </div>
          )}
        </div>

        {sparkData && sparkData.length > 1 && (
          <div className="h-12 w-20 flex-shrink-0 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  fillOpacity={1}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Subtle accent glow strip at the top */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
    </div>
  );
}
