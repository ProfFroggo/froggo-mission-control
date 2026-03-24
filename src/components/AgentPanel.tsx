import { useState, useEffect } from 'react';
import { Bot, Play, Square, StopCircle, RefreshCw, Plus, Zap, Clock, CheckCircle, BarChart3, Settings, Library, AlertTriangle, Pencil, Check, Activity, Search, Trophy } from 'lucide-react';
import { useEventBus } from '../lib/useEventBus';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { useStore, Agent } from '../store/store';
import { PROTECTED_AGENTS } from '../lib/agentConfig';
import { useShallow } from 'zustand/react/shallow';
import { gateway } from '../lib/gateway';
import HRAgentCreationModal from './HRAgentCreationModal';
import AgentDetailModal from './AgentDetailModal';
// AgentManagementModal replaced by AgentDetailModal (richer UI)
import AgentHealthDashboard from './AgentHealthDashboard';
import AgentMetricsCard from './AgentMetricsCard';
import HRSection from './HRSection';
import AgentLibraryPanel from './AgentLibraryPanel';
import AgentLeaderboard from './AgentLeaderboard';
import { InlineLoader, Spinner } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';
import EmptyState from './EmptyState';
import { CircuitBreakerStatus } from './CircuitBreakerStatus';
import type { CatalogAgent } from '../types/catalog';

import { getAgentTheme } from '../utils/agentThemes';
import { createLogger } from '../utils/logger';
import { agentApi, analyticsApi } from '../lib/api';
import { Button, IconButton, Badge, TextField, Select, Box, Flex } from '@radix-ui/themes';
import TabNav from './TabNav';

const logger = createLogger('AgentPanel');
const getTheme = getAgentTheme;

/** Derive 1-2 character initials from agent name or id */
function getInitials(name?: string, id?: string): string {
  const source = name || id || '?';
  const parts = source.replace(/[-_]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Avatar with graceful fallback — colored circle with initials, no broken image flicker */
function AvatarWithFallback({ agentId, agentName, themeRing, themeBg, themeText, themeColor, className = 'w-12 h-12 rounded-lg', children }: {
  agentId: string;
  agentName: string;
  themeRing: string;
  themeBg: string;
  themeText: string;
  themeColor: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className={`relative flex-shrink-0 ${className} overflow-hidden ring-2 ${themeRing} bg-mission-control-bg`}>
      {!imgFailed ? (
        <img
          src={`/api/agents/${agentId}/avatar`}
          alt={agentName}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${themeText}`}
          style={{ backgroundColor: themeColor + '22' }}
        >
          {getInitials(agentName, agentId)}
        </span>
      )}
      {children}
    </div>
  );
}

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
  const [soulEditAgent, setSoulEditAgent] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'active' | 'health' | 'library' | 'leaderboard'>('active');
  const [circuitOpenAgents, setCircuitOpenAgents] = useState<Set<string>>(new Set());
  const [editingTrustTierAgent, setEditingTrustTierAgent] = useState<string | null>(null);
  const [pendingTrustTier, setPendingTrustTier] = useState<number>(1);
  const { open: confirmOpen, config: confirmConfig, onConfirm: onConfirmCallback, showConfirm, closeConfirm } = useConfirmDialog();
  const [agentSearch, setAgentSearch] = useState('');
  // Per-agent token stats (last 7 days) — { agentId -> { tokens, cost } }
  const [agentTokenStats, setAgentTokenStats] = useState<Record<string, { tokens: number; cost: number }>>({});

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

  // Fetch per-agent token stats (last 7 days) once on mount
  useEffect(() => {
    fetch('/api/token-usage?days=7')
      .then(r => r.ok ? r.json() : null)
      .then((d: { byAgent?: Array<{ agentId: string; tokens: number; cost: number }> } | null) => {
        if (d?.byAgent) {
          const map: Record<string, { tokens: number; cost: number }> = {};
          for (const row of d.byAgent) map[row.agentId] = { tokens: row.tokens, cost: row.cost };
          setAgentTokenStats(map);
        }
      })
      .catch(() => { /* non-critical */ });
  }, []);

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
    // online / active → green with pulse
    active:     { color: 'bg-success',               label: 'Active',    pulse: true },
    // busy / working / in-progress → amber, solid (no pulse)
    busy:       { color: 'bg-warning',               label: 'Working…' },
    // idle / offline → gray, no pulse
    idle:       { color: 'bg-mission-control-border', label: 'Idle' },
    offline:    { color: 'bg-mission-control-bg0',   label: 'Offline',   hideDot: true },
    suspended:  { color: 'bg-error',                 label: 'Suspended', hideDot: true },
    archived:   { color: 'bg-mission-control-bg0',   label: 'Archived',  hideDot: true },
    draft:      { color: 'bg-mission-control-border', label: 'Draft',    hideDot: true },
    disabled:   { color: 'bg-error',                 label: 'Stopped',   hideDot: true },
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

  // Client-side search filter — applied to core agents list
  const searchQuery = agentSearch.trim().toLowerCase();
  const filteredMainAgents = searchQuery
    ? mainAgents.filter(a =>
        a.name.toLowerCase().includes(searchQuery) ||
        (a.description || '').toLowerCase().includes(searchQuery) ||
        (a.capabilities || []).some(c => c.toLowerCase().includes(searchQuery))
      )
    : mainAgents;

  if (initialLoading) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Spinner size={32} />
      </Flex>
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
    <Box p="4" className="h-full overflow-auto">
      <Box>
        {/* Header */}
        <Flex align="center" justify="between" mb="4">
          <Flex align="center" gap="3">
            <Box p="2" className="bg-mission-control-accent/20 rounded-lg">
              <Bot size={24} className="text-mission-control-accent" />
            </Box>
            <Box>
              <h1 className="text-xl font-semibold text-mission-control-text tracking-tight">Agents</h1>
              <p className="text-sm text-mission-control-text-dim">
                {uniqueAgents.length} agent{uniqueAgents.length !== 1 ? 's' : ''} · {activeSubagents.length} sub-agent{activeSubagents.length !== 1 ? 's' : ''} running
              </p>
            </Box>
          </Flex>
          <div className="icon-text gap-2">
            {view === 'active' && (
              <Button
                type="button"
                variant={showAnalytics ? 'soft' : 'surface'}
                color={showAnalytics ? 'blue' : 'gray'}
                size="2"
                onClick={() => setShowAnalytics(!showAnalytics)}
                aria-expanded={showAnalytics}
                aria-controls="agent-analytics-panel"
              >
                <BarChart3 size={15} aria-hidden="true" /> Analytics
              </Button>
            )}
            {view === 'active' && (
              <IconButton
                type="button"
                variant="surface"
                color="gray"
                size="2"
                disabled={isRefreshing}
                onClick={handleRefresh}
                title="Refresh"
                aria-label="Refresh agents"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              </IconButton>
            )}
            {view === 'active' && (
              <Button
                type="button"
                variant="solid"
                color="grass"
                size="2"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={15} /> New Agent
              </Button>
            )}
          </div>
        </Flex>

        {/* View tabs */}
        <Box mb="5" className="border-b border-mission-control-border">
          <TabNav
            tabs={[
              { id: 'active',      label: 'Active',      icon: Bot      },
              { id: 'health',      label: 'Health',      icon: Activity },
              { id: 'library',     label: 'Library',     icon: Library  },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy   },
            ]}
            activeTab={view}
            onTabChange={(id) => setView(id as typeof view)}
            paddingX="px-0"
          />
        </Box>

        {/* Health view */}
        {view === 'health' && (
          <div role="tabpanel" id="agent-tabpanel-health" aria-labelledby="agent-tab-health">
            <AgentHealthDashboard
              onSelectAgent={(id, name) => setManagingAgent({ id, name })}
            />
          </div>
        )}

        {/* Library view */}
        {view === 'library' && (
          <div role="tabpanel" id="agent-tabpanel-library" aria-labelledby="agent-tab-library">
            <AgentLibraryPanel
              onHire={(_agent: CatalogAgent) => {
                setView('active');
              }}
            />
          </div>
        )}

        {/* Leaderboard view */}
        {view === 'leaderboard' && (
          <div role="tabpanel" id="agent-tabpanel-leaderboard" aria-labelledby="agent-tab-leaderboard">
            <AgentLeaderboard />
          </div>
        )}

        {/* Active view content */}
        {view === 'active' && (<div role="tabpanel" id="agent-tabpanel-active" aria-labelledby="agent-tab-active">

        {/* Analytics */}
        {showAnalytics && (
          <div id="agent-analytics-panel" className="mb-6 rounded-lg border border-mission-control-border p-5">
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
                  { val: activeSubagents.length, label: 'Active Sub-Agents', color: 'text-warning' },
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

          {/* Search / filter bar */}
          <div className="relative mb-4">
            <TextField.Root
              size="2"
              value={agentSearch}
              onChange={(e) => setAgentSearch((e.target as HTMLInputElement).value)}
              placeholder="Search agents by name, role, or capability…"
              aria-label="Search agents"
              className="w-full"
            >
              <TextField.Slot>
                <Search size={14} className="text-mission-control-text-dim" />
              </TextField.Slot>
            </TextField.Root>
          </div>

          {mainAgents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agents yet"
              description="Hire your first agent to start automating work"
              action={{ label: 'New Agent', onClick: () => setShowCreateModal(true) }}
              size="md"
            />
          ) : filteredMainAgents.length === 0 ? (
            <div className="py-10 text-center text-sm text-mission-control-text-dim">
              No agents match &ldquo;{agentSearch}&rdquo;
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredMainAgents.map((agent) => {
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
                  className={`group relative rounded-2xl border border-mission-control-border transition-all duration-200 hover:-translate-y-0.5 hover:bg-mission-control-surface/50 cursor-pointer flex flex-col`}
                >
                  {/* Full-card button — covers background/inactive areas for mouse + keyboard access.
                      z-[1] puts it above static content (which is z-auto) so pointer events on
                      non-interactive card areas route here. Interactive sections use relative z-[2]
                      to sit above this button. Settings button keeps its existing z-10. */}
                  <button
                    type="button"
                    className="absolute inset-0 z-[1] rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
                    onClick={() => setManagingAgent({ id: agent.id, name: agent.name })}
                    aria-label={`Open ${agent.name} management`}
                  />

                  {/* Color accent bar */}
                  <div className="absolute top-0 left-4 right-4 h-0.5 rounded-b" style={{ backgroundColor: theme.color }} />

                  {/* Settings icon — top-right, hover reveal */}
                  <IconButton
                    type="button"
                    size="1"
                    variant="ghost"
                   
                    onClick={(e) => { e.stopPropagation(); setManagingAgent({ id: agent.id, name: agent.name }); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Manage agent"
                    aria-label={`Manage ${agent.name}`}
                  >
                    <Settings size={12} />
                  </IconButton>

                  <div className="p-4 flex flex-col flex-1">

                    {/* Header: avatar + name + status dot */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Avatar */}
                      <AvatarWithFallback agentId={agent.id} agentName={agent.name} themeRing={theme.ring} themeBg={theme.bg} themeText={theme.text} themeColor={theme.color}>
                        {showDot && <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-mission-control-bg ${sc.color} ${sc.pulse ? 'animate-pulse' : ''}`} />}
                      </AvatarWithFallback>

                      {/* Name + role */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-sm leading-normal truncate">{agent.name}</h3>
                          {/* Only show non-idle status badges — idle is conveyed by Available below */}
                          {(agent.status === 'busy' || agent.status === 'disabled' || agent.status === 'suspended' || agent.status === 'archived' || agent.status === 'draft') && (
                            <Badge
                              color={agent.status === 'busy' ? 'orange' : agent.status === 'disabled' ? 'red' : agent.status === 'suspended' ? 'red' : agent.status === 'archived' ? 'gray' : 'gray'}
                              variant="soft"
                              size="1"
                              className="flex-shrink-0 uppercase"
                            >
                              {sc.label}
                            </Badge>
                          )}
                          {circuitOpenAgents.has(agent.id) && (
                            <Badge color="red" variant="soft" size="1" className="flex-shrink-0">
                              <AlertTriangle size={9} /> Circuit open
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                          {agent.status === 'idle' && !currentTask && agentTasks.length === 0 && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-success font-medium">
                              <CheckCircle size={9} />Available
                            </span>
                          )}
                          {currentTask && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-warning">
                              <Zap size={9} /><span className="truncate max-w-20">{currentTask.title}</span>
                            </span>
                          )}
                          {!currentTask && agentTasks.length > 0 && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-xs text-mission-control-text-dim">
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

                    {/* Per-agent token stat (last 7 days) */}
                    {agentTokenStats[agent.id] && (
                      <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-2 tabular-nums">
                        <Zap size={9} className="text-warning shrink-0" />
                        <span>
                          {agentTokenStats[agent.id].tokens >= 1_000_000
                            ? `${(agentTokenStats[agent.id].tokens / 1_000_000).toFixed(1)}M`
                            : agentTokenStats[agent.id].tokens >= 1_000
                            ? `${(agentTokenStats[agent.id].tokens / 1_000).toFixed(0)}K`
                            : agentTokenStats[agent.id].tokens} tokens
                        </span>
                        <span className="text-mission-control-border">/</span>
                        <span className="text-warning">${agentTokenStats[agent.id].cost.toFixed(4)}</span>
                        <span className="text-mission-control-text-dim/60">7d</span>
                      </div>
                    )}

                    {/* Last active timestamp */}
                    {agent.lastActivity && (
                      <div className="flex items-center gap-1 text-xs text-mission-control-text-dim mb-2">
                        <Clock size={9} />
                        <span>Last active: {(() => {
                          const diffMs = Date.now() - agent.lastActivity!;
                          const diffMin = Math.floor(diffMs / 60_000);
                          const diffHr = Math.floor(diffMs / 3_600_000);
                          if (diffMs < 60_000) return 'just now';
                          if (diffMin < 60) return `${diffMin}m ago`;
                          if (diffHr < 24) return `${diffHr}h ago`;
                          return `${Math.floor(diffHr / 24)}d ago`;
                        })()}</span>
                      </div>
                    )}

                    {/* Footer: capability tags + tier badge — relative z-[2] lifts above cover button */}
                    <div className="flex items-center gap-1 flex-wrap relative z-[2]">
                      {agent.capabilities?.slice(0, 3).map((cap, i) => (
                        <span key={i} className={`px-1.5 py-0.5 text-xs font-medium rounded max-w-[120px] truncate ${theme.bg} ${theme.text}`}>
                          {cap}
                        </span>
                      ))}
                      {(agent.capabilities?.length || 0) > 3 && (
                        <span className="text-xs text-mission-control-text-dim">+{(agent.capabilities?.length || 0) - 3}</span>
                      )}
                      <div className="flex-1" />
                      {/* Tier badge — right-aligned, editable on click */}
                      {agent.trust_tier && (
                        editingTrustTierAgent === agent.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Select.Root
                              size="1"
                              value={String(pendingTrustTier)}
                              onValueChange={val => setPendingTrustTier(Number(val))}
                            >
                              <Select.Trigger aria-label="Agent trust tier" onClick={e => e.stopPropagation()} />
                              <Select.Content>
                                <Select.Item value="1">Tier 1 (Restricted)</Select.Item>
                                <Select.Item value="2">Tier 2 (Worker)</Select.Item>
                                <Select.Item value="3">Tier 3 (Full)</Select.Item>
                              </Select.Content>
                            </Select.Root>
                            <IconButton type="button" variant="ghost" color="green" size="1" aria-label="Save trust tier" onClick={e => { e.stopPropagation(); handleTrustTierSave(agent.id, pendingTrustTier); }}><Check size={12} /></IconButton>
                            <IconButton type="button" variant="ghost" color="red" size="1" aria-label="Cancel trust tier edit" onClick={e => { e.stopPropagation(); setEditingTrustTierAgent(null); }}><AlertTriangle size={12} /></IconButton>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="1"
                            variant="soft"
                            color={
                              agent.trust_tier === 'admin' ? 'violet' :
                              agent.trust_tier === 'trusted' ? 'green' :
                              agent.trust_tier === 'worker' ? 'blue' :
                              agent.trust_tier === 'restricted' ? 'red' : 'gray'
                            }
                            onClick={e => { e.stopPropagation(); setPendingTrustTier(Number(agent.trust_tier) || 1); setEditingTrustTierAgent(agent.id); }}
                            className="opacity-50 group-hover:opacity-100 transition-opacity"
                            title="Click to edit trust tier"
                          >
                            {agent.trust_tier === 'admin' ? 'Admin' : agent.trust_tier === 'trusted' ? 'Trusted' : agent.trust_tier === 'worker' ? 'Worker' : agent.trust_tier === 'restricted' ? 'Restricted' : `Tier ${agent.trust_tier}`}
                            <Pencil size={8} className="opacity-0 group-hover:opacity-100" />
                          </Button>
                        )
                      )}
                    </div>

                    {/* Start/Stop + Soul link — relative z-[2] lifts above cover button */}
                    <div className={`flex items-center gap-1.5 mt-auto pt-2 border-t border-mission-control-border relative z-[2]`}>
                      {agent.status === 'idle' && agentTasks.length > 0 && (
                        <Button type="button" variant="solid" color="grass" size="1" onClick={(e) => { e.stopPropagation(); spawnAgentForTask(agentTasks[0].id); }}>
                          <Play size={11} /> Start
                        </Button>
                      )}
                      {agent.status === 'busy' && agent.sessionKey && (
                        <Button type="button" variant="surface" color="red" size="1" onClick={(e) => { e.stopPropagation(); updateAgentStatus(agent.id, 'idle'); }}>
                          <Square size={11} /> Stop
                        </Button>
                      )}
                      <div className="flex-1" />
                    </div>

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
                    session.isActive ? 'border-success-border bg-success-subtle' : 'border-mission-control-border bg-mission-control-surface'
                  }`}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-mission-control-surface border border-mission-control-border flex items-center justify-center">
                    <Bot size={16} className="text-info" />
                  </div>
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium session-name flex-shrink truncate">{session.displayName}</span>
                      {session.label && (
                        <span className="text-xs px-1.5 py-0.5 bg-info-subtle text-info border border-info-border rounded-lg no-shrink no-wrap">
                          {session.label}
                        </span>
                      )}
                      <span className={`w-2 h-2 rounded-full no-shrink ${session.isActive ? 'bg-success animate-pulse' : 'bg-mission-control-bg0'}`} />
                      {session.isActive && <span className="text-xs text-success no-shrink no-wrap">Active</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-mission-control-text-dim overflow-hidden">
                      <span className="no-shrink">{session.model?.split('/').pop() || 'unknown'}</span>
                      <span className="no-shrink no-wrap tabular-nums">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</span>
                      <span className="truncate flex-1 min-w-0" title={session.key}>{session.key}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium uppercase tracking-wide rounded-lg ${
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
                <div key={agent.id} className="rounded-lg border border-mission-control-border p-3 flex items-center gap-3 overflow-hidden min-h-[56px] hover:bg-mission-control-surface/50 transition-colors">
                  <AvatarWithFallback
                    agentId={agent.id}
                    agentName={agent.name}
                    themeRing={getTheme(agent.id).ring}
                    themeBg={getTheme(agent.id).bg}
                    themeText={getTheme(agent.id).text}
                    themeColor={getTheme(agent.id).color}
                    className="w-8 h-8 rounded-lg"
                  />
                  <div className="flex-fill">
                    <div className="icon-text min-w-0">
                      <span className="font-medium agent-name flex-1 min-w-0 truncate">{agent.name}</span>
                      {(agent.status === 'active' || agent.status === 'busy') && <span className={`w-2 h-2 rounded-full no-shrink ${statusConfig[agent.status].color}`} />}
                    </div>
                    <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                  </div>
                  {agent.status === 'disabled' ? (
                    <Button type="button" variant="surface" color="grass" size="1" onClick={() => handleAgentStart(agent.id)} title="Re-enable agent for dispatcher">
                      <Play size={12} /> Enable
                    </Button>
                  ) : agent.status === 'busy' && !PROTECTED_AGENTS.includes(agent.id as typeof PROTECTED_AGENTS[number]) ? (
                    <Button type="button" variant="surface" color="red" size="1" onClick={() => handleAgentStop(agent.id, agent.name)} title="Disable agent — dispatcher will stop spawning it">
                      <StopCircle size={12} /> Disable
                    </Button>
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

        </div>)} {/* end active view */}

        {/* Modals */}
        {showCreateModal && <HRAgentCreationModal onClose={() => setShowCreateModal(false)} />}
        {selectedAgent && <AgentDetailModal agentId={selectedAgent} onClose={() => setSelectedAgent(null)} />}
        {soulEditAgent && <AgentDetailModal agentId={soulEditAgent.id} onClose={() => setSoulEditAgent(null)} initialTab="soul" />}
        {managingAgent && (
          <AgentDetailModal
            agentId={managingAgent.id}
            onClose={() => setManagingAgent(null)}
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
      </Box>
    </Box>
  );
}
