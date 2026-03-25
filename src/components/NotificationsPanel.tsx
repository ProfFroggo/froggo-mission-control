import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, X, Clock, MessageSquare, Calendar, Mail, RefreshCw, Inbox, CheckCheck } from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import IconBadge from './IconBadge';
import { inboxApi, scheduleApi } from '../lib/api';
import { IconButton, Badge, Box, Flex } from '@radix-ui/themes';

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
  inbox: { icon: Inbox, color: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10', label: 'Inbox' },
  whatsapp: { icon: MessageSquare, color: 'text-[var(--color-success)] bg-[var(--color-success)]/10', label: 'WhatsApp' },
  telegram: { icon: MessageSquare, color: 'text-[var(--color-info)] bg-[var(--color-info)]/10', label: 'Telegram' },
  discord: { icon: MessageSquare, color: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle', label: 'Discord' },
  email: { icon: Mail, color: 'text-[var(--color-error)] bg-[var(--color-error)]/10', label: 'Email' },
  calendar: { icon: Calendar, color: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10', label: 'Calendar' },
  system: { icon: Bell, color: 'text-mission-control-text-dim bg-mission-control-surface/10', label: 'System' },
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
    <Flex direction="column" height="100%">
      {/* Header */}
      <Box p="4" className="border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" justify="between" mb="4">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg">
              <Bell size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-heading-2">Notifications</h1>
              <p className="text-secondary tabular-nums">
                {unreadCount} unread {urgentCount > 0 && `• ${urgentCount} urgent`}
              </p>
            </div>
          </Flex>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={loadNotifications}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </Flex>

        {/* Filter tabs — underline style */}
        <div className="flex items-center border-b border-mission-control-border -mb-px">
          {(['all', 'unread', 'urgent'] as const).map((f) => {
            const count = f === 'all' ? notifications.length : f === 'unread' ? unreadCount : urgentCount;
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-mission-control-accent text-mission-control-accent'
                    : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono tabular-nums ${
                  isActive
                    ? 'bg-mission-control-accent/20 text-mission-control-accent'
                    : 'bg-mission-control-border text-mission-control-text-dim'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </Box>

      {/* Notifications List */}
      <Box p="4" className="flex-1 overflow-y-auto">
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
                  className={`p-4 rounded-lg border transition-colors ${
                    notif.urgent
                      ? 'bg-[var(--color-error)]/10 border-[var(--color-error)]/30 border-l-2 border-l-[var(--color-error)]'
                      : notif.read
                      ? 'bg-transparent border-mission-control-border opacity-70'
                      : 'bg-mission-control-accent/5 border-mission-control-border border-l-2 border-l-mission-control-accent shadow-card'
                  }`}
                >
                  <Flex align="start" gap="3">
                    <IconBadge icon={Icon} size={16} color={config.color} />

                    <Box className="flex-1 min-w-0">
                      <Flex align="center" gap="2" mb="1">
                        <span className="font-medium">{notif.title}</span>
                        {notif.urgent && (
                          <Badge color="red" variant="soft">Urgent</Badge>
                        )}
                      </Flex>
                      <p className="text-sm text-mission-control-text-dim truncate">{notif.description}</p>
                      <Flex align="center" gap="2" mt="2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <Clock size={10} className="text-mission-control-text-dim/70" />
                        <span className="text-[11px] text-mission-control-text-dim/70 tabular-nums">{formatTimeAgo(notif.timestamp)}</span>
                      </Flex>
                    </Box>

                    {/* Actions */}
                    <Flex gap="1" className="flex-shrink-0">
                      {notif.actionable && (
                        <IconButton
                          variant="soft"
                          size="2"
                          color="grass"
                          onClick={() => handleApprove(notif)}
                          title="Approve"
                          aria-label="Approve"
                        >
                          <Check size={16} />
                        </IconButton>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDismiss(notif)}
                        title="Dismiss"
                        aria-label="Dismiss"
                        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </Flex>
                  </Flex>
                </div>
              );
            })}
          </div>
        )}
      </Box>
    </Flex>
  );
}
