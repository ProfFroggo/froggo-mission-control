// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashInterventionQueue — Zone 3 right sidebar action center.
 * Prioritized queue of everything needing Kevin's attention right now.
 * Priority order: pending approvals → human-review tasks → P0 tasks → unassigned tasks
 */

import {
  AlertTriangle,
  Zap,
  PauseCircle,
  CircleDashed,
  Mail,
  Send,
  MessageSquare,
  ListTodo,
} from 'lucide-react';
import { useStore } from '../../store/store';
import type { ApprovalItem, Task } from '../../store/store';
import { formatTimeAgo } from '../../utils/formatting';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashInterventionQueueProps {
  onNavigate?: (view: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApprovalTypeIcon(type: ApprovalItem['type']): React.ElementType {
  switch (type) {
    case 'tweet':   return Send;
    case 'reply':   return MessageSquare;
    case 'email':   return Mail;
    case 'message': return MessageSquare;
    case 'task':    return ListTodo;
    case 'action':  return Zap;
    default:        return Zap;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ApprovalRowProps {
  approval: ApprovalItem;
  onApprove: () => void;
  onReject: () => void;
}

function ApprovalRow({ approval, onApprove, onReject }: ApprovalRowProps) {
  const TypeIcon = getApprovalTypeIcon(approval.type);

  return (
    <div className="group p-3 rounded-lg bg-mission-control-bg border border-mission-control-border hover:border-warning-border transition-colors">
      <div className="flex items-start gap-2 mb-2">
        <TypeIcon size={14} className="text-warning-DEFAULT mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-mission-control-text truncate">{approval.title}</p>
          <p className="text-xs text-mission-control-text-dim">
            {formatTimeAgo(approval.createdAt)} &bull; {approval.type}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 py-1 rounded text-xs font-medium bg-success-subtle text-success-DEFAULT border border-success-border hover:bg-success-DEFAULT hover:text-black transition-colors"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-1 rounded text-xs font-medium bg-error-subtle text-error-DEFAULT border border-error-border hover:bg-error-DEFAULT hover:text-white transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

interface HumanReviewRowProps {
  task: Task;
}

function HumanReviewRow({ task }: HumanReviewRowProps) {
  return (
    <div className="p-3 rounded-lg bg-mission-control-bg border border-warning-border">
      <div className="flex items-center gap-2">
        <PauseCircle size={14} className="text-warning-DEFAULT flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-mission-control-text truncate">{task.title}</p>
          <p className="text-xs text-mission-control-text-dim">
            Human review &bull; {task.assignedTo || 'Unassigned'}
          </p>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-warning-subtle text-warning-DEFAULT border border-warning-border whitespace-nowrap">
          review
        </span>
      </div>
    </div>
  );
}

interface P0RowProps {
  task: Task;
}

function P0Row({ task }: P0RowProps) {
  return (
    <div className="p-3 rounded-lg bg-mission-control-bg border border-error-border">
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-error-DEFAULT flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-mission-control-text truncate">{task.title}</p>
          <p className="text-xs text-mission-control-text-dim">
            P0 &bull; {task.assignedTo || 'Unassigned'} &bull; {formatTimeAgo(task.updatedAt)}
          </p>
        </div>
        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-error-subtle text-error-DEFAULT">
          P0
        </span>
      </div>
    </div>
  );
}

interface UnassignedRowProps {
  task: Task;
}

function UnassignedRow({ task }: UnassignedRowProps) {
  return (
    <div className="p-2 rounded-lg bg-mission-control-bg border border-mission-control-border text-xs flex items-center gap-2">
      <CircleDashed size={12} className="text-mission-control-text-dim flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate text-mission-control-text">{task.title}</span>
      <span className="text-mission-control-text-dim whitespace-nowrap">{task.priority?.toUpperCase() ?? 'no priority'}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashInterventionQueue({ onNavigate }: DashInterventionQueueProps) {
  const { tasks, approvals, approveItem, rejectItem, connected } = useStore();

  if (!connected) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning-DEFAULT" />
            Needs Attention
          </h2>
        </div>
        <div className="flex items-center gap-1.5 py-2 px-1">
          <div className="w-3 h-3 rounded bg-mission-control-border animate-pulse" />
          <div className="w-24 h-3 rounded bg-mission-control-border animate-pulse" />
        </div>
      </div>
    );
  }

  const hasApproveItem = typeof approveItem === 'function';
  const hasRejectItem = typeof rejectItem === 'function';

  // Priority 1: Pending approvals, oldest first (most overdue = most urgent)
  const pendingApprovals = approvals
    .filter((a) => a.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);

  // Priority 2: Tasks blocked waiting for human decision
  const humanReviewTasks = tasks.filter((t) => t.status === 'human-review');

  // Priority 3: P0 urgent tasks that aren't done or cancelled
  const p0Tasks = tasks.filter(
    (t) => t.priority === 'p0' && t.status !== 'done' && t.status !== 'cancelled'
  );

  // Priority 4: Unassigned tasks (not done/cancelled/internal-review), capped at 3
  const unassignedTasks = tasks
    .filter(
      (t) =>
        !t.assignedTo &&
        !['done', 'cancelled', 'internal-review'].includes(t.status)
    )
    .slice(0, 3);

  const totalCount =
    pendingApprovals.length +
    humanReviewTasks.length +
    p0Tasks.length +
    unassignedTasks.length;

  function handleApprove(id: string) {
    if (hasApproveItem) {
      approveItem(id);
    } else {
      onNavigate?.('approvals');
    }
  }

  function handleReject(id: string) {
    if (hasRejectItem) {
      rejectItem(id);
    } else {
      onNavigate?.('approvals');
    }
  }

  if (totalCount === 0) return null;

  return (
    <div className="space-y-1">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <AlertTriangle size={16} className="text-warning-DEFAULT" />
          Needs Attention
        </h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-error-subtle text-error-DEFAULT border border-error-border tabular-nums">
          {totalCount}
        </span>
      </div>

      {/* Priority 1: Pending approvals */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-1">
          {pendingApprovals.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              onApprove={() => handleApprove(approval.id)}
              onReject={() => handleReject(approval.id)}
            />
          ))}
        </div>
      )}

      {/* Priority 2: Human-review tasks */}
      {humanReviewTasks.length > 0 && (
        <div className="space-y-1">
          {humanReviewTasks.map((task) => (
            <HumanReviewRow key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Priority 3: P0 urgent tasks */}
      {p0Tasks.length > 0 && (
        <div className="space-y-1">
          {p0Tasks.map((task) => (
            <P0Row key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* Priority 4: Unassigned tasks (max 3, compact) */}
      {unassignedTasks.length > 0 && (
        <div className="space-y-1">
          {unassignedTasks.map((task) => (
            <UnassignedRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
