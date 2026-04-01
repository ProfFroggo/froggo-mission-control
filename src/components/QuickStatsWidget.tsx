import { Users, Bot, CheckSquare, Activity, Gamepad2, MessageCircle, Monitor, CheckCircle, Settings, Send as SendPlane } from 'lucide-react';
import { Text, Flex, Box } from '@radix-ui/themes';
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
      <Box className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <Box p="4" className="border-b border-mission-control-border">
          <Flex align="center" gap="2">
            <Activity size={16} className="text-mission-control-accent" />
            <Text weight="bold">Quick Stats</Text>
          </Flex>
        </Box>
        <WidgetLoading variant="skeleton" lines={4} />
      </Box>
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
    <Box className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      <Box p="4" className="border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <Activity size={16} className="text-mission-control-accent" />
          <Text weight="bold">Quick Stats</Text>
        </Flex>
      </Box>

      <Box p="4" className="space-y-4">
        {/* Active Sessions */}
        <Box className="space-y-2">
          <Flex align="center" gap="2">
            <Users size={16} className="text-review" />
            <span className="text-xs text-mission-control-text-dim mt-0.5">Active Sessions</span>
            <span className="ml-auto text-2xl font-bold tabular-nums text-mission-control-text">{sessions.length}</span>
          </Flex>
          <Flex gap="2" ml="6" className="flex-wrap">
            {Object.entries(sessionsByChannel).map(([channel, count]) => (
              <Flex
                key={channel}
                align="center"
                gap="1"
                px="2"
                py="1"
                className="bg-mission-control-bg/50 rounded-md text-xs"
              >
                <span>{channelIcons[channel] || <Monitor size={14} />}</span>
                <span className={channelColors[channel] || 'text-mission-control-text-dim'}>
                  {channel}
                </span>
                <span className="text-mission-control-text-dim">×{count}</span>
              </Flex>
            ))}
            {Object.keys(sessionsByChannel).length === 0 && (
              <span className="text-xs text-mission-control-text-dim">No active sessions</span>
            )}
          </Flex>
        </Box>

        {/* Running Agents */}
        <Box className="space-y-2">
          <Flex align="center" gap="2">
            <Bot size={16} className="text-info" />
            <span className="text-xs text-mission-control-text-dim mt-0.5">Running Agents</span>
            <span className="ml-auto text-2xl font-bold tabular-nums text-mission-control-text">{totalAgents}</span>
          </Flex>
          <Box ml="6" className="space-y-1">
            {busyAgents.length > 0 ? (
              busyAgents.map(agent => (
                <Flex key={agent.id} align="center" gap="2" className="text-xs overflow-hidden">
                  <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" />
                  <span className="text-mission-control-text truncate min-w-0 shrink">{agent.name}</span>
                  {agent.currentTaskId && (
                    <span className="ml-auto text-mission-control-text-dim truncate flex-1">
                      {tasks.find(t => t.id === agent.currentTaskId)?.title}
                    </span>
                  )}
                </Flex>
              ))
            ) : (
              <span className="text-xs text-mission-control-text-dim">
                {agents.length} agent{agents.length !== 1 ? 's' : ''} idle
              </span>
            )}
            {subagentSessions.length > 0 && (
              <Box pt="1" className="border-t border-mission-control-border/50">
                <Box className="text-xs text-mission-control-text-dim mb-1">
                  + {subagentSessions.length} sub-agent{subagentSessions.length !== 1 ? 's' : ''}
                </Box>
                {subagentSessions.slice(0, 2).map(session => (
                  <Flex key={session.key} align="center" gap="2" className="text-xs overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                    <span className="text-mission-control-text truncate min-w-0 flex-1">{session.displayName}</span>
                  </Flex>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Tasks Today */}
        <Box className="space-y-2">
          <Flex align="center" gap="2">
            <CheckSquare size={16} className="text-success" />
            <span className="text-xs text-mission-control-text-dim mt-0.5">Tasks Today</span>
            <span className="ml-auto text-2xl font-bold tabular-nums text-mission-control-text">
              {completedToday.length}/{totalToday}
            </span>
          </Flex>
          <Box ml="6">
            {totalToday > 0 ? (
              <Box className="space-y-1">
                <Box className="w-full bg-mission-control-border rounded-full h-2 overflow-hidden">
                  <Box
                    className="h-full bg-success transition-colors"
                    style={{ width: `${(completedToday.length / totalToday) * 100}%` }}
                  />
                </Box>
                <Flex justify="between" className="text-xs text-mission-control-text-dim">
                  <span>{completedToday.length} completed</span>
                  <span>{totalToday - completedToday.length} remaining</span>
                </Flex>
              </Box>
            ) : (
              <span className="text-xs text-mission-control-text-dim">No tasks created today</span>
            )}
          </Box>
        </Box>

        {/* Recent Activity */}
        <Box className="space-y-2">
          <Flex align="center" gap="2">
            <Activity size={16} className="text-warning" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Recent Activity</span>
          </Flex>
          <Box ml="6" className="space-y-2">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 py-2.5 border-b border-mission-control-border/40 last:border-0">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center bg-mission-control-border/30 flex-shrink-0">
                    {activity.type === 'chat' ? <MessageCircle size={12} className="text-mission-control-text-dim" /> :
                     activity.type === 'task' ? <CheckCircle size={12} className="text-mission-control-text-dim" /> :
                     activity.type === 'agent' ? <Bot size={12} className="text-mission-control-text-dim" /> :
                     <Settings size={12} className="text-mission-control-text-dim" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-mission-control-text line-clamp-2">{activity.message}</p>
                    <p className="text-[10px] tabular-nums text-mission-control-text-dim mt-0.5">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-mission-control-text-dim text-center py-6">No recent activity</div>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

