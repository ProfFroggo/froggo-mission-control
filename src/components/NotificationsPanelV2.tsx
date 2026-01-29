/**
 * Enhanced Notifications Panel V2
 * System notification center with desktop notifications, filtering, and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, Check, X, Clock, MessageSquare, Calendar, Mail, AlertCircle, 
  CheckCircle, RefreshCw, Filter, Inbox, Settings, CheckCheck, 
  Clock3, AlertTriangle, Bot, Star, XCircle, Activity 
} from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';
import { 
  notificationService, 
  Notification, 
  NotificationStats, 
  NotificationPreferences 
} from '../lib/notificationService';

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  task_complete: { icon: CheckCircle, color: 'text-green-400 bg-green-500/10', label: 'Task Complete' },
  task_deadline: { icon: Clock3, color: 'text-orange-400 bg-orange-500/10', label: 'Deadline' },
  agent_update: { icon: Bot, color: 'text-purple-400 bg-purple-500/10', label: 'Agent Update' },
  message_arrival: { icon: MessageSquare, color: 'text-blue-400 bg-blue-500/10', label: 'Message' },
  approval_pending: { icon: AlertCircle, color: 'text-yellow-400 bg-yellow-500/10', label: 'Approval' },
  calendar_event: { icon: Calendar, color: 'text-pink-400 bg-pink-500/10', label: 'Event' },
  system_alert: { icon: AlertTriangle, color: 'text-red-400 bg-red-500/10', label: 'Alert' },
  skill_learned: { icon: Star, color: 'text-cyan-400 bg-cyan-500/10', label: 'Skill' },
  error: { icon: XCircle, color: 'text-red-400 bg-red-500/10', label: 'Error' },
};

const priorityBadges: Record<string, { color: string; label: string }> = {
  urgent: { color: 'bg-red-500 text-white', label: 'Urgent' },
  high: { color: 'bg-orange-500 text-white', label: 'High' },
  normal: { color: 'bg-blue-500/20 text-blue-400', label: 'Normal' },
  low: { color: 'bg-gray-500/20 text-gray-400', label: 'Low' },
};

export default function NotificationsPanelV2() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, urgent: 0, actionable: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent' | 'actionable'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences[]>([]);

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
      console.error('Failed to load notifications:', error);
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
      console.error('Failed to load preferences:', e);
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

  const handleTogglePreference = async (type: string, field: keyof NotificationPreferences, value: any) => {
    try {
      await notificationService.updatePreferences(type, { [field]: value });
      setPreferences(prev => prev.map(p => 
        p.type === type ? { ...p, [field]: value } : p
      ));
      showToast('success', 'Preferences updated');
    } catch (e) {
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

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return n.priority === 'urgent';
    if (filter === 'actionable') return n.actionable;
    return true;
  });

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
        <div className="p-6 border-b border-clawd-border bg-clawd-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
              <div>
                <h1 className="text-xl font-semibold">Notification Settings</h1>
                <p className="text-sm text-clawd-text-dim">Configure notification preferences</p>
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
                  className="p-4 bg-clawd-surface border border-clawd-border rounded-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config?.color || 'bg-gray-500/10'} flex items-center justify-center`}>
                      <Icon size={20} />
                    </div>
                    
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
                            className="bg-clawd-border rounded px-2 py-1 text-xs"
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
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/20 rounded-xl relative">
              <Bell size={24} className="text-clawd-accent" />
              {stats.unread > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.unread > 9 ? '9+' : stats.unread}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold">Notifications</h1>
              <p className="text-sm text-clawd-text-dim">
                {stats.total} total • {stats.unread} unread
                {stats.urgent > 0 && ` • ${stats.urgent} urgent`}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
            
            <button
              onClick={loadNotifications}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
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
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({count || 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredNotifications.length === 0 ? (
          <EmptyState 
            type="notifications" 
            description={filter !== 'all' ? `No ${filter} notifications` : 'No notifications'}
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const config = typeConfig[notif.type];
              const Icon = config?.icon || Bell;
              const priorityBadge = priorityBadges[notif.priority];
              
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    notif.priority === 'urgent'
                      ? 'bg-red-500/5 border-red-500/30 shadow-lg'
                      : notif.read
                      ? 'bg-clawd-bg border-clawd-border opacity-60'
                      : 'bg-clawd-surface border-clawd-border shadow-card hover:shadow-card-hover'
                  }`}
                  onClick={() => handleNavigate(notif)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config?.color || 'bg-gray-500/10'} flex-shrink-0 flex items-center justify-center`}>
                      <Icon size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{notif.title}</span>
                        {notif.priority !== 'normal' && (
                          <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 whitespace-nowrap ${priorityBadge.color}`}>
                            {priorityBadge.label}
                          </span>
                        )}
                        {notif.actionable && (
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded flex-shrink-0 whitespace-nowrap">
                            Action required
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-clawd-text-dim">{notif.message}</p>
                      
                      {notif.description && (
                        <p className="text-xs text-clawd-text-dim mt-1 opacity-75">{notif.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-clawd-text-dim flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${config?.color.replace('text-', 'bg-').replace('/10', '/20') || 'bg-gray-500/20'}`}>
                          {config?.label || notif.type}
                        </span>
                        <Clock size={10} />
                        <span>{formatTimeAgo(notif.created_at)}</span>
                        {notif.source_id && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-xs opacity-50">{notif.source_id}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {!notif.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(notif.id);
                          }}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
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
