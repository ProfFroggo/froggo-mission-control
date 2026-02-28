import { useState, useEffect } from 'react';
import { Bot, Play, Square, StopCircle, RefreshCw, Plus, MessageSquare, Zap, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Award, FileText, GitCompare, BarChart3, Settings } from 'lucide-react';
import { useStore, Agent } from '../store/store';
import { useShallow } from 'zustand/react/shallow';
import { gateway } from '../lib/gateway';
import WorkerModal from './WorkerModal';
import AgentDetailModal from './AgentDetailModal';
import AgentCompareModal from './AgentCompareModal';
import AgentChatModal from './AgentChatModal';
import AgentManagementModal from './AgentManagementModal';
import AgentMetricsCard from './AgentMetricsCard';
import HRSection from './HRSection';
import { InlineLoader } from './LoadingStates';
import { CircuitBreakerStatus } from './CircuitBreakerStatus';

import { getAgentTheme } from '../utils/agentThemes';
import WidgetLoader from './WidgetLoader';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentPanel');
const getTheme = getAgentTheme;

// Static lookup for Tailwind JIT — dynamic `hover:${theme.bg}` won't generate CSS
const HOVER_BG_MAP: Record<string, string> = {
  'bg-success-subtle': 'hover:bg-success-subtle',
  'bg-info-subtle': 'hover:bg-info-subtle',
  'bg-warning-subtle': 'hover:bg-warning-subtle',
  'bg-review-subtle': 'hover:bg-review-subtle',
  'bg-error-subtle': 'hover:bg-error-subtle',
  'bg-teal-500/8': 'hover:bg-teal-500/8',
  'bg-pink-500/8': 'hover:bg-pink-500/8',
  'bg-sky-500/8': 'hover:bg-sky-500/8',
  'bg-violet-500/8': 'hover:bg-violet-500/8',
  'bg-amber-600/8': 'hover:bg-amber-600/8',
  'bg-rose-500/8': 'hover:bg-rose-500/8',
  'bg-cyan-500/8': 'hover:bg-cyan-500/8',
  'bg-indigo-500/8': 'hover:bg-indigo-500/8',
  'bg-clawd-surface': 'hover:bg-clawd-surface',
};

export default function AgentPanel() {
  const { agents, tasks, gatewaySessions } = useStore(
    useShallow(s => ({
      agents: s.agents,
      tasks: s.tasks,
      gatewaySessions: s.gatewaySessions,
    }))
  );
  const spawnAgentForTask = useStore(s => s.spawnAgentForTask);
  const updateAgentStatus = useStore(s => s.updateAgentStatus);
  const fetchAgents = useStore(s => s.fetchAgents);
  const loadGatewaySessions = useStore(s => s.loadGatewaySessions);
  const loadTasksFromDB = useStore(s => s.loadTasksFromDB);
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
  const [managingAgent, setManagingAgent] = useState<{ id: string; name: string } | null>(null);
  const [ctxHealth, setCtxHealth] = useState<Record<string, { AGENTS: boolean; USER: boolean; TOOLS: boolean }>>({});
  const [memoryHealth, setMemoryHealth] = useState<Record<string, { sizeKB: number; archiveChunks: number; health: 'green' | 'yellow' | 'red'; lastRotation: string | null }>>({});
  const [rotatingAgent, setRotatingAgent] = useState<string | null>(null);

  useEffect(() => {
    window.clawdbot?.agentManagement?.ctx?.check().then((res) => {
      if (res?.success && res.health) setCtxHealth(res.health);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    (window as any).clawdbot?.memoryLifecycle?.status().then((res: any) => {
      if (res?.success && res.agents) {
        const health: Record<string, any> = {};
        for (const a of res.agents) {
          health[a.agentId] = {
            sizeKB: a.memorySizeKB,
            archiveChunks: a.archiveChunks,
            health: a.health,
            lastRotation: a.lastRotation,
          };
        }
        setMemoryHealth(health);
      }
    }).catch(() => {});
  }, []);

  const handleMemoryRotate = async (agentId: string) => {
    if (!confirm(`Rotate memory for agent "${agentId}"? Old content will be archived and searchable via froggo-db memory-search.`)) return;
    setRotatingAgent(agentId);
    try {
      const res = await (window as any).clawdbot?.memoryLifecycle?.rotate(agentId);
      if (res?.success) {
        const statusRes = await (window as any).clawdbot?.memoryLifecycle?.status();
        if (statusRes?.success && statusRes.agents) {
          const health: Record<string, any> = {};
          for (const a of statusRes.agents) {
            health[a.agentId] = { sizeKB: a.memorySizeKB, archiveChunks: a.archiveChunks, health: a.health, lastRotation: a.lastRotation };
          }
          setMemoryHealth(health);
        }
      }
    } finally {
      setRotatingAgent(null);
    }
  };

  useEffect(() => {
    fetchAgents(); // Load agents from registry
    loadGatewaySessions();
    loadTasksFromDB(); // Ensure tasks are loaded for agent detail modals
    
    // Set up event-based updates for real-time status changes
    const unsubscribeTaskUpdated = gateway.on('task.updated', () => {
      // Refresh sessions when tasks are updated (agents might change status)
      loadGatewaySessions();
      loadTasksFromDB();
    });

    const unsubscribeTaskCreated = gateway.on('task.created', () => {
      // Refresh when new tasks are created
      loadGatewaySessions();
      loadTasksFromDB();
    });

    const unsubscribeStateChange = gateway.on('stateChange', ({ state }: { state: string }) => {
      // Refresh when gateway connection state changes
      if (state === 'connected') {
        loadGatewaySessions();
        loadTasksFromDB();
      }
    });

    // Listen for chat events that might indicate agent activity changes
    const unsubscribeChat = gateway.on('chat', () => {
      // Chat activity suggests agents are working
      loadGatewaySessions();
    });

    // Fallback polling at longer interval (30s) for cases where events might be missed
    const interval = setInterval(loadGatewaySessions, 30000);

    return () => {
      clearInterval(interval);
      unsubscribeTaskUpdated();
      unsubscribeTaskCreated();
      unsubscribeStateChange();
      unsubscribeChat();
    };
  }, [fetchAgents, loadGatewaySessions, loadTasksFromDB]);

  useEffect(() => { loadAgentMetrics(); }, []);

  const loadAgentMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const data = await window.clawdbot?.agents?.getMetrics();
      if (data) setAgentMetrics(data);
    } catch (e) { logger.error('Failed to load agent metrics:', e); }
    finally { setLoadingMetrics(false); }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await Promise.all([loadGatewaySessions(), loadAgentMetrics()]); }
    finally { setIsRefreshing(false); }
  };

  const handleAgentStop = async (agentId: string) => {
    try {
      const result = await window.clawdbot?.agentManagement?.agent?.stop(agentId);
      if (result?.success) {
        await fetchAgents(); // Refresh agent list from DB
      } else {
        logger.error('[AgentPanel] Stop failed:', result?.error);
      }
    } catch (err) {
      logger.error('[AgentPanel] Stop error:', err);
    }
  };

  const handleAgentStart = async (agentId: string) => {
    try {
      const result = await window.clawdbot?.agentManagement?.agent?.start(agentId);
      if (result?.success) {
        await fetchAgents(); // Refresh agent list from DB
      } else {
        logger.error('[AgentPanel] Start failed:', result?.error);
      }
    } catch (err) {
      logger.error('[AgentPanel] Start error:', err);
    }
  };

  const realSubagents = gatewaySessions.filter(s => s.type === 'subagent');
  const activeSubagents = realSubagents.filter(s => s.isActive);

  const statusConfig: Record<Agent['status'], { color: string; label: string; pulse?: boolean; hideDot?: boolean }> = {
    active:     { color: 'bg-success',  label: 'Active', pulse: true },
    busy:       { color: 'bg-success',  label: 'Working…', pulse: true },
    idle:       { color: 'bg-warning', label: 'Idle' },
    offline:    { color: 'bg-clawd-bg0',   label: 'Offline', hideDot: true },
    suspended:  { color: 'bg-error',    label: 'Suspended', hideDot: true },
    archived:   { color: 'bg-clawd-bg0',   label: 'Archived', hideDot: true },
    draft:      { color: 'bg-warning', label: 'Draft', hideDot: true },
    disabled:   { color: 'bg-error',    label: 'Stopped', hideDot: true },
  };

  const getAgentTasks = (agentId: string) => tasks.filter(t => t.assignedTo === agentId && t.status !== 'done');

  const toggleExpanded = (agentId: string) => {
    const s = new Set(expandedAgents);
    if (s.has(agentId)) { s.delete(agentId); } else { s.add(agentId); }
    setExpandedAgents(s);
  };

  const toggleCompare = (agentId: string) => {
    if (compareAgents.includes(agentId)) setCompareAgents(compareAgents.filter(id => id !== agentId));
    else if (compareAgents.length < 3) setCompareAgents([...compareAgents, agentId]);
  };

  // Infrastructure agents that must never be stopped from UI
  const PROTECTED_AGENTS = ['froggo', 'main', 'clara'];

  // Skip phantom/legacy agents — use exclusion so new agents auto-appear
  const PHANTOM_AGENTS = ['main', 'chat-agent'];
  const realAgents = agents.filter(a => !PHANTOM_AGENTS.includes(a.id));
  
  // Remove duplicates by ID (in case store has dupes)
  const uniqueAgents = Array.from(new Map(realAgents.map(a => [a.id, a])).values());
  
  // Split into main agents and workers
  const mainAgents = uniqueAgents.filter(a => !a.id.startsWith('worker-'));
  const workerAgents = agents.filter(a => a.id.startsWith('worker-'));

  return (
    <div className="h-full overflow-auto p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="icon-text text-2xl font-bold tracking-tight mb-1">
              <Bot size={24} className="flex-shrink-0" /> Agents
            </h1>
            <p className="text-clawd-text-dim text-sm">
              {activeSubagents.length} sub-agent{activeSubagents.length !== 1 ? 's' : ''} running · {realSubagents.length} total
            </p>
          </div>
          <div className="icon-text gap-2">
            {compareAgents.length >= 2 && (
              <button type="button" onClick={() => setShowCompare(true)} className="icon-text px-3 py-2 text-review border border-review-border rounded-lg hover:bg-review-subtle transition-colors text-sm">
                <GitCompare size={15} className="flex-shrink-0" /> Compare ({compareAgents.length})
              </button>
            )}
            <button type="button" onClick={() => setShowAnalytics(!showAnalytics)}
              className={`icon-text px-3 py-2 border rounded-lg transition-colors text-sm ${showAnalytics ? 'text-info border-info-border bg-info-subtle' : 'border-clawd-border hover:bg-clawd-border/50'}`}>
              <BarChart3 size={15} className="flex-shrink-0" /> Analytics
            </button>
            <button type="button" onClick={handleRefresh} disabled={isRefreshing} className="icon-btn border border-clawd-border disabled:opacity-50" title="Refresh" aria-label="Refresh agents">
              <RefreshCw size={15} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setShowCreateModal(true)} className="icon-text px-3 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors text-sm">
              <Plus size={15} className="flex-shrink-0" /> New Worker
            </button>
          </div>
        </div>

        {/* Analytics */}
        {showAnalytics && (
          <div className="mb-8 rounded-xl border border-clawd-border p-5">
            <h2 className="icon-text text-base font-semibold mb-4">
              <BarChart3 size={18} className="flex-shrink-0" /> Performance
              {loadingMetrics && <InlineLoader size="sm" />}
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {(() => {
                const totalTokens = gatewaySessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);
                const activeAgentCount = agents.filter(a => a.status === 'active' || a.status === 'busy').length;
                const formatTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);
                return [
                  { val: activeAgentCount, label: 'Active Agents', color: 'text-success' },
                  { val: activeSubagents.length, label: 'Active Sub-Agents', color: 'text-amber-400' },
                  { val: gatewaySessions.length, label: 'Total Sessions', color: 'text-info' },
                  { val: formatTokens(totalTokens), label: 'Total Tokens', color: 'text-review' },
                ];
              })().map((s, i) => (
                <div key={i} className="rounded-lg border border-clawd-border p-4">
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</div>
                  <div className="text-xs text-clawd-text-dim mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Circuit Breaker Status */}
        <div className="mb-8">
          <CircuitBreakerStatus />
        </div>

        {/* HR Agent Section */}
        <HRSection />

        {/* Core Agents — Profile Card Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-clawd-text-dim uppercase tracking-widest">Core Agents</h2>
            {compareAgents.length > 0 && (
              <span className="text-xs px-2 py-0.5 text-review border border-review-border rounded-full">
                {compareAgents.length} selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mainAgents.map((agent) => {
              const theme = getTheme(agent.id);
              const agentTasks = getAgentTasks(agent.id);
              const currentTask = tasks.find(t => t.id === agent.currentTaskId);
              const isExpanded = expandedAgents.has(agent.id);
              const metrics = agentMetrics[agent.id] || {};
              const isCompareSelected = compareAgents.includes(agent.id);
              const sc = statusConfig[agent.status];
              // Hide dot when: no current task, task is done/review, or status says hideDot
              const hasActiveTask = currentTask && !['done', 'review', 'completed'].includes(currentTask.status);
              const showDot = !sc.hideDot && (agent.status === 'active' || agent.status === 'busy' || (agent.status === 'idle' && hasActiveTask));

              return (
                <div
                  key={agent.id}
                  className={`group relative rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 ${
                    isCompareSelected ? 'border-review-border' : theme.border
                  } ${isExpanded ? '' : 'cursor-pointer'}`}
                  onClick={() => !isExpanded && toggleExpanded(agent.id)}
                  onKeyDown={(e) => { if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleExpanded(agent.id); } }}
                  role="button"
                  tabIndex={isExpanded ? -1 : 0}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `${agent.name} details expanded` : `${agent.name} - press Enter to expand`}
                >
                  {/* Color accent bar */}
                  <div className="absolute top-0 left-4 right-4 h-0.5 rounded-b" style={{ backgroundColor: theme.color }} />

                  <div className="p-5">
                    {/* Profile header */}
                    <div className="flex items-start gap-4 mb-4">
                      {/* Profile picture */}
                      <div className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden ring-2 ${theme.ring} bg-clawd-bg`}>
                        {theme.pic ? (
                          <img
                            src={`./agent-profiles/${theme.pic}`}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; if ((e.target as HTMLImageElement).nextElementSibling) { ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); } }}
                          />
                        ) : null}
                        <span className={`${theme.pic ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-3xl`}>{agent.avatar}</span>
                        {/* Status dot - only show for active/busy agents or idle with active task */}
                        {showDot && <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-clawd-bg ${sc.color} ${sc.pulse ? 'animate-pulse' : ''}`} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg leading-tight">{agent.name}</h3>
                          <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${theme.bg} ${theme.text}`}>
                            {sc.label}
                          </span>
                          {/* Trust tier badge */}
                          {agent.trust_tier && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              agent.trust_tier === 'master' ? 'bg-review-subtle text-review' :
                              agent.trust_tier === 'expert' ? 'bg-warning/20 text-amber-400' :
                              'bg-clawd-bg0/20 text-clawd-text-dim'
                            }`}>
                              {agent.trust_tier === 'master' ? 'Master' :
                               agent.trust_tier === 'expert' ? 'Expert' :
                               agent.trust_tier === 'journeyman' ? 'Journeyman' :
                               'Apprentice'}
                            </span>
                          )}
                          {/* Lifecycle status badges for non-active agents */}
                          {agent.status === 'suspended' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-error-subtle text-error">
                              Suspended
                            </span>
                          )}
                          {agent.status === 'archived' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-500/20 text-clawd-text-dim">
                              Archived
                            </span>
                          )}
                          {agent.status === 'draft' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-warning-subtle text-warning">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-clawd-text-dim mt-1 line-clamp-2">{agent.description}</p>
                      </div>

                      {/* Compact metrics */}
                      <div className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                        <AgentMetricsCard agentId={agent.id} agentName={agent.name} metrics={metrics} compact={true} />
                      </div>
                    </div>

                    {/* Capabilities as colored pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {agent.capabilities?.slice(0, isExpanded ? undefined : 4).map((cap, i) => (
                        <span key={i} className={`px-2 py-0.5 text-[11px] font-medium rounded-md ${theme.bg} ${theme.text}`}>
                          {cap}
                        </span>
                      ))}
                      {!isExpanded && (agent.capabilities?.length || 0) > 4 && (
                        <span className="px-2 py-0.5 text-[11px] text-clawd-text-dim">+{(agent.capabilities?.length || 0) - 4}</span>
                      )}
                    </div>

                    {/* Current task */}
                    {currentTask && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-warning/5 text-sm mb-3">
                        <Zap size={14} className="text-amber-400 flex-shrink-0" />
                        <span className="truncate">{currentTask.title}</span>
                      </div>
                    )}

                    {/* Queued tasks */}
                    {agentTasks.length > 0 && !currentTask && (
                      <div className="text-xs text-clawd-text-dim mb-3">
                        <Clock size={12} className="inline mr-1" />
                        {agentTasks.length} task{agentTasks.length > 1 ? 's' : ''} queued
                      </div>
                    )}

                    {/* Action buttons row — always visible */}
                    <div className={`flex items-center gap-2 pt-2 border-t ${theme.border}`}>
                      {agent.status === 'idle' && agentTasks.length > 0 && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); spawnAgentForTask(agentTasks[0].id); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                          <Play size={12} /> Start
                        </button>
                      )}
                      {agent.status === 'busy' && agent.sessionKey && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); updateAgentStatus(agent.id, 'idle'); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors">
                          <Square size={12} /> Stop
                        </button>
                      )}
                      {/* Lifecycle start/stop toggle — real DB-persisted enable/disable */}
                      {agent.status === 'disabled' ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAgentStart(agent.id); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-success border border-success-border rounded hover:bg-success-subtle transition-colors"
                          title="Re-enable agent for dispatcher"
                        >
                          <Play size={12} className="inline" /> Enable
                        </button>
                      ) : !PROTECTED_AGENTS.includes(agent.id) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAgentStop(agent.id); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-error border border-error-border rounded hover:bg-error-subtle transition-colors"
                          title="Disable agent — dispatcher will stop spawning it"
                        >
                          <StopCircle size={12} className="inline" /> Disable
                        </button>
                      ) : null}
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpanded(agent.id); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs text-clawd-text-dim hover:text-clawd-text border ${theme.border} rounded-lg hover:bg-clawd-border/30 transition-colors`}>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isExpanded ? 'Less' : 'More'}
                      </button>
                      <div className="flex-1" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); setManagingAgent({ id: agent.id, name: agent.name }); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-clawd-muted hover:text-clawd-text hover:bg-clawd-surface rounded transition-colors"
                        title="Edit agent personality & model"
                        aria-label={`Manage ${agent.name}`}>
                        <Settings size={12} />
                        Manage
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setChatAgent(agent.id); }}
                        className={`p-1.5 rounded-lg transition-colors ${HOVER_BG_MAP[theme.bg] || ''} ${theme.text} opacity-50 hover:opacity-100`}
                        title="Chat"
                        aria-label={`Chat with ${agent.name}`}>
                        <MessageSquare size={14} />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleCompare(agent.id); }}
                        className={`p-1.5 rounded-lg transition-colors ${isCompareSelected ? 'text-review bg-review-subtle' : 'text-clawd-text-dim opacity-50 hover:opacity-100 hover:bg-clawd-border/30'}`}
                        title="Compare"
                        aria-label={`Compare ${agent.name}`}>
                        <GitCompare size={14} />
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                      <div
                        className={`mt-4 pt-4 border-t ${theme.border} space-y-4`}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => e.stopPropagation()}
                        role="region"
                        aria-label={`${agent.name} expanded details`}
                      >
                        <AgentMetricsCard agentId={agent.id} agentName={agent.name} metrics={metrics} />

                        {/* Shared Context Health */}
                        {(() => {
                          const ctx = ctxHealth[agent.id];
                          const ctxOk = ctx && ctx.AGENTS && ctx.USER && ctx.TOOLS;
                          return (
                            <div className="flex items-center gap-1.5 text-xs mt-2">
                              {ctxOk
                                ? <><CheckCircle size={11} className="text-success" /><span className="text-clawd-text-dim">Shared context OK</span></>
                                : <><AlertCircle size={11} className="text-error" /><span className="text-error">Missing context links</span></>
                              }
                            </div>
                          );
                        })()}

                        {/* Memory Health */}
                        {(() => {
                          const mem = memoryHealth[agent.id];
                          if (!mem) return null;
                          const colorMap = {
                            green: { text: 'text-success', bg: 'bg-success-subtle', border: 'border-success-border' },
                            yellow: { text: 'text-warning', bg: 'bg-warning-subtle', border: 'border-warning-border' },
                            red: { text: 'text-error', bg: 'bg-error-subtle', border: 'border-error-border' },
                          };
                          const c = colorMap[mem.health];
                          const isRotating = rotatingAgent === agent.id;
                          return (
                            <button
                              type="button"
                              onClick={() => handleMemoryRotate(agent.id)}
                              disabled={isRotating}
                              className={`flex items-center gap-1.5 text-xs mt-2 px-2 py-1 rounded-md border ${c.border} ${c.bg} ${c.text} hover:brightness-125 transition-all disabled:opacity-50`}
                              title={`MEMORY.md: ${mem.sizeKB}KB | Archived chunks: ${mem.archiveChunks}${mem.lastRotation ? ` | Last rotation: ${mem.lastRotation.split('T')[0]}` : ''}\nClick to rotate`}
                            >
                              {isRotating ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={11} />}
                              <span>{mem.sizeKB}KB</span>
                              {mem.archiveChunks > 0 && <span className="opacity-60">({mem.archiveChunks} archived)</span>}
                            </button>
                          );
                        })()}

                        <div>
                          <h4 className="text-[10px] font-semibold text-clawd-text-dim uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Award size={12} /> Skills ({agent.capabilities?.length || 0})
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {agent.capabilities?.map((skill, i) => (
                              <button type="button" key={i} onClick={() => setSelectedAgent(agent.id)}
                                className={`px-2 py-1 text-xs rounded-md border ${theme.border} ${theme.bg} ${theme.text} hover:brightness-125 transition-all`}>
                                {skill}
                              </button>
                            ))}
                            <button type="button" onClick={() => setSelectedAgent(agent.id)}
                              className="px-2 py-1 text-xs text-clawd-text-dim border border-dashed border-clawd-border rounded-md hover:border-clawd-text-dim transition-colors">
                              + Add
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button type="button" onClick={() => setSelectedAgent(agent.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-clawd-border rounded-lg hover:bg-clawd-border/30 transition-colors">
                            <FileText size={14} /> Details
                          </button>
                          <button type="button" onClick={() => setChatAgent(agent.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${theme.border} ${theme.bg} ${theme.text} hover:brightness-125 transition-all`}>
                            <MessageSquare size={14} /> Chat
                          </button>
                        </div>

                        {/* Agent-specific widgets */}
                        <WidgetLoader agentId={agent.id} trustTier={agent.trust_tier} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-Agents */}
        {realSubagents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-clawd-text-dim uppercase tracking-widest mb-3">
              Sub-Agents ({activeSubagents.length} active / {realSubagents.length} total)
            </h2>
            <div className="space-y-2">
              {realSubagents.map((session) => (
                <div key={session.key}
                  className={`rounded-lg border p-3 flex items-center gap-3 overflow-hidden ${
                    session.isActive ? 'border-success-border bg-success-subtle' : 'border-clawd-border'
                  }`}>
                  <span className="text-xl no-shrink">🤖</span>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium session-name flex-shrink">{session.displayName}</span>
                      {session.label && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-info-subtle text-info border border-info-border rounded no-shrink no-wrap">
                          {session.label}
                        </span>
                      )}
                      <span className={`w-2 h-2 rounded-full no-shrink ${session.isActive ? 'bg-success animate-pulse' : 'bg-clawd-bg0'}`} />
                      {session.isActive && <span className="text-[10px] text-success no-shrink no-wrap">Active</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-clawd-text-dim overflow-hidden">
                      <span className="no-shrink">{session.model?.split('/').pop() || 'unknown'}</span>
                      <span className="no-shrink no-wrap">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</span>
                      <span className="truncate flex-1 min-w-0" title={session.key}>{session.key}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wide rounded ${
                    session.isActive ? 'text-success border border-success-border' : 'text-clawd-text-dim border border-clawd-border'
                  }`}>
                    {session.isActive ? 'Running' : 'Idle'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workers */}
        {workerAgents.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-clawd-text-dim uppercase tracking-widest mb-3">
              Workers ({workerAgents.length})
            </h2>
            <div className="space-y-2">
              {workerAgents.map((agent) => (
                <div key={agent.id} className="rounded-lg border border-clawd-border p-3 flex items-center gap-3 overflow-hidden">
                  <div className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-clawd-bg">
                    {getTheme(agent.id).pic ? (
                      <img src={`./agent-profiles/${getTheme(agent.id).pic}`} alt={agent.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; if ((e.target as HTMLImageElement).nextElementSibling) { ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); } }} />
                    ) : null}
                    <span className={`${getTheme(agent.id).pic ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-xl`}>{agent.avatar}</span>
                  </div>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium agent-name flex-1 min-w-0">{agent.name}</span>
                      {(agent.status === 'active' || agent.status === 'busy') && <span className={`w-2 h-2 rounded-full no-shrink ${statusConfig[agent.status].color}`} />}
                    </div>
                    <p className="text-xs text-clawd-text-dim truncate">{agent.description}</p>
                  </div>
                  {agent.status === 'disabled' ? (
                    <button type="button" onClick={() => handleAgentStart(agent.id)}
                      className="px-2 py-1 text-xs text-success border border-success-border rounded hover:bg-success-subtle transition-colors"
                      title="Re-enable agent for dispatcher">
                      <Play size={12} className="inline mr-1" /> Enable
                    </button>
                  ) : agent.status === 'busy' && !PROTECTED_AGENTS.includes(agent.id) ? (
                    <button type="button" onClick={() => handleAgentStop(agent.id)}
                      className="px-2 py-1 text-xs text-error border border-error-border rounded hover:bg-error-subtle transition-colors"
                      title="Disable agent — dispatcher will stop spawning it">
                      <StopCircle size={12} className="inline mr-1" /> Disable
                    </button>
                  ) : (
                    <span className="text-xs text-success">
                      <CheckCircle size={14} className="inline mr-1" /> Done
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modals */}
        <WorkerModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
        {selectedAgent && <AgentDetailModal agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />}
        {showCompare && compareAgents.length >= 2 && (
          <AgentCompareModal agentIds={compareAgents} onClose={() => { setShowCompare(false); setCompareAgents([]); }} />
        )}
        {chatAgent && <AgentChatModal agentId={chatAgent} onClose={() => setChatAgent(null)} />}
        {managingAgent && (
          <AgentManagementModal
            isOpen={true}
            onClose={() => setManagingAgent(null)}
            agentId={managingAgent.id}
            agentName={managingAgent.name}
          />
        )}
      </div>
    </div>
  );
}
