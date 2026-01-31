import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, Clock, MessageSquare, Calendar, Mail, RefreshCw, Inbox } from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import IconBadge from './IconBadge';

interface UnifiedNotification {
  id: string;
  type: 'approval' | 'message' | 'calendar' | 'alert' | 'info';
  source: 'inbox' | 'whatsapp' | 'telegram' | 'discord' | 'email' | 'calendar' | 'system';
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  urgent: boolean;
  actionable: boolean;
  data?: any;
}

const sourceConfig: Record<string, { icon: any; color: string; label: string }> = {
  inbox: { icon: Inbox, color: 'text-yellow-400 bg-yellow-500/10', label: 'Inbox' },
  whatsapp: { icon: MessageSquare, color: 'text-green-400 bg-green-500/10', label: 'WhatsApp' },
  telegram: { icon: MessageSquare, color: 'text-blue-400 bg-blue-500/10', label: 'Telegram' },
  discord: { icon: MessageSquare, color: 'text-purple-400 bg-purple-500/10', label: 'Discord' },
  email: { icon: Mail, color: 'text-red-400 bg-red-500/10', label: 'Email' },
  calendar: { icon: Calendar, color: 'text-orange-400 bg-orange-500/10', label: 'Calendar' },
  system: { icon: Bell, color: 'text-clawd-text-dim bg-clawd-bg0/10', label: 'System' },
};

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const items: UnifiedNotification[] = [];
      
      // 1. Load inbox approvals
      const inboxResult = await (window as any).clawdbot?.inbox?.list().catch(() => null);
      if (inboxResult?.items) {
        for (const item of inboxResult.items.filter((i: any) => i.status === 'pending')) {
          items.push({
            id: `inbox-${item.id}`,
            type: 'approval',
            source: 'inbox',
            title: item.title,
            description: item.content?.slice(0, 100) || '',
            timestamp: new Date(item.created).getTime(),
            read: false,
            urgent: false,
            actionable: true,
            data: item,
          });
        }
      }

      // 2. Load calendar events (today)
      const calendarResult = await (window as any).clawdbot?.calendar?.today().catch(() => null);
      if (calendarResult?.events) {
        const now = Date.now();
        for (const event of calendarResult.events) {
          const eventTime = new Date(event.start?.dateTime || event.start?.date).getTime();
          // Only show events within 2 hours
          if (eventTime - now < 2 * 60 * 60 * 1000 && eventTime > now) {
            items.push({
              id: `cal-${event.id}`,
              type: 'calendar',
              source: 'calendar',
              title: event.summary || 'Event',
              description: `Starts at ${new Date(eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              timestamp: eventTime,
              read: false,
              urgent: eventTime - now < 30 * 60 * 1000, // Urgent if within 30 min
              actionable: false,
            });
          }
        }
      }

      // Sort by timestamp (newest first) and urgent items first
      items.sort((a, b) => {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        return b.timestamp - a.timestamp;
      });

      setNotifications(items);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleApprove = async (notif: UnifiedNotification) => {
    if (notif.source === 'inbox' && notif.data) {
      try {
        await (window as any).clawdbot?.inbox?.update(notif.data.id, { status: 'approved' });
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        showToast('success', 'Approved', notif.title);
      } catch (e) {
        showToast('error', 'Failed', String(e));
      }
    }
  };

  const handleDismiss = (notif: UnifiedNotification) => {
    setNotifications(prev => prev.map(n => 
      n.id === notif.id ? { ...n, read: true } : n
    ));
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return n.urgent;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => n.urgent).length;

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/20 rounded-xl">
              <Bell size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Notifications</h1>
              <p className="text-sm text-clawd-text-dim">
                {unreadCount} unread {urgentCount > 0 && `• ${urgentCount} urgent`}
              </p>
            </div>
          </div>
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'unread', 'urgent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {f === 'all' && `All (${notifications.length})`}
              {f === 'unread' && `Unread (${unreadCount})`}
              {f === 'urgent' && `Urgent (${urgentCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredNotifications.length === 0 ? (
          <EmptyState 
            type="notifications" 
            description={filter !== 'all' ? `No ${filter} notifications` : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const config = sourceConfig[notif.source];
              const Icon = config.icon;
              
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all ${
                    notif.urgent
                      ? 'bg-red-500/5 border-red-500/30'
                      : notif.read
                      ? 'bg-clawd-bg border-clawd-border opacity-60'
                      : 'bg-clawd-surface border-clawd-border shadow-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <IconBadge icon={Icon} size={16} color={config.color} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{notif.title}</span>
                        {notif.urgent && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-clawd-text-dim truncate">{notif.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-clawd-text-dim">
                        <span className={`px-1.5 py-0.5 rounded ${config.color.replace('text-', 'bg-').replace('/10', '/20')}`}>
                          {config.label}
                        </span>
                        <Clock size={10} />
                        <span>{formatTimeAgo(notif.timestamp)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {notif.actionable && (
                        <button
                          onClick={() => handleApprove(notif)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(notif)}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors text-clawd-text-dim"
                        title="Dismiss"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
