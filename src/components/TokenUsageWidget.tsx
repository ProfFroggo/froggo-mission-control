// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useMemo } from 'react';
import { Coins, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { getAgentTheme } from '../utils/agentThemes';
import AgentTokenDetailModal from './AgentTokenDetailModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentUsage {
  agentId: string;
  tokens: number;
  cost: number;
  taskCount: number;
}

interface DayUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface TokenData {
  totalTokens: number;
  totalCost: number;
  byAgent: AgentUsage[];
  byDay: DayUsage[];
}

// ─── Sparkline (SVG polyline, daily cost) ────────────────────────────────────

function CostSparkline({ byDay }: { byDay: DayUsage[] }) {
  const W = 280;
  const H = 48;
  const PAD_X = 4;
  const PAD_Y = 6;

  const points = useMemo(() => {
    if (byDay.length < 2) return null;
    const values = byDay.map(d => d.cost);
    const maxVal = Math.max(...values, 0.000001);
    const step = (W - PAD_X * 2) / (values.length - 1);
    return values.map((v, i) => ({
      x: PAD_X + i * step,
      y: PAD_Y + (H - PAD_Y * 2) * (1 - v / maxVal),
      cost: v,
      date: byDay[i].date,
    }));
  }, [byDay]);

  if (!points) {
    return (
      <div className="flex items-center justify-center h-12 text-xs text-mission-control-text-dim">
        Not enough data
      </div>
    );
  }

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const fillPoints = [
    `${points[0].x},${H - PAD_Y}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${H - PAD_Y}`,
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-12"
      aria-label="Daily cost sparkline"
      role="img"
    >
      <defs>
        <linearGradient id="cost-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-warning, #f59e0b)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-warning, #f59e0b)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#cost-spark-fill)" />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--color-warning, #f59e0b)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill="var(--color-warning, #f59e0b)"
        />
      )}
    </svg>
  );
}

// ─── Agent usage bar row ──────────────────────────────────────────────────────

function AgentBar({
  agent,
  maxTokens,
  onClick,
}: {
  agent: AgentUsage;
  maxTokens: number;
  onClick: () => void;
}) {
  const pct = maxTokens > 0 ? Math.min((agent.tokens / maxTokens) * 100, 100) : 0;
  const theme = getAgentTheme(agent.agentId);
  const label = agent.agentId.replace(/-/g, ' ');
  const tokLabel =
    agent.tokens >= 1_000_000
      ? `${(agent.tokens / 1_000_000).toFixed(1)}M`
      : agent.tokens >= 1_000
      ? `${(agent.tokens / 1_000).toFixed(0)}K`
      : String(agent.tokens);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onClick}
          className="font-medium capitalize hover:underline text-left truncate max-w-32"
          title={agent.agentId}
        >
          {label}
        </button>
        <div className="flex items-center gap-2 text-mission-control-text-dim shrink-0 tabular-nums">
          <span>{tokLabel}</span>
          <span className="text-warning">${agent.cost.toFixed(4)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-mission-control-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: theme.color }}
        />
      </div>
    </div>
  );
}

// ─── Budget banner ────────────────────────────────────────────────────────────

function BudgetBanner({ totalCost, budgetUsd }: { totalCost: number; budgetUsd: number }) {
  if (budgetUsd <= 0) return null;
  const pct = (totalCost / budgetUsd) * 100;
  if (pct < 80) return null;
  const isOver = pct >= 100;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
        isOver
          ? 'bg-error-subtle border border-error-border text-error'
          : 'bg-warning-subtle border border-warning-border text-warning'
      }`}
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        {isOver
          ? `Monthly budget exceeded — $${totalCost.toFixed(4)} / $${budgetUsd.toFixed(2)} (${pct.toFixed(0)}%)`
          : `Approaching monthly budget — $${totalCost.toFixed(4)} / $${budgetUsd.toFixed(2)} (${pct.toFixed(0)}%)`}
      </span>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function TokenUsageWidget({ days = 30 }: { days?: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenData | null>(null);
  const [budgetUsd, setBudgetUsd] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadBudget();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/token-usage?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json as TokenData);
      }
    } catch {
      // silently fail — widget shows empty state
    } finally {
      setLoading(false);
    }
  };

  const loadBudget = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json() as Record<string, string>;
        const raw = settings['token_budget_usd'];
        if (raw) setBudgetUsd(parseFloat(raw) || 0);
      }
    } catch {
      // no budget configured
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim text-sm">Loading token data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim text-sm">No token data available</div>
      </div>
    );
  }

  const top3 = data.byAgent.slice(0, 3);
  const maxTokens = top3.length > 0 ? top3[0].tokens : 1;

  const totalLabel =
    data.totalTokens >= 1_000_000
      ? `${(data.totalTokens / 1_000_000).toFixed(2)}M`
      : data.totalTokens >= 1_000
      ? `${(data.totalTokens / 1_000).toFixed(1)}K`
      : String(data.totalTokens);

  return (
    <div className="h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-mission-control-accent" />
          <h2 className="text-base font-semibold">Token Usage</h2>
        </div>
      </div>

      {/* Budget alert banner */}
      <BudgetBanner totalCost={data.totalCost} budgetUsd={budgetUsd} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-1">
            <Zap size={13} className="text-warning" />
            Total Tokens
          </div>
          <div className="text-2xl font-bold tabular-nums">{totalLabel}</div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">last {days} days</div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-1">
            <Coins size={13} className="text-success" />
            Est. Cost
          </div>
          <div className="text-2xl font-bold text-success tabular-nums">${data.totalCost.toFixed(4)}</div>
          <div className="text-xs text-mission-control-text-dim mt-0.5 tabular-nums">
            {budgetUsd > 0 ? `of $${budgetUsd.toFixed(2)} budget` : 'no budget set'}
          </div>
        </div>
      </div>

      {/* Top 3 agents */}
      {top3.length > 0 && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-3">
            <TrendingUp size={12} />
            Top Consumers
          </div>
          <div className="space-y-3">
            {top3.map(agent => (
              <AgentBar
                key={agent.agentId}
                agent={agent}
                maxTokens={maxTokens}
                onClick={() => setSelectedAgent(agent.agentId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Daily spend sparkline */}
      {data.byDay.length > 0 && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-3">
            <Coins size={12} />
            Daily Spend
          </div>
          <CostSparkline byDay={data.byDay} />
          <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
            {data.byDay.length > 0 && <span>{data.byDay[0].date}</span>}
            {data.byDay.length > 1 && <span>{data.byDay[data.byDay.length - 1].date}</span>}
          </div>
        </div>
      )}

      {/* Empty state */}
      {top3.length === 0 && data.byDay.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-mission-control-text-dim">
          No token usage recorded in the last {days} days
        </div>
      )}

      {/* Agent detail modal */}
      <AgentTokenDetailModal
        isOpen={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
        agent={selectedAgent}
      />
    </div>
  );
}
