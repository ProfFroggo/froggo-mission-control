'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo } from '../../utils/formatting';
import {
  FolderKanban, Plus, Search, RefreshCw, Archive,
  CheckCircle2, Clock, AlertCircle, ChevronRight,
  Users, Zap, LayoutGrid, List
} from 'lucide-react';
import { getProjectIcon } from './projectIcons';
import { projectsApi } from '../../lib/api';
import type { Project } from '../../types/projects';
import { Spinner } from '../LoadingStates';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import ProjectCreationWizard from './ProjectCreationWizard';
import ProjectWorkspace from './ProjectWorkspace';

// Status config
const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-success',  bg: 'bg-success-subtle border-success-border',   icon: CheckCircle2 },
  paused:    { label: 'Paused',    color: 'text-warning',  bg: 'bg-warning-subtle border-warning-border',   icon: Clock },
  completed: { label: 'Completed', color: 'text-info',     bg: 'bg-info-subtle border-info-border',         icon: CheckCircle2 },
  archived:  { label: 'Archived',  color: 'text-mission-control-text-dim', bg: 'bg-mission-control-surface border-mission-control-border', icon: Archive },
} as const;

// ─── Health Score ──────────────────────────────────────────────────────────────

interface ProjectWithStats {
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
  lastTaskActivity?: number;
  memberCount?: number;
}

function computeHealthScore(project: Project & ProjectWithStats): number {
  const totalTasks = project.totalTasks ?? 0;
  const doneTasks = project.doneTasks ?? 0;
  const lastActivity = Number(project.lastTaskActivity) || project.updatedAt;
  const now = Date.now();
  const ageMs = now - lastActivity;

  // Sub-score 1: completion rate (0–40 pts)
  const completionScore = totalTasks > 0 ? (doneTasks / totalTasks) * 40 : 20;

  // Sub-score 2: recency (0–40 pts)
  const h24 = 24 * 60 * 60 * 1000;
  let recencyScore = 40;
  if (ageMs > h24 * 3) recencyScore = 20;
  if (ageMs > h24 * 7) recencyScore = 10;
  if (ageMs > h24 * 14) recencyScore = 0;

  // Sub-score 3: team (0–20 pts) — penalise empty team
  const memberCount = project.memberCount ?? (project.members?.length ?? 0);
  const teamScore = memberCount > 0 ? 20 : 5;

  return Math.min(100, Math.round(completionScore + recencyScore + teamScore));
}

function HealthDot({ score }: { score: number }) {
  const color =
    score >= 70 ? 'var(--color-success, #22c55e)' :
    score >= 40 ? 'var(--color-warning, #f59e0b)' :
    'var(--color-error, #ef4444)';
  return (
    <span
      title={`Health: ${score}/100`}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

// ─── Project Card ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project & ProjectWithStats;
  onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const StatusIcon = sc.icon;
  const totalTasks = project.totalTasks ?? 0;
  const doneTasks = project.doneTasks ?? 0;
  const inProgressTasks = project.inProgressTasks ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const lastActivity = Number(project.lastTaskActivity) || project.updatedAt;
  const health = computeHealthScore(project);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-mission-control-surface border border-mission-control-border rounded-xl p-5 hover:border-mission-control-accent/50 hover:bg-mission-control-surface/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mission-control-accent/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20`, border: `1px solid ${project.color}40` }}
          >
            {(() => { const ProjIcon = getProjectIcon(project.emoji); return <ProjIcon size={18} style={{ color: project.color }} />; })()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-mission-control-text-primary truncate group-hover:text-mission-control-accent transition-colors">
                {project.name}
              </h3>
              <HealthDot score={health} />
            </div>
            {project.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
            <StatusIcon size={10} />
            {sc.label}
          </span>
          <ChevronRight size={14} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
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
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: project.color }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Agent avatars */}
        <div className="flex items-center -space-x-1.5">
          {(project.members ?? []).slice(0, 4).map(m => (
            <AgentAvatar
              key={m.agentId}
              agentId={m.agentId}
              fallbackEmoji={(m as any).agentEmoji}
              size="xs"
              className="ring-1 ring-mission-control-bg0"
            />
          ))}
          {(project.memberCount ?? 0) > 4 && (
            <div className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border flex items-center justify-center text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
              +{(project.memberCount as number) - 4}
            </div>
          )}
          {(!project.members || project.members.length === 0) && (
            <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
              <Users size={11} /> No agents assigned
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
          {inProgressTasks > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <Zap size={11} /> {inProgressTasks} active
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} /> {formatTimeAgo(lastActivity)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

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
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
      >
        <Plus size={16} /> New Project
      </button>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export default function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await projectsApi.list(params);
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = projects.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || (p.goal ?? '').toLowerCase().includes(q);
  });

  const handleProjectCreated = (project: Project) => {
    setShowCreateWizard(false);
    load(false);
    showToast(`Project "${project.name}" created`, 'success');
    setSelectedProject(project);
  };

  const handleProjectUpdated = () => {
    load(false);
  };

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
            <p className="text-sm text-mission-control-text-dim">{projects.filter(p => p.status === 'active').length} active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="p-2 rounded-lg text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface transition-colors"
            title="Refresh"
            aria-label="Refresh projects"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowCreateWizard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
          >
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-mission-control-border">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input
            type="text"
            aria-label="Search projects"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'active', 'paused', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'
              }`}
            >
              {s === 'all' ? `All (${projects.filter(p => p.status !== 'archived').length})` : s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 px-4 py-3 bg-error-subtle border border-error/30 rounded-lg text-error text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          search ? (
            <div className="text-center py-16 text-mission-control-text-dim text-sm">
              No projects matching &quot;{search}&quot;
            </div>
          ) : (
            <EmptyProjects onNew={() => setShowCreateWizard(true)} />
          )
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
            : 'flex flex-col gap-3'
          }>
            {filtered.map(p => (
              <ProjectCard
                key={p.id}
                project={p as any}
                onClick={() => setSelectedProject(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create wizard */}
      {showCreateWizard && (
        <ProjectCreationWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
