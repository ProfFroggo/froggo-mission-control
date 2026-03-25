import { useState, useEffect, useRef, useCallback } from 'react';
import { X, TrendingUp, Award, CheckCircle, Clock, Activity, Crown, Trophy, Dumbbell, Zap } from 'lucide-react';
import { Button, Box, Flex } from '@radix-ui/themes';
import { useStore } from '../store/store';
import { getAgentTheme } from '../utils/agentThemes';
import { agentApi } from '../lib/api';

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
      const detailsArray = await Promise.all(
        agentIds.map(id => agentApi.getById(id).catch(() => null))
      );
      const results: ComparisonData = {};

      for (let i = 0; i < agentIds.length; i++) {
        const agentId = agentIds[i];
        const agent = agents.find(a => a.id === agentId);
        if (!agent) continue;
        const details = detailsArray[i] || {};

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
    <Flex
      align="center"
      justify="center"
      p="4"
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropClick}
      aria-label="Close modal backdrop"
    >
      <Flex
        direction="column"
        className={`bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-mission-control-text">Agent Comparison</h2>
            <p className="text-xs text-mission-control-text-dim mt-0.5">Comparing {agentIds.length} agents</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <Box className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <Flex align="center" justify="center" style={{ height: '16rem' }}>
              <div className="text-mission-control-text-dim">Loading comparison...</div>
            </Flex>
          ) : (
            <div className="space-y-6">
              {/* Agent Headers */}
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                {agentIds.map(agentId => {
                  const agentData = data[agentId];
                  if (!agentData) return null;

                  return (
                    <div key={agentId} className="bg-mission-control-bg rounded-lg p-4 text-center">
                      <div className="mb-2">
                        {(() => {
                          const theme = getAgentTheme(agentId);
                          return theme.pic ? (
                            <img src={`/api/agents/${agentId}/avatar`} alt={agentData.name} className="w-12 h-12 rounded-lg object-cover mx-auto ring-2 ring-white/10"
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
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-1.5">
                  <TrendingUp size={12} />
                  Success Rate
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;
                    const isWinner = getWinner('successRate') === agentId;

                    return (
                      <div key={agentId} className={`bg-mission-control-bg rounded-lg p-4 ${isWinner ? 'ring-2 ring-success' : ''}`}>
                        <div className="text-3xl font-bold text-[var(--color-success)] mb-1 tabular-nums">
                          {Math.round(agentData.successRate * 100)}%
                        </div>
                        <div className="text-xs text-mission-control-text-dim">
                          {isWinner && <span className="inline-flex items-center gap-1"><Crown size={14} /> Best</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Average Time */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-1.5">
                  <Clock size={12} />
                  Average Completion Time
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;

                    return (
                      <div key={agentId} className="bg-mission-control-bg rounded-lg p-4">
                        <div className="text-3xl font-bold text-[var(--color-info)] mb-1 tabular-nums">
                          {agentData.avgTime}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">
                          per task
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Tasks */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-1.5">
                  <CheckCircle size={12} />
                  Total Tasks Completed
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;
                    const isWinner = getWinner('totalTasks') === agentId;

                    return (
                      <div key={agentId} className={`bg-mission-control-bg rounded-lg p-4 ${isWinner ? 'ring-2 ring-review' : ''}`}>
                        <div className="text-3xl font-bold text-[var(--color-review)] mb-1 tabular-nums">
                          {agentData.totalTasks}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">
                          {isWinner && <span className="inline-flex items-center gap-1"><Crown size={14} /> Most Productive</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Skills Comparison */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-1.5">
                  <Award size={12} />
                  Skills Inventory
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;

                    return (
                      <div key={agentId} className="bg-mission-control-bg rounded-lg p-4">
                        <div className="text-lg font-bold mb-2">
                          {agentData.skills.length} Skills
                        </div>
                        <div className="space-y-1">
                          {agentData.skills.slice(0, 5).map((skill, i) => (
                            <div key={i} className="text-xs px-2 py-1 bg-mission-control-surface rounded">
                              {skill}
                            </div>
                          ))}
                          {agentData.skills.length > 5 && (
                            <div className="text-xs text-mission-control-text-dim text-center">
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
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-1.5">
                  <Activity size={12} />
                  Recent Activity
                </h3>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${agentIds.length}, 1fr)` }}>
                  {agentIds.map(agentId => {
                    const agentData = data[agentId];
                    if (!agentData) return null;
                    const isWinner = getWinner('recentActivity') === agentId;

                    return (
                      <div key={agentId} className={`bg-mission-control-bg rounded-lg p-4 ${isWinner ? 'ring-2 ring-warning' : ''}`}>
                        <div className="text-3xl font-bold text-[var(--color-warning)] mb-1 tabular-nums">
                          {agentData.recentActivity}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">
                          {isWinner ? <span className="inline-flex items-center gap-1"><Crown size={14} /> Most Active</span> : 'recent tasks'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[var(--color-info)]/10 border border-[var(--color-info)]/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 text-[var(--color-info)]">Summary</h3>
                <div className="text-sm space-y-1">
                  {getWinner('successRate') && (
                    <Flex align="center" gap="2">
                      <Trophy size={16} /> <strong>{data[getWinner('successRate')!]?.name}</strong> has the highest success rate
                    </Flex>
                  )}
                  {getWinner('totalTasks') && (
                    <Flex align="center" gap="2">
                      <Dumbbell size={16} /> <strong>{data[getWinner('totalTasks')!]?.name}</strong> has completed the most tasks
                    </Flex>
                  )}
                  {getWinner('recentActivity') && (
                    <Flex align="center" gap="2">
                      <Zap size={16} /> <strong>{data[getWinner('recentActivity')!]?.name}</strong> has been most active recently
                    </Flex>
                  )}
                </div>
              </div>
            </div>
          )}
        </Box>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button onClick={handleClose} size="2" variant="ghost">
            Close
          </Button>
        </div>
      </Flex>
    </Flex>
  );
}
