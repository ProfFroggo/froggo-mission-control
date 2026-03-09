import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, ShieldX, Clock, RefreshCw,
  Check, X, ChevronDown, ChevronUp, User, MessageSquare,
  Mail, Zap, ListTodo, Send, Bot, ExternalLink, Trash2,
  GitBranch, CalendarClock, AlertTriangle, Edit2, CheckCircle,
} from 'lucide-react';
import { approvalApi } from '../lib/api';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import { useStore } from '../store/store';
import { getApprovalTypeConfig } from '../lib/approvalTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'adjusted';
type ApprovalType = 'task' | 'tweet' | 'reply' | 'email' | 'message' | 'action'
  | 'post_x' | 'send_email' | 'delete_file' | 'git_push';
type ApprovalCategory = 'agent_approval' | 'executable_action' | 'scheduled_action' | null;
type FilterTab = 'all' | 'tasks' | 'posts' | 'actions';
type StatusTab = 'pending' | 'approved' | 'rejected' | 'scheduled';

interface Approval {
  id: string;
  type: ApprovalType;
  title: string;
  content: string;
  context?: string;
  metadata?: Record<string, unknown>;
  status: ApprovalStatus;
  requester?: string;
  tier: number;
  category?: ApprovalCategory;
  actionRef?: string;
  createdAt: number;
  respondedAt?: number;
  notes?: string;
  adjustedContent?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string; border: string }> = {
  task:        { icon: ListTodo,    label: 'Task',        color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30' },
  tweet:       { icon: Send,        label: 'X Post',      color: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/30' },
  post_x:      { icon: Send,        label: 'X Post',      color: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/30' },
  reply:       { icon: MessageSquare, label: 'Reply',     color: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/30' },
  email:       { icon: Mail,        label: 'Email',       color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' },
  send_email:  { icon: Mail,        label: 'Email',       color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30' },
  message:     { icon: MessageSquare, label: 'Message',   color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
  action:      { icon: Zap,         label: 'Action',      color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  delete_file: { icon: Trash2,      label: 'Delete File', color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30' },
  git_push:    { icon: GitBranch,   label: 'Git Push',    color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
};

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'tasks',   label: 'Tasks' },
  { id: 'posts',   label: 'X Posts' },
  { id: 'actions', label: 'Actions' },
];

const STATUS_TABS: { id: StatusTab; label: string; icon: React.ElementType }[] = [
  { id: 'pending',   label: 'Pending',   icon: Clock },
  { id: 'approved',  label: 'Approved',  icon: ShieldCheck },
  { id: 'rejected',  label: 'Rejected',  icon: ShieldX },
  { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
];

const EXECUTABLE_TYPES = new Set(['post_x', 'send_email', 'delete_file', 'git_push', 'email', 'tweet']);

function matchesFilter(a: Approval, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'tasks') return a.type === 'task';
  if (filter === 'posts') return a.type === 'tweet' || a.type === 'reply' || a.type === 'post_x';
  if (filter === 'actions') return ['action', 'email', 'message', 'send_email', 'delete_file', 'git_push'].includes(a.type);
  return true;
}

// ─── Rich Previews ────────────────────────────────────────────────────────────

function TweetPreview({ text, account }: { text: string; account?: string }) {
  const charCount = text.length;
  const pct = Math.min(charCount / 280, 1);
  const over = charCount > 280;
  const circumference = 2 * Math.PI * 9;
  return (
    <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-sky-400/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <div className="text-xs font-semibold text-mission-control-text">{account || '@agent'}</div>
          <div className="text-xs text-mission-control-text-dim">Agent</div>
        </div>
      </div>
      <p className="text-sm text-mission-control-text leading-relaxed whitespace-pre-wrap">{text}</p>
      <div className="flex items-center justify-between pt-1 border-t border-sky-400/10">
        <span className="text-xs text-mission-control-text-dim">Preview — X / Twitter</span>
        <div className="flex items-center gap-1.5">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-mission-control-border" />
            <circle cx="10" cy="10" r="9" fill="none"
              stroke={over ? 'var(--color-error)' : pct > 0.8 ? 'var(--color-warning)' : 'var(--color-info)'}
              strokeWidth="2" strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
              strokeLinecap="round" transform="rotate(-90 10 10)" />
          </svg>
          <span className={`text-xs font-mono ${over ? 'text-error' : 'text-mission-control-text-dim'}`}>
            {over ? `-${charCount - 280}` : charCount}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ to, subject, body, from }: { to?: string; subject?: string; body?: string; from?: string }) {
  return (
    <div className="rounded-xl border border-green-400/20 bg-green-400/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-green-400/10 space-y-1.5">
        {from && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-mission-control-text-dim w-12">From</span>
            <span className="text-mission-control-text">{from}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-mission-control-text-dim w-12">To</span>
          <span className="text-mission-control-text font-medium">{to || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-mission-control-text-dim w-12">Subject</span>
          <span className="text-mission-control-text font-semibold">{subject || '(no subject)'}</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-mission-control-text leading-relaxed whitespace-pre-wrap">
          {body || '(empty body)'}
        </p>
      </div>
      <div className="px-4 py-2 border-t border-green-400/10 bg-green-400/5">
        <span className="text-xs text-mission-control-text-dim">Email preview</span>
      </div>
    </div>
  );
}

function DeleteFilePreview({ filePath }: { filePath?: string }) {
  return (
    <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Irreversible — file will be permanently deleted</span>
      </div>
      <div className="flex items-center gap-2 bg-mission-control-border/20 rounded-lg px-3 py-2">
        <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <code className="text-xs text-red-300 font-mono break-all">{filePath || '(no path)'}</code>
      </div>
    </div>
  );
}

function GitPushPreview({ repoPatt, branch, remote, force, commitMsg }: {
  repoPatt?: string; branch?: string; remote?: string; force?: boolean; commitMsg?: string;
}) {
  return (
    <div className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4 space-y-3">
      {force && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Force push — rewrites remote history</span>
        </div>
      )}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-mission-control-text-dim w-16">Repo</span>
          <code className="font-mono text-mission-control-text bg-mission-control-border/20 rounded px-1.5 py-0.5 break-all">{repoPatt || '(unknown)'}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-mission-control-text-dim w-16">Branch</span>
          <code className="font-mono text-orange-300 bg-orange-400/10 rounded px-1.5 py-0.5">{branch || 'main'}</code>
          <span className="text-mission-control-text-dim">→</span>
          <code className="font-mono text-mission-control-text-dim">{remote || 'origin'}</code>
        </div>
        {commitMsg && (
          <div className="flex items-start gap-2">
            <span className="text-mission-control-text-dim w-16 pt-0.5">Commit</span>
            <span className="text-mission-control-text italic">{commitMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionPreview({ approval }: { approval: Approval }) {
  const meta = approval.metadata || {};
  switch (approval.type) {
    case 'post_x':
    case 'tweet':
      return <TweetPreview text={String(meta.text || approval.content)} account={meta.account as string} />;
    case 'send_email':
    case 'email':
      return (
        <EmailPreview
          to={meta.to as string}
          subject={meta.subject as string}
          body={String(meta.body || approval.content)}
          from={meta.from as string}
        />
      );
    case 'delete_file':
      return <DeleteFilePreview filePath={String(meta.path || approval.content)} />;
    case 'git_push':
      return (
        <GitPushPreview
          repoPatt={meta.repo_path as string}
          branch={meta.branch as string}
          remote={meta.remote as string}
          force={Boolean(meta.force)}
          commitMsg={meta.commit_message as string}
        />
      );
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApprovalQueuePanel() {
  const tasks = useStore(s => s.tasks);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<Set<string>>(new Set());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      let data: Approval[];
      if (statusTab === 'scheduled') {
        // Scheduled tab: approved actions with a scheduledFor time
        data = await approvalApi.getAll('approved', 'scheduled_action');
      } else {
        data = await approvalApi.getAll(statusTab);
      }
      setApprovals(Array.isArray(data) ? data : []);
    } catch {
      if (!silent) showToast('Failed to load approvals', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusTab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (statusTab !== 'pending') return;
    const id = setInterval(() => load(true), 20_000);
    return () => clearInterval(id);
  }, [statusTab, load]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleEditing = (id: string, initialContent: string) => {
    setEditing(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        if (!editedContent[id]) {
          setEditedContent(p => ({ ...p, [id]: initialContent }));
        }
      }
      return n;
    });
  };

  const respond = async (id: string, action: 'approved' | 'rejected' | 'cancelled') => {
    setResponding(prev => new Set(prev).add(id));
    try {
      const adjusted = editing.has(id) ? editedContent[id] : undefined;
      await approvalApi.respond(id, action, notes[id], adjusted);

      const label = action === 'approved' ? 'Approved' : action === 'cancelled' ? 'Cancelled' : 'Rejected';
      const variant = action === 'approved' ? 'success' : 'info';
      showToast(`${label} ✓`, variant);
      setApprovals(prev => prev.filter(a => a.id !== id));
      setNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      setEditedContent(prev => { const n = { ...prev }; delete n[id]; return n; });
      setEditing(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      showToast('Failed to respond', 'error');
    } finally {
      setResponding(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const filtered = approvals.filter(a => matchesFilter(a, filterTab));

  const pendingCounts = statusTab === 'pending' ? {
    all: approvals.length,
    tasks: approvals.filter(a => a.type === 'task').length,
    posts: approvals.filter(a => ['tweet', 'reply', 'post_x'].includes(a.type)).length,
    actions: approvals.filter(a => ['action', 'email', 'message', 'send_email', 'delete_file', 'git_push'].includes(a.type)).length,
  } : null;

  return (
    <div className="flex flex-col h-full bg-mission-control-bg text-mission-control-text">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mission-control-accent/20 rounded-xl">
            <ShieldAlert size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-mission-control-text">Approval Queue</h1>
              {statusTab === 'pending' && approvals.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-xs font-bold min-w-[20px] text-center">
                  {approvals.length}
                </span>
              )}
            </div>
            <p className="text-sm text-mission-control-text-dim">Review and approve agent actions</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-1.5 rounded hover:bg-mission-control-border/50 text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex border-b border-mission-control-border bg-mission-control-surface">
        {STATUS_TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                statusTab === tab.id
                  ? 'text-mission-control-text border-b-2 border-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter tabs (hide on scheduled) */}
      {statusTab !== 'scheduled' && (
        <div className="flex gap-1 px-3 py-2 border-b border-mission-control-border/50 bg-mission-control-surface/50">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterTab === tab.id
                  ? 'bg-mission-control-accent/20 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40'
              }`}
            >
              {tab.label}
              {pendingCounts && pendingCounts[tab.id] > 0 && (
                <span className={`text-xs rounded-full px-1.5 ${
                  filterTab === tab.id ? 'bg-mission-control-accent/30 text-mission-control-accent' : 'bg-mission-control-border text-mission-control-text-dim'
                }`}>
                  {pendingCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-mission-control-text-dim gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : approvals.length === 0 ? (
          <EmptyState
            icon={statusTab === 'pending' ? ShieldCheck : statusTab === 'scheduled' ? CalendarClock : ShieldX}
            title={
              statusTab === 'pending' ? 'No pending approvals'
              : statusTab === 'scheduled' ? 'No scheduled actions'
              : `No ${statusTab} approvals`
            }
            description={
              statusTab === 'pending'
                ? 'Items requiring human review will appear here — tasks, X posts, emails, and agent actions.'
                : statusTab === 'scheduled'
                ? 'Approved actions with a future run time will appear here. You can cancel them before they fire.'
                : undefined
            }
          />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-mission-control-text-muted">
            <CheckCircle size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No approvals</p>
            <p className="text-xs mt-1 opacity-70">
              {filterTab !== 'all' ? 'Try a different filter' : 'Nothing pending review'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border/40">
            {filtered.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                isExpanded={expanded.has(approval.id)}
                isResponding={responding.has(approval.id)}
                isEditing={editing.has(approval.id)}
                editedContent={editedContent[approval.id]}
                note={notes[approval.id] || ''}
                showActions={statusTab === 'pending'}
                isScheduledView={statusTab === 'scheduled'}
                linkedTask={approval.type === 'task' && approval.metadata?.taskId
                  ? tasks.find(t => t.id === approval.metadata!.taskId as string)
                  : undefined}
                onToggle={() => toggleExpand(approval.id)}
                onNoteChange={v => setNotes(prev => ({ ...prev, [approval.id]: v }))}
                onEditToggle={() => toggleEditing(approval.id, approval.metadata?.text as string || approval.content)}
                onEditContentChange={v => setEditedContent(prev => ({ ...prev, [approval.id]: v }))}
                onApprove={() => respond(approval.id, 'approved')}
                onReject={() => respond(approval.id, 'rejected')}
                onCancel={() => respond(approval.id, 'cancelled')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Approval Card ─────────────────────────────────────────────────────────────

interface CardProps {
  approval: Approval;
  isExpanded: boolean;
  isResponding: boolean;
  isEditing: boolean;
  editedContent?: string;
  note: string;
  showActions: boolean;
  isScheduledView: boolean;
  linkedTask?: { id: string; title: string; status: string; project?: string } | undefined;
  onToggle: () => void;
  onNoteChange: (v: string) => void;
  onEditToggle: () => void;
  onEditContentChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}

function ApprovalCard({
  approval, isExpanded, isResponding, isEditing, editedContent, note,
  showActions, isScheduledView, linkedTask,
  onToggle, onNoteChange, onEditToggle, onEditContentChange, onApprove, onReject, onCancel,
}: CardProps) {
  const cfg = TYPE_CONFIG[approval.type] || TYPE_CONFIG.action;
  const Icon = cfg.icon;
  const isExecutable = EXECUTABLE_TYPES.has(approval.type) || approval.category === 'executable_action' || approval.category === 'scheduled_action';

  const timeAgo = (() => {
    const diff = Date.now() - approval.createdAt;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(approval.createdAt).toLocaleDateString();
  })();

  const scheduledTime = approval.metadata?.scheduledFor
    ? new Date(approval.metadata.scheduledFor as number).toLocaleString()
    : null;

  return (
    <div className={`p-4 hover:bg-mission-control-surface/40 transition-colors ${
      isExecutable ? 'border-l-2 ' + cfg.border : ''
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg} shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm truncate">{approval.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getApprovalTypeConfig(approval.type).className}`}>
              {getApprovalTypeConfig(approval.type).label}
            </span>
            {isExecutable && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-mission-control-border/40 text-mission-control-text-dim">
                {approval.category === 'scheduled_action' ? 'Scheduled' : 'Executor'}
              </span>
            )}
            {approval.status !== 'pending' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                approval.status === 'approved' ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error'
              }`}>
                {approval.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
            {approval.requester && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{approval.requester}</span>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo}</span>
            {scheduledTime && (
              <span className="flex items-center gap-1 text-amber-400">
                <CalendarClock className="w-3 h-3" />{scheduledTime}
              </span>
            )}
            {linkedTask && (
              <span className="flex items-center gap-1 text-mission-control-accent">
                <ExternalLink className="w-3 h-3" />{linkedTask.project || 'General'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {approval.status === 'approved' ? (
            <ShieldCheck className="w-4 h-4 text-success" />
          ) : approval.status === 'rejected' ? (
            <ShieldX className="w-4 h-4 text-error" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400" />
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-mission-control-border/50 text-mission-control-text-dim"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsed preview */}
      {!isExpanded && approval.content && (
        <p className="mt-2 ml-9 text-xs text-mission-control-text-dim line-clamp-3">
          {approval.content}
        </p>
      )}

      {/* Expanded */}
      {isExpanded && (
        <div className="mt-3 ml-9 space-y-3">
          {/* Rich preview for executable types */}
          {isExecutable && !isEditing && <ActionPreview approval={approval} />}

          {/* Editable content for tweet/email */}
          {isEditing && (approval.type === 'post_x' || approval.type === 'tweet') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-mission-control-text">Edit tweet text</span>
                <span className="text-xs text-mission-control-text-dim">{(editedContent || '').length}/280</span>
              </div>
              <textarea
                value={editedContent || ''}
                onChange={e => onEditContentChange(e.target.value)}
                maxLength={280}
                rows={4}
                className="w-full text-sm bg-mission-control-border/20 border border-sky-400/30 rounded-lg px-3 py-2 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-sky-400/60 resize-none"
              />
            </div>
          )}

          {/* Raw content for non-executable types */}
          {!isExecutable && (
            <div className="text-xs text-mission-control-text bg-mission-control-border/20 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
              {approval.content}
            </div>
          )}

          {approval.context && (
            <div className="text-xs text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Context: </span>
              {approval.context}
            </div>
          )}
          {linkedTask && (
            <div className="flex items-center gap-2 text-xs bg-mission-control-border/20 rounded-lg p-2.5">
              <Bot className="w-3.5 h-3.5 text-mission-control-accent shrink-0" />
              <div>
                <span className="font-medium">{linkedTask.title}</span>
                <span className="text-mission-control-text-dim ml-2">
                  {linkedTask.status}{linkedTask.project ? ` · ${linkedTask.project}` : ''}
                </span>
              </div>
            </div>
          )}
          {approval.notes && (
            <div className="text-xs text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Review notes: </span>
              {approval.notes}
            </div>
          )}
          {approval.adjustedContent && (
            <div className="text-xs text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Adjusted: </span>
              <span className="font-mono">{approval.adjustedContent}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="mt-3 ml-9 space-y-2">
          {/* Edit toggle for X posts */}
          {(approval.type === 'post_x' || approval.type === 'tweet') && isExpanded && (
            <button
              onClick={onEditToggle}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                isEditing
                  ? 'bg-sky-400/20 text-sky-400 border-sky-400/30'
                  : 'bg-mission-control-border/20 text-mission-control-text-dim border-mission-control-border hover:text-mission-control-text'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              {isEditing ? 'Done editing' : 'Edit before approving'}
            </button>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Notes (optional)…"
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              className="flex-1 text-xs bg-mission-control-border/30 border border-mission-control-border rounded-lg px-3 py-1.5 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
            />
            <button
              onClick={onApprove}
              disabled={isResponding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-subtle hover:bg-success/20 text-success text-xs font-medium border border-success-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isExecutable ? 'Approve & Run' : 'Approve'}
            </button>
            <button
              onClick={onReject}
              disabled={isResponding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-subtle hover:bg-error/20 text-error text-xs font-medium border border-error-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Scheduled view: cancel only */}
      {isScheduledView && (
        <div className="mt-3 ml-9">
          <button
            onClick={onCancel}
            disabled={isResponding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mission-control-border/20 hover:bg-error-subtle text-mission-control-text-dim hover:text-error text-xs font-medium border border-mission-control-border hover:border-error-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Cancel scheduled action
          </button>
        </div>
      )}
    </div>
  );
}
