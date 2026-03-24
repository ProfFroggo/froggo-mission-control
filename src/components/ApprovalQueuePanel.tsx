import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert, ShieldCheck, ShieldX, Clock, RefreshCw,
  Check, X, ChevronDown, ChevronUp, User, MessageSquare,
  Mail, Zap, ListTodo, Send, Bot, ExternalLink, Trash2,
  GitBranch, CalendarClock, AlertTriangle, Edit2, CheckCircle,
  CheckSquare, Filter, ChevronRight, XCircle, Square,
} from 'lucide-react';
import { approvalApi } from '../lib/api';
import { showToast } from './Toast';
import { Button, IconButton, Badge, Select, TextArea, TextField } from '@radix-ui/themes';
import EmptyState from './EmptyState';
import { useStore } from '../store/store';
import { useChatRoomStore } from '../store/chatRoomStore';
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
  priority?: number;
  category?: ApprovalCategory;
  actionRef?: string;
  createdAt: number;
  respondedAt?: number;
  notes?: string;
  adjustedContent?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string; border: string }> = {
  task:        { icon: ListTodo,      label: 'Task',        color: 'text-warning',  bg: 'bg-warning-subtle',  border: 'border-warning-border' },
  tweet:       { icon: Send,          label: 'X Post',      color: 'text-info',     bg: 'bg-info-subtle',     border: 'border-info-border' },
  post_x:      { icon: Send,          label: 'X Post',      color: 'text-info',     bg: 'bg-info-subtle',     border: 'border-info-border' },
  reply:       { icon: MessageSquare, label: 'Reply',       color: 'text-info',     bg: 'bg-info-subtle',     border: 'border-info-border' },
  email:       { icon: Mail,          label: 'Email',       color: 'text-success',  bg: 'bg-success-subtle',  border: 'border-success-border' },
  send_email:  { icon: Mail,          label: 'Email',       color: 'text-success',  bg: 'bg-success-subtle',  border: 'border-success-border' },
  message:     { icon: MessageSquare, label: 'Message',     color: 'text-review',   bg: 'bg-review-subtle',   border: 'border-review-border' },
  action:      { icon: Zap,           label: 'Action',      color: 'text-danger',   bg: 'bg-danger/10',       border: 'border-danger/30' },
  delete_file: { icon: Trash2,        label: 'Delete File', color: 'text-error',    bg: 'bg-error-subtle',    border: 'border-error-border' },
  git_push:    { icon: GitBranch,     label: 'Git Push',    color: 'text-danger',   bg: 'bg-danger/10',       border: 'border-danger/30' },
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

function getUrgencyTier(a: Approval): number {
  return a.priority ?? a.tier ?? 3;
}

// Sort: lower tier = more urgent (P0 first). Within same tier, oldest first.
function sortByUrgency(approvals: Approval[]): Approval[] {
  return [...approvals].sort((a, b) => {
    const pa = getUrgencyTier(a);
    const pb = getUrgencyTier(b);
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt;
  });
}

// ─── Stats Header ─────────────────────────────────────────────────────────────

function ApprovalStatsStrip({ approvals, allApprovals, humanReviewCount }: { approvals: Approval[]; allApprovals: Approval[]; humanReviewCount: number }) {
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const pendingCount = pendingApprovals + humanReviewCount;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const approvedToday = allApprovals.filter(
    a => a.status === 'approved' && a.respondedAt && a.respondedAt >= todayStart.getTime()
  ).length;

  const responded = allApprovals.filter(a => a.respondedAt && a.createdAt && a.status !== 'pending');
  let avgResponseMin: number | null = null;
  if (responded.length > 0) {
    const totalMs = responded.reduce((sum, a) => sum + ((a.respondedAt ?? 0) - a.createdAt), 0);
    avgResponseMin = Math.round(totalMs / responded.length / 60_000);
  }

  return (
    <div className="flex items-center gap-4 px-6 py-2.5 border-b border-mission-control-border bg-mission-control-surface/60 text-xs">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-warning" />
        <span className="text-mission-control-text-dim">Pending</span>
        <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-semibold tabular-nums min-w-[20px] text-center">
          {pendingCount}
        </span>
      </div>
      <div className="w-px h-4 bg-mission-control-border" />
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success" />
        <span className="text-mission-control-text-dim">Approved today</span>
        <span className="font-semibold tabular-nums text-mission-control-text">{approvedToday}</span>
      </div>
      {avgResponseMin !== null && (
        <>
          <div className="w-px h-4 bg-mission-control-border" />
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-info" />
            <span className="text-mission-control-text-dim">Avg response</span>
            <span className="font-semibold tabular-nums text-mission-control-text">
              {avgResponseMin < 60 ? `${avgResponseMin}m` : `${Math.round(avgResponseMin / 60)}h`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Rich Previews ────────────────────────────────────────────────────────────

function TweetPreview({ text, account }: { text: string; account?: string }) {
  const charCount = text.length;
  const pct = Math.min(charCount / 280, 1);
  const over = charCount > 280;
  const circumference = 2 * Math.PI * 9;
  return (
    <div className="rounded-xl border border-info-border bg-info-subtle p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-info-subtle flex items-center justify-center">
          <Bot className="w-4 h-4 text-info" />
        </div>
        <div>
          <div className="text-xs font-semibold text-mission-control-text">{account || '@agent'}</div>
          <div className="text-xs text-mission-control-text-dim">Agent</div>
        </div>
      </div>
      <p className="text-sm text-mission-control-text leading-relaxed whitespace-pre-wrap">{text}</p>
      <div className="flex items-center justify-between pt-1 border-t border-info-border/30">
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
    <div className="rounded-xl border border-success-border bg-success-subtle overflow-hidden">
      <div className="px-4 py-3 border-b border-success-border/30 space-y-1.5">
        {from && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-mission-control-text-dim w-12">From</span>
            <span className="text-mission-control-text">{from}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-mission-control-text-dim w-12">To</span>
          <span className="text-mission-control-text font-medium">{to || '\u2014'}</span>
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
      <div className="px-4 py-2 border-t border-success-border/30 bg-success-subtle">
        <span className="text-xs text-mission-control-text-dim">Email preview</span>
      </div>
    </div>
  );
}

function DeleteFilePreview({ filePath }: { filePath?: string }) {
  return (
    <div className="rounded-xl border border-error-border bg-error-subtle p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-error shrink-0" />
        <span className="text-xs font-semibold text-error uppercase tracking-wide">Irreversible \u2014 file will be permanently deleted</span>
      </div>
      <div className="flex items-center gap-2 bg-mission-control-border/20 rounded-lg px-3 py-2">
        <Trash2 className="w-3.5 h-3.5 text-error shrink-0" />
        <code className="text-xs text-error font-mono break-all">{filePath || '(no path)'}</code>
      </div>
    </div>
  );
}

function GitPushPreview({ repoPatt, branch, remote, force, commitMsg }: {
  repoPatt?: string; branch?: string; remote?: string; force?: boolean; commitMsg?: string;
}) {
  return (
    <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 space-y-3">
      {force && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span className="text-xs font-semibold text-danger uppercase tracking-wide">Force push \u2014 rewrites remote history</span>
        </div>
      )}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-mission-control-text-dim w-16">Repo</span>
          <code className="font-mono text-mission-control-text bg-mission-control-border/20 rounded px-1.5 py-0.5 break-all">{repoPatt || '(unknown)'}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-mission-control-text-dim w-16">Branch</span>
          <code className="font-mono text-danger bg-danger/10 rounded px-1.5 py-0.5">{branch || 'main'}</code>
          <span className="text-mission-control-text-dim">{'\u2192'}</span>
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

// ─── Human Review Section ─────────────────────────────────────────────────────

interface HumanReviewTask {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
  project?: string;
  lastAgentUpdate?: string;
  description?: string;
}

function HumanReviewSection({ tasks }: { tasks: HumanReviewTask[] }) {
  const humanReviewTasks = tasks.filter(t => t.status === 'human-review');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (humanReviewTasks.length === 0) return null;

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const resume = async (taskId: string, withFeedback?: string) => {
    setSubmitting(prev => new Set(prev).add(taskId));
    try {
      if (withFeedback?.trim()) {
        await fetch(`/api/tasks/${taskId}/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'human_feedback', message: withFeedback.trim() }),
        });
      }
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in-progress' }),
      });
      setFeedback(prev => { const n = { ...prev }; delete n[taskId]; return n; });
      showToast('Task resumed', 'success');
    } catch { showToast('Failed to resume', 'error'); }
    finally { setSubmitting(prev => { const n = new Set(prev); n.delete(taskId); return n; }); }
  };

  const close = async (taskId: string) => {
    setSubmitting(prev => new Set(prev).add(taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      showToast('Task cancelled', 'success');
    } catch { showToast('Failed to cancel', 'error'); }
    finally { setSubmitting(prev => { const n = new Set(prev); n.delete(taskId); return n; }); }
  };

  return (
    <div className="border-b border-mission-control-border">
      <div className="px-6 py-3 flex items-center gap-2 bg-warning-subtle/20">
        <AlertTriangle size={13} className="text-warning flex-shrink-0" />
        <span className="text-xs font-semibold text-warning uppercase tracking-wide">
          Needs Your Input — {humanReviewTasks.length} task{humanReviewTasks.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-mission-control-border/40">
        {humanReviewTasks.map(task => {
          const isOpen = expanded.has(task.id);
          const isBusy = submitting.has(task.id);
          const reason = task.lastAgentUpdate?.replace(/^Blocked:\s*/i, '').trim();

          return (
            <div key={task.id} className="bg-mission-control-surface/40">
              <button
                type="button"
                onClick={() => toggle(task.id)}
                className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-mission-control-surface/60 transition-colors"
              >
                <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-mission-control-text-dim">
                    {task.assignedTo && <span>{task.assignedTo}</span>}
                    {task.project && <><span>·</span><span>{task.project}</span></>}
                  </div>
                  {reason && !isOpen && (
                    <div className="mt-1 text-xs text-warning/80 truncate">{reason}</div>
                  )}
                </div>
                {isOpen
                  ? <ChevronUp size={14} className="text-mission-control-text-dim mt-1 flex-shrink-0" />
                  : <ChevronDown size={14} className="text-mission-control-text-dim mt-1 flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-3 space-y-2">
                  {reason && (
                    <div className="flex gap-2 p-3 rounded-lg bg-warning-subtle/30 border border-warning-border/40">
                      <AlertTriangle size={13} className="text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-warning mb-0.5">Why it stopped</div>
                        <div className="text-xs text-mission-control-text leading-relaxed">{reason}</div>
                      </div>
                    </div>
                  )}
                  {!reason && task.description && (
                    <div className="text-xs text-mission-control-text-dim p-3 rounded-lg bg-mission-control-border/20">
                      {task.description}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-mission-control-text-dim block mb-1.5">
                      Your feedback or instructions to the agent
                    </label>
                    <TextArea
                      value={feedback[task.id] || ''}
                      onChange={e => setFeedback(prev => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder="Tell the agent what to do next, provide missing info, or clarify requirements..."
                      rows={2}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => resume(task.id, feedback[task.id])}
                      disabled={isBusy}
                      color="grass"
                      size="2"
                      className="flex-1"
                    >
                      {isBusy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                      {feedback[task.id]?.trim() ? 'Send Feedback & Resume' : 'Resume Work'}
                    </Button>
                    <Button
                      onClick={() => close(task.id)}
                      disabled={isBusy}
                      color="red"
                      variant="outline"
                      size="2"
                      className="flex-1"
                    >
                      {isBusy ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                      Cancel Task
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail Pane ──────────────────────────────────────────────────────────────

interface DetailPaneProps {
  approval: Approval;
  isResponding: boolean;
  showActions: boolean;
  linkedTask?: { id: string; title: string; status: string; project?: string };
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

function ApprovalDetailPane({
  approval, isResponding, showActions, linkedTask,
  onApprove, onReject, onClose,
}: DetailPaneProps) {
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null);
  const setActiveRoom = useChatRoomStore(s => s.setActiveRoom);

  const tier = getUrgencyTier(approval);
  const isExecutable = EXECUTABLE_TYPES.has(approval.type) || approval.category === 'executable_action' || approval.category === 'scheduled_action';

  const timeAgo = (() => {
    const diff = Date.now() - approval.createdAt;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(approval.createdAt).toLocaleDateString();
  })();

  const urgencyBorderClass = tier === 0 ? 'border-l-4 border-error' : tier === 1 ? 'border-l-4 border-warning' : '';

  const urgencyLabel = tier === 0
    ? <Badge color="red" variant="soft">P0</Badge>
    : tier === 1
    ? <Badge color="amber" variant="soft">P1</Badge>
    : null;

  const handleApproveClick = () => {
    if (!approveConfirm) { setApproveConfirm(true); setRejectConfirm(false); return; }
    setApproveConfirm(false);
    onApprove();
  };

  const handleRejectClick = () => {
    if (!rejectConfirm) {
      setRejectConfirm(true);
      setApproveConfirm(false);
      setTimeout(() => rejectReasonRef.current?.focus(), 50);
      return;
    }
    setRejectConfirm(false);
    onReject();
  };

  const handleDiscuss = () => {
    const agentId = (approval.metadata?.agentId ?? approval.requester) as string | undefined;
    if (agentId) { setActiveRoom(`agent-${agentId}`); window.location.hash = 'chat'; }
  };

  let payloadDisplay: string | null = null;
  if (approval.metadata && Object.keys(approval.metadata).length > 0) {
    try { payloadDisplay = JSON.stringify(approval.metadata, null, 2); } catch { payloadDisplay = null; }
  }

  return (
    <div className={`flex flex-col h-full bg-mission-control-surface border-l border-mission-control-border ${urgencyBorderClass}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <div className="flex items-center gap-2 min-w-0">
          {urgencyLabel}
          <span className="text-sm font-semibold text-mission-control-text truncate">{approval.title}</span>
        </div>
        <IconButton onClick={onClose} variant="ghost" size="2" color="gray" className="shrink-0">
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-mission-control-text-dim">
          <span className={`px-1.5 py-0.5 rounded-full font-medium ${getApprovalTypeConfig(approval.type).className}`}>
            {getApprovalTypeConfig(approval.type).label}
          </span>
          {approval.requester && <span className="flex items-center gap-1"><User className="w-3 h-3" />{approval.requester}</span>}
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo}</span>
          <span>{new Date(approval.createdAt).toLocaleString()}</span>
        </div>

        {isExecutable && <ActionPreview approval={approval} />}

        {approval.content && (
          <div>
            <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-1.5">Content</div>
            <div className="text-sm text-mission-control-text bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2.5 whitespace-pre-wrap leading-relaxed">
              {approval.content}
            </div>
          </div>
        )}

        {approval.context && (
          <div>
            <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-1.5">Context</div>
            <div className="text-xs text-mission-control-text-dim bg-mission-control-border/20 rounded-lg px-3 py-2 leading-relaxed">{approval.context}</div>
          </div>
        )}

        {payloadDisplay && (
          <div>
            <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-1.5">Payload</div>
            <pre className="text-xs text-mission-control-text bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2.5 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
              {payloadDisplay}
            </pre>
          </div>
        )}

        {linkedTask && (
          <div className="flex items-center gap-2 text-xs bg-mission-control-border/20 rounded-lg px-3 py-2">
            <ListTodo className="w-3.5 h-3.5 text-mission-control-accent shrink-0" />
            <span className="font-medium">{linkedTask.title}</span>
            {linkedTask.project && <span className="text-mission-control-text-dim">{'\u00b7'} {linkedTask.project}</span>}
          </div>
        )}

        {approval.notes && (
          <div className="text-xs text-mission-control-text-dim bg-mission-control-border/20 rounded-lg px-3 py-2">
            <span className="font-medium text-mission-control-text">Notes: </span>{approval.notes}
          </div>
        )}
        {approval.adjustedContent && (
          <div className="text-xs text-mission-control-text-dim">
            <span className="font-medium text-mission-control-text">Adjusted: </span>
            <span className="font-mono">{approval.adjustedContent}</span>
          </div>
        )}
      </div>

      {showActions && (
        <div className="px-4 py-3 border-t border-mission-control-border space-y-3">
          {rejectConfirm && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-error block">Rejection reason (required)</label>
              <TextArea
                ref={rejectReasonRef as React.RefObject<HTMLTextAreaElement>}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this is being rejected…"
                rows={2}
                style={{ width: '100%' }}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleApproveClick}
              disabled={isResponding}
              color="grass"
              variant={approveConfirm ? 'soft' : 'solid'}
              size="2"
              className="flex-1"
            >
              {isResponding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {approveConfirm ? 'Confirm Approve?' : 'Approve'}
            </Button>
            <Button
              onClick={handleRejectClick}
              disabled={isResponding || (rejectConfirm && rejectReason.trim().length === 0)}
              color="red"
              variant={rejectConfirm ? 'solid' : 'soft'}
              size="2"
              className="flex-1"
            >
              {isResponding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {rejectConfirm ? 'Confirm Reject?' : 'Reject'}
            </Button>
            {approval.requester && (
              <IconButton
                onClick={handleDiscuss}
                title="Open chat with this agent"
                variant="outline"
                size="2"
              >
                <MessageSquare className="w-4 h-4" />
              </IconButton>
            )}
          </div>
          {(rejectConfirm || approveConfirm) && (
            <Button
              onClick={() => { setRejectConfirm(false); setApproveConfirm(false); setRejectReason(''); }}
              variant="ghost"
              size="1"
              color="gray"
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApprovalQueuePanel() {
  const tasks = useStore(s => s.tasks);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [allApprovals, setAllApprovals] = useState<Approval[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [requesterFilter, setRequesterFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchWorking, setBatchWorking] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [showBatchRejectInput, setShowBatchRejectInput] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchWorking2, setBatchWorking2] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      let data: Approval[];
      if (statusTab === 'scheduled') {
        data = await approvalApi.getAll('approved', 'scheduled_action');
      } else {
        data = await approvalApi.getAll(statusTab);
      }
      setApprovals(Array.isArray(data) ? data : []);
      if (!silent) {
        const all = await approvalApi.getAll();
        setAllApprovals(Array.isArray(all) ? all : []);
      }
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
      if (n.has(id)) { n.delete(id); } else {
        n.add(id);
        if (!editedContent[id]) setEditedContent(p => ({ ...p, [id]: initialContent }));
      }
      return n;
    });
  };

  const respond = async (id: string, action: 'approved' | 'rejected' | 'cancelled') => {
    setResponding(prev => new Set(prev).add(id));
    try {
      const adjusted = editing.has(id) ? editedContent[id] : undefined;
      await approvalApi.respond(id, action, notes[id], adjusted);
      showToast(action === 'approved' ? 'Approved' : action === 'cancelled' ? 'Cancelled' : 'Rejected', action === 'approved' ? 'success' : 'info');
      setApprovals(prev => prev.filter(a => a.id !== id));
      setNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      setEditedContent(prev => { const n = { ...prev }; delete n[id]; return n; });
      setEditing(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (selectedId === id) setSelectedId(null);
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      showToast('Failed to respond', 'error');
    } finally {
      setResponding(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const uniqueRequesters = Array.from(
    new Set(approvals.map(a => a.requester).filter(Boolean) as string[])
  ).sort();

  const filtered = sortByUrgency(
    approvals.filter(a => matchesFilter(a, filterTab)).filter(a => requesterFilter === 'all' || a.requester === requesterFilter)
  );

  const approveAll = async () => {
    if (!batchConfirm) { setBatchConfirm(true); setTimeout(() => setBatchConfirm(false), 4000); return; }
    setBatchConfirm(false);
    setBatchWorking2(true);
    const targets = filtered.filter(a => a.status === 'pending');
    await Promise.allSettled(targets.map(a => approvalApi.respond(a.id, 'approved', undefined, undefined)));
    showToast(`${targets.length} approvals approved`, 'success');
    await load(true);
    setBatchWorking2(false);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const batchApproveSelected = async () => {
    if (selected.size === 0) return;
    setBatchWorking(true);
    try {
      await approvalApi.batchRespond(Array.from(selected), 'approve');
      showToast(`${selected.size} approvals approved`, 'success');
      setApprovals(prev => prev.filter(a => !selected.has(a.id)));
      if (selectedId && selected.has(selectedId)) setSelectedId(null);
      setSelected(new Set());
    } catch { showToast('Batch approve failed', 'error'); }
    finally { setBatchWorking(false); }
  };

  const batchRejectSelected = async () => {
    if (!showBatchRejectInput) { setShowBatchRejectInput(true); return; }
    if (selected.size === 0) return;
    setBatchWorking(true);
    try {
      await approvalApi.batchRespond(Array.from(selected), 'reject', batchRejectReason || undefined);
      showToast(`${selected.size} approvals rejected`, 'success');
      setApprovals(prev => prev.filter(a => !selected.has(a.id)));
      if (selectedId && selected.has(selectedId)) setSelectedId(null);
      setSelected(new Set());
      setShowBatchRejectInput(false);
      setBatchRejectReason('');
    } catch { showToast('Batch reject failed', 'error'); }
    finally { setBatchWorking(false); }
  };

  const pendingCounts = statusTab === 'pending' ? {
    all: approvals.length,
    tasks: approvals.filter(a => a.type === 'task').length,
    posts: approvals.filter(a => ['tweet', 'reply', 'post_x'].includes(a.type)).length,
    actions: approvals.filter(a => ['action', 'email', 'message', 'send_email', 'delete_file', 'git_push'].includes(a.type)).length,
  } : null;

  const selectedApproval = selectedId ? approvals.find(a => a.id === selectedId) : null;

  return (
    <div className="flex flex-col h-full bg-mission-control-bg text-mission-control-text">
      <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mission-control-accent/20 rounded-lg">
            <ShieldAlert size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-mission-control-text">Approval Queue</h1>
              {statusTab === 'pending' && approvals.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-warning text-white text-xs font-bold tabular-nums min-w-[20px] text-center">
                  {approvals.length}
                </span>
              )}
            </div>
            <p className="text-sm text-mission-control-text-dim">Review and approve agent actions</p>
          </div>
        </div>
        <IconButton
          onClick={() => load(true)}
          disabled={refreshing}
          variant="ghost"
          color="gray"
          size="2"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <ApprovalStatsStrip approvals={approvals} allApprovals={allApprovals} humanReviewCount={tasks.filter(t => t.status === 'human-review').length} />

      <div className="flex border-b border-mission-control-border bg-mission-control-surface">
        {STATUS_TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => { setStatusTab(tab.id); setSelectedId(null); setSelected(new Set()); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${statusTab === tab.id ? 'text-mission-control-text border-b-2 border-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {statusTab !== 'scheduled' && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-mission-control-border/50 bg-mission-control-surface/50">
          <Filter className="w-3 h-3 text-mission-control-text-dim shrink-0 mr-0.5" />
          {FILTER_TABS.map(tab => (
            <Button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              variant={filterTab === tab.id ? 'soft' : 'ghost'}
              size="1"
              radius="full"
            >
              {tab.label}
              {pendingCounts && pendingCounts[tab.id] > 0 && (
                <Badge color={filterTab === tab.id ? 'blue' : 'gray'} variant="soft" size="1">
                  {pendingCounts[tab.id]}
                </Badge>
              )}
            </Button>
          ))}
          {uniqueRequesters.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              <User className="w-3 h-3 text-mission-control-text-dim" />
              <Select.Root value={requesterFilter} onValueChange={setRequesterFilter} size="1">
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="all">All agents</Select.Item>
                  {uniqueRequesters.map(r => <Select.Item key={r} value={r}>{r}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </div>
          )}
          {statusTab === 'pending' && filtered.length > 1 && (
            <Button
              onClick={approveAll}
              disabled={batchWorking2}
              color="grass"
              variant={batchConfirm ? 'solid' : 'soft'}
              size="1"
              radius="full"
              className="ml-auto"
            >
              {batchWorking2 ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
              {batchConfirm ? `Confirm — approve all ${filtered.length}` : `Approve all ${filtered.length}`}
            </Button>
          )}
        </div>
      )}

      {statusTab === 'pending' && <HumanReviewSection tasks={tasks} />}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col overflow-y-auto relative w-full">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-mission-control-text-dim gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : approvals.length === 0 ? (
            <EmptyState
              icon={statusTab === 'pending' ? ShieldCheck : statusTab === 'scheduled' ? CalendarClock : ShieldX}
              title={statusTab === 'pending' ? 'No pending approvals' : statusTab === 'scheduled' ? 'No scheduled actions' : `No ${statusTab} approvals`}
              description={statusTab === 'pending' ? 'Agents are working autonomously \u2014 all clear. Items requiring human review will appear here.' : statusTab === 'scheduled' ? 'Approved actions with a future run time will appear here. You can cancel them before they fire.' : undefined}
            />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-mission-control-text-dim">
              <CheckCircle size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">No approvals</p>
              <p className="text-xs mt-1 opacity-70">{filterTab !== 'all' || requesterFilter !== 'all' ? 'Try a different filter' : 'Nothing pending review'}</p>
            </div>
          ) : (
            <div className="divide-y divide-mission-control-border/40 pb-20">
              {filtered.map(approval => (
                <ApprovalListRow
                  key={approval.id}
                  approval={approval}
                  isExpanded={expanded.has(approval.id)}
                  isResponding={responding.has(approval.id)}
                  isEditing={editing.has(approval.id)}
                  editedContent={editedContent[approval.id]}
                  note={notes[approval.id] || ''}
                  showActions={statusTab === 'pending'}
                  isScheduledView={statusTab === 'scheduled'}
                  isSelected={selected.has(approval.id)}
                  isDetailOpen={selectedId === approval.id}
                  linkedTask={approval.type === 'task' && approval.metadata?.taskId ? tasks.find(t => t.id === approval.metadata!.taskId as string) : undefined}
                  onToggle={() => toggleExpand(approval.id)}
                  onNoteChange={v => setNotes(prev => ({ ...prev, [approval.id]: v }))}
                  onEditToggle={() => toggleEditing(approval.id, approval.metadata?.text as string || approval.content)}
                  onEditContentChange={v => setEditedContent(prev => ({ ...prev, [approval.id]: v }))}
                  onApprove={() => respond(approval.id, 'approved')}
                  onReject={() => respond(approval.id, 'rejected')}
                  onCancel={() => respond(approval.id, 'cancelled')}
                  onSelect={e => toggleSelect(approval.id, e)}
                  onOpenDetail={() => toggleExpand(approval.id)}
                />
              ))}
            </div>
          )}

          {selected.size > 0 && statusTab === 'pending' && (
            <div className="absolute bottom-0 left-0 right-0 bg-mission-control-surface border-t border-mission-control-border p-3 shadow-lg space-y-2">
              {showBatchRejectInput && (
                <div className="flex gap-2 items-center">
                  <TextField.Root
                    type="text"
                    value={batchRejectReason}
                    onChange={e => setBatchRejectReason(e.target.value)}
                    placeholder="Rejection reason (optional)…"
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <IconButton onClick={() => { setShowBatchRejectInput(false); setBatchRejectReason(''); }} variant="ghost" color="gray" size="2">
                    <X className="w-4 h-4" />
                  </IconButton>
                </div>
              )}
              <div className="flex items-center gap-2">
                <IconButton onClick={() => setSelected(new Set())} variant="ghost" color="gray" size="2" title="Clear selection">
                  <Square className="w-4 h-4" />
                </IconButton>
                <span className="text-xs text-mission-control-text-dim flex-1">{selected.size} selected</span>
                <Button onClick={batchApproveSelected} disabled={batchWorking} color="grass" size="1">
                  {batchWorking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Approve selected ({selected.size})
                </Button>
                <Button onClick={batchRejectSelected} disabled={batchWorking} color="red" variant="soft" size="1">
                  {batchWorking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                  {showBatchRejectInput ? 'Confirm Reject' : `Reject selected (${selected.size})`}
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Approval List Row ────────────────────────────────────────────────────────

interface RowProps {
  approval: Approval;
  isExpanded: boolean;
  isResponding: boolean;
  isEditing: boolean;
  editedContent?: string;
  note: string;
  showActions: boolean;
  isScheduledView: boolean;
  isSelected: boolean;
  isDetailOpen: boolean;
  linkedTask?: { id: string; title: string; status: string; project?: string } | undefined;
  onToggle: () => void;
  onNoteChange: (v: string) => void;
  onEditToggle: () => void;
  onEditContentChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onOpenDetail: () => void;
}

function AgentActionCard({
  approval, isResponding, note, showActions, onNoteChange, onApprove, onReject, linkedTask,
}: {
  approval: Approval; isResponding: boolean; note: string; showActions: boolean;
  onNoteChange: (v: string) => void; onApprove: () => void; onReject: () => void;
  linkedTask?: { id: string; title: string; status: string; project?: string } | undefined;
}) {
  const setActiveRoom = useChatRoomStore(s => s.setActiveRoom);
  const handleDiscuss = () => {
    const agentId = (approval.metadata?.agentId ?? approval.requester) as string | undefined;
    if (agentId) { setActiveRoom(`agent-${agentId}`); window.location.hash = 'chat'; }
  };
  const timeAgo = (() => {
    const diff = Date.now() - approval.createdAt;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(approval.createdAt).toLocaleDateString();
  })();
  const hasNote = note.trim().length > 0;
  return (
    <div className="border-l-2 border-danger/50 bg-mission-control-surface/30 px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-md bg-danger/10 shrink-0"><Zap className="w-3.5 h-3.5 text-danger" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{approval.title}</span>
            {approval.status !== 'pending' && (
              <Badge color={approval.status === 'approved' ? 'grass' : 'red'} variant="soft" size="1">{approval.status}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-mission-control-text-dim">
            {approval.requester && <span className="flex items-center gap-1"><Bot className="w-3 h-3" />{approval.requester}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo}</span>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide">Agent is asking to</div>
        <div className="text-sm text-mission-control-text bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2.5 whitespace-pre-wrap leading-relaxed">{approval.content}</div>
      </div>
      {approval.context && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide">Context</div>
          <div className="text-xs text-mission-control-text-dim bg-mission-control-border/20 rounded-lg px-3 py-2 leading-relaxed">{approval.context}</div>
        </div>
      )}
      {linkedTask && (
        <div className="flex items-center gap-2 text-xs bg-mission-control-border/20 rounded-lg px-3 py-2">
          <ListTodo className="w-3.5 h-3.5 text-mission-control-accent shrink-0" />
          <span className="font-medium">{linkedTask.title}</span>
          {linkedTask.project && <span className="text-mission-control-text-dim">{'\u00b7'} {linkedTask.project}</span>}
        </div>
      )}
      {!showActions && approval.notes && (
        <div className="text-xs text-mission-control-text-dim bg-mission-control-border/20 rounded-lg px-3 py-2">
          <span className="font-medium text-mission-control-text">Notes: </span>{approval.notes}
        </div>
      )}
      {showActions && (
        <div className="space-y-2 pt-1">
          <TextArea
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Optional feedback for the agent…"
            rows={2}
            style={{ width: '100%' }}
          />
          <div className="flex gap-2">
            <Button onClick={onApprove} disabled={isResponding} color="grass" size="2" className="flex-1">
              {isResponding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {hasNote ? 'Approve with Feedback' : 'Approve'}
            </Button>
            <Button onClick={onReject} disabled={isResponding} color="red" variant="soft" size="2" className="flex-1">
              {isResponding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              {hasNote ? 'Reject with Reason' : 'Deny'}
            </Button>
            <IconButton onClick={handleDiscuss} title="Open chat with this agent" variant="outline" size="2">
              <MessageSquare className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalListRow({
  approval, isExpanded, isResponding, isEditing, editedContent, note,
  showActions, isScheduledView, isSelected, isDetailOpen, linkedTask,
  onToggle, onNoteChange, onEditToggle, onEditContentChange, onApprove, onReject, onCancel,
  onSelect, onOpenDetail,
}: RowProps) {
  const [hovered, setHovered] = useState(false);
  const cfg = TYPE_CONFIG[approval.type] || TYPE_CONFIG.action;
  const Icon = cfg.icon;
  const isExecutable = EXECUTABLE_TYPES.has(approval.type) || approval.category === 'executable_action' || approval.category === 'scheduled_action';
  const isAgentAction = approval.type === 'action' && !!(approval.metadata?.taskId);
  const tier = getUrgencyTier(approval);
  const urgencyBorderClass = tier === 0 ? 'border-l-4 border-error' : tier === 1 ? 'border-l-4 border-warning' : isExecutable ? `border-l-2 ${cfg.border}` : '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showActions || isResponding) return;
    const inInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';
    if (inInput) return;
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); onApprove(); }
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); onReject(); }
  };

  if (isAgentAction) {
    return <AgentActionCard approval={approval} isResponding={isResponding} note={note} showActions={showActions} onNoteChange={onNoteChange} onApprove={onApprove} onReject={onReject} linkedTask={linkedTask} />;
  }

  const timeAgo = (() => {
    const diff = Date.now() - approval.createdAt;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(approval.createdAt).toLocaleDateString();
  })();

  const scheduledTime = approval.metadata?.scheduledFor ? new Date(approval.metadata.scheduledFor as number).toLocaleString() : null;

  return (
    <div
      tabIndex={showActions ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpenDetail}
      className={`p-4 hover:bg-mission-control-surface/40 transition-colors focus:outline-none focus:ring-1 focus:ring-mission-control-accent/40 cursor-pointer ${urgencyBorderClass} ${isDetailOpen ? 'bg-mission-control-surface/50' : ''} ${isSelected ? 'bg-mission-control-accent/5' : ''}`}
    >
      <div className="flex items-start gap-3">
        {showActions && (hovered || isSelected) ? (
          <IconButton onClick={onSelect} variant="ghost" color="gray" size="1" className="mt-0.5 shrink-0" title="Select for batch action">
            {isSelected ? <CheckSquare className="w-4 h-4 text-mission-control-accent" /> : <Square className="w-4 h-4" />}
          </IconButton>
        ) : (
          <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg} shrink-0`}><Icon className={`w-3.5 h-3.5 ${cfg.color}`} /></div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm truncate">{approval.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getApprovalTypeConfig(approval.type).className}`}>{getApprovalTypeConfig(approval.type).label}</span>
            {tier <= 1 && (
              <Badge color={tier === 0 ? 'red' : 'amber'} variant="soft" size="1">P{tier}</Badge>
            )}
            {isExecutable && (
              <Badge color="gray" variant="soft" size="1">
                {approval.category === 'scheduled_action' ? 'Scheduled' : 'Executor'}
              </Badge>
            )}
            {approval.status !== 'pending' && (
              <Badge color={approval.status === 'approved' ? 'grass' : 'red'} variant="soft" size="1">{approval.status}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
            {approval.requester && <span className="flex items-center gap-1"><User className="w-3 h-3" />{approval.requester}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo}</span>
            {scheduledTime && <span className="flex items-center gap-1 text-warning"><CalendarClock className="w-3 h-3" />{scheduledTime}</span>}
            {linkedTask && <span className="flex items-center gap-1 text-mission-control-accent"><ExternalLink className="w-3 h-3" />{linkedTask.project || 'General'}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {approval.status === 'approved' ? <ShieldCheck className="w-4 h-4 text-success" /> : approval.status === 'rejected' ? <ShieldX className="w-4 h-4 text-error" /> : <Clock className="w-4 h-4 text-warning" />}
          <ChevronRight className={`w-4 h-4 text-mission-control-text-dim transition-transform ${isDetailOpen ? 'rotate-90' : ''}`} />
          <IconButton onClick={e => { e.stopPropagation(); onToggle(); }} variant="ghost" color="gray" size="1">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </IconButton>
        </div>
      </div>

      {!isExpanded && approval.content && (
        <p className="mt-2 ml-9 text-xs text-mission-control-text-dim line-clamp-3">{approval.content}</p>
      )}

      {isExpanded && (
        <div className="mt-3 ml-9 space-y-3" onClick={e => e.stopPropagation()}>
          {isExecutable && !isEditing && <ActionPreview approval={approval} />}
          {isEditing && (approval.type === 'post_x' || approval.type === 'tweet') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-mission-control-text">Edit tweet text</span>
                <span className="text-xs text-mission-control-text-dim">{(editedContent || '').length}/280</span>
              </div>
              <TextArea value={editedContent || ''} onChange={e => onEditContentChange(e.target.value)} maxLength={280} rows={4} style={{ width: '100%' }} />
            </div>
          )}
          {!isExecutable && (
            <div className="text-xs text-mission-control-text bg-mission-control-border/20 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">{approval.content}</div>
          )}
          {approval.context && <div className="text-xs text-mission-control-text-dim"><span className="font-medium text-mission-control-text">Context: </span>{approval.context}</div>}
          {linkedTask && (
            <div className="flex items-center gap-2 text-xs bg-mission-control-border/20 rounded-lg p-2.5">
              <Bot className="w-3.5 h-3.5 text-mission-control-accent shrink-0" />
              <div>
                <span className="font-medium">{linkedTask.title}</span>
                <span className="text-mission-control-text-dim ml-2">{linkedTask.status}{linkedTask.project ? ` \u00b7 ${linkedTask.project}` : ''}</span>
              </div>
            </div>
          )}
          {approval.notes && <div className="text-xs text-mission-control-text-dim"><span className="font-medium text-mission-control-text">Review notes: </span>{approval.notes}</div>}
          {approval.adjustedContent && <div className="text-xs text-mission-control-text-dim"><span className="font-medium text-mission-control-text">Adjusted: </span><span className="font-mono">{approval.adjustedContent}</span></div>}
        </div>
      )}

      {showActions && isExpanded && (
        <div className="mt-3 ml-9 space-y-2" onClick={e => e.stopPropagation()}>
          {(approval.type === 'post_x' || approval.type === 'tweet') && (
            <Button onClick={onEditToggle} variant={isEditing ? 'soft' : 'outline'} color={isEditing ? 'blue' : 'gray'} size="1">
              <Edit2 className="w-3.5 h-3.5" />
              {isEditing ? 'Done editing' : 'Edit before approving'}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <TextField.Root type="text" placeholder="Notes (optional)…" value={note} onChange={e => onNoteChange(e.target.value)} style={{ flex: 1 }} size="1" />
            <Button onClick={onApprove} disabled={isResponding} color="grass" size="2">
              {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isExecutable ? 'Approve & Run' : 'Approve'}
            </Button>
            <Button onClick={onReject} disabled={isResponding} color="red" variant="soft" size="2">
              {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Deny
            </Button>
          </div>
        </div>
      )}

      {isScheduledView && (
        <div className="mt-3 ml-9" onClick={e => e.stopPropagation()}>
          <Button onClick={onCancel} disabled={isResponding} color="red" variant="outline" size="1">
            {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Cancel scheduled action
          </Button>
        </div>
      )}
    </div>
  );
}
