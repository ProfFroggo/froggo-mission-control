// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/store';

type Period  = '7d' | '30d' | '90d';
type SortKey = 'score' | 'successRate' | 'tasksCompleted' | 'avgSpeed' | 'costEfficiency';

interface AgentScore {
  agentId: string;
  agentName: string;
  avatar: string;
  role: string;
  description: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  metrics: {
    tasksCompleted: number;
    successRate: number;
    avgDurationMs: number;
    totalCostUsd: number;
  };
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'score',          label: 'Overall Score'   },
  { key: 'successRate',    label: 'Success Rate'    },
  { key: 'tasksCompleted', label: 'Tasks Completed' },
  { key: 'avgSpeed',       label: 'Avg Speed'       },
  { key: 'costEfficiency', label: 'Cost Efficiency' },
];

const RANK_STYLES: Record<number, string> = {
  1: 'bg-yellow-500/10 border-yellow-500/30',
  2: 'bg-slate-400/10 border-slate-400/30',
  3: 'bg-amber-600/10 border-amber-600/30',
};

const RANK_LABEL_STYLES: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-slate-400',
  3: 'text-amber-600',
};

function formatDuration(ms: number): string {
  if (!ms) return '—';
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function TrendIcon({ trend }: { trend: AgentScore['trend'] }) {
  if (trend === 'improving') return <TrendingUp  size={14} className="text-success flex-shrink-0" />;
  if (trend === 'declining') return <TrendingDown size={14} className="text-error flex-shrink-0" />;
  return <Minus size={14} className="text-warning flex-shrink-0" />;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-success' : score >= 45 ? 'bg-warning' : 'bg-error';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-mission-control-border rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${
        score >= 75 ? 'text-success' : score >= 45 ? 'text-warning' : 'text-error'
      }`}>{score}</span>
    </div>
  );
}

export default function AgentLeaderboard() {
  const agents = useStore(s => s.agents);

  const [period, setPeriod]   = useState<Period>('30d');
  const [sortBy, setSortBy]   = useState<SortKey>('score');
  const [rows, setRows]       = useState<AgentScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Fetch reviews for all real (non-worker, non-phantom) agents
  const fetchLeaderboard = useCallback(async (p: Period) => {
    const PHANTOM = new Set(['main', 'chat-agent']);
    const real = agents.filter(a => !PHANTOM.has(a.id) && !a.id.startsWith('worker-'));
    if (real.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        real.map(a =>
          fetch(`/api/agents/${a.id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: p }),
          }).then(r => r.ok ? r.json() : null)
        )
      );

      const scored: AgentScore[] = [];
      results.forEach((result, idx) => {
        const agent = real[idx];
        if (result.status === 'fulfilled' && result.value) {
          const d = result.value;
          scored.push({
            agentId:     agent.id,
            agentName:   agent.name,
            avatar:      agent.avatar ?? '🤖',
            role:        (agent as any).role ?? '',
            description: agent.description ?? '',
            score:       d.score,
            trend:       d.trend,
            metrics: {
              tasksCompleted: d.metrics.tasksCompleted,
              successRate:    d.metrics.successRate,
              avgDurationMs:  d.metrics.avgDurationMs,
              totalCostUsd:   d.metrics.totalCostUsd,
            },
          });
        } else {
          // Include agent with zero score so it still appears
          scored.push({
            agentId:     agent.id,
            agentName:   agent.name,
            avatar:      agent.avatar ?? '🤖',
            role:        (agent as any).role ?? '',
            description: agent.description ?? '',
            score:       0,
            trend:       'stable',
            metrics: { tasksCompleted: 0, successRate: 0, avgDurationMs: 0, totalCostUsd: 0 },
          });
        }
      });
      setRows(scored);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agents]);

  useEffect(() => {
    if (agents.length > 0) fetchLeaderboard(period);
  }, [period, fetchLeaderboard, agents.length]);

  const sorted = [...rows].sort((a, b) => {
    switch (sortBy) {
      case 'successRate':    return b.metrics.successRate    - a.metrics.successRate;
      case 'tasksCompleted': return b.metrics.tasksCompleted - a.metrics.tasksCompleted;
      case 'avgSpeed':
        // Faster = better; treat 0 as worst
        if (!a.metrics.avgDurationMs && !b.metrics.avgDurationMs) return 0;
        if (!a.metrics.avgDurationMs) return 1;
        if (!b.metrics.avgDurationMs) return -1;
        return a.metrics.avgDurationMs - b.metrics.avgDurationMs;
      case 'costEfficiency':
        // Lower cost per task = better
        const costA = a.metrics.tasksCompleted > 0 ? a.metrics.totalCostUsd / a.metrics.tasksCompleted : Infinity;
        const costB = b.metrics.tasksCompleted > 0 ? b.metrics.totalCostUsd / b.metrics.tasksCompleted : Infinity;
        return costA - costB;
      default: return b.score - a.score;
    }
  });

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Period */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="text-xs px-2 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-surface text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            aria-label="Sort leaderboard by"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fetchLeaderboard(period)}
            disabled={loading}
            className="icon-btn border border-mission-control-border disabled:opacity-50"
            title="Refresh leaderboard"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-error-border bg-error-subtle p-3 text-sm text-error flex items-center gap-2">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && rows.length === 0 && (
        <div className="space-y-2 animate-pulse">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-xl bg-mission-control-border" />
          ))}
        </div>
      )}

      {/* Leaderboard rows */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((row, idx) => {
            const rank = idx + 1;
            const rankStyle = RANK_STYLES[rank] ?? 'border-mission-control-border';
            const rankLabelStyle = RANK_LABEL_STYLES[rank] ?? 'text-mission-control-text-dim';

            return (
              <div
                key={row.agentId}
                className={`rounded-xl border p-3 flex items-center gap-3 transition-colors hover:bg-mission-control-surface/60 ${rankStyle}`}
              >
                {/* Rank */}
                <div className={`w-8 flex-shrink-0 flex items-center justify-center font-bold text-sm tabular-nums ${rankLabelStyle}`}>
                  {rank <= 3 ? (
                    <Trophy size={16} className={rankLabelStyle} />
                  ) : (
                    <span>{rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden bg-mission-control-bg border border-mission-control-border flex items-center justify-center text-lg">
                  <img
                    src={`/api/agents/${row.agentId}/avatar`}
                    alt={row.agentName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const fb = img.nextElementSibling as HTMLElement | null;
                      if (fb) fb.classList.remove('hidden');
                    }}
                  />
                  <span className="hidden absolute inset-0 flex items-center justify-center text-lg leading-none">{row.avatar}</span>
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-mission-control-text truncate">{row.agentName}</span>
                    {row.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim flex-shrink-0">
                        {row.role}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-mission-control-text-dim truncate">{row.description}</p>
                </div>

                {/* Score bar */}
                <div className="flex-shrink-0 hidden sm:block">
                  <ScoreBar score={row.score} />
                </div>

                {/* Trend */}
                <TrendIcon trend={row.trend} />

                {/* Key metric (changes with sortBy) */}
                <div className="flex-shrink-0 text-right min-w-[56px]">
                  {sortBy === 'successRate' ? (
                    <>
                      <div className="text-sm font-bold tabular-nums text-warning">{row.metrics.successRate}%</div>
                      <div className="text-[10px] text-mission-control-text-dim">success</div>
                    </>
                  ) : sortBy === 'tasksCompleted' ? (
                    <>
                      <div className="text-sm font-bold tabular-nums text-success">{row.metrics.tasksCompleted}</div>
                      <div className="text-[10px] text-mission-control-text-dim">tasks</div>
                    </>
                  ) : sortBy === 'avgSpeed' ? (
                    <>
                      <div className="text-sm font-bold tabular-nums text-info">{formatDuration(row.metrics.avgDurationMs)}</div>
                      <div className="text-[10px] text-mission-control-text-dim">avg</div>
                    </>
                  ) : sortBy === 'costEfficiency' ? (
                    <>
                      <div className="text-sm font-bold tabular-nums text-review">
                        ${row.metrics.tasksCompleted > 0
                          ? (row.metrics.totalCostUsd / row.metrics.tasksCompleted).toFixed(3)
                          : '—'}
                      </div>
                      <div className="text-[10px] text-mission-control-text-dim">/task</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-bold tabular-nums text-success">{row.metrics.tasksCompleted}</div>
                      <div className="text-[10px] text-mission-control-text-dim">tasks</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="py-12 text-center text-sm text-mission-control-text-dim">
          No agent data available yet.
        </div>
      )}
    </div>
  );
}
