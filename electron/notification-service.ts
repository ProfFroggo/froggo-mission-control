import { Notification, app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('Notification');

// Safe logger (legacy - being migrated)
const safeLog = {
  log: (...args: unknown[]) => {
    try {
      if (process.stdout.writable) {
        logger.debug(args.map(a => String(a)).join(' '));
      }
    } catch { /* ignore */ }
  },
  error: (...args: unknown[]) => {
    try {
      if (process.stderr.writable) {
        logger.error(args.map(a => String(a)).join(' '));
      }
    } catch { /* ignore */ }
  },
  warn: (...args: unknown[]) => {
    try {
      if (process.stderr.writable) {
        logger.warn(args.map(a => String(a)).join(' '));
      }
    } catch { /* ignore */ }
  },
  debug: (...args: unknown[]) => {
    try {
      if (process.stdout.writable) {
        logger.debug(args.map(a => String(a)).join(' '));
      }
    } catch { /* ignore */ }
  },
};

export interface NotificationPreferences {
  enabled: boolean;
  taskCompletions: boolean;
  agentFailures: boolean;
  approvalRequests: boolean;
  chatMentions: boolean;
  sound: boolean;
  showPreviews: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  taskCompletions: true,
  agentFailures: true,
  approvalRequests: true,
  chatMentions: true,
  sound: true,
  showPreviews: true,
};

class NotificationService {
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;
  private prefsPath: string;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.prefsPath = path.join(os.homedir(), 'froggo', 'data', 'notification-prefs.json');
    this.loadPreferences();
  }

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  private loadPreferences() {
    try {
      if (fs.existsSync(this.prefsPath)) {
        const data = JSON.parse(fs.readFileSync(this.prefsPath, 'utf-8'));
        this.preferences = { ...DEFAULT_PREFERENCES, ...data };
        safeLog.log('[Notifications] Loaded preferences:', this.preferences);
      }
    } catch (error) {
      safeLog.error('[Notifications] Failed to load preferences:', error);
    }
  }

  private savePreferences() {
    try {
      const dir = path.dirname(this.prefsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.prefsPath, JSON.stringify(this.preferences, null, 2));
      safeLog.log('[Notifications] Saved preferences');
    } catch (error) {
      safeLog.error('[Notifications] Failed to save preferences:', error);
    }
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
    
    // Notify renderer of preference changes
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('notification-prefs-updated', this.preferences);
    }
  }

  /**
   * Show a native OS notification
   */
  async show(options: {
    type: 'task-completed' | 'agent-failure' | 'approval-request' | 'chat-mention' | 'info';
    title: string;
    body: string;
    silent?: boolean;
    urgency?: 'low' | 'normal' | 'critical';
    actions?: { type: string; text: string }[];
    data?: Record<string, unknown>;
  }) {
    // Check if notifications are enabled globally
    if (!this.preferences.enabled) {
      safeLog.log('[Notifications] Skipped (disabled globally):', options.title);
      return;
    }

    // Check type-specific preferences
    const typeEnabled = {
      'task-completed': this.preferences.taskCompletions,
      'agent-failure': this.preferences.agentFailures,
      'approval-request': this.preferences.approvalRequests,
      'chat-mention': this.preferences.chatMentions,
      'info': true,
    }[options.type];

    if (!typeEnabled) {
      safeLog.log(`[Notifications] Skipped (${options.type} disabled):`, options.title);
      return;
    }

    // Show preview if enabled, otherwise use generic message
    const body = this.preferences.showPreviews 
      ? options.body 
      : 'You have a new notification';

    try {
      const notification = new Notification({
        title: options.title,
        body,
        silent: options.silent || !this.preferences.sound,
        urgency: options.urgency || 'normal',
        icon: this.getIconForType(options.type),
        subtitle: this.getSubtitleForType(options.type),
      });

      // Handle click - focus window and navigate to relevant view
      notification.on('click', () => {
        this.handleNotificationClick(options.type, options.data);
      });

      // Handle action buttons (macOS)
      if (options.actions && process.platform === 'darwin') {
        notification.on('action', (event, index) => {
          const action = options.actions![index];
          this.handleNotificationAction(action.type, options.data);
        });
      }

      notification.show();
      safeLog.log('[Notifications] Shown:', options.title);

      // Also send to renderer for in-app notifications panel
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('notification-received', {
          type: options.type,
          title: options.title,
          body: options.body,
          timestamp: Date.now(),
          data: options.data,
        });
      }
    } catch (error) {
      safeLog.error('[Notifications] Failed to show:', error);
    }
  }

  private getIconForType(type: string): string | undefined {
    // On macOS, app icon is used automatically
    if (process.platform === 'darwin') {
      return undefined;
    }

    // For other platforms, could return custom icon paths
    const iconMap: Record<string, string> = {
      'task-completed': '✅',
      'agent-failure': '❌',
      'approval-request': '🔔',
      'chat-mention': '💬',
      'info': 'ℹ️',
    };

    return iconMap[type];
  }

  private getSubtitleForType(type: string): string | undefined {
    const subtitleMap: Record<string, string> = {
      'task-completed': 'Task Completed',
      'task-assigned': 'Task Assigned',
      'agent-failure': 'Agent Alert',
      'approval-request': 'Approval Needed',
      'chat-mention': 'New Mention',
      'info': 'Froggo Dashboard',
    };

    return subtitleMap[type];
  }

  private handleNotificationClick(type: string, data?: Record<string, unknown>) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    // Focus the window
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.focus();

    // Navigate to relevant view
    const viewMap: Record<string, string> = {
      'task-completed': 'tasks',
      'task-assigned': 'tasks',
      'agent-failure': 'agents',
      'approval-request': 'inbox',
      'chat-mention': 'chat',
    };

    const view = viewMap[type];
    if (view) {
      this.mainWindow.webContents.send('navigate-to-view', view, data);
    }
  }

  private handleNotificationAction(actionType: string, data?: Record<string, unknown>) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    // Send action to renderer
    this.mainWindow.webContents.send('notification-action', { actionType, data });
  }

  /**
   * Convenience methods for common notification types
   */

  taskCompleted(taskTitle: string, taskId: string) {
    this.show({
      type: 'task-completed',
      title: '✅ Task Completed',
      body: taskTitle,
      urgency: 'normal',
      data: { taskId },
    });
  }

  agentFailed(agentName: string, taskTitle: string, reason: string, taskId?: string) {
    this.show({
      type: 'agent-failure',
      title: `⚠️ ${agentName} Blocked`,
      body: `${taskTitle}\n${reason}`,
      urgency: 'critical',
      data: { taskId, agentName, reason },
    });
  }

  approvalNeeded(itemTitle: string, itemId: string) {
    this.show({
      type: 'approval-request',
      title: '🔔 Approval Needed',
      body: itemTitle,
      urgency: 'normal',
      actions: [
        { type: 'approve', text: 'Approve' },
        { type: 'dismiss', text: 'Dismiss' },
      ],
      data: { itemId },
    });
  }

  chatMention(from: string, preview: string, sessionId?: string) {
    this.show({
      type: 'chat-mention',
      title: `💬 ${from} mentioned you`,
      body: preview,
      urgency: 'normal',
      data: { from, sessionId },
    });
  }

  info(title: string, body: string, data?: Record<string, unknown>) {
    this.show({
      type: 'info',
      title,
      body,
      urgency: 'low',
      data,
    });
  }
}

// Singleton instance
export const notificationService = new NotificationService();

// Setup IPC handlers
export function setupNotificationHandlers(mainWindow: BrowserWindow) {
  notificationService.setMainWindow(mainWindow);

  // Get preferences
  ipcMain.handle('notifications:get-prefs', async () => {
    return notificationService.getPreferences();
  });

  // Update preferences
  ipcMain.handle('notifications:update-prefs', async (_, updates: Partial<NotificationPreferences>) => {
    notificationService.updatePreferences(updates);
    return { success: true };
  });

  // Send notification
  ipcMain.handle('notifications:send', async (_, options: {
    type: 'task-completed' | 'agent-failure' | 'approval-request' | 'chat-mention' | 'info';
    title: string;
    body: string;
    silent?: boolean;
    urgency?: 'low' | 'normal' | 'critical';
    actions?: { type: string; text: string }[];
    data?: Record<string, unknown>;
  }) => {
    await notificationService.show(options);
    return { success: true };
  });

  // Test notification
  ipcMain.handle('notifications:test', async () => {
    notificationService.info(
      'Test Notification',
      'Native notifications are working! 🎉'
    );
    return { success: true };
  });
}
