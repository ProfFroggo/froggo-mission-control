// LEGACY: PerformanceTable uses file-level suppression for intentional patterns.
// loadData is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
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

  const getStatusColor = (agent: PerformanceData) => {
    // Gray for low sample size
    if (agent.total_tasks < 5) return 'bg-muted';

    // Red/Yellow/Green based on success rate and Clara approval
    const success = agent.success_rate;
    const clara = agent.clara_approval_rate;

    if (success >= 0.8 && clara >= 0.85) return 'bg-green-500';
    if (success >= 0.6 && clara >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
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
        <div className="text-clawd-text-dim">Loading performance data...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-clawd-accent" size={20} />
            Agent Performance Comparison
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Cross-agent metrics with quality indicators
          </p>
        </div>

        {/* Period selector */}
        <div className="flex bg-clawd-border rounded-lg p-1">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === days
                  ? 'bg-clawd-accent text-white'
                  : 'text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Performance Table */}
      <div className="flex-1 bg-clawd-surface border border-clawd-border rounded-2xl p-6 overflow-auto">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-clawd-text-dim">
            No performance data available for selected period
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-clawd-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-clawd-text-dim">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-clawd-text-dim">Agent</th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-clawd-text-dim cursor-pointer hover:text-clawd-text"
                  onClick={() => handleSort('success_rate')}
                >
                  Success Rate {sortBy === 'success_rate' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-clawd-text-dim cursor-pointer hover:text-clawd-text"
                  onClick={() => handleSort('avg_completion_hours')}
                >
                  Avg Time {sortBy === 'avg_completion_hours' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-clawd-text-dim cursor-pointer hover:text-clawd-text"
                  onClick={() => handleSort('clara_approval_rate')}
                >
                  Clara Rate {sortBy === 'clara_approval_rate' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right py-3 px-4 text-sm font-medium text-clawd-text-dim cursor-pointer hover:text-clawd-text"
                  onClick={() => handleSort('tokens_per_task')}
                >
                  Tokens/Task {sortBy === 'tokens_per_task' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-clawd-text-dim">Tasks</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-clawd-text-dim">Cost</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((agent) => {
                const theme = getAgentTheme(agent.agent_id);
                const statusColor = getStatusColor(agent);

                return (
                  <tr
                    key={agent.agent_id}
                    onClick={() => handleRowClick(agent.agent_id)}
                    className="border-b border-clawd-border/50 hover:bg-clawd-border/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: theme.color }}
                        />
                        <span className="font-medium">{agent.agent_id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={agent.success_rate >= 0.8 ? 'text-success' : agent.success_rate >= 0.6 ? 'text-warning' : 'text-error'}>
                        {(agent.success_rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-clawd-text-dim">{agent.avg_completion_hours.toFixed(1)}h</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={agent.clara_approval_rate >= 0.85 ? 'text-success' : agent.clara_approval_rate >= 0.7 ? 'text-warning' : 'text-error'}>
                        {(agent.clara_approval_rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-clawd-text-dim">{agent.tokens_per_task.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-clawd-text-dim">{agent.total_tasks}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-clawd-text-dim">${agent.total_cost.toFixed(2)}</span>
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
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedAgent(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgent(null); } }}
          role="button"
          tabIndex={0}
          aria-label="Close modal"
        >
          <div
            className="bg-clawd-surface border border-clawd-border rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="p-6 border-b border-clawd-border sticky top-0 bg-clawd-surface">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Activity size={20} className="text-clawd-accent" />
                {selectedAgent} Audit Trail
              </h3>
              <p className="text-sm text-clawd-text-dim mt-1">
                Last {period} days of lifecycle changes and activity
              </p>
            </div>

            <div className="p-6">
              {auditLoading ? (
                <div className="text-center py-8 text-clawd-text-dim">Loading audit data...</div>
              ) : auditData.length === 0 ? (
                <div className="text-center py-8 text-clawd-text-dim">No audit entries found</div>
              ) : (
                <div className="space-y-3">
                  {auditData.slice(0, 50).map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex gap-3 p-3 rounded-lg border border-clawd-border/50 hover:bg-clawd-border/30 transition-colors"
                    >
                      <div className="flex-shrink-0 w-32 text-xs text-clawd-text-dim">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="flex-1">
                        {entry.type === 'lifecycle' ? (
                          <div>
                            <div className="text-sm font-medium text-amber-400">
                              Lifecycle: {entry.field}
                            </div>
                            <div className="text-xs text-clawd-text-dim mt-1">
                              {entry.from_value} → {entry.to_value}
                              {entry.changed_by && ` (by ${entry.changed_by})`}
                            </div>
                            {entry.reason && (
                              <div className="text-xs text-clawd-text-dim mt-1">
                                Reason: {entry.reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-medium">{entry.action}</div>
                            {entry.task_id && (
                              <div className="text-xs text-clawd-text-dim">Task: {entry.task_id}</div>
                            )}
                            {entry.message && (
                              <div className="text-xs text-clawd-text-dim mt-1 line-clamp-2">
                                {entry.message}
                              </div>
                            )}
                            {entry.outcome && (
                              <div className={`text-xs mt-1 ${entry.outcome === 'success' ? 'text-success' : 'text-error'}`}>
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

            <div className="p-6 border-t border-clawd-border flex justify-end">
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/70 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
