'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatTimeAgo } from '../../utils/formatting';
import {
  ArrowLeft, MessageSquare, LayoutGrid, Zap, FolderOpen, Bot,
  Settings, Users, Plus, Trash2, Target, Edit3, X,
  FileText, Image, File as FileIcon, Upload, RefreshCw,
  ChevronDown, ShieldAlert, ShieldCheck, Check, Flag,
  Activity, Calendar
} from 'lucide-react';
import { getProjectIcon } from './projectIcons';
import { projectsApi, agentApi } from '../../lib/api';
import type { Project, ProjectMember, ProjectFile, ProjectMilestone } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import { useChatRoomStore } from '../../store/chatRoomStore';
import ChatRoomView from '../ChatRoomView';
import ProjectDispatchModal from './ProjectDispatchModal';
import Kanban from '../Kanban';
import ProjectGanttView from '../ProjectGanttView';

type TabId = 'overview' | 'chat' | 'tasks' | 'automations' | 'approvals' | 'files' | 'timeline';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'overview',    label: 'Overview',    icon: LayoutGrid },
  { id: 'chat',        label: 'Chat',        icon: MessageSquare },
  { id: 'tasks',       label: 'Tasks',       icon: Flag },
  { id: 'timeline',    label: 'Timeline',    icon: Calendar },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'approvals',   label: 'Approvals',   icon: ShieldAlert },
  { id: 'files',       label: 'Files',       icon: FolderOpen },
];

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-success',  bg: 'bg-success-subtle' },
  paused:    { label: 'Paused',    color: 'text-warning',  bg: 'bg-warning-subtle' },
  completed: { label: 'Completed', color: 'text-info',     bg: 'bg-info-subtle' },
  archived:  { label: 'Archived',  color: 'text-mission-control-text-dim', bg: 'bg-mission-control-surface' },
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function fileIcon(type: string) {
  if (['png','jpg','jpeg','gif','svg','webp'].includes(type)) return Image;
  if (['md','txt','doc','pdf'].includes(type)) return FileText;
  return FileIcon;
}

// ─── Progress Ring ─────────────────────────────────────────────────────────────

function ProgressRing({
  percent,
  size = 60,
  stroke = 5,
  color = '#6366f1',
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-border, #2d2d3a)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
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

// ─── Overview Tab ──────────────────────────────────────────────────────────────

interface TaskActivityItem {
  id: number;
  taskId: string;
  agentId?: string;
  action: string;
  message: string;
  timestamp: number;
  taskTitle?: string;
}

function OverviewTab({
  project,
  members,
  onDispatch,
}: {
  project: Project;
  members: ProjectMember[];
  onDispatch: () => void;
}) {
  const [activity, setActivity] = useState<TaskActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [memberTaskCounts, setMemberTaskCounts] = useState<Record<string, number>>({});

  const totalTasks = (project as any).totalTasks ?? (project as any).taskCounts?.total ?? 0;
  const doneTasks = (project as any).doneTasks ?? (project as any).taskCounts?.done ?? 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  useEffect(() => {
    setActivityLoading(true);
    fetch(`/api/tasks?project_id=${project.id}&limit=20`)
      .then(r => r.json())
      .then(async (tasks: any[]) => {
        if (!Array.isArray(tasks)) return;
        // Compute per-member task counts
        const counts: Record<string, number> = {};
        for (const t of tasks) {
          if (t.assignedTo) counts[t.assignedTo] = (counts[t.assignedTo] ?? 0) + 1;
        }
        setMemberTaskCounts(counts);

        // Fetch recent activity across all project tasks
        const activityResults: TaskActivityItem[] = [];
        const recentTasks = tasks.slice(0, 8);
        await Promise.all(
          recentTasks.map(async (t: any) => {
            try {
              const acts = await fetch(`/api/tasks/${t.id}/activity?limit=3`).then(r => r.json());
              if (Array.isArray(acts)) {
                for (const a of acts) {
                  activityResults.push({ ...a, taskTitle: t.title });
                }
              }
            } catch { /* non-critical */ }
          })
        );
        activityResults.sort((a, b) => b.timestamp - a.timestamp);
        setActivity(activityResults.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setActivityLoading(false));
  }, [project.id]);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Goal + Ring */}
      <div className="flex items-start gap-5 p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
        <div className="flex flex-col items-center gap-1">
          <div className="relative">
            <ProgressRing percent={progress} size={72} stroke={6} color={project.color} />
            <div
              className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
              style={{ color: project.color }}
            >
              {progress}%
            </div>
          </div>
          <span className="text-xs text-mission-control-text-dim tabular-nums">{doneTasks}/{totalTasks}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Target size={13} className="text-mission-control-text-dim flex-shrink-0" />
            <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">Goal</span>
          </div>
          <p className="text-sm text-mission-control-text leading-relaxed">
            {project.goal || <span className="text-mission-control-text-dim italic">No goal set — add one in settings.</span>}
          </p>
          <button
            onClick={onDispatch}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium hover:bg-mission-control-accent/90 transition-colors"
          >
            <Bot size={12} /> Dispatch Agent
          </button>
        </div>
      </div>

      {/* Team */}
      {members.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Team</h3>
          <div className="grid grid-cols-2 gap-2">
            {members.map(m => (
              <div key={m.agentId} className="flex items-center gap-2.5 p-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg">
                <AgentAvatar agentId={m.agentId} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-mission-control-text truncate">
                    {(m as any).agentName || m.agentId}
                  </p>
                  <p className="text-xs text-mission-control-text-dim">
                    {memberTaskCounts[m.agentId] ?? 0} task{(memberTaskCounts[m.agentId] ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Recent Activity</h3>
        {activityLoading ? (
          <div className="flex items-center justify-center py-6"><Spinner size={14} /></div>
        ) : activity.length === 0 ? (
          <p className="text-xs text-mission-control-text-dim py-4 text-center">No activity yet — dispatch an agent to get started.</p>
        ) : (
          <div className="space-y-1.5">
            {activity.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg">
                <Activity size={12} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {a.taskTitle && (
                    <p className="text-xs text-mission-control-text-dim truncate mb-0.5">{a.taskTitle}</p>
                  )}
                  <p className="text-xs text-mission-control-text line-clamp-2">{a.message}</p>
                </div>
                <span className="text-xs text-mission-control-text-dim flex-shrink-0">{formatTimeAgo(a.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Milestones Section ────────────────────────────────────────────────────────

function MilestonesSection({ project }: { project: Project }) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.getMilestones(project.id);
      setMilestones(data);
    } catch {
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await projectsApi.createMilestone(project.id, {
        title: newTitle.trim(),
        dueDate: newDue ? new Date(newDue).getTime() : undefined,
      });
      setNewTitle('');
      setNewDue('');
      setAdding(false);
      await load();
      showToast('Milestone added', 'success');
    } catch {
      showToast('Failed to add milestone', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ms: ProjectMilestone) => {
    try {
      await projectsApi.updateMilestone(project.id, ms.id, { completed: !ms.completed });
      setMilestones(prev => prev.map(m =>
        m.id === ms.id ? { ...m, completed: ms.completed ? 0 : 1, completedAt: ms.completed ? undefined : Date.now() } : m
      ));
    } catch {
      showToast('Failed to update milestone', 'error');
    }
  };

  const handleDelete = async (ms: ProjectMilestone) => {
    try {
      await projectsApi.deleteMilestone(project.id, ms.id);
      setMilestones(prev => prev.filter(m => m.id !== ms.id));
    } catch {
      showToast('Failed to delete milestone', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">Milestones</h3>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent/80 transition-colors"
        >
          <Plus size={11} /> Add
        </button>
      </div>

      {adding && (
        <div className="mb-3 p-3 bg-mission-control-surface border border-mission-control-border rounded-lg space-y-2">
          <input
            type="text"
            placeholder="Milestone title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
            className="w-full text-xs px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
          />
          <input
            type="date"
            value={newDue}
            onChange={e => setNewDue(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent/50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
              className="flex-1 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors"
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewTitle(''); setNewDue(''); }}
              className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-xs hover:text-mission-control-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4"><Spinner size={12} /></div>
      ) : milestones.length === 0 ? (
        <p className="text-xs text-mission-control-text-dim py-2">No milestones yet.</p>
      ) : (
        <div className="relative pl-3 space-y-0">
          {/* Vertical timeline line */}
          <div className="absolute left-0 top-2 bottom-2 w-px bg-mission-control-border" />
          {milestones.map((ms, i) => {
            const overdue = ms.dueDate && !ms.completed && ms.dueDate < Date.now();
            return (
              <div key={ms.id} className="relative flex items-start gap-2.5 py-2">
                {/* Node */}
                <button
                  onClick={() => handleToggle(ms)}
                  className="relative z-10 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: ms.completed ? project.color : 'var(--color-border, #2d2d3a)',
                    backgroundColor: ms.completed ? project.color : 'var(--color-bg, #0e0e16)',
                    marginLeft: -8,
                  }}
                  title={ms.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {ms.completed && <Check size={8} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${ms.completed ? 'line-through text-mission-control-text-dim' : 'text-mission-control-text'}`}>
                    {ms.title}
                  </p>
                  {ms.dueDate && (
                    <p className={`text-xs mt-0.5 flex items-center gap-1 ${overdue ? 'text-error' : 'text-mission-control-text-dim'}`}>
                      <Calendar size={9} />
                      {new Date(ms.dueDate).toLocaleDateString()}
                      {overdue && ' — overdue'}
                    </p>
                  )}
                  {ms.completed && ms.completedAt && (
                    <p className="text-xs text-mission-control-text-dim mt-0.5">
                      Done {formatTimeAgo(ms.completedAt)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(ms)}
                  className="text-mission-control-text-dim hover:text-error transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Delete milestone"
                  tabIndex={0}
                  style={{ opacity: 0.5 }}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CONTEXT.md Inline Editor ──────────────────────────────────────────────────

function ContextEditor({ project }: { project: Project }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    projectsApi.getFiles(project.id).then((files: ProjectFile[]) => {
      const ctx = files.find(f => f.name === 'CONTEXT.md');
      if (ctx) {
        // Fetch actual content
        fetch(`/api/projects/${project.id}/files?name=CONTEXT.md`)
          .then(r => r.json())
          .then(d => setContent(d.content ?? ''))
          .catch(() => setContent(''))
          .finally(() => setLoading(false));
      } else {
        setContent('');
        setLoading(false);
      }
    }).catch(() => { setContent(''); setLoading(false); });
  }, [project.id]);

  const save = useCallback(async (value: string) => {
    setSaving(true);
    try {
      await projectsApi.uploadFile(project.id, 'CONTEXT.md', value);
      setLastSaved(Date.now());
    } catch {
      showToast('Failed to save CONTEXT.md', 'error');
    } finally {
      setSaving(false);
    }
  }, [project.id]);

  const handleChange = (value: string) => {
    setContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 1500);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(content);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">CONTEXT.md</h3>
        <span className="text-xs text-mission-control-text-dim">
          {saving ? 'Saving...' : lastSaved ? `Saved ${formatTimeAgo(lastSaved)}` : ''}
        </span>
      </div>
      <p className="text-xs text-mission-control-text-dim">
        This file is injected into every agent working on this project.
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={14} /></div>
      ) : (
        <textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
          rows={10}
          placeholder="# Project Context\n\nDescribe the project context, constraints, and background here..."
          className="w-full text-xs px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 resize-y font-mono leading-relaxed"
        />
      )}
    </div>
  );
}

// ─── Overview Sidebar (Milestones + Context) ────────────────────────────────────

function OverviewSidebar({ project }: { project: Project }) {
  return (
    <div className="w-72 flex-shrink-0 border-l border-mission-control-border overflow-y-auto p-5 space-y-6">
      <MilestonesSection project={project} />
      <ContextEditor project={project} />
    </div>
  );
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

function ChatTab({ project }: { project: Project }) {
  const { rooms, loadRooms, createRoom, setActiveRoom } = useChatRoomStore();
  const resolvedRoomIdRef = useRef<string | null>(null);
  const [roomsLoaded, setRoomsLoaded] = useState(false);

  useEffect(() => {
    loadRooms().then(() => setRoomsLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!roomsLoaded) return;
    if (resolvedRoomIdRef.current) {
      setActiveRoom(resolvedRoomIdRef.current);
      return;
    }
    const projectRoomId = `project-${project.id}`;
    const existing = rooms.find(r => r.id === projectRoomId);
    if (existing) {
      resolvedRoomIdRef.current = existing.id;
      setActiveRoom(existing.id);
    } else {
      const memberIds = (project.members ?? []).map((m: ProjectMember) => m.agentId);
      const newId = createRoom(project.name, memberIds);
      resolvedRoomIdRef.current = newId;
    }
  }, [roomsLoaded, rooms.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = resolvedRoomIdRef.current
    ? rooms.find(r => r.id === resolvedRoomIdRef.current)
    : null;

  if (!room) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChatRoomView roomId={room.id} onBack={() => {}} hideDelete hideHeader />
    </div>
  );
}

// ─── Automations Tab ──────────────────────────────────────────────────────────

interface ScheduledItem {
  id: string;
  type: string;
  content: string;
  scheduledFor: string;
  status: string;
  metadata: string;
}

function AutomationsTab({ project }: { project: Project }) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newSchedule, setNewSchedule] = useState('');
  const [newType, setNewType] = useState('task');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetch('/api/schedule').then(r => r.json()) as ScheduledItem[];
      const filtered = all.filter(i => {
        try {
          const meta = typeof i.metadata === 'string' ? JSON.parse(i.metadata) : i.metadata;
          return meta?.projectId === project.id;
        } catch { return false; }
      });
      setItems(filtered);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          content: newContent.trim(),
          scheduledFor: newSchedule || new Date(Date.now() + 3600_000).toISOString(),
          metadata: { projectId: project.id, projectName: project.name },
        }),
      });
      setNewContent('');
      setNewSchedule('');
      setShowForm(false);
      await load();
      showToast('Automation added', 'success');
    } catch {
      showToast('Failed to add automation', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <span className="text-xs text-mission-control-text-dim">{items.length} automation{items.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium hover:bg-mission-control-accent/90 transition-colors"
        >
          <Plus size={12} /> Add Automation
        </button>
      </div>
      {showForm && (
        <div className="max-w-2xl mx-auto w-full px-4 py-3 bg-mission-control-surface/50 border-b border-mission-control-border space-y-2">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none"
          >
            <option value="task">Task reminder</option>
            <option value="report">Report generation</option>
            <option value="review">Agent review</option>
            <option value="alert">Alert</option>
          </select>
          <input
            type="text"
            placeholder="Automation description..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none"
          />
          <input
            type="datetime-local"
            value={newSchedule}
            onChange={e => setNewSchedule(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="flex-1 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-xs hover:text-mission-control-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Spinner size={16} /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <Zap size={28} className="text-mission-control-text-dim" />
            <p className="text-sm font-medium text-mission-control-text-dim">No automations yet</p>
            <p className="text-xs text-mission-control-text-dim">Schedule reminders, reports, or agent reviews for this project.</p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <Zap size={14} className="text-mission-control-text-dim flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-mission-control-text truncate">{item.content}</p>
                  <p className="text-xs text-mission-control-text-dim">
                    {item.type} · {new Date(item.scheduledFor).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'done' ? 'bg-success-subtle text-success' :
                  item.status === 'failed' ? 'bg-error-subtle text-error' :
                  'bg-info-subtle text-info'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Approvals Tab ─────────────────────────────────────────────────────────────

interface ProjectApproval {
  id: string; type: string; title: string; content: string; context?: string;
  metadata?: Record<string, unknown>; status: string; requester?: string;
  createdAt: number; respondedAt?: number; notes?: string;
}

function ApprovalsTab({ project }: { project: Project }) {
  const [approvals, setApprovals] = useState<ProjectApproval[]>([]);
  const [tasks, setTasks] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [responding, setResponding] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allApprovals, projectTasks] = await Promise.all([
        fetch('/api/approvals?status=pending').then(r => r.json()),
        fetch(`/api/tasks?project_id=${project.id}`).then(r => r.json()),
      ]);
      const taskIds = new Set<string>(
        Array.isArray(projectTasks) ? projectTasks.map((t: { id: string }) => t.id) : []
      );
      setTasks(Array.isArray(projectTasks) ? projectTasks : []);
      const filtered = (Array.isArray(allApprovals) ? allApprovals : []).filter((a: ProjectApproval) => {
        const meta = a.metadata || {};
        return meta.projectId === project.id || taskIds.has(meta.taskId as string);
      });
      setApprovals(filtered);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [project.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const respond = async (id: string, action: 'approved' | 'rejected') => {
    setResponding(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: feedback[id] || undefined }),
      });
      setApprovals(prev => prev.filter(a => a.id !== id));
      setFeedback(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch { /* non-critical */ }
    finally { setResponding(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-mission-control-text-dim gap-2 text-sm">
        <Spinner size={16} /> Loading approvals...
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-mission-control-text-dim">
        <ShieldCheck size={28} />
        <p className="text-sm font-medium">No pending approvals</p>
        <p className="text-xs">Approvals for this project will appear here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-mission-control-border/40 overflow-y-auto">
      {approvals.map(a => {
        const isBusy = responding.has(a.id);
        const hasNote = (feedback[a.id] || '').trim().length > 0;
        const taskTitle = tasks.find((t: { id: string; title?: string } & { id: string }) => t.id === (a.metadata?.taskId as string | undefined))?.['title'] as string | undefined;
        return (
          <div key={a.id} className="px-5 py-4 space-y-3 border-l-2 border-warning/40">
            <div className="flex items-start gap-2">
              <Zap size={13} className="text-warning mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-mission-control-text-dim">
                  {a.requester && <span>{a.requester}</span>}
                  {taskTitle && <><span>·</span><span className="truncate">{taskTitle}</span></>}
                </div>
              </div>
            </div>
            <div className="text-xs text-mission-control-text bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2.5 whitespace-pre-wrap leading-relaxed">
              {a.content}
            </div>
            {a.context && (
              <div className="text-xs text-mission-control-text-dim bg-mission-control-border/20 rounded-lg px-3 py-2">
                {a.context}
              </div>
            )}
            <textarea
              value={feedback[a.id] || ''}
              onChange={e => setFeedback(prev => ({ ...prev, [a.id]: e.target.value }))}
              placeholder="Optional feedback or notes..."
              rows={2}
              className="w-full text-sm bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => respond(a.id, 'approved')}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-success text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {isBusy ? <Spinner size={12} /> : <Check size={12} />}
                {hasNote ? 'Approve with Feedback' : 'Approve & Continue'}
              </button>
              <button
                onClick={() => respond(a.id, 'rejected')}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-error-border bg-error-subtle text-error text-xs font-semibold hover:bg-error/20 disabled:opacity-50 transition-all"
              >
                {isBusy ? <Spinner size={12} /> : <X size={12} />}
                {hasNote ? 'Reject with Reason' : 'Reject'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Files & Memory Tab ────────────────────────────────────────────────────────

function FilesTab({ project }: { project: Project }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryResults, setMemoryResults] = useState<any[]>([]);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryUnavailable, setMemoryUnavailable] = useState(false);
  const [activeSection, setActiveSection] = useState<'files' | 'memory'>('files');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.getFiles(project.id);
      setFiles(data);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activeSection !== 'files') return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [activeSection, load]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      await projectsApi.uploadFile(project.id, file.name, text, 'utf-8');
      await load();
      showToast(`${file.name} uploaded`, 'success');
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleMemorySearch = async () => {
    if (!memoryQuery.trim()) return;
    setMemoryLoading(true);
    setMemoryUnavailable(false);
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(memoryQuery)}&limit=10`);
      const data = await res.json();
      if (data.searchUnavailable) {
        setMemoryUnavailable(true);
        setMemoryResults([]);
      } else {
        const raw = data.results ?? '';
        if (Array.isArray(raw)) {
          setMemoryResults(raw);
        } else if (typeof raw === 'string' && raw.trim()) {
          const entries = raw.split('\n\n---\n\n').map((chunk: string) => {
            const [firstLine, ...rest] = chunk.split('\n');
            return { path: firstLine, content: rest.join('\n').trim() };
          });
          setMemoryResults(entries);
        } else {
          setMemoryResults([]);
        }
      }
    } catch {
      setMemoryResults([]);
    } finally {
      setMemoryLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-3 border-b border-mission-control-border">
        <button
          onClick={() => setActiveSection('files')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${activeSection === 'files' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface'}`}
        >
          Files ({files.length})
        </button>
        <button
          onClick={() => setActiveSection('memory')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${activeSection === 'memory' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface'}`}
        >
          Memory Search
        </button>
        {activeSection === 'files' && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors"
              title="Refresh files"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <label className="flex items-center gap-1 px-2.5 py-1 bg-mission-control-accent text-white rounded-lg text-xs font-medium hover:bg-mission-control-accent/90 transition-colors cursor-pointer">
              <Upload size={12} /> {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        )}
      </div>

      {activeSection === 'files' && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Spinner size={16} /></div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <FolderOpen size={28} className="text-mission-control-text-dim" />
              <p className="text-sm font-medium text-mission-control-text-dim">No files yet</p>
              <p className="text-xs text-mission-control-text-dim">Upload files or agents will save outputs here.</p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-mission-control-border text-xs text-mission-control-text-dim uppercase tracking-wider">
                <span className="w-4" />
                <span className="flex-1">Name</span>
                <span className="w-20 text-right">Size</span>
                <span className="w-28 text-right">Modified</span>
              </div>
              <div className="divide-y divide-mission-control-border">
                {files.map(file => {
                  const Icon = fileIcon(file.type);
                  return (
                    <div key={file.name} className="flex items-center gap-3 px-4 py-3 hover:bg-mission-control-surface/50 transition-colors">
                      <Icon size={16} className="text-mission-control-text-dim flex-shrink-0" />
                      <p className="flex-1 min-w-0 text-sm text-mission-control-text truncate">{file.name}</p>
                      <span className="w-20 text-right text-xs text-mission-control-text-dim tabular-nums">{formatBytes(file.size)}</span>
                      <span className="w-28 text-right text-xs text-mission-control-text-dim">{formatTimeAgo(file.modifiedAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'memory' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-2 px-4 py-3 border-b border-mission-control-border">
            <input
              type="text"
              placeholder="Search project memory..."
              value={memoryQuery}
              onChange={e => setMemoryQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMemorySearch()}
              className="flex-1 text-sm px-3 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
            />
            <button
              onClick={handleMemorySearch}
              disabled={memoryLoading || !memoryQuery.trim()}
              className="px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors"
            >
              {memoryLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {memoryUnavailable ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <p className="text-sm text-warning font-medium mb-1">Search unavailable</p>
                <p className="text-xs text-mission-control-text-dim">
                  Install qmd for full-text search, or ensure ripgrep is available.
                </p>
              </div>
            ) : memoryResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-mission-control-text-dim">
                <p className="text-sm">Search the memory vault for project-related knowledge.</p>
              </div>
            ) : (
              <div className="divide-y divide-mission-control-border">
                {memoryResults.map((r, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-xs text-mission-control-text-dim mb-1">{r.path ?? r.source ?? 'Memory entry'}</p>
                    <p className="text-sm text-mission-control-text">{r.content ?? r.text ?? JSON.stringify(r)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Settings Popover ─────────────────────────────────────────────────

function ProjectSettings({
  project,
  onUpdated,
  onArchived,
}: {
  project: Project;
  onUpdated: (p: Project) => void;
  onArchived: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [goal, setGoal] = useState(project.goal ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await projectsApi.update(project.id, { name, goal });
      onUpdated(updated as Project);
      setEditing(false);
      showToast('Project updated', 'success');
    } catch {
      showToast('Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${project.name}"? It will be hidden from the active list.`)) return;
    try {
      await projectsApi.archive(project.id);
      onArchived();
      showToast('Project archived', 'success');
    } catch {
      showToast('Archive failed', 'error');
    }
  };

  if (!editing) {
    return (
      <div className="absolute right-0 top-full mt-1 w-48 bg-mission-control-bg border border-mission-control-border rounded-lg shadow-xl z-20 py-1 overflow-hidden">
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <Edit3 size={14} /> Edit details
        </button>
        <button
          onClick={handleArchive}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-error-subtle transition-colors"
        >
          <Trash2 size={14} /> Archive project
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-mission-control-bg border border-mission-control-border rounded-lg shadow-xl z-20 p-4 space-y-3">
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 block">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent/50"
        />
      </div>
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><Target size={10} /> Goal</label>
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent/50 resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-xs hover:text-mission-control-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Kanban with Click-to-Advance ──────────────────────────────────────────────
// Wrap Kanban — intercept task status badge clicks to cycle status

const TASK_STATUS_CYCLE: Record<string, string> = {
  'todo': 'in-progress',
  'in-progress': 'review',
  'review': 'done',
};

function KanbanWithAdvance({ project, onDispatch }: { project: Project; onDispatch: () => void }) {
  const [advancingTask, setAdvancingTask] = useState<string | null>(null);

  // We expose an advance handler that Kanban can call via a custom event
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ taskId: string; currentStatus: string }>;
      const { taskId, currentStatus } = e.detail;
      const nextStatus = TASK_STATUS_CYCLE[currentStatus];
      if (!nextStatus || advancingTask) return;
      setAdvancingTask(taskId);
      fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
        .then(() => {
          showToast(`Task moved to ${nextStatus}`, 'success');
          window.dispatchEvent(new CustomEvent('kanban-refresh'));
        })
        .catch(() => showToast('Failed to advance task', 'error'))
        .finally(() => setAdvancingTask(null));
    };
    window.addEventListener('advance-task-status', handler);
    return () => window.removeEventListener('advance-task-status', handler);
  }, [advancingTask]);

  return (
    <Kanban
      projectId={project.id}
      projectName={project.name}
      onNewTask={onDispatch}
    />
  );
}

// ─── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ project }: { project: Project }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProjectGanttView projectId={project.id} projectName={project.name} />
    </div>
  );
}

// ─── Main Workspace ────────────────────────────────────────────────────────────

interface ProjectWorkspaceProps {
  project: Project;
  onBack: () => void;
  onUpdated: () => void;
}

export default function ProjectWorkspace({ project: initialProject, onBack, onUpdated }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>(initialProject.members ?? []);
  const [agents, setAgents] = useState<any[]>([]);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [addingAgent, setAddingAgent] = useState<string | null>(null);
  const { updateRoomAgents } = useChatRoomStore();
  const projectRoomId = `project-${project.id}`;

  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;

  useEffect(() => {
    projectsApi.get(project.id).then(data => {
      setProject(data as Project);
      const loadedMembers = (data as any).members ?? [];
      setMembers(loadedMembers);
      updateRoomAgents(projectRoomId, loadedMembers.map((m: ProjectMember) => m.agentId));
    }).catch(() => {});
    agentApi.getAll().then(setAgents).catch(() => {});
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddMember = async (agentId: string) => {
    setAddingAgent(agentId);
    try {
      await projectsApi.addMember(project.id, agentId);
      const updated = await projectsApi.get(project.id);
      const newMembers = (updated as any).members ?? [];
      setMembers(newMembers);
      updateRoomAgents(projectRoomId, newMembers.map((m: ProjectMember) => m.agentId));
      showToast('Agent added to project', 'success');
    } catch {
      showToast('Failed to add agent', 'error');
    } finally {
      setAddingAgent(null);
    }
  };

  const handleRemoveMember = async (agentId: string) => {
    try {
      await projectsApi.removeMember(project.id, agentId);
      setMembers(prev => {
        const next = prev.filter(m => m.agentId !== agentId);
        updateRoomAgents(projectRoomId, next.map(m => m.agentId));
        return next;
      });
    } catch {
      showToast('Failed to remove agent', 'error');
    }
  };

  const handleProjectUpdated = (updated: Project) => {
    setProject(updated);
    onUpdated();
  };

  const memberAgentIds = new Set(members.map(m => m.agentId));
  const availableAgents = agents.filter(a => !memberAgentIds.has(a.id) && a.status !== 'archived');

  return (
    <div className="flex flex-col h-full bg-mission-control-bg0">
      {/* Workspace Header */}
      <div className="bg-mission-control-surface border-b border-mission-control-border">
        {/* Breadcrumb + members + actions */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors flex-shrink-0"
            >
              <ArrowLeft size={14} /> Projects
            </button>
            <span className="text-mission-control-text-dim flex-shrink-0">/</span>
            <span className="text-sm font-medium text-mission-control-text flex items-center gap-1.5 truncate">
              {(() => { const BcIcon = getProjectIcon(project.emoji); return <BcIcon size={14} style={{ color: project.color }} />; })()}
              {project.name}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${sc.bg} ${sc.color}`}>{sc.label}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Member avatars */}
            <div className="flex items-center -space-x-1.5">
              {members.slice(0, 5).map(m => (
                <AgentAvatar
                  key={m.agentId}
                  agentId={m.agentId}
                  size="xs"
                  className="ring-1 ring-mission-control-surface"
                />
              ))}
            </div>
            <button
              onClick={() => setShowMemberPanel(v => !v)}
              className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface px-2 py-1 rounded-lg transition-colors"
            >
              <Users size={12} /> {members.length}
              <ChevronDown size={10} />
            </button>
            <div className="w-px h-4 bg-mission-control-border" />
            <button
              onClick={() => setShowDispatch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-xs font-medium"
            >
              <Bot size={13} /> Dispatch Agent
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSettings(v => !v)}
                className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors"
              >
                <Settings size={15} />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
                  <ProjectSettings
                    project={project}
                    onUpdated={p => { handleProjectUpdated(p); setShowSettings(false); }}
                    onArchived={() => { setShowSettings(false); onBack(); }}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Member panel dropdown */}
        {showMemberPanel && (
          <div className="px-4 pb-3 border-t border-mission-control-border pt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map(m => (
                <div key={m.agentId} className="flex items-center gap-1.5 bg-mission-control-surface border border-mission-control-border rounded-full px-2 py-1">
                  <AgentAvatar agentId={m.agentId} size="xs" />
                  <span className="text-xs text-mission-control-text">{(m as any).agentName || m.agentId}</span>
                  <button
                    onClick={() => handleRemoveMember(m.agentId)}
                    className="text-mission-control-text-dim hover:text-error transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {availableAgents.length > 0 && (
                <div className="relative">
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) handleAddMember(e.target.value); e.target.value = ''; }}
                    className="text-xs px-2 py-1 bg-mission-control-accent/20 border border-mission-control-accent/40 text-mission-control-accent rounded-full focus:outline-none cursor-pointer"
                    disabled={!!addingAgent}
                  >
                    <option value="" disabled>+ Add agent</option>
                    {availableAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ` : ''}{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex border-t border-mission-control-border overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-mission-control-accent text-mission-control-accent'
                    : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <Icon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="flex h-full">
            <OverviewTab project={project} members={members} onDispatch={() => setShowDispatch(true)} />
            <OverviewSidebar project={project} />
          </div>
        )}
        {activeTab === 'chat'        && <ChatTab project={project} />}
        {activeTab === 'tasks'       && <KanbanWithAdvance project={project} onDispatch={() => setShowDispatch(true)} />}
        {activeTab === 'timeline'    && <TimelineTab project={project} />}
        {activeTab === 'automations' && <AutomationsTab project={project} />}
        {activeTab === 'approvals'   && <ApprovalsTab project={project} />}
        {activeTab === 'files'       && <FilesTab project={project} />}
      </div>

      {/* Dispatch modal */}
      {showDispatch && (
        <ProjectDispatchModal
          project={project}
          members={members}
          onClose={() => setShowDispatch(false)}
          onDispatched={() => { setShowDispatch(false); showToast('Task dispatched', 'success'); }}
        />
      )}
    </div>
  );
}
