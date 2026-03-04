import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, Clock, MessageSquare, Calendar, Mail, RefreshCw, Inbox } from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import IconBadge from './IconBadge';
import { inboxApi, scheduleApi } from '../lib/api';

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
  inbox: { icon: Inbox, color: 'text-warning bg-warning-subtle', label: 'Inbox' },
  whatsapp: { icon: MessageSquare, color: 'text-success bg-success-subtle', label: 'WhatsApp' },
  telegram: { icon: MessageSquare, color: 'text-info bg-info-subtle', label: 'Telegram' },
  discord: { icon: MessageSquare, color: 'text-review bg-review-subtle', label: 'Discord' },
  email: { icon: Mail, color: 'text-error bg-error-subtle', label: 'Email' },
  calendar: { icon: Calendar, color: 'text-warning bg-warning-subtle', label: 'Calendar' },
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
      const inboxResult = await inboxApi.getAll().catch((err: any) => { console.error('[Notifications] Failed to list inbox:', err); return null; });
      const inboxItems = Array.isArray(inboxResult) ? inboxResult : (inboxResult?.items || []);
      if (inboxItems.length > 0) {
        for (const item of inboxItems.filter((i: any) => i.status === 'pending')) {
          items.push({
            id: `inbox-${item.id}`,
            type: 'approval',
            source: 'inbox',
            title: item.title,
            description: item.content?.slice(0, 100) || '',
            timestamp: new Date(item.created || '').getTime(),
            read: false,
            urgent: false,
            actionable: true,
            data: item,
          });
        }
      }

      // 2. Load calendar events (today)
      const calendarResult = await scheduleApi.getAll().catch((err: any) => { console.error('[Notifications] Failed to get calendar:', err); return null; });
      if (calendarResult?.events) {
        const now = Date.now();
        for (const event of calendarResult.events) {
          const eventTime = new Date(event.start?.dateTime || event.start?.date || '').getTime();
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
      // 'Failed to load notifications:', error;
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
        await inboxApi.update(notif.data.id, { status: 'approved' });
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
      <div className="p-4 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/20 rounded-xl">
              <Bell size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-heading-2">Notifications</h1>
              <p className="text-secondary">
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
      <div className="flex-1 overflow-y-auto p-4">
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
                      ? 'bg-error-subtle border-error-border'
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
                          <span className="px-1.5 py-0.5 bg-error-subtle text-error text-xs rounded">
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
                          className="p-2 bg-success-subtle text-success rounded-lg hover:bg-success-subtle transition-colors"
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
