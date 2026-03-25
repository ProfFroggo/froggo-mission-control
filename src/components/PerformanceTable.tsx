// LEGACY: PerformanceTable uses file-level suppression for intentional patterns.
// loadData is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import React, { useState, useEffect } from 'react';
import { Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { getAgentTheme } from '../utils/agentThemes';

interface PerformanceData {
  agent_id: string;
  status: string;
  success_rate: number;
  avg_completion_hours: number;
  clara_approval_rate: number;
  tokens_per_task: number;
  total_tasks: number;
  total_cost: number;
}

interface AuditEntry {
  timestamp: string;
  type: 'lifecycle' | 'activity';
  action: string;
  task_id?: string;
  message?: string;
  outcome?: string;
  field?: string;
  from_value?: string;
  to_value?: string;
  changed_by?: string;
  reason?: string;
}

export default function PerformanceTable() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<PerformanceData[]>([]);
  const [sortBy, setSortBy] = useState<'success_rate' | 'avg_completion_hours' | 'clara_approval_rate' | 'tokens_per_task'>('success_rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetch(`/api/analytics/performance?days=${period}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (result && !result.error) {
        setData(result.agents || []);
      }
    } catch (err) {
      // Failed to load performance data
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async (agentId: string) => {
    setAuditLoading(true);
    try {
      const result = await fetch(`/api/agents/${agentId}/audit?days=${period}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (result && !result.error) {
        setAuditData(result.timeline || []);
      }
    } catch (err) {
      // Failed to load audit data
    } finally {
      setAuditLoading(false);
    }
  };

  const handleRowClick = (agentId: string) => {
    setSelectedAgent(agentId);
    loadAudit(agentId);
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const getStatusDotStyle = (agent: PerformanceData): React.CSSProperties => {
    if (agent.total_tasks < 5) return { backgroundColor: 'var(--mission-control-border)' };
    const success = agent.success_rate;
    const clara = agent.clara_approval_rate;
    if (success >= 0.8 && clara >= 0.85) return { backgroundColor: 'var(--color-success)' };
    if (success >= 0.6 && clara >= 0.7) return { backgroundColor: 'var(--color-warning)' };
    return { backgroundColor: 'var(--color-error)' };
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (sortDir === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="text-mission-control-accent" size={16} />
          <span className="text-sm font-semibold text-mission-control-text">Agent Performance Comparison</span>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriod(days)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                period === days ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Performance Table */}
      <div className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-xl overflow-auto">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            No performance data available for selected period
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="flex items-center gap-3 px-4 py-2 border-b border-mission-control-border text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
                <th className="text-left w-6 font-bold">St</th>
                <th className="text-left flex-1 font-bold">Agent</th>
                <th
                  className="text-right w-20 cursor-pointer hover:text-mission-control-text font-bold select-none"
                  onClick={() => handleSort('success_rate')}
                >
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Success
                    {sortBy === 'success_rate' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </span>
                </th>
                <th
                  className="text-right w-16 cursor-pointer hover:text-mission-control-text font-bold select-none"
                  onClick={() => handleSort('avg_completion_hours')}
                >
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Avg Time
                    {sortBy === 'avg_completion_hours' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </span>
                </th>
                <th
                  className="text-right w-20 cursor-pointer hover:text-mission-control-text font-bold select-none"
                  onClick={() => handleSort('clara_approval_rate')}
                >
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Clara
                    {sortBy === 'clara_approval_rate' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </span>
                </th>
                <th
                  className="text-right w-24 cursor-pointer hover:text-mission-control-text font-bold select-none"
                  onClick={() => handleSort('tokens_per_task')}
                >
                  <span className="inline-flex items-center justify-end gap-0.5">
                    Tokens/Task
                    {sortBy === 'tokens_per_task' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </span>
                </th>
                <th className="text-right w-12 font-bold">Tasks</th>
                <th className="text-right w-20 font-bold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((agent) => {
                const theme = getAgentTheme(agent.agent_id);
                const dotStyle = getStatusDotStyle(agent);

                return (
                  <tr
                    key={agent.agent_id}
                    onClick={() => handleRowClick(agent.agent_id)}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-border/10 transition-colors text-sm cursor-pointer"
                  >
                    <td className="w-6">
                      <div className="w-2.5 h-2.5 rounded-full" style={dotStyle} />
                    </td>
                    <td className="flex-1 min-w-0">
                      <Flex align="center" gap="2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: theme.color }}
                        />
                        <span className="font-medium capitalize truncate">{agent.agent_id.replace(/-/g, ' ')}</span>
                      </Flex>
                    </td>
                    <td className="w-20 text-right tabular-nums whitespace-nowrap">
                      <span className={agent.success_rate >= 0.8 ? 'text-[var(--color-success)]' : agent.success_rate >= 0.6 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}>
                        {(agent.success_rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="w-16 text-right tabular-nums whitespace-nowrap">
                      <span className="text-mission-control-text-dim">{agent.avg_completion_hours.toFixed(1)}h</span>
                    </td>
                    <td className="w-20 text-right tabular-nums whitespace-nowrap">
                      <span className={agent.clara_approval_rate >= 0.85 ? 'text-[var(--color-success)]' : agent.clara_approval_rate >= 0.7 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}>
                        {(agent.clara_approval_rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="w-24 text-right tabular-nums whitespace-nowrap">
                      <span className="text-mission-control-text-dim font-mono">{agent.tokens_per_task.toLocaleString()}</span>
                    </td>
                    <td className="w-12 text-right tabular-nums whitespace-nowrap">
                      <span className="text-mission-control-text-dim">{agent.total_tasks}</span>
                    </td>
                    <td className="w-20 text-right tabular-nums whitespace-nowrap">
                      <span className="text-mission-control-text-dim font-mono">
                        ${agent.total_cost < 1 ? agent.total_cost.toFixed(4) : agent.total_cost.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Audit Trail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedAgent(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgent(null); } }}
          role="button"
          tabIndex={0}
          aria-label="Close modal"
        >
          <div
            className="bg-mission-control-surface border border-mission-control-border rounded-xl w-full max-w-4xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border sticky top-0 bg-mission-control-surface flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-mission-control-accent" />
                <span className="text-sm font-semibold text-mission-control-text">{selectedAgent} Audit Trail</span>
              </div>
              <span className="text-xs text-mission-control-text-dim">Last {period} days</span>
            </div>

            <div className="p-6">
              {auditLoading ? (
                <div className="text-center py-8 text-mission-control-text-dim">Loading audit data...</div>
              ) : auditData.length === 0 ? (
                <div className="text-center py-8 text-mission-control-text-dim">No audit entries found</div>
              ) : (
                <div className="space-y-3">
                  {auditData.slice(0, 50).map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex gap-3 p-3 rounded-lg border border-mission-control-border/50 hover:bg-mission-control-border/30 transition-colors"
                    >
                      <div className="flex-shrink-0 w-32 text-xs text-mission-control-text-dim">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="flex-1">
                        {entry.type === 'lifecycle' ? (
                          <div>
                            <div className="text-sm font-medium text-[var(--color-warning)]">
                              Lifecycle: {entry.field}
                            </div>
                            <div className="text-xs text-mission-control-text-dim mt-1">
                              {entry.from_value} → {entry.to_value}
                              {entry.changed_by && ` (by ${entry.changed_by})`}
                            </div>
                            {entry.reason && (
                              <div className="text-xs text-mission-control-text-dim mt-1">
                                Reason: {entry.reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-medium">{entry.action}</div>
                            {entry.task_id && (
                              <div className="text-xs text-mission-control-text-dim">Task: {entry.task_id}</div>
                            )}
                            {entry.message && (
                              <div className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">
                                {entry.message}
                              </div>
                            )}
                            {entry.outcome && (
                              <div className={`text-xs mt-1 ${entry.outcome === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                Outcome: {entry.outcome}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-mission-control-border flex justify-end">
              <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setSelectedAgent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
