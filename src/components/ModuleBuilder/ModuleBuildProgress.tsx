// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { Circle, Clock, Eye, User, CheckCircle2, ExternalLink } from 'lucide-react';
import { useEventBus } from '@/lib/useEventBus';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  moduleId: string | null;
}

interface ProgressData {
  tasks: TaskRow[];
  total: number;
  completed: number;
  inProgress: number;
  progressPct: number;
}

interface Props {
  moduleId: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  'todo': <Circle size={14} className="text-mission-control-text-dim" />,
  'internal-review': <Eye size={14} className="text-yellow-400" />,
  'in-progress': <Clock size={14} className="text-blue-400" />,
  'agent-review': <Eye size={14} className="text-orange-400" />,
  'human-review': <User size={14} className="text-purple-400" />,
  'done': <CheckCircle2 size={14} className="text-green-400" />,
};

const STATUS_LABEL: Record<string, string> = {
  'todo': 'To Do',
  'internal-review': 'Internal Review',
  'in-progress': 'In Progress',
  'agent-review': 'Agent Review',
  'human-review': 'Human Review',
  'done': 'Done',
};

export default function ModuleBuildProgress({ moduleId }: Props) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/modules/${moduleId}/tasks`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, [moduleId]);

  // Initial fetch
  useEffect(() => {
    fetchProgress();
    // Poll every 30s as fallback
    const interval = setInterval(fetchProgress, 30000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  // Refetch on task events
  useEventBus('task.updated', (eventData) => {
    const d = eventData as { moduleId?: string };
    if (!d?.moduleId || d.moduleId === moduleId) fetchProgress();
  });
  useEventBus('task.created', () => fetchProgress());

  if (loading) {
    return (
      <div className="rounded-xl border border-mission-control-border p-4 text-mission-control-text-dim text-sm">
        Loading build progress...
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="rounded-xl border border-mission-control-border p-4 text-mission-control-text-dim text-sm">
        No tasks found for this module.
      </div>
    );
  }

  const allDone = data.completed === data.total;

  return (
    <div className="rounded-xl border border-mission-control-border bg-mission-control-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-mission-control-text">Build Progress</h3>
          <span className="text-xs text-mission-control-text-dim">
            {data.completed}/{data.total} tasks complete
            {data.inProgress > 0 && ` · ${data.inProgress} in progress`}
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-mission-control-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${data.progressPct}%`,
              background: allDone ? 'var(--color-success)' : 'var(--color-accent)',
            }}
          />
        </div>
        <p className="text-xs text-mission-control-text-dim mt-1">{data.progressPct}% complete</p>
      </div>

      {/* Task phase list */}
      <div className="divide-y divide-mission-control-border/50">
        {data.tasks.map(task => (
          <div key={task.id} className="flex items-start gap-3 px-4 py-2.5">
            <div className="mt-0.5 flex-shrink-0">
              {STATUS_ICON[task.status] ?? <Circle size={14} className="text-mission-control-text-dim" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-mission-control-text leading-snug truncate">{task.title}</p>
              <p className="text-[10px] text-mission-control-text-dim mt-0.5">
                {STATUS_LABEL[task.status] ?? task.status}
                {task.assignedTo && ` · ${task.assignedTo}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-mission-control-border flex items-center gap-3">
        {allDone ? (
          <div className="flex items-center gap-2 text-sm text-green-400 font-medium">
            <CheckCircle2 size={16} />
            Module complete
          </div>
        ) : null}
        <a
          href={`/?filter=moduleId:${moduleId}`}
          className="ml-auto flex items-center gap-1.5 text-xs text-mission-control-accent hover:opacity-80 transition-opacity"
        >
          View in Kanban <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
