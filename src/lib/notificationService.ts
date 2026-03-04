/**
 * Notification Service
 * Fetches real notifications from REST API endpoints
 * and uses Browser Notifications API for desktop alerts
 */

import { gateway } from './gateway';
import { notificationsApi, approvalApi, taskApi } from './api';

export interface Notification {
  id: string;
  created_at: number;
  updated_at: number;
  type: 'task_complete' | 'task_deadline' | 'agent_update' | 'message_arrival' | 'approval_pending' | 'calendar_event' | 'system_alert' | 'skill_learned' | 'error';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  description?: string;
  source: 'task' | 'agent' | 'message' | 'calendar' | 'inbox' | 'system';
  source_id?: string;
  channel?: string;
  read: boolean;
  dismissed: boolean;
  actionable: boolean;
  action_url?: string;
  desktop_shown: boolean;
  desktop_shown_at?: number;
  data?: any;
  expires_at?: number;
  group_key?: string;
}

export interface NotificationPreferences {
  type: string;
  enabled: boolean;
  show_desktop: boolean;
  play_sound: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  min_priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
  actionable: number;
  last_notification_at?: number;
}

// Platform icons for display
const platformLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  telegram: 'Telegram',
  email: 'Email',
};

class NotificationService {
  private listeners: Set<(notification: Notification) => void> = new Set();
  private statsListeners: Set<(stats: NotificationStats) => void> = new Set();
  private cachedNotifications: Notification[] = [];
  private cachedStats: NotificationStats = { total: 0, unread: 0, urgent: 0, actionable: 0 };
  private refreshTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private safetyInterval: ReturnType<typeof setInterval> | null = null;
  private dismissedIds: Set<string> = new Set();
  private readIds: Set<string> = new Set();
  private initialized = false;

  constructor() {
    // Load dismissed/read state from localStorage
    try {
      const dismissed = localStorage.getItem('notif_dismissed');
      if (dismissed) this.dismissedIds = new Set(JSON.parse(dismissed));
      const read = localStorage.getItem('notif_read');
      if (read) this.readIds = new Set(JSON.parse(read));
    } catch { /* ignore */ }
  }

  private saveDismissedState() {
    try {
      localStorage.setItem('notif_dismissed', JSON.stringify([...this.dismissedIds]));
      localStorage.setItem('notif_read', JSON.stringify([...this.readIds]));
    } catch { /* ignore */ }
  }

  /**
   * Initialize the service
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // Initial load for immediate data display
    await this.refresh();

    // ---- Module-Level Gateway Listeners ------------------------------------
    // NotificationService is a singleton (exported instance at bottom of file).
    // init() is called once. These gateway listeners persist for the app
    // lifetime. This is intentional -- do NOT add cleanup or unsubscribe logic.
    // The destroy() method exists only for test teardown, not normal operation.
    // ---- End Listener Lifecycle Note ---------------------------------------
    gateway.on('task.created', () => this.handleTaskEvent());
    gateway.on('task.updated', () => this.handleTaskEvent());
    gateway.on('approval.request', () => this.handleApprovalEvent());
    gateway.on('chat.message', () => this.handleMessageEvent());
    gateway.on('tasks.refresh', () => this.handleTaskEvent());

    // Full refresh on gateway reconnect to catch missed events
    gateway.on('stateChange', ({ state, oldState }: { state: string; oldState: string }) => {
      if (state === 'connected' && oldState !== 'connected') {
        this.refresh();
      }
    });

    // Safety net: slow background refresh in case gateway events are missed
    // This is 10x slower than the old polling (5min vs 30s) — events are the primary path
    this.safetyInterval = setInterval(() => {
      this.refresh();
    }, 300000); // 5 minutes

    // Browser Notifications API — request permission for desktop notifications
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  }

  /**
   * Refresh all notification data from real sources
   */
  private async refresh() {
    try {
      const notifications: Notification[] = [];

      // 1. Fetch unread messages from comms cache
      const msgNotifs = await this.fetchUnreadMessages();
      notifications.push(...msgNotifs);

      // 2. Fetch task-related notifications (completions, deadlines, agent updates)
      const taskNotifs = await this.fetchTaskNotifications();
      notifications.push(...taskNotifs);

      // 3. Fetch approval items
      const approvalNotifs = await this.fetchApprovalNotifications();
      notifications.push(...approvalNotifs);

      // Filter out dismissed
      const active = notifications.filter(n => !this.dismissedIds.has(n.id));

      // Apply read state
      for (const n of active) {
        if (this.readIds.has(n.id)) n.read = true;
      }

      // Sort by created_at desc
      active.sort((a, b) => b.created_at - a.created_at);

      // Check for new notifications
      const oldIds = new Set(this.cachedNotifications.map(n => n.id));
      for (const n of active) {
        if (!oldIds.has(n.id)) {
          this.listeners.forEach(l => l(n));
        }
      }

      this.cachedNotifications = active;

      // Compute stats
      this.cachedStats = {
        total: active.length,
        unread: active.filter(n => !n.read).length,
        urgent: active.filter(n => n.priority === 'urgent').length,
        actionable: active.filter(n => n.actionable).length,
        last_notification_at: active[0]?.created_at,
      };

      this.statsListeners.forEach(l => l(this.cachedStats));
    } catch (e) {
      // '[NotificationService] Refresh failed:', e;
    }
  }

  /**
   * Event handler for task events (created, updated, refresh)
   * Debounced to handle rapid-fire events
   */
  private handleTaskEvent() {
    clearTimeout(this.refreshTimers.get('task')!);
    this.refreshTimers.set('task', setTimeout(() => this.refreshTasks(), 300));
  }

  /**
   * Event handler for approval events
   * Debounced per-type to avoid cancelling unrelated refreshes
   */
  private handleApprovalEvent() {
    clearTimeout(this.refreshTimers.get('approval')!);
    this.refreshTimers.set('approval', setTimeout(() => this.refreshApprovals(), 300));
  }

  /**
   * Event handler for message events
   * Debounced per-type to avoid cancelling unrelated refreshes
   */
  private handleMessageEvent() {
    clearTimeout(this.refreshTimers.get('message')!);
    this.refreshTimers.set('message', setTimeout(() => this.refreshMessages(), 300));
  }

  /**
   * Targeted refresh for task notifications only
   */
  private async refreshTasks() {
    try {
      const taskNotifs = await this.fetchTaskNotifications();
      this.mergeNotifications('task', taskNotifs);
    } catch (e) {
      // '[NotificationService] Task refresh failed:', e;
    }
  }

  /**
   * Targeted refresh for approval notifications only
   */
  private async refreshApprovals() {
    try {
      const approvalNotifs = await this.fetchApprovalNotifications();
      this.mergeNotifications('approval', approvalNotifs);
    } catch (e) {
      // '[NotificationService] Approval refresh failed:', e;
    }
  }

  /**
   * Targeted refresh for message notifications only
   */
  private async refreshMessages() {
    try {
      const msgNotifs = await this.fetchUnreadMessages();
      this.mergeNotifications('message', msgNotifs);
    } catch (e) {
      // '[NotificationService] Message refresh failed:', e;
    }
  }

  /**
   * Merge new notifications of a specific type, preserving others
   */
  private mergeNotifications(type: 'task' | 'approval' | 'message', newNotifs: Notification[]) {
    // Determine ID prefix based on type
    let idPrefix: string;
    if (type === 'task') {
      idPrefix = 'task-act-';
    } else if (type === 'approval') {
      idPrefix = 'approval-';
    } else {
      idPrefix = 'msg-';
    }

    // Remove old notifications of this type
    const kept = this.cachedNotifications.filter(n => !n.id.startsWith(idPrefix));

    // Add new, filtering dismissed
    const active = newNotifs.filter(n => !this.dismissedIds.has(n.id));

    // Apply read state
    for (const n of active) {
      if (this.readIds.has(n.id)) n.read = true;
    }

    // Merge and sort
    const merged = [...kept, ...active].sort((a, b) => b.created_at - a.created_at);

    // Detect new notifications
    const oldIds = new Set(this.cachedNotifications.map(n => n.id));
    for (const n of merged) {
      if (!oldIds.has(n.id)) {
        this.listeners.forEach(l => l(n));
      }
    }

    this.cachedNotifications = merged;
    this.recalcStats();
  }

  /**
   * Fetch unread messages via REST API
   */
  private async fetchUnreadMessages(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    try {
      const result = await notificationsApi.getAll();
      const items = result?.notifications || (Array.isArray(result) ? result : []);
      for (const item of items) {
        if (item.type === 'message_arrival' || item.source === 'message') {
          const ts = item.created_at || item.timestamp || Date.now();
          const platform = item.channel || item.data?.platform || 'unknown';
          const platformLabel = platformLabels[platform] || platform;

          notifications.push({
            id: `msg-${platform}-${item.id || ts}`,
            created_at: ts,
            updated_at: ts,
            type: 'message_arrival',
            priority: item.priority || 'normal',
            title: item.title || item.sender || 'Message',
            message: item.message || item.preview || '(no preview)',
            description: undefined,
            source: 'message',
            source_id: item.source_id,
            channel: platformLabel,
            read: item.read || false,
            dismissed: false,
            actionable: false,
            action_url: undefined,
            desktop_shown: false,
            data: item.data || { platform },
            group_key: `msg-${platform}-${item.source_id || item.id}`,
          });
        }
      }
    } catch (_e) {
      // Fetch messages failed
    }

    return notifications;
  }

  /**
   * Fetch task-related notifications via REST API
   */
  private async fetchTaskNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    try {
      const result = await notificationsApi.getAll();
      const items = result?.notifications || (Array.isArray(result) ? result : []);
      for (const item of items) {
        if (item.type === 'task_complete' || item.type === 'agent_update' || item.type === 'error' || item.source === 'task' || item.source === 'agent') {
          const ts = item.created_at || item.timestamp || Date.now();
          notifications.push({
            id: `task-act-${item.id || ts}`,
            created_at: ts,
            updated_at: ts,
            type: item.type || 'agent_update',
            priority: item.priority || 'normal',
            title: item.title || 'Task Update',
            message: item.message || '',
            source: item.source || 'task',
            source_id: item.source_id,
            channel: item.channel || undefined,
            read: item.read || false,
            dismissed: false,
            actionable: item.type === 'approval_pending',
            action_url: item.type === 'approval_pending' ? `kanban?task=${item.source_id}` : undefined,
            desktop_shown: false,
            data: item.data || {},
          });
        }
      }
    } catch (_e) {
      // Task notifications fetch failed
    }

    return notifications;
  }

  /**
   * Fetch approval notifications via REST API
   */
  private async fetchApprovalNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    try {
      const result = await approvalApi.getAll('pending');
      const items = result?.approvals || result?.items || (Array.isArray(result) ? result : []);
      for (const item of items) {
        if (item.status !== 'pending') continue;

        const ts = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
        notifications.push({
          id: `approval-${item.id || ts}`,
          created_at: ts,
          updated_at: ts,
          type: 'approval_pending',
          priority: 'high',
          title: item.title || 'Approval Required',
          message: item.content || 'Pending your review',
          source: 'inbox',
          source_id: String(item.id),
          channel: item.channel || undefined,
          read: false,
          dismissed: false,
          actionable: true,
          action_url: 'approvals',
          desktop_shown: false,
          data: item,
        });
      }
    } catch (_e) {
      // Approval notifications fetch failed
    }

    return notifications;
  }

  /**
   * Get all active notifications
   */
  async getActive(): Promise<Notification[]> {
    if (this.cachedNotifications.length === 0 && this.initialized) {
      await this.refresh();
    }
    return this.cachedNotifications;
  }

  /**
   * Get notification stats
   */
  async getStats(): Promise<NotificationStats> {
    return this.cachedStats;
  }

  /**
   * Get notification preferences
   */
  async getPreferences(type?: string): Promise<NotificationPreferences | NotificationPreferences[]> {
    // Return sensible defaults; preferences are stored in localStorage
    const allTypes = [
      'task_complete', 'task_deadline', 'agent_update', 'message_arrival',
      'approval_pending', 'calendar_event', 'system_alert', 'skill_learned', 'error'
    ];

    const stored = this.loadPreferences();

    if (type) {
      return stored[type] || {
        type,
        enabled: true,
        show_desktop: true,
        play_sound: false,
        min_priority: 'normal' as const,
      };
    }

    return allTypes.map(t => stored[t] || {
      type: t,
      enabled: true,
      show_desktop: true,
      play_sound: false,
      min_priority: 'normal' as const,
    });
  }

  private loadPreferences(): Record<string, NotificationPreferences> {
    try {
      const raw = localStorage.getItem('notif_preferences');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(type: string, prefs: Partial<NotificationPreferences>): Promise<void> {
    const all = this.loadPreferences();
    all[type] = { ...(all[type] || { type, enabled: true, show_desktop: true, play_sound: false, min_priority: 'normal' }), ...prefs } as NotificationPreferences;
    localStorage.setItem('notif_preferences', JSON.stringify(all));
  }

  /**
   * Mark notification as read
   */
  async markRead(id: string): Promise<void> {
    this.readIds.add(id);
    this.saveDismissedState();

    // Mark read via REST API if it's a tracked notification
    const _notif = this.cachedNotifications.find(n => n.id === id);
    // Best-effort — REST API doesn't have individual notification read endpoint yet

    this.cachedNotifications = this.cachedNotifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    this.recalcStats();
  }

  /**
   * Mark all as read
   */
  async markAllRead(): Promise<void> {
    for (const n of this.cachedNotifications) {
      this.readIds.add(n.id);
    }
    this.saveDismissedState();
    this.cachedNotifications = this.cachedNotifications.map(n => ({ ...n, read: true }));
    this.recalcStats();
  }

  /**
   * Dismiss notification
   */
  async dismiss(id: string): Promise<void> {
    this.dismissedIds.add(id);
    this.saveDismissedState();
    this.cachedNotifications = this.cachedNotifications.filter(n => n.id !== id);
    this.recalcStats();
  }

  private recalcStats() {
    const active = this.cachedNotifications;
    this.cachedStats = {
      total: active.length,
      unread: active.filter(n => !n.read).length,
      urgent: active.filter(n => n.priority === 'urgent').length,
      actionable: active.filter(n => n.actionable).length,
      last_notification_at: active[0]?.created_at,
    };
    this.statsListeners.forEach(l => l(this.cachedStats));
  }

  /**
   * Create a new notification (local only)
   */
  async create(data: Partial<Notification>): Promise<string> {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: Notification = {
      id,
      created_at: Date.now(),
      updated_at: Date.now(),
      type: 'system_alert',
      priority: 'normal',
      title: 'Notification',
      message: '',
      source: 'system',
      read: false,
      dismissed: false,
      actionable: false,
      desktop_shown: false,
      ...data,
    } as Notification;

    this.cachedNotifications.unshift(notification);
    this.listeners.forEach(l => l(notification));
    this.recalcStats();
    return id;
  }

  /**
   * Subscribe to new notifications
   */
  subscribe(callback: (notification: Notification) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Subscribe to stats updates
   */
  subscribeStats(callback: (stats: NotificationStats) => void): () => void {
    this.statsListeners.add(callback);
    return () => this.statsListeners.delete(callback);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.safetyInterval) {
      clearInterval(this.safetyInterval);
      this.safetyInterval = null;
    }
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
    this.listeners.clear();
    this.statsListeners.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const notificationService = new NotificationService();
