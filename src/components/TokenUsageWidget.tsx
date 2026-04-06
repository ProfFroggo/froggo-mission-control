// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useMemo } from 'react';
import { Coins, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { getAgentTheme } from '../utils/agentThemes';
import AgentTokenDetailModal from './AgentTokenDetailModal';
import { Box, Flex } from '@radix-ui/themes';

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
      <Flex align="center" justify="center" className="h-12 text-xs text-mission-control-text-dim">
        Not enough data
      </Flex>
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
          <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-warning)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#cost-spark-fill)" />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--color-warning)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill="var(--color-warning)"
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
    <Box className="space-y-1">
      <Flex align="center" justify="between" className="text-xs">
        <button
          type="button"
          onClick={onClick}
          className="font-medium capitalize hover:underline text-left truncate max-w-32"
          title={agent.agentId}
        >
          {label}
        </button>
        <Flex align="center" gap="2" className="text-mission-control-text-dim shrink-0 tabular-nums">
          <span>{tokLabel}</span>
          <span className="text-warning">${agent.cost.toFixed(4)}</span>
        </Flex>
      </Flex>
      <Box className="h-1.5 bg-mission-control-bg rounded-full overflow-hidden">
        <Box
          className="h-full rounded-full transition-colors duration-500"
          style={{ width: `${pct}%`, backgroundColor: theme.color }}
        />
      </Box>
    </Box>
  );
}

// ─── Budget banner ────────────────────────────────────────────────────────────

function BudgetBanner({ totalCost, budgetUsd }: { totalCost: number; budgetUsd: number }) {
  if (budgetUsd <= 0) return null;
  const pct = (totalCost / budgetUsd) * 100;
  if (pct < 80) return null;
  const isOver = pct >= 100;

  return (
    <Flex
      align="center"
      gap="2"
      px="3"
      py="2"
      className={`rounded-lg text-xs font-medium ${
        isOver
          ? 'bg-error/10 border border-error/30 text-error'
          : 'bg-warning/10 border border-warning/30 text-warning'
      }`}
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        {isOver
          ? `Monthly budget exceeded — $${totalCost.toFixed(4)} / $${budgetUsd.toFixed(2)} (${pct.toFixed(0)}%)`
          : `Approaching monthly budget — $${totalCost.toFixed(4)} / $${budgetUsd.toFixed(2)} (${pct.toFixed(0)}%)`}
      </span>
    </Flex>
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
    } catch (err) {
      console.warn('[TokenUsageWidget] Non-critical:', err);
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
    } catch (err) {
      console.warn('[TokenUsageWidget] Non-critical:', err);
      // no budget configured
    }
  };

  if (loading) {
    return (
      <Flex height="100%" align="center" justify="center">
        <Box className="text-mission-control-text-dim text-sm">Loading token data...</Box>
      </Flex>
    );
  }

  if (!data) {
    return (
      <Flex height="100%" align="center" justify="center">
        <Box className="text-mission-control-text-dim text-sm">No token data available</Box>
      </Flex>
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
    <Flex direction="column" gap="5" height="100%" className="overflow-y-auto">
      {/* Header */}
      <Flex align="center" justify="between">
        <Flex align="center" gap="2">
          <Coins size={18} className="text-mission-control-accent" />
          <h2 className="text-base font-semibold">Token Usage</h2>
        </Flex>
      </Flex>

      {/* Budget alert banner */}
      <BudgetBanner totalCost={data.totalCost} budgetUsd={budgetUsd} />

      {/* Summary stats */}
      <Box className="grid grid-cols-2 gap-3">
        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" gap="1" mb="1" className="text-xs text-mission-control-text-dim">
            <Zap size={13} className="text-warning" />
            Total Tokens
          </Flex>
          <Box className="text-2xl font-bold tabular-nums">{totalLabel}</Box>
          <Box className="text-xs text-mission-control-text-dim mt-0.5">last {days} days</Box>
        </Box>

        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" gap="1" mb="1" className="text-xs text-mission-control-text-dim">
            <Coins size={13} className="text-success" />
            Est. Cost
          </Flex>
          <Box className="text-2xl font-bold text-success tabular-nums">${data.totalCost.toFixed(4)}</Box>
          <Box className="text-xs text-mission-control-text-dim mt-0.5 tabular-nums">
            {budgetUsd > 0 ? `of $${budgetUsd.toFixed(2)} budget` : 'no budget set'}
          </Box>
        </Box>
      </Box>

      {/* Top 3 agents */}
      {top3.length > 0 && (
        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" gap="1" mb="3" className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
            <TrendingUp size={12} />
            Top Consumers
          </Flex>
          <Box className="space-y-3">
            {top3.map(agent => (
              <AgentBar
                key={agent.agentId}
                agent={agent}
                maxTokens={maxTokens}
                onClick={() => setSelectedAgent(agent.agentId)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Daily spend sparkline */}
      {data.byDay.length > 0 && (
        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" gap="1" mb="3" className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
            <Coins size={12} />
            Daily Spend
          </Flex>
          <CostSparkline byDay={data.byDay} />
          <Flex justify="between" mt="1" className="text-xs text-mission-control-text-dim">
            {data.byDay.length > 0 && <span>{data.byDay[0].date}</span>}
            {data.byDay.length > 1 && <span>{data.byDay[data.byDay.length - 1].date}</span>}
          </Flex>
        </Box>
      )}

      {/* Empty state */}
      {top3.length === 0 && data.byDay.length === 0 && (
        <Flex className="flex-1 text-sm text-mission-control-text-dim" align="center" justify="center">
          No token usage recorded in the last {days} days
        </Flex>
      )}

      {/* Agent detail modal */}
      <AgentTokenDetailModal
        isOpen={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
        agent={selectedAgent}
      />
    </Flex>
  );
}
