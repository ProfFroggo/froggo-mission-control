'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BudgetCategory {
  name: string;
  planned: number;
  actual: number;
}

interface CampaignBudgetTrackerProps {
  budget: number;
  spent: number;
  categories?: BudgetCategory[];
  currency?: string;
}

// Circular SVG progress ring
function ProgressRing({
  radius,
  strokeWidth,
  percentage,
  color,
}: {
  radius: number;
  strokeWidth: number;
  percentage: number;
  color: string;
}) {
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <svg width={radius * 2} height={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
      {/* Track */}
      <circle
        stroke="var(--mission-control-border, #2a2a2a)"
        fill="transparent"
        strokeWidth={strokeWidth}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      {/* Progress arc */}
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

function varianceColor(planned: number, actual: number): string {
  if (actual === 0) return 'var(--mission-control-text-dim)';
  const ratio = actual / planned;
  if (ratio > 1.05) return 'var(--color-error, #ef4444)';
  if (ratio > 0.9) return 'var(--color-warning, #eab308)';
  return 'var(--color-success, #22c55e)';
}

function VarianceIcon({ planned, actual }: { planned: number; actual: number }) {
  if (actual === 0) return <Minus size={12} className="text-mission-control-text-dim" />;
  const ratio = actual / planned;
  if (ratio > 1.05) return <TrendingUp size={12} style={{ color: 'var(--color-error, #ef4444)' }} />;
  if (ratio > 0.9) return <Minus size={12} style={{ color: 'var(--color-warning, #eab308)' }} />;
  return <TrendingDown size={12} style={{ color: 'var(--color-success, #22c55e)' }} />;
}

export default function CampaignBudgetTracker({
  budget,
  spent,
  categories = [],
  currency = 'USD',
}: CampaignBudgetTrackerProps) {
  if (budget <= 0) return null;

  const remaining = Math.max(0, budget - spent);
  const consumedPct = Math.min(100, Math.round((spent / budget) * 100));
  const isOverBudget = spent > budget;

  const ringColor = isOverBudget
    ? 'var(--color-error, #ef4444)'
    : consumedPct > 70
      ? 'var(--color-warning, #eab308)'
      : 'var(--color-success, #22c55e)';

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-1.5">
        <DollarSign size={14} className="text-mission-control-text-dim" />
        <h3 className="text-sm font-medium text-mission-control-text">Budget Tracker</h3>
      </div>

      {/* Ring + stats */}
      <div className="flex items-center gap-6">
        {/* Circular progress ring */}
        <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>
          <ProgressRing radius={44} strokeWidth={8} percentage={consumedPct} color={ringColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold leading-none" style={{ color: ringColor }}>
              {consumedPct}%
            </span>
            <span className="text-[10px] text-mission-control-text-dim mt-0.5">used</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-2 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-mission-control-text-dim">Total budget</span>
            <span className="text-sm font-semibold text-mission-control-text-primary">
              {currency} {fmt(budget)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-mission-control-text-dim">Spent</span>
            <span
              className="text-sm font-semibold"
              style={{ color: isOverBudget ? 'var(--color-error, #ef4444)' : 'var(--mission-control-text-primary)' }}
            >
              {currency} {fmt(spent)}
              {isOverBudget && (
                <span className="text-xs font-normal ml-1 text-error">(over budget)</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-mission-control-text-dim">Remaining</span>
            <span className="text-sm font-semibold text-success">
              {currency} {fmt(remaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, consumedPct)}%`, backgroundColor: ringColor }}
          />
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-mission-control-border">
          <h4 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
            By Category
          </h4>
          <div className="space-y-2">
            {categories.map(cat => {
              const catPct = cat.planned > 0 ? Math.min(100, Math.round((cat.actual / cat.planned) * 100)) : 0;
              const color = varianceColor(cat.planned, cat.actual);
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <VarianceIcon planned={cat.planned} actual={cat.actual} />
                      <span className="text-mission-control-text-primary font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-mission-control-text-dim">
                      <span>
                        <span style={{ color }}>{currency} {fmt(cat.actual)}</span>
                        {' / '}
                        <span>{currency} {fmt(cat.planned)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${catPct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
