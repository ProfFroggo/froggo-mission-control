import { Users, Bot, CheckSquare, Activity } from 'lucide-react';
import { useStore } from '../store/store';
import AgentAvatar from './AgentAvatar';

export default function QuickStatsWidget() {
  const { sessions, agents, tasks, activities, gatewaySessions } = useStore();

  // Active Sessions - breakdown by channel
  const sessionsByChannel = sessions.reduce((acc, s: any) => {
    const channel = s.channel || 'web';
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Running Agents - sub-agents from gateway
  const subagentSessions = gatewaySessions.filter(s => s.type === 'subagent' && s.isActive);
  const totalAgents = agents.length + subagentSessions.length;
  const busyAgents = agents.filter(a => a.status === 'busy');

  // Tasks Today - completed vs total
  const today = new Date().toDateString();
  const tasksToday = tasks.filter(t => 
    new Date(t.createdAt).toDateString() === today ||
    new Date(t.updatedAt).toDateString() === today
  );
  const completedToday = tasks.filter(t => 
    t.status === 'done' && new Date(t.updatedAt).toDateString() === today
  );
  const totalToday = tasksToday.length;

  // Recent Activity - last 3 significant events
  const recentActivities = activities.slice(0, 3);

  const channelIcons: Record<string, string> = {
    discord: '🎮',
    telegram: '✈️',
    whatsapp: '💬',
    web: '💻',
  };

  const channelColors: Record<string, string> = {
    discord: 'text-indigo-400',
    telegram: 'text-info',
    whatsapp: 'text-success',
    web: 'text-clawd-text-dim',
  };

  return (
    <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
      <div className="p-4 border-b border-clawd-border">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity size={16} className="text-clawd-accent" /> Quick Stats
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Active Sessions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-review" />
            <span className="text-sm font-medium text-clawd-text-dim">Active Sessions</span>
            <span className="ml-auto text-lg font-bold">{sessions.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 ml-6">
            {Object.entries(sessionsByChannel).map(([channel, count]) => (
              <div
                key={channel}
                className="flex items-center gap-1.5 px-2 py-1 bg-clawd-bg/50 rounded-md text-xs"
              >
                <span>{channelIcons[channel] || '💻'}</span>
                <span className={channelColors[channel] || 'text-clawd-text-dim'}>
                  {channel}
                </span>
                <span className="text-clawd-text-dim">×{count}</span>
              </div>
            ))}
            {Object.keys(sessionsByChannel).length === 0 && (
              <span className="text-xs text-clawd-text-dim">No active sessions</span>
            )}
          </div>
        </div>

        {/* Running Agents */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-info" />
            <span className="text-sm font-medium text-clawd-text-dim">Running Agents</span>
            <span className="ml-auto text-lg font-bold">{totalAgents}</span>
          </div>
          <div className="space-y-1 ml-6">
            {busyAgents.length > 0 ? (
              busyAgents.map(agent => (
                <div key={agent.id} className="flex items-center gap-2 text-xs overflow-hidden">
                  <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" />
                  <span className="text-clawd-text truncate min-w-0 shrink">{agent.name}</span>
                  {agent.currentTaskId && (
                    <span className="ml-auto text-clawd-text-dim truncate flex-1">
                      {tasks.find(t => t.id === agent.currentTaskId)?.title}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span className="text-xs text-clawd-text-dim">
                {agents.length} agent{agents.length !== 1 ? 's' : ''} idle
              </span>
            )}
            {subagentSessions.length > 0 && (
              <div className="pt-1 border-t border-clawd-border/50">
                <div className="text-xs text-clawd-text-dim mb-1">
                  + {subagentSessions.length} sub-agent{subagentSessions.length !== 1 ? 's' : ''}
                </div>
                {subagentSessions.slice(0, 2).map(session => (
                  <div key={session.key} className="flex items-center gap-2 text-xs overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                    <span className="text-clawd-text truncate min-w-0 flex-1">{session.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks Today */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-success" />
            <span className="text-sm font-medium text-clawd-text-dim">Tasks Today</span>
            <span className="ml-auto text-lg font-bold">
              {completedToday.length}/{totalToday}
            </span>
          </div>
          <div className="ml-6">
            {totalToday > 0 ? (
              <div className="space-y-1">
                <div className="w-full bg-clawd-border rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                    style={{ width: `${(completedToday.length / totalToday) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-clawd-text-dim">
                  <span>{completedToday.length} completed</span>
                  <span>{totalToday - completedToday.length} remaining</span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-clawd-text-dim">No tasks created today</span>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-orange-400" />
            <span className="text-sm font-medium text-clawd-text-dim">Recent Activity</span>
          </div>
          <div className="ml-6 space-y-2">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="text-xs overflow-hidden">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0">
                      {activity.type === 'chat' ? '💬' : 
                       activity.type === 'task' ? '✅' : 
                       activity.type === 'agent' ? '🤖' : '⚙️'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-clawd-text line-clamp-2">{activity.message}</p>
                      <p className="text-clawd-text-dim whitespace-nowrap">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <span className="text-xs text-clawd-text-dim">No recent activity</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  if (!ts) return 'unknown';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
