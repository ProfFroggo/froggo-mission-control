// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Clara Review Dashboard — dedicated full-panel view for Clara's pre-work review workflow.

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  ArrowUp,
  Circle,
  ArrowDown,
  Inbox,
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { showToast } from './Toast';
import { useEventBus } from '../lib/useEventBus';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewTask {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  planningNotes?: string;
  priority?: string;
  createdAt: number;
  subtaskCount: number;
}

interface Insights {
  pendingReview: number;
  approvedToday: number;
  rejectedToday: number;
  approvalRate: number;
  avgReviewMinutes: number;
  topRejectionReasons: { reason: string; count: number }[];
  agentsNeedingSupport: { agentId: string; name: string; rejectionCount: number }[];
}

// ── Priority badge ─────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  p0: { label: 'Urgent', color: 'text-error', icon: <AlertTriangle size={12} className="flex-shrink-0" /> },
  p1: { label: 'High', color: 'text-warning', icon: <ArrowUp size={12} className="flex-shrink-0" /> },
  p2: { label: 'Medium', color: 'text-info', icon: <Circle size={12} className="flex-shrink-0" /> },
  p3: { label: 'Low', color: 'text-mission-control-text-dim', icon: <ArrowDown size={12} className="flex-shrink-0" /> },
};

function PriorityBadge({ priority }: { priority?: string }) {
  const cfg = PRIORITY_CONFIG[priority ?? 'p2'] ?? PRIORITY_CONFIG.p2;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Gate row ──────────────────────────────────────────────────────────────────

function GateRow({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2 size={14} className="text-success flex-shrink-0" />
      ) : (
        <XCircle size={14} className="text-error flex-shrink-0" />
      )}
      <span className={passed ? 'text-mission-control-text' : 'text-mission-control-text-dim line-through'}>
        {label}
      </span>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ insights }: { insights: Insights | null }) {
  if (!insights) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Pending review" value={insights.pendingReview} icon={<Clock size={16} />} />
      <StatCard label="Approved today" value={insights.approvedToday} icon={<ShieldCheck size={16} />} accent="text-success" />
      <StatCard label="Rejected today" value={insights.rejectedToday} icon={<ShieldX size={16} />} accent="text-error" />
      <StatCard
        label="30d approval rate"
        value={`${insights.approvalRate}%`}
        icon={<BarChart3 size={16} />}
        accent={insights.approvalRate >= 70 ? 'text-success' : 'text-warning'}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = 'text-mission-control-text',
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-3">
      <div className="flex items-center gap-2 text-mission-control-text-dim mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({
  task,
  onApprove,
  onReject,
}: {
  task: ReviewTask;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const gate1 = !!task.assignedTo;
  const gate2 = !!(task.planningNotes?.trim());
  const gate3 = task.subtaskCount >= 1;
  const allGatesPass = gate1 && gate2 && gate3;

  async function handleApprove() {
    setLoading(true);
    try {
      await onApprove(task.id);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      showToast('error', 'Rejection reason required');
      return;
    }
    setLoading(true);
    try {
      await onReject(task.id, reason.trim());
      setRejecting(false);
      setReason('');
    } finally {
      setLoading(false);
    }
  }

  const timeAgo = (() => {
    const diff = Date.now() - task.createdAt;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <div className="rounded-lg border border-mission-control-border bg-mission-control-surface overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {task.assignedTo ? (
            <AgentAvatar agentId={task.assignedTo} size="sm" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-mission-control-bg2 flex items-center justify-center text-mission-control-text-dim text-xs font-bold">
              ?
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-mission-control-text leading-snug">
              {task.title}
            </h3>
            <PriorityBadge priority={task.priority} />
          </div>
          {task.description && (
            <p className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-mission-control-text-dim">
            <span>{task.assignedTo ?? 'Unassigned'}</span>
            <span>·</span>
            <span>{task.subtaskCount} subtask{task.subtaskCount !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 p-1 rounded text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg2 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Gate checklist — always visible */}
      <div className="border-t border-mission-control-border px-4 py-3 bg-mission-control-bg0/40 space-y-1.5">
        <GateRow passed={gate1} label="Gate 1: Agent assigned" />
        <GateRow passed={gate2} label="Gate 2: Planning notes present" />
        <GateRow passed={gate3} label="Gate 3: At least 1 subtask" />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-mission-control-border px-4 py-3 bg-mission-control-bg0/20">
          {task.planningNotes ? (
            <div>
              <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-1">
                Planning Notes
              </div>
              <p className="text-xs text-mission-control-text whitespace-pre-wrap line-clamp-6">
                {task.planningNotes}
              </p>
            </div>
          ) : (
            <p className="text-xs text-mission-control-text-dim italic">No planning notes.</p>
          )}
        </div>
      )}

      {/* Reject reason textarea */}
      {rejecting && (
        <div className="border-t border-mission-control-border px-4 py-3">
          <label className="block text-xs font-medium text-mission-control-text-dim mb-1">
            Rejection reason
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Explain what needs to be fixed before this task can proceed..."
            className="w-full text-sm resize-none"
          />
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-mission-control-border px-4 py-3 flex items-center gap-2">
        {rejecting ? (
          <>
            <button
              onClick={handleReject}
              disabled={loading || !reason.trim()}
              className="flex-1 py-1.5 rounded text-sm font-medium bg-error text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? 'Rejecting...' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => { setRejecting(false); setReason(''); }}
              disabled={loading}
              className="py-1.5 px-3 rounded text-sm text-mission-control-text-dim border border-mission-control-border hover:bg-mission-control-bg2 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleApprove}
              disabled={loading || !allGatesPass}
              title={!allGatesPass ? 'All 3 gates must pass before approving' : 'Approve and dispatch agent'}
              className="flex-1 py-1.5 rounded text-sm font-medium bg-success text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? 'Approving...' : 'Approve'}
            </button>
            <button
              onClick={() => setRejecting(true)}
              disabled={loading}
              className="py-1.5 px-3 rounded text-sm font-medium border border-error text-error hover:bg-error/10 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClaraReviewDashboard() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?status=internal-review');
      if (!res.ok) return;
      const data = await res.json() as unknown;
      const raw: Record<string, unknown>[] = Array.isArray(data) ? data as Record<string, unknown>[] : [];

      // Fetch subtask counts in parallel
      const enriched = await Promise.all(
        raw.map(async (t) => {
          let subtaskCount = 0;
          try {
            const sr = await fetch(`/api/tasks/${t.id as string}/subtasks`);
            if (sr.ok) {
              const sd = await sr.json() as unknown[];
              subtaskCount = Array.isArray(sd) ? sd.length : 0;
            }
          } catch { /* non-critical */ }
          return {
            id: t.id as string,
            title: t.title as string,
            description: t.description as string | undefined,
            assignedTo: t.assignedTo as string | undefined,
            planningNotes: t.planningNotes as string | undefined,
            priority: t.priority as string | undefined,
            createdAt: t.createdAt as number,
            subtaskCount,
          };
        })
      );

      // Sort by createdAt ascending — oldest review requests surface first
      enriched.sort((a, b) => a.createdAt - b.createdAt);
      setTasks(enriched);
    } catch { /* non-critical */ }
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch('/api/clara/insights');
      if (!res.ok) return;
      const data = await res.json() as Insights;
      setInsights(data);
    } catch { /* non-critical */ }
  }, []);

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    await Promise.all([fetchQueue(), fetchInsights()]);
    if (showSpinner) setRefreshing(false);
  }, [fetchQueue, fetchInsights]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Auto-refresh and toast when a task enters review
  useEventBus('clara.review_needed', useCallback((data: unknown) => {
    const d = data as { title?: string };
    showToast('info', 'New task in pre-review', d?.title ?? 'A task needs Clara review');
    refresh();
  }, [refresh]));

  // Refresh on any task update
  useEventBus('task.updated', useCallback(() => {
    refresh();
  }, [refresh]));

  async function handleApprove(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json() as { error?: string; failures?: string[] };
      const msg = err.failures ? err.failures.join('; ') : (err.error ?? 'Approve failed');
      showToast('error', 'Cannot approve', msg);
      return;
    }
    showToast('success', 'Task approved', 'Agent dispatched');
    setTasks(prev => prev.filter(t => t.id !== taskId));
    fetchInsights();
  }

  async function handleReject(taskId: string, reason: string) {
    const res = await fetch(`/api/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      showToast('error', 'Reject failed', err.error ?? 'Unknown error');
      return;
    }
    showToast('success', 'Task rejected', 'Returned to todo with notes');
    setTasks(prev => prev.filter(t => t.id !== taskId));
    fetchInsights();
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-mission-control-text">Clara Review Queue</h2>
          <p className="text-sm text-mission-control-text-dim">Pre-work gate — approve or reject tasks before agents start</p>
        </div>
        <button
          onClick={() => refresh(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border border-mission-control-border text-mission-control-text-dim hover:bg-mission-control-bg2 hover:text-mission-control-text transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <StatsBar insights={insights} />

      {/* Review queue */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-mission-control-text-dim text-sm">
          <RefreshCw size={16} className="animate-spin mr-2" />
          Loading review queue...
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-mission-control-text-dim gap-3">
          <Inbox size={32} className="opacity-40" />
          <p className="text-sm">No tasks awaiting review</p>
          <p className="text-xs opacity-60">Tasks enter this queue when an agent is assigned to a todo task</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {tasks.map(task => (
            <ReviewCard
              key={task.id}
              task={task}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* Agents needing support */}
      {insights && insights.agentsNeedingSupport.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-warning flex-shrink-0" />
            <h3 className="text-sm font-medium text-warning">Agents with repeated rejections (last 7d)</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.agentsNeedingSupport.map(agent => (
              <div key={agent.agentId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-mission-control-surface border border-mission-control-border text-xs">
                <AgentAvatar agentId={agent.agentId} size="xs" />
                <span className="text-mission-control-text">{agent.name}</span>
                <span className="text-error font-medium">{agent.rejectionCount}x rejected</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top rejection reasons */}
      {insights && insights.topRejectionReasons.length > 0 && (
        <div className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
          <h3 className="text-sm font-medium text-mission-control-text mb-3">Top rejection reasons (last 30d)</h3>
          <div className="space-y-2">
            {insights.topRejectionReasons.map((r, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-error/20 text-error font-bold flex items-center justify-center">
                  {r.count}
                </span>
                <span className="text-mission-control-text-dim leading-snug">{r.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
