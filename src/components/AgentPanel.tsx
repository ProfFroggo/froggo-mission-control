import { useState, useEffect } from 'react';
import { Bot, Play, Square, StopCircle, RefreshCw, Plus, MessageSquare, Zap, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Award, FileText, GitCompare, BarChart3, Settings, Library, AlertTriangle, Pencil, Check } from 'lucide-react';
import { useEventBus } from '../lib/useEventBus';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { useStore, Agent } from '../store/store';
import { PROTECTED_AGENTS } from '../lib/agentConfig';
import { useShallow } from 'zustand/react/shallow';
import { gateway } from '../lib/gateway';
import HRAgentCreationModal from './HRAgentCreationModal';
import AgentDetailModal from './AgentDetailModal';
import AgentCompareModal from './AgentCompareModal';
import AgentChatModal from './AgentChatModal';
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
import WidgetLoader from './WidgetLoader';
import { createLogger } from '../utils/logger';
import { agentApi, analyticsApi } from '../lib/api';

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
  'bg-mission-control-surface': 'hover:bg-mission-control-surface',
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [managingAgent, setManagingAgent] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'active' | 'library'>('active');
  const [ctxHealth, setCtxHealth] = useState<Record<string, { AGENTS: boolean; USER: boolean; TOOLS: boolean }>>({});
  const [memoryHealth, setMemoryHealth] = useState<Record<string, { sizeKB: number; archiveChunks: number; health: 'green' | 'yellow' | 'red'; lastRotation: string | null }>>({});
  const [rotatingAgent, setRotatingAgent] = useState<string | null>(null);
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

  const handleMemoryRotate = async (agentId: string) => {
    if (!confirm(`Rotate memory for agent "${agentId}"? Old content will be archived and searchable via mission-control-db memory-search.`)) return;
    setRotatingAgent(agentId);
    try {
      // Memory rotation — no REST equivalent
      console.warn('Not implemented: memoryLifecycle.rotate', agentId);
    } finally {
      setRotatingAgent(null);
    }
  };

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

  const toggleExpanded = (agentId: string) => {
    const s = new Set(expandedAgents);
    if (s.has(agentId)) { s.delete(agentId); } else { s.add(agentId); }
    setExpandedAgents(s);
  };

  const toggleCompare = (agentId: string) => {
    if (compareAgents.includes(agentId)) setCompareAgents(compareAgents.filter(id => id !== agentId));
    else if (compareAgents.length < 3) setCompareAgents([...compareAgents, agentId]);
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
            {view === 'active' && compareAgents.length >= 2 && (
              <button type="button" onClick={() => setShowCompare(true)} className="icon-text px-3 py-2 text-review border border-review-border rounded-lg hover:bg-review-subtle transition-colors text-sm">
                <GitCompare size={15} className="flex-shrink-0" /> Compare ({compareAgents.length})
              </button>
            )}
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
              // Phase 34 will wire the full hire wizard here
              setView('active');
              setShowCreateModal(true);
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
            {compareAgents.length > 0 && (
              <span className="text-xs px-2 py-0.5 text-review border border-review-border rounded-full">
                {compareAgents.length} selected
              </span>
            )}
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
                  className={`group relative rounded-xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-mission-control-surface/50 ${
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
                      <div className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden ring-2 ${theme.ring} bg-mission-control-bg`}>
                        {theme.pic ? (
                          <img
                            src={`/api/agents/${agent.id}/avatar`}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; if ((e.target as HTMLImageElement).nextElementSibling) { ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).classList.remove('hidden'); } }}
                          />
                        ) : null}
                        <span className={`${theme.pic ? 'hidden' : ''} absolute inset-0 flex items-center justify-center text-3xl`}>{agent.avatar}</span>
                        {/* Status dot - only show for active/busy agents or idle with active task */}
                        {showDot && <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-mission-control-bg ${sc.color} ${sc.pulse ? 'animate-pulse' : ''}`} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg leading-tight truncate">{agent.name}</h3>
                          {!sc.hideDot && (
                            <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-lg ${theme.bg} ${theme.text}`}>
                              {sc.label}
                            </span>
                          )}
                          {/* Trust tier badge with inline edit */}
                          {agent.trust_tier && (
                            editingTrustTierAgent === agent.id ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={pendingTrustTier}
                                  onChange={e => setPendingTrustTier(Number(e.target.value))}
                                  className="text-xs px-1 py-0.5 rounded border border-mission-control-border bg-mission-control-surface"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <option value={1}>Tier 1 (Restricted)</option>
                                  <option value={2}>Tier 2 (Worker)</option>
                                  <option value={3}>Tier 3 (Full)</option>
                                </select>
                                <button type="button" onClick={e => { e.stopPropagation(); handleTrustTierSave(agent.id, pendingTrustTier); }}
                                  className="p-0.5 text-success hover:bg-success-subtle rounded">
                                  <Check size={12} />
                                </button>
                                <button type="button" onClick={e => { e.stopPropagation(); setEditingTrustTierAgent(null); }}
                                  className="p-0.5 text-error hover:bg-error-subtle rounded">
                                  <AlertTriangle size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setPendingTrustTier(Number(agent.trust_tier) || 1); setEditingTrustTierAgent(agent.id); }}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                  agent.trust_tier === 'admin'      ? 'bg-review-subtle text-review' :
                                  agent.trust_tier === 'trusted'    ? 'bg-success-subtle text-success' :
                                  agent.trust_tier === 'worker'     ? 'bg-info-subtle text-info' :
                                  agent.trust_tier === 'restricted' ? 'bg-error-subtle text-error' :
                                  'bg-mission-control-border text-mission-control-text-dim'
                                } hover:brightness-110 cursor-pointer`}
                                title="Click to edit trust tier"
                              >
                                {agent.trust_tier === 'admin'      ? 'Admin' :
                                 agent.trust_tier === 'trusted'    ? 'Trusted' :
                                 agent.trust_tier === 'worker'     ? 'Worker' :
                                 agent.trust_tier === 'restricted' ? 'Restricted' :
                                 `Tier ${agent.trust_tier}`}
                                <Pencil size={9} />
                              </button>
                            )
                          )}
                          {/* Circuit breaker open indicator */}
                          {circuitOpenAgents.has(agent.id) && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-error-subtle text-error border border-error-border" title="Circuit breaker open — agent locked out due to repeated failures">
                              <AlertTriangle size={10} /> Circuit Open
                            </span>
                          )}
                          {/* Lifecycle status badges for non-active agents */}
                          {agent.status === 'suspended' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-error-subtle text-error">
                              Suspended
                            </span>
                          )}
                          {agent.status === 'archived' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted-subtle text-mission-control-text-dim">
                              Archived
                            </span>
                          )}
                          {agent.status === 'draft' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-warning-subtle text-warning">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">{agent.description}</p>
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
                        <span className="px-2 py-0.5 text-[11px] text-mission-control-text-dim">+{(agent.capabilities?.length || 0) - 4}</span>
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
                      <div className="text-xs text-mission-control-text-dim mb-3">
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
                          className="flex items-center gap-1 px-2 py-1 text-xs text-success border border-success-border rounded-lg hover:bg-success-subtle transition-colors"
                          title="Re-enable agent for dispatcher"
                        >
                          <Play size={12} className="inline" /> Enable
                        </button>
                      ) : !PROTECTED_AGENTS.includes(agent.id as typeof PROTECTED_AGENTS[number]) ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAgentStop(agent.id, agent.name); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors"
                          title="Disable agent — dispatcher will stop spawning it"
                        >
                          <StopCircle size={12} className="inline" /> Disable
                        </button>
                      ) : null}
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpanded(agent.id); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text border ${theme.border} rounded-lg hover:bg-mission-control-border/30 transition-colors`}>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isExpanded ? 'Less' : 'More'}
                      </button>
                      <div className="flex-1" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); setManagingAgent({ id: agent.id, name: agent.name }); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-mission-control-muted hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors"
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
                        className={`p-1.5 rounded-lg transition-colors ${isCompareSelected ? 'text-review bg-review-subtle' : 'text-mission-control-text-dim opacity-50 hover:opacity-100 hover:bg-mission-control-border/30'}`}
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
                                ? <><CheckCircle size={11} className="text-success" /><span className="text-mission-control-text-dim">Shared context OK</span></>
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
                              disabled={true}
                              className={`flex items-center gap-1.5 text-xs mt-2 px-2 py-1 rounded-md border ${c.border} ${c.bg} ${c.text} transition-all disabled:opacity-50 cursor-not-allowed`}
                              title={`MEMORY.md: ${mem.sizeKB}KB | Archived chunks: ${mem.archiveChunks}${mem.lastRotation ? ` | Last rotation: ${mem.lastRotation.split('T')[0]}` : ''}\nMemory rotation coming soon`}
                            >
                              {isRotating ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={11} />}
                              <span>{mem.sizeKB}KB</span>
                              {mem.archiveChunks > 0 && <span className="opacity-60">({mem.archiveChunks} archived)</span>}
                            </button>
                          );
                        })()}

                        <div>
                          <h4 className="text-[10px] font-semibold text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1">
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
                              className="px-2 py-1 text-xs text-mission-control-text-dim border border-dashed border-mission-control-border rounded-md hover:border-mission-control-text-dim transition-colors">
                              + Add
                            </button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button type="button" onClick={() => setSelectedAgent(agent.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-border/30 transition-colors">
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
