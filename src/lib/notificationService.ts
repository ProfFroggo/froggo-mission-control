/**
 * Notification Service
 * Manages system notifications, desktop notifications, and notification center
 */

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

class NotificationService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(notification: Notification) => void> = new Set();
  private statsListeners: Set<(stats: NotificationStats) => void> = new Set();
  private gatewayUrl: string;
  private permissionRequested = false;

  constructor() {
    // Use dedicated notification API server (port 3105)
    this.gatewayUrl = 'http://localhost:3105';
  }

  /**
   * Initialize the service and connect to notification stream
   */
  async init() {
    await this.requestNotificationPermission();
    this.connectWebSocket();
    this.startStatsPolling();
  }

  /**
   * Request desktop notification permission
   */
  private async requestNotificationPermission() {
    if (this.permissionRequested) return;
    this.permissionRequested = true;

    if (!('Notification' in window)) {
      console.warn('[NotificationService] Desktop notifications not supported');
      return;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('[NotificationService] Permission:', permission);
    }
  }

  /**
   * Connect to gateway WebSocket for real-time notifications
   */
  private connectWebSocket() {
    try {
      const wsUrl = this.gatewayUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      this.ws = new WebSocket(`${wsUrl}/notifications`);

      this.ws.onopen = () => {
        console.log('[NotificationService] WebSocket connected');
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          this.handleIncomingNotification(notification);
        } catch (e) {
          console.error('[NotificationService] Failed to parse notification:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[NotificationService] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[NotificationService] WebSocket closed, reconnecting...');
        this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (e) {
      console.error('[NotificationService] Failed to connect WebSocket:', e);
    }
  }

  /**
   * Handle incoming notification
   */
  private async handleIncomingNotification(notification: Notification) {
    console.log('[NotificationService] New notification:', notification);

    // Check preferences
    const prefs = await this.getPreferences(notification.type);
    if (!prefs?.enabled) return;

    // Check quiet hours
    if (this.isQuietHours(prefs)) {
      console.log('[NotificationService] Quiet hours active, suppressing notification');
      return;
    }

    // Check priority threshold
    const priorityLevels = { low: 0, normal: 1, high: 2, urgent: 3 };
    if (priorityLevels[notification.priority] < priorityLevels[prefs.min_priority]) {
      return;
    }

    // Show desktop notification
    if (prefs.show_desktop && !notification.desktop_shown) {
      this.showDesktopNotification(notification);
    }

    // Play sound
    if (prefs.play_sound) {
      this.playNotificationSound(notification);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(notification));
    this.updateStats();
  }

  /**
   * Show desktop notification
   */
  private async showDesktopNotification(notification: Notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const desktopNotif = new Notification(notification.title, {
        body: notification.message,
        icon: this.getNotificationIcon(notification.type),
        badge: '/froggo-badge.png',
        tag: notification.group_key || notification.id,
        requireInteraction: notification.priority === 'urgent',
        silent: false,
      });

      desktopNotif.onclick = () => {
        window.focus();
        if (notification.action_url) {
          // Navigate to action URL
          window.dispatchEvent(new CustomEvent('navigate', { detail: notification.action_url }));
        }
        desktopNotif.close();
      };

      // Mark as desktop shown
      await this.markDesktopShown(notification.id);
    } catch (e) {
      console.error('[NotificationService] Failed to show desktop notification:', e);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(notification: Notification) {
    try {
      const audio = new Audio(this.getSoundForType(notification.type));
      audio.volume = 0.5;
      audio.play().catch(e => console.error('[NotificationService] Failed to play sound:', e));
    } catch (e) {
      console.error('[NotificationService] Sound error:', e);
    }
  }

  /**
   * Get notification icon for type
   */
  private getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      task_complete: '/icons/check-circle.png',
      task_deadline: '/icons/clock.png',
      agent_update: '/icons/bot.png',
      message_arrival: '/icons/message.png',
      approval_pending: '/icons/alert.png',
      calendar_event: '/icons/calendar.png',
      system_alert: '/icons/warning.png',
      skill_learned: '/icons/star.png',
      error: '/icons/error.png',
    };
    return icons[type] || '/froggo-icon.png';
  }

  /**
   * Get sound file for type
   */
  private getSoundForType(type: string): string {
    const sounds: Record<string, string> = {
      task_complete: '/sounds/success.mp3',
      task_deadline: '/sounds/urgent.mp3',
      message_arrival: '/sounds/message.mp3',
      approval_pending: '/sounds/alert.mp3',
      calendar_event: '/sounds/reminder.mp3',
      system_alert: '/sounds/warning.mp3',
      error: '/sounds/error.mp3',
    };
    return sounds[type] || '/sounds/notification.mp3';
  }

  /**
   * Check if current time is in quiet hours
   */
  private isQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = prefs.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = prefs.quiet_hours_end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Handles overnight quiet hours (e.g., 22:00 - 08:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * Get all active notifications
   */
  async getActive(): Promise<Notification[]> {
    try {
      const response = await fetch(`${this.gatewayUrl}/api/notifications/active`);
      return await response.json();
    } catch (e) {
      console.error('[NotificationService] Failed to fetch active notifications:', e);
      return [];
    }
  }

  /**
   * Get notification stats
   */
  async getStats(): Promise<NotificationStats> {
    try {
      const response = await fetch(`${this.gatewayUrl}/api/notifications/stats`);
      return await response.json();
    } catch (e) {
      console.error('[NotificationService] Failed to fetch stats:', e);
      return { total: 0, unread: 0, urgent: 0, actionable: 0 };
    }
  }

  /**
   * Get notification preferences
   */
  async getPreferences(type?: string): Promise<NotificationPreferences | NotificationPreferences[]> {
    try {
      const url = type 
        ? `${this.gatewayUrl}/api/notifications/preferences/${type}`
        : `${this.gatewayUrl}/api/notifications/preferences`;
      const response = await fetch(url);
      return await response.json();
    } catch (e) {
      console.error('[NotificationService] Failed to fetch preferences:', e);
      return type ? {
        type,
        enabled: true,
        show_desktop: true,
        play_sound: false,
        min_priority: 'normal',
      } : [];
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(type: string, prefs: Partial<NotificationPreferences>): Promise<void> {
    try {
      await fetch(`${this.gatewayUrl}/api/notifications/preferences/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
    } catch (e) {
      console.error('[NotificationService] Failed to update preferences:', e);
    }
  }

  /**
   * Mark notification as read
   */
  async markRead(id: string): Promise<void> {
    try {
      await fetch(`${this.gatewayUrl}/api/notifications/${id}/read`, { method: 'POST' });
      this.updateStats();
    } catch (e) {
      console.error('[NotificationService] Failed to mark as read:', e);
    }
  }

  /**
   * Mark all as read
   */
  async markAllRead(): Promise<void> {
    try {
      await fetch(`${this.gatewayUrl}/api/notifications/read-all`, { method: 'POST' });
      this.updateStats();
    } catch (e) {
      console.error('[NotificationService] Failed to mark all as read:', e);
    }
  }

  /**
   * Dismiss notification
   */
  async dismiss(id: string): Promise<void> {
    try {
      await fetch(`${this.gatewayUrl}/api/notifications/${id}/dismiss`, { method: 'POST' });
      this.updateStats();
    } catch (e) {
      console.error('[NotificationService] Failed to dismiss:', e);
    }
  }

  /**
   * Mark as desktop shown (internal)
   */
  private async markDesktopShown(id: string): Promise<void> {
    try {
      await fetch(`${this.gatewayUrl}/api/notifications/${id}/desktop-shown`, { method: 'POST' });
    } catch (e) {
      console.error('[NotificationService] Failed to mark desktop shown:', e);
    }
  }

  /**
   * Create a new notification
   */
  async create(data: Partial<Notification>): Promise<string> {
    try {
      const response = await fetch(`${this.gatewayUrl}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      this.updateStats();
      return result.id;
    } catch (e) {
      console.error('[NotificationService] Failed to create notification:', e);
      throw e;
    }
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
   * Poll stats and notify listeners
   */
  private async updateStats() {
    try {
      const stats = await this.getStats();
      this.statsListeners.forEach(listener => listener(stats));
    } catch (e) {
      console.error('[NotificationService] Failed to update stats:', e);
    }
  }

  /**
   * Start polling stats
   */
  private startStatsPolling() {
    this.updateStats();
    setInterval(() => this.updateStats(), 30000); // Every 30 seconds
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.listeners.clear();
    this.statsListeners.clear();
  }
}

// Singleton instance
export const notificationService = new NotificationService();
