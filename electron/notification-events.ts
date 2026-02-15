/**
 * Notification Event System
 * Watches for important dashboard events and triggers native OS notifications
 */

import { BrowserWindow } from 'electron';
import * as path from 'path';
import { notificationService } from './notification-service';
import { prepare } from './database';
import { OPENCLAW_DIR } from './paths';

const safeLog = {
  log: (...args: any[]) => {
    try {
      if (process.stdout.writable) {
        console.debug(...args);
      }
    } catch { /* ignore */ }
  },
  error: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.error(...args);
      }
    } catch { /* ignore */ }
  },
};
const SESSION_DIR = path.join(OPENCLAW_DIR, 'sessions');

interface EventWatcher {
  start: () => void;
  stop: () => void;
}

// Track what we've already notified about to avoid duplicates
const notifiedItems = new Set<string>();

/**
 * Watch task_activity table for completions and failures
 */
function createTaskActivityWatcher(mainWindow: BrowserWindow): EventWatcher {
  let lastCheck = Date.now();
  let interval: NodeJS.Timeout | null = null;

  const check = () => {
    try {
      const activities = prepare(`
        SELECT
          a.id,
          a.task_id,
          a.action,
          a.message,
          a.details,
          a.agent_id,
          a.timestamp,
          t.title as task_title
        FROM task_activity a
        JOIN tasks t ON a.task_id = t.id
        WHERE a.timestamp > ?
        ORDER BY a.timestamp ASC
      `).all(lastCheck);

      lastCheck = Date.now();

      for (const activity of activities) {
        const notifKey = `activity-${(activity as any).id}`;
        if (notifiedItems.has(notifKey)) continue;
        notifiedItems.add(notifKey);

        // Task completed
        if ((activity as any).action === 'completed' || (activity as any).action === 'task_completed') {
          const taskTitle = (activity as any).task_title || (activity as any).message || 'Unknown task';
          safeLog.log('[NotifEvents] Task completed:', taskTitle);
          notificationService.taskCompleted(taskTitle, (activity as any).task_id);
        }

        // Agent blocked/failed
        if ((activity as any).action === 'blocked' || (activity as any).action === 'failed') {
          const agentName = (activity as any).agent_id || 'Agent';
          const taskTitle = (activity as any).task_title || 'Unknown task';
          const reason = (activity as any).message || (activity as any).details || 'Unknown reason';
          safeLog.log('[NotifEvents] Agent failure:', agentName, taskTitle);
          notificationService.agentFailed(agentName, taskTitle, reason, (activity as any).task_id);
        }
      }
    } catch (error: any) {
      safeLog.error('[NotifEvents] Task activity query error:', error.message);
    }
  };

  return {
    start: () => {
      safeLog.log('[NotifEvents] Starting task activity watcher');
      check(); // Initial check
      interval = setInterval(check, 10000); // Check every 10s
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}

/**
 * Watch for new messages in active sessions (chat mentions)
 */
function createMessageWatcher(mainWindow: BrowserWindow): EventWatcher {
  let interval: NodeJS.Timeout | null = null;
  let lastMessageCheck = Date.now();

  const checkNewMessages = () => {
    try {
      // Query recent messages from the database
      const messages = prepare(`
        SELECT
          m.id,
          m.session_key,
          m.content,
          m.sender_name,
          m.timestamp,
          s.name as session_name
        FROM messages m
        LEFT JOIN conversations s ON m.session_key = s.session_key
        WHERE m.timestamp > ?
          AND m.sender_name != 'Froggo'
          AND m.sender_name != 'Assistant'
          AND (m.content LIKE '%@froggo%' OR m.content LIKE '%froggo%' OR m.content LIKE '%@kevin%' OR m.content LIKE '%kevin%')
        ORDER BY m.timestamp ASC
        LIMIT 10
      `).all(lastMessageCheck);

      lastMessageCheck = Date.now();

      for (const msg of messages) {
        const notifKey = `message-${(msg as any).id}`;
        if (notifiedItems.has(notifKey)) continue;
        notifiedItems.add(notifKey);

        const from = (msg as any).sender_name || 'Someone';
        const preview = ((msg as any).content || '').slice(0, 100);
        const sessionName = (msg as any).session_name || 'Chat';

        safeLog.log('[NotifEvents] New mention from', from);
        notificationService.chatMention(
          `${from} (${sessionName})`,
          preview,
          (msg as any).session_key
        );
      }
    } catch (error: any) {
      // Messages table might not exist in all setups, that's ok
    }
  };

  return {
    start: () => {
      safeLog.log('[NotifEvents] Starting message watcher');
      checkNewMessages();
      interval = setInterval(checkNewMessages, 15000); // Check every 15s
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}

/**
 * Watch for tasks moving to 'review' status
 */
function createReviewWatcher(mainWindow: BrowserWindow): EventWatcher {
  let lastCheck = Date.now();
  let interval: NodeJS.Timeout | null = null;

  const check = () => {
    try {
      const tasks = prepare(`
        SELECT
          id,
          title,
          updated_at
        FROM tasks
        WHERE status = 'review'
          AND updated_at > ?
        ORDER BY updated_at ASC
      `).all(lastCheck);

      lastCheck = Date.now();

      for (const task of tasks) {
        const notifKey = `review-${(task as any).id}`;
        if (notifiedItems.has(notifKey)) continue;
        notifiedItems.add(notifKey);

        safeLog.log('[NotifEvents] Task ready for review:', (task as any).title);
        notificationService.approvalNeeded(
          `Review: ${(task as any).title}`,
          (task as any).id
        );
      }
    } catch (error: any) {
      // Ignore - table might not exist
    }
  };

  return {
    start: () => {
      safeLog.log('[NotifEvents] Starting review watcher');
      check();
      interval = setInterval(check, 20000); // Check every 20s
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
  };
}

/**
 * Setup all notification event watchers
 */
export function setupNotificationEvents(mainWindow: BrowserWindow) {
  const watchers: EventWatcher[] = [
    createTaskActivityWatcher(mainWindow),
    createMessageWatcher(mainWindow),
    createReviewWatcher(mainWindow),
  ];

  // Start all watchers
  watchers.forEach(w => w.start());

  safeLog.log('[NotifEvents] All notification event watchers started');

  // Return cleanup function
  return () => {
    safeLog.log('[NotifEvents] Stopping all notification event watchers');
    watchers.forEach(w => w.stop());
  };
}

// Cleanup old notified items (prevent memory leak)
setInterval(() => {
  if (notifiedItems.size > 1000) {
    safeLog.log('[NotifEvents] Cleaning up notified items cache');
    const items = Array.from(notifiedItems);
    notifiedItems.clear();
    // Keep last 500
    items.slice(-500).forEach(id => notifiedItems.add(id));
  }
}, 300000); // Every 5 minutes
