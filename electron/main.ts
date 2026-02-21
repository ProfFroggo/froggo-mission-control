import { app, BrowserWindow, shell, dialog, screen, ipcMain, systemPreferences, desktopCapturer } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import * as path from 'path';
import { exec, execFile, execSync } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import { getSecret, storeSecret, hasSecret, deleteSecret } from './secret-store';
import { validateFsPath } from './fs-validation';
import { accountsServiceV2 } from './accounts-service-v2';
import { accountsService } from './accounts-service';
import { calendarService } from './calendar-service';
import { exportTasks as expTasks, exportAgentLogs as expAgentLogs, exportChatHistory as expChatHistory, createBackup as expCreateBackup, restoreBackup as expRestoreBackup, listBackups as expListBackups, getStats as expGetStats, cleanupOldBackups as expCleanupOldBackups, importTasks as expImportTasks } from './export-backup-service';

const exportBackupService = {
  exportTasks: expTasks,
  exportAgentLogs: expAgentLogs,
  exportChatHistory: expChatHistory,
  createBackup: expCreateBackup,
  restoreBackup: expRestoreBackup,
  listBackups: expListBackups,
  getStats: expGetStats,
  cleanupOldBackups: expCleanupOldBackups,
  importTasks: expImportTasks,
};
import { secureExec, getAuditLog, validateCommand } from './shell-security';
// crypto imported but unused - removed during bug-hunt cleanup
import { setupNotificationHandlers } from './notification-service';
import { setupNotificationEvents } from './notification-events';
import { registerXAutomationsHandlers } from './x-automations-service';
import { registerWritingProjectHandlers } from './writing-project-service';
import { registerWritingFeedbackHandlers } from './writing-feedback-service';
import { registerWritingMemoryHandlers } from './writing-memory-service';
import { registerWritingResearchHandlers, closeAllResearchDbs } from './writing-research-service';
import { registerWritingVersionHandlers } from './writing-version-service';
import { registerWritingChatHandlers } from './writing-chat-service';
import { registerWritingWizardHandlers } from './writing-wizard-service';
import { initializeDashboardAgents, shutdownDashboardAgents, getDashboardAgentsStatus } from './dashboard-agents';
import { getFinanceAgentBridge, initializeFinanceAgentBridge } from './finance-agent-bridge';
import { registerFinanceHandlers } from './finance-service';
import { initXApiTokens, postTweet as xPostTweet, getMentions as xGetMentions, getHomeTimeline as xGetHomeTimeline, searchRecent as xSearchRecent, getUserProfile as xGetUserProfile, getThread as xGetThread, followUser as xFollowUser, sendDM as xSendDM, deleteTweet as xDeleteTweet, likeTweet as xLikeTweet, unlikeTweet as xUnlikeTweet, retweet as xRetweet, unretweet as xUnretweet, unfollowUser as xUnfollowUser, getFollowers as xGetFollowers, getFollowing as xGetFollowing } from './x-api-client';
import { registerXPublishingHandlers } from './x-publishing-service';
import { registerXAnalyticsHandlers } from './x-analytics-service';
import { registerAgentManagementHandlers } from './agent-management-service';
import { registerMemoryLifecycleHandlers } from './memory-lifecycle-service';
import { registerSearchHandlers } from './search-service';
import { registerKnowledgeHandlers } from './knowledge-service';
import { registerXTwitterHandlers } from './handlers/x-twitter-handlers';
import { registerTaskHandlers } from './handlers/task-handlers';
import { registerCommsHandlers, startCommsPolling, startEmailAutoCheck } from './handlers/comms-handlers';
import { registerCalendarHandlers } from './handlers/calendar-handlers';
import { registerScheduleHandlers } from './handlers/schedule-handlers';

// xApi namespace wrapper for backwards compatibility
const xApi = {
  postTweet: xPostTweet,
  getMentions: xGetMentions,
  getHomeTimeline: xGetHomeTimeline,
  searchRecent: xSearchRecent,
  getUserProfile: xGetUserProfile,
  getThread: xGetThread,
  followUser: xFollowUser,
  sendDM: xSendDM,
  deleteTweet: xDeleteTweet,
  likeTweet: xLikeTweet,
  unlikeTweet: xUnlikeTweet,
  retweet: xRetweet,
  unretweet: xUnretweet,
  unfollowUser: xUnfollowUser,
  getFollowers: xGetFollowers,
  getFollowing: xGetFollowing,
};
import { prepare, closeDb, db, getSessionsDb, getSecurityDb } from './database';
import {
  PROJECT_ROOT, DATA_DIR, SCRIPTS_DIR, TOOLS_DIR, LIBRARY_DIR, UPLOADS_DIR,
  REPORTS_DIR, FROGGO_DB, OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY,
  FROGGO_DB_CLI, TGCLI, DISCORDCLI, CLAUDE_CLI, SHELL_PATH, agentWorkspace,
} from './paths';

// ============== AGENT REGISTRY ==============
interface AgentRegistryEntry {
  role: string;
  description: string;
  capabilities: string[];
  prompt: string;
  aliases: string[];
  clawdAgentId: string;
}

function loadAgentRegistry(): Record<string, AgentRegistryEntry> {
  const registryPath = path.join(__dirname, 'agent-registry.json');
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    return data.agents || {};
  } catch (err) {
    safeLog.error('Failed to load agent registry, using empty:', err);
    return {};
  }
}

function getAgentRegistry(): Record<string, AgentRegistryEntry> {
  // Cache with 60s TTL so file changes are picked up without restart
  const now = Date.now();
  if (!(global as any)._agentRegistryCache || now - ((global as any)._agentRegistryCacheTime || 0) > 60000) {
    (global as any)._agentRegistryCache = loadAgentRegistry();
    (global as any)._agentRegistryCacheTime = now;
  }
  return (global as any)._agentRegistryCache;
}

// ============== DEFAULT EMAIL ACCOUNT ==============
/**
 * Get first authenticated Google email from gog CLI.
 * Returns empty string if no account is available (no hardcoded fallback).
 */
function getDefaultGogEmail(): string {
  try {
    const gogList = execSync('/opt/homebrew/bin/gog auth list --json', {
      timeout: 5000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` },
    }).toString();
    const gogData = JSON.parse(gogList);
    const accounts = (gogData.accounts || []).filter((a: any) => a.services?.includes('gmail'));
    return accounts[0]?.email || '';
  } catch {
    return '';
  }
}

// ============== AGENTS LIST FROM GATEWAY ==============
function getAgentsFromDB(): any[] {
  try {
    const rows = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status = 'active' ORDER BY name`).all() as any[];
    return rows.map((r: any) => ({
      id: r.id,
      identityName: r.name || r.id,
      identityEmoji: '🤖',
      description: r.role || r.description || '',
      workspace: agentWorkspace(r.id),
      model: '',
      isDefault: r.id === 'froggo',
    }));
  } catch (e: any) {
    safeLog.error('[Agents] DB fallback failed:', e.message);
    return [];
  }
}

ipcMain.handle('gateway:getToken', async () => {
  const configPaths = [
    OPENCLAW_CONFIG,
    OPENCLAW_CONFIG_LEGACY,
  ];
  for (const cfgPath of configPaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        const token = cfg.gateway?.controlUi?.auth?.token || cfg.gateway?.auth?.token;
        if (token) return token;
      }
    } catch (err) { safeLog.debug('[GatewayToken] Config read failed:', err); }
  }
  return '';
});

ipcMain.handle('agents:list', async () => {
  return new Promise((resolve) => {
    exec('openclaw agents list --json', { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.warn('[Agents] CLI failed, falling back to DB:', error.message);
        const agents = getAgentsFromDB();
        safeLog.log(`[Agents] Loaded ${agents.length} agents from DB fallback`);
        resolve({ success: agents.length > 0, agents });
        return;
      }

      try {
        // Parse JSON output from CLI
        const rawAgents = JSON.parse(stdout || '[]');
        if (rawAgents.length === 0) {
          safeLog.warn('[Agents] CLI returned empty, falling back to DB');
          const agents = getAgentsFromDB();
          resolve({ success: agents.length > 0, agents });
          return;
        }

        safeLog.log(`[Agents] Loaded ${rawAgents.length} agents from gateway`);
        resolve({ success: true, agents: rawAgents });
      } catch (parseError: any) {
        safeLog.warn('[Agents] Parse failed, falling back to DB:', (parseError as any).message);
        const agents = getAgentsFromDB();
        resolve({ success: agents.length > 0, agents });
      }
    });
  });
});

// ============== SESSIONS LIST ==============
ipcMain.handle('sessions:list', async (_, activeMinutes?: number) => {
  return new Promise((resolve) => {
    const args = ['sessions', 'list', '--json'];
    if (activeMinutes) {
      args.push('--active', String(activeMinutes));
    }
    
    exec(
      `openclaw ${args.join(' ')}`,
      { 
        timeout: 10000, 
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } 
      },
      (error, stdout, _stderr) => {
        if (error) {
          safeLog.warn('[Sessions] CLI failed:', error.message);
          resolve({ success: false, error: error.message, sessions: [] });
          return;
        }

        try {
          const data = JSON.parse(stdout || '{}');
          safeLog.log(`[Sessions] Loaded ${data.sessions?.length || 0} sessions from gateway`);
          resolve({ 
            success: true, 
            sessions: data.sessions || [],
            count: data.count || 0,
            path: data.path
          });
        } catch (parseError: any) {
          safeLog.warn('[Sessions] Parse failed:', parseError.message);
          resolve({ success: false, error: parseError.message, sessions: [] });
        }
      }
    );
  });
});

// ============== AGENT REGISTRY FROM DB ==============
ipcMain.handle('get-agent-registry', async () => {
  try {
    const agents = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status = 'active' ORDER BY name`).all();
    safeLog.log(`[AgentRegistry] Loaded ${agents.length} agents from DB`);
    return agents;
  } catch (error: any) {
    safeLog.error('[AgentRegistry] Error:', error.message);
    return [];
  }
});

// ============== WIDGET MANIFEST SCANNER ==============
ipcMain.handle('widget:scan-manifest', async (_, agentId: string) => {
  try {
    // Validate agentId to prevent path traversal
    if (!agentId || agentId.includes('..') || agentId.includes('/') || agentId.includes('\\')) {
      safeLog.warn('[WidgetManifest] Invalid agentId:', agentId);
      return { error: 'Invalid agent ID' };
    }

    // Construct path to widget manifest
    const manifestPath = path.join(os.homedir(), '.openclaw', 'agents', agentId, 'widgets', 'widget-manifest.json');

    // Check if file exists
    if (!fs.existsSync(manifestPath)) {
      // Not an error - many agents won't have widgets
      return { error: 'Manifest not found' };
    }

    // Validate the path is within .openclaw/agents/ (defense in depth)
    const allowedDir = path.join(os.homedir(), '.openclaw', 'agents');
    const resolvedPath = path.resolve(manifestPath);
    if (!resolvedPath.startsWith(allowedDir)) {
      safeLog.error('[WidgetManifest] Path traversal attempt:', manifestPath);
      return { error: 'Invalid manifest path' };
    }

    // Read and parse manifest
    let manifest: any;
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    } catch (parseError) {
      safeLog.error('[WidgetManifest] Failed to parse manifest JSON:', parseError);
      return { error: 'Invalid manifest JSON' };
    }

    // Validate component paths don't escape widget directory
    const widgetDir = path.dirname(manifestPath);
    if (manifest.widgets && Array.isArray(manifest.widgets)) {
      for (const widget of manifest.widgets) {
        if (widget.component) {
          const componentPath = path.resolve(widgetDir, widget.component);
          if (!componentPath.startsWith(widgetDir)) {
            safeLog.error('[WidgetManifest] Component path escapes directory:', widget.component);
            return { error: 'Invalid component path' };
          }
        }
      }
    }

    safeLog.log(`[WidgetManifest] Loaded manifest for ${agentId}`);
    return manifest;

  } catch (err: any) {
    safeLog.error('[WidgetManifest] Error reading manifest:', err.message);
    return { error: err.message };
  }
});

// ============== SAFE LOGGER (EPIPE-proof) ==============
// Prevents "write EPIPE" crashes during app shutdown or when streams are closed
// Debug file logger for agent issues
const debugLogPath = '/tmp/clawd-dashboard-debug.log';
function debugLog(...args: any[]) {
  try {
    const ts = new Date().toISOString();
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    fs.appendFileSync(debugLogPath, `[${ts}] ${msg}\n`);
  } catch (_e) { /* ignore */ }
}

const safeLog = {
  log: (...args: unknown[]) => {
    try {
      if (process.stdout.writable) {
        console.log(...args);
      }
    } catch {
      // Silently ignore EPIPE and other stream errors
    }
  },
  error: (...args: unknown[]) => {
    try {
      if (process.stderr.writable) {
        console.error(...args);
      }
    } catch {
      // Silently ignore stream errors
    }
  },
  warn: (...args: unknown[]) => {
    try {
      if (process.stderr.writable) {
        console.warn(...args);
      }
    } catch {
      // Silently ignore stream errors
    }
  },
  debug: (...args: unknown[]) => {
    try {
      if (process.stdout.writable) {
        console.debug(...args);
      }
    } catch {
      // Silently ignore stream errors
    }
  }
};

// Global EPIPE handler - prevent uncaught exceptions from crashing the app
process.on('uncaughtException', (error: any) => {
  // EPIPE errors during shutdown are expected - ignore them
  if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
    return;
  }
  
  // Log other uncaught exceptions (safely)
  try {
    if (process.stderr.writable) {
      safeLog.error('[UNCAUGHT EXCEPTION]', error);
    }
  } catch (err) { safeLog.debug('[ExceptionHandler] Failed to log exception:', err); }
  
  // Don't exit for EPIPE-like errors, but consider exiting for severe errors
  // For now, keep running to avoid data loss
});

// Handle promise rejections
process.on('unhandledRejection', (reason: any) => {
  safeLog.error('[UNHANDLED REJECTION]', reason);
});

// Handle SIGPIPE signal (broken pipe at OS level)
process.on('SIGPIPE', () => {
  // Ignore SIGPIPE - we handle it via EPIPE errors
});

// Local server for serving model files in prod
let modelServer: http.Server | null = null;
const modelServerPort = 18799;

let mainWindow: BrowserWindow | null = null;
let floatingToolbarWindow: BrowserWindow | null = null;

// Request microphone AND camera access on macOS
if (process.platform === 'darwin') {
  systemPreferences.askForMediaAccess('microphone').then(granted => {
    safeLog.log('Microphone access:', granted ? 'granted' : 'denied');
  });
  systemPreferences.askForMediaAccess('camera').then(granted => {
    safeLog.log('Camera access:', granted ? 'granted' : 'denied');
  });
}

// In packaged app, __dirname is inside asar at /dist-electron
// dist folder is sibling at /dist
const distPath = path.join(__dirname, '..', 'dist', 'index.html');
const isDev = process.env.ELECTRON_DEV === '1';

safeLog.log('App packaged:', app.isPackaged);
safeLog.log('Dist path:', distPath);
safeLog.log('isDev:', isDev);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Dev vs Prod visual differentiation
  const isDevApp = app.getName().includes('Dev') || isDev;
  const appVersion = app.getVersion();
  mainWindow.setTitle(isDevApp ? `Froggo [DEV] v${appVersion}` : `Froggo v${appVersion}`);

  // Setup notification handlers
  setupNotificationHandlers(mainWindow);

  // Register X Automations handlers
  registerXAutomationsHandlers();

  // Register Writing Project handlers
  registerWritingProjectHandlers();

  // Register Writing Feedback handlers
  registerWritingFeedbackHandlers();

  // Register Writing Memory handlers
  registerWritingMemoryHandlers();

  // Register Writing Research handlers
  registerWritingResearchHandlers();

  // Register Writing Version handlers
  registerWritingVersionHandlers();

  // Register Writing Chat handlers
  registerWritingChatHandlers();

  // Writing wizard state persistence
  registerWritingWizardHandlers();

  // Register Finance handlers (extracted from main.ts)
  registerFinanceHandlers();

  // Register X/Twitter handlers (extracted from main.ts — Phase 33)
  registerXTwitterHandlers();
  // Register task-domain handlers (extracted from main.ts — Phase 33)
  registerTaskHandlers();
  // Register comms handlers (extracted from main.ts — Phase 33 Wave 2)
  registerCommsHandlers();
  // Register calendar handlers (extracted from main.ts — Phase 33 Wave 2)
  registerCalendarHandlers();
  // Register schedule/snooze/pins/folders handlers (extracted from main.ts — Phase 33 Wave 2)
  registerScheduleHandlers();

  if (isDev) {
    safeLog.log('Running in dev mode, loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    safeLog.log('Running in production mode, loading from dist');
    mainWindow.loadFile(distPath);
  }

  // Handle permission requests (microphone, camera, screen capture)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = [
      'media',           // Generic media access
      'microphone',      // Microphone
      'camera',          // Camera
      'audioCapture',    // Audio capture
      'videoCapture',    // Video capture (camera)
      'display-capture', // Screen sharing / getDisplayMedia
      'screen',          // Screen access
    ];
    if (allowedPermissions.includes(permission)) {
      safeLog.log('Permission granted:', permission);
      callback(true);
    } else {
      safeLog.log('Permission denied:', permission);
      callback(false);
    }
  });

  // Handle permission checks (Electron checks permissions before requesting them)
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowedPermissions = [
      'media', 'microphone', 'camera', 'audioCapture',
      'videoCapture', 'display-capture', 'screen',
    ];
    if (allowedPermissions.includes(permission)) {
      return true;
    }
    safeLog.log('Permission check denied:', permission, 'from', requestingOrigin);
    return false;
  });

  // Handle getDisplayMedia requests (required for screen sharing in Electron 28+)
  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      if (sources.length > 0) {
        callback({ video: sources[0] });
      } else {
        callback({});
      }
    } catch (err) {
      safeLog.error('[DisplayMedia] Failed to get sources:', err);
      callback({});
    }
  });

  // Catch renderer crashes to diagnose issues
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    safeLog.log('[Main] RENDERER CRASHED:', details.reason, details.exitCode);
  });

  // SAFEGUARD: Send cleanup signal before window closes
  mainWindow.on('close', () => {
    if (mainWindow) {
      safeLog.log('[Main] Window closing - sending cleanup signal...');
      safeSend('app-closing');
      // Give renderer time to cleanup (mic/camera release)
      // The actual close happens after renderer cleanup
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Safe wrapper for webContents.send to prevent EPIPE crashes
function safeSend(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, ...args);
    } catch (e) {
      // Ignore EPIPE errors (window closing), log others
      if ((e as any).code !== 'EPIPE') {
        safeLog.error(`[SafeSend] Error sending to ${channel}:`, e);
      }
    }
  }
}

// Task notification file watcher
let taskNotifyWatcher: fs.FSWatcher | null = null;
const taskNotifyPath = path.join(DATA_DIR, 'task-notify.json');
let lastTaskNotifyMtime = 0;

// Helper function to emit task events for real-time Dashboard updates
function emitTaskEvent(eventType: string, taskId: string, payload: any = {}) {
  // Get task data from database for the event payload
  try {
    const task = prepare(`SELECT id, title, description, status, project, assigned_to, reviewerId as reviewer_id, priority, due_date, updated_at FROM tasks WHERE id = ?`).get(taskId) as any;

    if (!task) {
      safeLog.error('[TaskEvents] Task not found:', taskId);
      return;
    }

    const fullPayload = { ...task, ...payload };

    // Write to notification file for file watcher (backup method)
    const notifyFile = path.join(DATA_DIR, 'task-notify.json');
    const notification = {
      event: eventType,
      task: fullPayload,
      timestamp: Date.now()
    };

    try {
      fs.mkdirSync(path.dirname(notifyFile), { recursive: true });
      fs.writeFileSync(notifyFile, JSON.stringify(notification));
    } catch (writeError) {
      safeLog.error('[TaskEvents] Failed to write notification file:', writeError);
    }

    // DIRECT WebSocket broadcast via renderer
    // This is the PRIMARY method for real-time updates
    safeSend('gateway-broadcast', {
      type: 'event',
      event: eventType,
      payload: fullPayload
    });

    safeLog.log('[TaskEvents] Emitted:', eventType, 'for task', taskId, 'via WebSocket broadcast');
  } catch (error: any) {
    safeLog.error('[TaskEvents] Failed to get task data:', error.message);
  }
}

// Schedule processor interval
let scheduleProcessorInterval: NodeJS.Timeout | null = null;
const SCHEDULE_CHECK_INTERVAL = 30000; // 30 seconds

// Process scheduled items that are overdue
async function processScheduledItems() {
  // Query for pending items and filter in JS (handles various datetime formats)
  let items: any[] = [];
  try {
    items = prepare("SELECT * FROM schedule WHERE status = 'pending'").all() as any[];
  } catch (e: any) {
    safeLog.error('[ScheduleProcessor] Query error:', e.message);
    return;
  }

  if (items.length === 0) return;

  // Filter for overdue items (scheduled_for <= now)
  const now = new Date();
  items = items.filter(item => {
    if (!item.scheduled_for) return false;
    const scheduledTime = new Date(item.scheduled_for);
    return scheduledTime <= now;
  });

  if (items.length === 0) return;

  safeLog.log(`[ScheduleProcessor] Found ${items.length} overdue item(s) to process`);

  // Helper to update schedule status via parameterized query
  const updateScheduleStatus = (itemId: string, status: string, error?: string | null) => {
    try {
      prepare("UPDATE schedule SET status = ?, sent_at = datetime('now'), error = ? WHERE id = ?").run(status, error || null, itemId);
    } catch (dbErr: any) {
      safeLog.error('[ScheduleProcessor] DB update error:', dbErr);
    }
  };

  for (const item of items) {
    safeLog.log(`[ScheduleProcessor] Processing ${item.type}: ${item.id}`);

    let execCmd = '';
    let metadata: any = {};

    try {
      if (item.metadata) {
        metadata = JSON.parse(item.metadata);
      }
    } catch (e) {
      safeLog.error(`[ScheduleProcessor] Failed to parse metadata for ${item.id}:`, e);
    }

    // Build command based on type
    if (item.type === 'tweet') {
      // Post via X API directly
      try {
        const result = await xApi.postTweet(item.content);
        if (result.success) {
          safeLog.log(`[ScheduleProcessor] Tweet posted: ${result.id}`);
          updateScheduleStatus(item.id, 'completed');
        } else {
          safeLog.error(`[ScheduleProcessor] Tweet failed: ${result.error}`);
          updateScheduleStatus(item.id, 'failed', result.error || 'Unknown tweet error');
        }
        continue;
      } catch (e: any) {
        safeLog.error(`[ScheduleProcessor] Tweet error:`, e.message);
      }
      execCmd = ''; // fallback cleared
    } else if (item.type === 'email') {
      const recipient = (metadata.recipient || metadata.to || '').replace(/"/g, '\\"');
      const account = metadata.account || '';

      // GUARD: Skip emails with missing recipient or account (prevents gog auth loops)
      if (!recipient || !recipient.trim()) {
        safeLog.error(`[ScheduleProcessor] Email ${item.id} has no recipient - marking as failed`);
        updateScheduleStatus(item.id, 'failed', 'Missing recipient');
        continue;
      }
      if (!account || !account.trim()) {
        safeLog.error(`[ScheduleProcessor] Email ${item.id} has no account configured - marking as failed`);
        updateScheduleStatus(item.id, 'failed', 'Missing GOG account');
        continue;
      }

      const subject = (metadata.subject || 'No subject').replace(/"/g, '\\"');
      const body = item.content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      execCmd = `GOG_ACCOUNT="${account}" gog gmail send --to "${recipient}" --subject "${subject}" --body "${body}"`;
    } else {
      safeLog.warn(`[ScheduleProcessor] Unknown type: ${item.type}`);
      updateScheduleStatus(item.id, 'failed', `Unknown type: ${item.type}`);
      continue;
    }

    safeLog.log(`[ScheduleProcessor] Executing: ${execCmd.slice(0, 100)}...`);

    // Execute the command
    exec(execCmd, { timeout: 60000 }, (execError) => {
      if (execError) {
        safeLog.error(`[ScheduleProcessor] Failed to send ${item.id}:`, execError.message);
        updateScheduleStatus(item.id, 'failed', (execError.message || '').slice(0, 500));

        // Notify renderer of failure
        safeSend('schedule-processed', {
          id: item.id,
          type: item.type,
          success: false,
          error: execError.message
        });
      } else {
        safeLog.log(`[ScheduleProcessor] Successfully sent ${item.id}`);
        updateScheduleStatus(item.id, 'sent');

        // Notify renderer of success
        safeSend('schedule-processed', {
          id: item.id,
          type: item.type,
          success: true
        });
      }
    });
  }
}

function startScheduleProcessor() {
  safeLog.log('[ScheduleProcessor] Starting schedule processor (every 30s)');
  // Run immediately on start
  processScheduledItems();
  // Then run every 30 seconds
  scheduleProcessorInterval = setInterval(processScheduledItems, SCHEDULE_CHECK_INTERVAL);
}

function stopScheduleProcessor() {
  if (scheduleProcessorInterval) {
    clearInterval(scheduleProcessorInterval);
    scheduleProcessorInterval = null;
    safeLog.log('[ScheduleProcessor] Stopped');
  }
}

function startTaskNotifyWatcher() {
  // Ensure parent directory exists
  const dir = path.dirname(taskNotifyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Watch for changes to the notification file
  try {
    taskNotifyWatcher = fs.watch(path.dirname(taskNotifyPath), (eventType, filename) => {
      if (filename === 'task-notify.json' && mainWindow && !mainWindow.isDestroyed()) {
        try {
          const stat = fs.statSync(taskNotifyPath);
          // Only process if file was modified after last check
          if (stat.mtimeMs > lastTaskNotifyMtime) {
            lastTaskNotifyMtime = stat.mtimeMs;
            const content = fs.readFileSync(taskNotifyPath, 'utf-8');
            const notification = JSON.parse(content);
            safeLog.log('[TaskNotify] New task notification:', notification);
            // Send to renderer with error handling
            try {
              mainWindow.webContents.send('task-notification', notification);
            } catch (sendError) {
              // Window might be closing, ignore EPIPE errors
              if ((sendError as any).code !== 'EPIPE') {
                safeLog.error('[TaskNotify] Send error:', sendError);
              }
            }
          }
        } catch (_e) {
          // File might not exist or be invalid, ignore
        }
      }
    });
    safeLog.log('[TaskNotify] Watching for task notifications at:', taskNotifyPath);
  } catch (e) {
    safeLog.error('[TaskNotify] Failed to start watcher:', e);
  }
}

// Notification event cleanup function (set in app.whenReady)
let stopNotificationEvents: (() => void) | null = null;

app.whenReady().then(() => {
  // Start local HTTP server to serve model files in prod
  if (!isDev) {
    modelServer = http.createServer((req, res) => {
      const filePath = path.join(process.resourcesPath, 'models', path.basename(req.url || ''));
      safeLog.log('[ModelServer] Request:', req.url, '-> serving:', filePath);
      
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        safeLog.log('[ModelServer] File not found:', filePath);
        res.writeHead(404);
        res.end('Not found');
      }
    });
    
    modelServer.listen(modelServerPort, '127.0.0.1', () => {
      safeLog.log(`[ModelServer] Serving models on http://127.0.0.1:${modelServerPort}`);
    });
  }
  
  // ── X/Twitter schema migrations (idempotent) ──
  try {
    // Ensure x_mentions table exists with all columns
    db.exec(`CREATE TABLE IF NOT EXISTS x_mentions (
      id TEXT PRIMARY KEY,
      tweet_id TEXT,
      author_id TEXT,
      author_username TEXT NOT NULL,
      author_name TEXT,
      text TEXT,
      created_at INTEGER,
      conversation_id TEXT,
      in_reply_to_user_id TEXT,
      reply_status TEXT DEFAULT 'pending',
      replied_at INTEGER,
      replied_with_id TEXT,
      fetched_at INTEGER NOT NULL,
      updated_at INTEGER,
      metadata TEXT
    )`);

    // Add missing columns to x_mentions (each wrapped individually for idempotency)
    const mentionColumns = [
      ['tweet_id', 'TEXT'],
      ['author_id', 'TEXT'],
      ['author_name', 'TEXT'],
      ['text', 'TEXT'],
      ['created_at', 'INTEGER'],
      ['conversation_id', 'TEXT'],
      ['in_reply_to_user_id', 'TEXT'],
      ['reply_status', "TEXT DEFAULT 'pending'"],
      ['replied_at', 'INTEGER'],
      ['replied_with_id', 'TEXT'],
      ['updated_at', 'INTEGER'],
    ];
    for (const [col, type] of mentionColumns) {
      try { db.exec(`ALTER TABLE x_mentions ADD COLUMN ${col} ${type}`); } catch (_e) { /* column exists */ }
    }

    // Fix x_drafts CHECK constraint: add 'posted' to allowed statuses
    // SQLite cannot ALTER CHECK constraints, so we recreate the table
    const draftsInfo = db.pragma('table_info(x_drafts)') as { name: string }[];
    if (draftsInfo.length > 0) {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS x_drafts_new (
            id TEXT PRIMARY KEY,
            plan_id TEXT,
            version TEXT NOT NULL,
            content TEXT NOT NULL,
            media_paths TEXT,
            proposed_by TEXT NOT NULL,
            approved_by TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            file_path TEXT,
            metadata TEXT,
            FOREIGN KEY(plan_id) REFERENCES x_content_plans(id),
            CHECK(status IN ('draft', 'approved', 'rejected', 'scheduled', 'posted'))
          );
          INSERT OR IGNORE INTO x_drafts_new SELECT * FROM x_drafts;
          DROP TABLE x_drafts;
          ALTER TABLE x_drafts_new RENAME TO x_drafts;
          CREATE INDEX IF NOT EXISTS idx_drafts_status ON x_drafts(status);
          CREATE INDEX IF NOT EXISTS idx_drafts_plan ON x_drafts(plan_id);
          CREATE INDEX IF NOT EXISTS idx_drafts_version ON x_drafts(plan_id, version);
          CREATE INDEX IF NOT EXISTS idx_drafts_created ON x_drafts(created_at DESC);
        `);
        safeLog.log('[Migration] x_drafts CHECK constraint updated to include posted');
      } catch (e: any) {
        // Already migrated or table doesn't need it
        safeLog.log('[Migration] x_drafts migration skipped:', e.message);
      }
    }

    // ── X Automations tables ──
    db.exec(`CREATE TABLE IF NOT EXISTS x_automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT DEFAULT '{}',
      conditions TEXT DEFAULT '[]',
      actions TEXT DEFAULT '[]',
      max_executions_per_hour INTEGER DEFAULT 10,
      max_executions_per_day INTEGER DEFAULT 50,
      total_executions INTEGER DEFAULT 0,
      last_executed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT DEFAULT 'user'
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS x_automation_executions (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      trigger_data TEXT DEFAULT '{}',
      actions_executed TEXT DEFAULT '[]',
      status TEXT DEFAULT 'success',
      error_message TEXT,
      executed_at INTEGER NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS x_automation_rate_limits (
      automation_id TEXT NOT NULL,
      hour_bucket TEXT NOT NULL,
      execution_count INTEGER DEFAULT 0,
      PRIMARY KEY (automation_id, hour_bucket)
    )`);

    // Scheduled posts table
    db.exec(`CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      posted_at INTEGER,
      error TEXT
    )`);

    // Campaigns table
    db.exec(`CREATE TABLE IF NOT EXISTS x_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT DEFAULT '',
      stages TEXT DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      start_date TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);

    safeLog.log('[Migration] X Automations + Campaigns tables ensured');

    // Simple scheduled_posts table for direct tweet scheduling
    db.exec(`CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )`);

    safeLog.log('[Migration] X/Twitter schema migrations complete');
  } catch (err) {
    safeLog.error('[Migration] X/Twitter schema migration error:', err);
  }

  // Module Builder specs table
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS module_specs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'in-progress',
      spec TEXT NOT NULL DEFAULT '{}',
      conversation TEXT NOT NULL DEFAULT '[]',
      conversation_state TEXT NOT NULL DEFAULT '{}',
      overall_progress INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK(status IN ('in-progress', 'finished', 'archived'))
    )`);
    safeLog.log('[Migration] module_specs table ensured');
  } catch (err) {
    safeLog.error('[Migration] module_specs migration error:', err);
  }

  // Initialize X API tokens from secret store
  try {
    initXApiTokens();
  } catch (err) {
    safeLog.error('[Main] Failed to initialize X API tokens:', err);
  }

  // Register X publishing IPC handlers (OAuth 1.0a via x-api CLI)
  registerXPublishingHandlers();
  // Register X analytics IPC handlers (real profile + tweet metrics from X API)
  registerXAnalyticsHandlers();

  // Register Agent Management IPC handlers (SOUL.md + model config)
  registerAgentManagementHandlers();

  // Register Memory Lifecycle IPC handlers (health metrics + rotation)
  registerMemoryLifecycleHandlers();

  // Register unified search IPC handlers (fan-out across messages, tasks, agent context)
  registerSearchHandlers();

  // Register Knowledge feed IPC handlers (shared_knowledge table)
  registerKnowledgeHandlers();

  // Start task notification watcher
  startTaskNotifyWatcher();
  
  // Start schedule processor (auto-send overdue items)
  startScheduleProcessor();
  
  // Create window first (needed for notifications)
  createWindow();
  
  // Start notification event listeners (requires mainWindow)
  if (mainWindow) {
    stopNotificationEvents = setupNotificationEvents(mainWindow);
  }
  
  // Initialize persistent dashboard agent sessions
  initializeDashboardAgents().catch(err => {
    safeLog.error('[Main] Failed to initialize dashboard agents:', err);
  });

  // Initialize Finance Agent Bridge
  initializeFinanceAgentBridge().catch((err) => {
    safeLog.error('[Main] Failed to initialize Finance Agent Bridge:', err);
  });

  // Check for updates (prod only, non-blocking)
  if (!isDev && !app.getName().includes('Dev')) {
    checkForUpdates().catch((err) => safeLog.error('[Updates] Failed to check for updates:', err));
  }

  // Start comms polling and email auto-check (extracted timers)
  setTimeout(startCommsPolling, 8000);
  setTimeout(startEmailAutoCheck, 5000);
});

// Update checker — compares local version to latest GitHub Release
async function checkForUpdates(): Promise<void> {
  const https = await import('https');
  return new Promise((resolve) => {
    const req = https.get('https://api.github.com/repos/ProfFroggo/froggo_bot/releases/latest', {
      headers: { 'User-Agent': 'Froggo-App', Accept: 'application/vnd.github.v3+json' },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', async () => {
        try {
          const release = JSON.parse(data);
          const remoteVersion = (release.tag_name || '').replace(/^v/, '');
          const localVersion = app.getVersion();
          if (remoteVersion && remoteVersion !== localVersion && isNewerVersion(remoteVersion, localVersion)) {
            const { response } = await dialog.showMessageBox({
              type: 'info',
              title: 'Update Available',
              message: `Froggo v${remoteVersion} is available (you have v${localVersion}).`,
              buttons: ['View Release', 'Later'],
              defaultId: 0,
              cancelId: 1,
            });
            if (response === 0) {
              shell.openExternal(release.html_url || `https://github.com/ProfFroggo/froggo_bot/releases/tag/v${remoteVersion}`);
            }
          }
        } catch (err) { safeLog.debug('[UpdateCheck] Dialog error:', err); }
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Clean up model server
  if (modelServer) {
    modelServer.close();
    modelServer = null;
  }
  // Clean up task notify watcher
  if (taskNotifyWatcher) {
    taskNotifyWatcher.close();
    taskNotifyWatcher = null;
  }
  // Clean up schedule processor
  stopScheduleProcessor();
  // Clean up notification event listeners
  if (stopNotificationEvents) {
    stopNotificationEvents();
    stopNotificationEvents = null;
  }
  // Clean up dashboard agents
  shutdownDashboardAgents();
  // Close research database connections
  closeAllResearchDbs();
  // Close database connections
  closeDb();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============== SECRET STORE / API KEY IPC HANDLERS ==============
// These use Electron safeStorage which is available after app.ready

ipcMain.handle('settings:getApiKey', async (_, keyName: string) => {
  try {
    return getSecret(keyName);
  } catch (err: any) {
    safeLog.error('[Settings] getApiKey error:', err.message);
    return null;
  }
});

ipcMain.handle('settings:storeApiKey', async (_, keyName: string, value: string) => {
  try {
    storeSecret(keyName, value);
    return { success: true };
  } catch (err: any) {
    safeLog.error('[Settings] storeApiKey error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:hasApiKey', async (_, keyName: string) => {
  try {
    return hasSecret(keyName);
  } catch (err: any) {
    safeLog.error('[Settings] hasApiKey error:', err.message);
    return false;
  }
});

ipcMain.handle('settings:deleteApiKey', async (_, keyName: string) => {
  try {
    deleteSecret(keyName);
    return { success: true };
  } catch (err: any) {
    safeLog.error('[Settings] deleteApiKey error:', err.message);
    return { success: false, error: err.message };
  }
});

// ============== SCREEN CAPTURE IPC HANDLER ==============
ipcMain.handle('screen:getSources', async (_, opts?: { types?: string[]; thumbnailSize?: { width: number; height: number } }) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: (opts?.types as any) || ['window', 'screen'],
      thumbnailSize: opts?.thumbnailSize || { width: 320, height: 180 },
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      display_id: source.display_id,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
    }));
  } catch (error: any) {
    safeLog.error('[ScreenCapture] Failed to get sources:', error);
    return [];
  }
});

// ============== MEDIA PERMISSIONS CHECK ==============
ipcMain.handle('media:checkPermissions', async () => {
  if (process.platform === 'darwin') {
    const camera = systemPreferences.getMediaAccessStatus('camera');
    const microphone = systemPreferences.getMediaAccessStatus('microphone');
    const screen = systemPreferences.getMediaAccessStatus('screen');
    return { camera, microphone, screen };
  }
  return { camera: 'granted', microphone: 'granted', screen: 'granted' };
});

ipcMain.handle('media:requestPermission', async (_, mediaType: 'camera' | 'microphone') => {
  if (process.platform === 'darwin') {
    const granted = await systemPreferences.askForMediaAccess(mediaType);
    return granted;
  }
  return true;
});

// ============== GATEWAY IPC HANDLERS ==============
// gateway:sessions, gateway:sessions:list removed - renderer uses gateway.ts WebSocket directly

// ============== WHISPER (Legacy - keeping for fallback) ==============
const WHISPER_PATH = '/opt/homebrew/bin/whisper';
const TEMP_DIR = os.tmpdir();

ipcMain.handle('whisper:transcribe', async (_, audioData: ArrayBuffer) => {
  const tempFile = path.join(TEMP_DIR, `whisper-${Date.now()}.webm`);
  const outputDir = TEMP_DIR;
  
  try {
    // Write audio data to temp file
    fs.writeFileSync(tempFile, Buffer.from(audioData));
    safeLog.log('Whisper: Saved audio to', tempFile);
    
    // Run whisper (use "tiny" model - fastest, good enough for voice commands)
    return new Promise((resolve) => {
      const cmd = `${WHISPER_PATH} "${tempFile}" --model tiny --language en --output_format txt --output_dir "${outputDir}" 2>&1`;
      safeLog.log('Whisper: Running', cmd);
      
      exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
        // Read the output file
        const baseName = path.basename(tempFile, '.webm');
        const outputFile = path.join(outputDir, `${baseName}.txt`);
        
        let transcript = '';
        if (fs.existsSync(outputFile)) {
          transcript = fs.readFileSync(outputFile, 'utf-8').trim();
          fs.unlinkSync(outputFile); // Cleanup
        }
        
        // Cleanup temp audio file
        try { fs.unlinkSync(tempFile); } catch { /* ignore cleanup errors */ }
        
        if (error) {
          safeLog.error('Whisper error:', error.message);
          resolve({ error: error.message, stdout, stderr });
        } else {
          safeLog.log('Whisper transcript:', transcript);
          resolve({ transcript, stdout });
        }
      });
    });
  } catch (error: any) {
    safeLog.error('Whisper failed:', error);
    try { fs.unlinkSync(tempFile); } catch { /* ignore cleanup errors */ }
    return { error: error.message };
  }
});

ipcMain.handle('whisper:check', async () => {
  // Just check if the file exists - running --help is too slow
  const available = fs.existsSync(WHISPER_PATH);
  safeLog.log('Whisper check:', WHISPER_PATH, 'exists:', available);
  return { available, path: WHISPER_PATH };
});

// ============== VOICE IPC HANDLERS ==============
ipcMain.handle('voice:getModelUrl', async () => {
  const url = isDev 
    ? '/models/model.tar.gz'
    : `http://127.0.0.1:${modelServerPort}/model.tar.gz`;
  safeLog.log('[Voice] getModelUrl called, isDev:', isDev, 'returning:', url);
  return url;
});

// TTS via ElevenLabs (sag CLI)
// Load ElevenLabs API key from env file if not in environment
let elevenlabsApiKey = process.env.ELEVENLABS_API_KEY || '';
try {
  const envPath = path.join(os.homedir(), '.openclaw', 'elevenlabs.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/ELEVENLABS_API_KEY=(.+)/);
    if (match) elevenlabsApiKey = match[1].trim();
  }
} catch (err) { safeLog.debug('[TTS] Failed to load ElevenLabs API key:', err); }

ipcMain.handle('voice:speak', async (_, text: string, voice?: string) => {
  const outputPath = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
  const voiceArg = voice ? `-v "${voice}"` : '-v Brian';
  // Escape text for shell - use fast model for lower latency
  const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const cmd = `sag ${voiceArg} --model-id eleven_flash_v2_5 -o "${outputPath}" "${escapedText}"`;
  
  safeLog.log('[Voice] TTS command:', cmd.slice(0, 120) + '...');
  
  return new Promise((resolve) => {
    // Pass environment variables including ELEVENLABS_API_KEY
    const env = { ...process.env };
    if (elevenlabsApiKey) env.ELEVENLABS_API_KEY = elevenlabsApiKey;
    
    exec(cmd, { timeout: 30000, env }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Voice] TTS error:', error.message);
        safeLog.error('[Voice] TTS stderr:', stderr);
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Voice] TTS generated:', outputPath);
        resolve({ success: true, path: outputPath });
      }
    });
  });
});

// froggo-db task sync
// Get active agent sessions (for real-time task activity indicators)
ipcMain.handle('agents:getActiveSessions', async () => {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      exec(
        'openclaw sessions list --kinds agent --limit 50 --json',
        { 
          encoding: 'utf-8', 
          timeout: 5000,
          env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve(stdout.trim());
          }
        }
      );
    });

    let data: { sessions?: Array<{ key: string; updatedAt?: number }> } = { sessions: [] };
    try {
      data = JSON.parse(result);
    } catch (parseError) {
      safeLog.error('[ActiveSessions] Failed to parse sessions JSON:', parseError);
      return [];
    }
    const sessions = data.sessions || [];
    
    // Filter to recently active sessions (updated within last 2 minutes)
    const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
    const activeSessions = sessions
      .filter((s: any) => s.updatedAt && s.updatedAt > twoMinutesAgo)
      .map((s: any) => {
        // Extract agent ID from session key (format: agent:agentId:...)
        const parts = s.key.split(':');
        const agentId = parts[1];
        const sessionType = parts[2] || 'main'; // main, room:xxx, cron:xxx, etc
        
        return {
          agentId,
          sessionKey: s.key,
          sessionType,
          updatedAt: s.updatedAt,
          totalTokens: s.totalTokens || 0,
          isActive: true
        };
      });

    return { success: true, sessions: activeSessions };
  } catch (error: any) {
    safeLog.error('[agents:getActiveSessions] Error:', error.message);
    return { success: false, sessions: [], error: error.message };
  }
});

// ============================================================
// NOTIFICATION SETTINGS HANDLERS
// ============================================================

// Get notification settings for a specific conversation
ipcMain.handle('notification-settings:get', async (_, sessionKey: string) => {
  try {
    const row = prepare('SELECT * FROM conversation_notification_settings WHERE session_key = ?').get(sessionKey);
    return { success: true, settings: row || null };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Get error:', error);
    return { success: false, settings: null };
  }
});

// Set/update notification settings for a conversation
ipcMain.handle('notification-settings:set', async (_, sessionKey: string, settings: any) => {
  try {
    // Check if settings exist
    const existing = prepare('SELECT id FROM conversation_notification_settings WHERE session_key = ?').get(sessionKey);

    if (existing) {
      // UPDATE existing settings — build dynamic SET clause with parameterized values
      const setParts: string[] = [];
      const params: any[] = [];

      if (settings.notification_level !== undefined) {
        setParts.push('notification_level = ?'); params.push(settings.notification_level);
      }
      if (settings.sound_enabled !== undefined) {
        setParts.push('sound_enabled = ?'); params.push(settings.sound_enabled ? 1 : 0);
      }
      if (settings.sound_type !== undefined) {
        setParts.push('sound_type = ?'); params.push(settings.sound_type);
      }
      if (settings.desktop_notifications !== undefined) {
        setParts.push('desktop_notifications = ?'); params.push(settings.desktop_notifications ? 1 : 0);
      }
      if (settings.quiet_hours_enabled !== undefined) {
        setParts.push('quiet_hours_enabled = ?'); params.push(settings.quiet_hours_enabled ? 1 : 0);
      }
      if (settings.quiet_start !== undefined) {
        setParts.push('quiet_start = ?'); params.push(settings.quiet_start);
      }
      if (settings.quiet_end !== undefined) {
        setParts.push('quiet_end = ?'); params.push(settings.quiet_end);
      }
      if (settings.keyword_alerts !== undefined) {
        setParts.push('keyword_alerts = ?'); params.push(JSON.stringify(settings.keyword_alerts));
      }
      if (settings.priority_level !== undefined) {
        setParts.push('priority_level = ?'); params.push(settings.priority_level);
      }
      if (settings.mute_until !== undefined) {
        setParts.push('mute_until = ?'); params.push(settings.mute_until || null);
      }
      if (settings.notification_frequency !== undefined) {
        setParts.push('notification_frequency = ?'); params.push(settings.notification_frequency);
      }
      if (settings.show_message_preview !== undefined) {
        setParts.push('show_message_preview = ?'); params.push(settings.show_message_preview ? 1 : 0);
      }
      if (settings.badge_count_enabled !== undefined) {
        setParts.push('badge_count_enabled = ?'); params.push(settings.badge_count_enabled ? 1 : 0);
      }
      if (settings.notes !== undefined) {
        setParts.push('notes = ?'); params.push(settings.notes || '');
      }

      if (setParts.length === 0) {
        return { success: false, error: 'No updates provided' };
      }

      params.push(sessionKey);
      db.prepare('UPDATE conversation_notification_settings SET ' + setParts.join(', ') + ' WHERE session_key = ?').run(...params);
    } else {
      // INSERT new settings
      const notificationLevel = settings.notification_level || 'all';
      const soundEnabled = settings.sound_enabled !== undefined ? (settings.sound_enabled ? 1 : 0) : 1;
      const soundType = settings.sound_type || 'default';
      const desktopNotifications = settings.desktop_notifications !== undefined ? (settings.desktop_notifications ? 1 : 0) : 1;
      const quietHoursEnabled = settings.quiet_hours_enabled ? 1 : 0;
      const quietStart = settings.quiet_start || null;
      const quietEnd = settings.quiet_end || null;
      const keywordAlerts = settings.keyword_alerts ? JSON.stringify(settings.keyword_alerts) : null;
      const priorityLevel = settings.priority_level || 'normal';
      const muteUntil = settings.mute_until || null;
      const notificationFrequency = settings.notification_frequency || 'instant';
      const showMessagePreview = settings.show_message_preview !== undefined ? (settings.show_message_preview ? 1 : 0) : 1;
      const badgeCountEnabled = settings.badge_count_enabled !== undefined ? (settings.badge_count_enabled ? 1 : 0) : 1;
      const notes = settings.notes || null;

      prepare('INSERT INTO conversation_notification_settings (session_key, notification_level, sound_enabled, sound_type, desktop_notifications, quiet_hours_enabled, quiet_start, quiet_end, keyword_alerts, priority_level, mute_until, notification_frequency, show_message_preview, badge_count_enabled, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        sessionKey, notificationLevel, soundEnabled, soundType, desktopNotifications,
        quietHoursEnabled, quietStart, quietEnd, keywordAlerts, priorityLevel,
        muteUntil, notificationFrequency, showMessagePreview, badgeCountEnabled, notes
      );
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Set error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('notification-settings:delete', async (_, sessionKey: string) => {
  try {
    prepare('DELETE FROM conversation_notification_settings WHERE session_key = ?').run(sessionKey);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Delete error:', error);
    return { success: false, error: error.message };
  }
});

// Get global notification defaults
ipcMain.handle('notification-settings:global-defaults', async () => {
  try {
    const row = prepare('SELECT * FROM global_notification_defaults WHERE id = 1').get();
    return { success: true, defaults: row || null };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Get global defaults error:', error);
    return { success: false, defaults: null };
  }
});

// Update global notification defaults
ipcMain.handle('notification-settings:set-global-defaults', async (_, defaults: any) => {
  try {
    const setParts: string[] = [];
    const params: any[] = [];

    if (defaults.default_notification_level !== undefined) {
      setParts.push('default_notification_level = ?'); params.push(defaults.default_notification_level);
    }
    if (defaults.default_sound_enabled !== undefined) {
      setParts.push('default_sound_enabled = ?'); params.push(defaults.default_sound_enabled ? 1 : 0);
    }
    if (defaults.default_sound_type !== undefined) {
      setParts.push('default_sound_type = ?'); params.push(defaults.default_sound_type);
    }
    if (defaults.default_desktop_notifications !== undefined) {
      setParts.push('default_desktop_notifications = ?'); params.push(defaults.default_desktop_notifications ? 1 : 0);
    }
    if (defaults.quiet_hours_enabled !== undefined) {
      setParts.push('quiet_hours_enabled = ?'); params.push(defaults.quiet_hours_enabled ? 1 : 0);
    }
    if (defaults.quiet_start !== undefined) {
      setParts.push('quiet_start = ?'); params.push(defaults.quiet_start);
    }
    if (defaults.quiet_end !== undefined) {
      setParts.push('quiet_end = ?'); params.push(defaults.quiet_end);
    }
    if (defaults.default_priority_level !== undefined) {
      setParts.push('default_priority_level = ?'); params.push(defaults.default_priority_level);
    }
    if (defaults.do_not_disturb_enabled !== undefined) {
      setParts.push('do_not_disturb_enabled = ?'); params.push(defaults.do_not_disturb_enabled ? 1 : 0);
    }
    if (defaults.dnd_until !== undefined) {
      setParts.push('dnd_until = ?'); params.push(defaults.dnd_until || null);
    }
    if (defaults.enable_batching !== undefined) {
      setParts.push('enable_batching = ?'); params.push(defaults.enable_batching ? 1 : 0);
    }
    if (defaults.batch_interval_minutes !== undefined) {
      setParts.push('batch_interval_minutes = ?'); params.push(defaults.batch_interval_minutes);
    }

    if (setParts.length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    db.prepare('UPDATE global_notification_defaults SET ' + setParts.join(', ') + ' WHERE id = 1').run(...params);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Set global defaults error:', error);
    return { success: false, error: error.message };
  }
});

// Get effective settings (with global fallback)
ipcMain.handle('notification-settings:get-effective', async (_, sessionKey: string) => {
  try {
    const row = prepare('SELECT * FROM effective_notification_settings WHERE session_key = ?').get(sessionKey);
    return { success: true, settings: row || null };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Get effective error:', error);
    return { success: false, settings: null };
  }
});

// Quick mute conversation
ipcMain.handle('notification-settings:mute', async (_, sessionKey: string, duration?: string) => {
  try {
    let muteUntil: string | null = null;

    if (duration) {
      muteUntil = duration;
    } else {
      // Default: mute for 24 hours
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      muteUntil = tomorrow.toISOString();
    }

    // Check if settings exist
    const existing = prepare('SELECT id FROM conversation_notification_settings WHERE session_key = ?').get(sessionKey);

    if (existing) {
      prepare("UPDATE conversation_notification_settings SET mute_until = ?, notification_level = 'none' WHERE session_key = ?").run(muteUntil, sessionKey);
    } else {
      prepare("INSERT INTO conversation_notification_settings (session_key, notification_level, mute_until) VALUES (?, 'none', ?)").run(sessionKey, muteUntil);
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Mute error:', error);
    return { success: false, error: error.message };
  }
});

// Unmute conversation
ipcMain.handle('notification-settings:unmute', async (_, sessionKey: string) => {
  try {
    prepare("UPDATE conversation_notification_settings SET mute_until = NULL, notification_level = 'all' WHERE session_key = ?").run(sessionKey);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[NotificationSettings] Unmute error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rejections:log', async (_, rejection: { type: string; title: string; content?: string; reason?: string }) => {
  try {
    prepare('INSERT INTO rejected_decisions (type, title, content, reason) VALUES (?, ?, ?, ?)').run(
      rejection.type,
      rejection.title,
      rejection.content || '',
      rejection.reason || ''
    );
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Rejections] Log error:', error);
    return { success: false, error: error.message };
  }
});


// ============== ANALYTICS DATA HANDLER ==============
ipcMain.handle('analytics:getData', async (_, timeRange: string) => {
  try {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

    // Query 1: Daily task completions
    const completions = prepare(`SELECT date(updated_at/1000, 'unixepoch') as date, COUNT(*) as tasks_completed FROM tasks WHERE status = 'done' AND (cancelled IS NULL OR cancelled = 0) AND updated_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date ORDER BY date`).all();

    // Query 2: Daily task creation (as proxy for activity)
    const created = prepare(`SELECT date(created_at/1000, 'unixepoch') as date, COUNT(*) as tasks_created FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date ORDER BY date`).all();

    // Query 3: Agent activity
    const agents = prepare(`SELECT assigned_to as agent, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND assigned_to IS NOT NULL AND assigned_to != '' AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY assigned_to ORDER BY total DESC`).all();

    // Query 4: Project progress
    const projects = prepare(`SELECT project, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed, ROUND(CAST(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as completion_rate FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND project IS NOT NULL AND project != '' AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY project ORDER BY total DESC LIMIT 10`).all();

    return { success: true, completions, created, agents, projects, days };
  } catch (error: any) {
    safeLog.error('[analytics:getData] Error:', error.message);
    return { success: true, completions: [], created: [], agents: [], projects: [], days: 0 };
  }
});

ipcMain.handle('analytics:subtaskStats', async () => {
  try {
    const data = prepare(`SELECT t.id as taskId, t.title as taskTitle, COUNT(s.id) as totalSubtasks, SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completedSubtasks, ROUND(CASE WHEN COUNT(s.id) > 0 THEN CAST(SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(s.id) * 100 ELSE 0 END, 2) as completionRate FROM tasks t LEFT JOIN subtasks s ON t.id = s.task_id WHERE t.status != 'done' AND (t.cancelled IS NULL OR t.cancelled = 0) GROUP BY t.id, t.title HAVING COUNT(s.id) > 0 ORDER BY completionRate ASC`).all();
    return { success: true, data };
  } catch (error: any) {
    safeLog.error('[analytics:subtaskStats] Error:', error.message);
    return { success: true, data: [] };
  }
});

ipcMain.handle('analytics:heatmap', async (_, days: number = 30) => {
  try {
    const data = prepare(`SELECT date(timestamp / 1000, 'unixepoch') as date, CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as dayOfWeek, CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour, COUNT(*) as activityCount FROM task_activity WHERE timestamp >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date, dayOfWeek, hour ORDER BY date, hour`).all();
    return { success: true, data };
  } catch (error: any) {
    safeLog.error('[analytics:heatmap] Error:', error.message);
    return { success: true, data: [] };
  }
});

ipcMain.handle('analytics:timeTracking', async (_, projectFilter?: string) => {
  try {
    // Build query with optional project filter
    let query = `
      SELECT
        id as taskId,
        title as taskTitle,
        COALESCE(project, 'Uncategorized') as project,
        COALESCE(assigned_to, 'Unassigned') as agent,
        started_at as startTime,
        completed_at as endTime,
        CASE
          WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
            THEN completed_at - started_at
          WHEN started_at IS NOT NULL AND status = 'in-progress'
            THEN (strftime('%s','now') * 1000) - started_at
          ELSE NULL
        END as duration,
        status
      FROM tasks
      WHERE (cancelled IS NULL OR cancelled = 0)
        AND started_at IS NOT NULL
    `;

    if (projectFilter && projectFilter !== 'all') {
      query += ` AND project = ?`;
      query += ` ORDER BY started_at DESC`;
      const data = prepare(query).all(projectFilter);
      return { success: true, data };
    } else {
      query += ` ORDER BY started_at DESC`;
      const data = prepare(query).all();
      return { success: true, data };
    }
  } catch (error: any) {
    safeLog.error('[analytics:timeTracking] Error:', error.message);
    return { success: true, data: [] };
  }
});

// ============== SCREENSHOT IPC HANDLERS ==============
ipcMain.handle('screenshot:capture', async (_, outputPath: string) => {
  return new Promise((resolve) => {
    if (mainWindow) {
      mainWindow.webContents.capturePage().then((image) => {
        const pngBuffer = image.toPNG();
        fs.writeFileSync(outputPath, pngBuffer);
        resolve({ success: true, path: outputPath, size: pngBuffer.length });
      }).catch((err) => {
        resolve({ success: false, error: String(err) });
      });
    } else {
      resolve({ success: false, error: 'No main window' });
    }
  });
});

ipcMain.handle('screenshot:navigate', async (_, view: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    safeSend('navigate-to', view);
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});
// ============== FILESYSTEM IPC HANDLERS ==============
ipcMain.handle('fs:writeBase64', async (_, filePath: string, base64Data: string) => {
  try {
    const check = validateFsPath(filePath);
    if (!check.valid) {
      safeLog.error('[FS] Write blocked:', check.error);
      return { success: false, error: check.error };
    }
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(check.resolved, buffer);
    return { success: true, path: check.resolved };
  } catch (error: any) {
    safeLog.error('[FS] Write error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string, encoding?: string) => {
  try {
    const check = validateFsPath(filePath);
    if (!check.valid) {
      safeLog.error('[FS] Read blocked:', check.error);
      return { success: false, error: check.error };
    }
    const content = fs.readFileSync(check.resolved, encoding as BufferEncoding || 'utf8');
    return { success: true, content };
  } catch (error: any) {
    safeLog.error('[FS] Read error:', error);
    return { success: false, error: error.message };
  }
});

// Append to file
ipcMain.handle('fs:append', async (_, filePath: string, content: string) => {
  try {
    const check = validateFsPath(filePath);
    if (!check.valid) {
      safeLog.error('[FS] Append blocked:', check.error);
      return { success: false, error: check.error };
    }

    // Ensure directory exists
    const dir = path.dirname(check.resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(check.resolved, content);
    return { success: true, path: check.resolved };
  } catch (error: any) {
    safeLog.error('[FS] Append error:', error);
    return { success: false, error: error.message };
  }
});

// Execute SQL against froggo.db (parameterized via better-sqlite3)
ipcMain.handle('db:exec', async (_, query: string, params?: any[]) => {
  try {
    // For safety, only allow SELECT and INSERT statements from the renderer
    const queryLower = query.trim().toLowerCase();
    if (!queryLower.startsWith('select') && !queryLower.startsWith('insert')) {
      return { success: false, error: 'Only SELECT and INSERT queries are allowed from renderer' };
    }

    const stmt = prepare(query);
    const bindParams = params && params.length > 0 ? params : [];

    if (queryLower.startsWith('insert')) {
      stmt.run(...bindParams);
      return { success: true, result: [] };
    } else {
      const result = stmt.all(...bindParams);
      return { success: true, result };
    }
  } catch (error: any) {
    safeLog.error('[DB] Exec error:', error);
    return { success: false, error: error.message };
  }
});

// ============== MEDIA UPLOAD IPC HANDLERS ==============
const uploadsDir = UPLOADS_DIR;

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload media file (returns file path for scheduling)
ipcMain.handle('media:upload', async (_, fileName: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueFileName = `${timestamp}-${baseName}${ext}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    fs.writeFileSync(filePath, buffer);
    const stats = fs.statSync(filePath);
    
    safeLog.log('[Media] Uploaded:', uniqueFileName, 'size:', stats.size);
    
    return { 
      success: true, 
      path: filePath,
      fileName: uniqueFileName,
      size: stats.size 
    };
  } catch (error: any) {
    safeLog.error('[Media] Upload error:', error);
    return { success: false, error: error.message };
  }
});

// Delete media file
ipcMain.handle('media:delete', async (_, filePath: string) => {
  try {
    // Verify file is in uploads directory (security check)
    if (!filePath.startsWith(uploadsDir)) {
      return { success: false, error: 'Invalid file path' };
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      safeLog.log('[Media] Deleted:', filePath);
    }
    
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Media] Delete error:', error);
    return { success: false, error: error.message };
  }
});

// Clean up old uploads (7 days)
ipcMain.handle('media:cleanup', async () => {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
        safeLog.log('[Media] Cleaned up old file:', file);
      }
    }
    
    safeLog.log('[Media] Cleanup complete:', deletedCount, 'files deleted');
    return { success: true, deletedCount };
  } catch (error: any) {
    safeLog.error('[Media] Cleanup error:', error);
    return { success: false, error: error.message };
  }
});

// ============== LIBRARY IPC HANDLERS ==============
const libraryDir = LIBRARY_DIR;

const VALID_FILE_CATEGORIES = ['marketing', 'design', 'dev', 'research', 'finance', 'test-logs', 'content', 'social', 'other'] as const;
type FileCategory = typeof VALID_FILE_CATEGORIES[number];

function inferFileCategory(filename: string, _mimeType?: string, taskTitle?: string, assignee?: string): FileCategory {
  const ext = path.extname(filename).toLowerCase();
  const name = filename.toLowerCase();

  // Unambiguous by extension
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.sql', '.json', '.css', '.html', '.diff', '.patch'].includes(ext)) return 'dev';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.mov'].includes(ext)) return 'design';
  if (['.csv', '.xls', '.xlsx'].includes(ext)) return 'finance';
  if (['.zip', '.rar', '.7z'].includes(ext) || name.endsWith('.tar.gz')) return 'other';

  // Text-like files — use filename + task context keywords
  if (['.md', '.txt', '.pdf', '.doc', '.docx', '.draft'].includes(ext)) {
    // Normalize separators to spaces for clean word matching
    const ctx = ` ${name.replace(/[_\-./]/g, ' ')} ${(taskTitle || '').replace(/[_\-./]/g, ' ').toLowerCase()} `;
    const agent = (assignee || '').toLowerCase();

    if (/\b(finance|budget|revenue|cost|invoice|expense)\b/.test(ctx)) return 'finance';
    if (/\b(marketing|growth|tweet|campaign|engagement|follower)\b/.test(ctx) || ctx.includes('content plan')) return 'marketing';
    if (/\b(design|wireframe|mockup|figma|layout|theme|modal)\b/.test(ctx) || /\bui\b|\bux\b|\bstyle\b/.test(ctx) || agent === 'designer') return 'design';
    if (/\b(test|qa|checklist|verification|e2e|playwright|benchmark|coverage)\b/.test(ctx)) return 'test-logs';
    if (/\b(research|analysis|investigation|audit|review|study)\b/.test(ctx)) return 'research';
    if (/\b(discord|telegram|twitter|instagram|social)\b/.test(ctx) || ctx.includes('x api') || ['social-manager', 'growth-director'].includes(agent)) return 'social';
    if (/\b(implementation|refactor|migration|schema|api|fix|bug|deploy|build|lint|react|electron)\b/.test(ctx) || ['coder', 'senior-coder', 'lead-engineer'].includes(agent)) return 'dev';

    return 'content';
  }

  return 'other';
}

// Library schema migration: add project column + migrate old categories
try {
  db.exec('ALTER TABLE library ADD COLUMN project TEXT');
} catch (_e) { /* column already exists */ }
try {
  prepare("UPDATE library SET category = 'marketing' WHERE category = 'strategy'").run();
  prepare("UPDATE library SET category = 'test-logs' WHERE category = 'test'").run();
  prepare("UPDATE library SET category = 'content' WHERE category IN ('draft', 'document')").run();
} catch (_e) { /* migration already ran or no rows to update */ }

ipcMain.handle('library:list', async (_, category?: string) => {
  // Ensure library directory exists
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }

  try {
    let rawFiles: any[];
    if (category) {
      rawFiles = prepare('SELECT * FROM library WHERE category = ? ORDER BY updated_at DESC').all(category) as any[];
    } else {
      rawFiles = prepare('SELECT * FROM library ORDER BY updated_at DESC').all() as any[];
    }

    // Transform snake_case to camelCase for frontend
    const files = rawFiles.map((f: any) => {
      // Safely parse JSON fields
      let linkedTasks: string[] = [];
      let tags: string[] = [];

      try {
        linkedTasks = f.linked_tasks ? JSON.parse(f.linked_tasks) : [];
      } catch (e) {
        safeLog.warn('[library:list] Failed to parse linked_tasks for', f.id, ':', e);
      }

      try {
        tags = f.tags ? JSON.parse(f.tags) : [];
      } catch (e) {
        safeLog.warn('[library:list] Failed to parse tags for', f.id, ':', e);
      }

      const rawCat = f.category || 'other';
      const category = (VALID_FILE_CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : inferFileCategory(f.name || '');

      return {
        id: f.id || '',
        name: f.name || 'Unnamed',
        path: f.path || '',
        category,
        size: f.size || 0,
        mimeType: f.mime_type || null,
        createdAt: f.created_at || new Date().toISOString(),
        updatedAt: f.updated_at || new Date().toISOString(),
        linkedTasks,
        tags,
        project: f.project || null,
      };
    });

    safeLog.log(`[library:list] Returning ${files.length} files`);
    return { success: true, files };
  } catch (error: any) {
    safeLog.error('[library:list] Error:', error);
    return { success: true, files: [] };
  }
});

ipcMain.handle('library:upload', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'No file selected' };
  }
  
  const sourcePath = result.filePaths[0];
  const fileName = path.basename(sourcePath);
  const fileId = `file-${Date.now()}`;
  const destPath = path.join(libraryDir, fileId + '-' + fileName);
  
  // Ensure library dir exists
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }
  
  // Copy file
  fs.copyFileSync(sourcePath, destPath);
  const stats = fs.statSync(destPath);
  
  // Determine category
  const category = inferFileCategory(fileName);

  // Ensure library table exists (DDL, no user params)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      size INTEGER,
      mime_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      linked_tasks TEXT,
      tags TEXT
    )`);

    // Insert into database via parameterized query
    prepare('INSERT INTO library (id, name, path, category, size) VALUES (?, ?, ?, ?, ?)').run(
      fileId, fileName, destPath, category, stats.size
    );

    return { success: true, file: { id: fileId, name: fileName, path: destPath, category, size: stats.size } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('library:delete', async (_, fileId: string) => {
  try {
    // Get file path first
    const row = prepare('SELECT path FROM library WHERE id = ?').get(fileId) as any;
    if (row && row.path) {
      // Delete file from disk
      if (fs.existsSync(row.path)) {
        fs.unlinkSync(row.path);
      }
    }

    // Delete from database
    const info = prepare('DELETE FROM library WHERE id = ?').run(fileId);
    if (info.changes === 0) {
      return { success: false, error: 'File not found' };
    }
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Library] Delete error:', error);
    return { success: false };
  }
});

ipcMain.handle('library:link', async (_, fileId: string, taskId: string) => {
  try {
    // Get current linked tasks
    const row = prepare('SELECT linked_tasks FROM library WHERE id = ?').get(fileId) as any;
    let linkedTasks: string[] = [];
    try {
      if (row && row.linked_tasks) linkedTasks = JSON.parse(row.linked_tasks);
    } catch (err) { safeLog.debug('[LibraryLink] Failed to parse linked tasks:', err); }

    if (!linkedTasks.includes(taskId)) {
      linkedTasks.push(taskId);
    }

    prepare("UPDATE library SET linked_tasks = ?, updated_at = datetime('now') WHERE id = ?").run(
      JSON.stringify(linkedTasks), fileId
    );

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Library] Link error:', error);
    return { success: false };
  }
});

ipcMain.handle('library:view', async (_, fileId: string) => {
  try {
    // Now uses correct DB path via shared prepare() (previously had wrong path ~/Froggo/clawd/data/froggo.db)
    const file = prepare('SELECT path, mime_type, name FROM library WHERE id = ?').get(fileId) as any;
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    const filePath = file.path.replace('~', process.env.HOME || '');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist on disk' };
    }

    // For text files, read content
    const mimeType = file.mime_type || '';
    if (mimeType.includes('text/') || mimeType.includes('markdown') || mimeType.includes('json')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        success: true,
        content,
        mimeType,
        name: file.name,
        path: filePath,
        viewType: 'text'
      };
    } else if (mimeType.startsWith('image/')) {
      // For images, return base64
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      return {
        success: true,
        content: `data:${mimeType};base64,${base64}`,
        mimeType,
        name: file.name,
        path: filePath,
        viewType: 'image'
      };
    } else {
      // For other files, just return metadata
      return {
        success: true,
        mimeType,
        name: file.name,
        path: filePath,
        viewType: 'binary'
      };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('library:download', async (_, fileId: string) => {
  try {
    // Now uses correct DB path via shared prepare() (previously had wrong path ~/Froggo/clawd/data/froggo.db)
    const file = prepare('SELECT path, name FROM library WHERE id = ?').get(fileId) as any;
    if (!file) {
      return { success: false, error: 'File not found' };
    }

    const sourcePath = file.path.replace('~', process.env.HOME || '');

    // Check if file exists
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'File does not exist on disk' };
    }

    // Show save dialog
    const saveResult = await dialog.showSaveDialog({
      title: 'Save File',
      defaultPath: file.name,
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, error: 'Cancelled' };
    }

    // Copy file to chosen location
    fs.copyFileSync(sourcePath, saveResult.filePath);
    return { success: true, path: saveResult.filePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:list', async () => {
  try {
    const dbSkills = prepare(`
      SELECT as2.agent_id, as2.skill_name, as2.proficiency, as2.success_count,
             as2.failure_count, as2.last_used, as2.notes,
             ar.name as agent_name, ar.emoji as agent_emoji
      FROM agent_skills as2
      LEFT JOIN agent_registry ar ON as2.agent_id = ar.id
      ORDER BY as2.agent_id, as2.proficiency DESC
    `).all();
    return { success: true, skills: dbSkills };
  } catch (error: any) {
    safeLog.error('[skills:list] Error:', error);
    return { success: false, error: error.message, skills: [] };
  }
});

ipcMain.handle('library:update', async (_, fileId: string, updates: { category?: string; tags?: string[]; project?: string }) => {
  try {
    if (updates.category) {
      prepare('UPDATE library SET category = ?, updated_at = datetime("now") WHERE id = ?').run(updates.category, fileId);
    }
    if (updates.tags !== undefined) {
      prepare('UPDATE library SET tags = ?, updated_at = datetime("now") WHERE id = ?').run(JSON.stringify(updates.tags), fileId);
    }
    if (updates.project !== undefined) {
      prepare('UPDATE library SET project = ?, updated_at = datetime("now") WHERE id = ?').run(updates.project, fileId);
    }
    return { success: true };
  } catch (error: any) {
    safeLog.error('[library:update] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('library:uploadBuffer', async (_, data: { name: string; type: string; buffer: ArrayBuffer }) => {
  try {
    if (!fs.existsSync(libraryDir)) {
      fs.mkdirSync(libraryDir, { recursive: true });
    }
    const fileId = `file-${Date.now()}`;
    const destPath = path.join(libraryDir, fileId + '-' + data.name);
    fs.writeFileSync(destPath, Buffer.from(data.buffer));
    const stats = fs.statSync(destPath);
    const category = inferFileCategory(data.name, data.type);
    prepare('INSERT INTO library (id, name, path, category, size, mime_type) VALUES (?, ?, ?, ?, ?, ?)').run(
      fileId, data.name, destPath, category, stats.size, data.type || null
    );
    return { success: true, file: { id: fileId, name: data.name, path: destPath, category, size: stats.size } };
  } catch (error: any) {
    safeLog.error('[library:uploadBuffer] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============== SHELL IPC HANDLERS ==============
ipcMain.handle('shell:openPath', async (_, filePath: string) => {
  try {
    // Expand ~ to home directory
    const expandedPath = filePath.replace('~', process.env.HOME || '');
    
    // Check if file/directory exists
    if (!fs.existsSync(expandedPath)) {
      return { success: false, error: 'Path does not exist' };
    }
    
    // Open with default application
    const result = await shell.openPath(expandedPath);
    
    // openPath returns empty string on success, error message on failure
    if (result === '') {
      return { success: true };
    } else {
      return { success: false, error: result };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============== SEARCH IPC HANDLERS ==============
ipcMain.handle('search:local', async (_, query: string) => {
  // Shell-escape query for CLI argument (not SQL)
  const escapedQuery = query.replace(/'/g, "'\\''");

  return new Promise((resolve) => {
    // Search froggo-db for tasks, facts, and messages with JSON output
    const cmd = `froggo-db search '${escapedQuery}' --limit 20 --json`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Search] Local search error:', error);
        resolve({ success: false, results: [] });
        return;
      }
      
      try {
        // Parse JSON output (new format with messages/facts arrays)
        const data = JSON.parse(stdout);
        
        // Combine messages and facts into a single results array
        const allResults = [
          ...(data.messages || []),
          ...(data.facts || [])
        ];
        
        // Sort by relevance score (already BM25 ranked)
        allResults.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
        
        resolve({ 
          success: true, 
          results: allResults,
          stats: data.stats || { total: allResults.length, duration_ms: 0 }
        });
      } catch (parseError) {
        safeLog.error('[Search] Failed to parse JSON:', parseError);
        
        // Fallback: parse text output
        const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('===') && !l.startsWith('📊'));
        const results = lines.slice(0, 10).map((line, i) => ({
          id: `search-${i}`,
          type: 'message',
          title: line.slice(0, 50),
          text: line,
          snippet: line,
          relevance_score: 0,
        }));
        
        resolve({ success: true, results });
      }
    });
  });
});

// ============== AI CONTENT GENERATION ==============
// Load Anthropic API key from environment, key file, or openclaw config
let anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
try {
  const keyPath = path.join(os.homedir(), '.openclaw', 'anthropic.key');
  if (!anthropicApiKey && fs.existsSync(keyPath)) {
    anthropicApiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  }
} catch (err) { safeLog.debug('[AI] Failed to load Anthropic API key:', err); }
// Fallback: read from openclaw.json config
if (!anthropicApiKey) {
  try {
    const ocConfigs = [
      OPENCLAW_CONFIG,
      OPENCLAW_CONFIG_LEGACY,
    ];
    for (const cfgPath of ocConfigs) {
      if (!anthropicApiKey && fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        // Check models.providers.*.apiKey and providers.*
        const providerSources = [
          cfg.models?.providers || {},
          cfg.providers || {},
        ];
        for (const providers of providerSources) {
          for (const prov of Object.values(providers) as any[]) {
            if (prov?.apiKey?.startsWith('sk-ant')) { anthropicApiKey = prov.apiKey; break; }
            if (prov?.anthropicApiKey?.startsWith('sk-ant')) { anthropicApiKey = prov.anthropicApiKey; break; }
            if (prov?.config?.apiKey?.startsWith('sk-ant')) { anthropicApiKey = prov.config.apiKey; break; }
            if (prov?.config?.anthropicApiKey?.startsWith('sk-ant')) { anthropicApiKey = prov.config.anthropicApiKey; break; }
          }
          if (anthropicApiKey) break;
        }
        if (anthropicApiKey) break;
      }
    }
    if (anthropicApiKey) safeLog.log('[AI] Loaded API key from openclaw config');
  } catch (e) {
    safeLog.error('[AI] Failed to read openclaw config for API key:', e);
  }
}

// Load OpenAI API key from environment or config (for Whisper transcription)
let openaiApiKey = process.env.OPENAI_API_KEY || '';
try {
  const keyPath = path.join(os.homedir(), '.openclaw', 'openai.key');
  if (!openaiApiKey && fs.existsSync(keyPath)) {
    openaiApiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  }
} catch (err) { safeLog.debug('[AI] Failed to load OpenAI API key:', err); }

// Expose OpenAI API key to renderer (for Whisper transcription)
ipcMain.handle('get-openai-key', async () => {
  return openaiApiKey;
});

ipcMain.handle('ai:analyzeMessages', async (_, ids: string[]) => {
  safeLog.log('[AI:Analyze] Stub handler called for', ids?.length || 0, 'messages');
  return { success: false, error: 'Analysis not available' };
});

ipcMain.handle('ai:createDetectedTask', async (_, task: { title: string; description?: string }) => {
  try {
    // SECURITY: Use execFile with args array to prevent command injection
    // No shell escaping needed - args passed directly to process
    const args = ['task-add', task.title || ''];
    if (task.description) {
      args.push('--desc', task.description);
    }
    
    const result = await new Promise<string>((resolve, reject) => {
      execFile(FROGGO_DB_CLI, args, {
        timeout: 5000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` }
      }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[AI:Task] Error:', error.message, stderr);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
    
    safeLog.log('[AI:Task] Created task:', task.title, result.trim());
    return { success: true, result: result.trim() };
  } catch (e: any) {
    safeLog.error('[AI:Task] Error:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('ai:createDetectedEvent', async (_, event: { title: string; date: string; time?: string; duration?: string; location?: string; description?: string }) => {
  try {
    const start = event.time ? `${event.date}T${event.time}` : `${event.date}T09:00:00`;
    // Default 1h duration
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    // SECURITY: Use execFile with args array to prevent command injection
    // No shell escaping needed - args passed directly to process
    const args = [
      'calendar', 'create',
      '--title', event.title || '',
      '--start', start,
      '--end', endDate.toISOString()
    ];
    
    if (event.location) {
      args.push('--location', event.location);
    }
    
    const result = await new Promise<string>((resolve, reject) => {
      execFile('/opt/homebrew/bin/gog', args, {
        timeout: 10000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` }
      }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[AI:Event] Error:', error.message, stderr);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
    
    safeLog.log('[AI:Event] Created event:', event.title, result.trim());
    return { success: true, result: result.trim() };
  } catch (e: any) {
    safeLog.error('[AI:Event] Error:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('ai:generate-content', async (_, prompt: string, type: string, options?: { agent?: string }) => {
  safeLog.log('[AI:Generate] Called with type:', type, 'agent:', options?.agent || 'default');
  try {
    // Determine which agent to use
    const agentId = options?.agent || 'social-manager';
    
    // Create session key for this agent
    const sessionKey = `agent:${agentId}:xpanel-ai`;
    
    // Build appropriate prompt based on type
    let fullPrompt: string;
    if (type === 'ideas') {
      fullPrompt = `Generate 5 engaging X/Twitter content ideas about: ${prompt}\n\nFor each idea, provide:\n1. The main idea/angle\n2. A compelling hook/opening line\n\nReturn as JSON array: [{ "idea": "...", "hook": "..." }]`;
    } else if (type === 'chat') {
      fullPrompt = prompt;
    } else {
      fullPrompt = prompt;
    }
    
    // Escape single quotes for shell
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
    
    // Send to agent via openclaw CLI
    const response = await new Promise<string>((resolve, reject) => {
      exec(
        `openclaw agent --agent ${agentId} --message '${escapedPrompt}' --json`,
        {
          encoding: 'utf-8',
          timeout: 60000,
          env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
        },
        (error, stdout, _stderr) => {
          if (error) {
            safeLog.error('[AI:Generate] CLI error:', error.message);
            reject(error);
            return;
          }
          
          let output = stdout.trim();
          // Extract text from --json response
          try {
            const parsed = JSON.parse(output);
            const payloads = parsed?.result?.payloads;
            if (Array.isArray(payloads) && payloads.length > 0) {
              output = payloads.map((p: any) => p.text || '').join('\n').trim();
            }
            if (!output && parsed?.result?.text) output = parsed.result.text;
          } catch { /* not JSON, use raw */ }
          safeLog.log('[AI:Generate] Got response, length:', output.length);
          resolve(output);
        }
      );
    });
    
    // Parse response based on type
    if (type === 'ideas') {
      try {
        // Try to extract JSON array from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const ideas = JSON.parse(jsonMatch[0]);
          return { success: true, ideas };
        } else {
          // Fallback: parse manually
          safeLog.warn('[AI:Generate] Could not find JSON in response, using raw text');
          return { success: true, ideas: [{ idea: response, hook: '' }] };
        }
      } catch (parseError: any) {
        safeLog.error('[AI:Generate] JSON parse error:', parseError.message);
        return { success: true, ideas: [{ idea: response, hook: '' }] };
      }
    } else {
      // For chat type, return raw response
      return { success: true, response };
    }
  } catch (e: any) {
    safeLog.error('[AI:Generate] Error:', e);
    return { success: false, error: e.message };
  }
});

// ============== AI REPLY GENERATION ==============

ipcMain.handle('ai:generateReply', async (_, context: {
  threadMessages: Array<{role: string, content: string}>,
  platform?: string,
  recipientName?: string,
  subject?: string,
  tone?: 'formal' | 'casual' | 'auto',
  calendarContext?: string,
  taskContext?: string,
}) => {
  safeLog.log('[AI] Generate reply called:', { platform: context.platform, tone: context.tone, threadLen: context.threadMessages?.length });

  if (!anthropicApiKey) {
    return { success: false, error: 'No API key configured' };
  }

  const tone = context.tone || 'auto';
  const platform = context.platform || 'chat';
  const name = context.recipientName || 'there';

  // Build system prompt based on platform and tone
  let toneInstruction = '';
  if (tone === 'formal') {
    toneInstruction = 'Use a professional, formal tone. Include proper greetings and sign-offs.';
  } else if (tone === 'casual') {
    toneInstruction = 'Use a friendly, casual tone. Keep it conversational.';
  } else {
    toneInstruction = 'Match the tone of the conversation — if formal, stay formal; if casual, stay casual.';
  }

  let platformInstruction = '';
  if (platform === 'email') {
    platformInstruction = 'This is an email reply. Use appropriate email formatting with greeting and sign-off.';
  } else if (platform === 'whatsapp' || platform === 'telegram') {
    platformInstruction = 'This is a chat message. Keep it short and conversational — no formal sign-offs.';
  } else if (platform === 'discord') {
    platformInstruction = 'This is a Discord message. Keep it concise and natural.';
  }

  // Fetch calendar + task context if not provided (using parameterized queries)
  let scheduleContext = context.calendarContext || '';
  let taskCtx = context.taskContext || '';
  if (!scheduleContext) {
    try {
      const events = prepare("SELECT title, start_time FROM calendar_events WHERE start_time > datetime('now') ORDER BY start_time LIMIT 5").all() as any[];
      scheduleContext = events.map((e: any) => `${e.title} at ${e.start_time}`).join('; ');
    } catch (err) { safeLog.debug('[AIReply] Failed to load schedule context:', err); }
  }
  if (!taskCtx) {
    try {
      const tasks = prepare("SELECT title FROM tasks WHERE status='in-progress' AND (cancelled IS NULL OR cancelled=0) LIMIT 5").all() as any[];
      taskCtx = tasks.map((t: any) => t.title).join('; ');
    } catch (err) { safeLog.debug('[AIReply] Failed to load task context:', err); }
  }

  let contextBlock = '';
  if (scheduleContext) contextBlock += `\nUser's upcoming schedule: ${scheduleContext}`;
  if (taskCtx) contextBlock += `\nUser's active tasks: ${taskCtx}`;

  const systemPrompt = `You are drafting a reply on behalf of the user. Generate a helpful, contextual reply to the conversation below.

${toneInstruction}
${platformInstruction}${contextBlock}

Rules:
- Be concise and to the point
- Sound natural, not robotic
- Don't be overly eager or sycophantic
- Address the actual content of the messages
- Return ONLY the reply text, no explanations or meta-commentary`;

  const threadText = context.threadMessages
    .slice(-10)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const userPrompt = `Conversation with ${name}${context.subject ? ` (Subject: ${context.subject})` : ''}:\n\n${threadText}\n\nDraft a reply:`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      safeLog.error('[AI] Reply generation API error:', response.status, errText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const draft = data.content?.[0]?.text?.trim() || '';
    safeLog.log('[AI] Reply generated, length:', draft.length);
    return { success: true, draft };
  } catch (e: any) {
    safeLog.error('[AI] Reply generation error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============== AI ANALYSIS LOOKUP ==============

ipcMain.handle('ai:getAnalysis', async (_, id: string, platform: string) => {
  try {
    const row = prepare(
      "SELECT triage, summary, tasks, events, reply_draft, reply_needed FROM comms_ai_analysis WHERE external_id = ? AND platform = ?"
    ).get(id, platform) as any;

    if (!row) {
      return { success: true, analysis: null };
    }

    let tasks: any[] = [];
    let events: any[] = [];
    try { tasks = row.tasks ? JSON.parse(row.tasks) : []; } catch (err) { safeLog.debug('[AIAnalysis] Failed to parse tasks:', err); }
    try { events = row.events ? JSON.parse(row.events) : []; } catch (err) { safeLog.debug('[AIAnalysis] Failed to parse events:', err); }

    return {
      success: true,
      analysis: {
        triage: row.triage,
        summary: row.summary,
        tasks,
        events,
        reply_draft: row.reply_draft,
        reply_needed: !!row.reply_needed,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ============== SESSIONS IPC HANDLERS ==============
// Session list with rate limiting and caching to prevent runaway process storms
// sessions:list, sessions:send removed - renderer uses gateway.ts WebSocket directly

// Shell execution for Code Agent Dashboard, Context Control Board
ipcMain.handle('exec:run', async (_, command: string) => {
  const execAsync = promisify(exec);

  // Use the clawd workspace as default cwd for git commands
  const workDir = PROJECT_ROOT;

  const result = await secureExec(
    command,
    async (cmd: string) => {
      return await execAsync(cmd, {
        maxBuffer: 1024 * 1024,
        timeout: 30000,
        cwd: workDir,
        env: { ...process.env, PATH: `${SHELL_PATH}:${process.env.PATH || ''}` },
      });
    },
    'exec',
  );

  if (!result.success && result.blocked) {
    safeLog.warn(`[Exec] Blocked: ${result.reason}`);
  }

  return result;
});

// Shell security audit log endpoint
ipcMain.handle('exec:audit', async (_, limit?: number) => {
  return getAuditLog(limit || 100);
});

// Shell security validate endpoint (for UI preview)
ipcMain.handle('exec:validate', async (_, command: string) => {
  return validateCommand(command);
});

// ============== AGENTS API IPC HANDLERS ==============

// Return the full agent registry so the dashboard can show all configured agents
ipcMain.handle('agents:getRegistry', async () => {
  const registry = getAgentRegistry();
  const result: Record<string, { role: string; description: string; capabilities: string[]; aliases: string[]; clawdAgentId: string }> = {};
  for (const [id, entry] of Object.entries(registry)) {
    if (id === 'froggo') continue; // skip alias duplicate
    result[id] = {
      role: entry.role || 'Agent',
      description: (entry as any).description || '',
      capabilities: entry.capabilities || [],
      aliases: entry.aliases || [],
      clawdAgentId: entry.clawdAgentId || id,
    };
  }
  return result;
});

ipcMain.handle('agents:getMetrics', async () => {
  // Get active agents from database (source of truth) instead of JSON registry
  // This fixes issue where JSON had outdated IDs (lead_engineer vs senior-coder, etc.)
  let agents: string[] = [];
  try {
    const rows = prepare(`SELECT id FROM agent_registry WHERE status = 'active' ORDER BY id`).all() as any[];
    agents = rows.map(r => r.id).filter(id => id !== 'froggo'); // skip alias duplicate
  } catch (e) {
    safeLog.error('[agents:getMetrics] Failed to load agents from DB:', e);
    // Fallback to registry if DB fails
    const registry = getAgentRegistry();
    agents = Object.keys(registry).filter(id => id !== 'froggo');
  }
  
  const metrics: Record<string, any> = {};
  const metricsScriptPath = path.join(SCRIPTS_DIR, 'agent-metrics.sh');

  for (const agentId of agents) {
    try {
      const result = execSync(`"${metricsScriptPath}" "${agentId}"`, { 
        encoding: 'utf-8', 
        maxBuffer: 10 * 1024 * 1024 
      });
      const data = JSON.parse(result);
      
      const m = data.metrics || {};
      const sm = data.subtask_metrics || {};
      const am = data.activity_metrics || {};
      const trend = data.performance_trend || [];
      
      metrics[agentId] = {
        // Core metrics
        totalTasks: m.total_tasks || 0,
        completedTasks: m.completed_tasks || 0,
        inProgressTasks: m.in_progress_tasks || 0,
        reviewTasks: m.review_tasks || 0,
        blockedTasks: m.blocked_tasks || 0,
        
        // Performance indicators
        completionRate: m.completion_rate || 0, // Accuracy rate
        avgTaskTimeHours: m.avg_task_time_hours || 0,
        reviewSuccessRate: m.review_success_rate || 0,
        
        // Recent activity
        completedLast7Days: m.completed_last_7_days || 0,
        
        // Priority breakdown
        p0Tasks: m.p0_tasks || 0,
        p1Tasks: m.p1_tasks || 0,
        p2Tasks: m.p2_tasks || 0,
        p3Tasks: m.p3_tasks || 0,
        
        // Subtask metrics
        totalSubtasks: sm.total_subtasks || 0,
        completedSubtasks: sm.completed_subtasks || 0,
        subtaskCompletionRate: sm.subtask_completion_rate || 0,
        
        // Activity metrics
        totalActivities: am.total_activities || 0,
        completionActions: am.completion_actions || 0,
        blockedActions: am.blocked_actions || 0,
        progressUpdates: am.progress_updates || 0,
        lastActivityTimestamp: am.last_activity_timestamp || null,
        
        // Performance trend
        performanceTrend: trend,
        
        // Legacy compatibility
        successRate: (m.completion_rate || 0) / 100,
        avgTime: m.avg_task_time_hours ? `${m.avg_task_time_hours}h` : 'N/A',
      };
    } catch (e) {
      safeLog.error(`Failed to get metrics for ${agentId}:`, e);
      metrics[agentId] = { 
        totalTasks: 0, 
        completedTasks: 0, 
        completionRate: 0,
        avgTaskTimeHours: 0,
        successRate: 0, 
        avgTime: 'N/A' 
      };
    }
  }
  
  // Special handling for Clara (reviewer agent) - she doesn't get tasks assigned,
  // she reviews other agents' work. Calculate her metrics based on reviews performed.
  if (agents.includes('clara')) {
    try {
      const reviewMetrics = prepare(`
        SELECT 
          COUNT(*) as total_reviews,
          SUM(CASE WHEN reviewStatus = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN reviewStatus = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN reviewStatus = 'pending' THEN 1 ELSE 0 END) as pending,
          ROUND(
            CAST(SUM(CASE WHEN reviewStatus = 'approved' THEN 1 ELSE 0 END) AS FLOAT) / 
            NULLIF(SUM(CASE WHEN reviewStatus IN ('approved', 'rejected') THEN 1 ELSE 0 END), 0) * 100,
            1
          ) as approval_rate
        FROM tasks
        WHERE reviewerId = 'clara' AND reviewStatus IS NOT NULL
      `).get() as any;
      
      const recentReviews = prepare(`
        SELECT COUNT(*) as recent_reviews
        FROM tasks
        WHERE reviewerId = 'clara' 
          AND reviewStatus IN ('approved', 'rejected')
          AND updated_at > (strftime('%s','now') - 7*24*60*60) * 1000
      `).get() as any;
      
      metrics['clara'] = {
        // Clara's "tasks" are reviews
        totalTasks: reviewMetrics.total_reviews || 0,
        completedTasks: (reviewMetrics.approved || 0) + (reviewMetrics.rejected || 0),
        inProgressTasks: reviewMetrics.pending || 0,
        reviewTasks: reviewMetrics.pending || 0,
        blockedTasks: 0,
        
        // Clara's completion rate is approval rate
        completionRate: reviewMetrics.approval_rate || 0,
        avgTaskTimeHours: 0, // Not applicable for reviews
        reviewSuccessRate: reviewMetrics.approval_rate || 0,
        
        // Recent activity
        completedLast7Days: recentReviews.recent_reviews || 0,
        
        // Priority breakdown (not applicable for reviewer)
        p0Tasks: 0,
        p1Tasks: 0,
        p2Tasks: 0,
        p3Tasks: 0,
        
        // Subtask metrics (not applicable)
        totalSubtasks: 0,
        completedSubtasks: 0,
        subtaskCompletionRate: 0,
        
        // Activity metrics
        totalActivities: reviewMetrics.total_reviews || 0,
        completionActions: (reviewMetrics.approved || 0) + (reviewMetrics.rejected || 0),
        blockedActions: 0,
        progressUpdates: 0,
        lastActivityTimestamp: null,
        
        // Performance trend (not implemented for Clara yet)
        performanceTrend: [],
        
        // Legacy compatibility
        successRate: (reviewMetrics.approval_rate || 0) / 100,
        avgTime: 'N/A',
        
        // Clara-specific metrics
        claraMetrics: {
          totalReviews: reviewMetrics.total_reviews || 0,
          approved: reviewMetrics.approved || 0,
          rejected: reviewMetrics.rejected || 0,
          pending: reviewMetrics.pending || 0,
          approvalRate: reviewMetrics.approval_rate || 0,
        },
      };
    } catch (e) {
      safeLog.error('Failed to get Clara review metrics:', e);
      // Keep Clara's metrics from the script (even if they're all zeros)
    }
  }

  return metrics;
});

ipcMain.handle('agents:getDetails', async (_, agentId: string) => {
  safeLog.log(`[agents:getDetails] Called with agentId: ${agentId}`);
  debugLog(`[agents:getDetails] Called with agentId: ${agentId}`);
  const froggoDbPath = FROGGO_DB;
  
  // Agent ID aliases - some agents have multiple IDs that map to the same DB records
  const agentAliases: Record<string, string[]> = {
    main: ['main', 'froggo'],
    froggo: ['main', 'froggo'],
    coder: ['coder'],
    researcher: ['researcher'],
    writer: ['writer'],
    chief: ['chief'],
    onchain_worker: ['onchain_worker'],
  };
  const dbIds = agentAliases[agentId] || [agentId];
  const dbIdsSql = dbIds.map(id => `'${id}'`).join(',');
  
  // Each query is independently try/caught so one failure doesn't kill all data
  let taskStats = { total: 0, completed: 0 };
  let recentTasks: any[] = [];
  let skills: any[] = [];
  let brainNotes: string[] = [];
  let agentRules = 'AGENT.md not found';

  // Get task stats
  try {
    const taskStatsCmd = `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE assigned_to IN (${dbIdsSql}) AND (cancelled IS NULL OR cancelled = 0)" -json`;
    const taskStatsResult = execSync(taskStatsCmd, { encoding: 'utf-8' });
    const parsed = JSON.parse(taskStatsResult)[0] || { total: 0, completed: 0 };
    taskStats = { total: parsed.total || 0, completed: parsed.completed || 0 };
    safeLog.log(`[agents:getDetails] taskStats for ${agentId}: total=${taskStats.total}, completed=${taskStats.completed}`);
  } catch (e: any) {
    safeLog.error(`[agents:getDetails] taskStats query failed for ${agentId}:`, e.message);
  }

  // Get recent tasks
  try {
    const recentTasksCmd = `sqlite3 "${froggoDbPath}" "SELECT id, title, status, completed_at, metadata FROM tasks WHERE assigned_to IN (${dbIdsSql}) AND (cancelled IS NULL OR cancelled = 0) ORDER BY COALESCE(completed_at, updated_at) DESC LIMIT 10" -json`;
    const recentTasksResult = execSync(recentTasksCmd, { encoding: 'utf-8' });
    recentTasks = JSON.parse(recentTasksResult || '[]').map((task: any) => {
      let outcome = 'unknown';
      try {
        const metadata = task.metadata ? JSON.parse(task.metadata) : {};
        outcome = metadata.outcome || (task.status === 'done' ? 'success' : 'ongoing');
      } catch (_e) {
        outcome = task.status === 'done' ? 'success' : 'ongoing';
      }
      return { ...task, outcome, completedAt: task.completed_at };
    });
  } catch (e: any) {
    safeLog.error(`[agents:getDetails] recentTasks query failed for ${agentId}:`, e.message);
  }

  // Get skills
  try {
    const skillsCmd = `sqlite3 "${froggoDbPath}" "SELECT skill_name as name, proficiency, last_used, success_count, failure_count FROM skill_evolution ORDER BY proficiency DESC" -json`;
    const skillsResult = execSync(skillsCmd, { encoding: 'utf-8' });
    skills = JSON.parse(skillsResult || '[]').map((s: any) => ({
      name: s.name,
      proficiency: s.proficiency,
      lastUsed: s.last_used,
      successCount: s.success_count,
      failureCount: s.failure_count,
    }));
  } catch (e: any) {
    safeLog.error(`[agents:getDetails] skills query failed for ${agentId}:`, e.message);
  }

  // Get brain notes (column is 'description', not 'content')
  try {
    const brainNotesCmd = `sqlite3 "${froggoDbPath}" "SELECT description FROM learning_events WHERE outcome IN ('insight', 'pattern') ORDER BY timestamp DESC LIMIT 20" -json`;
    const brainNotesResult = execSync(brainNotesCmd, { encoding: 'utf-8' });
    brainNotes = JSON.parse(brainNotesResult || '[]').map((row: any) => row.description);
  } catch (e: any) {
    safeLog.error(`[agents:getDetails] brainNotes query failed for ${agentId}:`, e.message);
  }

  // Load AGENT.md
  try {
    const agentMdPath = path.join(PROJECT_ROOT, 'agents', agentId, 'AGENT.md');
    agentRules = fs.readFileSync(agentMdPath, 'utf-8');
  } catch (_e) {
    try {
      const altPaths = [
        path.join(PROJECT_ROOT, 'agents', agentId.toLowerCase(), 'AGENT.md'),
        path.join(PROJECT_ROOT, 'agents', agentId === 'chief' ? 'lead-engineer' : agentId, 'AGENT.md'),
        // Try all aliases (e.g. froggo -> main)
        ...dbIds.filter(id => id !== agentId).map(id => path.join(PROJECT_ROOT, 'agents', id, 'AGENT.md')),
      ];
      for (const altPath of altPaths) {
        if (fs.existsSync(altPath)) {
          agentRules = fs.readFileSync(altPath, 'utf-8');
          break;
        }
      }
    } catch (e2) {
      // Keep default message
    }
  }

  const successRate = taskStats.total > 0 ? taskStats.completed / taskStats.total : 0;

  const result = {
    success: true,
    successRate,
    avgTime: '2.5h',
    totalTasks: taskStats.total,
    successfulTasks: taskStats.completed || 0,
    failedTasks: taskStats.total - (taskStats.completed || 0),
    skills,
    recentTasks,
    brainNotes,
    agentRules,
  };
  safeLog.log(`[agents:getDetails] Returning for ${agentId}: totalTasks=${result.totalTasks}, success=${result.successfulTasks}, recentTasks=${recentTasks.length}, skills=${skills.length}`);
  debugLog(`[agents:getDetails] Returning for ${agentId}: totalTasks=${result.totalTasks}, success=${result.successfulTasks}, recentTasks=${recentTasks.length}, skills=${skills.length}, fullResult=`, JSON.stringify(result).slice(0, 500));
  return result;
});

ipcMain.handle('agents:addSkill', async (_, agentId: string, skill: string) => {
  try {
    prepare("INSERT INTO skill_evolution (skill_name, proficiency, success_count, failure_count) VALUES (?, 0.5, 0, 0) ON CONFLICT(skill_name) DO UPDATE SET updated_at = datetime('now')").run(skill);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agents:updateSkill', async (_, agentId: string, skillName: string, proficiency: number) => {
  try {
    prepare("UPDATE skill_evolution SET proficiency = ?, updated_at = datetime('now') WHERE skill_name = ?").run(proficiency, skillName);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agents:search', async (_, query: string) => {
  const froggoDbPath = FROGGO_DB;
  
  const registry = getAgentRegistry();
  const agentDefinitions: Record<string, { role: string; description: string; capabilities: string[] }> = {};
  for (const [id, entry] of Object.entries(registry)) {
    agentDefinitions[id] = { role: entry.role, description: entry.description, capabilities: entry.capabilities };
  }

  const q = query.toLowerCase();
  const results: any[] = [];

  for (const [agentId, def] of Object.entries(agentDefinitions)) {
    const searchable = `${agentId} ${def.role} ${def.description} ${def.capabilities.join(' ')}`.toLowerCase();
    if (searchable.includes(q)) {
      // Get task stats from DB
      let taskCount = 0;
      let recentTask = '';
      let status = 'idle';
      try {
        const agentEntry = registry[agentId];
        const dbIds = (agentEntry?.aliases || [agentId]).map(id => `'${id}'`).join(',');
        
        const countResult = execSync(
          `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to IN (${dbIds})" -json`,
          { encoding: 'utf-8', timeout: 3000 }
        );
        taskCount = JSON.parse(countResult)?.[0]?.cnt || 0;

        const activeResult = execSync(
          `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to IN (${dbIds}) AND status IN ('in-progress','todo')" -json`,
          { encoding: 'utf-8', timeout: 3000 }
        );
        const activeCount = JSON.parse(activeResult)?.[0]?.cnt || 0;
        status = activeCount > 0 ? 'active' : 'idle';

        const recentResult = execSync(
          `sqlite3 "${froggoDbPath}" "SELECT title FROM tasks WHERE assigned_to IN (${dbIds}) ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1" -json`,
          { encoding: 'utf-8', timeout: 3000 }
        );
        const recent = JSON.parse(recentResult || '[]');
        recentTask = recent[0]?.title || '';
      } catch (_e) {
        // DB query failed, continue with defaults
      }

      results.push({
        id: agentId,
        name: agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/_/g, ' '),
        role: def.role,
        description: def.description,
        capabilities: def.capabilities,
        taskCount,
        recentTask,
        status,
      });
    }
  }

  return { success: true, agents: results };
});

// Immediately spawn agent for a task (called by play button)
ipcMain.handle('agents:spawnForTask', async (_, taskId: string, agentId: string) => {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      exec(
        `openclaw agent --agent "${agentId}" --message "Task assigned: ${taskId}" --json`,
        {
          encoding: 'utf-8',
          timeout: 30000,
          env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve(stdout.trim());
          }
        }
      );
    });

    return { success: true, output: result };
  } catch (error: any) {
    safeLog.error('[agents:spawnForTask] Error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agents:spawnChat', async (_, agentId: string) => {
  safeLog.log(`[agents:spawnChat] Called with agentId: ${agentId}`);
  debugLog(`[agents:spawnChat] Called with agentId: ${agentId}`);
  try {
    // Use the REAL session key format from dashboard-agents system
    const sessionKey = `agent:${agentId}:dashboard`;
    
    safeLog.log(`[agents:spawnChat] Using real gateway sessionKey: ${sessionKey}`);
    debugLog(`[agents:spawnChat] Using real gateway sessionKey: ${sessionKey}`);
    
    // Verify the session exists in the gateway (the dashboard-agents system should have created it)
    // If it doesn't exist, the dashboard-agents health check will spawn it, or we spawn it here
    try {
      await new Promise<void>((resolve, reject) => {
        exec('openclaw sessions list --json', {
          timeout: 10000,
          env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
        }, (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }
          
          try {
            const sessions = JSON.parse(stdout);
            const sessionExists = sessions.sessions?.some((s: any) => s.key === sessionKey);
            
            if (!sessionExists) {
              safeLog.log(`[agents:spawnChat] Session ${sessionKey} not found, spawning...`);
              debugLog(`[agents:spawnChat] Session ${sessionKey} not found, spawning...`);
              
              // Spawn the session on-demand
              const chatRegistry = getAgentRegistry();
              const systemPrompt = chatRegistry[agentId]?.prompt || `You are the ${agentId} agent. Help the user with tasks related to your role.`;
              
              const spawnCmd = `openclaw agent --agent ${agentId} --message "${systemPrompt.replace(/"/g, '\\"')}\n\nYou are now connected to the dashboard chat. Reply with: ready" --json`;
              
              exec(spawnCmd, {
                timeout: 30000,
                env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
              }, (spawnError) => {
                if (spawnError) {
                  safeLog.error(`[agents:spawnChat] Spawn failed:`, spawnError.message);
                  reject(spawnError);
                } else {
                  safeLog.log(`[agents:spawnChat] ✅ Session ${sessionKey} spawned successfully`);
                  debugLog(`[agents:spawnChat] ✅ Session ${sessionKey} spawned successfully`);
                  resolve();
                }
              });
            } else {
              safeLog.log(`[agents:spawnChat] ✅ Session ${sessionKey} already exists`);
              debugLog(`[agents:spawnChat] ✅ Session ${sessionKey} already exists`);
              resolve();
            }
          } catch (parseError) {
            reject(parseError);
          }
        });
      });
    } catch (checkError: any) {
      safeLog.warn(`[agents:spawnChat] Session check failed, continuing anyway:`, checkError.message);
      debugLog(`[agents:spawnChat] Session check failed:`, checkError.message);
    }
    
    return { success: true, sessionKey };
  } catch (error: any) {
    safeLog.error(`Failed to spawn chat for ${agentId}:`, error);
    debugLog(`Failed to spawn chat for ${agentId}:`, error.message, error.stack);
    return { success: false, error: error.message || 'Failed to spawn chat session' };
  }
});

ipcMain.handle('agents:chat', async (_, sessionKey: string, message: string) => {
  safeLog.log(`[agents:chat] Called with sessionKey: ${sessionKey}, message length: ${message.length}`);
  debugLog(`[agents:chat] Called with sessionKey: ${sessionKey}, message length: ${message.length}`);
  try {
    // Extract agentId from sessionKey (format: agent:agentId:dashboard)
    const agentId = sessionKey.split(':')[1];
    
    if (!agentId) {
      return { success: false, error: `Invalid sessionKey format: ${sessionKey}` };
    }
    
    // Send message directly to the gateway session via CLI
    // The gateway maintains the conversation history, so we just send the user's message
    const escapedMsg = message.replace(/'/g, "'\\''");
    
    let response: string;
    
    try {
      const cliResult = await new Promise<string>((resolve, reject) => {
        exec(
          `openclaw agent --agent ${agentId} --message '${escapedMsg}' --json`,
          { encoding: 'utf-8', timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(stderr || error.message));
            } else {
              resolve(stdout.trim());
            }
          }
        );
      });
      // Extract text from JSON response
      let extracted = cliResult || '';
      try {
        const parsed = JSON.parse(extracted);
        const payloads = parsed?.result?.payloads;
        if (Array.isArray(payloads) && payloads.length > 0) {
          extracted = payloads.map((p: any) => p.text || '').join('\n').trim();
        }
        if (!extracted && parsed?.result?.text) extracted = parsed.result.text;
      } catch {
        // Not JSON — use raw output
      }
      response = extracted || 'No response from agent';
      safeLog.log(`[agents:chat] CLI success, response length: ${response.length}`);
      debugLog(`[agents:chat] CLI success, response length: ${response.length}, preview: ${response.slice(0, 200)}`);
    } catch (cliErr: any) {
      safeLog.error(`[agents:chat] CLI agent failed: ${cliErr.message}`);
      debugLog(`[agents:chat] CLI agent error:`, cliErr.message, cliErr.stack);
      
      // No fallback - require gateway to be running
      // The gateway manages conversation history, so we can't do direct API calls
      response = `⚠️ Agent unavailable: ${cliErr.message}. Ensure openclaw gateway is running and the agent session is active.`;
    }
    
    return { success: true, response };
  } catch (error: any) {
    safeLog.error('Agent chat error:', error);
    return { success: false, error: error.message || 'Unknown error', response: `❌ Error: ${error.message || 'Unknown error'}` };
  }
});

// ============== AGENT CREATION (full onboarding) ==============
ipcMain.handle('agents:create', async (_, config: { id: string; name: string; role: string; emoji: string; color: string; personality: string; voice?: string }) => {
  const script = path.join(SCRIPTS_DIR, 'agent-onboard-full.sh');

  // Sanitize inputs — shell-safe single-quote escaping
  const esc = (s: string) => s.replace(/'/g, "'\\''");
  const args = [config.id, config.name, config.role, config.emoji, config.color, config.personality, config.voice || 'Puck']
    .map(a => `'${esc(a)}'`).join(' ');

  safeLog.log(`[agents:create] Creating agent: ${config.id} (${config.name})`);

  return new Promise((resolve) => {
    exec(
      `bash ${script} ${args}`,
      {
        encoding: 'utf-8',
        timeout: 120000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          safeLog.error(`[agents:create] Failed: ${error.message}`);
          resolve({ success: false, error: error.message, output: stdout || '', stderr: stderr || '' });
        } else {
          safeLog.log(`[agents:create] Success for ${config.id}`);
          resolve({ success: true, output: stdout || '' });
        }
      }
    );
  });
});

// ============== TOKEN TRACKING IPC HANDLERS ==============
ipcMain.handle('tokens:summary', async (_, args?: { agent?: string; period?: string }) => {
  try {
    const sdb = getSessionsDb();
    if (!sdb) {
      return { error: 'sessions.db not found', by_agent: [] };
    }

    // Calculate time range based on period
    const now = Date.now();
    let minTimestamp = 0;
    if (args?.period === 'day') {
      minTimestamp = now - (24 * 60 * 60 * 1000);
    } else if (args?.period === 'week') {
      minTimestamp = now - (7 * 24 * 60 * 60 * 1000);
    } else if (args?.period === 'month') {
      minTimestamp = now - (30 * 24 * 60 * 60 * 1000);
    }

    // Build parameterized query
    let query = 'SELECT agent_id, model, input_tokens, output_tokens, total_tokens, created_at FROM sessions';
    const params: any[] = [];
    const whereClauses: string[] = [];
    if (minTimestamp > 0) { whereClauses.push('created_at >= ?'); params.push(minTimestamp); }
    if (args?.agent) { whereClauses.push('agent_id = ?'); params.push(args.agent); }
    if (whereClauses.length) query += ' WHERE ' + whereClauses.join(' AND ');

    const rows = sdb.prepare(query).all(...params) as any[];

    // Model pricing (input/output per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
      'claude-opus-4': { input: 15.0, output: 75.0 },
      'gemini-2.0-flash-exp': { input: 0.0, output: 0.0 },
      'o1-preview': { input: 15.0, output: 60.0 },
      'o1-mini': { input: 3.0, output: 12.0 },
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
    };

    // Aggregate by agent
    const agentStats = new Map<string, { input: number; output: number; total: number; cost: number; calls: number }>();
    for (const row of rows) {
      const agent = row.agent_id || 'unknown';
      const inputTokens = row.input_tokens || 0;
      const outputTokens = row.output_tokens || 0;
      const totalTokens = row.total_tokens || 0;

      // Calculate cost based on model
      const modelKey = row.model || 'claude-sonnet-4-5';
      const modelPricing = pricing[modelKey] || pricing['claude-sonnet-4-5'];
      const cost = (inputTokens / 1000000) * modelPricing.input + (outputTokens / 1000000) * modelPricing.output;

      const stats = agentStats.get(agent) || { input: 0, output: 0, total: 0, cost: 0, calls: 0 };
      stats.input += inputTokens;
      stats.output += outputTokens;
      stats.total += totalTokens;
      stats.cost += cost;
      stats.calls += 1;
      agentStats.set(agent, stats);
    }

    // Convert to response format
    const by_agent = Array.from(agentStats.entries()).map(([agent, stats]) => ({
      agent,
      total_input: stats.input,
      total_output: stats.output,
      total_all: stats.total,
      total_cost: stats.cost,
      calls: stats.calls,
    })).sort((a, b) => b.total_all - a.total_all);

    return { by_agent, period: args?.period || 'all' };
  } catch (err: any) {
    return { error: err.message, by_agent: [] };
  }
});

ipcMain.handle('tokens:log', async (_, args?: { agent?: string; limit?: number; since?: number }) => {
  try {
    const sdb = getSessionsDb();
    if (!sdb) {
      return { error: 'sessions.db not found', entries: [] };
    }

    const limit = args?.limit || 100;
    const since = args?.since || 0;

    let query = 'SELECT session_id, agent_id, model, input_tokens, output_tokens, total_tokens, created_at, updated_at FROM sessions';
    const params: any[] = [];
    const whereClauses: string[] = [];
    if (args?.agent) { whereClauses.push('agent_id = ?'); params.push(args.agent); }
    if (since > 0) { whereClauses.push('created_at >= ?'); params.push(since); }
    if (whereClauses.length > 0) query += ' WHERE ' + whereClauses.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = sdb.prepare(query).all(...params) as any[];

    // Transform to expected format
    const entries = rows.map(row => ({
      id: row.session_id,
      timestamp: row.created_at,
      agent: row.agent_id || 'unknown',
      session_id: row.session_id,
      model: row.model || 'unknown',
      input_tokens: row.input_tokens || 0,
      output_tokens: row.output_tokens || 0,
      total_tokens: row.total_tokens || 0,
    }));

    return { entries };
  } catch (err: any) {
    return { error: err.message, entries: [] };
  }
});

ipcMain.handle('tokens:budget', async (_, agent: string) => {
  try {
    // Get budget settings from froggo.db
    const budgetRow = prepare(`SELECT daily_token_limit, alert_threshold, hard_limit FROM token_budgets WHERE agent_id = ?`).get(agent) as any;
    if (!budgetRow) {
      return {
        agent,
        daily_limit: 0,
        used_today: 0,
        remaining: 0,
        percentage_used: 0,
        percent_used: 0,
        alert_threshold: 0.9,
        over_budget: false,
        hard_limit: false,
      };
    }

    // Get today's usage from gateway sessions.db
    const startOfDay = new Date().setHours(0, 0, 0, 0);

    let usedToday = 0;
    const sdb = getSessionsDb();
    if (sdb) {
      try {
        const usageRow = sdb.prepare('SELECT SUM(total_tokens) as total FROM sessions WHERE agent_id = ? AND created_at >= ?').get(agent, startOfDay) as any;
        usedToday = usageRow?.total || 0;
      } catch { usedToday = 0; }
    }

    const dailyLimit = budgetRow.daily_token_limit || 0;
    const remaining = Math.max(0, dailyLimit - usedToday);
    const percentageUsed = dailyLimit > 0 ? usedToday / dailyLimit : 0;
    const alertThreshold = budgetRow.alert_threshold || 0.9;
    const overBudget = usedToday > dailyLimit && budgetRow.hard_limit === 1;

    return {
      agent,
      daily_limit: dailyLimit,
      used_today: usedToday,
      remaining,
      percentage_used: percentageUsed,
      percent_used: percentageUsed,
      alert_threshold: alertThreshold,
      over_budget: overBudget,
      hard_limit: budgetRow.hard_limit === 1,
    };
  } catch (err: any) {
    return { error: err.message };
  }
});

// ============== GOVERNANCE/PERFORMANCE IPC HANDLERS ==============
ipcMain.handle('get-performance-report', async (_, args?: { days?: number }) => {
  try {
    const days = args?.days || 30;
    const result = execSync(
      `${FROGGO_DB_CLI} performance-report --days ${days} --json`,
      {
        encoding: 'utf-8',
        timeout: 10000,
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
      }
    );
    return JSON.parse(result);
  } catch (err: any) {
    return { error: err.message, agents: [] };
  }
});

ipcMain.handle('get-agent-audit', async (_, args: { agentId: string; days?: number }) => {
  try {
    const days = args.days || 30;
    const result = execSync(
      `${FROGGO_DB_CLI} agent-audit ${args.agentId} --days ${days} --json`,
      {
        encoding: 'utf-8',
        timeout: 10000,
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
      }
    );
    return JSON.parse(result);
  } catch (err: any) {
    return { error: err.message, timeline: [] };
  }
});

// ============== DM FEED & CIRCUIT BREAKER IPC HANDLERS ==============
ipcMain.handle('get-dm-history', async (_, args?: { limit?: number; agent?: string }) => {
  try {
    const limit = args?.limit || 50;
    // Show all messages including expired ones (users want to see agent communication history)
    const rows = prepare('SELECT id, correlation_id, from_agent, to_agent, message_type, subject, body, status, created_at, read_at FROM agent_messages ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows;
  } catch (e: any) {
    safeLog.error('get-dm-history error:', e);
    return [];
  }
});

ipcMain.handle('get-circuit-status', async () => {
  try {
    const stateFile = path.join(os.homedir(), '.openclaw', 'dispatcher-state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    return state.circuit_breakers || {};
  } catch (_e) {
    return {};
  }
});

// Index for faster message queries
try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_session_channel ON messages(session_key, channel)'); } catch (_e) { /* table may not exist yet */ }

// ============== CHAT MESSAGES IPC HANDLERS (froggo-db backed) ==============
ipcMain.handle('chat:saveMessage', async (_, msg: { role: string; content: string; timestamp: number; sessionKey?: string; channel?: string }) => {
  const session = msg.sessionKey || 'dashboard';
  const channel = msg.channel || 'dashboard';
  const ts = new Date(msg.timestamp).toISOString();
  try {
    prepare('INSERT INTO messages (timestamp, session_key, channel, role, content) VALUES (?, ?, ?, ?, ?)').run(ts, session, channel, msg.role, msg.content);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('chat:loadMessages', async (_, limit: number = 50, sessionKey?: string, channel?: string) => {
  const session = sessionKey || 'dashboard';
  const ch = channel || 'dashboard';
  try {
    const rows = prepare('SELECT id, timestamp, role, content FROM messages WHERE session_key = ? AND channel = ? ORDER BY timestamp DESC LIMIT ?').all(session, ch, limit) as any[];
    const messages = rows.reverse().map((r: any) => ({
      id: `db-${r.id}`,
      role: r.role,
      content: r.content,
      timestamp: new Date(r.timestamp).getTime(),
    }));
    return { success: true, messages };
  } catch {
    return { success: true, messages: [] };
  }
});

ipcMain.handle('chat:clearMessages', async (_, sessionKey?: string, channel?: string) => {
  const session = sessionKey || 'dashboard';
  const ch = channel || 'dashboard';
  try {
    prepare('DELETE FROM messages WHERE session_key = ? AND channel = ?').run(session, ch);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Chat] clearMessages error:', error.message);
    return { success: false, error: error.message };
  }
});

// Generate AI-powered suggested replies based on conversation context
ipcMain.handle('chat:suggestReplies', async (_, context: { role: string; content: string }[]) => {
  return new Promise((resolve) => {
    // Extract last N messages for context (up to 10)
    const recentMessages = context.slice(-10);
    
    // Build context string for the AI
    const conversationContext = recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    
    // Create prompt for generating suggestions
    const prompt = `Based on this conversation, suggest 2-3 brief, contextually appropriate reply options (each under 15 words). Provide ONLY the suggestions, one per line, no numbering or explanations.

Conversation:
${conversationContext}

Suggestions:`;

    // Use claude CLI in non-interactive mode
    const claudeCmd = `${CLAUDE_CLI} --print "${prompt.replace(/"/g, '\\"')}"`;
    
    safeLog.log('[SuggestedReplies] Generating suggestions...');
    
    exec(claudeCmd, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[SuggestedReplies] Error:', error.message);
        safeLog.error('[SuggestedReplies] stderr:', stderr);
        resolve({ 
          success: false, 
          error: 'Failed to generate suggestions',
          suggestions: [] 
        });
        return;
      }
      
      try {
        // Parse the output - expect one suggestion per line
        const suggestions = stdout
          .trim()
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0 && s.length < 200) // Reasonable length filter
          .slice(0, 3); // Max 3 suggestions
        
        safeLog.log('[SuggestedReplies] Generated', suggestions.length, 'suggestions');
        
        if (suggestions.length === 0) {
          resolve({
            success: false,
            error: 'No valid suggestions generated',
            suggestions: []
          });
        } else {
          resolve({
            success: true,
            suggestions
          });
        }
      } catch (parseError: any) {
        safeLog.error('[SuggestedReplies] Parse error:', parseError.message);
        resolve({
          success: false,
          error: 'Failed to parse suggestions',
          suggestions: []
        });
      }
    });
  });
});

// ============== STARRED MESSAGES ==============

// Star a message
ipcMain.handle('starred:star', async (_, messageId: number, note?: string, category?: string) => {
  const noteArg = note ? `--note "${note.replace(/"/g, '\\"')}"` : '';
  const catArg = category ? `--category "${category}"` : '';
  const cmd = `froggo-db star-message ${messageId} ${noteArg} ${catArg}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Starred] Star error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message });
      } else {
        safeLog.log('[Starred] Message starred:', messageId);
        resolve({ success: true });
      }
    });
  });
});

// Unstar a message
ipcMain.handle('starred:unstar', async (_, identifier: number) => {
  const cmd = `froggo-db unstar-message ${identifier}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Starred] Unstar error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message });
      } else {
        safeLog.log('[Starred] Message unstarred:', identifier);
        resolve({ success: true });
      }
    });
  });
});

// List starred messages
ipcMain.handle('starred:list', async (_, options?: { category?: string; sessionKey?: string; limit?: number }) => {
  const catArg = options?.category ? `--category "${options.category}"` : '';
  const sessionArg = options?.sessionKey ? `--session "${options.sessionKey}"` : '';
  const limitArg = options?.limit ? `--limit ${options.limit}` : '';
  const cmd = `froggo-db starred-list ${catArg} ${sessionArg} ${limitArg} --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Starred] List error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message, starred: [] });
      } else {
        try {
          const starred = JSON.parse(stdout);
          resolve({ success: true, starred });
        } catch (e: any) {
          safeLog.error('[Starred] Parse error:', e.message);
          resolve({ success: false, error: e.message, starred: [] });
        }
      }
    });
  });
});

// Search starred messages
ipcMain.handle('starred:search', async (_, query: string, limit?: number) => {
  const limitArg = limit ? `--limit ${limit}` : '';
  const cmd = `froggo-db starred-search "${query.replace(/"/g, '\\"')}" ${limitArg} --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Starred] Search error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message, results: [] });
      } else {
        try {
          const results = JSON.parse(stdout);
          resolve({ success: true, results });
        } catch (e: any) {
          safeLog.error('[Starred] Parse error:', e.message);
          resolve({ success: false, error: e.message, results: [] });
        }
      }
    });
  });
});

// Get starred stats
ipcMain.handle('starred:stats', async () => {
  const cmd = `sqlite3 "${FROGGO_DB}" "SELECT COUNT(*) as total FROM starred_messages; SELECT category, COUNT(*) as count FROM starred_messages GROUP BY category;"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, stats: { total: 0, byCategory: [] } });
      } else {
        const lines = stdout.trim().split('\n');
        const total = parseInt(lines[0]) || 0;
        resolve({ success: true, stats: { total } });
      }
    });
  });
});

// Check if a message is starred
ipcMain.handle('starred:check', async (_, messageId: number) => {
  const cmd = `sqlite3 "${FROGGO_DB}" "SELECT id FROM starred_messages WHERE message_id=${messageId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 2000 }, (error, stdout) => {
      const isStarred = !error && stdout.trim().length > 0;
      resolve({ success: true, isStarred });
    });
  });
});

// ============== SECURITY IPC HANDLERS ==============

// Initialize security database using better-sqlite3
function initSecurityDB() {
  const secDb = getSecurityDb();
  secDb.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service TEXT NOT NULL,
      key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      finding TEXT NOT NULL,
      details TEXT NOT NULL,
      recommendation TEXT,
      status TEXT DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      dismissed INTEGER DEFAULT 0
    );
  `);
}

// Ensure DB exists
initSecurityDB();

// List API keys
ipcMain.handle('security:listKeys', async () => {
  try {
    const secDb = getSecurityDb();
    const keys = secDb.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all();
    return { success: true, keys };
  } catch (error: any) {
    safeLog.error('[Security] List keys error:', error);
    return { success: false, keys: [], error: error.message };
  }
});

// Add API key
ipcMain.handle('security:addKey', async (_, key: { name: string; service: string; key: string }) => {
  try {
    const secDb = getSecurityDb();
    const id = `key-${Date.now()}`;
    const now = new Date().toISOString();
    secDb.prepare('INSERT INTO api_keys (id, name, service, key, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id, key.name, key.service, key.key, now
    );
    return { success: true, id };
  } catch (error: any) {
    safeLog.error('[Security] Add key error:', error);
    return { success: false, error: error.message };
  }
});

// Delete API key
ipcMain.handle('security:deleteKey', async (_, keyId: string) => {
  try {
    const secDb = getSecurityDb();
    secDb.prepare('DELETE FROM api_keys WHERE id = ?').run(keyId);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Security] Delete key error:', error);
    return { success: false, error: error.message };
  }
});

// List audit logs
ipcMain.handle('security:listAuditLogs', async () => {
  try {
    const secDb = getSecurityDb();
    const logs = secDb.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
    return { success: true, logs };
  } catch (error: any) {
    safeLog.error('[Security] List audit logs error:', error);
    return { success: false, logs: [], error: error.message };
  }
});

// Update audit log status
ipcMain.handle('security:updateAuditLog', async (_, logId: string, updates: { status?: string }) => {
  try {
    if (!updates.status) return { success: false, error: 'No updates provided' };
    const secDb = getSecurityDb();
    secDb.prepare('UPDATE audit_logs SET status = ? WHERE id = ?').run(updates.status, logId);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Security] Update audit log error:', error);
    return { success: false, error: error.message };
  }
});

// List security alerts
ipcMain.handle('security:listAlerts', async () => {
  try {
    const secDb = getSecurityDb();
    const alerts = secDb.prepare('SELECT * FROM security_alerts WHERE dismissed = 0 ORDER BY timestamp DESC LIMIT 20').all();
    return { success: true, alerts };
  } catch (error: any) {
    safeLog.error('[Security] List alerts error:', error);
    return { success: false, alerts: [], error: error.message };
  }
});

// Dismiss alert
ipcMain.handle('security:dismissAlert', async (_, alertId: string) => {
  try {
    const secDb = getSecurityDb();
    secDb.prepare('UPDATE security_alerts SET dismissed = 1 WHERE id = ?').run(alertId);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Security] Dismiss alert error:', error);
    return { success: false, error: error.message };
  }
});

// Run AI security audit
ipcMain.handle('security:runAudit', async () => {
  try {
    safeLog.log('[Security] Running AI security audit...');
    
    // Call security audit script
    const scriptPath = path.join(SCRIPTS_DIR, 'security-audit.sh');
    const result = execSync(`bash "${scriptPath}"`, { 
      encoding: 'utf-8', 
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000 // 60s timeout
    });
    
    const output = JSON.parse(result);
    
    // Store findings in database using parameterized queries
    const secDb = getSecurityDb();
    const now = new Date().toISOString();
    const insertFinding = secDb.prepare(
      "INSERT INTO audit_logs (id, timestamp, severity, category, finding, details, recommendation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')"
    );
    for (const finding of output.findings || []) {
      const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      insertFinding.run(id, now, finding.severity, finding.category, finding.finding, finding.details, finding.recommendation || '');
    }

    // Store alerts if any critical/high issues
    const insertAlert = secDb.prepare(
      'INSERT INTO security_alerts (id, timestamp, severity, message, source, dismissed) VALUES (?, ?, ?, ?, ?, 0)'
    );
    for (const alert of output.alerts || []) {
      const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      insertAlert.run(id, now, alert.severity, alert.message, alert.source);
    }
    
    return {
      success: true,
      findings: output.findings || [],
      alerts: output.alerts || [],
      summary: output.summary || 'Audit complete'
    };
  } catch (error: any) {
    safeLog.error('[Security] Run audit error:', error);
    return { 
      success: false, 
      error: error.message,
      findings: [],
      alerts: []
    };
  }
});

// ============== EXPORT & BACKUP HANDLERS ==============

// Export tasks to CSV or JSON
ipcMain.handle('export:tasks', async (_, options: { format: 'json' | 'csv'; filters?: any }) => {
  try {
    safeLog.log('[Export] Exporting tasks with format:', options.format);
    const filepath = await exportBackupService.exportTasks(options);
    return { success: true, filepath };
  } catch (error: any) {
    safeLog.error('[Export] Task export error:', error);
    return { success: false, error: error.message };
  }
});

// Export agent logs
ipcMain.handle('export:agentLogs', async (_, options: { format: 'json' | 'csv'; filters?: any }) => {
  try {
    safeLog.log('[Export] Exporting agent logs');
    const filepath = await exportBackupService.exportAgentLogs(options);
    return { success: true, filepath };
  } catch (error: any) {
    safeLog.error('[Export] Agent logs export error:', error);
    return { success: false, error: error.message };
  }
});

// Export chat history
ipcMain.handle('export:chatHistory', async (_, options: { format: 'json' | 'csv'; filters?: any }) => {
  try {
    safeLog.log('[Export] Exporting chat history');
    const filepath = await exportBackupService.exportChatHistory(options);
    return { success: true, filepath };
  } catch (error: any) {
    safeLog.error('[Export] Chat history export error:', error);
    return { success: false, error: error.message };
  }
});

// Create full database backup
ipcMain.handle('backup:create', async (_, options?: { includeAttachments?: boolean }) => {
  try {
    safeLog.log('[Backup] Creating database backup');
    const filepath = await exportBackupService.createBackup(options);
    return { success: true, filepath };
  } catch (error: any) {
    safeLog.error('[Backup] Create backup error:', error);
    return { success: false, error: error.message };
  }
});

// Restore from backup
ipcMain.handle('backup:restore', async (_, backupPath: string) => {
  try {
    safeLog.log('[Backup] Restoring from:', backupPath);
    await exportBackupService.restoreBackup(backupPath);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Backup] Restore error:', error);
    return { success: false, error: error.message };
  }
});

// List available backups
ipcMain.handle('backup:list', async () => {
  try {
    const backups = await exportBackupService.listBackups();
    return { success: true, backups };
  } catch (error: any) {
    safeLog.error('[Backup] List backups error:', error);
    return { success: false, backups: [], error: error.message };
  }
});

// Cleanup old backups
ipcMain.handle('backup:cleanup', async (_, keepCount: number) => {
  try {
    safeLog.log('[Backup] Cleaning up old backups, keeping:', keepCount);
    const deletedCount = await exportBackupService.cleanupOldBackups(keepCount);
    return { success: true, deletedCount };
  } catch (error: any) {
    safeLog.error('[Backup] Cleanup error:', error);
    return { success: false, error: error.message };
  }
});

// Import tasks from JSON
ipcMain.handle('import:tasks', async (_, filepath: string) => {
  try {
    safeLog.log('[Import] Importing tasks from:', filepath);
    const result = await exportBackupService.importTasks(filepath);
    return { success: true, ...result };
  } catch (error: any) {
    safeLog.error('[Import] Import error:', error);
    return { success: false, error: error.message };
  }
});

// Get export/backup statistics
ipcMain.handle('exportBackup:stats', async () => {
  try {
    const stats = await exportBackupService.getStats();
    return { success: true, stats };
  } catch (error: any) {
    safeLog.error('[ExportBackup] Stats error:', error);
    return { success: false, stats: null, error: error.message };
  }
});

// Get dashboard agent sessions status
ipcMain.handle('dashboardAgents:status', async () => {
  try {
    const status = getDashboardAgentsStatus();
    return { success: true, agents: status };
  } catch (error: any) {
    safeLog.error('[DashboardAgents] Status error:', error);
    return { success: false, agents: [], error: error.message };
  }
});

// ============== HR REPORTS ==============
ipcMain.handle('hrReports:list', async () => {
  try {
    const reportsDir = path.join(REPORTS_DIR, 'hr');
    if (!fs.existsSync(reportsDir)) {
      return { success: true, reports: [] };
    }
    const files = fs.readdirSync(reportsDir);
    const reports = files
      .filter(f => f.endsWith('.md') && f !== 'README.md')
      .map(f => {
        const filePath = path.join(reportsDir, f);
        const stat = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          size: stat.size,
          createdAt: stat.birthtime.getTime(),
          modifiedAt: stat.mtime.getTime(),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Newest first
    return { success: true, reports };
  } catch (error: any) {
    safeLog.error('[HRReports] List error:', error);
    return { success: false, reports: [], error: error.message };
  }
});

ipcMain.handle('hrReports:read', async (_, filename: string) => {
  try {
    const reportsDir = path.join(REPORTS_DIR, 'hr');
    const filePath = path.join(reportsDir, path.basename(filename)); // Security: basename only
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Report not found' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    safeLog.error('[HRReports] Read error:', error);
    return { success: false, error: error.message };
  }
});
// ============== FINANCE MODULE ==============
// All finance:* handlers extracted to electron/finance-service.ts
// Only financeAgent:* handlers remain here (they depend on the agent bridge singleton)

// ── Finance Agent Communication ──

ipcMain.handle('financeAgent:sendMessage', async (_, message: string, context?: any) => {
  try {
    safeLog.log('[FinanceAgent] Sending message to Finance Manager:', message.substring(0, 100));
    const bridge = getFinanceAgentBridge();
    const response = await bridge.sendMessage(message, context);
    return response;
  } catch (error: any) {
    safeLog.error('[FinanceAgent] Send message error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('financeAgent:getChatHistory', async () => {
  try {
    const bridge = getFinanceAgentBridge();
    const history = bridge.getChatHistory();
    return { success: true, messages: history };
  } catch (error: any) {
    safeLog.error('[FinanceAgent] Get chat history error:', error.message);
    return { success: false, messages: [], error: error.message };
  }
});

ipcMain.handle('financeAgent:clearHistory', async () => {
  try {
    const bridge = getFinanceAgentBridge();
    await bridge.clearChatHistory();
    return { success: true };
  } catch (error: any) {
    safeLog.error('[FinanceAgent] Clear history error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('financeAgent:triggerAnalysis', async (_, analysisType?: 'csv_upload' | 'manual') => {
  try {
    safeLog.log('[FinanceAgent] Triggering analysis:', analysisType || 'manual');
    const bridge = getFinanceAgentBridge();
    const response = await bridge.triggerAnalysis(analysisType);
    return response;
  } catch (error: any) {
    safeLog.error('[FinanceAgent] Trigger analysis error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('financeAgent:getStatus', async () => {
  try {
    const bridge = getFinanceAgentBridge();
    const status = bridge.getStatus();
    return { success: true, status };
  } catch (error: any) {
    safeLog.error('[FinanceAgent] Get status error:', error.message);
    return { success: false, error: error.message };
  }
});

// ============== FLOATING TOOLBAR HANDLERS ==============

ipcMain.handle('toolbar:popOut', async (_, data?: { x?: number; y?: number; width?: number; height?: number }) => {
  try {
    // Close existing floating window if any
    if (floatingToolbarWindow && !floatingToolbarWindow.isDestroyed()) {
      floatingToolbarWindow.close();
      floatingToolbarWindow = null;
    }

    // Load saved position only (not size — size is fixed)
    const configPath = path.join(os.homedir(), 'froggo', 'config', 'floating-toolbar.json');
    let savedPos: { x?: number; y?: number } = {};
    try {
      if (fs.existsSync(configPath)) {
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        savedPos = { x: saved.x, y: saved.y };
      }
    } catch { /* ignore */ }

    // Get current screen where main window is
    const currentDisplay = mainWindow
      ? screen.getDisplayNearestPoint(mainWindow.getBounds())
      : screen.getPrimaryDisplay();

    const { width: screenWidth, height: screenHeight } = currentDisplay.workArea;

    // Fixed size — window is always tall enough to show panels (transparent above pill)
    const TOOLBAR_W = 700;
    const TOOLBAR_H = 520;
    const windowX = data?.x ?? savedPos.x ?? (screenWidth - TOOLBAR_W - 20);
    const windowY = data?.y ?? savedPos.y ?? (screenHeight - TOOLBAR_H - 40);

    // Create floating toolbar window
    floatingToolbarWindow = new BrowserWindow({
      width: TOOLBAR_W,
      height: TOOLBAR_H,
      x: windowX,
      y: windowY,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Transparent areas pass through mouse events; renderer toggles this on hover
    floatingToolbarWindow.on('ready-to-show', () => {
      if (floatingToolbarWindow && !floatingToolbarWindow.isDestroyed()) {
        floatingToolbarWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    });

    // Load the toolbar URL
    const toolbarUrl = isDev
      ? 'http://localhost:5173/#/floating-toolbar'
      : `file://${path.join(__dirname, '../dist/index.html')}#/floating-toolbar`;

    floatingToolbarWindow.loadURL(toolbarUrl);

    // Save position on move
    const savePosition = () => {
      if (!floatingToolbarWindow || floatingToolbarWindow.isDestroyed()) return;
      const b = floatingToolbarWindow.getBounds();
      try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({ x: b.x, y: b.y }, null, 2), 'utf-8');
      } catch { /* ignore */ }
    };

    floatingToolbarWindow.on('moved', savePosition);

    // Clean up when window is closed
    floatingToolbarWindow.on('closed', () => {
      savePosition(); // Save final position before closing
      floatingToolbarWindow = null;
      // Notify main window that toolbar was closed
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toolbar:closed');
      }
    });

    safeLog.log('[Toolbar] Floating toolbar window created');
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Toolbar] Pop-out error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toolbar:popIn', async () => {
  try {
    if (floatingToolbarWindow && !floatingToolbarWindow.isDestroyed()) {
      floatingToolbarWindow.close();
      floatingToolbarWindow = null;

      // Notify main window to show toolbar again
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toolbar:popped-in');
      }

      safeLog.log('[Toolbar] Floating toolbar closed');
      return { success: true };
    }

    return { success: false, error: 'No floating toolbar window' };
  } catch (error: any) {
    safeLog.error('[Toolbar] Pop-in error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toolbar:getState', async () => {
  try {
    const isFloating = floatingToolbarWindow && !floatingToolbarWindow.isDestroyed();
    const bounds = isFloating ? floatingToolbarWindow!.getBounds() : null;

    return {
      success: true,
      isFloating,
      bounds,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('toolbar:setIgnoreMouseEvents', (event, ignore: boolean) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward: true });
    }
  } catch { /* ignore */ }
});

ipcMain.handle('toolbar:resize', async (event, height: number) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      const clampedH = Math.max(60, Math.min(700, Math.round(height)));
      const delta = clampedH - bounds.height;
      const newY = Math.max(0, bounds.y - delta); // expand upward
      win.setBounds({ x: bounds.x, y: newY, width: bounds.width, height: clampedH });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ── Module Builder persistence ──

ipcMain.handle('module:list', async () => {
  try {
    const rows = db.prepare(
      `SELECT id, name, description, status, overall_progress, created_at, updated_at
       FROM module_specs WHERE status != 'archived' ORDER BY updated_at DESC`
    ).all();
    return { success: true, modules: rows };
  } catch (error: any) {
    safeLog.error('[ModuleBuilder] list error:', error.message);
    return { success: false, modules: [], error: error.message };
  }
});

ipcMain.handle('module:get', async (_, id: string) => {
  try {
    const row = db.prepare('SELECT * FROM module_specs WHERE id = ?').get(id) as any;
    if (!row) return { success: false, error: 'not found' };
    row.spec = JSON.parse(row.spec || '{}');
    row.conversation = JSON.parse(row.conversation || '[]');
    row.conversation_state = JSON.parse(row.conversation_state || '{}');
    return { success: true, module: row };
  } catch (error: any) {
    safeLog.error('[ModuleBuilder] get error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('module:save', async (_, data: any) => {
  try {
    const now = Date.now();
    const existing = db.prepare('SELECT created_at FROM module_specs WHERE id = ?').get(data.id) as any;
    const createdAt = existing?.created_at || data.created_at || now;

    db.prepare(
      `INSERT OR REPLACE INTO module_specs (id, name, description, status, spec, conversation, conversation_state, overall_progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.id,
      data.name || '',
      data.description || '',
      data.status || 'in-progress',
      JSON.stringify(data.spec || {}),
      JSON.stringify(data.conversation || []),
      JSON.stringify(data.conversation_state || {}),
      data.overall_progress || 0,
      createdAt,
      now,
    );
    return { success: true };
  } catch (error: any) {
    safeLog.error('[ModuleBuilder] save error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('module:delete', async (_, id: string) => {
  try {
    db.prepare('UPDATE module_specs SET status = ?, updated_at = ? WHERE id = ?').run('archived', Date.now(), id);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[ModuleBuilder] delete error:', error.message);
    return { success: false, error: error.message };
  }
});

// ── Scheduled auto-poster ──
// Auto-poster interval - check every minute for pending posts
let scheduleInterval: NodeJS.Timeout | null = null;

function startScheduledPoster() {
  if (scheduleInterval) return;

  scheduleInterval = setInterval(async () => {
    try {
      const now = Date.now();
      const stmt = prepare(`
        SELECT * FROM scheduled_posts
        WHERE status = 'pending' AND scheduled_time <= ?
      `);
      const pending = stmt.all(now) as { id: string; content: string }[];

      for (const post of pending) {
        try {
          // Post the tweet
          execSync(`x-api post "${post.content.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });

          // Mark as posted
          prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run('posted', post.id);
          safeLog.log(`[X/AutoPost] Posted scheduled tweet: ${post.id}`);
        } catch (postError: any) {
          safeLog.error(`[X/AutoPost] Failed to post ${post.id}:`, postError.message);
          prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run('failed', post.id);
        }
      }
    } catch (error: any) {
      safeLog.error('[X/AutoPost] Interval error:', error.message);
    }
  }, 60000); // Check every minute

  safeLog.log('[X/AutoPost] Started scheduled poster interval');
}

// Start the auto-poster
startScheduledPoster();
