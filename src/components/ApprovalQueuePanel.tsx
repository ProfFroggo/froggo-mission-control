// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ApprovalQueuePanel — redesigned decision-making workspace.
 * Premium SaaS feel: spacious cards, clear hierarchy, fast keyboard flow.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert, ShieldCheck, ShieldX, Clock, RefreshCw,
  Check, X, User, MessageSquare,
  Mail, Zap, ListTodo, Send, Bot,
  GitBranch, CalendarClock, AlertTriangle, Edit2, CheckCircle,
  CheckSquare, ChevronDown, ChevronUp, Square, Trash2, XCircle,
} from 'lucide-react';
import { approvalApi } from '../lib/api';
import { showToast } from './Toast';
import { Box, Flex, Button, IconButton, Badge, TextArea, TextField } from '@radix-ui/themes';
import EmptyState from './EmptyState';
import TabNav, { type TabNavItem } from './TabNav';
import AgentAvatar from './AgentAvatar';
import { useStore } from '../store/store';
import { useChatRoomStore } from '../store/chatRoomStore';
import { getApprovalTypeConfig } from '../lib/approvalTypes';
import { formatTimeAgo } from '../utils/formatting';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'adjusted';
type ApprovalType = 'task' | 'tweet' | 'reply' | 'email' | 'message' | 'action'
  | 'post_x' | 'send_email' | 'delete_file' | 'git_push';
type ApprovalCategory = 'agent_approval' | 'executable_action' | 'scheduled_action' | null;
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type TypeFilter = 'all' | 'tasks' | 'posts' | 'actions';
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

// Solid icon+color map — no subtle/transparent backgrounds on the icon pill
const TYPE_ICON_CONFIG: Record<string, { icon: React.ElementType; color: string; iconBg: string; accentBorder: string }> = {
  task:        { icon: ListTodo,      color: 'text-[var(--color-warning)]',            iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-[var(--color-warning)]' },
  tweet:       { icon: Send,          color: 'text-mission-control-accent', iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-mission-control-accent' },
  post_x:      { icon: Send,          color: 'text-mission-control-accent', iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-mission-control-accent' },
  reply:       { icon: MessageSquare, color: 'text-mission-control-accent', iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-mission-control-accent' },
  email:       { icon: Mail,          color: 'text-[var(--color-success)]',            iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-[var(--color-success)]' },
  send_email:  { icon: Mail,          color: 'text-[var(--color-success)]',            iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-[var(--color-success)]' },
  message:     { icon: MessageSquare, color: 'text-mission-control-text-dim', iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-mission-control-border' },
  action:      { icon: Zap,           color: 'text-[var(--color-error)]',              iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-[var(--color-error)]' },
  delete_file: { icon: Trash2,        color: 'text-[var(--color-error)]',              iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-[var(--color-error)]' },
  git_push:    { icon: GitBranch,     color: 'text-[var(--color-warning)]',            iconBg: 'bg-mission-control-surface', accentBorder: 'border-l-2 border-[var(--color-warning)]' },
};
const FALLBACK_ICON_CONFIG = TYPE_ICON_CONFIG.action;

const STATUS_TABS: { id: StatusTab; label: string; icon: React.ElementType }[] = [
  { id: 'pending',   label: 'Pending',   icon: Clock },
  { id: 'approved',  label: 'Approved',  icon: ShieldCheck },
  { id: 'rejected',  label: 'Rejected',  icon: ShieldX },
  { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
];

const TYPE_FILTER_TABS: { id: TypeFilter; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'tasks',   label: 'Tasks' },
  { id: 'posts',   label: 'Posts' },
  { id: 'actions', label: 'Actions' },
];

const EXECUTABLE_TYPES = new Set(['post_x', 'send_email', 'delete_file', 'git_push', 'email', 'tweet']);

function matchesTypeFilter(a: Approval, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'tasks') return a.type === 'task';
  if (filter === 'posts') return ['tweet', 'reply', 'post_x'].includes(a.type);
  if (filter === 'actions') return ['action', 'email', 'message', 'send_email', 'delete_file', 'git_push'].includes(a.type);
  return true;
}

function getUrgencyTier(a: Approval): number {
  return a.priority ?? a.tier ?? 3;
}

function sortByUrgency(approvals: Approval[]): Approval[] {
  return [...approvals].sort((a, b) => {
    const pa = getUrgencyTier(a);
    const pb = getUrgencyTier(b);
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt;
  });
}

// ─── Action Previews ──────────────────────────────────────────────────────────

function TweetPreview({ text, account }: { text: string; account?: string }) {
  const charCount = text.length;
  const pct = Math.min(charCount / 280, 1);
  const over = charCount > 280;
  const circumference = 2 * Math.PI * 9;
  return (
    <div className="rounded-xl border border-mission-control-border bg-mission-control-bg p-4 space-y-3">
      <Flex align="center" gap="2">
        <div className="w-8 h-8 rounded-full bg-mission-control-surface border border-mission-control-border flex items-center justify-center">
          <Bot className="w-4 h-4 text-mission-control-accent" />
        </div>
        <div>
          <div className="text-xs font-semibold text-mission-control-text">{account || '@agent'}</div>
          <div className="text-xs text-mission-control-text-dim">X / Twitter</div>
        </div>
      </Flex>
      <p className="text-sm text-mission-control-text leading-relaxed whitespace-pre-wrap">{text}</p>
      <Flex align="center" justify="between" className="pt-2 border-t border-mission-control-border">
        <span className="text-xs text-mission-control-text-dim">Character count</span>
        <Flex align="center" gap="2">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="2" className="text-mission-control-border" />
            <circle cx="10" cy="10" r="9" fill="none"
              stroke={over ? 'var(--color-error)' : pct > 0.8 ? 'var(--color-warning)' : 'var(--color-info)'}
              strokeWidth="2" strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
              strokeLinecap="round" transform="rotate(-90 10 10)" />
          </svg>
          <span className={`text-xs font-mono ${over ? 'text-[var(--color-error)]' : 'text-mission-control-text-dim'}`}>
            {over ? `-${charCount - 280}` : charCount}
          </span>
        </Flex>
      </Flex>
    </div>
  );
}

function EmailPreview({ to, subject, body, from }: { to?: string; subject?: string; body?: string; from?: string }) {
  return (
    <div className="rounded-xl border border-mission-control-border bg-mission-control-bg overflow-hidden">
      <div className="px-4 py-3 border-b border-mission-control-border space-y-1.5">
        {from && (
          <Flex align="center" gap="2" className="text-xs">
            <span className="text-mission-control-text-dim w-14 shrink-0">From</span>
            <span className="text-mission-control-text">{from}</span>
          </Flex>
        )}
        <Flex align="center" gap="2" className="text-xs">
          <span className="text-mission-control-text-dim w-14 shrink-0">To</span>
          <span className="text-mission-control-text font-medium">{to || '—'}</span>
        </Flex>
        <Flex align="center" gap="2" className="text-xs">
          <span className="text-mission-control-text-dim w-14 shrink-0">Subject</span>
          <span className="text-mission-control-text font-semibold">{subject || '(no subject)'}</span>
        </Flex>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-mission-control-text leading-relaxed whitespace-pre-wrap">{body || '(empty body)'}</p>
      </div>
    </div>
  );
}

function DeleteFilePreview({ filePath }: { filePath?: string }) {
  return (
    <div className="rounded-xl border border-mission-control-border bg-mission-control-bg p-4 space-y-3">
      <Flex align="center" gap="2">
        <AlertTriangle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
        <span className="text-[10px] font-bold text-[var(--color-error)] uppercase tracking-wide">Irreversible — file will be permanently deleted</span>
      </Flex>
      <Flex align="center" gap="2" className="bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2">
        <Trash2 className="w-3.5 h-3.5 text-[var(--color-error)] shrink-0" />
        <code className="text-xs text-mission-control-text font-mono break-all">{filePath || '(no path)'}</code>
      </Flex>
    </div>
  );
}

function GitPushPreview({ repoPatt, branch, remote, force, commitMsg }: {
  repoPatt?: string; branch?: string; remote?: string; force?: boolean; commitMsg?: string;
}) {
  return (
    <div className="rounded-xl border border-mission-control-border bg-mission-control-bg p-4 space-y-3">
      {force && (
        <Flex align="center" gap="2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
          <span className="text-[10px] font-bold text-[var(--color-warning)] uppercase tracking-wide">Force push — rewrites remote history</span>
        </Flex>
      )}
      <div className="space-y-2 text-xs">
        <Flex align="center" gap="2">
          <span className="text-mission-control-text-dim w-16 shrink-0">Repo</span>
          <code className="font-mono text-mission-control-text bg-mission-control-surface border border-mission-control-border rounded px-1.5 py-0.5 break-all">{repoPatt || '(unknown)'}</code>
        </Flex>
        <Flex align="center" gap="2">
          <span className="text-mission-control-text-dim w-16 shrink-0">Branch</span>
          <code className="font-mono text-mission-control-text bg-mission-control-surface border border-mission-control-border rounded px-1.5 py-0.5">{branch || 'main'}</code>
          <span className="text-mission-control-text-dim">→</span>
          <code className="font-mono text-mission-control-text-dim">{remote || 'origin'}</code>
        </Flex>
        {commitMsg && (
          <Flex align="start" gap="2">
            <span className="text-mission-control-text-dim w-16 shrink-0 pt-0.5">Commit</span>
            <span className="text-mission-control-text italic">{commitMsg}</span>
          </Flex>
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

// ─── Human Review Banner ──────────────────────────────────────────────────────

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
    <div className="mx-5 my-4 rounded-xl border border-mission-control-border bg-mission-control-surface overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-mission-control-border">
        <AlertTriangle size={14} className="text-[var(--color-warning)] flex-shrink-0" />
        <span className="text-xs font-semibold text-[var(--color-warning)]">
          Needs Your Input
        </span>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-mission-control-bg border border-mission-control-border text-xs font-mono text-mission-control-text-dim tabular-nums">
          {humanReviewTasks.length}
        </span>
      </div>
      <div className="divide-y divide-mission-control-border">
        {humanReviewTasks.map(task => {
          const isOpen = expanded.has(task.id);
          const isBusy = submitting.has(task.id);
          const reason = task.lastAgentUpdate?.replace(/^Blocked:\s*/i, '').trim();

          return (
            <div key={task.id}>
              <button
                type="button"
                onClick={() => toggle(task.id)}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-mission-control-bg transition-colors"
              >
                <AlertTriangle size={13} className="text-[var(--color-warning)] mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-mission-control-text">{task.title}</div>
                  <Flex align="center" gap="2" className="mt-0.5 text-xs text-mission-control-text-dim">
                    {task.assignedTo && <span>{task.assignedTo}</span>}
                    {task.project && <><span>·</span><span>{task.project}</span></>}
                  </Flex>
                  {reason && !isOpen && (
                    <div className="mt-1 text-xs text-[var(--color-warning)]/80 truncate">{reason}</div>
                  )}
                </div>
                {isOpen
                  ? <ChevronUp size={13} className="text-mission-control-text-dim mt-1 flex-shrink-0" />
                  : <ChevronDown size={13} className="text-mission-control-text-dim mt-1 flex-shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 bg-mission-control-bg">
                  {reason && (
                    <div className="flex gap-2 p-3 rounded-lg border border-mission-control-border bg-mission-control-surface">
                      <AlertTriangle size={13} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-warning)] mb-0.5">Why it stopped</div>
                        <div className="text-xs text-mission-control-text leading-relaxed">{reason}</div>
                      </div>
                    </div>
                  )}
                  {!reason && task.description && (
                    <div className="text-xs text-mission-control-text-dim p-3 rounded-lg border border-mission-control-border bg-mission-control-surface">
                      {task.description}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-mission-control-text-dim block mb-1.5">
                      Feedback or instructions for the agent
                    </label>
                    <TextArea
                      value={feedback[task.id] || ''}
                      onChange={e => setFeedback(prev => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder="Tell the agent what to do next…"
                      rows={2}
                      className="w-full"
                    />
                  </div>
                  <Flex gap="2">
                    <Button onClick={() => resume(task.id, feedback[task.id])} disabled={isBusy} color="grass" size="2" className="flex-1">
                      {isBusy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                      {feedback[task.id]?.trim() ? 'Send Feedback & Resume' : 'Resume Work'}
                    </Button>
                    <Button onClick={() => close(task.id)} disabled={isBusy} color="red" variant="outline" size="2">
                      {isBusy ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                      Cancel
                    </Button>
                  </Flex>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PriorityBadge({ tier }: { tier: number }) {
  if (tier > 1) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
      tier === 0
        ? 'bg-mission-control-surface border border-mission-control-border text-[var(--color-error)]'
        : 'bg-mission-control-surface border border-mission-control-border text-[var(--color-warning)]'
    }`}>
      P{tier}
    </span>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'tweet':
    case 'post_x':
    case 'reply':
      return 'bg-[var(--color-info)]/10 text-[var(--color-info)]';
    case 'email':
    case 'send_email':
      return 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]';
    case 'task':
    case 'message':
    case 'action':
      return 'bg-mission-control-accent/10 text-mission-control-accent';
    case 'delete_file':
    case 'git_push':
      return 'bg-[var(--color-error)]/10 text-[var(--color-error)]';
    default:
      return 'bg-mission-control-accent/10 text-mission-control-accent';
  }
}

function TypeBadge({ type }: { type: string }) {
  const cfg = getApprovalTypeConfig(type);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadgeClass(type)}`}>
      {cfg.label}
    </span>
  );
}

// ─── Approval Card ────────────────────────────────────────────────────────────

interface ApprovalCardProps {
  approval: Approval;
  showActions: boolean;
  isScheduledView: boolean;
  isResponding: boolean;
  isEditing: boolean;
  editedContent?: string;
  note: string;
  isSelected: boolean;
  linkedTask?: { id: string; title: string; status: string; project?: string } | undefined;
  onNoteChange: (v: string) => void;
  onEditToggle: () => void;
  onEditContentChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onSelect: (e: React.MouseEvent) => void;
}

const SECTION_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim';

function ApprovalCard({
  approval, showActions, isScheduledView, isResponding, isEditing, editedContent,
  note, isSelected, linkedTask,
  onNoteChange, onEditToggle, onEditContentChange, onApprove, onReject, onCancel, onSelect,
}: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const rejectRef = useRef<HTMLTextAreaElement>(null);
  const setActiveRoom = useChatRoomStore(s => s.setActiveRoom);

  const cfg = TYPE_ICON_CONFIG[approval.type] ?? FALLBACK_ICON_CONFIG;
  const Icon = cfg.icon;
  const tier = getUrgencyTier(approval);
  const isExecutable = EXECUTABLE_TYPES.has(approval.type) || approval.category === 'executable_action' || approval.category === 'scheduled_action';
  const agentId = (approval.metadata?.agentId ?? approval.requester) as string | undefined;
  const scheduledTime = approval.metadata?.scheduledFor
    ? new Date(approval.metadata.scheduledFor as number).toLocaleString()
    : null;

  const urgencyLeftBorder = tier === 0
    ? 'border-l-[3px] border-[var(--color-error)]'
    : tier === 1
    ? 'border-l-[3px] border-[var(--color-warning)]'
    : 'border-l-[3px] border-[var(--color-info)]';

  const handleApprove = () => {
    if (!approveConfirm) { setApproveConfirm(true); setRejectConfirm(false); return; }
    setApproveConfirm(false);
    onApprove();
  };

  const handleReject = () => {
    if (!rejectConfirm) {
      setRejectConfirm(true);
      setApproveConfirm(false);
      setTimeout(() => rejectRef.current?.focus(), 50);
      return;
    }
    setRejectConfirm(false);
    onReject();
  };

  const handleDiscuss = () => {
    if (agentId) { setActiveRoom(`agent-${agentId}`); window.location.hash = 'chat'; }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showActions || isResponding) return;
    const inInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';
    if (inInput) return;
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); handleApprove(); }
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); handleReject(); }
  };

  return (
    <div
      tabIndex={showActions ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className={`rounded-xl border border-mission-control-border bg-mission-control-surface overflow-hidden transition-colors hover:border-mission-control-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/40 ${urgencyLeftBorder} ${isSelected ? 'ring-2 ring-mission-control-accent/30' : ''}`}
    >
      {/* Card header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Left: type icon */}
        <div className="mt-0.5 shrink-0">
          <div className={`w-8 h-8 rounded-lg border border-mission-control-border bg-mission-control-bg flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
        </div>

        {/* Center: title + meta */}
        <Box className="flex-1 min-w-0">
          <Flex align="center" gap="2" className="flex-wrap mb-1">
            <span className="text-sm font-semibold text-mission-control-text leading-tight">{approval.title}</span>
            <TypeBadge type={approval.type} />
            <PriorityBadge tier={tier} />
            {approval.status !== 'pending' && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-mission-control-surface border border-mission-control-border ${
                approval.status === 'approved' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
              }`}>
                {approval.status === 'approved' ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                {approval.status}
              </span>
            )}
            {isExecutable && approval.category === 'scheduled_action' && scheduledTime && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-mission-control-surface border border-mission-control-border text-[var(--color-warning)]">
                <CalendarClock className="w-3 h-3" />
                {scheduledTime}
              </span>
            )}
          </Flex>

          {/* Content preview (always visible, short) */}
          {!expanded && approval.content && (
            <div className="mb-2">
              <p className={`text-xs text-mission-control-text-dim leading-relaxed ${contentExpanded ? '' : 'line-clamp-3'}`}>{approval.content}</p>
              {approval.content.length > 160 && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setContentExpanded(v => !v); }}
                  className="text-[10px] font-medium text-mission-control-accent hover:underline mt-0.5"
                >
                  {contentExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {/* Agent + time meta */}
          <Flex align="center" gap="3" className="text-xs text-mission-control-text-dim">
            {agentId ? (
              <Flex align="center" gap="1.5">
                <AgentAvatar agentId={agentId} agentName={approval.requester} size="xs" />
                <span>{approval.requester || agentId}</span>
              </Flex>
            ) : approval.requester ? (
              <Flex align="center" gap="1">
                <User className="w-3 h-3" />
                <span>{approval.requester}</span>
              </Flex>
            ) : null}
            <span className="flex items-center gap-1 text-[11px] tabular-nums text-mission-control-text-dim/70">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(approval.createdAt)}
            </span>
            {linkedTask && (
              <span className="flex items-center gap-1 text-mission-control-accent">
                <ListTodo className="w-3 h-3" />
                {linkedTask.project || linkedTask.title}
              </span>
            )}
          </Flex>
        </Box>

        {/* Right: actions or status + expand */}
        <Flex align="center" gap="1" className="shrink-0 ml-1">
          {showActions && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSelect(e); }}
              title="Select for batch action"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              {isSelected ? <CheckSquare className="w-4 h-4 text-mission-control-accent" /> : <Square className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded-md hover:bg-mission-control-bg text-mission-control-text-dim transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </Flex>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-mission-control-border pt-3 bg-mission-control-bg">
          {/* Rich action preview */}
          {isExecutable && !isEditing && <ActionPreview approval={approval} />}

          {/* Editable tweet content */}
          {isEditing && (approval.type === 'post_x' || approval.type === 'tweet') && (
            <div className="space-y-1.5">
              <Flex align="center" justify="between">
                <span className="text-xs font-medium text-mission-control-text">Edit post text</span>
                <span className={`text-xs font-mono ${(editedContent || '').length > 280 ? 'text-[var(--color-error)]' : 'text-mission-control-text-dim'}`}>
                  {(editedContent || '').length}/280
                </span>
              </Flex>
              <TextArea
                value={editedContent || ''}
                onChange={e => onEditContentChange(e.target.value)}
                maxLength={280}
                rows={4}
                className="w-full"
              />
            </div>
          )}

          {/* Raw content (non-executable) */}
          {!isExecutable && approval.content && (
            <div className="text-xs text-mission-control-text bg-mission-control-surface border border-mission-control-border rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
              {approval.content}
            </div>
          )}

          {/* Context */}
          {approval.context && (
            <div>
              <div className={`${SECTION_LABEL} mb-1`}>Context</div>
              <div className="text-xs text-mission-control-text-dim bg-mission-control-surface border border-mission-control-border rounded-lg p-3 leading-relaxed">
                {approval.context}
              </div>
            </div>
          )}

          {/* Linked task */}
          {linkedTask && (
            <Flex align="center" gap="2" className="text-xs bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2">
              <ListTodo className="w-3.5 h-3.5 text-mission-control-accent shrink-0" />
              <span className="font-medium text-mission-control-text">{linkedTask.title}</span>
              {linkedTask.project && <span className="text-mission-control-text-dim">· {linkedTask.project}</span>}
              <span className="text-mission-control-text-dim ml-auto">{linkedTask.status}</span>
            </Flex>
          )}

          {/* Historical notes */}
          {!showActions && approval.notes && (
            <div className="text-xs text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Review notes: </span>{approval.notes}
            </div>
          )}
          {approval.adjustedContent && (
            <div className="text-xs text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Adjusted: </span>
              <span className="font-mono">{approval.adjustedContent}</span>
            </div>
          )}

          {/* Action controls — pending only */}
          {showActions && (
            <div className="space-y-3 pt-1">
              {/* Edit toggle for X posts */}
              {(approval.type === 'post_x' || approval.type === 'tweet') && (
                <Button onClick={onEditToggle} variant={isEditing ? 'soft' : 'outline'} color={isEditing ? 'blue' : 'gray'} size="1">
                  <Edit2 className="w-3.5 h-3.5" />
                  {isEditing ? 'Done editing' : 'Edit before approving'}
                </Button>
              )}

              {/* Notes field */}
              <div>
                <label className={`${SECTION_LABEL} block mb-1.5`}>
                  Notes for agent (optional)
                </label>
                <TextField.Root
                  type="text"
                  placeholder="Add context or reason…"
                  value={note}
                  onChange={e => onNoteChange(e.target.value)}
                  size="2"
                  className="w-full"
                />
              </div>

              {/* Reject reason (shown when rejectConfirm is active) */}
              {rejectConfirm && (
                <div>
                  <label className="text-xs font-medium text-[var(--color-error)] block mb-1.5">Rejection reason (required)</label>
                  <TextArea
                    ref={rejectRef as React.RefObject<HTMLTextAreaElement>}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this is being rejected…"
                    rows={2}
                    className="w-full"
                  />
                </div>
              )}

              {/* Primary action row */}
              <Flex gap="2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isResponding}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 border border-[var(--color-success)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResponding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {approveConfirm ? 'Confirm Approve?' : isExecutable ? 'Approve & Run' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isResponding || (rejectConfirm && rejectReason.trim().length === 0)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 border border-[var(--color-error)]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResponding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {rejectConfirm ? 'Confirm Reject?' : 'Reject'}
                </button>
                {agentId && (
                  <IconButton onClick={handleDiscuss} title="Open chat with this agent" variant="outline" size="2">
                    <MessageSquare className="w-4 h-4" />
                  </IconButton>
                )}
              </Flex>

              {/* Cancel confirm state */}
              {(approveConfirm || rejectConfirm) && (
                <button
                  type="button"
                  onClick={() => { setApproveConfirm(false); setRejectConfirm(false); setRejectReason(''); }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors w-full"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Scheduled action cancel */}
          {isScheduledView && (
            <Button onClick={onCancel} disabled={isResponding} color="red" variant="outline" size="2">
              {isResponding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Cancel scheduled action
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApprovalQueuePanel() {
  const tasks = useStore(s => s.tasks);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [allApprovals, setAllApprovals] = useState<Approval[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchWorking, setBatchWorking] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState('');
  const [showBatchRejectInput, setShowBatchRejectInput] = useState(false);
  const [approveAllConfirm, setApproveAllConfirm] = useState(false);
  const [approveAllWorking, setApproveAllWorking] = useState(false);

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
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch {
      showToast('Failed to respond', 'error');
    } finally {
      setResponding(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const filtered = sortByUrgency(approvals.filter(a => matchesTypeFilter(a, typeFilter)));

  const pendingTotal = approvals.filter(a => a.status === 'pending').length;
  const humanReviewCount = tasks.filter(t => t.status === 'human-review').length;

  // Stats
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const approvedToday = allApprovals.filter(
    a => a.status === 'approved' && a.respondedAt && a.respondedAt >= todayStart.getTime()
  ).length;

  const approveAll = async () => {
    if (!approveAllConfirm) { setApproveAllConfirm(true); setTimeout(() => setApproveAllConfirm(false), 4000); return; }
    setApproveAllConfirm(false);
    setApproveAllWorking(true);
    const targets = filtered.filter(a => a.status === 'pending');
    await Promise.allSettled(targets.map(a => approvalApi.respond(a.id, 'approved', undefined, undefined)));
    showToast(`${targets.length} approvals approved`, 'success');
    await load(true);
    setApproveAllWorking(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const batchApproveSelected = async () => {
    if (selected.size === 0) return;
    setBatchWorking(true);
    try {
      await approvalApi.batchRespond(Array.from(selected), 'approve');
      showToast(`${selected.size} approvals approved`, 'success');
      setApprovals(prev => prev.filter(a => !selected.has(a.id)));
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
      setSelected(new Set());
      setShowBatchRejectInput(false);
      setBatchRejectReason('');
    } catch { showToast('Batch reject failed', 'error'); }
    finally { setBatchWorking(false); }
  };

  const pendingCounts: Record<TypeFilter, number> = statusTab === 'pending' ? {
    all: approvals.length,
    tasks: approvals.filter(a => a.type === 'task').length,
    posts: approvals.filter(a => ['tweet', 'reply', 'post_x'].includes(a.type)).length,
    actions: approvals.filter(a => ['action', 'email', 'message', 'send_email', 'delete_file', 'git_push'].includes(a.type)).length,
  } : { all: 0, tasks: 0, posts: 0, actions: 0 };

  return (
    <div className="flex flex-col h-full bg-mission-control-bg text-mission-control-text">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-mission-control-border bg-mission-control-surface flex-shrink-0">
        <Flex align="center" justify="between">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-bg border border-mission-control-border rounded-lg">
              <ShieldAlert size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <Flex align="center" gap="2">
                <span className="text-sm font-semibold text-mission-control-text">Approvals</span>
                {(pendingTotal + humanReviewCount) > 0 && (
                  <span className="bg-[var(--color-warning)]/15 text-[var(--color-warning)] text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                    {pendingTotal + humanReviewCount}
                  </span>
                )}
              </Flex>
              <p className="text-xs text-mission-control-text-dim mt-0.5">
                {approvedToday > 0
                  ? `${approvedToday} approved today · Review and approve agent actions`
                  : 'Review and approve agent actions'}
              </p>
            </div>
          </Flex>

          <Flex align="center" gap="2">
            {/* Approve all shortcut — only when pending items exist */}
            {statusTab === 'pending' && filtered.filter(a => a.status === 'pending').length > 1 && (
              <Button
                onClick={approveAll}
                disabled={approveAllWorking}
                color="grass"
                variant={approveAllConfirm ? 'solid' : 'soft'}
                size="1"
                radius="full"
              >
                {approveAllWorking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
                {approveAllConfirm
                  ? `Confirm — approve all ${filtered.filter(a => a.status === 'pending').length}`
                  : `Approve all ${filtered.filter(a => a.status === 'pending').length}`}
              </Button>
            )}

            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              title="Refresh"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </Flex>
        </Flex>
      </div>

      {/* ── Status tabs ── */}
      <div className="border-b border-mission-control-border bg-mission-control-surface">
        <TabNav
          tabs={STATUS_TABS.map(tab => ({
            id: tab.id,
            label: tab.label,
            icon: tab.icon as TabNavItem['icon'],
            badge: tab.id === 'pending' && pendingTotal > 0 ? pendingTotal : undefined,
          }))}
          activeTab={statusTab}
          onTabChange={(id) => { setStatusTab(id as StatusTab); setSelected(new Set()); }}
          paddingX="px-4"
        />
      </div>

      {/* ── Type filter segment control ── */}
      {statusTab !== 'scheduled' && (
        <div className="px-5 py-3 border-b border-mission-control-border bg-mission-control-surface">
          <div className="inline-flex items-center bg-mission-control-bg border border-mission-control-border rounded-lg p-1 gap-0.5">
            {TYPE_FILTER_TABS.map(tab => {
              const count = pendingCounts[tab.id];
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {tab.label}
                  {statusTab === 'pending' && count > 0 && (
                    <span className={`px-1 rounded text-[10px] font-mono tabular-nums ${
                      isActive
                        ? 'text-mission-control-accent'
                        : 'text-mission-control-text-dim'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Human review banner ── */}
      {statusTab === 'pending' && <HumanReviewSection tasks={tasks} />}

      {/* ── Main list ── */}
      <div className="flex-1 overflow-y-auto relative">
        {loading ? (
          <Flex align="center" justify="center" gap="2" className="h-40 text-mission-control-text-dim">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </Flex>
        ) : approvals.length === 0 ? (
          statusTab === 'pending' ? (
            <Flex direction="column" align="center" justify="center" gap="2" className="py-20 text-center">
              <CheckCircle size={40} className="text-[var(--color-success)] mb-2" />
              <p className="text-sm font-semibold text-mission-control-text">No pending approvals</p>
              <p className="text-xs text-mission-control-text-dim max-w-xs">
                Agents are running autonomously. Items requiring human review will appear here.
              </p>
            </Flex>
          ) : (
            <EmptyState
              icon={statusTab === 'scheduled' ? CalendarClock : statusTab === 'rejected' ? ShieldX : ShieldCheck}
              title={
                statusTab === 'scheduled' ? 'No scheduled actions' :
                statusTab === 'rejected' ? 'No rejected approvals' :
                'No approved items yet'
              }
              description={
                statusTab === 'scheduled'
                  ? 'Approved actions with a future run time will appear here. You can cancel them before they fire.'
                  : undefined
              }
            />
          )
        ) : filtered.length === 0 ? (
          <Flex direction="column" align="center" justify="center" gap="2" className="py-20 text-mission-control-text-dim">
            <CheckCircle size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-medium">No items match this filter</p>
            <p className="text-xs opacity-60">Try selecting a different type</p>
          </Flex>
        ) : (
          <div className="p-5 space-y-3 pb-24">
            {filtered.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                showActions={statusTab === 'pending'}
                isScheduledView={statusTab === 'scheduled'}
                isResponding={responding.has(approval.id)}
                isEditing={editing.has(approval.id)}
                editedContent={editedContent[approval.id]}
                note={notes[approval.id] || ''}
                isSelected={selected.has(approval.id)}
                linkedTask={
                  approval.type === 'task' && approval.metadata?.taskId
                    ? tasks.find(t => t.id === approval.metadata!.taskId as string)
                    : undefined
                }
                onNoteChange={v => setNotes(prev => ({ ...prev, [approval.id]: v }))}
                onEditToggle={() => toggleEditing(approval.id, approval.metadata?.text as string || approval.content)}
                onEditContentChange={v => setEditedContent(prev => ({ ...prev, [approval.id]: v }))}
                onApprove={() => respond(approval.id, 'approved')}
                onReject={() => respond(approval.id, 'rejected')}
                onCancel={() => respond(approval.id, 'cancelled')}
                onSelect={e => { e.stopPropagation(); toggleSelect(approval.id); }}
              />
            ))}
          </div>
        )}

        {/* ── Batch action bar ── */}
        {selected.size > 0 && statusTab === 'pending' && (
          <div className="absolute bottom-0 left-0 right-0 bg-mission-control-surface border-t border-mission-control-border px-5 py-3 shadow-lg space-y-2">
            {showBatchRejectInput && (
              <Flex gap="2" align="center">
                <TextField.Root
                  type="text"
                  value={batchRejectReason}
                  onChange={e => setBatchRejectReason(e.target.value)}
                  placeholder="Rejection reason (optional)…"
                  autoFocus
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => { setShowBatchRejectInput(false); setBatchRejectReason(''); }}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </Flex>
            )}
            <Flex align="center" gap="2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                title="Clear selection"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <Square className="w-4 h-4" />
              </button>
              <span className="text-xs text-mission-control-text-dim flex-1">
                {selected.size} selected
              </span>
              <Button onClick={batchApproveSelected} disabled={batchWorking} color="grass" size="2">
                {batchWorking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Approve {selected.size}
              </Button>
              <Button onClick={batchRejectSelected} disabled={batchWorking} color="red" variant="outline" size="2">
                {batchWorking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                {showBatchRejectInput ? 'Confirm Reject' : `Reject ${selected.size}`}
              </Button>
            </Flex>
          </div>
        )}
      </div>
    </div>
  );
}
