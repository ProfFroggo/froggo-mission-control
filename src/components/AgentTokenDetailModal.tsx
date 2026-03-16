// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, BarChart3, DollarSign, PiggyBank } from 'lucide-react';
import { getAgentTheme } from '../utils/agentThemes';
import { analyticsApi } from '../lib/api';

interface AgentTokenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: string | null;
  onOpenBudgets?: () => void;
}

interface TokenLogEntry {
  id: number;
  timestamp: number;
  agent: string;
  session_id?: string;
  model: string;
  tier?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  created_at: number;
}

interface DayUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface AgentUsage {
  agentId: string;
  cost: number;
}

// ── 30-day daily cost bar chart ───────────────────────────────────────────────

function DailyCostChart({ byDay }: { byDay: DayUsage[] }) {
  if (byDay.length === 0) {
    return (
      <div className="text-xs text-mission-control-text-dim text-center py-4">
        No daily data
      </div>
    );
  }

  const W = 520;
  const H = 60;
  const padX = 2;
  const barW = Math.max(2, (W - padX * (byDay.length - 1)) / byDay.length);
  const maxCost = Math.max(...byDay.map(d => d.cost), 0.000001);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: H }}
        aria-label="30-day daily cost chart"
        role="img"
      >
        {byDay.map((day, i) => {
          const h = Math.max(2, (day.cost / maxCost) * (H - 4));
          const x = i * (barW + padX);
          return (
            <rect
              key={day.date}
              x={x}
              y={H - h}
              width={barW}
              height={h}
              rx={1}
              fill="var(--mission-control-accent, #22c55e)"
              opacity={0.8}
            >
              <title>{day.date}: ${day.cost.toFixed(4)}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-mission-control-text-dim mt-1">
        {byDay.length > 0 && <span>{byDay[0].date}</span>}
        {byDay.length > 1 && <span>{byDay[byDay.length - 1].date}</span>}
      </div>
    </div>
  );
}

export default function AgentTokenDetailModal({
  isOpen,
  onClose,
  agent,
  onOpenBudgets,
}: AgentTokenDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [sessionLog, setSessionLog] = useState<TokenLogEntry[]>([]);
  const [byDay30, setByDay30] = useState<DayUsage[]>([]);
  const [teamAvgCostPerDay, setTeamAvgCostPerDay] = useState<number>(0);

  useEffect(() => {
    if (isOpen && agent) {
      loadSessionLog();
      loadTrend();
      loadTeamAvg();
    }
  }, [isOpen, agent]);

  const loadSessionLog = useCallback(async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const data = await analyticsApi.getTokenUsage({ agent, limit: '50' });
      setSessionLog((data?.entries || []) as TokenLogEntry[]);
    } catch {
      setSessionLog([]);
    } finally {
      setLoading(false);
    }
  }, [agent]);

  const loadTrend = useCallback(async () => {
    if (!agent) return;
    try {
      const res = await fetch(`/api/token-usage?days=30&agentId=${encodeURIComponent(agent)}`);
      if (res.ok) {
        const d = await res.json() as { byDay: DayUsage[] };
        setByDay30(d.byDay ?? []);
      }
    } catch {
      setByDay30([]);
    }
  }, [agent]);

  const loadTeamAvg = useCallback(async () => {
    try {
      const res = await fetch('/api/token-usage?days=30');
      if (res.ok) {
        const d = await res.json() as { byAgent: AgentUsage[]; byDay: DayUsage[] };
        const agentCount = Math.max(d.byAgent?.length ?? 1, 1);
        const totalDays = Math.max(d.byDay?.length ?? 1, 1);
        const totalCost = d.byAgent?.reduce((s: number, a: AgentUsage) => s + a.cost, 0) ?? 0;
        setTeamAvgCostPerDay(totalCost / agentCount / totalDays);
      }
    } catch {
      // silent
    }
  }, []);

  if (!isOpen || !agent) return null;

  // Calculate totals
  const totalCalls = sessionLog.length;
  const totalTokens = sessionLog.reduce((sum, entry) => sum + entry.total_tokens, 0);
  const totalCost = sessionLog.reduce((sum, entry) => sum + entry.cost, 0);
  const uniqueSessions = new Set(
    sessionLog.filter((e) => e.session_id).map((e) => e.session_id)
  ).size;

  // Agent's avg cost per day from the 30-day window
  const agentCostPerDay =
    byDay30.length > 0
      ? byDay30.reduce((s, d) => s + d.cost, 0) / byDay30.length
      : 0;

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const truncateModel = (model: string) => {
    if (model.includes('/')) {
      const parts = model.split('/');
      return parts[parts.length - 1];
    }
    return model;
  };

  const theme = getAgentTheme(agent);

  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    onClose();
  };

  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropClick}
      role="button"
      tabIndex={0}
      aria-label="Close token detail modal"
    >
      <div
        className="bg-mission-control-bg border border-mission-control-border rounded-2xl w-[640px] max-h-[88vh] flex flex-col shadow-2xl"
        onClick={handleInnerClick}
        onKeyDown={handleInnerClick}
        role="presentation"
      >
        {/* Header */}
        <div className="p-5 border-b border-mission-control-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.color }} />
            <div>
              <h3 className="text-lg font-semibold">
                {agent.charAt(0).toUpperCase() + agent.slice(1)}
              </h3>
              <p className="text-sm text-mission-control-text-dim">Token Usage & Cost</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenBudgets && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenBudgets(); }}
                className="flex items-center gap-1.5 text-xs text-mission-control-accent hover:underline px-2 py-1 rounded"
              >
                <PiggyBank size={13} />
                Set Budget
              </button>
            )}
            <button
              onClick={onClose}
              className="text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 30-day cost trend */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-2">
              <TrendingUp size={12} />
              30-day cost trend
            </div>
            <DailyCostChart byDay={byDay30} />
          </div>

          {/* Comparison to team average */}
          {agentCostPerDay > 0 && (
            <div className="px-5 pb-3">
              <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 flex items-center gap-3 text-sm">
                <DollarSign size={16} className="text-warning shrink-0" />
                <span>
                  This agent costs{' '}
                  <strong className="text-warning">${agentCostPerDay.toFixed(4)}/day</strong>
                  {teamAvgCostPerDay > 0 && (
                    <>
                      {' '}vs team avg{' '}
                      <strong>${teamAvgCostPerDay.toFixed(4)}/day</strong>
                      {agentCostPerDay > teamAvgCostPerDay ? (
                        <span className="text-error"> (+{(((agentCostPerDay - teamAvgCostPerDay) / teamAvgCostPerDay) * 100).toFixed(0)}%)</span>
                      ) : (
                        <span className="text-success"> ({(((agentCostPerDay - teamAvgCostPerDay) / teamAvgCostPerDay) * 100).toFixed(0)}%)</span>
                      )}
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Cost per task table */}
          {sessionLog.length > 0 && (
            <div className="px-5 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-2">
                <BarChart3 size={12} />
                Recent calls
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-mission-control-surface text-mission-control-text-dim sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3">Time</th>
                      <th className="text-left py-2 px-3">Model</th>
                      <th className="text-right py-2 px-3">Input</th>
                      <th className="text-right py-2 px-3">Output</th>
                      <th className="text-right py-2 px-3">Total</th>
                      <th className="text-right py-2 px-3">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionLog.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-mission-control-border/50 hover:bg-mission-control-surface/50"
                      >
                        <td className="py-2 px-3 text-mission-control-text-dim">
                          {formatTime(entry.created_at)}
                        </td>
                        <td className="py-2 px-3 text-mission-control-text-dim">
                          {truncateModel(entry.model)}
                        </td>
                        <td className="py-2 px-3 text-right text-info">
                          {entry.input_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-review">
                          {entry.output_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-success font-medium">
                          {entry.total_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-warning">
                          ${entry.cost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && sessionLog.length === 0 && (
            <div className="flex items-center justify-center h-40">
              <div className="text-mission-control-text-dim text-sm">
                No token usage recorded for this agent
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="text-mission-control-text-dim">Loading...</div>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {!loading && sessionLog.length > 0 && (
          <div className="p-4 border-t border-mission-control-border bg-mission-control-surface/50">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-mission-control-text-dim mb-1">Total Calls</div>
                <div className="text-lg font-semibold">{totalCalls}</div>
              </div>
              {uniqueSessions > 0 && (
                <div>
                  <div className="text-xs text-mission-control-text-dim mb-1">Sessions</div>
                  <div className="text-lg font-semibold">{uniqueSessions}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-mission-control-text-dim mb-1">Total Tokens</div>
                <div className="text-lg font-semibold text-success">
                  {totalTokens.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-mission-control-text-dim mb-1">Total Cost</div>
                <div className="text-lg font-semibold text-warning">
                  ${totalCost.toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
