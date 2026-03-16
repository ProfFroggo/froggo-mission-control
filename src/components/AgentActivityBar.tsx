/**
 * AgentActivityBar — compact live activity indicator in the sidebar.
 * Shows animated dots for each agent currently working on an in-progress task.
 * Tooltip shows the task name. Click jumps to that agent's view or the task directly.
 */

import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../store/store';
import AgentAvatar from './AgentAvatar';

const PHANTOM_AGENTS = ['main', 'chat-agent'];

/** Format elapsed time since a timestamp as a compact string, e.g. "3m", "1h 2m" */
function formatElapsed(sinceMs: number): string {
  const elapsed = Math.max(0, Date.now() - sinceMs);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

interface AgentActivityBarProps {
  onNavigate?: (view: string) => void;
  onTaskClick?: (taskId: string) => void;
  expanded?: boolean;
}

export default function AgentActivityBar({ onNavigate, onTaskClick, expanded = true }: AgentActivityBarProps) {
  const tasks = useStore(s => s.tasks);
  const agents = useStore(s => s.agents);

  // Tick every minute to keep elapsed time fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Find agents with in-progress tasks
  const activeWork = useMemo(() => {
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress' && t.assignedTo);
    const agentMap = new Map(agents.map(a => [a.id, a]));
    return inProgressTasks
      .slice(0, 5)
      .map(task => {
        const agent = agentMap.get(task.assignedTo!);
        if (!agent || PHANTOM_AGENTS.includes(agent.id)) return null;
        return { task, agent };
      })
      .filter(Boolean) as { task: (typeof tasks)[0]; agent: (typeof agents)[0] }[];
  }, [tasks, agents]);

  if (activeWork.length === 0) return null;

  return (
    <div
      className={`mx-2 mb-2 p-2 rounded-lg bg-mission-control-bg/60 border border-mission-control-border/60 ${
        expanded ? '' : 'flex flex-col items-center gap-1.5'
      }`}
      title={expanded ? undefined : `${activeWork.length} agent${activeWork.length !== 1 ? 's' : ''} working`}
    >
      {expanded && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <span className="text-[10px] font-semibold text-mission-control-text-dim uppercase tracking-wider">
            Live
          </span>
        </div>
      )}
      <div className={expanded ? 'space-y-1.5' : 'flex flex-col items-center gap-1.5'}>
        {activeWork.map(({ task, agent }) => {
          const elapsed = formatElapsed(
            typeof task.updatedAt === 'number' ? task.updatedAt : new Date(task.updatedAt).getTime()
          );
          return (
            <button
              key={task.id}
              onClick={() => {
                if (onTaskClick) {
                  onTaskClick(task.id);
                } else {
                  onNavigate?.('kanban');
                }
              }}
              title={`${agent.name}: ${task.title} (${elapsed})`}
              className={`flex items-center gap-2 w-full rounded-lg transition-colors hover:bg-mission-control-border/50 ${
                expanded ? 'px-1 py-1' : 'p-0'
              }`}
            >
              <div className="relative flex-shrink-0">
                <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse ring-1 ring-mission-control-surface" />
              </div>
              {expanded && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-medium text-mission-control-text truncate leading-tight">
                      {agent.name}
                    </p>
                    <span className="text-[9px] text-mission-control-text-dim/70 flex-shrink-0 leading-tight">
                      {elapsed}
                    </span>
                  </div>
                  <p className="text-[9px] text-mission-control-text-dim truncate leading-tight">
                    {task.title}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
