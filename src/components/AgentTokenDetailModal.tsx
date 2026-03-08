import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { getAgentTheme } from '../utils/agentThemes';
import { analyticsApi } from '../lib/api';

interface AgentTokenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: string | null;
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

export default function AgentTokenDetailModal({
  isOpen,
  onClose,
  agent,
}: AgentTokenDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [sessionLog, setSessionLog] = useState<TokenLogEntry[]>([]);

  useEffect(() => {
    if (isOpen && agent) {
      loadSessionLog();
    }
  }, [isOpen, agent]);

  const loadSessionLog = useCallback(async () => {
    if (!agent) return;

    setLoading(true);
    try {
      const data = await analyticsApi.getTokenUsage({ agent, limit: '50' });
      setSessionLog((data?.entries || []) as TokenLogEntry[]);
    } catch (error) {
      // 'Failed to load session log:', error;
      setSessionLog([]);
    } finally {
      setLoading(false);
    }
  }, [agent]);

  if (!isOpen || !agent) return null;

  // Calculate totals
  const totalCalls = sessionLog.length;
  const totalTokens = sessionLog.reduce((sum, entry) => sum + entry.total_tokens, 0);
  const totalCost = sessionLog.reduce((sum, entry) => sum + entry.cost, 0);
  const uniqueSessions = new Set(
    sessionLog.filter((e) => e.session_id).map((e) => e.session_id)
  ).size;

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Truncate model name
  const truncateModel = (model: string) => {
    if (model.includes('/')) {
      const parts = model.split('/');
      return parts[parts.length - 1];
    }
    return model;
  };

  const theme = getAgentTheme(agent);

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    onClose();
  };

  // Handle inner click with keyboard support
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
        className="bg-mission-control-bg border border-mission-control-border rounded-2xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={handleInnerClick}
        onKeyDown={handleInnerClick}
        role="presentation"
      >
        {/* Header */}
        <div className="p-5 border-b border-mission-control-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: theme.color }}
            />
            <div>
              <h3 className="text-lg font-semibold">
                {agent.charAt(0).toUpperCase() + agent.slice(1)}
              </h3>
              <p className="text-sm text-mission-control-text-dim">Token Usage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Session Log Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-mission-control-text-dim">Loading session log...</div>
            </div>
          ) : sessionLog.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-mission-control-text-dim">
                No token usage recorded for this agent
              </div>
            </div>
          ) : (
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
