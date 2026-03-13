/**
 * AgentActivityBar — compact live activity indicator in the sidebar.
 * Shows animated dots for each agent currently working on an in-progress task.
 * Tooltip shows the task name. Click jumps to that agent's view.
 */

import { useMemo } from 'react';
import { useStore } from '../store/store';
import AgentAvatar from './AgentAvatar';

const PHANTOM_AGENTS = ['main', 'chat-agent'];

interface AgentActivityBarProps {
  onNavigate?: (view: string) => void;
  expanded?: boolean;
}

export default function AgentActivityBar({ onNavigate, expanded = true }: AgentActivityBarProps) {
  const tasks = useStore(s => s.tasks);
  const agents = useStore(s => s.agents);

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
      className={`mx-2 mb-2 p-2 rounded-xl bg-mission-control-bg/60 border border-mission-control-border/60 ${
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
        {activeWork.map(({ task, agent }) => (
          <button
            key={task.id}
            onClick={() => onNavigate?.('agents')}
            title={`${agent.name}: ${task.title}`}
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
                <p className="text-[10px] font-medium text-mission-control-text truncate leading-tight">
                  {agent.name}
                </p>
                <p className="text-[9px] text-mission-control-text-dim truncate leading-tight">
                  {task.title}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
