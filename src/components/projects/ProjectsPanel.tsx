'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban, Plus, Search, RefreshCw, Archive,
  CheckCircle2, Clock, AlertCircle, ChevronRight,
  Users, FileText, Zap, MessageSquare, LayoutGrid, List
} from 'lucide-react';
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

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

interface ProjectCardProps {
  project: Project & {
    memberCount?: number;
    totalTasks?: number;
    doneTasks?: number;
    inProgressTasks?: number;
    todoTasks?: number;
    lastTaskActivity?: number;
  };
  onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const StatusIcon = sc.icon;
  const totalTasks = (project.totalTasks as number) ?? 0;
  const doneTasks = (project.doneTasks as number) ?? 0;
  const inProgressTasks = (project.inProgressTasks as number) ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const lastActivity = Number(project.lastTaskActivity) || project.updatedAt;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-mission-control-surface border border-mission-control-border rounded-xl p-5 hover:border-mission-control-accent/50 hover:bg-mission-control-surface/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mission-control-accent/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: `${project.color}20`, border: `1px solid ${project.color}40` }}
          >
            {project.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-mission-control-text-primary truncate group-hover:text-mission-control-accent transition-colors">
              {project.name}
            </h3>
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
          <div className="h-1.5 bg-mission-control-bg1 rounded-full overflow-hidden">
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
          {(project.memberCount as number ?? 0) > 4 && (
            <div className="w-5 h-5 rounded-full bg-mission-control-bg1 border border-mission-control-border flex items-center justify-center text-xs text-mission-control-text-dim ring-1 ring-mission-control-bg0">
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
            <Clock size={11} /> {formatRelativeTime(lastActivity)}
          </span>
        </div>
      </div>
    </button>
  );
}

// Empty state
function EmptyProjects({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-surface border border-mission-control-border flex items-center justify-center mb-4">
        <FolderKanban size={28} className="text-mission-control-text-dim" />
      </div>
      <h3 className="text-lg font-semibold text-mission-control-text-primary mb-2">No projects yet</h3>
      <p className="text-sm text-mission-control-text-dim max-w-xs mb-6">
        Create a project to organize tasks, chats, automations, and files around a shared goal.
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
    showToast(`Project "${project.name}" created!`, 'success');
    setSelectedProject(project);
  };

  const handleProjectUpdated = () => {
    load(false);
  };

  // If a project is selected, show its workspace
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border bg-mission-control-surface/50">
        <div className="flex items-center gap-3">
          <FolderKanban size={20} className="text-mission-control-accent" />
          <div>
            <h1 className="text-base font-semibold text-mission-control-text-primary">Projects</h1>
            <p className="text-xs text-mission-control-text-dim">{projects.filter(p => p.status === 'active').length} active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="p-2 rounded-lg text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1'}`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1'}`}
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
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-mission-control-bg1 border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
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
                  : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1'
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
              No projects matching "{search}"
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
