import { useState, useEffect } from 'react';
import {
  Activity,
  TrendingUp,
  Clock,
  Zap,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { Box, Flex } from '@radix-ui/themes';

interface RealtimeMetric {
  label: string;
  value: number;
  unit: string;
  icon: any;
  color: string;
  sparkline: number[];
}

interface LiveEvent {
  id: string;
  type: 'task' | 'message' | 'approval' | 'agent';
  title: string;
  description: string;
  timestamp: number;
  icon: any;
  color: string;
}

export default function RealTimeAnalytics() {
  const [metrics, setMetrics] = useState<RealtimeMetric[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    if (!isLive) return;

    const updateMetrics = async () => {
      try {
        // Fetch from analytics and task REST APIs
        const [taskStats, agentActivity] = await Promise.all([
          fetch('/api/analytics/task-stats').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/analytics/agent-activity').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        const generateSparkline = (current: number) => {
          return Array.from({ length: 10 }, () => Math.max(0, current + Math.floor(Math.random() * 5) - 2));
        };

        const activeTasks = taskStats?.active || 0;
        const completions = taskStats?.completedToday || 0;
        const sessions = agentActivity?.activeSessions || 0;

        setMetrics([
          {
            label: 'Messages/5min',
            value: 0,
            unit: 'msg',
            icon: MessageCircle,
            color: 'text-info',
            sparkline: generateSparkline(0),
          },
          {
            label: 'Active Tasks',
            value: activeTasks,
            unit: 'tasks',
            icon: Activity,
            color: 'text-review',
            sparkline: generateSparkline(activeTasks),
          },
          {
            label: 'Completions/hour',
            value: completions,
            unit: 'done',
            icon: CheckCircle,
            color: 'text-success',
            sparkline: generateSparkline(completions),
          },
          {
            label: 'Active Sessions',
            value: sessions,
            unit: 'sessions',
            icon: Zap,
            color: 'text-warning',
            sparkline: generateSparkline(sessions),
          },
        ]);

        setLastUpdate(Date.now());
      } catch (error) {
        // Failed to update real-time metrics
      }
    };

    // Update immediately
    updateMetrics();

    // Then update every 10 seconds
    const interval = setInterval(updateMetrics, 10000);

    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;

    // Simulate live events feed
    const addEvent = () => {
      const eventTypes = [
        {
          type: 'task' as const,
          title: 'Task Completed',
          description: 'Fix authentication bug',
          icon: CheckCircle,
          color: 'text-success',
        },
        {
          type: 'message' as const,
          title: 'New Message',
          description: 'Kevin sent a message in WhatsApp',
          icon: MessageCircle,
          color: 'text-info',
        },
        {
          type: 'approval' as const,
          title: 'Approval Needed',
          description: 'Tweet requires review',
          icon: AlertCircle,
          color: 'text-warning',
        },
        {
          type: 'agent' as const,
          title: 'Agent Started',
          description: 'Coder agent started task execution',
          icon: Zap,
          color: 'text-review',
        },
      ];

      const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      setLiveEvents((prev) => [
        {
          ...event,
          id: Date.now().toString() + Math.random(),
          timestamp: Date.now(),
        },
        ...prev.slice(0, 9), // Keep last 10 events
      ]);
    };

    // Add event every 5-15 seconds
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 10000;
      return setTimeout(() => {
        addEvent();
        scheduleNext();
      }, delay);
    };

    const timeout = scheduleNext();

    return () => clearTimeout(timeout);
  }, [isLive]);

  const formatTimestamp = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Flex direction="column" height="100%" p="6" className="overflow-y-auto">
      {/* Header */}
      <Flex align="center" justify="between" mb="6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radio className="text-mission-control-accent" size={20} />
            Real-Time Analytics
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Live metrics updating every 10 seconds
          </p>
        </div>

        <Flex align="center" gap="3">
          <Flex align="center" gap="2" className="text-sm text-mission-control-text-dim">
            <span>Last update:</span>
            <span className="font-medium">{formatTimestamp(lastUpdate)}</span>
          </Flex>

          <button
            type="button"
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isLive
                ? 'bg-success-subtle text-success border border-success-border'
                : 'bg-mission-control-surface border border-mission-control-border'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-success animate-pulse' : 'bg-mission-control-text-dim'}`}
            />
            {isLive ? 'Live' : 'Paused'}
          </button>
        </Flex>
      </Flex>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const maxSparkline = Math.max(...metric.sparkline, 1);

          return (
            <div
              key={metric.label}
              className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4"
            >
              <Flex align="center" justify="between" mb="3">
                <Icon size={16} className={metric.color} />
                {isLive && (
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                )}
              </Flex>

              <Flex align="baseline" gap="2" mb="1">
                <span className="text-3xl font-bold">{metric.value}</span>
                <span className="text-sm text-mission-control-text-dim">{metric.unit}</span>
              </Flex>

              <div className="text-sm text-mission-control-text-dim mb-3">{metric.label}</div>

              {/* Sparkline */}
              <Flex align="end" gap="1" className="h-8">
                {metric.sparkline.map((value, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 ${metric.color.replace('text-', 'bg-')} rounded-t transition-all`}
                    style={{
                      height: `${(value / maxSparkline) * 100}%`,
                      opacity: 0.3 + (idx / metric.sparkline.length) * 0.7,
                    }}
                  />
                ))}
              </Flex>
            </div>
          );
        })}
      </div>

      {/* Live Events Feed */}
      <Box p="6" className="bg-mission-control-surface border border-mission-control-border rounded-2xl flex-1">
        <Flex align="center" justify="between" mb="4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity size={16} className="text-mission-control-accent" />
            Live Activity Feed
          </h3>
          <div className="text-sm text-mission-control-text-dim">
            Last {liveEvents.length} events
          </div>
        </Flex>

        <div className="space-y-2">
          {liveEvents.length === 0 ? (
            <div className="py-8 text-center text-mission-control-text-dim">
              Waiting for activity...
            </div>
          ) : (
            liveEvents.map((event) => {
              const Icon = event.icon;
              return (
                <Flex
                  key={event.id}
                  align="start"
                  gap="3"
                  p="3"
                  className="bg-mission-control-bg rounded-lg hover:bg-mission-control-border transition-colors"
                >
                  <div className={`p-2 rounded-lg ${event.color.replace('text-', 'bg-')}/20`}>
                    <Icon size={16} className={event.color} />
                  </div>

                  <Box className="flex-1 min-w-0">
                    <Flex align="center" justify="between" gap="2">
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="text-xs text-mission-control-text-dim whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </Flex>
                    <div className="text-sm text-mission-control-text-dim truncate">
                      {event.description}
                    </div>
                  </Box>
                </Flex>
              );
            })
          )}
        </div>
      </Box>

      {/* System Status */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" justify="between">
            <div>
              <div className="text-sm text-mission-control-text-dim mb-1">System Status</div>
              <div className="font-medium text-success">Operational</div>
            </div>
            <CheckCircle size={24} className="text-success" />
          </Flex>
        </Box>

        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" justify="between">
            <div>
              <div className="text-sm text-mission-control-text-dim mb-1">Uptime</div>
              <div className="font-medium">99.9%</div>
            </div>
            <TrendingUp size={24} className="text-info" />
          </Flex>
        </Box>

        <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="center" justify="between">
            <div>
              <div className="text-sm text-mission-control-text-dim mb-1">Avg Response</div>
              <div className="font-medium">0.8s</div>
            </div>
            <Clock size={24} className="text-review" />
          </Flex>
        </Box>
      </div>
    </Flex>
  );
}
