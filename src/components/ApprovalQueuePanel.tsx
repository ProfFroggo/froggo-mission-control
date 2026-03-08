import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, ShieldCheck, ShieldX, Clock, RefreshCw,
  Check, X, ChevronDown, ChevronUp, User, MessageSquare,
  Mail, Zap, ListTodo, Send, Bot, ExternalLink,
} from 'lucide-react';
import { approvalApi } from '../lib/api';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import { useStore } from '../store/store';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'adjusted';
type ApprovalType = 'task' | 'tweet' | 'reply' | 'email' | 'message' | 'action';
type FilterTab = 'all' | 'tasks' | 'posts' | 'actions';
type StatusTab = 'pending' | 'approved' | 'rejected';

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
  createdAt: number;
  respondedAt?: number;
  notes?: string;
  adjustedContent?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ApprovalType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  task:    { icon: ListTodo,      label: 'Task',    color: 'text-amber-400',  bg: 'bg-amber-400/10' },
  tweet:   { icon: Send,          label: 'X Post',  color: 'text-sky-400',    bg: 'bg-sky-400/10' },
  reply:   { icon: MessageSquare, label: 'Reply',   color: 'text-sky-400',    bg: 'bg-sky-400/10' },
  email:   { icon: Mail,          label: 'Email',   color: 'text-green-400',  bg: 'bg-green-400/10' },
  message: { icon: MessageSquare, label: 'Message', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  action:  { icon: Zap,           label: 'Action',  color: 'text-orange-400', bg: 'bg-orange-400/10' },
};

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'tasks',   label: 'Tasks' },
  { id: 'posts',   label: 'X Posts' },
  { id: 'actions', label: 'Actions' },
];

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'pending',  label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function matchesFilter(a: Approval, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'tasks') return a.type === 'task';
  if (filter === 'posts') return a.type === 'tweet' || a.type === 'reply';
  if (filter === 'actions') return a.type === 'action' || a.type === 'email' || a.type === 'message';
  return true;
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
  const [responding, setResponding] = useState<Set<string>>(new Set());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await approvalApi.getAll(statusTab);
      setApprovals(Array.isArray(data) ? data : []);
    } catch {
      if (!silent) showToast('Failed to load approvals', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusTab]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh pending tab every 20s
  useEffect(() => {
    if (statusTab !== 'pending') return;
    const id = setInterval(() => load(true), 20_000);
    return () => clearInterval(id);
  }, [statusTab, load]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const respond = async (id: string, action: 'approved' | 'rejected') => {
    setResponding(prev => new Set(prev).add(id));
    try {
      await approvalApi.respond(id, action, notes[id]);
      showToast(action === 'approved' ? 'Approved ✓' : 'Rejected', action === 'approved' ? 'success' : 'info');
      setApprovals(prev => prev.filter(a => a.id !== id));
      setNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      showToast('Failed to respond', 'error');
    } finally {
      setResponding(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const filtered = approvals.filter(a => matchesFilter(a, filterTab));

  // Count pending by type for filter tab badges
  const pendingCounts = statusTab === 'pending' ? {
    all: approvals.length,
    tasks: approvals.filter(a => a.type === 'task').length,
    posts: approvals.filter(a => a.type === 'tweet' || a.type === 'reply').length,
    actions: approvals.filter(a => ['action', 'email', 'message'].includes(a.type)).length,
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
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              statusTab === tab.id
                ? 'text-mission-control-text border-b-2 border-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter tabs */}
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
                filterTab === tab.id
                  ? 'bg-mission-control-accent/30 text-mission-control-accent'
                  : 'bg-mission-control-border text-mission-control-text-dim'
              }`}>
                {pendingCounts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-mission-control-text-dim gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={statusTab === 'pending' ? ShieldCheck : ShieldX}
            title={statusTab === 'pending' ? 'No pending approvals' : `No ${statusTab} approvals`}
            description={
              statusTab === 'pending'
                ? 'Items requiring human review will appear here — tasks in human-review, X posts, agent actions, and more.'
                : undefined
            }
          />
        ) : (
          <div className="divide-y divide-mission-control-border/40">
            {filtered.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                isExpanded={expanded.has(approval.id)}
                isResponding={responding.has(approval.id)}
                note={notes[approval.id] || ''}
                showActions={statusTab === 'pending'}
                linkedTask={approval.type === 'task' && approval.metadata?.taskId
                  ? tasks.find(t => t.id === approval.metadata!.taskId as string)
                  : undefined}
                onToggle={() => toggleExpand(approval.id)}
                onNoteChange={v => setNotes(prev => ({ ...prev, [approval.id]: v }))}
                onApprove={() => respond(approval.id, 'approved')}
                onReject={() => respond(approval.id, 'rejected')}
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
  note: string;
  showActions: boolean;
  linkedTask?: { id: string; title: string; status: string; project?: string } | undefined;
  onToggle: () => void;
  onNoteChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

function ApprovalCard({
  approval, isExpanded, isResponding, note, showActions, linkedTask,
  onToggle, onNoteChange, onApprove, onReject,
}: CardProps) {
  const cfg = TYPE_CONFIG[approval.type] || TYPE_CONFIG.action;
  const Icon = cfg.icon;

  const timeAgo = (() => {
    const diff = Date.now() - approval.createdAt;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(approval.createdAt).toLocaleDateString();
  })();

  return (
    <div className="p-4 hover:bg-mission-control-surface/40 transition-colors">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg} shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm truncate">{approval.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {approval.status !== 'pending' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                approval.status === 'approved'
                  ? 'bg-green-400/10 text-green-400'
                  : 'bg-red-400/10 text-red-400'
              }`}>
                {approval.status}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
            {approval.requester && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {approval.requester}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
            {linkedTask && (
              <span className="flex items-center gap-1 text-mission-control-accent">
                <ExternalLink className="w-3 h-3" />
                {linkedTask.project || 'General'}
              </span>
            )}
          </div>
        </div>

        {/* Status icon + expand */}
        <div className="flex items-center gap-1 shrink-0">
          {approval.status === 'approved' ? (
            <ShieldCheck className="w-4 h-4 text-green-400" />
          ) : approval.status === 'rejected' ? (
            <ShieldX className="w-4 h-4 text-red-400" />
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

      {/* Content preview (always visible, truncated) */}
      {!isExpanded && approval.content && (
        <p className="mt-2 ml-9 text-xs text-mission-control-text-dim line-clamp-2">
          {approval.content}
        </p>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 ml-9 space-y-3">
          <div className="text-xs text-mission-control-text bg-mission-control-border/20 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
            {approval.content}
          </div>
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
                  {linkedTask.status} {linkedTask.project ? `· ${linkedTask.project}` : ''}
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

      {/* Actions for pending items */}
      {showActions && (
        <div className="mt-3 ml-9 flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium border border-green-500/30 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={isResponding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium border border-red-500/30 disabled:opacity-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
