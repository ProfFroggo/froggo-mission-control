'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatTimeAgo } from '../../utils/formatting';
import {
  FolderKanban, Plus, Search, RefreshCw, Archive,
  CheckCircle2, Clock, AlertCircle, ChevronRight,
  Users, Zap, LayoutGrid, List, BarChart3, TrendingUp, RotateCcw,
} from 'lucide-react';
import { Button, IconButton, TextField, Flex } from '@radix-ui/themes';
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

// ─── Health Ring ───────────────────────────────────────────────────────────────

function HealthRing({ score, size = 36 }: { score: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 80 ? 'var(--color-success, #22c55e)' :
    score >= 60 ? 'var(--color-warning, #f59e0b)' :
    'var(--color-error, #ef4444)';
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
      aria-label={`Health score ${score} out of 100`}
    >
      <title>{`Health: ${score}/100`}</title>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--color-border, #2d2d3a)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ points, color = '#6366f1', width = 64, height = 24 }: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map(v => height - ((v - min) / range) * (height - 4) - 2);
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} aria-hidden="true">
      <polyline
        points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={xs[xs.length - 1]}
        cy={ys[ys.length - 1]}
        r={2}
        fill={color}
      />
    </svg>
  );
}

// ─── Enriched project type ─────────────────────────────────────────────────────

interface ProjectWithStats {
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
  lastTaskActivity?: number;
  memberCount?: number;
}

type EnrichedProject = Project & ProjectWithStats & {
  healthScore?: number;
  activitySpark?: number[];
};

// ─── Sparkline helper ──────────────────────────────────────────────────────────

function makeSparkline(project: EnrichedProject): number[] {
  // Synthesise a 14-day activity curve from available stats
  // In production this would come from the API; here we generate a plausible curve
  const done = project.doneTasks ?? 0;
  const total = project.totalTasks ?? 0;
  const progress = total > 0 ? done / total : 0;
  // Simple deterministic curve seeded by project id characters
  const seed = project.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 14 }, (_, i) => {
    const base = progress * 100;
    const wave = Math.sin((i + seed) * 0.8) * 10;
    return Math.max(0, Math.min(100, base + wave));
  });
}

function computeHealthScore(project: EnrichedProject): number {
  const totalTasks = project.totalTasks ?? 0;
  const doneTasks = project.doneTasks ?? 0;
  const lastActivity = Number(project.lastTaskActivity) || project.updatedAt;
  const now = Date.now();
  const ageMs = now - lastActivity;

  const completionScore = totalTasks > 0 ? (doneTasks / totalTasks) * 40 : 20;

  const h24 = 24 * 60 * 60 * 1000;
  let recencyScore = 40;
  if (ageMs > h24 * 3) recencyScore = 20;
  if (ageMs > h24 * 7) recencyScore = 10;
  if (ageMs > h24 * 14) recencyScore = 0;

  const memberCount = project.memberCount ?? (project.members?.length ?? 0);
  const teamScore = memberCount > 0 ? 20 : 5;

  return Math.min(100, Math.round(completionScore + recencyScore + teamScore));
}

// ─── Stats Strip ───────────────────────────────────────────────────────────────

interface StatsStripProps {
  projects: EnrichedProject[];
}

function StatsStrip({ projects }: StatsStripProps) {
  const total = projects.length;
  const active = projects.filter(p => p.status === 'active').length;

  // Overdue: active projects with no task activity for 7+ days
  const now = Date.now();
  const overdue = projects.filter(p => {
    if (p.status !== 'active') return false;
    const last = Number(p.lastTaskActivity) || p.updatedAt;
    return now - last > 7 * 24 * 60 * 60 * 1000;
  }).length;

  // Done this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const doneThisMonth = projects.filter(p => p.status === 'completed' && p.updatedAt >= startOfMonth.getTime()).length;

  // Avg health
  const scores = projects.filter(p => p.status !== 'archived').map(p => computeHealthScore(p));
  const avgHealth = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // Top performing agent: most doneTasks across projects
  const agentDone: Record<string, number> = {};
  projects.forEach(p => {
    (p.members ?? []).forEach(m => {
      agentDone[m.agentId] = (agentDone[m.agentId] ?? 0) + (p.doneTasks ?? 0);
    });
  });
  const topAgentId = Object.keys(agentDone).sort((a, b) => agentDone[b] - agentDone[a])[0];

  const chips = [
    { label: 'Total', value: total, icon: FolderKanban, color: 'text-mission-control-text' },
    { label: 'Active', value: active, icon: CheckCircle2, color: 'text-success' },
    { label: 'Overdue', value: overdue, icon: AlertCircle, color: overdue > 0 ? 'text-error' : 'text-mission-control-text-dim' },
    { label: 'Done / mo', value: doneThisMonth, icon: TrendingUp, color: 'text-info' },
    { label: 'Avg health', value: `${avgHealth}%`, icon: BarChart3, color: avgHealth >= 70 ? 'text-success' : avgHealth >= 40 ? 'text-warning' : 'text-error' },
  ];

  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b border-mission-control-border overflow-x-auto">
      {chips.map(chip => {
        const Icon = chip.icon;
        return (
          <div
            key={chip.label}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-mission-control-surface border border-mission-control-border text-xs whitespace-nowrap"
          >
            <Icon size={11} className={chip.color} />
            <span className="text-mission-control-text-dim">{chip.label}</span>
            <span className={`font-semibold ${chip.color}`}>{chip.value}</span>
          </div>
        );
      })}
      {topAgentId && (
        <Flex align="center" gap="2" className="px-3 py-1 rounded-full bg-mission-control-surface border border-mission-control-border text-xs whitespace-nowrap">
          <Users size={11} className="text-mission-control-accent" />
          <span className="text-mission-control-text-dim">Top agent</span>
          <AgentAvatar agentId={topAgentId} size="xs" />
          <span className="font-semibold text-mission-control-accent">{agentDone[topAgentId]} tasks</span>
        </Flex>
      )}
    </div>
  );
}

// ─── Project Card ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: EnrichedProject;
  onClick: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}

function ProjectCard({ project, onClick, onArchive, onRestore }: ProjectCardProps) {
  const sc = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const StatusIcon = sc.icon;
  const totalTasks = project.totalTasks ?? 0;
  const doneTasks = project.doneTasks ?? 0;
  const inProgressTasks = project.inProgressTasks ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const lastActivity = Number(project.lastTaskActivity) || project.updatedAt;
  const health = computeHealthScore(project);
  const spark = makeSparkline(project);
  const sparkColor = health >= 80 ? 'var(--color-success, #22c55e)' : health >= 60 ? 'var(--color-warning, #f59e0b)' : 'var(--color-error, #ef4444)';

  // Cap members at 3 + overflow
  const displayedMembers = (project.members ?? []).slice(0, 3);
  const overflowCount = (project.memberCount ?? (project.members?.length ?? 0)) - displayedMembers.length;

  const isArchived = project.status === 'archived';

  return (
    <div className="group relative w-full bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent/50 transition-all duration-200">
      {/* Quick-action overlay (visible on hover) */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 z-10">
        {!isArchived && onArchive && (
          <IconButton
            size="1"
            variant="ghost"
           
            onClick={e => { e.stopPropagation(); onArchive(); }}
            title="Archive project"
          >
            <Archive size={12} />
          </IconButton>
        )}
        {isArchived && onRestore && (
          <IconButton
            size="1"
            variant="ghost"
           
            onClick={e => { e.stopPropagation(); onRestore(); }}
            title="Restore project"
          >
            <RotateCcw size={12} />
          </IconButton>
        )}
        <IconButton
          size="1"
          variant="ghost"
         
          onClick={e => { e.stopPropagation(); onClick(); }}
          title="Open project"
        >
          <ChevronRight size={12} />
        </IconButton>
      </div>

      <Button
        onClick={onClick}
        variant="ghost"
        style={{ width: '100%', textAlign: 'left', padding: '1.25rem', borderRadius: '0.5rem', display: 'block', height: 'auto' }}
      >
        {/* Header */}
        <Flex align="start" gap="3" className="mb-3 pr-14">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20`, border: `1px solid ${project.color}40` }}
          >
            {(() => { const ProjIcon = getProjectIcon(project.emoji); return <ProjIcon size={18} style={{ color: project.color }} />; })()}
          </div>
          <div className="min-w-0 flex-1">
            <Flex align="center" gap="2">
              <h3 className="font-semibold text-mission-control-text truncate group-hover:text-mission-control-accent transition-colors">
                {project.name}
              </h3>
            </Flex>
            {project.description && (
              <p className="text-xs text-mission-control-text-dim truncate mt-0.5">{project.description}</p>
            )}
          </div>
        </Flex>

        {/* Status badge */}
        <Flex align="center" gap="2" className="mb-3">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
            <StatusIcon size={10} />
            {sc.label}
          </span>
        </Flex>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="mb-3">
            <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-1 tabular-nums">
              <span>{doneTasks}/{totalTasks} tasks</span>
              <span>{progress}%</span>
            </Flex>
            <div className="h-1.5 bg-mission-control-bg0 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: project.color }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <Flex align="center" justify="between">
          {/* Agent avatars (max 3 + overflow) */}
          <div className="flex items-center -space-x-1.5">
            {displayedMembers.map(m => (
              <AgentAvatar
                key={m.agentId}
                agentId={m.agentId}
                fallbackEmoji={(m as any).agentEmoji}
                size="xs"
                className="ring-1 ring-mission-control-bg0"
              />
            ))}
            {overflowCount > 0 && (
              <div className="w-5 h-5 rounded-full bg-mission-control-surface border border-mission-control-border flex items-center justify-center text-[10px] text-mission-control-text-dim ring-1 ring-mission-control-bg0">
                +{overflowCount}
              </div>
            )}
            {(!project.members || project.members.length === 0) && (
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                <Users size={11} /> No agents
              </span>
            )}
          </div>

          {/* Stats */}
          <Flex align="center" gap="3" className="text-xs text-mission-control-text-dim">
            {inProgressTasks > 0 && (
              <span className="flex items-center gap-1 text-warning">
                <Zap size={11} /> {inProgressTasks} active
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={11} /> {formatTimeAgo(lastActivity)}
            </span>
          </Flex>
        </Flex>
      </Button>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyProjects({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-surface border border-mission-control-border flex items-center justify-center mb-4">
        <FolderKanban size={28} className="text-mission-control-text-dim" />
      </div>
      <h3 className="text-lg font-semibold text-mission-control-text mb-2">No projects yet</h3>
      <p className="text-sm text-mission-control-text-dim max-w-xs mb-6">
        Create a project to organise tasks, chats, automations, and files around a shared goal.
      </p>
      <Button onClick={onNew} size="2" variant="solid">
        <Plus size={16} /> New Project
      </Button>
    </div>
  );
}

// ─── Tab view type ─────────────────────────────────────────────────────────────

type TabView = 'active' | 'archived';

// ─── Main Panel ────────────────────────────────────────────────────────────────

export default function ProjectsPanel() {
  const [projects, setProjects] = useState<EnrichedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tabView, setTabView] = useState<TabView>('active');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [activeData, archivedData] = await Promise.all([
        projectsApi.list(statusFilter !== 'all' ? { status: statusFilter } : {}),
        projectsApi.list({ status: 'archived' }),
      ]);
      const merged: EnrichedProject[] = [
        ...(activeData as EnrichedProject[]),
        ...(archivedData as EnrichedProject[]).filter(
          (p: EnrichedProject) => !(activeData as EnrichedProject[]).find((a: EnrichedProject) => a.id === p.id)
        ),
      ];
      setProjects(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleArchive = useCallback(async (project: EnrichedProject) => {
    try {
      await projectsApi.archiveProject(project.id);
      showToast(`"${project.name}" archived`, 'success');
      load(false);
    } catch {
      showToast('Failed to archive project', 'error');
    }
  }, [load]);

  const handleRestore = useCallback(async (project: EnrichedProject) => {
    try {
      await projectsApi.restoreProject(project.id);
      showToast(`"${project.name}" restored`, 'success');
      load(false);
    } catch {
      showToast('Failed to restore project', 'error');
    }
  }, [load]);

  const nonArchivedProjects = projects.filter(p => p.status !== 'archived');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  const visibleProjects = (tabView === 'archived' ? archivedProjects : nonArchivedProjects).filter(p => {
    if (tabView === 'active' && statusFilter !== 'all' && p.status !== statusFilter) return false;
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
    <Flex direction="column" height="100%" className="bg-mission-control-bg0">
      {/* Header */}
      <Flex align="center" justify="between" className="px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" gap="3">
          <div className="p-2 bg-mission-control-accent/20 rounded-lg">
            <FolderKanban size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-mission-control-text">Projects</h1>
            <p className="text-sm text-mission-control-text-dim">{nonArchivedProjects.filter(p => p.status === 'active').length} active</p>
          </div>
        </Flex>
        <Flex align="center" gap="2">
          <IconButton
            onClick={() => load(false)}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh projects"
            size="2"
            variant="ghost"
           
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </IconButton>
          <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List view"
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
              }`}
            >
              <List size={14} />
            </button>
          </div>
          <Button onClick={() => setShowCreateWizard(true)} size="2" variant="solid">
            <Plus size={15} /> New Project
          </Button>
        </Flex>
      </Flex>


      {/* Tab strip */}
      <Flex gap="1" className="px-6 border-b border-mission-control-border">
        <button
          type="button"
          onClick={() => setTabView('active')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 -mb-px text-sm font-medium transition-colors ${
            tabView === 'active'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          Active ({nonArchivedProjects.length})
        </button>
        <button
          type="button"
          onClick={() => setTabView('archived')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 -mb-px text-sm font-medium transition-colors ${
            tabView === 'archived'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <Archive size={13} />
          Archived ({archivedProjects.length})
        </button>
      </Flex>

      {/* Filters (only for active tab) */}
      {tabView === 'active' && (
        <Flex align="center" gap="3" className="px-6 py-3 border-b border-mission-control-border">
          <div className="flex-1 max-w-xs">
            <TextField.Root
              aria-label="Search projects"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="2"
            >
              <TextField.Slot>
                <Search size={14} />
              </TextField.Slot>
            </TextField.Root>
          </div>
          <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
            {(['all', 'active', 'paused', 'completed'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
                }`}
              >
                {s === 'all' ? `All (${nonArchivedProjects.length})` : s}
              </button>
            ))}
          </div>
        </Flex>
      )}

      {/* Archived search */}
      {tabView === 'archived' && (
        <Flex align="center" gap="3" className="px-6 py-3 border-b border-mission-control-border">
          <div className="flex-1 max-w-xs">
            <TextField.Root
              aria-label="Search archived projects"
              placeholder="Search archived..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="2"
            >
              <TextField.Slot>
                <Search size={14} />
              </TextField.Slot>
            </TextField.Root>
          </div>
        </Flex>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <Flex align="center" justify="center" className="py-16">
            <Spinner size={24} />
          </Flex>
        )}

        {error && !loading && (
          <Flex align="center" gap="2" className="px-4 py-3 bg-error-subtle border border-error/30 rounded-lg text-error text-sm">
            <AlertCircle size={15} />
            {error}
          </Flex>
        )}

        {!loading && !error && visibleProjects.length === 0 && (
          tabView === 'archived' ? (
            <div className="text-center py-16 text-mission-control-text-dim text-sm">
              {search ? `No archived projects matching "${search}"` : 'No archived projects'}
            </div>
          ) : search ? (
            <div className="text-center py-16 text-mission-control-text-dim text-sm">
              No projects matching &quot;{search}&quot;
            </div>
          ) : (
            <EmptyProjects onNew={() => setShowCreateWizard(true)} />
          )
        )}

        {!loading && !error && visibleProjects.length > 0 && (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
            : 'flex flex-col gap-3'
          }>
            {visibleProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => setSelectedProject(p)}
                onArchive={p.status !== 'archived' ? () => handleArchive(p) : undefined}
                onRestore={p.status === 'archived' ? () => handleRestore(p) : undefined}
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
    </Flex>
  );
}
