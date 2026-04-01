// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Premium Recharts tooltip — replaces the default browser-chrome style.
 * Usage: <Tooltip content={<ChartTooltip />} />
 */

import { Box, Flex } from '@radix-ui/themes';

interface TooltipEntry {
  name: string;
  value: number | string;
  color: string;
  unit?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number | string, name: string) => string;
}

export default function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter ? labelFormatter(label ?? '') : label;

  return (
    <Box
      className="min-w-[130px] rounded-xl border border-mission-control-border bg-mission-control-surface px-3 py-2.5 shadow-2xl shadow-black/40 text-xs"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      {displayLabel && (
        <p className="mb-2 font-medium text-mission-control-text-dim">{displayLabel}</p>
      )}
      <Flex direction="column" gap="1">
        {payload.map((entry) => {
          const displayValue = valueFormatter
            ? valueFormatter(entry.value, entry.name)
            : String(entry.value);
          return (
            <Flex key={entry.name} align="center" justify="between" gap="5">
              <span className="flex items-center gap-1.5 text-mission-control-text-dim">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: entry.color }}
              >
                {displayValue}
                {entry.unit && <span className="font-normal opacity-70 ml-0.5">{entry.unit}</span>}
              </span>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
}
