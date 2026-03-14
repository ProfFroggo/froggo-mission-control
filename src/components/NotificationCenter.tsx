// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// NotificationCenter — 380px slide-in panel for all platform notifications

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  ClipboardList,
  CheckCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Info,
  AtSign,
  Loader,
} from 'lucide-react';
import { useEventBus } from '../lib/useEventBus';

type Tab = 'all' | 'unread' | 'mentions' | 'system';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function TypeIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'task_assigned':     return <ClipboardList className={cls} style={{ color: 'var(--color-info)' }} />;
    case 'task_completed':    return <CheckCircle className={cls} style={{ color: 'var(--color-success)' }} />;
    case 'approval_needed':   return <Clock className={cls} style={{ color: 'var(--color-warning)' }} />;
    case 'approval_resolved': return <ShieldCheck className={cls} style={{ color: 'var(--color-success)' }} />;
    case 'agent_alert':       return <AlertTriangle className={cls} style={{ color: 'var(--color-error)' }} />;
    case 'mention':           return <AtSign className={cls} style={{ color: 'var(--color-accent)' }} />;
    default:                  return <Info className={cls} style={{ color: 'var(--color-text-muted)' }} />;
  }
}

export default function NotificationCenter({ isOpen, onClose, onUnreadCountChange }: NotificationCenterProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (tab === 'unread') params.set('unreadOnly', 'true');
      if (tab === 'mentions') params.set('type', 'mention');
      if (tab === 'system') params.set('type', 'system_info');

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      const newUnread = data.unreadCount ?? 0;
      setUnreadCount(newUnread);
      onUnreadCountChange?.(newUnread);
    } finally {
      setLoading(false);
    }
  }, [tab, onUnreadCountChange]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  useEventBus('notification.new', () => { fetchNotifications(); });

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', ids: [id] }),
    });
    const newUnread = Math.max(0, unreadCount - 1);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount(newUnread);
    onUnreadCountChange?.(newUnread);
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', ids: 'all' }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    onUnreadCountChange?.(0);
  };

  const deleteNotif = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'mentions', label: 'Mentions' },
    { id: 'system', label: 'System' },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed top-12 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 380,
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-label="Notification Center"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-error)', color: '#fff' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-accent)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                title="Mark all as read"
              >
                <CheckCheck size={13} aria-hidden="true" />
                <span>All read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              aria-label="Close notifications"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 text-[11px] font-medium py-2 transition-colors"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader size={20} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
            </div>
          )}
          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bell size={32} style={{ color: 'var(--color-border)' }} aria-hidden="true" />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No notifications</p>
            </div>
          )}
          {!loading && notifications.map(n => (
            <div
              key={n.id}
              role="listitem"
              className="group flex items-start gap-3 px-4 py-3 cursor-pointer"
              style={{
                background: n.readAt ? 'transparent' : 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
                borderBottom: '1px solid var(--color-border)',
              }}
              onClick={() => { if (!n.readAt) markRead(n.id); }}
            >
              <div className="flex-shrink-0 mt-1" style={{ width: 8 }}>
                {!n.readAt && (
                  <span
                    aria-label="Unread"
                    className="block w-2 h-2 rounded-full"
                    style={{ background: 'var(--color-accent)' }}
                  />
                )}
              </div>
              <div className="flex-shrink-0 mt-0.5">
                <TypeIcon type={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium leading-snug truncate" style={{ color: 'var(--color-text)' }}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                    {n.body}
                  </p>
                )}
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {relativeTime(n.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Dismiss notification"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
