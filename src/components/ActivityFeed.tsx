import { useState, useEffect, memo, useRef } from 'react';
import { MessageSquare, RefreshCw, MessageCircle, Send, Gamepad2, Globe, Lock, Briefcase, Mic, Clock, Settings, WifiOff, Inbox, Bot } from 'lucide-react';
import { SkeletonList } from './Skeleton';
import { gateway } from '../lib/gateway';
import type { LucideIcon } from 'lucide-react';

// Channel icons and colors
const channelConfig: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  whatsapp: { icon: MessageCircle, color: 'bg-success-subtle text-success border-success-border', label: 'WhatsApp' },
  telegram: { icon: Send, color: 'bg-info-subtle text-info border-info-border', label: 'Telegram' },
  discord: { icon: Gamepad2, color: 'bg-info-subtle text-info border-info-border', label: 'Discord' },
  webchat: { icon: Globe, color: 'bg-review-subtle text-review border-review-border', label: 'Webchat' },
  signal: { icon: Lock, color: 'bg-info-subtle text-info border-info-border', label: 'Signal' },
  imessage: { icon: MessageCircle, color: 'bg-info-subtle text-info border-info-border', label: 'iMessage' },
  slack: { icon: Briefcase, color: 'bg-review-subtle text-review border-review-border', label: 'Slack' },
  voice: { icon: Mic, color: 'bg-warning-subtle text-warning border-warning-border', label: 'Voice' },
  cron: { icon: Clock, color: 'bg-warning-subtle text-warning border-warning-border', label: 'Scheduled' },
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

  const filteredActivities = filter 
    ? activities.filter(a => a.channel === filter)
    : activities;

  const channels = [...new Set(activities.map(a => a.channel))];

  const getChannelInfo = (channel: string) => {
    return channelConfig[channel] || channelConfig.system;
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} />
          <span className="font-medium">Activity Feed</span>
          <span className="text-xs text-mission-control-text-dim">
            {activities.length} sessions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSessions}
            disabled={loading || !connected}
            className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {channels.length > 1 && (
        <div className="p-2 border-b border-mission-control-border flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter(null)}
            className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
              !filter ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            All
          </button>
          {channels.map(ch => {
            const info = getChannelInfo(ch);
            const ChannelIcon = info.icon;
            return (
              <button
                key={ch}
                onClick={() => setFilter(ch)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
                  filter === ch ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
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
          <div className="p-8 text-center text-mission-control-text-dim">
            <div className="flex justify-center mb-2">
              <WifiOff size={28} className="text-mission-control-text-dim" />
            </div>
            <p>Connecting to gateway...</p>
          </div>
        ) : loading && activities.length === 0 ? (
          <div className="p-3">
            <SkeletonList count={4} />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-mission-control-text-dim">
            <div className="flex justify-center mb-2">
              <Inbox size={28} className="text-mission-control-text-dim" />
            </div>
            <p>{filter ? `No ${filter} activity` : 'No activity yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border">
            {filteredActivities.map((activity) => {
              const info = getChannelInfo(activity.channel);
              return (
                <div
                  key={activity.id}
                  className={`p-3 hover:bg-mission-control-surface/50 transition-colors cursor-pointer ${
                    activity.unread ? 'bg-mission-control-accent/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Channel Badge */}
                    {(() => { const ChannelIcon = info.icon; return (
                    <div className={`px-2 py-1 text-xs rounded-lg border flex items-center ${info.color}`}>
                      <ChannelIcon size={12} />
                    </div>
                    ); })()}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm truncate">
                          {activity.participant || info.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${info.color}`}>
                          {info.label}
                        </span>
                        {activity.unread && (
                          <span className="w-2 h-2 bg-mission-control-accent rounded-full" />
                        )}
                      </div>
                      {activity.lastMessage && (
                        <p className="text-xs text-mission-control-text-dim truncate flex items-center gap-1">
                          {activity.lastMessageRole === 'assistant' && <Bot size={10} className="text-mission-control-text-dim flex-shrink-0" />}
                          {activity.lastMessage}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-mission-control-text-dim whitespace-nowrap">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default ActivityFeed;
