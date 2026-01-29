import { useState, useEffect } from 'react';
import { Bot, Play, Square, RefreshCw, Plus, MessageSquare, Zap, Clock, CheckCircle, ChevronDown, ChevronRight, Award, FileText, GitCompare, BarChart3 } from 'lucide-react';
import { useStore, Agent } from '../store/store';
import WorkerModal from './WorkerModal';
import AgentDetailModal from './AgentDetailModal';
import AgentCompareModal from './AgentCompareModal';
import AgentChatModal from './AgentChatModal';
import AgentMetricsCard from './AgentMetricsCard';
import { InlineLoader } from './LoadingStates';

export default function AgentPanel() {
  const { agents, tasks, spawnAgentForTask, updateAgentStatus, gatewaySessions, loadGatewaySessions } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [compareAgents, setCompareAgents] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [chatAgent, setChatAgent] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [agentMetrics, setAgentMetrics] = useState<Record<string, any>>({});
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll gateway sessions every 5 seconds
  useEffect(() => {
    loadGatewaySessions();
    const interval = setInterval(loadGatewaySessions, 5000);
    return () => clearInterval(interval);
  }, [loadGatewaySessions]);

  // Load agent metrics
  useEffect(() => {
    loadAgentMetrics();
  }, []);

  const loadAgentMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const data = await (window as any).clawdbot.agents.getMetrics();
      setAgentMetrics(data);
    } catch (e) {
      console.error('Failed to load agent metrics:', e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadGatewaySessions(), loadAgentMetrics()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get real sub-agents from gateway (key contains 'subagent')
  const realSubagents = gatewaySessions.filter(s => s.type === 'subagent');
  const activeSubagents = realSubagents.filter(s => s.isActive);

  const statusColors: Record<Agent['status'], string> = {
    active: 'bg-green-500',
    busy: 'bg-yellow-500 animate-pulse',
    idle: 'bg-gray-500',
    offline: 'bg-red-500',
  };

  const statusLabels: Record<Agent['status'], string> = {
    active: 'Active',
    busy: 'Working...',
    idle: 'Idle',
    offline: 'Offline',
  };

  // Get tasks assigned to each agent
  const getAgentTasks = (agentId: string) => {
    return tasks.filter(t => t.assignedTo === agentId && t.status !== 'done');
  };

    // const getCompletedTasksCount = (agentId: string) => {
  //   return tasks.filter(t => t.assignedTo === agentId && t.status === 'done').length;
  // };

  // Send message to agent (currently unused)
  // const messageAgent = async (agent: Agent, message: string) => {
  //   if (!agent.sessionKey) return;
  //   try {
  //     await gateway.request('sessions.send', {
  //       sessionKey: agent.sessionKey,
  //       message,
  //     });
  //     addActivity({ type: 'agent', message: `Messaged ${agent.name}: ${message.slice(0, 50)}...`, timestamp: Date.now() });
  //   } catch (e) {
  //     console.error('Failed to message agent:', e);
  //   }
  // };

  // Toggle agent expansion
  const toggleExpanded = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  // Toggle compare selection
  const toggleCompare = (agentId: string) => {
    if (compareAgents.includes(agentId)) {
      setCompareAgents(compareAgents.filter(id => id !== agentId));
    } else if (compareAgents.length < 3) {
      setCompareAgents([...compareAgents, agentId]);
    }
  };

  // Main agents vs workers
  const mainAgents = agents.filter(a => ['main', 'coder', 'researcher', 'writer', 'chief'].includes(a.id));
  const workerAgents = agents.filter(a => a.id.startsWith('worker-'));

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="icon-text text-2xl font-semibold mb-1">
              <Bot size={24} className="flex-shrink-0" /> Agent Management
            </h1>
            <p className="text-clawd-text-dim">
              {activeSubagents.length} sub-agent{activeSubagents.length !== 1 ? 's' : ''} running • {realSubagents.length} total sessions
            </p>
          </div>
          <div className="icon-text">
            {compareAgents.length >= 2 && (
              <button
                onClick={() => setShowCompare(true)}
                className="icon-text px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl hover:bg-purple-500/30 transition-colors"
              >
                <GitCompare size={16} className="flex-shrink-0" />
                Compare ({compareAgents.length})
              </button>
            )}
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`icon-text px-4 py-2 border rounded-xl transition-colors ${
                showAnalytics 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                  : 'bg-clawd-surface border-clawd-border hover:bg-clawd-border'
              }`}
              title="Analytics"
            >
              <BarChart3 size={16} className="flex-shrink-0" />
              Analytics
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="icon-btn border border-clawd-border bg-clawd-surface disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="icon-text px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
            >
              <Plus size={16} className="flex-shrink-0" />
              New Worker
            </button>
          </div>
        </div>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="mb-6 bg-clawd-surface rounded-xl border border-clawd-border p-6 shadow-card">
            <h2 className="icon-text text-lg font-semibold mb-4">
              <BarChart3 size={20} className="flex-shrink-0" />
              Performance Analytics
              {loadingMetrics && <InlineLoader size="sm" />}
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-clawd-bg rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{tasks.filter(t => t.status === 'done').length}</div>
                <div className="text-sm text-clawd-text-dim">Tasks Completed</div>
              </div>
              <div className="bg-clawd-bg rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">{tasks.filter(t => t.status === 'in-progress').length}</div>
                <div className="text-sm text-clawd-text-dim">In Progress</div>
              </div>
              <div className="bg-clawd-bg rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-400">{activeSubagents.length}</div>
                <div className="text-sm text-clawd-text-dim">Active Sub-Agents</div>
              </div>
              <div className="bg-clawd-bg rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-400">{Object.keys(agentMetrics).length}</div>
                <div className="text-sm text-clawd-text-dim">Tracked Skills</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Agents */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Core Agents</span>
            {compareAgents.length > 0 && (
              <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                {compareAgents.length} selected for comparison
              </span>
            )}
          </h2>
          <div className="grid gap-4">
            {mainAgents.map((agent) => {
              const agentTasks = getAgentTasks(agent.id);
  //             const __completedTasks = getCompletedTasksCount(agent.id);
              const currentTask = tasks.find(t => t.id === agent.currentTaskId);
              const isExpanded = expandedAgents.has(agent.id);
              const metrics = agentMetrics[agent.id] || {};
              const isCompareSelected = compareAgents.includes(agent.id);
              
              // Gradient accent colors per agent type
              const gradientColors: Record<string, string> = {
                'froggo': 'from-green-500/10 via-transparent to-transparent',
                'main': 'from-green-500/10 via-transparent to-transparent',
                'coder': 'from-blue-500/10 via-transparent to-transparent',
                'researcher': 'from-purple-500/10 via-transparent to-transparent',
                'writer': 'from-pink-500/10 via-transparent to-transparent',
                'chief': 'from-orange-500/10 via-transparent to-transparent',
              };
              const gradient = gradientColors[agent.id.toLowerCase()] || 'from-clawd-accent/5 via-transparent to-transparent';
              
              return (
                <div
                  key={agent.id}
                  className={`bg-clawd-surface rounded-xl border p-4 shadow-card hover:shadow-card-hover transition-all bg-gradient-to-br ${gradient} ${
                    isCompareSelected ? 'border-purple-500/50 shadow-purple-500/20' : 'border-clawd-border'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="text-4xl">{agent.avatar}</div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="icon-text mb-1">
                        <button
                          onClick={() => toggleExpanded(agent.id)}
                          className="hover:bg-clawd-border rounded p-1 transition-colors"
                        >
                          {isExpanded ?  <ChevronDown size={16} className="flex-shrink-0" /> :  <ChevronRight size={16} className="flex-shrink-0" />}
                        </button>
                        <h3 className="font-semibold text-lg">{agent.name}</h3>
                        <span className={`w-2 h-2 rounded-full ${statusColors[agent.status]}`} />
                        <span className="text-sm text-clawd-text-dim">{statusLabels[agent.status]}</span>
                        
                        {/* Quick Stats - Compact Metrics */}
                        <div className="ml-auto">
                          <AgentMetricsCard
                            agentId={agent.id}
                            agentName={agent.name}
                            metrics={metrics}
                            compact={true}
                          />
                        </div>
                      </div>
                      <p className="text-sm text-clawd-text-dim mb-2">{agent.description}</p>
                      
                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {agent.capabilities?.map((cap, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-clawd-border rounded-full">
                            {cap}
                          </span>
                        ))}
                      </div>

                      {/* Current Task */}
                      {currentTask && (
                        <div className="icon-text p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm mb-2">
                          <Zap size={16} className="text-yellow-500" />
                          <span className="font-medium">Working on:</span>
                          <span className="truncate">{currentTask.title}</span>
                        </div>
                      )}

                      {/* Queued Tasks */}
                      {agentTasks.length > 0 && !currentTask && (
                        <div className="text-sm text-clawd-text-dim">
                          <Clock size={14} className="inline mr-1" />
                          {agentTasks.length} task{agentTasks.length > 1 ? 's' : ''} queued
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-clawd-border space-y-3">
                          {/* Performance Metrics Card */}
                          <AgentMetricsCard
                            agentId={agent.id}
                            agentName={agent.name}
                            metrics={metrics}
                          />

                          {/* Skills */}
                          <div>
                            <h4 className="text-xs font-semibold text-clawd-text-dim uppercase mb-2 flex items-center gap-1">
                               <Award size={14} className="flex-shrink-0" />
                              Skills ({agent.capabilities?.length || 0})
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {agent.capabilities?.map((skill, i) => (
                                <button
                                  key={i}
                                  onClick={() => setSelectedAgent(agent.id)}
                                  className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                                >
                                  {skill}
                                </button>
                              ))}
                              <button
                                onClick={() => setSelectedAgent(agent.id)}
                                className="px-2 py-1 text-xs bg-clawd-border text-clawd-text-dim rounded hover:bg-clawd-border/80 transition-colors"
                              >
                                + Add Skill
                              </button>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedAgent(agent.id)}
                              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 bg-clawd-border text-sm rounded-lg hover:bg-clawd-border/80 transition-colors"
                            >
                               <FileText size={16} className="flex-shrink-0" />
                              View Details
                            </button>
                            <button
                              onClick={() => setChatAgent(agent.id)}
                              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm rounded-lg hover:bg-blue-500/30 transition-colors"
                            >
                               <MessageSquare size={16} className="flex-shrink-0" />
                              Chat to Improve
                            </button>
                            <button
                              onClick={() => toggleCompare(agent.id)}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                                isCompareSelected
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : 'bg-clawd-border hover:bg-clawd-border/80'
                              }`}
                            >
                               <GitCompare size={16} className="flex-shrink-0" />
                              Compare
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {agent.status === 'idle' && agentTasks.length > 0 && (
                        <button
                          onClick={() => spawnAgentForTask(agentTasks[0].id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                        >
                           <Play size={16} className="flex-shrink-0" /> Start
                        </button>
                      )}
                      {agent.status === 'busy' && agent.sessionKey && (
                        <button
                          onClick={() => updateAgentStatus(agent.id, 'idle')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30"
                        >
                           <Square size={16} className="flex-shrink-0" /> Stop
                        </button>
                      )}
                      {!isExpanded && (
                        <button
                          onClick={() => toggleExpanded(agent.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-clawd-border text-sm rounded-lg hover:bg-clawd-border/80"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real Sub-Agents from Gateway */}
        {realSubagents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3">
              Sub-Agents ({activeSubagents.length} active / {realSubagents.length} total)
            </h2>
            <div className="space-y-2">
              {realSubagents.map((session) => (
                <div
                  key={session.key}
                  className={`bg-clawd-surface rounded-lg border p-3 flex items-center gap-3 overflow-hidden ${
                    session.isActive ? 'border-green-500/30 bg-green-500/5' : 'border-clawd-border'
                  }`}
                >
                  <span className="text-xl no-shrink">🤖</span>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium session-name flex-shrink">{session.displayName}</span>
                      {session.label && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded no-shrink no-wrap">
                          {session.label}
                        </span>
                      )}
                      <span className={`w-2 h-2 rounded-full no-shrink ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                      {session.isActive && <span className="text-xs text-green-400 no-shrink no-wrap">Active</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-clawd-text-dim overflow-hidden">
                      <span className="no-shrink">{session.model?.split('/').pop() || 'unknown'}</span>
                      <span className="no-shrink no-wrap">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</span>
                      <span className="truncate flex-1 min-w-0" title={session.key}>{session.key}</span>
                    </div>
                  </div>
                  {session.isActive ? (
                    <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                      Running
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded">
                      Idle
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Worker Agents (from store) */}
        {workerAgents.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-clawd-text-dim uppercase tracking-wider mb-3">
              Worker Agents ({workerAgents.length})
            </h2>
            <div className="space-y-2">
              {workerAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-clawd-surface rounded-lg border border-clawd-border p-3 flex items-center gap-3 overflow-hidden"
                >
                  <span className="text-xl no-shrink">{agent.avatar}</span>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium agent-name flex-1 min-w-0">{agent.name}</span>
                      <span className={`w-2 h-2 rounded-full no-shrink ${statusColors[agent.status]}`} />
                    </div>
                    <p className="text-xs text-clawd-text-dim truncate">{agent.description}</p>
                  </div>
                  {agent.status === 'busy' ? (
                    <button
                      onClick={() => updateAgentStatus(agent.id, 'idle')}
                      className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      Stop
                    </button>
                  ) : (
                    <span className="text-xs text-green-400">
                      <CheckCircle size={16} className="inline mr-1" />
                      Done
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modals */}
        <WorkerModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        
        {selectedAgent && (
          <AgentDetailModal
            agentId={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}

        {showCompare && compareAgents.length >= 2 && (
          <AgentCompareModal
            agentIds={compareAgents}
            onClose={() => {
              setShowCompare(false);
              setCompareAgents([]);
            }}
          />
        )}

        {chatAgent && (
          <AgentChatModal
            agentId={chatAgent}
            onClose={() => setChatAgent(null)}
          />
        )}
      </div>
    </div>
  );
}
