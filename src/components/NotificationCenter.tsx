// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  X, CheckCheck, Trash2, Bell, CheckSquare, ShieldCheck, ShieldAlert, AlertCircle, Info, AtSign,
} from 'lucide-react';
import { useEventBus } from '../lib/useEventBus';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

type Tab = 'all' | 'unread' | 'mentions' | 'system';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function TypeIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'task_assigned':   return <CheckSquare className={cls + ' text-info'} aria-hidden="true" />;
    case 'task_completed':  return <CheckCheck className={cls + ' text-success'} aria-hidden="true" />;
    case 'approval_needed': return <ShieldAlert className={cls + ' text-warning'} aria-hidden="true" />;
    case 'approval_resolved': return <ShieldCheck className={cls + ' text-success'} aria-hidden="true" />;
    case 'agent_alert':     return <AlertCircle className={cls + ' text-error'} aria-hidden="true" />;
    case 'mention':         return <AtSign className={cls + ' text-accent'} aria-hidden="true" />;
    default:                return <Info className={cls + ' text-mission-control-text-dim'} aria-hidden="true" />;
  }
}

export default function NotificationCenter({ isOpen, onClose, onUnreadCountChange }: NotificationCenterProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (tab === 'unread') params.set('unreadOnly', 'true');
      if (tab === 'mentions') params.set('type', 'mention');
      if (tab === 'system') params.set('type', 'system_info');

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      onUnreadCountChange?.(data.unreadCount ?? 0);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, [tab, onUnreadCountChange]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // Live update via SSE
  useEventBus('notification.new', useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]));

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', ids: [id] }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    } catch { /* non-critical */ }
  }, [unreadCount, onUnreadCountChange]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', ids: 'all' }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    } catch { /* non-critical */ }
  }, [onUnreadCountChange]);

  const deleteNotification = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* non-critical */ }
  }, []);

  if (!isOpen) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'mentions', label: 'Mentions' },
    { id: 'system', label: 'System' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed top-12 right-0 z-50 w-[380px] h-[calc(100vh-3rem)] flex flex-col bg-mission-control-surface border-l border-mission-control-border shadow-2xl"
        aria-label="Notification center"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-mission-control-text-dim" aria-hidden="true" />
            <span className="text-sm font-semibold text-mission-control-text">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-error text-white rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                title="Mark all as read"
                className="p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors text-[11px] flex items-center gap-1"
              >
                <CheckCheck size={14} aria-hidden="true" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mission-control-border flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? 'text-mission-control-accent border-b-2 border-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-mission-control-text-dim text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-mission-control-text-dim">
              <Bell size={32} className="opacity-30" aria-hidden="true" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-mission-control-border">
              {notifications.map(n => (
                <li
                  key={n.id}
                  className={`relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-mission-control-bg ${
                    !n.readAt ? 'bg-mission-control-surface' : 'opacity-70'
                  }`}
                  onClick={() => !n.readAt && markRead(n.id)}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Unread dot */}
                  {!n.readAt && (
                    <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-mission-control-accent flex-shrink-0" aria-label="Unread" />
                  )}

                  <div className="mt-0.5 flex-shrink-0">
                    <TypeIcon type={n.type} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-mission-control-text leading-snug truncate">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[11px] text-mission-control-text-dim mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-mission-control-text-dim mt-1 tabular-nums">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>

                  {/* Delete on hover */}
                  {hoveredId === n.id && (
                    <button
                      type="button"
                      onClick={(e) => deleteNotification(n.id, e)}
                      aria-label="Delete notification"
                      className="flex-shrink-0 p-1 rounded text-mission-control-text-dim hover:text-error hover:bg-error-subtle transition-colors"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
