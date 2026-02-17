import { TrendingUp, Clock, CheckCircle, Target, AlertCircle, Zap } from 'lucide-react';

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
  performanceTrend?: Array<{
    completion_date: string;
    tasks_completed: number;
    rolling_7_day_total: number;
  }>;
}

interface AgentMetricsCardProps {
  agentId: string;
  agentName: string;
  metrics: AgentMetrics;
  compact?: boolean;
}

export default function AgentMetricsCard({ metrics, compact = false }: AgentMetricsCardProps) {
  // Default all metrics to safe values
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

  // Rating badges based on completion rate
  const getRatingBadge = (rate: number) => {
    if (rate >= 95) return { label: 'Excellent', color: 'text-success bg-success-subtle border-success-border' };
    if (rate >= 85) return { label: 'Great', color: 'text-info bg-info-subtle border-info-border' };
    if (rate >= 70) return { label: 'Good', color: 'text-warning bg-warning-subtle border-warning-border' };
    if (rate >= 50) return { label: 'Fair', color: 'text-warning bg-warning-subtle border-warning-border' };
    return { label: 'Needs Improvement', color: 'text-error bg-error-subtle border-error-border' };
  };

  const rating = getRatingBadge(m.completionRate);

  // Format average time
  const formatAvgTime = (hours: number) => {
    if (hours === 0) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  // Progress bar component
  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="w-full bg-clawd-bg rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    );
  };

  // Mini sparkline chart
  const Sparkline = ({ data }: { data: Array<{ completion_date: string; tasks_completed: number }> }) => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(d => d.tasks_completed), 1);
    const points = data.slice(0, 7).reverse();
    
    return (
      <div className="flex items-end gap-0.5 h-8">
        {points.map((point, i) => {
          const height = (point.tasks_completed / maxValue) * 100;
          return (
            <div
              key={i}
              className="flex-1 bg-info-subtle rounded-t transition-all"
              style={{ height: `${height}%` }}
              title={`${point.completion_date}: ${point.tasks_completed} tasks`}
            />
          );
        })}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm overflow-hidden">
        {/* Completion Rate Badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border no-shrink no-wrap ${rating.color}`}>
          <Target size={14} className="no-shrink" />
          <span className="font-semibold no-shrink">{m.completionRate.toFixed(1)}%</span>
        </div>
        
        {/* Avg Time */}
        <div className="flex items-center gap-1 text-clawd-text-dim no-shrink no-wrap">
          <Clock size={14} className="no-shrink" />
          <span className="no-shrink">{formatAvgTime(m.avgTaskTimeHours)}</span>
        </div>
        
        {/* Completed Tasks */}
        <div className="flex items-center gap-1 text-success no-shrink no-wrap">
          <CheckCircle size={14} className="no-shrink" />
          <span className="no-shrink">{m.completedTasks}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Header with Rating */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <h4 className="text-xs font-semibold text-clawd-text-dim uppercase tracking-wider flex-shrink">
          Performance Metrics
        </h4>
        <div className={`px-3 py-1 rounded-lg border text-sm font-medium no-shrink no-wrap ${rating.color}`}>
          {rating.label}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Accuracy Rate (Completion Rate) */}
        <div className="bg-clawd-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-success" />
            <span className="text-xs text-clawd-text-dim">Accuracy Rate</span>
          </div>
          <div className="text-2xl font-bold text-success">
            {m.completionRate.toFixed(1)}%
          </div>
          <ProgressBar value={m.completionRate} max={100} color="bg-green-500" />
          <div className="text-xs text-clawd-text-dim mt-1">
            {m.completedTasks} / {m.totalTasks} tasks
          </div>
        </div>

        {/* Task Completion % */}
        <div className="bg-clawd-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-info" />
            <span className="text-xs text-clawd-text-dim">Task Completion</span>
          </div>
          <div className="text-2xl font-bold text-info">
            {m.completedTasks}
          </div>
          <ProgressBar 
            value={m.completedTasks} 
            max={m.totalTasks || 1} 
            color="bg-info" 
          />
          <div className="text-xs text-clawd-text-dim mt-1">
            {m.inProgressTasks} in progress
          </div>
        </div>

        {/* Avg Task Time */}
        <div className="bg-clawd-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-review" />
            <span className="text-xs text-clawd-text-dim">Avg Task Time</span>
          </div>
          <div className="text-2xl font-bold text-review">
            {formatAvgTime(m.avgTaskTimeHours)}
          </div>
          <div className="text-xs text-clawd-text-dim mt-2">
            {m.reviewSuccessRate > 0 && (
              <span className="text-success">
                {m.reviewSuccessRate.toFixed(0)}% review pass
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {/* Recent Activity */}
        <div className="bg-clawd-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-warning" />
            <span className="text-xs text-clawd-text-dim">Last 7 Days</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-warning">
              {m.completedLast7Days}
            </span>
            <span className="text-xs text-clawd-text-dim">tasks completed</span>
          </div>
          {m.performanceTrend && (
            <div className="mt-2">
              <Sparkline data={m.performanceTrend} />
            </div>
          )}
        </div>

        {/* Subtask Progress */}
        <div className="bg-clawd-bg rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-pink-400" />
            <span className="text-xs text-clawd-text-dim">Subtask Progress</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-pink-400">
              {m.subtaskCompletionRate.toFixed(0)}%
            </span>
            <span className="text-xs text-clawd-text-dim">completion</span>
          </div>
          <ProgressBar 
            value={m.subtaskCompletionRate} 
            max={100} 
            color="bg-review" 
          />
        </div>
      </div>

      {/* Status Breakdown */}
      {(m.reviewTasks > 0 || m.blockedTasks > 0) && (
        <div className="flex items-center gap-3 text-xs text-clawd-text-dim">
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
