import { Users, Bot, CheckSquare, Activity, Gamepad2, MessageCircle, Monitor, CheckCircle, Settings, Send as SendPlane } from 'lucide-react';
import { formatTimeAgo } from '../utils/formatting';
import { useStore } from '../store/store';
import { useShallow } from 'zustand/react/shallow';
import AgentAvatar from './AgentAvatar';
import WidgetLoading from './WidgetLoading';

export default function QuickStatsWidget() {
  const { sessions, agents, tasks, activities, gatewaySessions, loading } = useStore(
    useShallow(s => ({
      sessions: s.sessions,
      agents: s.agents,
      tasks: s.tasks,
      activities: s.activities,
      gatewaySessions: s.gatewaySessions,
      loading: s.loading,
    }))
  );

  // Show loading state while initial data is loading
  if (loading.tasks || loading.agents) {
    return (
      <div className="bg-mission-control-surface rounded-lg border border-mission-control-border overflow-hidden">
        <div className="p-4 border-b border-mission-control-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity size={16} className="text-mission-control-accent" /> Quick Stats
          </h2>
        </div>
        <WidgetLoading variant="skeleton" lines={4} />
      </div>
    );
  }

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

  const channelIcons: Record<string, React.ReactNode> = {
    discord: <Gamepad2 size={14} />,
    telegram: <SendPlane size={14} />,
    whatsapp: <MessageCircle size={14} />,
    web: <Monitor size={14} />,
  };

  const channelColors: Record<string, string> = {
    discord: 'text-mission-control-accent',
    telegram: 'text-info',
    whatsapp: 'text-success',
    web: 'text-mission-control-text-dim',
  };

  return (
    <div className="bg-mission-control-surface rounded-lg border border-mission-control-border overflow-hidden">
      <div className="p-4 border-b border-mission-control-border">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity size={16} className="text-mission-control-accent" /> Quick Stats
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Active Sessions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-review" />
            <span className="text-sm font-medium text-mission-control-text-dim">Active Sessions</span>
            <span className="ml-auto text-lg font-bold">{sessions.length}</span>
          </div>
          <div className="flex flex-wrap gap-2 ml-6">
            {Object.entries(sessionsByChannel).map(([channel, count]) => (
              <div
                key={channel}
                className="flex items-center gap-1.5 px-2 py-1 bg-mission-control-bg/50 rounded-md text-xs"
              >
                <span>{channelIcons[channel] || <Monitor size={14} />}</span>
                <span className={channelColors[channel] || 'text-mission-control-text-dim'}>
                  {channel}
                </span>
                <span className="text-mission-control-text-dim">×{count}</span>
              </div>
            ))}
            {Object.keys(sessionsByChannel).length === 0 && (
              <span className="text-xs text-mission-control-text-dim">No active sessions</span>
            )}
          </div>
        </div>

        {/* Running Agents */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-info" />
            <span className="text-sm font-medium text-mission-control-text-dim">Running Agents</span>
            <span className="ml-auto text-lg font-bold">{totalAgents}</span>
          </div>
          <div className="space-y-1 ml-6">
            {busyAgents.length > 0 ? (
              busyAgents.map(agent => (
                <div key={agent.id} className="flex items-center gap-2 text-xs overflow-hidden">
                  <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" />
                  <span className="text-mission-control-text truncate min-w-0 shrink">{agent.name}</span>
                  {agent.currentTaskId && (
                    <span className="ml-auto text-mission-control-text-dim truncate flex-1">
                      {tasks.find(t => t.id === agent.currentTaskId)?.title}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <span className="text-xs text-mission-control-text-dim">
                {agents.length} agent{agents.length !== 1 ? 's' : ''} idle
              </span>
            )}
            {subagentSessions.length > 0 && (
              <div className="pt-1 border-t border-mission-control-border/50">
                <div className="text-xs text-mission-control-text-dim mb-1">
                  + {subagentSessions.length} sub-agent{subagentSessions.length !== 1 ? 's' : ''}
                </div>
                {subagentSessions.slice(0, 2).map(session => (
                  <div key={session.key} className="flex items-center gap-2 text-xs overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                    <span className="text-mission-control-text truncate min-w-0 flex-1">{session.displayName}</span>
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
            <span className="text-sm font-medium text-mission-control-text-dim">Tasks Today</span>
            <span className="ml-auto text-lg font-bold">
              {completedToday.length}/{totalToday}
            </span>
          </div>
          <div className="ml-6">
            {totalToday > 0 ? (
              <div className="space-y-1">
                <div className="w-full bg-mission-control-border rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                    style={{ width: `${(completedToday.length / totalToday) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-mission-control-text-dim">
                  <span>{completedToday.length} completed</span>
                  <span>{totalToday - completedToday.length} remaining</span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-mission-control-text-dim">No tasks created today</span>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-warning" />
            <span className="text-sm font-medium text-mission-control-text-dim">Recent Activity</span>
          </div>
          <div className="ml-6 space-y-2">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="text-xs overflow-hidden">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0">
                      {activity.type === 'chat' ? <MessageCircle size={14} /> :
                       activity.type === 'task' ? <CheckCircle size={14} /> :
                       activity.type === 'agent' ? <Bot size={14} /> : <Settings size={14} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-mission-control-text line-clamp-2">{activity.message}</p>
                      <p className="text-mission-control-text-dim whitespace-nowrap">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <span className="text-xs text-mission-control-text-dim">No recent activity</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

