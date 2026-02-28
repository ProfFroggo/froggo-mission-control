/**
 * Centralized chart theme constants for Recharts components.
 * All chart components should import colors from here instead of using inline hex values.
 */

// Semantic chart data colors
export const CHART_COLORS = {
  blue: '#3B82F6',
  green: '#10B981',
  purple: '#8B5CF6',
  amber: '#F59E0B',
  red: '#EF4444',
  cyan: '#06B6D4',
  pink: '#EC4899',
  orange: '#F97316',
  indigo: '#6366F1',
  teal: '#14B8A6',
  yellow: '#EAB308',
  lime: '#84CC16',
  gray: '#6B7280',
} as const;

// Ordered palette for indexed access (pie charts, multi-series, etc.)
export const CHART_PALETTE = Object.values(CHART_COLORS);

/** Get a chart color by index, cycling through the palette */
export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

// Axis styling constants
export const CHART_AXIS = {
  stroke: '#9CA3AF',
  fontSize: 10,
} as const;

// Grid styling constants
export const CHART_GRID = {
  stroke: '#374151',
  strokeDasharray: '3 3',
} as const;

// Tooltip styling constants (for Recharts contentStyle prop)
export const CHART_TOOLTIP = {
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#F3F4F6',
} as const;
