'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MessageSquare, LayoutGrid, Zap, FolderOpen, Bot,
  Settings, Users, Plus, Trash2, Target, Edit3, Check, X,
  Clock, AlertCircle, CheckCircle2, Play, MoreHorizontal,
  FileText, Image, File as FileIcon, Upload, Download,
  Calendar, RefreshCw, ChevronDown
} from 'lucide-react';
import { projectsApi, taskApi, agentApi } from '../../lib/api';
import type { Project, ProjectMember, ProjectFile } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import { useChatRoomStore } from '../../store/chatRoomStore';
import ChatRoomView from '../ChatRoomView';
import ProjectDispatchModal from './ProjectDispatchModal';

type TabId = 'chat' | 'tasks' | 'automations' | 'files';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat',        label: 'Chat',        icon: MessageSquare },
  { id: 'tasks',       label: 'Tasks',       icon: LayoutGrid },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'files',       label: 'Files',       icon: FolderOpen },
];

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-success',  bg: 'bg-success-subtle' },
  paused:    { label: 'Paused',    color: 'text-warning',  bg: 'bg-warning-subtle' },
  completed: { label: 'Completed', color: 'text-info',     bg: 'bg-info-subtle' },
  archived:  { label: 'Archived',  color: 'text-mission-control-text-dim', bg: 'bg-mission-control-surface' },
} as const;

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'blocked':        { label: 'Blocked',         color: 'text-error',   bg: 'bg-error-subtle' },
  'todo':           { label: 'To Do',            color: 'text-info',    bg: 'bg-info-subtle' },
  'in-progress':    { label: 'In Progress',      color: 'text-warning', bg: 'bg-warning-subtle' },
  'internal-review':{ label: 'Internal Review',  color: 'text-review',  bg: 'bg-review-subtle' },
  'review':         { label: 'Agent Review',     color: 'text-review',  bg: 'bg-review-subtle' },
  'human-review':   { label: 'Human Review',     color: 'text-warning', bg: 'bg-warning-subtle' },
  'done':           { label: 'Done',             color: 'text-success', bg: 'bg-success-subtle' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function fileIcon(type: string) {
  if (['png','jpg','jpeg','gif','svg','webp'].includes(type)) return Image;
  if (['md','txt','doc','pdf'].includes(type)) return FileText;
  return FileIcon;
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────

function ChatTab({ project }: { project: Project }) {
  const { rooms, loadRooms, createRoom, setActiveRoom } = useChatRoomStore();
  const roomId = `project-${project.id}`;

  useEffect(() => {
    loadRooms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      // Room might not exist in store yet — create it
      const memberIds = (project.members ?? []).map((m: ProjectMember) => m.agentId);
      createRoom(roomId.replace('project-', ''), memberIds);
    }
    setActiveRoom(roomId);
  }, [rooms.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = rooms.find(r => r.id === roomId);

  if (!room) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChatRoomView roomId={roomId} onBack={() => {}} />
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  updatedAt: number;
}

function TasksTab({ project, onDispatch }: { project: Project; onDispatch: () => void }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await taskApi.getAll({ project: project.name });
      const byId = await taskApi.getAll().catch(() => all);
      // Filter by project_id (new FK) OR project name (legacy)
      const filtered = all.filter((t: any) =>
        t.project_id === project.id || t.project === project.name
      );
      setTasks(filtered);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [project.id, project.name]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);
  const openCount = tasks.filter(t => !['done','cancelled'].includes(t.status)).length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-mission-control-text-dim">{tasks.length} tasks</span>
          <span className="text-xs text-success">{doneCount} done</span>
          <span className="text-xs text-warning">{openCount} open</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-2 py-1 bg-mission-control-bg1 border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none"
          >
            <option value="all">All statuses</option>
            {Object.entries(TASK_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={onDispatch}
            className="flex items-center gap-1 px-2.5 py-1 bg-mission-control-accent text-white rounded text-xs font-medium hover:bg-mission-control-accent/90 transition-colors"
          >
            <Plus size={12} /> New Task
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size={16} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <LayoutGrid size={24} className="text-mission-control-text-dim mb-2" />
            <p className="text-sm text-mission-control-text-dim">No tasks yet</p>
            <button
              onClick={onDispatch}
              className="mt-3 text-xs text-mission-control-accent hover:underline"
            >
              Dispatch an agent to start work
            </button>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border">
            {filtered.map(task => {
              const sc = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.todo;
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-mission-control-surface/50 transition-colors">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color} border border-current/20 whitespace-nowrap`}>
                    {sc.label}
                  </span>
                  <span className="flex-1 text-sm text-mission-control-text-primary truncate">{task.title}</span>
                  {task.assignedTo && (
                    <AgentAvatar agentId={task.assignedTo} size="xs" />
                  )}
                  <span className="text-xs text-mission-control-text-dim whitespace-nowrap">
                    {formatRelativeTime(task.updatedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      // Filter by project metadata
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
          className="flex items-center gap-1 px-2.5 py-1 bg-mission-control-accent text-white rounded text-xs font-medium hover:bg-mission-control-accent/90 transition-colors"
        >
          <Plus size={12} /> Add Automation
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-4 py-3 bg-mission-control-surface/50 border-b border-mission-control-border space-y-2">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-bg1 border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none"
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
            className="w-full text-xs px-2 py-1.5 bg-mission-control-bg1 border border-mission-control-border rounded text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none"
          />
          <input
            type="datetime-local"
            value={newSchedule}
            onChange={e => setNewSchedule(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-bg1 border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="flex-1 py-1 bg-mission-control-accent text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1 border border-mission-control-border text-mission-control-text-dim rounded text-xs hover:text-mission-control-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size={16} /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Zap size={24} className="text-mission-control-text-dim mb-2" />
            <p className="text-sm text-mission-control-text-dim">No automations yet</p>
            <p className="text-xs text-mission-control-text-dim mt-1">Schedule reminders, reports, or agent reviews for this project.</p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <Zap size={14} className="text-mission-control-text-dim flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-mission-control-text-primary truncate">{item.content}</p>
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

// ─── Files & Memory Tab ────────────────────────────────────────────────────────

function FilesTab({ project }: { project: Project }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryResults, setMemoryResults] = useState<any[]>([]);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
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
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: memoryQuery, limit: 10 }),
      });
      const data = await res.json();
      setMemoryResults(Array.isArray(data) ? data : data.results ?? []);
    } catch {
      setMemoryResults([]);
    } finally {
      setMemoryLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Section toggle */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-mission-control-border">
        <button
          onClick={() => setActiveSection('files')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${activeSection === 'files' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1'}`}
        >
          Files ({files.length})
        </button>
        <button
          onClick={() => setActiveSection('memory')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${activeSection === 'memory' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1'}`}
        >
          Memory Search
        </button>
        {activeSection === 'files' && (
          <label className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-mission-control-accent text-white rounded text-xs font-medium hover:bg-mission-control-accent/90 transition-colors cursor-pointer">
            <Upload size={12} /> {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {/* Files section */}
      {activeSection === 'files' && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Spinner size={16} /></div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen size={24} className="text-mission-control-text-dim mb-2" />
              <p className="text-sm text-mission-control-text-dim">No files yet</p>
              <p className="text-xs text-mission-control-text-dim mt-1">Upload files or agents will save outputs here.</p>
            </div>
          ) : (
            <div className="divide-y divide-mission-control-border">
              {files.map(file => {
                const Icon = fileIcon(file.type);
                return (
                  <div key={file.name} className="flex items-center gap-3 px-4 py-3 hover:bg-mission-control-surface/50 transition-colors">
                    <Icon size={16} className="text-mission-control-text-dim flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-mission-control-text-primary truncate">{file.name}</p>
                      <p className="text-xs text-mission-control-text-dim">
                        {formatBytes(file.size)} · {formatRelativeTime(file.modifiedAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Memory section */}
      {activeSection === 'memory' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-2 px-4 py-3 border-b border-mission-control-border">
            <input
              type="text"
              placeholder="Search project memory..."
              value={memoryQuery}
              onChange={e => setMemoryQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMemorySearch()}
              className="flex-1 text-sm px-3 py-1.5 bg-mission-control-bg1 border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
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
            {memoryResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-mission-control-text-dim">
                <p className="text-sm">Search the memory vault for project-related knowledge.</p>
              </div>
            ) : (
              <div className="divide-y divide-mission-control-border">
                {memoryResults.map((r, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-xs text-mission-control-text-dim mb-1">{r.path ?? r.source ?? 'Memory entry'}</p>
                    <p className="text-sm text-mission-control-text-primary">{r.content ?? r.text ?? JSON.stringify(r)}</p>
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
      <div className="absolute right-0 top-full mt-1 w-48 bg-mission-control-bg border border-mission-control-border rounded-xl shadow-xl z-20 py-1 overflow-hidden">
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mission-control-text-primary hover:bg-mission-control-surface transition-colors"
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
    <div className="absolute right-0 top-full mt-1 w-72 bg-mission-control-bg border border-mission-control-border rounded-xl shadow-xl z-20 p-4 space-y-3">
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 block">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-bg1 border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50"
        />
      </div>
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><Target size={10} /> Goal</label>
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-bg1 border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50 resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 bg-mission-control-accent text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded text-xs hover:text-mission-control-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
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
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>(initialProject.members ?? []);
  const [agents, setAgents] = useState<any[]>([]);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [addingAgent, setAddingAgent] = useState<string | null>(null);

  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;

  useEffect(() => {
    // Load full project with members
    projectsApi.get(project.id).then(data => {
      setProject(data as Project);
      setMembers((data as any).members ?? []);
    }).catch(() => {});
    // Load all agents for member management
    agentApi.getAll().then(setAgents).catch(() => {});
  }, [project.id]);

  const handleAddMember = async (agentId: string) => {
    setAddingAgent(agentId);
    try {
      await projectsApi.addMember(project.id, agentId);
      const updated = await projectsApi.get(project.id);
      setMembers((updated as any).members ?? []);
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
      setMembers(prev => prev.filter(m => m.agentId !== agentId));
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
        {/* Breadcrumb + actions */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-mission-control-text-dim hover:text-mission-control-text-primary transition-colors"
            >
              <ArrowLeft size={14} /> Projects
            </button>
            <span className="text-mission-control-text-dim">/</span>
            <span className="text-sm font-medium text-mission-control-text-primary">
              {project.emoji} {project.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDispatch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-xs font-medium"
            >
              <Bot size={13} /> Dispatch Agent
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSettings(v => !v)}
                className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1 rounded-lg transition-colors"
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

        {/* Project identity */}
        <div className="flex items-center gap-4 px-4 pb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: `${project.color}20`, border: `2px solid ${project.color}40` }}
          >
            {project.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-mission-control-text-primary">{project.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
            </div>
            {project.goal && (
              <p className="text-xs text-mission-control-text-dim mt-0.5 flex items-center gap-1">
                <Target size={10} /> {project.goal}
              </p>
            )}
          </div>

          {/* Member avatars */}
          <div className="flex items-center gap-2 flex-shrink-0">
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
              className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-bg1 px-2 py-1 rounded transition-colors"
            >
              <Users size={12} /> {members.length}
              <ChevronDown size={10} />
            </button>
          </div>
        </div>

        {/* Member panel dropdown */}
        {showMemberPanel && (
          <div className="px-4 pb-3 border-t border-mission-control-border pt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map(m => (
                <div key={m.agentId} className="flex items-center gap-1.5 bg-mission-control-bg1 border border-mission-control-border rounded-full px-2 py-1">
                  <AgentAvatar agentId={m.agentId} size="xs" />
                  <span className="text-xs text-mission-control-text-primary">{(m as any).agentName || m.agentId}</span>
                  <button
                    onClick={() => handleRemoveMember(m.agentId)}
                    className="text-mission-control-text-dim hover:text-error transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {/* Add agent dropdown */}
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
        <div className="flex border-t border-mission-control-border">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-mission-control-accent text-mission-control-accent'
                    : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text-primary'
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
        {activeTab === 'chat'        && <ChatTab project={project} />}
        {activeTab === 'tasks'       && <TasksTab project={project} onDispatch={() => { setShowDispatch(true); }} />}
        {activeTab === 'automations' && <AutomationsTab project={project} />}
        {activeTab === 'files'       && <FilesTab project={project} />}
      </div>

      {/* Dispatch modal */}
      {showDispatch && (
        <ProjectDispatchModal
          project={project}
          members={members}
          onClose={() => setShowDispatch(false)}
          onDispatched={() => { setShowDispatch(false); showToast('Task dispatched!', 'success'); }}
        />
      )}
    </div>
  );
}
