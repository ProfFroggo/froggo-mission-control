import { useState, useEffect } from 'react';
import { Bot, Play, Square, StopCircle, RefreshCw, Plus, Zap, Clock, CheckCircle, BarChart3, Settings, Library, AlertTriangle, Pencil, Check } from 'lucide-react';
import { useEventBus } from '../lib/useEventBus';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { useStore, Agent } from '../store/store';
import { PROTECTED_AGENTS } from '../lib/agentConfig';
import { useShallow } from 'zustand/react/shallow';
import { gateway } from '../lib/gateway';
import HRAgentCreationModal from './HRAgentCreationModal';
import AgentDetailModal from './AgentDetailModal';
import AgentManagementModal from './AgentManagementModal';
import AgentMetricsCard from './AgentMetricsCard';
import HRSection from './HRSection';
import AgentLibraryPanel from './AgentLibraryPanel';
import { InlineLoader, Spinner } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';
import EmptyState from './EmptyState';
import { CircuitBreakerStatus } from './CircuitBreakerStatus';
import type { CatalogAgent } from '../types/catalog';

import { getAgentTheme } from '../utils/agentThemes';
import { createLogger } from '../utils/logger';
import { agentApi, analyticsApi } from '../lib/api';

const logger = createLogger('AgentPanel');
const getTheme = getAgentTheme;


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
  const [agentMetrics, setAgentMetrics] = useState<Record<string, any>>({});
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [managingAgent, setManagingAgent] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'active' | 'library'>('active');
  const [circuitOpenAgents, setCircuitOpenAgents] = useState<Set<string>>(new Set());
  const [editingTrustTierAgent, setEditingTrustTierAgent] = useState<string | null>(null);
  const [pendingTrustTier, setPendingTrustTier] = useState<number>(1);
  const { open: confirmOpen, config: confirmConfig, onConfirm: onConfirmCallback, showConfirm, closeConfirm } = useConfirmDialog();

  // Subscribe to circuit.open SSE events
  useEventBus('circuit.open', (data) => {
    const d = data as { agentId: string };
    if (d?.agentId) {
      setCircuitOpenAgents(prev => new Set(prev).add(d.agentId));
    }
  });

  // Subscribe to agent.updated SSE events
  useEventBus('agent.updated', () => {
    fetchAgents();
  });

  // Subscribe to agent.hired SSE events — refresh agent list immediately
  useEventBus('agent.hired', () => {
    fetchAgents();
  });

  useEffect(() => {
    Promise.all([fetchAgents(), loadGatewaySessions(), loadTasksFromDB()])
      .catch(err => {
        logger.error('Failed to load agent data:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setInitialLoading(false));
    // Load agents from registry
    
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
      const data = await analyticsApi.getAgentActivity();
      if (data) setAgentMetrics(data);
    } catch (e) { logger.error('Failed to load agent metrics:', e); }
    finally { setLoadingMetrics(false); }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await Promise.all([loadGatewaySessions(), loadAgentMetrics()]); }
    finally { setIsRefreshing(false); }
  };

  const handleAgentStop = (agentId: string, agentName: string) => {
    const activeTasks = tasks.filter(t => t.assignedTo === agentId && ['in-progress', 'todo', 'internal-review'].includes(t.status)).length;
    showConfirm({
      title: `Disable ${agentName}?`,
      message: `Disabling ${agentName} will pause dispatcher for this agent${activeTasks > 0 ? ` — ${activeTasks} active task${activeTasks > 1 ? 's' : ''} will queue but not execute` : ''}.`,
      confirmLabel: 'Disable',
      type: 'warning',
    }, async () => {
      try {
        await agentApi.updateStatus(agentId, 'disabled');
        await fetchAgents();
      } catch (err) {
        logger.error('[AgentPanel] Stop error:', err);
        showToast('error', 'Failed to disable agent', (err as Error).message);
      }
    });
  };

  const handleTrustTierSave = async (agentId: string, tier: number) => {
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trust_tier: tier }),
      });
      await fetchAgents();
      setEditingTrustTierAgent(null);
      showToast('success', 'Trust tier updated — permissions recalculated');
    } catch (err) {
      showToast('error', 'Failed to update trust tier', (err as Error).message);
    }
  };

  const handleAgentStart = async (agentId: string) => {
    try {
      await agentApi.updateStatus(agentId, 'active');
      await fetchAgents();
    } catch (err) {
      logger.error('[AgentPanel] Start error:', err);
      showToast('error', 'Failed to enable agent', (err as Error).message);
    }
  };

  const realSubagents = gatewaySessions.filter(s => s.type === 'subagent');
  const activeSubagents = realSubagents.filter(s => s.isActive);

  const statusConfig: Record<Agent['status'], { color: string; label: string; pulse?: boolean; hideDot?: boolean }> = {
    active:     { color: 'bg-success',  label: 'Active', pulse: true },
    busy:       { color: 'bg-mission-control-accent', label: 'Working…', pulse: true },
    idle:       { color: 'bg-warning', label: 'Idle' },
    offline:    { color: 'bg-mission-control-bg0',   label: 'Offline', hideDot: true },
    suspended:  { color: 'bg-error',    label: 'Suspended', hideDot: true },
    archived:   { color: 'bg-mission-control-bg0',   label: 'Archived', hideDot: true },
    draft:      { color: 'bg-warning', label: 'Draft', hideDot: true },
    disabled:   { color: 'bg-error',    label: 'Stopped', hideDot: true },
  };

  const getAgentTasks = (agentId: string) => tasks.filter(t => t.assignedTo === agentId && t.status !== 'done');

  const AGENT_ROLES: Record<string, string> = {
    'mission-control': 'orchestrator',
    'hr': 'hr',
    'clara': 'qc',
    'inbox': 'inbox',
  };

  // Skip phantom/legacy agents — use exclusion so new agents auto-appear
  const PHANTOM_AGENTS = ['main', 'chat-agent'];
  const realAgents = agents.filter(a => !PHANTOM_AGENTS.includes(a.id));
  
  // Remove duplicates by ID (in case store has dupes)
  const uniqueAgents = Array.from(new Map(realAgents.map(a => [a.id, a])).values());
  
  // Split into main agents and workers
  const mainAgents = uniqueAgents.filter(a => !a.id.startsWith('worker-'));
  const workerAgents = agents.filter(a => a.id.startsWith('worker-'));

  if (initialLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorDisplay
        error={loadError}
        context={{ action: 'load agents', resource: 'agent registry' }}
        onRetry={() => { setLoadError(null); setInitialLoading(true); fetchAgents().catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load agents')).finally(() => setInitialLoading(false)); }}
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="w-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
              <Bot size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text">Agents</h1>
              <p className="text-sm text-mission-control-text-dim">
                {activeSubagents.length} sub-agent{activeSubagents.length !== 1 ? 's' : ''} running · {realSubagents.length} total
              </p>
            </div>
          </div>
          <div className="icon-text gap-2">
            {view === 'active' && (
              <button type="button" onClick={() => setShowAnalytics(!showAnalytics)}
                className={`icon-text px-3 py-2 border rounded-lg transition-colors text-sm ${showAnalytics ? 'text-info border-info-border bg-info-subtle' : 'border-mission-control-border hover:bg-mission-control-border/50'}`}>
                <BarChart3 size={15} className="flex-shrink-0" /> Analytics
              </button>
            )}
            {view === 'active' && (
              <button type="button" onClick={handleRefresh} disabled={isRefreshing} className="icon-btn border border-mission-control-border disabled:opacity-50" title="Refresh" aria-label="Refresh agents">
                <RefreshCw size={15} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            {view === 'active' && (
              <button type="button" onClick={() => setShowCreateModal(true)} className="icon-text px-3 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors text-sm">
                <Plus size={15} className="flex-shrink-0" /> New Agent
              </button>
            )}
          </div>
        </div>

        {/* View tabs */}
        <div className="flex border-b border-mission-control-border mb-5">
          <button
            type="button"
            onClick={() => setView('active')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              view === 'active'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Bot size={15} /> Active
          </button>
          <button
            type="button"
            onClick={() => setView('library')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              view === 'library'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Library size={15} /> Library
          </button>
        </div>

        {/* Library view */}
        {view === 'library' && (
          <AgentLibraryPanel
            onHire={(_agent: CatalogAgent) => {
              setView('active');
            }}
          />
        )}

        {/* Active view content */}
        {view === 'active' && (<>

        {/* Analytics */}
        {showAnalytics && (
          <div className="mb-6 rounded-xl border border-mission-control-border p-5">
            <h2 className="icon-text text-heading-3 mb-4">
              <BarChart3 size={18} className="flex-shrink-0" /> Performance
              {loadingMetrics && <InlineLoader size="sm" />}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                <div key={i} className="rounded-lg border border-mission-control-border p-4">
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.val}</div>
                  <div className="text-xs text-mission-control-text-dim mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Circuit Breaker Status */}
        <div className="mb-6">
          <CircuitBreakerStatus />
        </div>

        {/* HR Agent Section */}
        <HRSection />

        {/* Core Agents — Profile Card Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-widest">Core Agents</h2>
          </div>

          {mainAgents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agents found"
              description="No agents are registered yet. Create a worker or check your agent configuration."
              action={{ label: 'New Worker', onClick: () => setShowCreateModal(true) }}
            />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mainAgents.map((agent) => {
              const theme = getTheme(agent.id);
              const agentTasks = getAgentTasks(agent.id);
              const currentTask = tasks.find(t => t.id === agent.currentTaskId);
              const metrics = agentMetrics[agent.id] || {};
              const sc = statusConfig[agent.status];
              // Hide dot when: no current task, task is done/review, or status says hideDot
              const hasActiveTask = currentTask && !['done', 'review', 'completed'].includes(currentTask.status);
              const showDot = !sc.hideDot && (agent.status === 'active' || agent.status === 'busy' || (agent.status === 'idle' && hasActiveTask));

              return (
                <div
                  key={agent.id}
                  onClick={() => setManagingAgent({ id: agent.id, name: agent.name })}
                  className={`group relative rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-mission-control-surface/50 cursor-pointer ${theme.border}`}
                >
                  {/* Color accent bar */}
                  <div className="absolute top-0 left-4 right-4 h-0.5 rounded-b" style={{ backgroundColor: theme.color }} />

                  {/* Settings icon — top-right, hover reveal */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setManagingAgent({ id: agent.id, name: agent.name }); }}
                    className="absolute top-2 right-2 p-1 rounded-md text-mission-control-text-dim opacity-0 group-hover:opacity-100 transition-all hover:text-mission-control-text hover:bg-mission-control-border/50 z-10"
                    title="Manage agent"
                    aria-label={`Manage ${agent.name}`}
                  >
                    <Settings size={12} />
                  </button>

                  <div className="p-4">

                    {/* Header: avatar + name + status dot */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Avatar */}
                      <div className={`relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden ring-2 ${theme.ring} bg-mission-control-bg`}>
                        {theme.pic ? (
                          <img
                            src={`/api/agents/${agent.id}/avatar`}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; if ((e.target as HTMLImageElement).nextElementSibling) { ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); } }}
                          />
                        ) : null}
                        <span className={`${theme.pic ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-xl`}>{agent.avatar}</span>
                        {showDot && <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-mission-control-bg ${sc.color} ${sc.pulse ? 'animate-pulse' : ''}`} />}
                      </div>

                      {/* Name + role */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-sm leading-tight truncate">{agent.name}</h3>
                          {/* Only show non-idle status badges — idle is conveyed by Available below */}
                          {(agent.status === 'busy' || agent.status === 'disabled' || agent.status === 'suspended' || agent.status === 'archived' || agent.status === 'draft') && (
                            <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${theme.bg} ${theme.text}`}>
                              {sc.label}
                            </span>
                          )}
                          {circuitOpenAgents.has(agent.id) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-error-subtle text-error border border-error-border flex-shrink-0">
                              <AlertTriangle size={9} /> Circuit open
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] text-mission-control-text-dim truncate">{agent.description}</p>
                          {agent.status === 'idle' && !currentTask && agentTasks.length === 0 && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-success font-medium">
                              <CheckCircle size={9} />Available
                            </span>
                          )}
                          {currentTask && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-amber-400">
                              <Zap size={9} /><span className="truncate max-w-20">{currentTask.title}</span>
                            </span>
                          )}
                          {!currentTask && agentTasks.length > 0 && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-mission-control-text-dim">
                              <Clock size={9} />{agentTasks.length} queued
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metrics — always full opacity, separated */}
                    <div className="border-t border-mission-control-border/40 pt-3 mb-3">
                      <AgentMetricsCard agentId={agent.id} agentName={agent.name} metrics={{ ...metrics, _role: AGENT_ROLES[agent.id] }} compact={true} />
                    </div>

                    {/* Footer: capability tags + tier badge */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {agent.capabilities?.slice(0, 3).map((cap, i) => (
                        <span key={i} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${theme.bg} ${theme.text}`}>
                          {cap}
                        </span>
                      ))}
                      {(agent.capabilities?.length || 0) > 3 && (
                        <span className="text-[10px] text-mission-control-text-dim">+{(agent.capabilities?.length || 0) - 3}</span>
                      )}
                      <div className="flex-1" />
                      {/* Tier badge — right-aligned, editable on click */}
                      {agent.trust_tier && (
                        editingTrustTierAgent === agent.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <select
                              value={pendingTrustTier}
                              onChange={e => setPendingTrustTier(Number(e.target.value))}
                              className="text-xs px-1 py-0.5 rounded border border-mission-control-border bg-mission-control-surface"
                            >
                              <option value={1}>Tier 1 (Restricted)</option>
                              <option value={2}>Tier 2 (Worker)</option>
                              <option value={3}>Tier 3 (Full)</option>
                            </select>
                            <button type="button" onClick={e => { e.stopPropagation(); handleTrustTierSave(agent.id, pendingTrustTier); }} className="p-0.5 text-success hover:bg-success-subtle rounded"><Check size={12} /></button>
                            <button type="button" onClick={e => { e.stopPropagation(); setEditingTrustTierAgent(null); }} className="p-0.5 text-error hover:bg-error-subtle rounded"><AlertTriangle size={12} /></button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setPendingTrustTier(Number(agent.trust_tier) || 1); setEditingTrustTierAgent(agent.id); }}
                            className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium opacity-50 group-hover:opacity-100 transition-opacity ${
                              agent.trust_tier === 'admin'      ? 'bg-review-subtle text-review' :
                              agent.trust_tier === 'trusted'    ? 'bg-success-subtle text-success' :
                              agent.trust_tier === 'worker'     ? 'bg-info-subtle text-info' :
                              agent.trust_tier === 'restricted' ? 'bg-error-subtle text-error' :
                              'bg-mission-control-border text-mission-control-text-dim'
                            } hover:brightness-110`}
                            title="Click to edit trust tier"
                          >
                            {agent.trust_tier === 'admin' ? 'Admin' : agent.trust_tier === 'trusted' ? 'Trusted' : agent.trust_tier === 'worker' ? 'Worker' : agent.trust_tier === 'restricted' ? 'Restricted' : `Tier ${agent.trust_tier}`}
                            <Pencil size={8} className="opacity-0 group-hover:opacity-100" />
                          </button>
                        )
                      )}
                    </div>

                    {/* Start/Stop — only when applicable */}
                    {((agent.status === 'idle' && agentTasks.length > 0) || (agent.status === 'busy' && agent.sessionKey)) && (
                      <div className={`flex items-center gap-1.5 mt-3 pt-2 border-t ${theme.border}`}>
                        {agent.status === 'idle' && agentTasks.length > 0 && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); spawnAgentForTask(agentTasks[0].id); }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                            <Play size={11} /> Start
                          </button>
                        )}
                        {agent.status === 'busy' && agent.sessionKey && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); updateAgentStatus(agent.id, 'idle'); }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors">
                            <Square size={11} /> Stop
                          </button>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Sub-Agents */}
        {realSubagents.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-widest mb-3">
              Sub-Agents ({activeSubagents.length} active / {realSubagents.length} total)
            </h2>
            <div className="space-y-2">
              {realSubagents.map((session) => (
                <div key={session.key}
                  className={`rounded-lg border p-3 flex items-center gap-3 overflow-hidden ${
                    session.isActive ? 'border-success-border bg-success-subtle' : 'border-mission-control-border'
                  }`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-mission-control-surface border border-mission-control-border flex items-center justify-center">
                    <Bot size={16} className="text-info" />
                  </div>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium session-name flex-shrink truncate">{session.displayName}</span>
                      {session.label && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-info-subtle text-info border border-info-border rounded-lg no-shrink no-wrap">
                          {session.label}
                        </span>
                      )}
                      <span className={`w-2 h-2 rounded-full no-shrink ${session.isActive ? 'bg-success animate-pulse' : 'bg-mission-control-bg0'}`} />
                      {session.isActive && <span className="text-[10px] text-success no-shrink no-wrap">Active</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-mission-control-text-dim overflow-hidden">
                      <span className="no-shrink">{session.model?.split('/').pop() || 'unknown'}</span>
                      <span className="no-shrink no-wrap">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</span>
                      <span className="truncate flex-1 min-w-0" title={session.key}>{session.key}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wide rounded-lg ${
                    session.isActive ? 'text-success border border-success-border' : 'text-mission-control-text-dim border border-mission-control-border'
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
            <h2 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-widest mb-3">
              Workers ({workerAgents.length})
            </h2>
            <div className="space-y-2">
              {workerAgents.map((agent) => (
                <div key={agent.id} className="rounded-lg border border-mission-control-border p-3 flex items-center gap-3 overflow-hidden">
                  <div className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-mission-control-bg">
                    {getTheme(agent.id).pic ? (
                      <img src={`/api/agents/${agent.id}/avatar`} alt={agent.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; if ((e.target as HTMLImageElement).nextElementSibling) { ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); } }} />
                    ) : null}
                    <div className={`${getTheme(agent.id).pic ? 'hidden' : ''} absolute inset-0 flex items-center justify-center`}>
                      <Bot size={16} className="text-mission-control-text-dim" />
                    </div>
                  </div>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium agent-name flex-1 min-w-0 truncate">{agent.name}</span>
                      {(agent.status === 'active' || agent.status === 'busy') && <span className={`w-2 h-2 rounded-full no-shrink ${statusConfig[agent.status].color}`} />}
                    </div>
                    <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                  </div>
                  {agent.status === 'disabled' ? (
                    <button type="button" onClick={() => handleAgentStart(agent.id)}
                      className="px-2 py-1 text-xs text-success border border-success-border rounded-lg hover:bg-success-subtle transition-colors"
                      title="Re-enable agent for dispatcher">
                      <Play size={12} className="inline mr-1" /> Enable
                    </button>
                  ) : agent.status === 'busy' && !PROTECTED_AGENTS.includes(agent.id as typeof PROTECTED_AGENTS[number]) ? (
                    <button type="button" onClick={() => handleAgentStop(agent.id, agent.name)}
                      className="px-2 py-1 text-xs text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors"
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

        </>)} {/* end active view */}

        {/* Modals */}
        {showCreateModal && <HRAgentCreationModal onClose={() => setShowCreateModal(false)} />}
        {selectedAgent && <AgentDetailModal agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />}
        {managingAgent && (
          <AgentManagementModal
            isOpen={true}
            onClose={() => setManagingAgent(null)}
            agentId={managingAgent.id}
            agentName={managingAgent.name}
            initialSection="metrics"
          />
        )}
        <ConfirmDialog
          open={confirmOpen}
          onClose={closeConfirm}
          onConfirm={onConfirmCallback}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={confirmConfig.cancelLabel}
          type={confirmConfig.type}
        />
      </div>
    </div>
  );
}
