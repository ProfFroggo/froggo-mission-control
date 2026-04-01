// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { Activity, Eye, CheckCircle, ArrowRight } from 'lucide-react';
import { useStore } from '../../store/store';
import { formatTimeAgo } from '../../utils/formatting';
import type { Task } from '../../store/store';

interface DashTaskPipelineProps {
  onNavigate?: (view: string) => void;
}

// ── Inline stat chip ──────────────────────────────────────────────────────────

interface StatChipProps {
  label: string;
  value: number;
  color: string;
}

function StatChip({ label, value, color }: StatChipProps) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={`text-lg font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-mission-control-text-dim">{label}</span>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

interface ColumnHeaderProps {
  icon: React.ReactNode;
  label: string;
  count: number;
}

function ColumnHeader({ icon, label, count }: ColumnHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-mission-control-border">
      <h3 className="text-xs font-bold text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {label}
        <span className="ml-auto text-xs font-normal tabular-nums">{count}</span>
      </h3>
    </div>
  );
}

// ── In Progress row ───────────────────────────────────────────────────────────

function InProgressRow({ task }: { task: Task }) {
  return (
    <div className="group p-2.5 rounded-lg hover:bg-mission-control-bg transition-colors">
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-info-DEFAULT mt-1.5 flex-shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-mission-control-text line-clamp-2 leading-snug">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {task.priority === 'p0' && (
              <span className="text-[10px] font-bold text-error-DEFAULT">P0</span>
            )}
            {task.priority === 'p1' && (
              <span className="text-[10px] font-bold text-warning-DEFAULT">P1</span>
            )}
            <span className="text-[10px] text-mission-control-text-dim">
              {task.assignedTo || 'unassigned'}
            </span>
            <span className="text-[10px] text-mission-control-text-dim tabular-nums ml-auto">
              {formatTimeAgo(task.updatedAt)}
            </span>
          </div>
          {task.progress != null && task.progress > 0 && (
            <div className="mt-1.5 h-1 bg-mission-control-border rounded-full overflow-hidden">
              <div
                className="h-full bg-info-DEFAULT rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── In Review row ─────────────────────────────────────────────────────────────

function InReviewRow({ task }: { task: Task }) {
  return (
    <div className="group p-2.5 rounded-lg hover:bg-mission-control-bg transition-colors">
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-review-DEFAULT mt-1.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-mission-control-text line-clamp-2 leading-snug">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {task.priority === 'p0' && (
              <span className="text-[10px] font-bold text-error-DEFAULT">P0</span>
            )}
            {task.priority === 'p1' && (
              <span className="text-[10px] font-bold text-warning-DEFAULT">P1</span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-review-subtle text-review-DEFAULT border border-review-border">
              review
            </span>
            <span className="text-[10px] text-mission-control-text-dim">
              {task.assignedTo || 'unassigned'}
            </span>
            <span className="text-[10px] text-mission-control-text-dim tabular-nums ml-auto">
              {formatTimeAgo(task.updatedAt)}
            </span>
          </div>
          {task.progress != null && task.progress > 0 && (
            <div className="mt-1.5 h-1 bg-mission-control-border rounded-full overflow-hidden">
              <div
                className="h-full bg-review-DEFAULT rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Done Today row ────────────────────────────────────────────────────────────

function DoneTodayRow({ task }: { task: Task }) {
  return (
    <div className="group p-2.5 rounded-lg hover:bg-mission-control-bg transition-colors">
      <div className="flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-success-DEFAULT mt-1.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-mission-control-text-dim line-through line-clamp-2 leading-snug">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-mission-control-text-dim">
              {task.assignedTo || 'unassigned'}
            </span>
            <span className="text-[10px] text-mission-control-text-dim tabular-nums ml-auto">
              {formatTimeAgo(task.completedAt ?? task.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashTaskPipeline({ onNavigate }: DashTaskPipelineProps) {
  const { tasks } = useStore();

  const today = new Date().toDateString();

  const inProgressTasks = tasks
    .filter((t) => t.status === 'in-progress')
    .sort((a, b) => (b.priority === 'p0' ? 1 : 0) - (a.priority === 'p0' ? 1 : 0));

  const reviewTasks = tasks.filter((t) => t.status === 'review');

  const humanReviewTasks = tasks.filter((t) => t.status === 'human-review');

  const completedTodayTasks = tasks.filter(
    (t) =>
      t.status === 'done' &&
      new Date(t.updatedAt).toDateString() === today &&
      t.assignedTo !== 'hr' &&
      !t.title.toLowerCase().includes('daily agent training') &&
      !t.title.toLowerCase().includes('health report') &&
      !t.title.toLowerCase().includes('[test]'),
  );

  const completedToday = completedTodayTasks.length;

  const visibleColumnCount = 1 + (reviewTasks.length > 0 ? 1 : 0) + (completedTodayTasks.length > 0 ? 1 : 0);
  const gridCols = visibleColumnCount === 1 ? 'grid-cols-1' : visibleColumnCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">

      {/* Stats row */}
      <div className="flex items-center gap-6 px-5 py-3 border-b border-mission-control-border">
        <StatChip label="In Progress" value={inProgressTasks.length} color="text-info-DEFAULT" />
        <StatChip label="In Review" value={reviewTasks.length} color="text-review-DEFAULT" />
        <StatChip label="Human Review" value={humanReviewTasks.length} color="text-warning-DEFAULT" />
        <StatChip label="Done Today" value={completedToday} color="text-success-DEFAULT" />
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => onNavigate?.('kanban')}
            className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-1"
          >
            View Board <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Columns — responsive based on what has content */}
      <div className={`grid ${gridCols} gap-4 p-4`}>

        {/* Column 1 — In Progress — always shown */}
        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border overflow-hidden">
          <ColumnHeader
            icon={<Activity size={14} className="text-info-DEFAULT" />}
            label="In Progress"
            count={inProgressTasks.length}
          />
          <div className="p-1.5">
            {inProgressTasks.length === 0 ? (
              <div className="flex items-center gap-1.5 py-3 px-2.5 text-mission-control-text-dim/50">
                <Activity size={11} />
                <span className="text-xs">No active work</span>
              </div>
            ) : (
              inProgressTasks.slice(0, 6).map((task) => (
                <InProgressRow key={task.id} task={task} />
              ))
            )}
          </div>
        </div>

        {/* Column 2 — In Review — only if has items */}
        {reviewTasks.length > 0 && (
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border overflow-hidden">
            <ColumnHeader
              icon={<Eye size={14} className="text-review-DEFAULT" />}
              label="In Review"
              count={reviewTasks.length}
            />
            <div className="p-1.5">
              {reviewTasks.slice(0, 6).map((task) => (
                <InReviewRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Column 3 — Done Today — only if has items */}
        {completedTodayTasks.length > 0 && (
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border overflow-hidden">
            <ColumnHeader
              icon={<CheckCircle size={14} className="text-success-DEFAULT" />}
              label="Done Today"
              count={completedToday}
            />
            <div className="p-1.5">
              {completedTodayTasks.slice(0, 6).map((task) => (
                <DoneTodayRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
