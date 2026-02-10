/**
 * Notification Service
 * Fetches real notifications from froggo-db (comms cache, tasks, read states)
 * via the Electron bridge (window.clawdbot)
 */

import { gateway } from './gateway';

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
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
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

    // Subscribe to gateway events for real-time updates (replaces 30s polling)
    gateway.on('task.created', () => this.handleTaskEvent());
    gateway.on('task.updated', () => this.handleTaskEvent());
    gateway.on('approval.request', () => this.handleApprovalEvent());
    gateway.on('chat.message', () => this.handleMessageEvent());
    gateway.on('tasks.refresh', () => this.handleTaskEvent());

    // Full refresh on gateway reconnect to catch missed events
    gateway.on('stateChange', ({ state, oldState }: { state: string; oldState: string }) => {
      if (state === 'connected' && oldState !== 'connected') {
        console.log('[NotificationService] Gateway reconnected, refreshing all');
        this.refresh();
      }
    });

    // Safety net: slow background refresh in case gateway events are missed
    // This is 10x slower than the old polling (5min vs 30s) — events are the primary path
    this.safetyInterval = setInterval(() => {
      console.log('[NotificationService] Safety net refresh');
      this.refresh();
    }, 300000); // 5 minutes

    // Also listen for Electron notification events if available
    if (window.clawdbot?.notifications?.onReceived) {
      window.clawdbot.notifications.onReceived((notif: any) => {
        const mapped = this.mapElectronNotification(notif);
        if (mapped && !this.dismissedIds.has(mapped.id)) {
          this.listeners.forEach(l => l(mapped));
          this.refresh();
        }
      });
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
      console.error('[NotificationService] Refresh failed:', e);
    }
  }

  /**
   * Event handler for task events (created, updated, refresh)
   * Debounced to handle rapid-fire events
   */
  private handleTaskEvent() {
    clearTimeout(this.refreshTimer!);
    this.refreshTimer = setTimeout(() => this.refreshTasks(), 300);
  }

  /**
   * Event handler for approval events
   * Debounced to handle rapid-fire events
   */
  private handleApprovalEvent() {
    clearTimeout(this.refreshTimer!);
    this.refreshTimer = setTimeout(() => this.refreshApprovals(), 300);
  }

  /**
   * Event handler for message events
   * Debounced to handle rapid-fire events
   */
  private handleMessageEvent() {
    clearTimeout(this.refreshTimer!);
    this.refreshTimer = setTimeout(() => this.refreshMessages(), 300);
  }

  /**
   * Targeted refresh for task notifications only
   */
  private async refreshTasks() {
    try {
      const taskNotifs = await this.fetchTaskNotifications();
      this.mergeNotifications('task', taskNotifs);
    } catch (e) {
      console.error('[NotificationService] Task refresh failed:', e);
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
      console.error('[NotificationService] Approval refresh failed:', e);
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
      console.error('[NotificationService] Message refresh failed:', e);
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
   * Fetch unread messages from comms_cache via froggo-db
   */
  private async fetchUnreadMessages(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    try {
      // Try froggo.query for direct DB access
      if (window.clawdbot?.froggo?.query) {
        const result = await window.clawdbot.froggo.query(
          `SELECT id, platform, external_id, sender, sender_name, preview, timestamp, is_urgent, is_read, metadata
           FROM comms_cache
           WHERE is_read = 0
           ORDER BY timestamp DESC
           LIMIT 50`
        );
        if (result.success && result.rows) {
          for (const row of result.rows) {
            const ts = new Date(row.timestamp).getTime();
            const platform = row.platform || 'unknown';
            const senderDisplay = row.sender_name || row.sender || 'Unknown';
            const platformLabel = platformLabels[platform] || platform;

            notifications.push({
              id: `msg-${platform}-${row.id}`,
              created_at: ts,
              updated_at: ts,
              type: 'message_arrival',
              priority: row.is_urgent ? 'high' : 'normal',
              title: `${senderDisplay}`,
              message: row.preview || '(no preview)',
              description: undefined,
              source: 'message',
              source_id: row.external_id,
              channel: platformLabel,
              read: false,
              dismissed: false,
              actionable: false,
              action_url: undefined,
              desktop_shown: false,
              data: { platform, sender: row.sender, metadata: row.metadata },
              group_key: `msg-${platform}-${row.external_id}`,
            });
          }
        }
      } else if (window.clawdbot?.messages?.recent) {
        // Fallback: use messages.recent()
        const result = await window.clawdbot.messages.recent(30);
        if (result.success && result.chats) {
          for (const chat of result.chats) {
            const ts = chat.timestamp ? new Date(chat.timestamp).getTime() : Date.now();
            notifications.push({
              id: `msg-wa-${chat.id || ts}`,
              created_at: ts,
              updated_at: ts,
              type: 'message_arrival',
              priority: 'normal',
              title: chat.name || chat.sender || 'WhatsApp',
              message: chat.preview || chat.lastMessage || '(no preview)',
              source: 'message',
              source_id: chat.id,
              channel: 'WhatsApp',
              read: false,
              dismissed: false,
              actionable: false,
              desktop_shown: false,
            });
          }
        }
      }
    } catch (e) {
      console.error('[NotificationService] Failed to fetch messages:', e);
    }

    return notifications;
  }

  /**
   * Fetch task-related notifications from froggo-db
   */
  private async fetchTaskNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    try {
      if (!window.clawdbot?.froggo?.query) return notifications;

      // Recent task activity (completions, agent updates, etc.)
      const result = await window.clawdbot.froggo.query(
        `SELECT ta.id, ta.task_id, ta.action, ta.message, ta.agent_id, ta.timestamp, t.title as task_title, t.status
         FROM task_activity ta
         LEFT JOIN tasks t ON t.id = ta.task_id
         WHERE ta.timestamp > ?
         ORDER BY ta.timestamp DESC
         LIMIT 30`,
        [Date.now() - 86400000 * 2] // Last 2 days
      );

      if (result.success && result.rows) {
        for (const row of result.rows) {
          const ts = typeof row.timestamp === 'number' ? row.timestamp : new Date(row.timestamp).getTime();
          let type: Notification['type'] = 'agent_update';
          let priority: Notification['priority'] = 'normal';

          if (row.action === 'completed' || row.status === 'done') {
            type = 'task_complete';
          } else if (row.action === 'error' || row.action === 'failed') {
            type = 'error';
            priority = 'high';
          } else if (row.action === 'review' || row.action === 'approval') {
            type = 'approval_pending';
            priority = 'high';
          }

          notifications.push({
            id: `task-act-${row.id}`,
            created_at: ts,
            updated_at: ts,
            type,
            priority,
            title: row.task_title || `Task ${row.task_id}`,
            message: row.message || `${row.action} by ${row.agent_id || 'system'}`,
            source: row.agent_id ? 'agent' : 'task',
            source_id: row.task_id,
            channel: row.agent_id || undefined,
            read: false,
            dismissed: false,
            actionable: type === 'approval_pending',
            action_url: type === 'approval_pending' ? `kanban?task=${row.task_id}` : undefined,
            desktop_shown: false,
            data: { taskId: row.task_id, action: row.action, agent: row.agent_id },
          });
        }
      }
    } catch (e) {
      console.error('[NotificationService] Failed to fetch task notifications:', e);
    }

    return notifications;
  }

  /**
   * Fetch approval notifications from froggo.db inbox
   */
  private async fetchApprovalNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    try {
      if (!window.clawdbot?.inbox?.list) return notifications;

      const result = await window.clawdbot.inbox.list();
      if (result?.items) {
        for (const item of result.items) {
          // Only include pending items
          if (item.status !== 'pending') continue;

          const ts = item.created_at ? new Date(item.created_at).getTime() : Date.now();
          notifications.push({
            id: `approval-${item.id || ts}`,
            created_at: ts,
            updated_at: ts,
            type: 'approval_pending',
            priority: 'high',
            title: item.title || 'Approval Required',
            message: item.content || 'Pending your review',
            source: 'inbox',
            source_id: item.id,
            channel: item.channel || undefined,
            read: false,
            dismissed: false,
            actionable: true,
            action_url: 'approvals',
            desktop_shown: false,
            data: item,
          });
        }
      }
    } catch (e) {
      console.error('[NotificationService] Failed to fetch approvals:', e);
    }

    return notifications;
  }

  /**
   * Map Electron notification event to our format
   */
  private mapElectronNotification(notif: any): Notification | null {
    if (!notif) return null;
    const ts = notif.timestamp ? new Date(notif.timestamp).getTime() : Date.now();
    return {
      id: `electron-${notif.id || ts}`,
      created_at: ts,
      updated_at: ts,
      type: notif.type || 'system_alert',
      priority: notif.priority || 'normal',
      title: notif.title || 'System Notification',
      message: notif.body || notif.message || '',
      source: 'system',
      read: false,
      dismissed: false,
      actionable: false,
      desktop_shown: false,
    };
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

    // If it's a message notification, also mark read in DB
    const notif = this.cachedNotifications.find(n => n.id === id);
    if (notif?.data?.platform && window.clawdbot?.froggo?.query) {
      const dbId = id.replace(/^msg-\w+-/, '');
      try {
        await window.clawdbot.froggo.query(
          'UPDATE comms_cache SET is_read = 1 WHERE id = ?',
          [parseInt(dbId) || 0]
        );
      } catch { /* best effort */ }
    }

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
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
    this.statsListeners.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const notificationService = new NotificationService();
