import { useState, useEffect, useMemo } from 'react';
import { Bot, Play, Square, StopCircle, RefreshCw, Plus, Zap, Clock, CheckCircle, BarChart3, Settings, Library, AlertTriangle, Activity, Search, Trophy } from 'lucide-react';
import VirtualList from './VirtualList';
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
import { agentApi } from '../lib/api';
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
          style={{ backgroundColor: `color-mix(in srgb, ${themeColor} 13%, transparent)` }}
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [managingAgent, setManagingAgent] = useState<{ id: string; name: string } | null>(null);
  const [soulEditAgent, setSoulEditAgent] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'active' | 'health' | 'library' | 'leaderboard'>('active');
  const [circuitOpenAgents, setCircuitOpenAgents] = useState<Set<string>>(new Set());
  const { open: confirmOpen, config: confirmConfig, onConfirm: onConfirmCallback, showConfirm, closeConfirm } = useConfirmDialog();
  const [agentSearch, setAgentSearch] = useState('');

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await loadGatewaySessions(); }
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

  const handleAgentStart = async (agentId: string) => {
    try {
      await agentApi.updateStatus(agentId, 'active');
      await fetchAgents();
    } catch (err) {
      logger.error('[AgentPanel] Start error:', err);
      showToast('error', 'Failed to enable agent', (err as Error).message);
    }
  };

  const totalTokens = useMemo(
    () => gatewaySessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0),
    [gatewaySessions]
  );

  const realSubagents = gatewaySessions.filter(s => s.type === 'subagent');
  const activeSubagents = realSubagents.filter(s => s.isActive);

  const statusConfig: Record<Agent['status'], { color: string; label: string; pulse?: boolean; hideDot?: boolean }> = {
    // online / active → green with pulse
    active:     { color: 'bg-[var(--color-success)]',               label: 'Active',    pulse: true },
    // busy / working / in-progress → amber, solid (no pulse)
    busy:       { color: 'bg-[var(--color-warning)]',               label: 'Working…' },
    // idle / offline → gray, no pulse
    idle:       { color: 'bg-mission-control-border', label: 'Idle' },
    offline:    { color: 'bg-mission-control-surface',   label: 'Offline',   hideDot: true },
    suspended:  { color: 'bg-[var(--color-error)]',                 label: 'Suspended', hideDot: true },
    archived:   { color: 'bg-mission-control-surface',   label: 'Archived',  hideDot: true },
    draft:      { color: 'bg-mission-control-border', label: 'Draft',    hideDot: true },
    disabled:   { color: 'bg-[var(--color-error)]',                 label: 'Stopped',   hideDot: true },
  };

  const tasksByAgent = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach(t => {
      if (t.status === 'done') return;
      if (!t.assignedTo) return;
      if (!map.has(t.assignedTo)) map.set(t.assignedTo, []);
      map.get(t.assignedTo)!.push(t);
    });
    return map;
  }, [tasks]);

  const AGENT_ROLES: Record<string, string> = {
    'mission-control': 'orchestrator',
    'hr': 'hr',
    'clara': 'qc',
    'inbox': 'inbox',
  };

  // Skip phantom/legacy agents — use exclusion so new agents auto-appear
  const PHANTOM_AGENTS = ['main', 'chat-agent'];

  const { uniqueAgents, mainAgents, workerAgents } = useMemo(() => {
    const realAgents = agents.filter(a => !PHANTOM_AGENTS.includes(a.id));
    // Remove duplicates by ID (in case store has dupes)
    const unique = Array.from(new Map(realAgents.map(a => [a.id, a])).values());
    // Split into main agents and workers
    const main = unique.filter(a => !a.id.startsWith('worker-'));
    const workers = agents.filter(a => a.id.startsWith('worker-'));
    return { uniqueAgents: unique, mainAgents: main, workerAgents: workers };
  }, [agents]);

  // Client-side search filter — applied to core agents list
  const filteredMainAgents = useMemo(() => {
    const searchQuery = agentSearch.trim().toLowerCase();
    if (!searchQuery) return mainAgents;
    return mainAgents.filter(a =>
      a.name.toLowerCase().includes(searchQuery) ||
      (a.description || '').toLowerCase().includes(searchQuery) ||
      (a.capabilities || []).some(c => c.toLowerCase().includes(searchQuery))
    );
  }, [mainAgents, agentSearch]);

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
          </div>
        </Flex>

        {/* View tabs */}
        <Box mb="5">
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
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const activeAgentCount = agents.filter(a => a.status === 'active' || a.status === 'busy').length;
                const formatTokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);
                return [
                  { val: activeAgentCount, label: 'Active Agents', color: 'text-[var(--color-success)]' },
                  { val: activeSubagents.length, label: 'Active Sub-Agents', color: 'text-[var(--color-warning)]' },
                  { val: gatewaySessions.length, label: 'Total Sessions', color: 'text-[var(--color-info)]' },
                  { val: formatTokens(totalTokens), label: 'Total Tokens', color: 'text-[var(--color-review)]' },
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
          <Flex align="center" justify="between" className="mb-4">
            <h2 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Core Agents</h2>
          </Flex>

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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={32} className="text-mission-control-text-dim mb-3 opacity-50" />
              <p className="text-sm font-medium text-mission-control-text-dim">No agents match &ldquo;{agentSearch}&rdquo;</p>
              <p className="text-xs text-mission-control-text-dim mt-1 opacity-70">Try a different name, role, or capability</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMainAgents.map((agent) => {
              const theme = getTheme(agent.id);
              const agentTasks = tasksByAgent.get(agent.id) ?? [];
              const currentTask = tasks.find(t => t.id === agent.currentTaskId);
              const sc = statusConfig[agent.status];
              // Hide dot when: no current task, task is done/review, or status says hideDot
              const hasActiveTask = currentTask && !['done', 'review', 'completed'].includes(currentTask.status);
              const showDot = !sc.hideDot && (agent.status === 'active' || agent.status === 'busy' || (agent.status === 'idle' && hasActiveTask));

              return (
                <div
                  key={agent.id}
                  className={`group relative rounded-xl border bg-mission-control-surface transition-colors duration-150 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer flex flex-col ${selectedAgent === agent.id ? 'border-mission-control-accent bg-[var(--mission-control-accent)]/5' : 'border-mission-control-border'}`}
                >
                  {/* Full-card button — covers background/inactive areas for mouse + keyboard access.
                      z-[1] puts it above static content (which is z-auto) so pointer events on
                      non-interactive card areas route here. Interactive sections use relative z-[2]
                      to sit above this button. Settings button keeps its existing z-10. */}
                  <button
                    type="button"
                    className="absolute inset-0 z-[1] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
                    onClick={() => setManagingAgent({ id: agent.id, name: agent.name })}
                    aria-label={`Open ${agent.name} management`}
                  />

                  {/* Color accent bar */}
                  <div className="absolute top-0 left-4 right-4 h-0.5 rounded-b" style={{ backgroundColor: theme.color }} />

                  {/* Settings icon — top-right, hover reveal */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setManagingAgent({ id: agent.id, name: agent.name }); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-colors z-10 inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    title="Manage agent"
                    aria-label={`Manage ${agent.name}`}
                  >
                    <Settings size={12} />
                  </button>

                  <div className="p-3 flex flex-col flex-1">

                    {/* Header: avatar + name + status dot */}
                    <Flex align="start" gap="3">
                      {/* Avatar */}
                      <AvatarWithFallback agentId={agent.id} agentName={agent.name} themeRing={theme.ring} themeBg={theme.bg} themeText={theme.text} themeColor={theme.color}>
                        {showDot && <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-mission-control-bg ${sc.color} ${sc.pulse ? 'agent-dot-pulse' : ''}`} />}
                      </AvatarWithFallback>

                      {/* Name + role */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <Flex align="center" gap="2" className="mb-0.5">
                          <h3 className="text-sm font-semibold text-mission-control-text truncate" title={agent.name}>{agent.name}</h3>
                          {/* Only show non-idle status badges — idle is conveyed by Available below */}
                          {(agent.status === 'busy' || agent.status === 'disabled' || agent.status === 'suspended' || agent.status === 'archived' || agent.status === 'draft') && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              agent.status === 'busy'
                                ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                                : 'bg-mission-control-border/50 text-mission-control-text-dim'
                            }`}>
                              {sc.label}
                            </span>
                          )}
                          {circuitOpenAgents.has(agent.id) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-[var(--color-error)]/10 text-[var(--color-error)]">
                              <AlertTriangle size={9} /> Circuit open
                            </span>
                          )}
                        </Flex>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                          {currentTask && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-[var(--color-warning)]">
                              <Zap size={9} /><span className="truncate max-w-20">{currentTask.title}</span>
                            </span>
                          )}
                          {!currentTask && agentTasks.length > 0 && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] tabular-nums text-mission-control-text-dim">
                              <Clock size={9} />{agentTasks.length} queued
                            </span>
                          )}
                        </div>
                      </div>
                    </Flex>



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
            <h2 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-3">
              Sub-Agents ({activeSubagents.length} active / {realSubagents.length} total)
            </h2>
            {realSubagents.length >= 50 ? (
              <div style={{ height: Math.min(realSubagents.length * 68, 400) }}>
                <VirtualList
                  items={realSubagents}
                  itemHeight={68}
                  overscan={3}
                  renderItem={(session) => (
                    <div
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-mission-control-border/20 transition-colors cursor-pointer mb-2"
                    >
                      <AvatarWithFallback
                        agentId={session.key}
                        agentName={session.displayName}
                        themeRing={getTheme(session.key).ring}
                        themeBg={getTheme(session.key).bg}
                        themeText={getTheme(session.key).text}
                        themeColor={getTheme(session.key).color}
                        className="w-8 h-8 rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-mission-control-text truncate" title={session.displayName}>{session.displayName}</span>
                          {session.label && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-mission-control-border/50 text-mission-control-text-dim whitespace-nowrap">
                              {session.label}
                            </span>
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${session.isActive ? 'bg-[var(--color-success)] agent-dot-pulse' : 'bg-mission-control-surface'}`} />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] tabular-nums text-mission-control-text-dim overflow-hidden">
                          <span className="flex-shrink-0">{session.model?.split('/').pop() || 'unknown'}</span>
                          <span className="flex-shrink-0 max-w-[120px] truncate">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</span>
                          <span className="truncate flex-1 min-w-0" title={session.key}>{session.key}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        session.isActive ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-mission-control-border/50 text-mission-control-text-dim'
                      }`}>
                        {session.isActive ? 'Running' : 'Idle'}
                      </span>
                    </div>
                  )}
                />
              </div>
            ) : (
              <div className="space-y-1">
                {realSubagents.map((session) => (
                  <div key={session.key}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-mission-control-border/20 transition-colors cursor-pointer">
                    <AvatarWithFallback
                      agentId={session.key}
                      agentName={session.displayName}
                      themeRing={getTheme(session.key).ring}
                      themeBg={getTheme(session.key).bg}
                      themeText={getTheme(session.key).text}
                      themeColor={getTheme(session.key).color}
                      className="w-8 h-8 rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium text-mission-control-text truncate" title={session.displayName}>{session.displayName}</span>
                        {session.label && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-mission-control-border/50 text-mission-control-text-dim whitespace-nowrap">
                            {session.label}
                          </span>
                        )}
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${session.isActive ? 'bg-[var(--color-success)] agent-dot-pulse' : 'bg-mission-control-surface'}`} />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] tabular-nums text-mission-control-text-dim overflow-hidden">
                        <span className="flex-shrink-0">{session.model?.split('/').pop() || 'unknown'}</span>
                        <span className="flex-shrink-0 max-w-[120px] truncate">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</span>
                        <span className="truncate flex-1 min-w-0" title={session.key}>{session.key}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      session.isActive ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-mission-control-border/50 text-mission-control-text-dim'
                    }`}>
                      {session.isActive ? 'Running' : 'Idle'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workers */}
        {workerAgents.length > 0 && (
          <div>
            <h2 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-3">
              Workers ({workerAgents.length})
            </h2>
            {workerAgents.length >= 50 ? (
              <div style={{ height: Math.min(workerAgents.length * 64, 400) }}>
                <VirtualList
                  items={workerAgents}
                  itemHeight={64}
                  overscan={3}
                  renderItem={(agent) => (
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-mission-control-border/20 transition-colors cursor-pointer mb-2">
                      <AvatarWithFallback
                        agentId={agent.id}
                        agentName={agent.name}
                        themeRing={getTheme(agent.id).ring}
                        themeBg={getTheme(agent.id).bg}
                        themeText={getTheme(agent.id).text}
                        themeColor={getTheme(agent.id).color}
                        className="w-8 h-8 rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-mission-control-text truncate" title={agent.name}>{agent.name}</span>
                          {(agent.status === 'active' || agent.status === 'busy') && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig[agent.status].color}`} />}
                        </div>
                        <p className="text-[10px] text-mission-control-text-dim truncate">{agent.description}</p>
                      </div>
                      {agent.status === 'disabled' ? (
                        <Button type="button" variant="surface" size="1" onClick={() => handleAgentStart(agent.id)} title="Re-enable agent for dispatcher">
                          <Play size={12} /> Enable
                        </Button>
                      ) : agent.status === 'busy' && !PROTECTED_AGENTS.includes(agent.id as typeof PROTECTED_AGENTS[number]) ? (
                        <Button type="button" variant="surface" color="red" size="1" onClick={() => handleAgentStop(agent.id, agent.name)} title="Disable agent — dispatcher will stop spawning it">
                          <StopCircle size={12} /> Disable
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                          <CheckCircle size={10} /> Done
                        </span>
                      )}
                    </div>
                  )}
                />
              </div>
            ) : (
              <div className="space-y-1">
                {workerAgents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-mission-control-border/20 transition-colors cursor-pointer">
                    <AvatarWithFallback
                      agentId={agent.id}
                      agentName={agent.name}
                      themeRing={getTheme(agent.id).ring}
                      themeBg={getTheme(agent.id).bg}
                      themeText={getTheme(agent.id).text}
                      themeColor={getTheme(agent.id).color}
                      className="w-8 h-8 rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium text-mission-control-text truncate" title={agent.name}>{agent.name}</span>
                        {(agent.status === 'active' || agent.status === 'busy') && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusConfig[agent.status].color}`} />}
                      </div>
                      <p className="text-[10px] text-mission-control-text-dim truncate">{agent.description}</p>
                    </div>
                    {agent.status === 'disabled' ? (
                      <Button type="button" variant="surface" size="1" onClick={() => handleAgentStart(agent.id)} title="Re-enable agent for dispatcher">
                        <Play size={12} /> Enable
                      </Button>
                    ) : agent.status === 'busy' && !PROTECTED_AGENTS.includes(agent.id as typeof PROTECTED_AGENTS[number]) ? (
                      <Button type="button" variant="surface" color="red" size="1" onClick={() => handleAgentStop(agent.id, agent.name)} title="Disable agent — dispatcher will stop spawning it">
                        <StopCircle size={12} /> Disable
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                        <CheckCircle size={10} /> Done
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
