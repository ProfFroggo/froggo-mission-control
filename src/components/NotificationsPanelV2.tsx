// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Enhanced Notifications Panel V2
 * Features: type grouping, browser push opt-in, action buttons, sound toggle, priority badges
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell, BellOff, Check, X, Clock,
  CheckCircle, RefreshCw, Settings, CheckCheck,
  Clock3, AlertTriangle, Bot, Star, XCircle, CheckSquare, Eye, Shield,
  ChevronDown, ChevronRight, Volume2, VolumeX, ExternalLink,
  MessageSquare, Calendar
} from 'lucide-react';
import { Button, Select, Checkbox, Switch, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import IconBadge from './IconBadge';
import {
  notificationService,
  type Notification,
  type NotificationStats,
  type NotificationPreferences
} from '../lib/notificationService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PUSH_PREF_KEY = 'mission-control.push-notifications';
const SOUND_PREF_KEY = 'mission-control.notification-sound';

// ─── Type config ──────────────────────────────────────────────────────────────

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  task_complete:    { icon: CheckCircle,   color: 'text-success bg-success/10',       label: 'Task Complete'   },
  task_deadline:    { icon: Clock3,        color: 'text-warning bg-warning/10',       label: 'Deadline'        },
  task_assigned:    { icon: CheckSquare,   color: 'text-info bg-info/10',             label: 'Task Assigned'   },
  agent_update:     { icon: Bot,           color: 'text-review bg-review-subtle',         label: 'Agent Update'    },
  message_arrival:  { icon: MessageSquare, color: 'text-info bg-info/10',             label: 'Message'         },
  approval_pending: { icon: Eye,           color: 'text-warning bg-warning/10',       label: 'Review Needed'   },
  human_review:     { icon: AlertTriangle, color: 'text-warning bg-warning/10',       label: 'Human Review'    },
  calendar_event:   { icon: Calendar,      color: 'text-pink-400 bg-pink-500/10',         label: 'Event'           },
  system_alert:     { icon: AlertTriangle, color: 'text-error bg-error/10',           label: 'Alert'           },
  skill_learned:    { icon: Star,          color: 'text-cyan-400 bg-cyan-500/10',         label: 'Skill'           },
  approval_needed:  { icon: Shield,        color: 'text-danger bg-danger/10',              label: 'Approval Needed' },
  error:            { icon: XCircle,       color: 'text-error bg-error/10',           label: 'Error'           },
};

// ─── Group definitions ────────────────────────────────────────────────────────

type GroupKey = 'Tasks' | 'Agents' | 'Approvals' | 'System';

const GROUP_ORDER: GroupKey[] = ['Tasks', 'Agents', 'Approvals', 'System'];

function getGroup(n: Notification): GroupKey {
  const t = n.type as string;
  if (t === 'task_complete' || t === 'task_deadline' || t === 'task_assigned') return 'Tasks';
  if (t === 'agent_update' || n.source === 'agent') return 'Agents';
  if (t === 'approval_pending' || t === 'approval_needed' || t === 'human_review') return 'Approvals';
  return 'System';
}

function groupByType(notifications: Notification[]): { group: GroupKey; items: Notification[] }[] {
  const map: Record<GroupKey, Notification[]> = { Tasks: [], Agents: [], Approvals: [], System: [] };
  for (const n of notifications) {
    map[getGroup(n)].push(n);
  }
  // Within each group: sort by time descending
  for (const g of GROUP_ORDER) {
    map[g].sort((a, b) => b.created_at - a.created_at);
  }
  return GROUP_ORDER.filter(g => map[g].length > 0).map(g => ({ group: g, items: map[g] }));
}

// ─── Priority helpers ─────────────────────────────────────────────────────────

// Notification types that always get the red "!" badge
const HIGH_PRIORITY_TYPES = new Set([
  'system_alert',
  'error',
  'human_review',
  'approval_needed',
]);

function isHighPriority(n: Notification): boolean {
  return n.priority === 'urgent' || HIGH_PRIORITY_TYPES.has(n.type as string);
}

// ─── Quick preferences ────────────────────────────────────────────────────────

const QUICK_PREFS: Array<{ key: string; label: string }> = [
  { key: 'task_assigned',   label: 'Task assigned to me'    },
  { key: 'agent_update',    label: 'Clara review complete'  },
  { key: 'human_review',    label: 'Human review requested' },
  { key: 'approval_needed', label: 'Approval needed'        },
];

function loadQuickPrefs(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const p of QUICK_PREFS) defaults[p.key] = true;
  try {
    const stored = localStorage.getItem('notif.prefs');
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return defaults;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function playNotificationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Browser policy blocks AudioContext without prior user gesture — silently ignore
  }
}

function firePushNotification(message: string): void {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification('Mission Control', { body: message, icon: '/favicon.ico' });
  } catch {
    // Push failed — ignore
  }
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      size="2"
    />
  );
}

// ─── Hover action buttons ─────────────────────────────────────────────────────

interface ActionButtonsProps {
  notif: Notification;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}

function ActionButtons({ notif, onDismiss, onMarkRead }: ActionButtonsProps) {
  const group = getGroup(notif);

  const navigateTo = (panel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('navigate', { detail: panel }));
    onMarkRead(notif.id);
  };

  return (
    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Context-specific navigation */}
      {group === 'Tasks' && (
        <button
          onClick={(e) => navigateTo('kanban', e)}
          title="View task"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <ExternalLink size={14} />
        </button>
      )}
      {group === 'Approvals' && (
        <button
          onClick={(e) => navigateTo('approvals', e)}
          title="Review"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <ExternalLink size={14} />
        </button>
      )}
      {group === 'Agents' && (
        <button
          onClick={(e) => navigateTo('agents', e)}
          title="View agent"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <ExternalLink size={14} />
        </button>
      )}

      {/* Mark read */}
      {!notif.read && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
          title="Mark as read"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <Check size={14} />
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
        title="Dismiss"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotificationsPanelV2() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, urgent: 0, actionable: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent' | 'actionable'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences[]>([]);
  const [quickPrefs, setQuickPrefs] = useState<Record<string, boolean>>(loadQuickPrefs);
  const [showQuickPrefs, setShowQuickPrefs] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<GroupKey>>(new Set());

  // Push notifications
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(PUSH_PREF_KEY) === 'true'; } catch { return false; }
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(SOUND_PREF_KEY) === 'true'; } catch { return false; }
  });

  // Refs to hold latest pref values inside the subscription callback
  const soundEnabledRef = useRef(soundEnabled);
  const pushEnabledRef = useRef(pushEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { pushEnabledRef.current = pushEnabled; }, [pushEnabled]);

  // Track seen notification ids to detect arrivals
  const seenIds = useRef<Set<string>>(new Set());

  const savePushPref = useCallback((value: boolean) => {
    setPushEnabled(value);
    try { localStorage.setItem(PUSH_PREF_KEY, String(value)); } catch { /* ignore */ }
  }, []);

  const saveSoundPref = useCallback((value: boolean) => {
    setSoundEnabled(value);
    try { localStorage.setItem(SOUND_PREF_KEY, String(value)); } catch { /* ignore */ }
  }, []);

  const handleRequestPush = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      savePushPref(true);
      showToast('success', 'Browser notifications enabled');
      return;
    }
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission === 'granted') {
      savePushPref(true);
      showToast('success', 'Browser notifications enabled');
    } else {
      showToast('error', 'Permission denied — enable notifications in browser settings');
    }
  }, [savePushPref]);

  const handleDisablePush = useCallback(() => {
    savePushPref(false);
    showToast('info', 'Browser notifications disabled');
  }, [savePushPref]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [active, currentStats] = await Promise.all([
        notificationService.getActive(),
        notificationService.getStats(),
      ]);
      setNotifications(active);
      setStats(currentStats);
      // Seed seen ids on initial load so we don't fire for existing notifications
      for (const n of active) seenIds.current.add(n.id);
    } catch {
      showToast('error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await notificationService.getPreferences() as NotificationPreferences[];
      setPreferences(prefs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    notificationService.init();
    loadNotifications();
    loadPreferences();

    const unsubscribe = notificationService.subscribe((notification) => {
      const isNew = !seenIds.current.has(notification.id);
      seenIds.current.add(notification.id);

      if (isNew) {
        if (soundEnabledRef.current) playNotificationSound();
        if (pushEnabledRef.current) firePushNotification(notification.message || notification.title);
      }

      setNotifications(prev => [notification, ...prev.filter(n => n.id !== notification.id)]);
      loadNotifications();
    });

    const unsubscribeStats = notificationService.subscribeStats(setStats);

    return () => {
      unsubscribe();
      unsubscribeStats();
    };
  }, [loadNotifications, loadPreferences]);

  const handleMarkRead = useCallback(async (id: string) => {
    await notificationService.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    await notificationService.dismiss(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await notificationService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('success', 'All marked as read');
  }, []);

  const handleDismissAll = useCallback(async () => {
    setNotifications([]);
    setStats(prev => ({ ...prev, total: 0, unread: 0 }));
    fetch('/api/notifications/dismiss-all', { method: 'POST' }).catch(() => {});
    showToast('success', 'All notifications dismissed');
  }, []);

  const handleToggleQuickPref = useCallback((key: string, value: boolean) => {
    const updated = { ...quickPrefs, [key]: value };
    setQuickPrefs(updated);
    try { localStorage.setItem('notif.prefs', JSON.stringify(updated)); } catch { /* ignore */ }
  }, [quickPrefs]);

  const handleTogglePreference = useCallback(async (type: string, field: keyof NotificationPreferences, value: any) => {
    try {
      await notificationService.updatePreferences(type, { [field]: value });
      setPreferences(prev => prev.map(p => p.type === type ? { ...p, [field]: value } : p));
      showToast('success', 'Preferences updated');
    } catch {
      showToast('error', 'Failed to update preferences');
    }
  }, []);

  const handleNavigate = useCallback((notification: Notification) => {
    if (notification.action_url) {
      window.dispatchEvent(new CustomEvent('navigate', { detail: notification.action_url }));
      handleMarkRead(notification.id);
    }
  }, [handleMarkRead]);

  const toggleGroup = useCallback((group: GroupKey) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const filteredNotifications = useMemo(() => notifications.filter(n => {
    if (filter === 'unread')     return !n.read;
    if (filter === 'urgent')     return n.priority === 'urgent';
    if (filter === 'actionable') return n.actionable;
    return true;
  }), [notifications, filter]);

  const groupedNotifications = useMemo(() => groupByType(filteredNotifications), [filteredNotifications]);

  // ── Settings view ──────────────────────────────────────────────────────────

  if (showSettings) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
          <Flex align="center" gap="3">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <X size={20} />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-mission-control-text">Notification Settings</h1>
              <p className="text-sm text-mission-control-text-dim">Configure notification preferences</p>
            </div>
          </Flex>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Browser push opt-in */}
          <div className="p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <Flex align="center" justify="between" className="mb-1">
              <Flex align="center" gap="2">
                {pushEnabled && pushPermission === 'granted'
                  ? <Bell size={16} className="text-mission-control-accent" />
                  : <BellOff size={16} className="text-mission-control-text-dim" />
                }
                <span className="font-medium text-sm">Browser notifications</span>
              </Flex>
              {pushPermission === 'unsupported' ? (
                <span className="text-xs text-mission-control-text-dim">Not supported</span>
              ) : pushEnabled && pushPermission === 'granted' ? (
                <Button
                  size="1"
                  variant="soft"
                  color="red"
                  onClick={handleDisablePush}
                >
                  Disable
                </Button>
              ) : (
                <Button
                  size="1"
                  variant="soft"
                  onClick={handleRequestPush}
                >
                  Enable browser notifications
                </Button>
              )}
            </Flex>
            <p className="text-xs text-mission-control-text-dim pl-6">
              {pushEnabled && pushPermission === 'granted'
                ? 'You will receive browser push notifications for new events.'
                : 'Get browser push notifications when new notifications arrive.'}
            </p>
          </div>

          {/* Sound toggle */}
          <div className="p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <Flex align="center" justify="between" className="mb-1">
              <Flex align="center" gap="2">
                {soundEnabled
                  ? <Volume2 size={16} className="text-mission-control-accent" />
                  : <VolumeX size={16} className="text-mission-control-text-dim" />
                }
                <span className="font-medium text-sm">Notification sounds</span>
              </Flex>
              <Toggle checked={soundEnabled} onChange={saveSoundPref} />
            </Flex>
            <p className="text-xs text-mission-control-text-dim pl-6">
              Play a subtle beep when new notifications arrive.
            </p>
          </div>

          {/* Per-type preferences */}
          <div className="space-y-4">
            {preferences.map((pref) => {
              const config = typeConfig[pref.type];
              const Icon = config?.icon || Bell;
              return (
                <div key={pref.type} className="p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
                  <Flex align="start" gap="3">
                    <IconBadge icon={Icon} size={18} color={config?.color || 'bg-mission-control-surface/10 text-mission-control-text-dim'} />
                    <div className="flex-1">
                      <div className="font-medium mb-1">{config?.label || pref.type}</div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={pref.enabled}
                            onCheckedChange={(v) => handleTogglePreference(pref.type, 'enabled', !!v)}
                          />
                          <span>Enabled</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={pref.show_desktop}
                            disabled={!pref.enabled}
                            onCheckedChange={(v) => handleTogglePreference(pref.type, 'show_desktop', !!v)}
                          />
                          <span>Desktop notification</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={pref.play_sound}
                            disabled={!pref.enabled}
                            onCheckedChange={(v) => handleTogglePreference(pref.type, 'play_sound', !!v)}
                          />
                          <span>Play sound</span>
                        </label>
                        <Flex align="center" gap="2" className="text-sm">
                          <span>Min priority:</span>
                          <Select.Root
                            value={pref.min_priority}
                            disabled={!pref.enabled}
                            onValueChange={(v) => handleTogglePreference(pref.type, 'min_priority', v)}
                            size="1"
                          >
                            <Select.Trigger />
                            <Select.Content>
                              <Select.Item value="low">Low</Select.Item>
                              <Select.Item value="normal">Normal</Select.Item>
                              <Select.Item value="high">High</Select.Item>
                              <Select.Item value="urgent">Urgent</Select.Item>
                            </Select.Content>
                          </Select.Root>
                        </Flex>
                      </div>
                    </div>
                  </Flex>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <Flex direction="column" height="100%">
      {/* Header */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" justify="between" className="mb-4">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg relative">
              <Bell size={24} className="text-mission-control-accent" />
              {stats.unread > 0 && (
                <div className="absolute -top-1 -right-1 bg-error text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center tabular-nums">
                  {stats.unread > 9 ? '9+' : stats.unread}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-mission-control-text">Notifications</h1>
              <p className="text-sm text-mission-control-text-dim">
                {stats.total} total • {stats.unread} unread
                {stats.urgent > 0 && ` • ${stats.urgent} urgent`}
              </p>
            </div>
          </Flex>

          <div className="flex gap-2 items-center flex-wrap">
            {/* Sound quick toggle */}
            <button
              onClick={() => saveSoundPref(!soundEnabled)}
              title={soundEnabled ? 'Mute notification sounds' : 'Enable notification sounds'}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Push notification quick toggle */}
            <button
              onClick={pushEnabled ? handleDisablePush : handleRequestPush}
              title={pushEnabled && pushPermission === 'granted' ? 'Disable browser notifications' : 'Enable browser notifications'}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                pushEnabled && pushPermission === 'granted'
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {pushEnabled && pushPermission === 'granted' ? <Bell size={16} /> : <BellOff size={16} />}
            </button>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleDismissAll}
                title="Dismiss all notifications"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <X size={14} />
                Dismiss all
              </button>
            )}

            {stats.unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}

            <button
              type="button"
              onClick={loadNotifications}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <Settings size={16} />
            </button>
          </div>
        </Flex>

        {/* Filter tabs */}
        <Flex align="center" className="border-b border-mission-control-border -mb-px">
          {(['all', 'unread', 'urgent', 'actionable'] as const).map((f) => {
            const count = f === 'all' ? stats.total
              : f === 'unread' ? stats.unread
              : f === 'urgent' ? stats.urgent
              : stats.actionable;
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
                  {count || 0}
                </span>
              </button>
            );
          })}
        </Flex>
      </div>

      {/* Notifications list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredNotifications.length === 0 ? (
          <EmptyState
            type="notifications"
            description={filter !== 'all' ? `No ${filter} notifications` : 'No notifications'}
          />
        ) : (
          <div className="space-y-4">
            {groupedNotifications.map(({ group, items }) => {
              const isCollapsed = collapsedGroups.has(group);
              return (
                <div key={group}>
                  {/* Collapsible group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center gap-2 mb-2 group/header bg-transparent border-0 p-0 cursor-pointer"
                  >
                    {isCollapsed
                      ? <ChevronRight size={14} className="text-mission-control-text-dim flex-shrink-0" />
                      : <ChevronDown  size={14} className="text-mission-control-text-dim flex-shrink-0" />
                    }
                    <span className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
                      {group}
                    </span>
                    <div className="flex-1 h-px bg-mission-control-border/50" />
                    <span className="text-xs font-medium text-mission-control-text-dim bg-mission-control-border px-1.5 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </button>

                  {/* Group items */}
                  {!isCollapsed && (
                    <div className="space-y-2">
                      {items.map((notif) => {
                        const config = typeConfig[notif.type];
                        const Icon = config?.icon || Bell;
                        const highPriority = isHighPriority(notif);
                        const notifGroup = getGroup(notif);
                        const isTask     = notifGroup === 'Tasks';
                        const isApproval = notifGroup === 'Approvals';

                        return (
                          <div
                            key={notif.id}
                            className={`p-4 rounded-lg border transition-colors group ${
                              notif.priority === 'urgent'
                                ? 'bg-error/10 border-error/30 border-l-2 border-l-[var(--color-error)] shadow-lg'
                                : notif.read
                                ? 'bg-transparent border-mission-control-border opacity-70'
                                : 'bg-mission-control-accent/5 border-mission-control-border border-l-2 border-l-mission-control-accent shadow-card hover:shadow-card-hover'
                            }`}
                          >
                            <Flex align="start" gap="3">
                              <IconBadge icon={Icon} size={16} color={config?.color || 'bg-mission-control-surface/10 text-mission-control-text-dim'} />

                              <div className="flex-1 min-w-0">
                                {/* Clickable body */}
                                <div
                                  className="cursor-pointer"
                                  onClick={() => handleNavigate(notif)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleNavigate(notif);
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Notification: ${notif.title}`}
                                >
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-medium">{notif.title}</span>

                                    {/* High-priority red "!" badge */}
                                    {highPriority && (
                                      <span
                                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-error/20 text-error text-xs font-bold flex-shrink-0"
                                        title="High priority"
                                        aria-label="High priority"
                                      >
                                        !
                                      </span>
                                    )}

                                    {/* Non-urgent, non-normal priority label */}
                                    {!highPriority && notif.priority !== 'normal' && (
                                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 whitespace-nowrap ${
                                        notif.priority === 'high'
                                          ? 'bg-warning/20 text-warning'
                                          : 'bg-mission-control-border/40 text-mission-control-text-dim'
                                      }`}>
                                        {notif.priority.charAt(0).toUpperCase() + notif.priority.slice(1)}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-sm text-mission-control-text-dim line-clamp-2">{notif.message}</p>

                                  {notif.description && (
                                    <p className="text-xs text-mission-control-text-dim/70 mt-1 line-clamp-2">{notif.description}</p>
                                  )}

                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 whitespace-nowrap ${config?.color || 'bg-mission-control-surface/20 text-mission-control-text-dim'}`}>
                                      {config?.label || notif.type}
                                    </span>
                                    <Clock size={10} className="text-mission-control-text-dim/70" />
                                    <span className="text-[11px] text-mission-control-text-dim/70 tabular-nums">{formatTimeAgo(notif.created_at)}</span>
                                    {notif.channel && (
                                      <>
                                        <span>•</span>
                                        <span className="text-xs opacity-75">{notif.channel}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Inline quick-actions (always visible for tasks / approvals) */}
                                {(isTask || isApproval) && !notif.read && (
                                  <Flex align="center" gap="2" className="mt-3 pt-3 border-t border-mission-control-border/30">
                                    {isTask && (
                                      <Button
                                        size="1"
                                        variant="soft"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.dispatchEvent(new CustomEvent('navigate', { detail: 'kanban' }));
                                          handleMarkRead(notif.id);
                                        }}
                                      >
                                        <Eye size={12} />
                                        View Task
                                      </Button>
                                    )}
                                    {isApproval && (
                                      <>
                                        <Button
                                          size="1"
                                          variant="soft"
                                          color="green"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (notif.source_id) {
                                              fetch(`/api/inbox/${notif.source_id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ status: 'approved' }),
                                              }).catch(() => {});
                                            }
                                            handleDismiss(notif.id);
                                            showToast('success', 'Approved');
                                          }}
                                        >
                                          <Check size={12} />
                                          Approve
                                        </Button>
                                        <Button
                                          size="1"
                                          variant="soft"
                                          color="red"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (notif.source_id) {
                                              fetch(`/api/inbox/${notif.source_id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ status: 'rejected' }),
                                              }).catch(() => {});
                                            }
                                            handleDismiss(notif.id);
                                            showToast('info', 'Denied');
                                          }}
                                        >
                                          <X size={12} />
                                          Deny
                                        </Button>
                                        <Button
                                          size="1"
                                          variant="soft"
                                          color="amber"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent('navigate', { detail: 'approvals' }));
                                            handleMarkRead(notif.id);
                                          }}
                                        >
                                          <Eye size={12} />
                                          Review
                                        </Button>
                                      </>
                                    )}
                                  </Flex>
                                )}
                              </div>

                              {/* Hover-reveal action buttons */}
                              <ActionButtons
                                notif={notif}
                                onDismiss={handleDismiss}
                                onMarkRead={handleMarkRead}
                              />
                            </Flex>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible quick preferences footer */}
      <div className="border-t border-mission-control-border">
        <button
          onClick={() => setShowQuickPrefs(prev => !prev)}
          className="w-full flex items-center gap-2 px-5 py-3 text-xs font-semibold text-mission-control-text-dim hover:bg-mission-control-border/40 transition-colors bg-transparent border-0 cursor-pointer"
        >
          {showQuickPrefs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Notification Preferences
        </button>
        {showQuickPrefs && (
          <div className="px-5 pb-4 space-y-3">
            {QUICK_PREFS.map(pref => (
              <label key={pref.key} className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-mission-control-text-dim">{pref.label}</span>
                <Toggle checked={quickPrefs[pref.key]} onChange={(v) => handleToggleQuickPref(pref.key, v)} />
              </label>
            ))}
          </div>
        )}
      </div>
    </Flex>
  );
}
