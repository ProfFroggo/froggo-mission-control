'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo } from '../../utils/formatting';
import {
  FolderKanban, Plus, Search, RefreshCw, Archive,
  CheckCircle2, Clock, AlertCircle, ChevronRight,
  Users, Zap, LayoutGrid, List, BarChart3, TrendingUp,
  RotateCcw
} from 'lucide-react';
import { getProjectIcon } from './projectIcons';
import { projectsApi } from '../../lib/api';
import type { Project } from '../../types/projects';
import { Spinner } from '../LoadingStates';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import ProjectCreationWizard from './ProjectCreationWizard';
import ProjectWorkspace from './ProjectWorkspace';

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-success',  bg: 'bg-success-subtle border-success-border',   icon: CheckCircle2 },
  paused:    { label: 'Paused',    color: 'text-warning',  bg: 'bg-warning-subtle border-warning-border',   icon: Clock },
  completed: { label: 'Completed', color: 'text-info',     bg: 'bg-info-subtle border-info-border',         icon: CheckCircle2 },
  archived:  { label: 'Archived',  color: 'text-mission-control-text-dim', bg: 'bg-mission-control-surface border-mission-control-border', icon: Archive },
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectWithStats {
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
  lastTaskActivity?: number;
  memberCount?: number;
}

type EnrichedProject = Project & ProjectWithStats;

// ─── Health Score ────────────────────────────────────────────────────────────

function computeHealthScore(project: EnrichedProject): number {
  const totalTasks   = project.totalTasks ?? 0;
  const doneTasks    = project.doneTasks  ?? 0;
  const lastActivity = Number(project.lastTaskActivity) || project.updatedAt;
  const now          = Date.now();
  const ageMs        = now - lastActivity;

  // Completion (0–40)
  const completionScore = totalTasks > 0 ? (doneTasks / totalTasks) * 40 : 20;

  // Recency (0–40)
  const d = 24 * 60 * 60 * 1000;
  let recencyScore = 40;
  if (ageMs > d * 3)  recencyScore = 20;
  if (ageMs > d * 7)  recencyScore = 10;
  if (ageMs > d * 14) recencyScore = 0;

  // Team (0–20)
  const members = project.memberCount ?? (project.members?.length ?? 0);
  const teamScore = members > 0 ? 20 : 5;

  return Math.min(100, Math.round(completionScore + recencyScore + teamScore));
}

// ─── Health Ring (SVG) ───────────────────────────────────────────────────────

function HealthRing({ score, size = 40, stroke = 3 }: { score: number; size?: number; stroke?: number }) {
  const r     = (size - stroke * 2) / 2;
  const circ  = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 80 ? 'var(--color-success, #22c55e)' :
    score >= 60 ? 'var(--color-warning, #f59e0b)' :
                  'var(--color-error, #ef4444)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} title={`Health: ${score}/100`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border, #2d2d3a)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color, lineHeight: 1,
      }}>
        {score}
      </div>
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 52; const h = 18;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.65} />
    </svg>
  );
}

function makeSparkline(project: EnrichedProject): number[] {
  const doneTasks = project.doneTasks ?? 0;
  const points: number[] = [];
  for (let i = 0; i < 14; i++) {
    const frac = i / 13;
    const base = doneTasks > 0 ? Math.round(doneTasks * frac * frac) : 0;
    const jitter = Math.round(Math.sin(i * 0.9 + (project.id?.charCodeAt(0) ?? 0)) * 0.5);
    points.push(Math.max(0, base + jitter));
  }
  return points;
}

// ─── Stats Strip ─────────────────────────────────────────────────────────────

function StatsStrip({ projects }: { projects: EnrichedProject[] }) {
  const visible = projects.filter(p => p.status !== 'archived');
  const now     = Date.now();

  const active   = visible.filter(p => p.status === 'active').length;
  const overdue  = visible.filter(p => {
    const last = Number(p.lastTaskActivity) || p.updatedAt;
    return p.status === 'active' && (now - last) > 14 * 86_400_000;
  }).length;
  const completedThisMonth = visible.filter(p => {
    if (p.status !== 'completed') return false;
    const d = new Date(p.updatedAt); const n = new Date(now);
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const avgHealth = visible.length > 0
    ? Math.round(visible.reduce((s, p) => s + computeHealthScore(p), 0) / visible.length)
    : 0;

  // Top performing agent
  const agentTasks: Record<string, number> = {};
  for (const p of visible) {
    for (const m of p.members ?? []) {
      agentTasks[m.agentId] = (agentTasks[m.agentId] ?? 0) + (p.doneTasks ?? 0);
    }
  }
  const topAgentId   = Object.keys(agentTasks).sort((a, b) => agentTasks[b] - agentTasks[a])[0] ?? null;
  const topAgentName = topAgentId
    ? (visible.flatMap(p => p.members ?? []).find(m => m.agentId === topAgentId)?.agentName ?? 'Agent')
    : null;

  const chips = [
    { label: 'Total',           value: visible.length,       Icon: FolderKanban, color: 'var(--color-text-dim)' },
    { label: 'Active',          value: active,               Icon: TrendingUp,   color: 'var(--color-success, #22c55e)' },
    { label: 'Overdue',         value: overdue,              Icon: AlertCircle,  color: overdue > 0 ? 'var(--color-error, #ef4444)' : 'var(--color-text-dim)' },
    { label: 'Done this month', value: completedThisMonth,   Icon: CheckCircle2, color: 'var(--color-info, #06b6d4)' },
    { label: 'Avg health',      value: avgHealth,            Icon: BarChart3,
      color: avgHealth >= 70 ? 'var(--color-success, #22c55e)' : avgHealth >= 40 ? 'var(--color-warning, #f59e0b)' : 'var(--color-error, #ef4444)' },
  ];

  return (
    <div className="flex items-center gap-1.5 px-6 py-2 border-b border-mission-control-border bg-mission-control-surface/50 overflow-x-auto">
      {chips.map(({ label, value, Icon, color }) => (
        <div key={label}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-mission-control-surface border border-mission-control-border flex-shrink-0">
          <Icon size={11} style={{ color }} />
          <span className="text-xs font-bold text-mission-control-text-primary">{value}</span>
          <span className="text-xs text-mission-control-text-dim">{label}</span>
        </div>
      ))}
      {topAgentName && topAgentId && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-mission-control-surface border border-mission-control-border flex-shrink-0 ml-auto">
          <TrendingUp size={11} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs text-mission-control-text-dim">Top agent:</span>
          <AgentAvatar agentId={topAgentId} size="xs" />
          <span className="text-xs font-medium text-mission-control-text-primary">{topAgentName}</span>
        </div>
      )}
    </div>
  );
}

// ─── Project Card ────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: EnrichedProject;
  onClick: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  isArchived?: boolean;
}

function ProjectCard({ project, onClick, onArchive, onRestore, isArchived }: ProjectCardProps) {
  const [hovering, setHovering] = useState(false);

  const sc              = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const StatusIcon      = sc.icon;
  const totalTasks      = project.totalTasks      ?? 0;
  const doneTasks       = project.doneTasks       ?? 0;
  const inProgressTasks = project.inProgressTasks ?? 0;
  const progress        = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const lastActivity    = Number(project.lastTaskActivity) || project.updatedAt;
  const health          = computeHealthScore(project);
  const sparkData       = makeSparkline(project);
  const memberList      = project.members ?? [];
  const overflow        = Math.max(0, memberList.length - 3);

  return (
    <div
      className="group relative w-full bg-mission-control-surface border border-mission-control-border rounded-xl p-5 hover:border-mission-control-accent/50 hover:bg-mission-control-surface/80 transition-all duration-200"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Quick-action overlay (hover) */}
      {hovering && (
        <div className="absolute top-3 right-3 flex items-center gap-0.5 z-10 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg p-0.5">
          <button onClick={e => { e.stopPropagation(); onClick(); }}
            className="p-1.5 rounded text-mission-control-text-dim hover:text-mission-control-accent hover:bg-mission-control-surface transition-colors"
            title="Open" aria-label="Open project">
            <ChevronRight size={13} />
          </button>
          {!isArchived && onArchive && (
            <button onClick={e => { e.stopPropagation(); onArchive(); }}
              className="p-1.5 rounded text-mission-control-text-dim hover:text-warning hover:bg-warning-subtle transition-colors"
              title="Archive" aria-label="Archive project">
              <Archive size={13} />
            </button>
          )}
          {isArchived && onRestore && (
            <button onClick={e => { e.stopPropagation(); onRestore(); }}
              className="p-1.5 rounded text-mission-control-text-dim hover:text-success hover:bg-success-subtle transition-colors"
              title="Restore" aria-label="Restore project">
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      )}

      <button onClick={onClick} className="w-full text-left focus:outline-none focus:ring-2 focus:ring-mission-control-accent/30 rounded-lg">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20`, border: `1px solid ${project.color}40` }}>
            {(() => { const I = getProjectIcon(project.emoji); return <I size={18} style={{ color: project.color }} />; })()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-mission-control-text-primary truncate group-hover:text-mission-control-accent transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <HealthRing score={health} size={40} stroke={3} />
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
              <StatusIcon size={10} />
              {sc.label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
              <span>{doneTasks}/{totalTasks} tasks</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-mission-control-surface rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: project.color }} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Member avatars: up to 3 + overflow */}
          <div className="flex items-center -space-x-1.5">
            {memberList.slice(0, 3).map(m => (
              <AgentAvatar key={m.agentId} agentId={m.agentId}
                fallbackEmoji={(m as any).agentEmoji} size="xs"
                className="ring-1 ring-mission-control-bg0" />
            ))}
            {overflow > 0 && (
              <div className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border flex items-center justify-center text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
                +{overflow}
              </div>
            )}
            {memberList.length === 0 && (
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                <Users size={11} /> No agents
              </span>
            )}
          </div>

          {/* Sparkline + last active */}
          <div className="flex items-center gap-2">
            <Sparkline data={sparkData} color={project.color} />
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
              {inProgressTasks > 0 && (
                <span className="flex items-center gap-1 text-warning">
                  <Zap size={11} /> {inProgressTasks}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={11} /> {formatTimeAgo(lastActivity)}
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyProjects({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-surface border border-mission-control-border flex items-center justify-center mb-4">
        <FolderKanban size={28} className="text-mission-control-text-dim" />
      </div>
      <h3 className="text-lg font-semibold text-mission-control-text-primary mb-2">No projects yet</h3>
      <p className="text-sm text-mission-control-text-dim max-w-xs mb-6">
        Create a project to organise tasks, chats, automations, and files around a shared goal.
      </p>
      <button onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium">
        <Plus size={16} /> New Project
      </button>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type TabView = 'active' | 'archived';

export default function ProjectsPanel() {
  const [projects, setProjects]         = useState<EnrichedProject[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid');
  const [tabView, setTabView]           = useState<TabView>('active');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedProject, setSelectedProject]   = useState<Project | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await projectsApi.list() as EnrichedProject[];
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeProjects   = projects.filter(p => p.status !== 'archived');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const filteredActive = activeProjects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || (p.goal ?? '').toLowerCase().includes(q);
  });

  const filteredArchived = archivedProjects.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || (p.goal ?? '').toLowerCase().includes(q);
  });

  const displayedProjects = tabView === 'active' ? filteredActive : filteredArchived;

  const handleArchive = async (project: EnrichedProject) => {
    try {
      await projectsApi.archiveProject(project.id);
      showToast(`"${project.name}" archived`, 'success');
      load(false);
    } catch {
      showToast('Failed to archive project', 'error');
    }
  };

  const handleRestore = async (project: EnrichedProject) => {
    try {
      await projectsApi.restoreProject(project.id);
      showToast(`"${project.name}" restored`, 'success');
      setTabView('active');
      load(false);
    } catch {
      showToast('Failed to restore project', 'error');
    }
  };

  const handleProjectCreated = (project: Project) => {
    setShowCreateWizard(false);
    load(false);
    showToast(`Project "${project.name}" created`, 'success');
    setSelectedProject(project);
  };

  const handleProjectUpdated = () => { load(false); };

  if (selectedProject) {
    return (
      <ProjectWorkspace
        project={selectedProject}
        onBack={() => { setSelectedProject(null); load(false); }}
        onUpdated={handleProjectUpdated}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mission-control-accent/20 rounded-xl">
            <FolderKanban size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-mission-control-text">Projects</h1>
            <p className="text-sm text-mission-control-text-dim">
              {activeProjects.filter(p => p.status === 'active').length} active
              {archivedProjects.length > 0 && ` · ${archivedProjects.length} archived`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(false)} disabled={refreshing}
            className="p-2 rounded-lg text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface transition-colors"
            title="Refresh" aria-label="Refresh projects">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
              title="Grid view"><LayoutGrid size={14} /></button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
              title="List view"><List size={14} /></button>
          </div>
          <button onClick={() => setShowCreateWizard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium">
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && projects.length > 0 && <StatsStrip projects={projects} />}

      {/* Tab bar + filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-mission-control-border">
        <div className="flex items-center gap-1 border-r border-mission-control-border pr-3 mr-1">
          <button onClick={() => setTabView('active')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full transition-colors ${tabView === 'active' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}>
            <FolderKanban size={11} /> Projects
          </button>
          <button onClick={() => setTabView('archived')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full transition-colors ${tabView === 'archived' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}>
            <Archive size={11} /> Archived {archivedProjects.length > 0 && `(${archivedProjects.length})`}
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input type="text" aria-label="Search projects" placeholder="Search projects..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50" />
        </div>

        {tabView === 'active' && (
          <div className="flex items-center gap-1">
            {(['all', 'active', 'paused', 'completed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${statusFilter === s ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}>
                {s === 'all' ? `All (${activeProjects.length})` : s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16"><Spinner size={24} /></div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-4 py-3 bg-error-subtle border border-error/30 rounded-lg text-error text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {!loading && !error && tabView === 'archived' && archivedProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-mission-control-surface border border-mission-control-border flex items-center justify-center mb-4">
              <Archive size={24} className="text-mission-control-text-dim" />
            </div>
            <h3 className="text-base font-semibold text-mission-control-text-primary mb-1">No archived projects</h3>
            <p className="text-sm text-mission-control-text-dim">Archived projects will appear here.</p>
          </div>
        )}

        {!loading && !error && tabView === 'active' && displayedProjects.length === 0 && (
          search
            ? <div className="text-center py-16 text-mission-control-text-dim text-sm">No projects matching &quot;{search}&quot;</div>
            : <EmptyProjects onNew={() => setShowCreateWizard(true)} />
        )}

        {!loading && !error && displayedProjects.length > 0 && (
          <>
            {tabView === 'archived' && (
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-mission-control-border">
                <Archive size={14} className="text-mission-control-text-dim" />
                <span className="text-sm text-mission-control-text-dim">
                  {filteredArchived.length} archived project{filteredArchived.length !== 1 ? 's' : ''} — restore to make active again
                </span>
              </div>
            )}
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
            }>
              {displayedProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onClick={() => setSelectedProject(p)}
                  onArchive={tabView === 'active' ? () => handleArchive(p) : undefined}
                  onRestore={tabView === 'archived' ? () => handleRestore(p) : undefined}
                  isArchived={tabView === 'archived'}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showCreateWizard && (
        <ProjectCreationWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
