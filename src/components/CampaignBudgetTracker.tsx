'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Heading, Box, Flex } from '@radix-ui/themes';

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
  if (ratio > 1.05) return <TrendingUp size={12} className="text-[var(--color-error)]" />;
  if (ratio > 0.9) return <Minus size={12} className="text-[var(--color-warning)]" />;
  return <TrendingDown size={12} className="text-[var(--color-success)]" />;
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
    <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg space-y-4">
      <Flex align="center" gap="1">
        <DollarSign size={14} className="text-mission-control-text-dim" />
        <Heading size="2" weight="medium">Budget Tracker</Heading>
      </Flex>

      {/* Ring + stats */}
      <Flex align="center" gap="6">
        {/* Circular progress ring */}
        <Box className="relative flex-shrink-0 w-[88px] h-[88px]">
          <ProgressRing radius={44} strokeWidth={8} percentage={consumedPct} color={ringColor} />
          <Flex direction="column" align="center" justify="center" className="absolute inset-0">
            <span className="text-base font-bold leading-none tabular-nums" style={{ color: ringColor }}>
              {consumedPct}%
            </span>
            <span className="text-xs text-mission-control-text-dim mt-0.5">used</span>
          </Flex>
        </Box>

        {/* Summary stats */}
        <Box className="grid grid-cols-1 gap-2 flex-1 min-w-0">
          <Flex align="center" justify="between">
            <span className="text-xs text-mission-control-text-dim">Total budget</span>
            <span className="text-sm font-semibold tabular-nums text-mission-control-text">
              {currency} {fmt(budget)}
            </span>
          </Flex>
          <Flex align="center" justify="between">
            <span className="text-xs text-mission-control-text-dim">Spent</span>
            <span
              className={`text-sm font-semibold tabular-nums ${isOverBudget ? 'text-[var(--color-error)]' : 'text-mission-control-text'}`}
            >
              {currency} {fmt(spent)}
              {isOverBudget && (
                <span className="text-xs font-normal ml-1 text-[var(--color-error)]">(over budget)</span>
              )}
            </span>
          </Flex>
          <Flex align="center" justify="between">
            <span className="text-xs text-mission-control-text-dim">Remaining</span>
            <span className="text-sm font-semibold tabular-nums text-[var(--color-success)]">
              {currency} {fmt(remaining)}
            </span>
          </Flex>
        </Box>
      </Flex>

      {/* Progress bar */}
      <Box>
        <Box className="h-2 bg-mission-control-border rounded-full overflow-hidden">
          <Box
            className="h-full rounded-full transition-colors duration-500"
            style={{ width: `${Math.min(100, consumedPct)}%`, backgroundColor: ringColor }}
          />
        </Box>
      </Box>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <Box pt="2" className="space-y-2 border-t border-mission-control-border">
          <Heading size="1" weight="medium" className="text-mission-control-text-dim uppercase tracking-wider">
            By Category
          </Heading>
          <Box className="space-y-2">
            {categories.map(cat => {
              const catPct = cat.planned > 0 ? Math.min(100, Math.round((cat.actual / cat.planned) * 100)) : 0;
              const color = varianceColor(cat.planned, cat.actual);
              return (
                <Box key={cat.name} className="space-y-1">
                  <Flex align="center" justify="between" className="text-xs">
                    <Flex align="center" gap="1">
                      <VarianceIcon planned={cat.planned} actual={cat.actual} />
                      <span className="text-mission-control-text font-medium">{cat.name}</span>
                    </Flex>
                    <Flex align="center" gap="2" className="text-mission-control-text-dim">
                      <span>
                        <span style={{ color }}>{currency} {fmt(cat.actual)}</span>
                        {' / '}
                        <span>{currency} {fmt(cat.planned)}</span>
                      </span>
                    </Flex>
                  </Flex>
                  <Box className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                    <Box
                      className="h-full rounded-full transition-colors"
                      style={{ width: `${catPct}%`, backgroundColor: color }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
