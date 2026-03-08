import type { ElementType } from 'react';
import { TrendingUp, Clock, CheckCircle, Target, AlertCircle, Zap, Users, Shield, Inbox, GitBranch, BookOpen, ThumbsUp, ThumbsDown } from 'lucide-react';

// ── Shared helpers ────────────────────────────────────────────────────────────

const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-mission-control-bg rounded-full h-1.5 overflow-hidden mt-1">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, color = 'text-mission-control-text', sub }: {
  icon: ElementType; label: string; value: string | number; color?: string; sub?: string;
}) => (
  <div className="bg-mission-control-bg rounded-lg p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={13} className={color} />
      <span className="text-xs text-mission-control-text-dim">{label}</span>
    </div>
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-xs text-mission-control-text-dim mt-0.5">{sub}</div>}
  </div>
);

// ── Role-specific views ───────────────────────────────────────────────────────

function OrchestratorMetrics({ m, compact }: { m: Record<string, number>; compact: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm overflow-hidden">
        <div className="flex items-center gap-1 text-mission-control-text-dim no-shrink">
          <Users size={13} />
          <span>{m.agentsActive ?? 0}/{m.agentsTotal ?? 0} active</span>
        </div>
        <div className="flex items-center gap-1 text-info no-shrink">
          <GitBranch size={13} />
          <span>{m.dispatches ?? 0} dispatches</span>
        </div>
        <div className="flex items-center gap-1 text-warning no-shrink">
          <Target size={13} />
          <span>{m.openTasks ?? 0} open</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Orchestration Metrics</h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/20">Command</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Users} label="Agents Active" value={`${m.agentsActive ?? 0}/${m.agentsTotal ?? 0}`} color="text-mission-control-accent" />
        <Stat icon={GitBranch} label="Dispatches" value={m.dispatches ?? 0} color="text-info" sub="tasks dispatched" />
        <Stat icon={Target} label="Open Tasks" value={m.openTasks ?? 0} color="text-warning" sub="being overseen" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Zap} label="Cron Runs" value={m.cronRuns ?? 0} color="text-success" sub="scheduled jobs" />
        <Stat icon={TrendingUp} label="Last 7 Days" value={m.actionsLast7Days ?? 0} color="text-pink-400" sub="actions taken" />
      </div>
    </div>
  );
}

function HRMetrics({ m, compact }: { m: Record<string, number>; compact: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm overflow-hidden">
        <div className="flex items-center gap-1 text-mission-control-text-dim no-shrink">
          <Users size={13} />
          <span>{m.agentsTotal ?? 0} agents</span>
        </div>
        <div className="flex items-center gap-1 text-success no-shrink">
          <BookOpen size={13} />
          <span>{m.skillSlotsTotal ?? 0} skills</span>
        </div>
        <div className="flex items-center gap-1 text-info no-shrink">
          <CheckCircle size={13} />
          <span>{m.problemsResolved ?? 0} resolved</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">HR Metrics</h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-success-subtle text-success border border-success-border">People Ops</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Users} label="Agent Roster" value={m.agentsTotal ?? 0} color="text-mission-control-accent" sub="total agents" />
        <Stat icon={BookOpen} label="Skills Distributed" value={m.skillSlotsTotal ?? 0} color="text-success" sub={`${m.agentsWithSkills ?? 0} agents trained`} />
        <Stat icon={CheckCircle} label="Problems Resolved" value={m.problemsResolved ?? 0} color="text-info" sub="HR tasks done" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Shield} label="Reviews Done" value={m.reviewsDone ?? 0} color="text-warning" sub="approvals handled" />
        <Stat icon={TrendingUp} label="Last 7 Days" value={m.actionsLast7Days ?? 0} color="text-pink-400" sub="actions taken" />
      </div>
    </div>
  );
}

function QCMetrics({ m, compact }: { m: Record<string, number>; compact: boolean }) {
  const passRate = m.passRate ?? 0;
  const ratingColor = passRate >= 90 ? 'text-success' : passRate >= 75 ? 'text-warning' : 'text-error';
  const ratingBg = passRate >= 90 ? 'bg-success-subtle text-success border-success-border' : passRate >= 75 ? 'bg-warning-subtle text-warning border-warning-border' : 'bg-error-subtle text-error border-error-border';
  const ratingLabel = passRate >= 90 ? 'High Quality' : passRate >= 75 ? 'Good' : 'Needs Attention';

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm overflow-hidden">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border no-shrink ${ratingBg}`}>
          <Shield size={13} />
          <span className="font-semibold">{passRate.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1 text-success no-shrink">
          <ThumbsUp size={13} />
          <span>{m.reviewsApproved ?? 0}</span>
        </div>
        <div className="flex items-center gap-1 text-error no-shrink">
          <ThumbsDown size={13} />
          <span>{m.reviewsRejected ?? 0}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Quality Control</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${ratingBg}`}>{ratingLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield size={13} className={ratingColor} />
            <span className="text-xs text-mission-control-text-dim">Pass Rate</span>
          </div>
          <div className={`text-xl font-bold ${ratingColor}`}>{passRate.toFixed(1)}%</div>
          <ProgressBar value={passRate} max={100} color={passRate >= 90 ? 'bg-green-500' : passRate >= 75 ? 'bg-yellow-500' : 'bg-red-500'} />
          <div className="text-xs text-mission-control-text-dim mt-1">{m.reviewsTotal ?? 0} total reviews</div>
        </div>
        <Stat icon={ThumbsUp} label="Approved" value={m.reviewsApproved ?? 0} color="text-success" sub="passed review" />
        <Stat icon={ThumbsDown} label="Rejected" value={m.reviewsRejected ?? 0} color="text-error" sub="sent back" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Clock} label="Awaiting Review" value={m.awaitingReview ?? 0} color="text-warning" sub="in queue" />
        <Stat icon={AlertCircle} label="Escalated" value={m.escalatedToHuman ?? 0} color="text-review" sub="to human-review" />
      </div>
    </div>
  );
}

function InboxMetrics({ m, compact }: { m: Record<string, number>; compact: boolean }) {
  const readRate = (m.messagesTotal ?? 0) > 0
    ? Math.round(((m.messagesRead ?? 0) / m.messagesTotal) * 100)
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm overflow-hidden">
        <div className="flex items-center gap-1 text-mission-control-text-dim no-shrink">
          <Inbox size={13} />
          <span>{m.messagesTotal ?? 0} msgs</span>
        </div>
        <div className="flex items-center gap-1 text-success no-shrink">
          <CheckCircle size={13} />
          <span>{m.approvalsHandled ?? 0} approvals</span>
        </div>
        <div className="flex items-center gap-1 text-info no-shrink">
          <Zap size={13} />
          <span>{m.actionsLast7Days ?? 0} this week</span>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Communications</h4>
        <span className="text-xs px-2 py-0.5 rounded-full bg-info-subtle text-info border border-info-border">Auto-Comms</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Inbox size={13} className="text-info" />
            <span className="text-xs text-mission-control-text-dim">Messages</span>
          </div>
          <div className="text-xl font-bold text-info">{m.messagesTotal ?? 0}</div>
          <ProgressBar value={m.messagesRead ?? 0} max={m.messagesTotal || 1} color="bg-info" />
          <div className="text-xs text-mission-control-text-dim mt-1">{readRate}% processed</div>
        </div>
        <Stat icon={CheckCircle} label="Approvals" value={m.approvalsHandled ?? 0} color="text-success" sub="handled" />
        <Stat icon={GitBranch} label="Tasks Created" value={m.tasksCreated ?? 0} color="text-mission-control-accent" sub="from inbox" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Zap} label="Last 7 Days" value={m.actionsLast7Days ?? 0} color="text-warning" sub="auto-actions" />
        <Stat icon={TrendingUp} label="Total Actions" value={m.totalActions ?? 0} color="text-pink-400" sub="all time" />
      </div>
    </div>
  );
}

// ── Standard task-based metrics ───────────────────────────────────────────────

interface AgentMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  blockedTasks: number;
  completionRate: number;
  avgTaskTimeHours: number;
  reviewSuccessRate: number;
  completedLast7Days: number;
  subtaskCompletionRate: number;
  performanceTrend?: Array<{ completion_date: string; tasks_completed: number; rolling_7_day_total: number }>;
  // Role-specific fields
  _role?: string;
  [key: string]: unknown;
}

interface AgentMetricsCardProps {
  agentId: string;
  agentName: string;
  metrics: AgentMetrics;
  compact?: boolean;
}

export default function AgentMetricsCard({ agentId, agentName: _agentName, metrics, compact = false }: AgentMetricsCardProps) {
  const role = metrics?._role;

  // Route to role-specific view
  if (role === 'orchestrator') return <OrchestratorMetrics m={metrics as unknown as Record<string, number>} compact={compact} />;
  if (role === 'hr')           return <HRMetrics           m={metrics as unknown as Record<string, number>} compact={compact} />;
  if (role === 'qc')           return <QCMetrics           m={metrics as unknown as Record<string, number>} compact={compact} />;
  if (role === 'inbox')        return <InboxMetrics        m={metrics as unknown as Record<string, number>} compact={compact} />;

  // ── Standard task-based metrics ───────────────────────────────────────────
  const m: AgentMetrics = {
    totalTasks: metrics?.totalTasks ?? 0,
    completedTasks: metrics?.completedTasks ?? 0,
    inProgressTasks: metrics?.inProgressTasks ?? 0,
    reviewTasks: metrics?.reviewTasks ?? 0,
    blockedTasks: metrics?.blockedTasks ?? 0,
    completionRate: metrics?.completionRate ?? 0,
    avgTaskTimeHours: metrics?.avgTaskTimeHours ?? 0,
    reviewSuccessRate: metrics?.reviewSuccessRate ?? 0,
    completedLast7Days: metrics?.completedLast7Days ?? 0,
    subtaskCompletionRate: metrics?.subtaskCompletionRate ?? 0,
    performanceTrend: metrics?.performanceTrend,
  };

  const getRatingBadge = (rate: number) => {
    if (rate >= 95) return { label: 'Excellent', color: 'text-success bg-success-subtle border-success-border' };
    if (rate >= 85) return { label: 'Great',     color: 'text-info bg-info-subtle border-info-border' };
    if (rate >= 70) return { label: 'Good',      color: 'text-warning bg-warning-subtle border-warning-border' };
    if (rate >= 50) return { label: 'Fair',      color: 'text-warning bg-warning-subtle border-warning-border' };
    return { label: 'Needs Improvement', color: 'text-error bg-error-subtle border-error-border' };
  };

  const rating = getRatingBadge(m.completionRate);

  const formatAvgTime = (h: number) => {
    if (h === 0) return 'N/A';
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
  };

  const Sparkline = ({ data }: { data: Array<{ tasks_completed: number }> }) => {
    if (!data?.length) return null;
    const maxVal = Math.max(...data.map(d => d.tasks_completed), 1);
    return (
      <div className="flex items-end gap-0.5 h-8">
        {data.slice(0, 7).reverse().map((p, i) => (
          <div key={i} className="flex-1 bg-info-subtle rounded-t transition-all"
            style={{ height: `${(p.tasks_completed / maxVal) * 100}%` }} />
        ))}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm overflow-hidden">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border no-shrink no-wrap ${rating.color}`}>
          <Target size={14} className="no-shrink" />
          <span className="font-semibold no-shrink">{m.completionRate.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1 text-mission-control-text-dim no-shrink no-wrap">
          <Clock size={14} className="no-shrink" />
          <span className="no-shrink">{formatAvgTime(m.avgTaskTimeHours)}</span>
        </div>
        <div className="flex items-center gap-1 text-success no-shrink no-wrap">
          <CheckCircle size={14} className="no-shrink" />
          <span className="no-shrink">{m.completedTasks}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h4 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider flex-shrink">
          Performance Metrics
        </h4>
        <div className={`px-3 py-1 rounded-lg border text-sm font-medium no-shrink no-wrap ${rating.color}`}>
          {rating.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-success" />
            <span className="text-xs text-mission-control-text-dim">Accuracy Rate</span>
          </div>
          <div className="text-2xl font-bold text-success">{m.completionRate.toFixed(1)}%</div>
          <ProgressBar value={m.completionRate} max={100} color="bg-green-500" />
          <div className="text-xs text-mission-control-text-dim mt-1">{m.completedTasks} / {m.totalTasks} tasks</div>
        </div>

        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-info" />
            <span className="text-xs text-mission-control-text-dim">Task Completion</span>
          </div>
          <div className="text-2xl font-bold text-info">{m.completedTasks}</div>
          <ProgressBar value={m.completedTasks} max={m.totalTasks || 1} color="bg-info" />
          <div className="text-xs text-mission-control-text-dim mt-1">{m.inProgressTasks} in progress</div>
        </div>

        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-review" />
            <span className="text-xs text-mission-control-text-dim">Avg Task Time</span>
          </div>
          <div className="text-2xl font-bold text-review">{formatAvgTime(m.avgTaskTimeHours)}</div>
          <div className="text-xs text-mission-control-text-dim mt-2">
            {m.reviewSuccessRate > 0 && (
              <span className="text-success">{m.reviewSuccessRate.toFixed(0)}% review pass</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-warning" />
            <span className="text-xs text-mission-control-text-dim">Last 7 Days</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-warning">{m.completedLast7Days}</span>
            <span className="text-xs text-mission-control-text-dim">tasks completed</span>
          </div>
          {m.performanceTrend && <div className="mt-2"><Sparkline data={m.performanceTrend} /></div>}
        </div>

        <div className="bg-mission-control-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-pink-400" />
            <span className="text-xs text-mission-control-text-dim">Subtask Progress</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-pink-400">{m.subtaskCompletionRate.toFixed(0)}%</span>
            <span className="text-xs text-mission-control-text-dim">completion</span>
          </div>
          <ProgressBar value={m.subtaskCompletionRate} max={100} color="bg-review" />
        </div>
      </div>

      {(m.reviewTasks > 0 || m.blockedTasks > 0) && (
        <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
          {m.reviewTasks > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-info" />
              <span>{m.reviewTasks} in review</span>
            </div>
          )}
          {m.blockedTasks > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle size={14} className="text-error" />
              <span>{m.blockedTasks} blocked</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
