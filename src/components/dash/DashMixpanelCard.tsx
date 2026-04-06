// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashMixpanelCard — Bitso Onchain product analytics snapshot.
 * Swap volume · New users · Confirmed swaps · Auth health · Transfer volume
 */
import { useState, useEffect } from 'react';
import { BarChart2, Settings } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MixpanelMetricsResponse {
  configured: boolean;
  error?: string;
  days?: number;
  confirmedSwaps?: number;
  newUsers?: number;
  authSuccess?: number;
  authFailed?: number;
  swapVolumeUsd?: number;
  xferVolumeUsd?: number;
  swapSparkData?: number[];
}

interface DashMixpanelCardProps {
  range: '24h' | '48h';
  onNavigate?: (view: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Cell({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-0.5 leading-none ${accent ?? 'text-mission-control-text'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-mission-control-text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded px-2 py-1 text-[10px] text-mission-control-text">
      {fmtNum(payload[0].value)} swaps
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashMixpanelCard({ range, onNavigate }: DashMixpanelCardProps) {
  const [data, setData] = useState<MixpanelMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const days = range === '24h' ? 1 : 2;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const res = await fetch(`/api/mixpanel/metrics?days=${days}`);
        const json = (await res.json()) as MixpanelMetricsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        console.warn('[DashMixpanelCard] Non-critical:', err);
        if (!cancelled) setData({ configured: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [days]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border">
          <BarChart2 size={15} className="text-mission-control-text-dim" />
          <div className="h-3 w-28 rounded bg-mission-control-border animate-pulse" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-mission-control-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="h-2 w-16 rounded bg-mission-control-border animate-pulse mb-2" />
              <div className="h-5 w-20 rounded bg-mission-control-border animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Not configured ────────────────────────────────────────────────────────────

  if (!data?.configured) {
    return (
      <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
          <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
            <BarChart2 size={15} className="text-mission-control-accent" />
            Onchain Analytics
          </h2>
        </div>
        <div className="px-4 py-6 text-center">
          <BarChart2 size={24} className="mx-auto mb-2 text-mission-control-text-dim opacity-30" />
          <p className="text-xs text-mission-control-text-dim mb-3">Mixpanel not configured</p>
          <button type="button" onClick={() => onNavigate?.('settings')}
            className="flex items-center gap-1.5 mx-auto text-xs text-mission-control-accent hover:underline">
            <Settings size={11} /> Open Settings →
          </button>
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <div className="px-4 py-3 border-b border-mission-control-border">
          <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
            <BarChart2 size={15} className="text-mission-control-accent" />Onchain Analytics
          </h2>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs text-error-DEFAULT">Error fetching metrics</p>
          <p className="text-[10px] text-mission-control-text-dim mt-1 break-words">{data.error}</p>
        </div>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────────

  const {
    confirmedSwaps = 0,
    newUsers = 0,
    authSuccess = 0,
    authFailed = 0,
    swapVolumeUsd = 0,
    xferVolumeUsd = 0,
    swapSparkData = [],
  } = data;

  const totalAuth = authSuccess + authFailed;
  const authSuccessRate = totalAuth > 0 ? Math.round((authSuccess / totalAuth) * 100) : null;
  const spark = swapSparkData.map((v, i) => ({ i, v }));
  const rangeLabel = range === '24h' ? 'today' : 'last 48h';

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <BarChart2 size={15} className="text-mission-control-accent" />
          Onchain Analytics
        </h2>
        <span className="text-[10px] text-mission-control-text-dim">{rangeLabel}</span>
      </div>

      {/* 2×2 primary metrics */}
      <div className="grid grid-cols-2 divide-x divide-y divide-mission-control-border">
        <Cell
          label="Swap Volume"
          value={fmtUsd(swapVolumeUsd)}
          sub="trade_transaction"
          accent="text-success-DEFAULT"
        />
        <Cell
          label="New Users"
          value={fmtNum(newUsers)}
          sub="users_created"
          accent={newUsers > 0 ? 'text-info-DEFAULT' : undefined}
        />
        <Cell
          label="Confirmed Swaps"
          value={fmtNum(confirmedSwaps)}
          sub="swap_confirmed_onchain"
        />
        <Cell
          label="Deposits / Transfers"
          value={fmtUsd(xferVolumeUsd)}
          sub="transfer_transaction"
        />
      </div>

      {/* Sparkline + auth health */}
      <div className="grid grid-cols-2 divide-x divide-mission-control-border border-t border-mission-control-border">

        {/* Swap trend sparkline */}
        <div className="px-4 py-3">
          <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide mb-1">Swap trend</div>
          {spark.length > 1 ? (
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="mpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="var(--color-success)" strokeWidth={1.5}
                    fill="url(#mpGrad)" dot={false} isAnimationActive={false} />
                  <Tooltip content={<SparkTooltip />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-mission-control-text-dim">—</div>
          )}
        </div>

        {/* Auth health */}
        <div className="px-4 py-3">
          <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide mb-1">Auth health</div>
          {authSuccessRate !== null ? (
            <>
              <div className={`text-xl font-bold tabular-nums leading-none ${authSuccessRate >= 90 ? 'text-success-DEFAULT' : authSuccessRate >= 70 ? 'text-warning-DEFAULT' : 'text-error-DEFAULT'}`}>
                {authSuccessRate}%
              </div>
              <div className="text-[10px] text-mission-control-text-dim mt-0.5">
                {fmtNum(authSuccess)} ok · {fmtNum(authFailed)} failed
              </div>
            </>
          ) : (
            <div className="text-sm text-mission-control-text-dim">—</div>
          )}
        </div>

      </div>

    </div>
  );
}
