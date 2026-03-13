/**
 * Enhanced Notifications Panel V2
 * System notification center with desktop notifications, filtering, and actions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bell, Check, X, Clock, MessageSquare, Calendar, AlertCircle,
  CheckCircle, RefreshCw, Settings, CheckCheck,
  Clock3, AlertTriangle, Bot, Star, XCircle, CheckSquare, Eye, Shield,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import IconBadge from './IconBadge';
import {
  notificationService,
  Notification,
  NotificationStats,
  NotificationPreferences
} from '../lib/notificationService';

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  task_complete: { icon: CheckCircle, color: 'text-success bg-success-subtle', label: 'Task Complete' },
  task_deadline: { icon: Clock3, color: 'text-warning bg-warning-subtle', label: 'Deadline' },
  task_assigned: { icon: CheckSquare, color: 'text-info bg-info-subtle', label: 'Task Assigned' },
  agent_update: { icon: Bot, color: 'text-review bg-review-subtle', label: 'Agent Update' },
  message_arrival: { icon: MessageSquare, color: 'text-info bg-info-subtle', label: 'Message' },
  approval_pending: { icon: Eye, color: 'text-warning bg-warning-subtle', label: 'Review Needed' },
  human_review: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10', label: 'Human Review' },
  calendar_event: { icon: Calendar, color: 'text-pink-400 bg-pink-500/10', label: 'Event' },
  system_alert: { icon: AlertTriangle, color: 'text-error bg-error-subtle', label: 'Alert' },
  skill_learned: { icon: Star, color: 'text-cyan-400 bg-cyan-500/10', label: 'Skill' },
  approval_needed: { icon: Shield, color: 'text-orange-400 bg-orange-500/10', label: 'Approval Needed' },
  error: { icon: XCircle, color: 'text-error bg-error-subtle', label: 'Error' },
};

// Helper: group notifications by day
function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const groups: { label: string; items: Notification[] }[] = [];
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const older: Notification[] = [];

  for (const n of notifications) {
    const ts = n.created_at;
    if (ts >= todayStart.getTime()) today.push(n);
    else if (ts >= yesterdayStart.getTime()) yesterday.push(n);
    else older.push(n);
  }

  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
  if (older.length > 0) groups.push({ label: 'Older', items: older });
  return groups;
}

const priorityBadges: Record<string, { color: string; label: string }> = {
  urgent: { color: 'bg-red-500 text-white', label: 'Urgent' },
  high: { color: 'bg-orange-500 text-white', label: 'High' },
  normal: { color: 'bg-info-subtle text-info', label: 'Normal' },
  low: { color: 'bg-mission-control-bg0/20 text-mission-control-text-dim', label: 'Low' },
};

// Quick preference toggles — stored in localStorage
const QUICK_PREFS: Array<{ key: string; label: string }> = [
  { key: 'task_assigned', label: 'Task assigned to me' },
  { key: 'agent_update', label: 'Clara review complete' },
  { key: 'human_review', label: 'Human review requested' },
  { key: 'approval_needed', label: 'Approval needed' },
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

export default function NotificationsPanelV2() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, urgent: 0, actionable: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent' | 'actionable'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences[]>([]);
  const [quickPrefs, setQuickPrefs] = useState<Record<string, boolean>>(loadQuickPrefs);
  const [showQuickPrefs, setShowQuickPrefs] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [active, currentStats] = await Promise.all([
        notificationService.getActive(),
        notificationService.getStats(),
      ]);
      setNotifications(active);
      setStats(currentStats);
    } catch (error) {
      // 'Failed to load notifications:', error;
      showToast('error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await notificationService.getPreferences() as NotificationPreferences[];
      setPreferences(prefs);
    } catch (e) {
      // 'Failed to load preferences:', e;
    }
  }, []);

  useEffect(() => {
    // Initialize service
    notificationService.init();
    
    // Initial load
    loadNotifications();
    loadPreferences();

    // Subscribe to new notifications
    const unsubscribe = notificationService.subscribe((notification) => {
      setNotifications(prev => [notification, ...prev]);
      loadNotifications(); // Refresh to get updated stats
    });

    // Subscribe to stats updates
    const unsubscribeStats = notificationService.subscribeStats(setStats);

    return () => {
      unsubscribe();
      unsubscribeStats();
    };
  }, [loadNotifications, loadPreferences]);

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleDismiss = async (id: string) => {
    await notificationService.dismiss(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('success', 'All marked as read');
  };

  const handleDismissAll = async () => {
    // Clear local state immediately
    setNotifications([]);
    setStats(prev => ({ ...prev, total: 0, unread: 0 }));
    // Best-effort server call — ignore if route doesn't exist
    fetch('/api/notifications/dismiss-all', { method: 'POST' }).catch(() => {});
    showToast('success', 'All notifications dismissed');
  };

  const handleToggleQuickPref = (key: string, value: boolean) => {
    const updated = { ...quickPrefs, [key]: value };
    setQuickPrefs(updated);
    try {
      localStorage.setItem('notif.prefs', JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  const handleTogglePreference = async (type: string, field: keyof NotificationPreferences, value: any) => {
    try {
      await notificationService.updatePreferences(type, { [field]: value });
      setPreferences(prev => prev.map(p => 
        p.type === type ? { ...p, [field]: value } : p
      ));
      showToast('success', 'Preferences updated');
    } catch (_e) {
      showToast('error', 'Failed to update preferences');
    }
  };

  const handleNavigate = (notification: Notification) => {
    if (notification.action_url) {
      // Emit navigation event
      window.dispatchEvent(new CustomEvent('navigate', { detail: notification.action_url }));
      handleMarkRead(notification.id);
    }
  };

  const filteredNotifications = useMemo(() => notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return n.priority === 'urgent';
    if (filter === 'actionable') return n.actionable;
    return true;
  }), [notifications, filter]);

  const groupedNotifications = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications]);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const days = Math.floor(diff / 86400000);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  if (showSettings) {
    return (
      <div className="h-full flex flex-col">
        {/* Settings Header */}
        <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-mission-control-text">Notification Settings</h1>
                <p className="text-sm text-mission-control-text-dim">Configure notification preferences</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {preferences.map((pref) => {
              const config = typeConfig[pref.type];
              const Icon = config?.icon || Bell;
              
              return (
                <div
                  key={pref.type}
                  className="p-4 bg-mission-control-surface border border-mission-control-border rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <IconBadge icon={Icon} size={18} color={config?.color || 'bg-mission-control-bg0/10 text-mission-control-text-dim'} />
                    
                    <div className="flex-1">
                      <div className="font-medium mb-1">{config?.label || pref.type}</div>
                      
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pref.enabled}
                            onChange={(e) => handleTogglePreference(pref.type, 'enabled', e.target.checked)}
                            className="rounded"
                          />
                          <span>Enabled</span>
                        </label>
                        
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pref.show_desktop}
                            disabled={!pref.enabled}
                            onChange={(e) => handleTogglePreference(pref.type, 'show_desktop', e.target.checked)}
                            className="rounded"
                          />
                          <span>Desktop notification</span>
                        </label>
                        
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pref.play_sound}
                            disabled={!pref.enabled}
                            onChange={(e) => handleTogglePreference(pref.type, 'play_sound', e.target.checked)}
                            className="rounded"
                          />
                          <span>Play sound</span>
                        </label>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <span>Min priority:</span>
                          <select
                            value={pref.min_priority}
                            disabled={!pref.enabled}
                            onChange={(e) => handleTogglePreference(pref.type, 'min_priority', e.target.value)}
                            className="bg-mission-control-border rounded px-2 py-1 text-xs"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl relative">
              <Bell size={24} className="text-mission-control-accent" />
              {stats.unread > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
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
          </div>
          
          <div className="flex gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleDismissAll}
                className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
                title="Dismiss all notifications"
              >
                <X size={14} />
                Dismiss all
              </button>
            )}

            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}

            <button
              onClick={loadNotifications}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'unread', 'urgent', 'actionable'] as const).map((f) => {
            const count = f === 'all' ? stats.total 
              : f === 'unread' ? stats.unread
              : f === 'urgent' ? stats.urgent
              : stats.actionable;
            
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({count || 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredNotifications.length === 0 ? (
          <EmptyState
            type="notifications"
            description={filter !== 'all' ? `No ${filter} notifications` : 'No notifications'}
          />
        ) : (
          <div className="space-y-5">
            {groupedNotifications.map(({ label, items }) => (
              <div key={label}>
                {/* Date group header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-mission-control-border/50" />
                  <span className="text-xs text-mission-control-text-dim/60">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.map((notif) => {
                    const config = typeConfig[notif.type];
                    const Icon = config?.icon || Bell;
                    const priorityBadge = priorityBadges[notif.priority];
                    const isTask = notif.source === 'task' || notif.type.startsWith('task_');
                    const isApproval = notif.type === 'approval_pending';

                    return (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border transition-all ${
                          notif.priority === 'urgent'
                            ? 'bg-error-subtle border-error-border shadow-lg'
                            : notif.read
                            ? 'bg-mission-control-bg border-mission-control-border opacity-60'
                            : 'bg-mission-control-surface border-mission-control-border shadow-card hover:shadow-card-hover'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <IconBadge icon={Icon} size={16} color={config?.color || 'bg-mission-control-bg0/10 text-mission-control-text-dim'} />

                          <div className="flex-1 min-w-0">
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
                                {notif.priority !== 'normal' && (
                                  <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 whitespace-nowrap ${priorityBadge.color}`}>
                                    {priorityBadge.label}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-mission-control-text-dim line-clamp-2">{notif.message}</p>

                              {notif.description && (
                                <p className="text-xs text-mission-control-text-dim mt-1 opacity-75 line-clamp-2">{notif.description}</p>
                              )}

                              <div className="flex items-center gap-2 mt-2 text-xs text-mission-control-text-dim flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${config?.color || 'bg-mission-control-bg0/20 text-mission-control-text-dim'}`}>
                                  {config?.label || notif.type}
                                </span>
                                <Clock size={10} />
                                <span>{formatTimeAgo(notif.created_at)}</span>
                                {notif.channel && (
                                  <>
                                    <span>•</span>
                                    <span className="text-xs opacity-75">{notif.channel}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Inline quick actions */}
                            {(isTask || isApproval) && !notif.read && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-mission-control-border/30">
                                {isTask && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigate(notif);
                                      handleMarkRead(notif.id);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-info-subtle text-info text-xs font-medium rounded-lg hover:bg-info-subtle/80 transition-colors"
                                  >
                                    <Eye size={12} />
                                    View Task
                                  </button>
                                )}
                                {isApproval && (
                                  <>
                                    <button
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
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-success-subtle text-success text-xs font-medium rounded-lg hover:bg-success-subtle/80 transition-colors"
                                    >
                                      <Check size={12} />
                                      Approve
                                    </button>
                                    <button
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
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-error-subtle text-error text-xs font-medium rounded-lg hover:bg-error-subtle/80 transition-colors"
                                    >
                                      <X size={12} />
                                      Deny
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 flex-shrink-0">
                            {!notif.read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkRead(notif.id);
                                }}
                                className="p-2 bg-success-subtle text-success rounded-lg hover:bg-success-subtle transition-colors"
                                title="Mark as read"
                              >
                                <Check size={16} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismiss(notif.id);
                              }}
                              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors text-mission-control-text-dim"
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible notification preferences section */}
      <div className="border-t border-mission-control-border">
        <button
          onClick={() => setShowQuickPrefs(prev => !prev)}
          className="w-full flex items-center gap-2 px-5 py-3 text-xs font-semibold text-mission-control-text-dim hover:bg-mission-control-border/40 transition-colors"
        >
          {showQuickPrefs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Notification Preferences
        </button>
        {showQuickPrefs && (
          <div className="px-5 pb-4 space-y-3">
            {QUICK_PREFS.map(pref => (
              <label key={pref.key} className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-mission-control-text-dim">{pref.label}</span>
                <button
                  role="switch"
                  aria-checked={quickPrefs[pref.key]}
                  onClick={() => handleToggleQuickPref(pref.key, !quickPrefs[pref.key])}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none ${
                    quickPrefs[pref.key]
                      ? 'bg-mission-control-accent'
                      : 'bg-mission-control-border'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                      quickPrefs[pref.key] ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
