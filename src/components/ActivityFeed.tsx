import { useState, useEffect, memo } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { gateway } from '../lib/gateway';

// Channel icons and colors
const channelConfig: Record<string, { icon: string; color: string; label: string }> = {
  whatsapp: { icon: '💬', color: 'bg-success-subtle text-success border-success-border', label: 'WhatsApp' },
  telegram: { icon: '✈️', color: 'bg-info-subtle text-info border-info-border', label: 'Telegram' },
  discord: { icon: '🎮', color: 'bg-info-subtle text-info border-info-border', label: 'Discord' },
  webchat: { icon: '🌐', color: 'bg-review-subtle text-review border-review-border', label: 'Webchat' },
  signal: { icon: '🔒', color: 'bg-info-subtle text-info border-info-border', label: 'Signal' },
  imessage: { icon: '💬', color: 'bg-info-subtle text-info border-info-border', label: 'iMessage' },
  slack: { icon: '💼', color: 'bg-review-subtle text-review border-review-border', label: 'Slack' },
  voice: { icon: '🎤', color: 'bg-warning-subtle text-warning border-warning-border', label: 'Voice' },
  cron: { icon: '⏰', color: 'bg-warning-subtle text-warning border-warning-border', label: 'Scheduled' },
  system: { icon: '⚙️', color: 'bg-muted-subtle text-muted border-muted-border', label: 'System' },
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

    return () => { unsub(); unsub2(); unsub3(); };
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
      <div className="p-4 border-b border-clawd-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} />
          <span className="font-medium">Activity Feed</span>
          <span className="text-xs text-clawd-text-dim">
            {activities.length} sessions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSessions}
            disabled={loading || !connected}
            className="p-1.5 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {channels.length > 1 && (
        <div className="p-2 border-b border-clawd-border flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilter(null)}
            className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
              !filter ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            All
          </button>
          {channels.map(ch => {
            const info = getChannelInfo(ch);
            return (
              <button
                key={ch}
                onClick={() => setFilter(ch)}
                className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
                  filter === ch ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {info.icon} {info.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto">
        {!connected ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <div className="text-2xl mb-2">🔌</div>
            <p>Connecting to gateway...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <div className="text-2xl mb-2">📭</div>
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {filteredActivities.map((activity) => {
              const info = getChannelInfo(activity.channel);
              return (
                <div
                  key={activity.id}
                  className={`p-3 hover:bg-clawd-surface/50 transition-colors cursor-pointer ${
                    activity.unread ? 'bg-clawd-accent/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Channel Badge */}
                    <div className={`px-2 py-1 text-xs rounded-lg border ${info.color}`}>
                      {info.icon}
                    </div>

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
                          <span className="w-2 h-2 bg-clawd-accent rounded-full" />
                        )}
                      </div>
                      {activity.lastMessage && (
                        <p className="text-xs text-clawd-text-dim truncate">
                          {activity.lastMessageRole === 'assistant' && '🐸 '}
                          {activity.lastMessage}
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-clawd-text-dim whitespace-nowrap">
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
