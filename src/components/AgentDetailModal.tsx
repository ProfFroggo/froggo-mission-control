// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef } from 'react';
import { X, Award, TrendingUp, Clock, CheckCircle, XCircle, FileText, Activity, Brain, RefreshCw, Wifi, WifiOff, MessageSquare, CalendarDays, Cpu, Edit, Tag, Power, BarChart2, Lightbulb, Check, AlertTriangle, Plus } from 'lucide-react';
import { useStore } from '../store/store';
import AgentChatModal from './AgentChatModal';
import AgentActivityTimeline from './AgentActivityTimeline';
import AgentSoulEditor from './AgentSoulEditor';
import { agentApi } from '../lib/api';
import { showToast } from './Toast';

interface AgentDetailModalProps {
  agentId: string;
  onClose: () => void;
  initialTab?: 'performance' | 'skills' | 'tasks' | 'sessions' | 'rules' | 'soul';
}

interface AgentDetails {
  // Performance
  successRate: number;
  avgTime: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  // Skills from agent capabilities
  skills: Array<{
    name: string;
    proficiency: number;
    lastUsed: string;
    successCount: number;
    failureCount: number;
  }>;
  // Real tasks from store
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    outcome: string;
    completedAt: number;
    project?: string;
    tags?: string;
    planningNotes?: string;
  }>;
  // Active sessions
  activeSessions: Array<{
    key: string;
    model: string;
    tokens: number;
    isActive: boolean;
    updatedAt: number;
    label?: string;
  }>;
  // Agent identity/config
  agentRules: string;
  brainNotes: string[];
}

interface AgentStats {
  tasksCompleted: number;
  tasksRejected: number;
  successRate: number | null;
  avgDurationMs: number | null;
}

const AGENT_STATUSES = [
  { value: 'active',      label: 'Online',      color: 'text-success' },
  { value: 'busy',        label: 'Busy',         color: 'text-warning' },
  { value: 'idle',        label: 'Offline',      color: 'text-mission-control-text-dim' },
  { value: 'disabled',    label: 'Maintenance',  color: 'text-error' },
] as const;

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export default function AgentDetailModal({ agentId, onClose, initialTab }: AgentDetailModalProps) {
  const { agents, tasks, gatewaySessions } = useStore();
  const fetchAgents = useStore(s => s.fetchAgents);
  const updateAgentStatus = useStore(s => s.updateAgentStatus);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'performance' | 'skills' | 'tasks' | 'sessions' | 'rules' | 'soul'>(initialTab ?? 'performance');
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingSessionKey, setViewingSessionKey] = useState<string | null>(null);
  const agent = agents.find(a => a.id === agentId);

  // ── Description edit state ───────────────────────
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Capability tags state ────────────────────────
  const [capTags, setCapTags] = useState<string[]>([]);
  const [capInput, setCapInput] = useState('');
  const [capSaving, setCapSaving] = useState(false);
  const [capDirty, setCapDirty] = useState(false);

  // ── Status override state ────────────────────────
  const [statusOverride, setStatusOverride] = useState<string>('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [showStatusOverride, setShowStatusOverride] = useState(false);

  // ── Performance stats ────────────────────────────
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Skill gap suggestions ────────────────────────
  const [skillGaps, setSkillGaps] = useState<string[]>([]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Sync caps from agent store into local state
  useEffect(() => {
    if (agent?.capabilities) {
      setCapTags([...agent.capabilities]);
    }
  }, [agent?.capabilities]);

  // Load stats when performance tab is active
  useEffect(() => {
    if (activeTab !== 'performance') return;
    if (agentStats) return;
    setStatsLoading(true);
    fetch(`/api/agents/${agentId}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgentStats(data); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [activeTab, agentId, agentStats]);

  const buildDetailsFromRealData = async () => {
    setLoading(true);

    // Try REST API first (reads from mission-control.db with real data)
    let ipcDetails: any = null;
    try {
      ipcDetails = await agentApi.getById(agentId);
    } catch (_e) {
      // API failed, will fall back to store data
    }

    // Get tasks from store as fallback/supplement
    const agentTasks = tasks.filter(t => t.assignedTo === agentId);
    const doneTasks = agentTasks.filter(t => t.status === 'done');
    const failedTasksList = agentTasks.filter(t => (t.status as string) === 'failed');
    const inProgressTasks = agentTasks.filter(t => t.status === 'in-progress');

    // Use IPC data if available, otherwise fall back to store data
    const totalTasks = ipcDetails?.totalTasks ?? agentTasks.length;
    const successfulCount = ipcDetails?.successfulTasks ?? doneTasks.length;
    const failedCount = ipcDetails?.failedTasks ?? failedTasksList.length;
    const successRate = ipcDetails?.successRate ?? (totalTasks > 0 ? successfulCount / totalTasks : 0);
    const avgTimeStr = ipcDetails?.avgTime || 'N/A';

    // Skills: prefer IPC data, fall back to agent capabilities
    let skills = ipcDetails?.skills || [];
    if (skills.length === 0 && agent?.capabilities?.length) {
      skills = agent.capabilities.map((cap: string) => ({
        name: cap,
        proficiency: 0.5,
        lastUsed: 'N/A',
        successCount: 0,
        failureCount: 0,
      }));
    }

    // Recent tasks: prefer IPC, supplement with store
    let recentTasks = ipcDetails?.recentTasks || [];
    if (recentTasks.length === 0 && agentTasks.length > 0) {
      recentTasks = agentTasks
        .sort((a, b) => ((b as any).updatedAt || 0) - ((a as any).updatedAt || 0))
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          outcome: t.status === 'done' ? 'success' : t.status === 'failed' ? 'failed' : 'pending',
          completedAt: (t as any).completedAt || (t as any).updatedAt || 0,
          project: t.project,
          tags: (t as any).tags,
          planningNotes: (t as any).planningNotes,
        }));
    }

    // Active gateway sessions for this agent
    const agentSessions = gatewaySessions.filter(s => {
      const key = s.key.toLowerCase();
      const id = agentId.toLowerCase();
      return key.includes(id) || (s.label && s.label.toLowerCase().includes(id));
    });

    const activeSessions = agentSessions.map(s => ({
      key: s.key,
      model: s.model || 'unknown',
      tokens: s.totalTokens || 0,
      isActive: s.isActive,
      updatedAt: s.updatedAt || 0,
      label: s.label || undefined,
    }));

    // Rules and brain notes from IPC or exec fallback
    let rulesContent = ipcDetails?.agentRules || '';
    let brainNotes: string[] = ipcDetails?.brainNotes || [];

    if (!rulesContent) {
      try {
        const soulData = await agentApi.readSoul(agentId);
        rulesContent = soulData?.content || `No AGENT.md found for ${agentId}`;
      } catch (_e) {
        rulesContent = `Could not load rules for ${agentId}`;
      }
    }

    if (brainNotes.length === 0) {
      // Brain notes / memory files — no REST equivalent
      console.warn('Not implemented: exec.run for memory listing', agentId);
    }

    // ── Skill gap computation ─────────────────────
    const agentCaps = new Set((agent?.capabilities || []).map(c => c.toLowerCase()));
    const recent5Tasks = recentTasks.slice(0, 5);
    const skillMentions: Record<string, number> = {};

    for (const t of recent5Tasks) {
      // Extract from tags JSON string
      const rawTags: string[] = [];
      if (t.tags) {
        try {
          const parsed = JSON.parse(t.tags);
          if (Array.isArray(parsed)) rawTags.push(...parsed);
        } catch {
          rawTags.push(...String(t.tags).split(','));
        }
      }
      // Also scan planningNotes for skill-like words (simple heuristic)
      if (t.planningNotes) {
        const words = t.planningNotes.match(/\b[a-z][a-z0-9-]{3,}\b/gi) || [];
        rawTags.push(...words.filter(w => w.length >= 4));
      }
      for (const tag of rawTags) {
        const norm = tag.trim().toLowerCase();
        if (norm && !agentCaps.has(norm)) {
          skillMentions[norm] = (skillMentions[norm] || 0) + 1;
        }
      }
    }
    // Gaps = things mentioned in ≥ 2 recent tasks not already in capabilities
    const gaps = Object.entries(skillMentions)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);
    setSkillGaps(gaps);

    setDetails({
      successRate,
      avgTime: avgTimeStr,
      totalTasks,
      successfulTasks: successfulCount,
      failedTasks: failedCount,
      inProgressTasks: ipcDetails ? (totalTasks - successfulCount - failedCount) : inProgressTasks.length,
      skills,
      recentTasks,
      activeSessions,
      agentRules: rulesContent,
      brainNotes,
    });

    setLoading(false);
  };

  useEffect(() => {
    buildDetailsFromRealData();
  }, [agentId, tasks, gatewaySessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key !== 'Escape') return;
      }
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); return; }
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === 'r') { e.preventDefault(); buildDetailsFromRealData(); return; }
      if (isCmdOrCtrl && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, typeof activeTab> = { '1': 'performance', '2': 'skills', '3': 'tasks', '4': 'sessions', '5': 'rules', '6': 'soul' };
        if (e.key in tabMap) setActiveTab(tabMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeTab]);

  if (!agent) return null;

  // ── Description handlers ─────────────────────────
  const startEditDesc = () => {
    setDescDraft(agent.description || '');
    setEditingDesc(true);
    setTimeout(() => descInputRef.current?.focus(), 50);
  };

  const cancelEditDesc = () => {
    setEditingDesc(false);
    setDescDraft('');
  };

  const saveDesc = async () => {
    if (descSaving) return;
    setDescSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descDraft.trim() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingDesc(false);
      showToast('success', 'Description updated');
      fetchAgents();
    } catch (err) {
      showToast('error', 'Failed to save description', (err as Error).message);
    } finally {
      setDescSaving(false);
    }
  };

  // ── Capability handlers ──────────────────────────
  const addCapTag = () => {
    const val = capInput.trim();
    if (!val || capTags.includes(val)) { setCapInput(''); return; }
    setCapTags(prev => [...prev, val]);
    setCapInput('');
    setCapDirty(true);
  };

  const removeCapTag = (tag: string) => {
    setCapTags(prev => prev.filter(t => t !== tag));
    setCapDirty(true);
  };

  const saveCaps = async () => {
    if (capSaving) return;
    setCapSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: capTags }),
      });
      if (!res.ok) throw new Error('Save failed');
      setCapDirty(false);
      showToast('success', 'Capabilities updated');
      fetchAgents();
    } catch (err) {
      showToast('error', 'Failed to save capabilities', (err as Error).message);
    } finally {
      setCapSaving(false);
    }
  };

  // ── Status override handler ──────────────────────
  const applyStatusOverride = async () => {
    if (!statusOverride || statusSaving) return;
    setStatusSaving(true);
    // Optimistic update via store
    updateAgentStatus(agentId, statusOverride as any);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusOverride }),
      });
      if (!res.ok) throw new Error('Override failed');
      showToast('success', `Status overridden to ${statusOverride}`);
      setShowStatusOverride(false);
      fetchAgents();
    } catch (err) {
      // Rollback by refetching
      fetchAgents();
      showToast('error', 'Failed to override status', (err as Error).message);
    } finally {
      setStatusSaving(false);
    }
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
    <>
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
        className={`glass-modal rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="p-6 border-b border-mission-control-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden bg-mission-control-bg">
              <img
                src={`/api/agents/${agent.id}/avatar`}
                alt={agent.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const sibling = target.nextElementSibling as HTMLElement | null;
                  if (sibling) sibling.classList.remove('hidden');
                }}
              />
              <span className="hidden absolute inset-0 flex items-center justify-center text-4xl">{agent.avatar}</span>
              {/* Status dot */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-mission-control-bg ${
                agent.status === 'busy' || agent.status === 'active' ? 'bg-success animate-pulse' : 'bg-mission-control-text-dim/40'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-mission-control-text">{agent.name}</h2>
                {(agent as any).model && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim border border-mission-control-border/60">
                    <Cpu size={10} />
                    {(agent as any).model}
                  </span>
                )}
              </div>

              {/* Editable description */}
              {editingDesc ? (
                <div className="mt-1.5 flex items-start gap-1.5">
                  <textarea
                    ref={descInputRef}
                    value={descDraft}
                    onChange={e => setDescDraft(e.target.value)}
                    rows={2}
                    className="flex-1 text-sm px-2 py-1 rounded border border-mission-control-accent/60 bg-mission-control-bg text-mission-control-text resize-none focus:outline-none focus:border-mission-control-accent"
                    placeholder="Add a description for this agent…"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDesc(); } if (e.key === 'Escape') cancelEditDesc(); }}
                  />
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button type="button" onClick={saveDesc} disabled={descSaving} className="p-1 rounded text-success hover:bg-success-subtle transition-colors disabled:opacity-50" title="Save">
                      {descSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button type="button" onClick={cancelEditDesc} className="p-1 rounded text-error hover:bg-error-subtle transition-colors" title="Cancel">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditDesc}
                  className="group flex items-center gap-1.5 mt-0.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors text-left"
                  title="Click to edit description"
                >
                  <span className={agent.description ? '' : 'italic opacity-60'}>
                    {agent.description || 'Add a description…'}
                  </span>
                  <Edit size={12} className="opacity-0 group-hover:opacity-60 flex-shrink-0 transition-opacity" />
                </button>
              )}

              {/* Activity timeline */}
              <div className="mt-3 w-64">
                <AgentActivityTimeline agentId={agent.id} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={buildDetailsFromRealData}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              title="Refresh (⌘R)"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mission-control-border px-6">
          {([
            { key: 'performance' as const, icon: TrendingUp, label: 'Performance' },
            { key: 'skills' as const, icon: Award, label: 'Skills' },
            { key: 'tasks' as const, icon: Activity, label: `Tasks${details ? ` (${details.totalTasks})` : ''}` },
            { key: 'sessions' as const, icon: Wifi, label: `Sessions${details ? ` (${details.activeSessions.length})` : ''}` },
            { key: 'rules' as const, icon: FileText, label: 'Rules' },
            { key: 'soul' as const, icon: CalendarDays, label: 'Soul' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-mission-control-accent text-mission-control-accent'
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <tab.icon size={14} className="inline mr-1" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-mission-control-text-dim">
                <RefreshCw size={16} className="animate-spin" />
                Loading real data...
              </div>
            </div>
          ) : details ? (
            <>
              {/* ── Performance Tab ── */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  {/* Current task — prominent banner */}
                  {(() => {
                    const currentTask = details.recentTasks.find(t => t.status === 'in-progress');
                    if (!currentTask) return null;
                    return (
                      <div className="rounded-lg border border-warning-border bg-warning-subtle p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity size={14} className="text-warning flex-shrink-0" />
                          <span className="text-xs font-semibold text-warning uppercase tracking-wider">Currently working on</span>
                        </div>
                        <p className="text-sm font-medium text-mission-control-text">{currentTask.title}</p>
                        <div className="mt-2 h-1.5 bg-warning/20 rounded-full overflow-hidden">
                          <div className="h-full bg-warning rounded-full animate-pulse w-2/3" />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-success" />
                        <span className="text-sm text-mission-control-text-dim">Success Rate</span>
                      </div>
                      <div className="text-3xl font-bold text-success">
                        {details.totalTasks > 0 ? `${Math.round(details.successRate * 100)}%` : '—'}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">
                        {details.successfulTasks} / {details.totalTasks} tasks
                      </div>
                    </div>

                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className="text-info" />
                        <span className="text-sm text-mission-control-text-dim">Avg Time</span>
                      </div>
                      <div className="text-3xl font-bold text-info">
                        {details.avgTime}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">per task completion</div>
                    </div>

                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-amber-400" />
                        <span className="text-sm text-mission-control-text-dim">In Progress</span>
                      </div>
                      <div className="text-3xl font-bold text-amber-400">
                        {details.inProgressTasks}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">active tasks</div>
                    </div>

                    <div className="bg-mission-control-bg rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wifi size={16} className="text-review" />
                        <span className="text-sm text-mission-control-text-dim">Sessions</span>
                      </div>
                      <div className="text-3xl font-bold text-review">
                        {details.activeSessions.filter(s => s.isActive).length}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-1">
                        {details.activeSessions.length} total
                      </div>
                    </div>
                  </div>

                  {/* Performance summary from /stats endpoint */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 size={15} className="text-info flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-mission-control-text">Performance Summary</h3>
                      {statsLoading && <RefreshCw size={12} className="animate-spin text-mission-control-text-dim ml-auto" />}
                    </div>
                    {agentStats ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-2xl font-bold text-success tabular-nums">{agentStats.tasksCompleted}</div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">Tasks completed</div>
                        </div>
                        <div>
                          <div className={`text-2xl font-bold tabular-nums ${agentStats.successRate !== null && agentStats.successRate >= 80 ? 'text-success' : agentStats.successRate !== null && agentStats.successRate >= 50 ? 'text-warning' : 'text-error'}`}>
                            {agentStats.successRate !== null ? `${agentStats.successRate}%` : '—'}
                          </div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">
                            Success rate ({agentStats.tasksRejected} failed)
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-info tabular-nums">
                            {agentStats.avgDurationMs ? formatDuration(agentStats.avgDurationMs) : '—'}
                          </div>
                          <div className="text-xs text-mission-control-text-dim mt-0.5">Avg task duration</div>
                        </div>
                      </div>
                    ) : statsLoading ? null : (
                      <p className="text-sm text-mission-control-text-dim">No stats available yet.</p>
                    )}
                  </div>

                  {/* Status manual override */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Power size={15} className="text-warning flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-mission-control-text">Force Status</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStatusOverride(v => !v)}
                        className="text-xs px-3 py-1.5 border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors text-mission-control-text-dim"
                      >
                        {showStatusOverride ? 'Cancel' : 'Override'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-mission-control-text-dim">Current:</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        agent.status === 'active' || agent.status === 'busy' ? 'bg-success-subtle text-success' :
                        agent.status === 'disabled' ? 'bg-error-subtle text-error' :
                        'bg-mission-control-border text-mission-control-text-dim'
                      }`}>{agent.status}</span>
                    </div>

                    {showStatusOverride && (
                      <div className="space-y-3 pt-2 border-t border-mission-control-border">
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-warning-subtle border border-warning-border">
                          <AlertTriangle size={13} className="text-warning flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-warning">
                            Manual override. The agent&apos;s next task dispatch will reset this status automatically.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {AGENT_STATUSES.map(s => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setStatusOverride(s.value)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${
                                statusOverride === s.value
                                  ? 'border-mission-control-accent bg-mission-control-accent/10'
                                  : 'border-mission-control-border hover:border-mission-control-accent/40'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                s.value === 'active' ? 'bg-success' :
                                s.value === 'busy' ? 'bg-warning' :
                                s.value === 'disabled' ? 'bg-error' : 'bg-mission-control-text-dim'
                              }`} />
                              <span className={s.color}>{s.label}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={applyStatusOverride}
                          disabled={!statusOverride || statusSaving}
                          className="w-full py-2 text-sm bg-warning text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-40 font-medium"
                        >
                          {statusSaving ? <RefreshCw size={14} className="inline animate-spin mr-1" /> : <Power size={14} className="inline mr-1" />}
                          {statusSaving ? 'Applying…' : `Force ${statusOverride || 'status'}`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Task breakdown */}
                  <div className="bg-mission-control-bg rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-4">Task Breakdown</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Completed', count: details.successfulTasks, color: 'bg-green-500', pct: details.totalTasks > 0 ? (details.successfulTasks / details.totalTasks) * 100 : 0 },
                        { label: 'In Progress', count: details.inProgressTasks, color: 'bg-warning', pct: details.totalTasks > 0 ? (details.inProgressTasks / details.totalTasks) * 100 : 0 },
                        { label: 'Failed/Blocked', count: details.failedTasks, color: 'bg-red-500', pct: details.totalTasks > 0 ? (details.failedTasks / details.totalTasks) * 100 : 0 },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>{item.label}</span>
                            <span className="text-mission-control-text-dim">{item.count} ({Math.round(item.pct)}%)</span>
                          </div>
                          <div className="h-2 bg-mission-control-surface rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent 5 tasks */}
                  {details.recentTasks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-3">Recent Tasks</h3>
                      <div className="space-y-2">
                        {details.recentTasks.slice(0, 5).map(task => (
                          <div key={task.id} className="flex items-center justify-between bg-mission-control-bg rounded-lg px-4 py-2.5 gap-3">
                            <span className="text-sm text-mission-control-text flex-1 min-w-0 truncate">{task.title}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                                task.status === 'done' ? 'bg-success-subtle text-success' :
                                task.status === 'in-progress' ? 'bg-warning-subtle text-warning' :
                                task.status === 'failed' ? 'bg-error-subtle text-error' :
                                'bg-mission-control-border text-mission-control-text-dim'
                              }`}>
                                {task.status}
                              </span>
                              {task.completedAt > 0 && (
                                <span className="text-[11px] text-mission-control-text-dim">
                                  {new Date(task.completedAt).toLocaleDateString()}
                                </span>
                              )}
                              {task.outcome === 'success' ? (
                                <CheckCircle size={13} className="text-success" />
                              ) : task.outcome === 'failed' ? (
                                <XCircle size={13} className="text-error" />
                              ) : (
                                <Clock size={13} className="text-mission-control-text-dim" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Skills Tab ── */}
              {activeTab === 'skills' && (
                <div className="space-y-6">
                  {/* Editable capability tags */}
                  <div className="rounded-lg border border-mission-control-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag size={15} className="text-info flex-shrink-0" />
                      <h3 className="text-sm font-semibold text-mission-control-text">Capabilities</h3>
                    </div>

                    {/* Tag pills */}
                    <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                      {capTags.length === 0 && (
                        <span className="text-xs text-mission-control-text-dim italic">No capabilities defined</span>
                      )}
                      {capTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-info-subtle text-info border border-info-border">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeCapTag(tag)}
                            className="ml-0.5 hover:text-error transition-colors rounded-full"
                            title={`Remove ${tag}`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={capInput}
                        onChange={e => setCapInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCapTag(); } }}
                        placeholder="Add capability (press Enter)"
                        className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-mission-control-accent transition-colors"
                      />
                      <button
                        type="button"
                        onClick={addCapTag}
                        disabled={!capInput.trim()}
                        className="p-1.5 rounded-lg border border-mission-control-border hover:bg-mission-control-surface disabled:opacity-40 transition-colors"
                        title="Add capability"
                      >
                        <Plus size={14} />
                      </button>
                      {capDirty && (
                        <button
                          type="button"
                          onClick={saveCaps}
                          disabled={capSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim disabled:opacity-50 transition-colors"
                        >
                          {capSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                          {capSaving ? 'Saving…' : 'Save'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Skill gap indicator */}
                  {skillGaps.length > 0 && (
                    <div className="rounded-lg border border-info-border bg-info-subtle p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={15} className="text-info flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-info">Consider adding</h3>
                      </div>
                      <p className="text-xs text-mission-control-text-dim mb-3">
                        These skills appear in {agent.name}&apos;s recent tasks but are not listed in capabilities:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {skillGaps.map(gap => (
                          <button
                            key={gap}
                            type="button"
                            onClick={() => { if (!capTags.includes(gap)) { setCapTags(prev => [...prev, gap]); setCapDirty(true); } }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-info-border text-info hover:bg-info/10 transition-colors"
                            title={`Add "${gap}" to capabilities`}
                          >
                            <Plus size={10} />
                            {gap}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills list */}
                  <div>
                    <p className="text-sm text-mission-control-text-dim mb-3">
                      Capabilities configured for {agent.name}:
                    </p>
                    {details.skills.length > 0 ? (
                      <div className="space-y-2">
                        {details.skills.map((skill) => (
                          <div key={skill.name} className="bg-mission-control-bg rounded-lg p-4 hover:bg-mission-control-border/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Award size={16} className="text-warning" />
                                <span className="font-medium">{skill.name}</span>
                              </div>
                              <span className="text-xs text-mission-control-text-dim">{skill.lastUsed}</span>
                            </div>
                            <div className="mb-1">
                              <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
                                <span>Proficiency</span>
                                <span>{Math.round(skill.proficiency * 100)}%</span>
                              </div>
                              <div className="h-2 bg-mission-control-surface rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                  style={{ width: `${skill.proficiency * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-mission-control-text-dim">
                        <Award size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No skills configured</p>
                        <p className="text-xs">Add capabilities above to configure this agent&apos;s skills</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tasks Tab ── */}
              {activeTab === 'tasks' && (
                <div className="space-y-2">
                  {details.recentTasks.length > 0 ? (
                    <>
                      <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-3">
                        Tasks ({details.recentTasks.length})
                      </h3>
                      {details.recentTasks.map((task) => (
                        <div key={task.id} className="bg-mission-control-bg rounded-lg p-3 hover:bg-mission-control-border/50 transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <div className="font-medium mb-1">{task.title}</div>
                              <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
                                <span className={`px-2 py-0.5 rounded ${
                                  task.status === 'done' ? 'bg-success-subtle text-success' :
                                  task.status === 'in-progress' ? 'bg-warning-subtle text-warning' :
                                  task.status === 'failed' ? 'bg-error-subtle text-error' :
                                  task.status === 'human-review' ? 'bg-warning-subtle text-warning' :
                                  'bg-mission-control-bg0/20 text-mission-control-text-dim'
                                }`}>
                                  {task.status}
                                </span>
                                {task.project && (
                                  <span className="px-2 py-0.5 bg-info-subtle text-info rounded">
                                    {task.project}
                                  </span>
                                )}
                                {task.completedAt > 0 && (
                                  <span>{new Date(task.completedAt).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            {task.outcome === 'success' ? (
                              <CheckCircle size={16} className="text-success flex-shrink-0" />
                            ) : task.outcome === 'failed' ? (
                              <XCircle size={16} className="text-error flex-shrink-0" />
                            ) : (
                              <Clock size={16} className="text-mission-control-text-dim flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-12 text-mission-control-text-dim">
                      <Activity size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No tasks assigned to {agent.name}</p>
                      <p className="text-xs">Assign tasks from the Kanban board</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Sessions Tab ── */}
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  <p className="text-sm text-mission-control-text-dim">
                    Gateway sessions associated with {agent.name}:
                  </p>
                  {details.activeSessions.length > 0 ? (
                    <div className="space-y-2">
                      {details.activeSessions.map((session) => (
                        <div key={session.key} className={`bg-mission-control-bg rounded-lg p-4 border ${
                          session.isActive ? 'border-success-border' : 'border-mission-control-border'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {session.isActive ? (
                                <Wifi size={16} className="text-success" />
                              ) : (
                                <WifiOff size={16} className="text-mission-control-text-dim" />
                              )}
                              <span className="font-medium text-sm">
                                {session.label || session.key.slice(0, 40)}
                              </span>
                              {session.isActive && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-success-subtle text-success rounded">Active</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs text-mission-control-text-dim">
                            <div>
                              <span className="block text-mission-control-text-dim/60">Model</span>
                              <span>{session.model.split('/').pop() || 'unknown'}</span>
                            </div>
                            <div>
                              <span className="block text-mission-control-text-dim/60">Tokens</span>
                              <span>{(session.tokens / 1000).toFixed(1)}k</span>
                            </div>
                            <div>
                              <span className="block text-mission-control-text-dim/60">Last Active</span>
                              <span>{session.updatedAt > 0 ? new Date(session.updatedAt).toLocaleString() : '—'}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-mission-control-border flex items-center justify-between">
                            <div className="text-[11px] text-mission-control-text-dim/60 truncate flex-1" title={session.key}>
                              {session.key}
                            </div>
                            <button
                              onClick={() => setViewingSessionKey(session.key)}
                              className="ml-2 px-3 py-1.5 text-xs bg-mission-control-accent/10 hover:bg-mission-control-accent/20 text-mission-control-accent rounded-lg flex items-center gap-1.5 transition-colors"
                            >
                              <MessageSquare size={12} />
                              View Chat
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-mission-control-text-dim">
                      <WifiOff size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No active sessions</p>
                      <p className="text-xs">Sessions appear when the agent is working on tasks</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Rules Tab ── */}
              {activeTab === 'rules' && (
                <div>
                  <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Agent Configuration
                  </h3>

                  {/* Brain notes */}
                  {details.brainNotes.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase mb-2 flex items-center gap-1">
                        <Brain size={14} /> Memory Files
                      </h4>
                      <div className="space-y-2">
                        {details.brainNotes.map((note, i) => (
                          <div key={`${note}-${i}`} className="bg-mission-control-bg rounded-lg p-3 text-sm">
                            <pre className="whitespace-pre-wrap font-mono text-xs">{note}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase mb-2">AGENTS.md</h4>
                  <div className="bg-mission-control-bg rounded-lg p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                      {details.agentRules || 'No AGENT.md file found'}
                    </pre>
                  </div>
                </div>
              )}

              {/* ── Soul Tab ── */}
              {activeTab === 'soul' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase mb-1 flex items-center gap-2">
                      <CalendarDays size={16} />
                      Soul File Editor
                    </h3>
                    <p className="text-xs text-mission-control-text-dim">
                      The soul file defines {agent.name}&apos;s identity, skills, and operating principles. Agents read this at startup.
                    </p>
                  </div>
                  <AgentSoulEditor agentId={agent.id} agentName={agent.name} />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-mission-control-text-dim">
              <XCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p>Failed to load agent details</p>
              <button type="button" onClick={buildDetailsFromRealData} className="mt-2 text-mission-control-accent hover:underline text-sm">
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Agent Chat Modal for viewing existing session */}
    {viewingSessionKey && (
      <AgentChatModal
        agentId={agentId}
        existingSessionKey={viewingSessionKey}
        onClose={() => setViewingSessionKey(null)}
      />
    )}
  </>
  );
}
