'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatTimeAgo } from '../../utils/formatting';
import {
  ArrowLeft, MessageSquare, LayoutGrid, Zap, FolderOpen, Bot,
  Settings, Users, Plus, Trash2, Target, Edit3, X,
  FileText, Image, File as FileIcon, Upload,
  ChevronDown, ShieldAlert, ShieldCheck, Check
} from 'lucide-react';
import { getProjectIcon } from './projectIcons';
import { projectsApi, agentApi } from '../../lib/api';
import type { Project, ProjectMember, ProjectFile } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import { useChatRoomStore } from '../../store/chatRoomStore';
import ChatRoomView from '../ChatRoomView';
import ProjectDispatchModal from './ProjectDispatchModal';
import Kanban from '../Kanban';

type TabId = 'chat' | 'tasks' | 'automations' | 'approvals' | 'files';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat',        label: 'Chat',        icon: MessageSquare },
  { id: 'tasks',       label: 'Tasks',       icon: LayoutGrid },
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
    // Already resolved a room this mount — just keep it active
    if (resolvedRoomIdRef.current) {
      setActiveRoom(resolvedRoomIdRef.current);
      return;
    }
    // Project rooms are always created with id `project-{projectId}`
    const projectRoomId = `project-${project.id}`;
    const existing = rooms.find(r => r.id === projectRoomId);
    if (existing) {
      resolvedRoomIdRef.current = existing.id;
      setActiveRoom(existing.id);
    } else {
      // Rooms loaded but none found — create once with project members
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
      <ChatRoomView roomId={room.id} onBack={() => {}} />
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
            className="w-full text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none"
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
            className="w-full text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none"
          />
          <input
            type="datetime-local"
            value={newSchedule}
            onChange={e => setNewSchedule(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none"
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
      <div className="flex items-center justify-center h-32 text-mission-control-text-dim gap-2 text-sm">
        <Spinner size={12} />Loading approvals…
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-mission-control-text-dim">
        <ShieldCheck size={28} className="opacity-30" />
        <p className="text-sm">No pending approvals for this project</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-mission-control-border/40">
      {approvals.map(a => {
        const isBusy = responding.has(a.id);
        const hasNote = (feedback[a.id] || '').trim().length > 0;
        const taskTitle = tasks.find((t: { id: string; title?: string } & { id: string }) => t.id === (a.metadata?.taskId as string | undefined))?.['title'] as string | undefined;
        return (
          <div key={a.id} className="px-5 py-4 space-y-3 border-l-2 border-orange-400/40">
            <div className="flex items-start gap-2">
              <Zap size={13} className="text-orange-400 mt-0.5 shrink-0" />
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
              placeholder="Optional feedback or notes…"
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
      const res = await fetch(
        `/api/memory/search?q=${encodeURIComponent(memoryQuery)}&limit=10`
      );
      const data = await res.json();
      if (data.searchUnavailable) {
        setMemoryUnavailable(true);
        setMemoryResults([]);
      } else {
        // results may be a raw string (qmd/rg output) or an array
        const raw = data.results ?? '';
        if (Array.isArray(raw)) {
          setMemoryResults(raw);
        } else if (typeof raw === 'string' && raw.trim()) {
          // Split by separator used for ripgrep/grep fallbacks
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
      {/* Section toggle */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-mission-control-border">
        <button
          onClick={() => setActiveSection('files')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${activeSection === 'files' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
        >
          Files ({files.length})
        </button>
        <button
          onClick={() => setActiveSection('memory')}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${activeSection === 'memory' ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}
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
                        {formatBytes(file.size)} · {formatTimeAgo(file.modifiedAt)}
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
              className="flex-1 text-sm px-3 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
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
                  <br />
                  <span className="font-mono text-mission-control-text-dim/80">brew install profroggo/tap/qmd</span>
                  <br />
                  See Settings for more options.
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
          className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50"
        />
      </div>
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><Target size={10} /> Goal</label>
        <textarea
          value={goal}
          onChange={e => setGoal(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50 resize-none"
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
            <span className="text-sm font-medium text-mission-control-text-primary flex items-center gap-1.5">
              {(() => { const BcIcon = getProjectIcon(project.emoji); return <BcIcon size={14} style={{ color: project.color }} />; })()}
              {project.name}
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
                className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface rounded-lg transition-colors"
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
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${project.color}20`, border: `2px solid ${project.color}40` }}
          >
            {(() => { const WsIcon = getProjectIcon(project.emoji); return <WsIcon size={22} style={{ color: project.color }} />; })()}
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
              className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface px-2 py-1 rounded transition-colors"
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
                <div key={m.agentId} className="flex items-center gap-1.5 bg-mission-control-surface border border-mission-control-border rounded-full px-2 py-1">
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
        {activeTab === 'tasks'       && <Kanban projectId={project.id} projectName={project.name} onNewTask={() => setShowDispatch(true)} />}
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
          onDispatched={() => { setShowDispatch(false); showToast('Task dispatched!', 'success'); }}
        />
      )}
    </div>
  );
}
