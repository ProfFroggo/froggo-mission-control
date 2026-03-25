import { useState, useEffect, memo, useRef, useMemo, useCallback } from 'react';
import { MessageSquare, RefreshCw, MessageCircle, Send, Gamepad2, Globe, Lock, Briefcase, Mic, Clock, Settings, WifiOff, Inbox, Bot } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { SkeletonList } from './Skeleton';
import { gateway } from '../lib/gateway';
import type { LucideIcon } from 'lucide-react';

// Channel icons and colors
const channelConfig: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  whatsapp: { icon: MessageCircle, color: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30', label: 'WhatsApp' },
  telegram: { icon: Send, color: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/30', label: 'Telegram' },
  discord: { icon: Gamepad2, color: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/30', label: 'Discord' },
  webchat: { icon: Globe, color: 'bg-[var(--color-review)]-subtle text-[var(--color-review)] border-[var(--color-review)]-border', label: 'Webchat' },
  signal: { icon: Lock, color: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/30', label: 'Signal' },
  imessage: { icon: MessageCircle, color: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/30', label: 'iMessage' },
  slack: { icon: Briefcase, color: 'bg-[var(--color-review)]-subtle text-[var(--color-review)] border-[var(--color-review)]-border', label: 'Slack' },
  voice: { icon: Mic, color: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30', label: 'Voice' },
  cron: { icon: Clock, color: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30', label: 'Scheduled' },
  system: { icon: Settings, color: 'bg-muted-subtle text-muted border-muted-border', label: 'System' },
};

interface Activity {
  id: string;
  sessionKey: string;
  channel: string;
  participant?: string;
  lastMessage?: string;
  lastMessageRole?: 'user' | 'assistant';
  timestamp: number;
  unread?: boolean;
}

const ActivityFeed = memo(function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // Tick every 60s to keep relative timestamps fresh
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const result = await gateway.getSessions();
      if (result?.sessions) {
        const mapped: Activity[] = result.sessions
          .filter((s: any) => s.sessionKey) // Filter out sessions without keys
          .map((s: any) => {
          // Parse session key to get channel
          const [prefix] = s.sessionKey.split(':');
          let channel = prefix;
          
          // Normalize channel names
          if (prefix === 'wa') channel = 'whatsapp';
          if (prefix === 'tg') channel = 'telegram';
          if (prefix === 'web') channel = 'webchat';
          if (prefix === 'dc') channel = 'discord';
          
          return {
            id: s.sessionKey,
            sessionKey: s.sessionKey,
            channel,
            participant: s.participant || s.sessionKey.split(':')[1],
            lastMessage: s.lastMessage?.content?.slice(0, 100),
            lastMessageRole: s.lastMessage?.role,
            timestamp: s.lastActivity || s.createdAt || Date.now(),
            unread: s.unread,
          };
        }).sort((a: Activity, b: Activity) => b.timestamp - a.timestamp);
        
        setActivities(mapped);
      }
    } catch (e) {
      // 'Failed to fetch sessions:', e;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = gateway.on('connect', () => {
      setConnected(true);
      fetchSessions();
    });
    
    const unsub2 = gateway.on('disconnect', () => setConnected(false));
    
    // Also listen for new messages
    const unsub3 = gateway.on('chat.message', () => {
      fetchSessions(); // Refresh on new messages
    });

    if (gateway.connected) {
      setConnected(true);
      fetchSessions();
    }

    // Refresh relative timestamps every 60s
    tickRef.current = setInterval(() => setTick(t => t + 1), 60000);

    return () => {
      unsub(); unsub2(); unsub3();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const filteredActivities = useMemo(
    () => filter ? activities.filter(a => a.channel === filter) : activities,
    [activities, filter]
  );

  const channels = useMemo(
    () => [...new Set(activities.map(a => a.channel))],
    [activities]
  );

  const getChannelInfo = useCallback((channel: string) => {
    return channelConfig[channel] || channelConfig.system;
  }, []);

  const formatTime = useCallback((ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(ts).toLocaleDateString();
  }, []);

  return (
    <Flex direction="column" height="100%">
      {/* Header */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <MessageSquare size={16} />
          <span className="font-medium">Activity Feed</span>
          <span className="text-xs text-mission-control-text-dim">
            {activities.length} sessions
          </span>
        </Flex>
        <Flex align="center" gap="2">
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading || !connected}
            title="Refresh"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </Flex>
      </Flex>

      {/* Filters */}
      {channels.length > 1 && (
        <div className="p-2 border-b border-mission-control-border flex gap-1 overflow-x-auto">
          <button
            type="button"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
              !filter ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {channels.map(ch => {
            const info = getChannelInfo(ch);
            const ChannelIcon = info.icon;
            return (
              <button
                key={ch}
                type="button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                  filter === ch ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
                onClick={() => setFilter(ch)}
              >
                <ChannelIcon size={12} /> {info.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto">
        {!connected ? (
          <div className="text-xs text-mission-control-text-dim text-center py-6">
            <WifiOff size={24} className="mx-auto mb-2 opacity-40" />
            Connecting to gateway...
          </div>
        ) : loading && activities.length === 0 ? (
          <div className="p-3">
            <SkeletonList count={4} />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-xs text-mission-control-text-dim text-center py-6">
            <Inbox size={24} className="mx-auto mb-2 opacity-40" />
            {filter ? `No ${filter} activity` : 'No activity yet'}
          </div>
        ) : (
          <div>
            {filteredActivities.map((activity) => {
              const info = getChannelInfo(activity.channel);
              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 py-2.5 px-3 border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-border/30 transition-colors cursor-pointer ${
                    activity.unread ? 'bg-mission-control-accent/5' : ''
                  }`}
                >
                    {/* Channel Badge */}
                    {(() => { const ChannelIcon = info.icon; return (
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border ${info.color}`}>
                      <ChannelIcon size={12} />
                    </div>
                    ); })()}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <Flex align="center" gap="2" className="mb-0.5">
                        <span className="font-medium text-sm truncate">
                          {activity.participant || info.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${info.color}`}>
                          {info.label}
                        </span>
                        {activity.unread && (
                          <span className="w-2 h-2 bg-mission-control-accent rounded-full" />
                        )}
                      </Flex>
                      {activity.lastMessage && (
                        <p className="text-xs text-mission-control-text-dim truncate flex items-center gap-1">
                          {activity.lastMessageRole === 'assistant' && <Bot size={10} className="text-mission-control-text-dim flex-shrink-0" />}
                          {activity.lastMessage}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] tabular-nums text-mission-control-text-dim whitespace-nowrap">
                      {formatTime(activity.timestamp)}
                    </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Flex>
  );
});

export default ActivityFeed;
