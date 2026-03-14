'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useMemo } from 'react';
import { TrendingUp, DollarSign, Users, MousePointerClick, Eye, Repeat2, BarChart2 } from 'lucide-react';
import type { Campaign, CampaignMetrics } from '../types/campaigns';

interface CampaignROIDashboardProps {
  campaign: Campaign;
  previousCampaign?: Campaign | null;
}

// ── SVG ring ────────────────────────────────────────────────────────────────
function ROIRing({ roi }: { roi: number }) {
  const RADIUS = 52;
  const STROKE = 10;
  const normalizedRadius = RADIUS - STROKE / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Clamp fill: 0–200% ROI mapped to 0–100% of the ring
  const fillPct = Math.min(100, Math.max(0, roi / 2));
  const strokeDashoffset = circumference - (fillPct / 100) * circumference;

  const color =
    roi >= 100
      ? 'var(--color-success, #22c55e)'
      : roi >= 50
      ? 'var(--color-warning, #eab308)'
      : 'var(--color-error, #ef4444)';

  const label =
    roi >= 100 ? 'Strong' : roi >= 50 ? 'Moderate' : 'Weak';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: RADIUS * 2, height: RADIUS * 2 }}>
        <svg
          width={RADIUS * 2}
          height={RADIUS * 2}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            stroke="var(--mission-control-border, #2a2a2a)"
            fill="transparent"
            strokeWidth={STROKE}
            r={normalizedRadius}
            cx={RADIUS}
            cy={RADIUS}
          />
          {/* ROI arc */}
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx={RADIUS}
            cy={RADIUS}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold leading-none" style={{ color }}>
            {roi > 0 ? `+${Math.round(roi)}` : Math.round(roi)}%
          </span>
          <span className="text-[10px] text-mission-control-text-dim mt-0.5">ROI</span>
        </div>
      </div>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full border"
        style={{
          color,
          borderColor: `${color}40`,
          backgroundColor: `${color}10`,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Attribution pie (pure SVG) ───────────────────────────────────────────────
interface PieSlice {
  label: string;
  pct: number;
  color: string;
}

function AttributionPie({ slices }: { slices: PieSlice[] }) {
  const SIZE = 120;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 44;

  // Build SVG arc paths
  const paths = useMemo(() => {
    const total = slices.reduce((s, sl) => s + sl.pct, 0) || 100;
    let startAngle = -Math.PI / 2;
    return slices.map(sl => {
      const angle = (sl.pct / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = CX + R * Math.cos(startAngle);
      const y1 = CY + R * Math.sin(startAngle);
      const x2 = CX + R * Math.cos(endAngle);
      const y2 = CY + R * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const result = { d, color: sl.color, label: sl.label, pct: sl.pct };
      startAngle = endAngle;
      return result;
    });
  }, [slices]);

  return (
    <div className="flex items-center gap-6">
      <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="var(--mission-control-bg0, #111)" strokeWidth={1.5} />
        ))}
        {/* Centre hole */}
        <circle cx={CX} cy={CY} r={22} fill="var(--mission-control-surface, #1a1a1a)" />
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sl.color }} />
            <span className="text-xs text-mission-control-text-primary">{sl.label}</span>
            <span className="text-xs text-mission-control-text-dim ml-auto pl-4">{sl.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comparison bar ────────────────────────────────────────────────────────────
function ComparisonBar({
  label,
  current,
  previous,
  format,
}: {
  label: string;
  current: number;
  previous: number;
  format?: (n: number) => string;
}) {
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const max = Math.max(current, previous, 1);
  const currentPct = (current / max) * 100;
  const previousPct = (previous / max) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-mission-control-text-dim">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-mission-control-text-dim w-16 text-right flex-shrink-0">Current</span>
        <div className="flex-1 h-2 rounded-full bg-mission-control-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${currentPct}%`, backgroundColor: 'var(--mission-control-accent, #6366f1)' }}
          />
        </div>
        <span className="text-xs font-medium text-mission-control-text-primary w-16 flex-shrink-0">{fmt(current)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-mission-control-text-dim w-16 text-right flex-shrink-0">Previous</span>
        <div className="flex-1 h-2 rounded-full bg-mission-control-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${previousPct}%`, backgroundColor: 'var(--mission-control-text-dim, #888)' }}
          />
        </div>
        <span className="text-xs font-medium text-mission-control-text-dim w-16 flex-shrink-0">{fmt(previous)}</span>
      </div>
    </div>
  );
}

// ── Metric pill ───────────────────────────────────────────────────────────────
function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2.5 min-w-[90px]">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-mission-control-text-dim flex-shrink-0" />
        <span className="text-[10px] text-mission-control-text-dim uppercase tracking-wider truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold text-mission-control-text-primary">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CampaignROIDashboard({ campaign, previousCampaign }: CampaignROIDashboardProps) {
  const metrics: CampaignMetrics = useMemo(() => {
    try { return campaign.metrics ? JSON.parse(campaign.metrics) : {}; } catch { return {}; }
  }, [campaign.metrics]);

  const prevMetrics: CampaignMetrics = useMemo(() => {
    try { return previousCampaign?.metrics ? JSON.parse(previousCampaign.metrics) : {}; } catch { return {}; }
  }, [previousCampaign]);

  const currency = campaign.currency ?? 'USD';
  const revenue = metrics.revenue ?? 0;
  const cost = metrics.cost ?? campaign.budgetSpent ?? 0;
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

  const fmtCurrency = (n: number) =>
    `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const attributionSlices: PieSlice[] = [
    { label: 'Social',  pct: metrics.attributionSocial  ?? 40, color: 'var(--mission-control-accent, #6366f1)' },
    { label: 'Email',   pct: metrics.attributionEmail   ?? 30, color: 'var(--color-success, #22c55e)' },
    { label: 'Organic', pct: metrics.attributionOrganic ?? 30, color: 'var(--color-warning, #eab308)' },
  ];

  const hasMetrics = revenue > 0 || cost > 0 || (metrics.impressions ?? 0) > 0 || (metrics.clicks ?? 0) > 0;

  if (!hasMetrics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <BarChart2 size={28} className="text-mission-control-text-dim" />
        <p className="text-sm text-mission-control-text-dim">No metrics data yet.</p>
        <p className="text-xs text-mission-control-text-dim">
          Update the campaign&apos;s <code className="px-1 py-0.5 rounded bg-mission-control-border text-mission-control-text-primary text-[10px]">metrics</code> field to see ROI analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      {/* Top row: ROI ring + key metrics strip */}
      <div className="flex flex-wrap items-start gap-6">
        <ROIRing roi={roi} />
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {(metrics.reach ?? 0) > 0 && (
            <MetricPill icon={Users} label="Reach" value={(metrics.reach ?? 0).toLocaleString()} />
          )}
          {(metrics.impressions ?? 0) > 0 && (
            <MetricPill icon={Eye} label="Impressions" value={(metrics.impressions ?? 0).toLocaleString()} />
          )}
          {(metrics.clicks ?? 0) > 0 && (
            <MetricPill icon={MousePointerClick} label="Clicks" value={(metrics.clicks ?? 0).toLocaleString()} />
          )}
          {(metrics.conversions ?? 0) > 0 && (
            <MetricPill icon={Repeat2} label="Conversions" value={(metrics.conversions ?? 0).toLocaleString()} />
          )}
          {revenue > 0 && (
            <MetricPill icon={TrendingUp} label="Revenue" value={fmtCurrency(revenue)} />
          )}
          {cost > 0 && (
            <MetricPill icon={DollarSign} label="Cost" value={fmtCurrency(cost)} />
          )}
        </div>
      </div>

      {/* Comparison bar vs previous campaign */}
      {previousCampaign && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
            vs Previous campaign — {previousCampaign.name}
          </h3>
          <div className="space-y-3">
            {((metrics.impressions ?? 0) > 0 || (prevMetrics.impressions ?? 0) > 0) && (
              <ComparisonBar
                label="Impressions"
                current={metrics.impressions ?? 0}
                previous={prevMetrics.impressions ?? 0}
              />
            )}
            {((metrics.clicks ?? 0) > 0 || (prevMetrics.clicks ?? 0) > 0) && (
              <ComparisonBar
                label="Clicks"
                current={metrics.clicks ?? 0}
                previous={prevMetrics.clicks ?? 0}
              />
            )}
            {((metrics.conversions ?? 0) > 0 || (prevMetrics.conversions ?? 0) > 0) && (
              <ComparisonBar
                label="Conversions"
                current={metrics.conversions ?? 0}
                previous={prevMetrics.conversions ?? 0}
              />
            )}
            {(revenue > 0 || (prevMetrics.revenue ?? 0) > 0) && (
              <ComparisonBar
                label="Revenue"
                current={revenue}
                previous={prevMetrics.revenue ?? 0}
                format={fmtCurrency}
              />
            )}
          </div>
        </div>
      )}

      {/* Attribution breakdown */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-4">
          Attribution breakdown
        </h3>
        <AttributionPie slices={attributionSlices} />
      </div>
    </div>
  );
}
