// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Premium chart theme for Recharts.
 * All chart components import from here — single source of truth.
 */

// ─── Palette ──────────────────────────────────────────────────────────────────
// All 400-series: same brightness level, vibrant on dark backgrounds

export const CHART_COLORS = {
  accent: '#4ade80',  // green-400 — primary, matches mission-control-accent
  blue:   '#60a5fa',  // blue-400
  violet: '#a78bfa',  // violet-400
  amber:  '#fbbf24',  // amber-400
  rose:   '#fb7185',  // rose-400
  cyan:   '#22d3ee',  // cyan-400
  orange: '#fb923c',  // orange-400
  indigo: '#818cf8',  // indigo-400
  teal:   '#2dd4bf',  // teal-400
  pink:   '#f472b6',  // pink-400
  sky:    '#38bdf8',  // sky-400
  lime:   '#a3e635',  // lime-400
  gray:   '#9ca3af',  // gray-400
  // Aliases for backward compatibility
  purple: '#a78bfa',  // = violet
  red:    '#fb7185',  // = rose
  yellow: '#fbbf24',  // = amber
} as const;

// Ordered for indexed access (pie, multi-series, etc.)
export const CHART_PALETTE = [
  CHART_COLORS.accent,
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  CHART_COLORS.amber,
  CHART_COLORS.cyan,
  CHART_COLORS.rose,
  CHART_COLORS.indigo,
  CHART_COLORS.teal,
  CHART_COLORS.orange,
  CHART_COLORS.pink,
  CHART_COLORS.sky,
  CHART_COLORS.lime,
  CHART_COLORS.gray,
];

export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

// ─── Axis ─────────────────────────────────────────────────────────────────────
// Spread directly onto <XAxis> / <YAxis>: no axis lines, no tick marks.
// Also includes legacy `stroke` + `fontSize` fields for backward-compat.

export const CHART_AXIS = {
  tick: { fill: 'var(--mission-control-text-dim)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
  // Backward-compat (used as stroke={CHART_AXIS.stroke} in older components)
  stroke: 'var(--mission-control-text-dim)',
  fontSize: 11,
} as const;

// ─── Grid ─────────────────────────────────────────────────────────────────────
// Horizontal-only, solid lines, very subtle — no dashes.

export const CHART_GRID = {
  stroke: 'var(--mission-control-border)',
  strokeOpacity: 0.5,
  strokeDasharray: '',  // solid (overrides old "3 3" in existing spread usage)
  vertical: false,
} as const;

// Standard chart margins — tight
export const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 } as const;

// ─── Tooltip ──────────────────────────────────────────────────────────────────
// For Recharts contentStyle prop (built-in tooltip)

export const CHART_TOOLTIP = {
  backgroundColor: 'var(--mission-control-surface)',
  border: '1px solid var(--mission-control-border)',
  borderRadius: '12px',
  color: 'var(--mission-control-text)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  padding: '10px 14px',
  fontSize: '12px',
} as const;

// ─── Area helpers ─────────────────────────────────────────────────────────────

/** Props to spread on a <Area> for a premium gradient fill with smooth line */
export function premiumAreaProps(color: string, gradientId: string) {
  return {
    type: 'monotone' as const,
    stroke: color,
    strokeWidth: 2,
    fill: `url(#${gradientId})`,
    fillOpacity: 1,
    dot: false as const,
    activeDot: { r: 5, fill: color, strokeWidth: 0 },
  };
}

/** Props to spread on a <Line> — smooth, no dots, glowing active dot */
export function premiumLineProps(color: string) {
  return {
    type: 'monotone' as const,
    stroke: color,
    strokeWidth: 2,
    dot: false as const,
    activeDot: { r: 5, fill: color, strokeWidth: 0 },
  };
}

/** Gradient stop pairs for a vertical area gradient (subtle, 25% → 0%) */
export function areaGradientStops(color: string) {
  return { top: { color, opacity: 0.25 }, bottom: { color, opacity: 0 } };
}
