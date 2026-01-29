/**
 * Notification Event System
 * Watches for important dashboard events and triggers native OS notifications
 */

import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { notificationService } from './notification-service';

const safeLog = {
  log: (...args: any[]) => {
    try {
      if (process.stdout.writable) {
        console.log(...args);
      }
    } catch {}
  },
  error: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.error(...args);
      }
    } catch {}
  },
};

const DB_PATH = path.join(os.homedir(), 'Froggo', 'clawd', 'data', 'froggo.db');
const SESSION_DIR = path.join(os.homedir(), '.clawdbot', 'sessions');
const APPROVAL_QUEUE_PATH = path.join(os.homedir(), 'clawd', 'approvals', 'queue.json');

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
    const query = `
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
      WHERE a.timestamp > ${lastCheck}
      ORDER BY a.timestamp ASC
    `;

    exec(`sqlite3 "${DB_PATH}" "${query}" -json`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[NotifEvents] Task activity query error:', error.message);
        return;
      }

      try {
        const activities = JSON.parse(stdout || '[]');
        lastCheck = Date.now();

        for (const activity of activities) {
          const notifKey = `activity-${activity.id}`;
          if (notifiedItems.has(notifKey)) continue;
          notifiedItems.add(notifKey);

          // Task completed
          if (activity.action === 'completed' || activity.action === 'task_completed') {
            const taskTitle = activity.task_title || activity.message || 'Unknown task';
            safeLog.log('[NotifEvents] Task completed:', taskTitle);
            notificationService.taskCompleted(taskTitle, activity.task_id);
          }

          // Agent blocked/failed
          if (activity.action === 'blocked' || activity.action === 'failed') {
            const agentName = activity.agent_id || 'Agent';
            const taskTitle = activity.task_title || 'Unknown task';
            const reason = activity.message || activity.details || 'Unknown reason';
            safeLog.log('[NotifEvents] Agent failure:', agentName, taskTitle);
            notificationService.agentFailed(agentName, taskTitle, reason, activity.task_id);
          }
        }
      } catch (e) {
        safeLog.error('[NotifEvents] Parse error:', e);
      }
    });
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
 * Watch approval queue for new items
 */
function createApprovalWatcher(mainWindow: BrowserWindow): EventWatcher {
  let lastApprovalIds = new Set<string>();
  let watcher: fs.FSWatcher | null = null;

  // Load initial state
  const loadInitialState = () => {
    try {
      if (fs.existsSync(APPROVAL_QUEUE_PATH)) {
        const data = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
        lastApprovalIds = new Set((data.items || []).map((i: any) => i.id as string));
        safeLog.log('[NotifEvents] Loaded', lastApprovalIds.size, 'existing approvals');
      }
    } catch (e) {
      safeLog.error('[NotifEvents] Failed to load approval queue:', e);
    }
  };

  const checkNewApprovals = () => {
    try {
      if (!fs.existsSync(APPROVAL_QUEUE_PATH)) return;

      const data = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
      const items = data.items || [];

      for (const item of items) {
        if (!lastApprovalIds.has(item.id)) {
          const notifKey = `approval-${item.id}`;
          if (notifiedItems.has(notifKey)) continue;
          notifiedItems.add(notifKey);

          safeLog.log('[NotifEvents] New approval needed:', item.title);
          notificationService.approvalNeeded(
            item.title || 'New approval request',
            item.id
          );
        }
      }

      lastApprovalIds = new Set(items.map((i: any) => i.id));
    } catch (e) {
      safeLog.error('[NotifEvents] Failed to check approvals:', e);
    }
  };

  return {
    start: () => {
      safeLog.log('[NotifEvents] Starting approval watcher');
      loadInitialState();

      const dir = path.dirname(APPROVAL_QUEUE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      watcher = fs.watch(dir, (eventType, filename) => {
        if (filename === 'queue.json') {
          checkNewApprovals();
        }
      });
    },
    stop: () => {
      if (watcher) {
        watcher.close();
        watcher = null;
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
    // Query recent messages from the database
    const query = `
      SELECT 
        m.id,
        m.session_key,
        m.content,
        m.sender_name,
        m.timestamp,
        s.name as session_name
      FROM messages m
      LEFT JOIN conversations s ON m.session_key = s.session_key
      WHERE m.timestamp > ${lastMessageCheck}
        AND m.sender_name != 'Froggo'
        AND m.sender_name != 'Assistant'
        AND (m.content LIKE '%@froggo%' OR m.content LIKE '%froggo%' OR m.content LIKE '%@kevin%' OR m.content LIKE '%kevin%')
      ORDER BY m.timestamp ASC
      LIMIT 10
    `;

    exec(`sqlite3 "${DB_PATH}" "${query}" -json`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        // Messages table might not exist in all setups, that's ok
        return;
      }

      try {
        const messages = JSON.parse(stdout || '[]');
        lastMessageCheck = Date.now();

        for (const msg of messages) {
          const notifKey = `message-${msg.id}`;
          if (notifiedItems.has(notifKey)) continue;
          notifiedItems.add(notifKey);

          const from = msg.sender_name || 'Someone';
          const preview = (msg.content || '').slice(0, 100);
          const sessionName = msg.session_name || 'Chat';

          safeLog.log('[NotifEvents] New mention from', from);
          notificationService.chatMention(
            `${from} (${sessionName})`,
            preview,
            msg.session_key
          );
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
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
    const query = `
      SELECT 
        id,
        title,
        updated_at
      FROM tasks
      WHERE status = 'review'
        AND updated_at > ${lastCheck}
      ORDER BY updated_at ASC
    `;

    exec(`sqlite3 "${DB_PATH}" "${query}" -json`, { timeout: 5000 }, (error, stdout) => {
      if (error) return;

      try {
        const tasks = JSON.parse(stdout || '[]');
        lastCheck = Date.now();

        for (const task of tasks) {
          const notifKey = `review-${task.id}`;
          if (notifiedItems.has(notifKey)) continue;
          notifiedItems.add(notifKey);

          safeLog.log('[NotifEvents] Task ready for review:', task.title);
          notificationService.approvalNeeded(
            `Review: ${task.title}`,
            task.id
          );
        }
      } catch (e) {
        // Ignore
      }
    });
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
    createApprovalWatcher(mainWindow),
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
