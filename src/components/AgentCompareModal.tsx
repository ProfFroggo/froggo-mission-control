/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, TrendingUp, Award, CheckCircle, Clock, Activity } from 'lucide-react';
import { useStore } from '../store/store';
import { getAgentTheme } from '../utils/agentThemes';

interface AgentCompareModalProps {
  agentIds: string[];
  onClose: () => void;
}

interface ComparisonData {
  [agentId: string]: {
    name: string;
    avatar: string;
    successRate: number;
    avgTime: string;
    totalTasks: number;
    skills: string[];
    recentActivity: number;
  };
}

export default function AgentCompareModal({ agentIds, onClose }: AgentCompareModalProps) {
  const { agents } = useStore();
  const [isClosing, setIsClosing] = useState(false);
  const [data, setData] = useState<ComparisonData>({});
  const [loading, setLoading] = useState(true);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  useEffect(() => {
    loadComparisonData();
  }, [agentIds]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- handleClose is stable modal handler

  const loadComparisonData = useCallback(async () => {
    setLoading(true);
    try {
      const results: ComparisonData = {};
      
      for (const agentId of agentIds) {
        const agent = agents.find(a => a.id === agentId);
        if (!agent) continue;

        const details = await window.clawdbot.agents.getDetails(agentId);
        results[agentId] = {
          name: agent.name,
          avatar: agent.avatar || '',
          successRate: details.successRate || 0,
          avgTime: details.avgTime || 'N/A',
          totalTasks: details.totalTasks || 0,
          skills: details.skills?.map((s: any) => s.name) || [],
          recentActivity: details.recentTasks?.length || 0,
        };
      }

      setData(results);
    } catch (e) {
      // 'Failed to load comparison data:', e;
    }
    setLoading(false);
  }, [agentIds, agents]);

  const getWinner = (metric: keyof ComparisonData[string]): string | null => {
    if (Object.keys(data).length === 0) return null;
    
    const entries = Object.entries(data);
    if (metric === 'successRate' || metric === 'totalTasks' || metric === 'recentActivity') {
      return entries.reduce((max, [id, stats]) => 
        (stats[metric] as number) > (data[max][metric] as number) ? id : max
      , entries[0][0]);
    }
    return null;
  };

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    handleClose();
  };

  // Handle inner click with keyboard support
  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <div 
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`} 
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropClick}
      aria-label="Close modal backdrop"
    >
      <div 
        className={`glass-modal rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`} 
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="p-6 border-b border-clawd-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Activity size={24} />
              Agent Comparison
            </h2>
            <p className="text-sm text-clawd-text-dim">
              Comparing {agentIds.length} agents
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-clawd-text-dim">Loading comparison...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agent Headers */}
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                {agentIds.map(agentId => {
                  const agentData = data[agentId];
                  if (!agentData) return null;

                  return (
                    <div key={agentId} className="bg-clawd-bg rounded-lg p-4 text-center">
                      <div className="mb-2">
                        {(() => {
                          const theme = getAgentTheme(agentId);
                          return theme.pic ? (
                            <img src={`./agent-profiles/${theme.pic}`} alt={agentData.name} className="w-12 h-12 rounded-xl object-cover mx-auto ring-2 ring-white/10"
                              onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { className: 'text-4xl', textContent: agentData.avatar })); }} />
                          ) : (
                            <span className="text-4xl">{agentData.avatar}</span>
                          );
                        })()}
                      </div>
                      <div className="font-semibold">{agentData.name}</div>
                    </div>
                  );
                })}
              </div>

              {/* Success Rate */}
              <div>
                <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-3 flex items-center gap-2">
                  <TrendingUp size={16} />
                  Success Rate
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;
                    const isWinner = getWinner('successRate') === agentId;

                    return (
                      <div key={agentId} className={`bg-clawd-bg rounded-lg p-4 ${isWinner ? 'ring-2 ring-success' : ''}`}>
                        <div className="text-3xl font-bold text-success mb-1">
                          {Math.round(agentData.successRate * 100)}%
                        </div>
                        <div className="text-xs text-clawd-text-dim">
                          {isWinner && '👑 Best'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Average Time */}
              <div>
                <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-3 flex items-center gap-2">
                  <Clock size={16} />
                  Average Completion Time
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;

                    return (
                      <div key={agentId} className="bg-clawd-bg rounded-lg p-4">
                        <div className="text-3xl font-bold text-info mb-1">
                          {agentData.avgTime}
                        </div>
                        <div className="text-xs text-clawd-text-dim">
                          per task
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Tasks */}
              <div>
                <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-3 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Total Tasks Completed
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;
                    const isWinner = getWinner('totalTasks') === agentId;

                    return (
                      <div key={agentId} className={`bg-clawd-bg rounded-lg p-4 ${isWinner ? 'ring-2 ring-review' : ''}`}>
                        <div className="text-3xl font-bold text-review mb-1">
                          {agentData.totalTasks}
                        </div>
                        <div className="text-xs text-clawd-text-dim">
                          {isWinner && '👑 Most Productive'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Skills Comparison */}
              <div>
                <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-3 flex items-center gap-2">
                  <Award size={16} />
                  Skills Inventory
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;

                    return (
                      <div key={agentId} className="bg-clawd-bg rounded-lg p-4">
                        <div className="text-lg font-bold mb-2">
                          {agentData.skills.length} Skills
                        </div>
                        <div className="space-y-1">
                          {agentData.skills.slice(0, 5).map((skill, i) => (
                            <div key={i} className="text-xs px-2 py-1 bg-clawd-surface rounded">
                              {skill}
                            </div>
                          ))}
                          {agentData.skills.length > 5 && (
                            <div className="text-xs text-clawd-text-dim text-center">
                              +{agentData.skills.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="text-sm font-semibold text-clawd-text-dim uppercase mb-3 flex items-center gap-2">
                  <Activity size={16} />
                  Recent Activity
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;
                    const isWinner = getWinner('recentActivity') === agentId;

                    return (
                      <div key={agentId} className={`bg-clawd-bg rounded-lg p-4 ${isWinner ? 'ring-2 ring-warning' : ''}`}>
                        <div className="text-3xl font-bold text-warning mb-1">
                          {agentData.recentActivity}
                        </div>
                        <div className="text-xs text-clawd-text-dim">
                          {isWinner ? '👑 Most Active' : 'recent tasks'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-info-subtle border border-info-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 text-info">Summary</h3>
                <div className="text-sm space-y-1">
                  {getWinner('successRate') && (
                    <div>
                      🏆 <strong>{data[getWinner('successRate')!]?.name}</strong> has the highest success rate
                    </div>
                  )}
                  {getWinner('totalTasks') && (
                    <div>
                      💪 <strong>{data[getWinner('totalTasks')!]?.name}</strong> has completed the most tasks
                    </div>
                  )}
                  {getWinner('recentActivity') && (
                    <div>
                      ⚡ <strong>{data[getWinner('recentActivity')!]?.name}</strong> has been most active recently
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clawd-border flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
