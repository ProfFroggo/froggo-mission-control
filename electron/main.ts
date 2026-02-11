import { app, BrowserWindow, ipcMain, systemPreferences, protocol, desktopCapturer, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec, execSync, execFile } from 'child_process';
import * as os from 'os';
import * as crypto from 'crypto';
import * as http from 'http';
import { calendarService } from './calendar-service';
import { accountsService } from './accounts-service';
import { accountsServiceV2 } from './accounts-service-v2';
import { notificationService, setupNotificationHandlers } from './notification-service';
import { setupNotificationEvents } from './notification-events';
import { secureExec, secureWrite, validateCommand, validateWritePath, getAuditLog, logAudit } from './shell-security';
import * as exportBackupService from './export-backup-service';
import { registerXAutomationsHandlers } from './x-automations-service';
import { initializeDashboardAgents, shutdownDashboardAgents, getDashboardAgentsStatus } from './dashboard-agents';
import * as xApi from './x-api-client';
import { db, prepare, getScheduleDb, closeDb } from './database';

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
    console.error('Failed to load agent registry, using empty:', err);
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

// ============== AGENTS LIST FROM GATEWAY ==============
function getAgentsFromDB(): any[] {
  try {
    const rows = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status = 'active' ORDER BY name`).all() as any[];
    return rows.map((r: any) => ({
      id: r.id,
      identityName: r.name || r.id,
      identityEmoji: '🤖',
      description: r.role || r.description || '',
      workspace: `~/clawd-${r.id}`,
      model: '',
      isDefault: r.id === 'froggo',
    }));
  } catch (e: any) {
    safeLog.error('[Agents] DB fallback failed:', e.message);
    return [];
  }
}

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
      (error, stdout, stderr) => {
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
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

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
    require('fs').appendFileSync(debugLogPath, `[${ts}] ${msg}\n`);
  } catch (e) { /* ignore */ }
}

const safeLog = {
  log: (...args: any[]) => {
    try {
      if (process.stdout.writable) {
        console.log(...args);
      }
    } catch (e: any) {
      // Silently ignore EPIPE and other stream errors
    }
  },
  error: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.error(...args);
      }
    } catch (e: any) {
      // Silently ignore stream errors
    }
  },
  warn: (...args: any[]) => {
    try {
      if (process.stderr.writable) {
        console.warn(...args);
      }
    } catch (e: any) {
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
  } catch {}
  
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
let modelServerPort = 18799;

let mainWindow: BrowserWindow | null = null;

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

  // Setup notification handlers
  setupNotificationHandlers(mainWindow);

  // Register X Automations handlers
  registerXAutomationsHandlers();

  if (isDev) {
    safeLog.log('Running in dev mode, loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    safeLog.log('Running in production mode, loading from dist');
    mainWindow.loadFile(distPath);
    // Temporarily enable DevTools in production for debugging
    mainWindow.webContents.openDevTools();
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

  // Catch renderer crashes to diagnose issues
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    safeLog.log('[Main] RENDERER CRASHED:', details.reason, details.exitCode);
  });
  mainWindow.webContents.on('crashed', () => {
    safeLog.log('[Main] RENDERER CRASHED (legacy event)');
  });

  // SAFEGUARD: Send cleanup signal before window closes
  mainWindow.on('close', (e) => {
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
const taskNotifyPath = path.join(os.homedir(), 'clawd', 'data', 'task-notify.json');
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
    const notifyFile = path.join(os.homedir(), 'clawd', 'data', 'task-notify.json');
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
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  
  // Query for pending items where scheduled_for <= now
  // Fetch all pending and filter in JS (handles various datetime formats)
  const query = `SELECT * FROM schedule WHERE status='pending'`;
  
  exec(`sqlite3 "${dbPath}" "${query}" -json`, { timeout: 10000 }, async (error, stdout) => {
    if (error) {
      safeLog.error('[ScheduleProcessor] Query error:', error.message);
      return;
    }
    
    let items: any[] = [];
    try {
      const trimmed = stdout.trim();
      if (trimmed && trimmed !== '[]') {
        items = JSON.parse(trimmed);
      }
    } catch (e) {
      // No items or parse error - that's fine
      return;
    }
    
    if (items.length === 0) return;
    
    // Filter for overdue items (scheduled_for <= now) handling various datetime formats
    const now = new Date();
    items = items.filter(item => {
      if (!item.scheduled_for) return false;
      const scheduledTime = new Date(item.scheduled_for);
      return scheduledTime <= now;
    });
    
    if (items.length === 0) return;
    
    safeLog.log(`[ScheduleProcessor] Found ${items.length} overdue item(s) to process`);
    
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
            exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='completed' WHERE id='${item.id}'"`, () => {});
          } else {
            safeLog.error(`[ScheduleProcessor] Tweet failed: ${result.error}`);
            exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='${(result.error || '').replace(/'/g, "''")}' WHERE id='${item.id}'"`, () => {});
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
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='Missing recipient' WHERE id='${item.id}'"`, () => {});
          continue;
        }
        if (!account || !account.trim()) {
          safeLog.error(`[ScheduleProcessor] Email ${item.id} has no account configured - marking as failed`);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='Missing GOG account' WHERE id='${item.id}'"`, () => {});
          continue;
        }
        
        const subject = (metadata.subject || 'No subject').replace(/"/g, '\\"');
        const body = item.content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        execCmd = `GOG_ACCOUNT="${account}" gog gmail send --to "${recipient}" --subject "${subject}" --body "${body}"`;
      } else {
        safeLog.warn(`[ScheduleProcessor] Unknown type: ${item.type}`);
        // Mark as failed with unknown type error
        exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='Unknown type: ${item.type}' WHERE id='${item.id}'"`, () => {});
        continue;
      }
      
      safeLog.log(`[ScheduleProcessor] Executing: ${execCmd.slice(0, 100)}...`);
      
      // Execute the command
      exec(execCmd, { timeout: 60000 }, (execError, execStdout, execStderr) => {
        if (execError) {
          safeLog.error(`[ScheduleProcessor] Failed to send ${item.id}:`, execError.message);
          const errorMsg = (execError.message || '').replace(/'/g, "''").slice(0, 500);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='failed', error='${errorMsg}' WHERE id='${item.id}'"`, () => {});
          
          // Notify renderer of failure
          safeSend('schedule-processed', { 
            id: item.id, 
            type: item.type, 
            success: false, 
            error: execError.message 
          });
        } else {
          safeLog.log(`[ScheduleProcessor] Successfully sent ${item.id}`);
          exec(`sqlite3 "${dbPath}" "UPDATE schedule SET status='sent', sent_at=datetime('now') WHERE id='${item.id}'"`, () => {});
          
          // Notify renderer of success
          safeSend('schedule-processed', { 
            id: item.id, 
            type: item.type, 
            success: true 
          });
        }
      });
    }
  });
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
        } catch (e) {
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
});

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
  // Close database connections
  closeDb();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
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
        try { fs.unlinkSync(tempFile); } catch {}
        
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
    try { fs.unlinkSync(tempFile); } catch {}
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
  const envPath = path.join(os.homedir(), '.clawdbot', 'elevenlabs.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/ELEVENLABS_API_KEY=(.+)/);
    if (match) elevenlabsApiKey = match[1].trim();
  }
} catch {}

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

    const data = JSON.parse(result);
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
    console.error('[agents:getActiveSessions] Error:', error.message);
    return { success: false, sessions: [], error: error.message };
  }
});
ipcMain.handle('tasks:sync', async (_, task: { 
  id: string; 
  title: string; 
  status: string; 
  project?: string; 
  assignedTo?: string; 
  description?: string;
  priority?: string;
  dueDate?: number;
}) => {
  safeLog.log('[Tasks] Sync called with:', JSON.stringify(task));
  safeLog.log('[Tasks] Status being set:', task.status);
  
  // Check if task exists
  return new Promise((resolve) => {
    exec(`froggo-db task-get "${task.id}"`, { timeout: 5000 }, (getError, getStdout) => {
      // If task exists (stdout has JSON), just return success
      if (!getError && getStdout && getStdout.includes('"id"')) {
        safeLog.log('[Tasks] Task already exists:', task.id);
        resolve({ success: true });
        return;
      }
      
      // Task doesn't exist, create it via direct SQL for more control
      const title = task.title.replace(/'/g, "''");
      const desc = (task.description || '').replace(/'/g, "''");
      const project = (task.project || 'Default').replace(/'/g, "''");
      const dueStr = task.dueDate ? new Date(task.dueDate).toISOString() : null;
      const nowMs = Date.now();
      
      const insertCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT OR REPLACE INTO tasks (id, title, description, status, project, assigned_to, priority, due_date, created_at, updated_at) VALUES ('${task.id}', '${title}', '${desc}', '${task.status || 'todo'}', '${project}', '${task.assignedTo || ''}', '${task.priority || ''}', ${dueStr ? `'${dueStr}'` : 'NULL'}, ${nowMs}, ${nowMs})"`;
      
      safeLog.log('[Tasks] Creating task via SQL');
      
      exec(insertCmd, { timeout: 10000 }, (addError, addStdout, addStderr) => {
        if (addError) {
          safeLog.error('[Tasks] Create error:', addError.message);
          safeLog.error('[Tasks] stderr:', addStderr);
          resolve({ success: false, error: addError.message });
        } else {
          safeLog.log('[Tasks] Created:', task.id);
          resolve({ success: true });
        }
      });
    });
  });
});

// ============================================================
// NOTIFICATION SETTINGS HANDLERS
// ============================================================

// Get notification settings for a specific conversation
ipcMain.handle('notification-settings:get', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM conversation_notification_settings WHERE session_key = '${sessionKey.replace(/'/g, "''")}'" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[NotificationSettings] Get error:', error);
        resolve({ success: false, settings: null });
        return;
      }
      
      try {
        const settings = JSON.parse(stdout || '[]');
        resolve({ success: true, settings: settings[0] || null });
      } catch (e) {
        safeLog.error('[NotificationSettings] Parse error:', e);
        resolve({ success: false, settings: null });
      }
    });
  });
});

// Set/update notification settings for a conversation
ipcMain.handle('notification-settings:set', async (_, sessionKey: string, settings: any) => {
  // First check if settings exist
  const checkCmd = `sqlite3 "${froggoDbPath}" "SELECT id FROM conversation_notification_settings WHERE session_key = '${sessionKey.replace(/'/g, "''")}'" -json`;
  
  return new Promise((resolve) => {
    exec(checkCmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[NotificationSettings] Check error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      const existing = JSON.parse(stdout || '[]');
      const isUpdate = existing.length > 0;
      
      // Build SQL based on update or insert
      let cmd: string;
      
      if (isUpdate) {
        // UPDATE existing settings
        const setParts: string[] = [];
        
        if (settings.notification_level !== undefined) 
          setParts.push(`notification_level = '${settings.notification_level}'`);
        if (settings.sound_enabled !== undefined) 
          setParts.push(`sound_enabled = ${settings.sound_enabled ? 1 : 0}`);
        if (settings.sound_type !== undefined) 
          setParts.push(`sound_type = '${settings.sound_type}'`);
        if (settings.desktop_notifications !== undefined) 
          setParts.push(`desktop_notifications = ${settings.desktop_notifications ? 1 : 0}`);
        if (settings.quiet_hours_enabled !== undefined) 
          setParts.push(`quiet_hours_enabled = ${settings.quiet_hours_enabled ? 1 : 0}`);
        if (settings.quiet_start !== undefined) 
          setParts.push(`quiet_start = '${settings.quiet_start}'`);
        if (settings.quiet_end !== undefined) 
          setParts.push(`quiet_end = '${settings.quiet_end}'`);
        if (settings.keyword_alerts !== undefined) 
          setParts.push(`keyword_alerts = '${JSON.stringify(settings.keyword_alerts).replace(/'/g, "''")}'`);
        if (settings.priority_level !== undefined) 
          setParts.push(`priority_level = '${settings.priority_level}'`);
        if (settings.mute_until !== undefined) 
          setParts.push(`mute_until = ${settings.mute_until ? `'${settings.mute_until}'` : 'NULL'}`);
        if (settings.notification_frequency !== undefined) 
          setParts.push(`notification_frequency = '${settings.notification_frequency}'`);
        if (settings.show_message_preview !== undefined) 
          setParts.push(`show_message_preview = ${settings.show_message_preview ? 1 : 0}`);
        if (settings.badge_count_enabled !== undefined) 
          setParts.push(`badge_count_enabled = ${settings.badge_count_enabled ? 1 : 0}`);
        if (settings.notes !== undefined) 
          setParts.push(`notes = '${(settings.notes || '').replace(/'/g, "''")}'`);
        
        if (setParts.length === 0) {
          resolve({ success: false, error: 'No updates provided' });
          return;
        }
        
        cmd = `sqlite3 "${froggoDbPath}" "UPDATE conversation_notification_settings SET ${setParts.join(', ')} WHERE session_key = '${sessionKey.replace(/'/g, "''")}'`;
      } else {
        // INSERT new settings
        const notificationLevel = settings.notification_level || 'all';
        const soundEnabled = settings.sound_enabled !== undefined ? (settings.sound_enabled ? 1 : 0) : 1;
        const soundType = settings.sound_type || 'default';
        const desktopNotifications = settings.desktop_notifications !== undefined ? (settings.desktop_notifications ? 1 : 0) : 1;
        const quietHoursEnabled = settings.quiet_hours_enabled ? 1 : 0;
        const quietStart = settings.quiet_start || 'NULL';
        const quietEnd = settings.quiet_end || 'NULL';
        const keywordAlerts = settings.keyword_alerts ? `'${JSON.stringify(settings.keyword_alerts).replace(/'/g, "''")}'` : 'NULL';
        const priorityLevel = settings.priority_level || 'normal';
        const muteUntil = settings.mute_until ? `'${settings.mute_until}'` : 'NULL';
        const notificationFrequency = settings.notification_frequency || 'instant';
        const showMessagePreview = settings.show_message_preview !== undefined ? (settings.show_message_preview ? 1 : 0) : 1;
        const badgeCountEnabled = settings.badge_count_enabled !== undefined ? (settings.badge_count_enabled ? 1 : 0) : 1;
        const notes = settings.notes ? `'${settings.notes.replace(/'/g, "''")}'` : 'NULL';
        
        cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO conversation_notification_settings (session_key, notification_level, sound_enabled, sound_type, desktop_notifications, quiet_hours_enabled, quiet_start, quiet_end, keyword_alerts, priority_level, mute_until, notification_frequency, show_message_preview, badge_count_enabled, notes) VALUES ('${sessionKey.replace(/'/g, "''")}', '${notificationLevel}', ${soundEnabled}, '${soundType}', ${desktopNotifications}, ${quietHoursEnabled}, ${quietStart}, ${quietEnd}, ${keywordAlerts}, '${priorityLevel}', ${muteUntil}, '${notificationFrequency}', ${showMessagePreview}, ${badgeCountEnabled}, ${notes})"`;
      }
      
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          safeLog.error('[NotificationSettings] Set error:', error);
          resolve({ success: false, error: error.message });
          return;
        }
        
        resolve({ success: true });
      });
    });
  });
});

// Delete conversation-specific settings
ipcMain.handle('notification-settings:delete', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_notification_settings WHERE session_key = '${sessionKey.replace(/'/g, "''")}'`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[NotificationSettings] Delete error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Get global notification defaults
ipcMain.handle('notification-settings:global-defaults', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM global_notification_defaults WHERE id = 1" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[NotificationSettings] Get global defaults error:', error);
        resolve({ success: false, defaults: null });
        return;
      }
      
      try {
        const defaults = JSON.parse(stdout || '[]');
        resolve({ success: true, defaults: defaults[0] || null });
      } catch (e) {
        safeLog.error('[NotificationSettings] Parse error:', e);
        resolve({ success: false, defaults: null });
      }
    });
  });
});

// Update global notification defaults
ipcMain.handle('notification-settings:set-global-defaults', async (_, defaults: any) => {
  const setParts: string[] = [];
  
  if (defaults.default_notification_level !== undefined) 
    setParts.push(`default_notification_level = '${defaults.default_notification_level}'`);
  if (defaults.default_sound_enabled !== undefined) 
    setParts.push(`default_sound_enabled = ${defaults.default_sound_enabled ? 1 : 0}`);
  if (defaults.default_sound_type !== undefined) 
    setParts.push(`default_sound_type = '${defaults.default_sound_type}'`);
  if (defaults.default_desktop_notifications !== undefined) 
    setParts.push(`default_desktop_notifications = ${defaults.default_desktop_notifications ? 1 : 0}`);
  if (defaults.quiet_hours_enabled !== undefined) 
    setParts.push(`quiet_hours_enabled = ${defaults.quiet_hours_enabled ? 1 : 0}`);
  if (defaults.quiet_start !== undefined) 
    setParts.push(`quiet_start = '${defaults.quiet_start}'`);
  if (defaults.quiet_end !== undefined) 
    setParts.push(`quiet_end = '${defaults.quiet_end}'`);
  if (defaults.default_priority_level !== undefined) 
    setParts.push(`default_priority_level = '${defaults.default_priority_level}'`);
  if (defaults.do_not_disturb_enabled !== undefined) 
    setParts.push(`do_not_disturb_enabled = ${defaults.do_not_disturb_enabled ? 1 : 0}`);
  if (defaults.dnd_until !== undefined) 
    setParts.push(`dnd_until = ${defaults.dnd_until ? `'${defaults.dnd_until}'` : 'NULL'}`);
  if (defaults.enable_batching !== undefined) 
    setParts.push(`enable_batching = ${defaults.enable_batching ? 1 : 0}`);
  if (defaults.batch_interval_minutes !== undefined) 
    setParts.push(`batch_interval_minutes = ${defaults.batch_interval_minutes}`);
  
  if (setParts.length === 0) {
    return { success: false, error: 'No updates provided' };
  }
  
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE global_notification_defaults SET ${setParts.join(', ')} WHERE id = 1"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[NotificationSettings] Set global defaults error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Get effective settings (with global fallback)
ipcMain.handle('notification-settings:get-effective', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM effective_notification_settings WHERE session_key = '${sessionKey.replace(/'/g, "''")}'" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[NotificationSettings] Get effective error:', error);
        resolve({ success: false, settings: null });
        return;
      }
      
      try {
        const settings = JSON.parse(stdout || '[]');
        resolve({ success: true, settings: settings[0] || null });
      } catch (e) {
        safeLog.error('[NotificationSettings] Parse error:', e);
        resolve({ success: false, settings: null });
      }
    });
  });
});

// Quick mute conversation
ipcMain.handle('notification-settings:mute', async (_, sessionKey: string, duration?: string) => {
  let muteUntil = 'NULL';
  
  if (duration) {
    muteUntil = `'${duration}'`;
  } else {
    // Default: mute for 24 hours
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);
    muteUntil = `'${tomorrow.toISOString()}'`;
  }
  
  // Check if settings exist
  const checkCmd = `sqlite3 "${froggoDbPath}" "SELECT id FROM conversation_notification_settings WHERE session_key = '${sessionKey.replace(/'/g, "''")}'" -json`;
  
  return new Promise((resolve) => {
    exec(checkCmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[NotificationSettings] Mute check error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      const existing = JSON.parse(stdout || '[]');
      let cmd: string;
      
      if (existing.length > 0) {
        // UPDATE existing
        cmd = `sqlite3 "${froggoDbPath}" "UPDATE conversation_notification_settings SET mute_until = ${muteUntil}, notification_level = 'none' WHERE session_key = '${sessionKey.replace(/'/g, "''")}'`;
      } else {
        // INSERT new
        cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO conversation_notification_settings (session_key, notification_level, mute_until) VALUES ('${sessionKey.replace(/'/g, "''")}', 'none', ${muteUntil})"`;
      }
      
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          safeLog.error('[NotificationSettings] Mute error:', error);
          resolve({ success: false, error: error.message });
          return;
        }
        
        resolve({ success: true });
      });
    });
  });
});

// Unmute conversation
ipcMain.handle('notification-settings:unmute', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE conversation_notification_settings SET mute_until = NULL, notification_level = 'all' WHERE session_key = '${sessionKey.replace(/'/g, "''")}'`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[NotificationSettings] Unmute error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

ipcMain.handle('rejections:log', async (_, rejection: { type: string; title: string; content?: string; reason?: string }) => {
  const escapedTitle = rejection.title.replace(/"/g, '\\"');
  const escapedReason = (rejection.reason || '').replace(/"/g, '\\"');
  const cmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO rejected_decisions (type, title, content, reason) VALUES ('${rejection.type}', '${escapedTitle}', '', '${escapedReason}')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('tasks:update', async (_, taskId: string, updates: { status?: string; assignedTo?: string; planningNotes?: string; reviewStatus?: string; reviewerId?: string }) => {
  try {
    const sqlFields: string[] = [];
    const params: any[] = [];
    
    if (updates.planningNotes !== undefined) {
      sqlFields.push('planning_notes = ?');
      params.push(updates.planningNotes);
    }
    
    if (updates.reviewStatus !== undefined) {
      sqlFields.push('reviewStatus = ?');
      params.push(updates.reviewStatus);
    }
    
    if (updates.reviewerId !== undefined) {
      sqlFields.push('reviewerId = ?');
      params.push(updates.reviewerId);
    }
    
    if (updates.status !== undefined) {
      sqlFields.push('status = ?');
      params.push(updates.status);
    }
    
    if (updates.assignedTo !== undefined) {
      sqlFields.push('assigned_to = ?');
      params.push(updates.assignedTo);
    }
    
    // Execute SQL update if we have any fields
    if (sqlFields.length > 0) {
      const now = Date.now();
      sqlFields.push('updated_at = ?');
      params.push(now);
      params.push(taskId);
      
      const result = prepare(
        `UPDATE tasks SET ${sqlFields.join(', ')} WHERE id = ?`
      ).run(...params);
      
      if (result.changes > 0) {
        safeLog.log('[Tasks] Updated via prepared statement:', taskId, updates);
        // Emit task update event for real-time Dashboard refresh
        emitTaskEvent('task.updated', taskId);
        return { success: true };
      } else {
        safeLog.warn('[Tasks] Update: task not found:', taskId);
        return { success: false, error: 'Task not found' };
      }
    }
    
    // If no updates provided, return success
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Tasks] Update error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tasks:list', async (_, status?: string) => {
  try {
    // Only select needed columns, exclude large progress blob for list view
    const columns = 'id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, priority, due_date, last_agent_update, reviewerId, reviewStatus, planning_notes, cancelled, archived';
    // Exclude cancelled AND archived tasks from main view
    let whereClause = '(cancelled IS NULL OR cancelled = 0) AND (archived IS NULL OR cancelled = 0)';
    const params: any[] = [];
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const tasks = prepare(`
      SELECT ${columns}, 
        (SELECT MAX(timestamp) FROM task_activity WHERE task_id = tasks.id) as last_activity_at
      FROM tasks 
      WHERE ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT 500
    `).all(...params);

    // Get total done count (including archived) for display
    const { 'COUNT(*)': totalDone } = prepare(`SELECT COUNT(*) FROM tasks WHERE status='done' AND (cancelled IS NULL OR cancelled = 0)`).get() as any;
    const totalArchived = totalDone - tasks.filter((t: any) => t.status === 'done').length;

    return { success: true, tasks, totalDone, totalArchived };
  } catch (error: any) {
    safeLog.error('[tasks:list] Error:', error.message);
    return { success: false, tasks: [] };
  }
});

// Search archived tasks (for audit trail - includes all tasks)
ipcMain.handle('tasks:search', async (_, query: string, includeArchived = true) => {
  try {
    const pattern = `%${query}%`;
    const archiveFilter = includeArchived ? '' : 'AND (archived IS NULL OR archived = 0)';
    const tasks = prepare(`SELECT id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, archived, cancelled FROM tasks WHERE (title LIKE ? OR description LIKE ? OR id LIKE ?) ${archiveFilter} ORDER BY updated_at DESC LIMIT 100`).all(pattern, pattern, pattern);
    return { success: true, tasks };
  } catch (error: any) {
    safeLog.error('[tasks:search] Error:', error.message);
    return { success: false, tasks: [] };
  }
});

// Get task with full details including progress (for audit)
ipcMain.handle('tasks:getWithProgress', async (_, taskId: string) => {
  try {
    const task = prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    return { success: true, task: task || null };
  } catch (error: any) {
    safeLog.error('[tasks:getWithProgress] Error:', error.message);
    return { success: false, task: null };
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

ipcMain.handle('tasks:start', async (_, taskId: string) => {
  const cmd = `froggo-db task-start "${taskId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('tasks:complete', async (_, taskId: string, outcome?: string) => {
  const outcomeArg = outcome ? `--outcome ${outcome}` : '';
  const cmd = `froggo-db task-complete "${taskId}" ${outcomeArg}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('tasks:delete', async (_, taskId: string) => {
  // Direct SQL: set cancelled=1 to soft-delete. Can't use froggo-db task-update --status cancelled
  // because the enforce_valid_state_transitions trigger blocks 'cancelled' as a status value.
  // The cancelled column is the proper soft-delete mechanism (froggo-db task-list already filters it).
  try {
    const now = Date.now();
    const result = prepare('UPDATE tasks SET cancelled = 1, updated_at = ? WHERE id = ?').run(now, taskId);
    
    if (result.changes > 0) {
      safeLog.log('[Tasks] Soft-deleted (cancelled=1):', taskId);
      return { success: true };
    } else {
      safeLog.warn('[Tasks] Delete: task not found:', taskId);
      return { success: false, error: 'Task not found' };
    }
  } catch (error: any) {
    safeLog.error('[Tasks] Delete error:', error.message);
    return { success: false, error: error.message };
  }
});

// Archive all done tasks - bulk operation for cleaning up Kanban board
ipcMain.handle('tasks:archiveDone', async () => {
  try {
    const now = Date.now();
    
    // Use transaction for atomic bulk operation
    const archive = db.transaction(() => {
      // Set archived=1 for all done tasks (excludes already cancelled tasks)
      const result = prepare(
        'UPDATE tasks SET archived = 1, updated_at = ? WHERE status = ? AND (cancelled IS NULL OR cancelled = 0) AND (archived IS NULL OR archived = 0)'
      ).run(now, 'done');
      
      return result.changes;
    });
    
    const count = archive();
    safeLog.log(`[Tasks] Archived ${count} done tasks`);
    return { success: true, count };
  } catch (error: any) {
    safeLog.error('[Tasks] Archive done error:', error.message);
    return { success: false, error: error.message, count: 0 };
  }
});

// Poke a task - INTERNAL: spawn agent chat session for status update (no Discord posting)
ipcMain.handle('tasks:poke', async (_, taskId: string, title: string) => {
  // Legacy handler kept for backwards compat - just logs internally now
  safeLog.log(`[Tasks] Poke (legacy): ${taskId} - ${title}`);
  return { success: true, message: `Poke registered for "${title}"` };
});

// Internal poke - spawns agent session and gets personality-driven status response
ipcMain.handle('tasks:pokeInternal', async (_, taskId: string, title: string) => {
  safeLog.log(`[Tasks] Internal Poke: ${taskId} - ${title}`);
  
  try {
    // Determine which agent to use based on task assignment
    const taskAgent = await new Promise<string>((resolve) => {
      exec(
        `froggo-db task-get ${taskId} 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } },
        (error, stdout) => {
          if (!error && stdout) {
            try {
              const taskData = JSON.parse(stdout);
              if (taskData.assigned_to) {
                resolve(taskData.assigned_to);
                return;
              }
            } catch {}
          }
          resolve('froggo'); // Default to froggo
        }
      );
    });

    const pokePrompt = `You are ${taskAgent} responding to a poke/nudge about a task. Be casual, direct, bit of humor - like texting a mate about work.
Task: "${title}" (ID: ${taskId})
The user is poking you to ask what's happening with this task. Give a brief, personality-driven status update.
Keep it SHORT (2-3 sentences max). This is a quick status check, not an essay.`;

    // Use openclaw agent with --local --json for reliable response capture
    const escapedPrompt = pokePrompt.replace(/"/g, '\\"');
    const response = await new Promise<string>((resolve, reject) => {
      exec(
        `openclaw agent --message "${escapedPrompt}" --agent ${taskAgent} --local --json --timeout 20`,
        { 
          encoding: 'utf-8', 
          timeout: 25000, 
          maxBuffer: 5 * 1024 * 1024,
          env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } 
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          
          safeLog.log(`[Tasks] Raw poke stdout length: ${stdout.length}`);
          
          try {
            // openclaw agent --json may print debug lines before JSON
            // Find the JSON object (starts with { and ends with })
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : stdout;
            
            const result = JSON.parse(jsonStr);
            
            // Extract text from various possible formats
            let text = '';
            if (result.payloads && Array.isArray(result.payloads) && result.payloads[0]?.text) {
              text = result.payloads[0].text;
            } else if (result.text) {
              text = result.text;
            } else if (typeof result === 'string') {
              text = result;
            } else {
              // JSON parsed but no text found - use first payload text or fail
              safeLog.warn('[Tasks] Could not extract text from JSON response');
              text = 'No response text';
            }
            
            resolve(text);
          } catch (parseError) {
            // If not JSON, use raw output (strip debug lines)
            safeLog.log('[Tasks] Not JSON, using raw output');
            const lines = stdout.trim().split('\n');
            // Skip lines that look like debug output (start with [ or contain 'plugins')
            const cleanLines = lines.filter(l => !l.startsWith('[') && !l.includes('plugins'));
            resolve(cleanLines.join('\n').trim() || stdout.trim());
          }
        }
      );
    });
    
    safeLog.log(`[Tasks] Internal poke response from ${taskAgent}: ${response.slice(0, 100)}...`);
    return { success: true, agentId: taskAgent, response };
  } catch (e: any) {
    safeLog.error(`[Tasks] Internal poke error: ${e.message}`);
    return { 
      success: true, 
      sessionKey: null, 
      response: `😅 Couldn't reach the agent right now - they might be deep in something. Try again in a sec? (Error: ${e.message})` 
    };
  }
});

// ============== SUBTASKS IPC HANDLERS ==============
const froggoDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');

ipcMain.handle('subtasks:list', async (_, taskId: string) => {
  try {
    const rows = prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position, created_at').all(taskId);
    const subtasks = rows.map((st: any) => ({
      id: st.id,
      taskId: st.task_id,
      title: st.title,
      description: st.description,
      completed: st.completed === 1,
      completedAt: st.completed_at,
      completedBy: st.completed_by,
      assignedTo: st.assigned_to,
      position: st.position,
      createdAt: st.created_at,
    }));
    return { success: true, subtasks };
  } catch (error: any) {
    safeLog.error('[Subtasks] List error:', error);
    return { success: false, subtasks: [] };
  }
});

ipcMain.handle('subtasks:add', async (_, taskId: string, subtask: { id: string; title: string; description?: string; assignedTo?: string }) => {
  safeLog.log('[Subtasks] Add called:', { taskId, subtask });

  // Validate inputs
  if (!taskId || !subtask?.id || !subtask?.title) {
    safeLog.error('[Subtasks] Invalid input:', { taskId, subtask });
    return { success: false, error: 'Invalid input: taskId, subtask.id, and subtask.title are required' };
  }

  try {
    const now = Date.now();

    // Get next position
    const posResult = prepare('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM subtasks WHERE task_id = ?').get(taskId) as any;
    const position = posResult?.next_pos || 0;
    safeLog.log('[Subtasks] Position:', position);

    // Insert subtask
    prepare('INSERT INTO subtasks (id, task_id, title, description, assigned_to, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      subtask.id,
      taskId,
      subtask.title,
      subtask.description || null,
      subtask.assignedTo || null,
      position,
      now,
      now
    );

    safeLog.log('[Subtasks] Insert success:', subtask.id);

    // Log activity
    prepare('INSERT INTO task_activity (task_id, action, message, timestamp) VALUES (?, ?, ?, ?)').run(
      taskId,
      'subtask_added',
      `Added subtask: ${subtask.title}`,
      now
    );

    // Emit task update event for real-time Dashboard refresh
    emitTaskEvent('task.updated', taskId);

    return { success: true, id: subtask.id };
  } catch (error: any) {
    safeLog.error('[Subtasks] Add error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('subtasks:update', async (_, subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => {
  try {
    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (updates.completed !== undefined) {
      sets.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
      if (updates.completed) {
        sets.push('completed_at = ?');
        params.push(now);
        if (updates.completedBy) {
          sets.push('completed_by = ?');
          params.push(updates.completedBy);
        }
      } else {
        sets.push('completed_at = NULL');
        sets.push('completed_by = NULL');
      }
    }
    if (updates.title) {
      sets.push('title = ?');
      params.push(updates.title);
    }
    if (updates.assignedTo !== undefined) {
      sets.push('assigned_to = ?');
      params.push(updates.assignedTo || null);
    }

    params.push(subtaskId);
    prepare(`UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    // Log activity for completion changes
    if (updates.completed !== undefined) {
      const subtask = prepare('SELECT task_id, title FROM subtasks WHERE id = ?').get(subtaskId) as any;
      if (subtask?.task_id) {
        const action = updates.completed ? 'subtask_completed' : 'subtask_uncompleted';
        const message = updates.completed
          ? `Completed: ${subtask.title}${updates.completedBy ? ' by ' + updates.completedBy : ''}`
          : `Reopened: ${subtask.title}`;
        prepare('INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          subtask.task_id,
          action,
          message,
          updates.completedBy || null,
          now
        );
        // Emit task update event for real-time Dashboard refresh
        emitTaskEvent('task.updated', subtask.task_id);
      }
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Subtasks] Update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('subtasks:delete', async (_, subtaskId: string) => {
  try {
    // Get task_id and title first for activity log
    const subtask = prepare('SELECT task_id, title FROM subtasks WHERE id = ?').get(subtaskId) as any;

    // Delete subtask
    prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);

    // Log activity
    if (subtask?.task_id) {
      const now = Date.now();
      prepare('INSERT INTO task_activity (task_id, action, message, timestamp) VALUES (?, ?, ?, ?)').run(
        subtask.task_id,
        'subtask_deleted',
        `Deleted subtask: ${subtask.title || ''}`,
        now
      );
      // Emit task update event for real-time Dashboard refresh
      emitTaskEvent('task.updated', subtask.task_id);
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Subtasks] Delete error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('subtasks:reorder', async (_, subtaskIds: string[]) => {
  try {
    const now = Date.now();
    const stmt = prepare('UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ?');

    subtaskIds.forEach((id, idx) => {
      stmt.run(idx, now, id);
    });

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Subtasks] Reorder error:', error.message);
    return { success: false };
  }
});

// ============== TASK ACTIVITY IPC HANDLERS ==============
ipcMain.handle('activity:list', async (_, taskId: string, limit?: number) => {
  try {
    const lim = limit || 50;
    const rows = prepare('SELECT * FROM task_activity WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?').all(taskId, lim);
    const activities = rows.map((a: any) => ({
      id: a.id,
      taskId: a.task_id,
      agentId: a.agent_id,
      action: a.action,
      message: a.message,
      details: a.details,
      timestamp: a.timestamp,
    }));
    return { success: true, activities };
  } catch (error: any) {
    safeLog.error('[Activity] List error:', error);
    return { success: false, activities: [] };
  }
});

ipcMain.handle('activity:add', async (_, taskId: string, entry: { action: string; message: string; agentId?: string; details?: string }) => {
  try {
    const now = Date.now();
    prepare('INSERT INTO task_activity (task_id, agent_id, action, message, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(
      taskId,
      entry.agentId || null,
      entry.action,
      entry.message,
      entry.details || null,
      now
    );

    // Emit task update event for real-time Dashboard refresh
    emitTaskEvent('task.updated', taskId);

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Activity] Add error:', error.message);
    return { success: false };
  }
});

// ============== TASK ATTACHMENTS IPC HANDLERS ==============
ipcMain.handle('attachments:list', async (_, taskId: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT id, task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at FROM task_attachments WHERE task_id='${taskId}' ORDER BY uploaded_at DESC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Attachments] List error:', error);
        resolve({ success: false, attachments: [] });
        return;
      }
      try {
        const attachments = JSON.parse(stdout || '[]');
        resolve({ success: true, attachments });
      } catch (e) {
        safeLog.error('[Attachments] Parse error:', e);
        resolve({ success: false, attachments: [] });
      }
    });
  });
});

ipcMain.handle('attachments:add', async (_, taskId: string, filePath: string, category: string = 'deliverable', uploadedBy: string = 'user') => {
  const filename = path.basename(filePath);
  
  // Get file stats
  let fileSize = 0;
  let mimeType = 'application/octet-stream';
  
  try {
    const stats = fs.statSync(filePath);
    fileSize = stats.size;
    
    // Simple MIME type detection based on extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.sh': 'text/x-shellscript',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };
    mimeType = mimeTypes[ext] || mimeType;
  } catch (e) {
    safeLog.error('[Attachments] File stat error:', e);
    return { success: false, error: 'File not accessible' };
  }
  
  const now = Date.now();
  const escapedPath = filePath.replace(/'/g, "''");
  const escapedFilename = filename.replace(/'/g, "''");
  
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO task_attachments (task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at) VALUES ('${taskId}', '${escapedPath}', '${escapedFilename}', ${fileSize}, '${mimeType}', '${category}', '${uploadedBy}', ${now}); SELECT last_insert_rowid()"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Attachments] Add error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      const attachmentId = parseInt(stdout.trim());
      
      // Log activity
      const activityCmd = `froggo-db task-activity "${taskId}" "file_attached" "Attached: ${escapedFilename} (${category})" --details "${escapedPath}"`;
      exec(activityCmd, () => {});
      
      resolve({ 
        success: true, 
        attachment: {
          id: attachmentId,
          task_id: taskId,
          file_path: filePath,
          filename,
          file_size: fileSize,
          mime_type: mimeType,
          category,
          uploaded_by: uploadedBy,
          uploaded_at: now
        }
      });
    });
  });
});

ipcMain.handle('attachments:delete', async (_, attachmentId: number) => {
  // Get attachment info first for activity log
  const getCmd = `sqlite3 "${froggoDbPath}" "SELECT task_id, filename FROM task_attachments WHERE id=${attachmentId}" -json`;
  
  return new Promise((resolve) => {
    exec(getCmd, { timeout: 5000 }, (getError, getStdout) => {
      if (getError) {
        resolve({ success: false, error: 'Attachment not found' });
        return;
      }
      
      try {
        const attachments = JSON.parse(getStdout);
        if (!attachments || attachments.length === 0) {
          resolve({ success: false, error: 'Attachment not found' });
          return;
        }
        
        const { task_id, filename } = attachments[0];
        
        // Delete attachment
        const deleteCmd = `sqlite3 "${froggoDbPath}" "DELETE FROM task_attachments WHERE id=${attachmentId}"`;
        exec(deleteCmd, { timeout: 5000 }, (deleteError) => {
          if (deleteError) {
            resolve({ success: false, error: deleteError.message });
            return;
          }
          
          // Log activity
          const escapedFilename = filename.replace(/'/g, "''");
          const activityCmd = `froggo-db task-activity "${task_id}" "file_deleted" "Deleted attachment: ${escapedFilename}"`;
          exec(activityCmd, () => {});
          
          resolve({ success: true });
        });
      } catch (e) {
        resolve({ success: false, error: 'Parse error' });
      }
    });
  });
});

ipcMain.handle('attachments:open', async (_, filePath: string) => {
  // Open file in default system application
  const openCmd = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
  
  return new Promise((resolve) => {
    exec(`${openCmd} "${filePath}"`, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('attachments:auto-detect', async (_, taskId: string) => {
  // Run auto-detection via helper script
  const cmd = `${path.join(os.homedir(), 'clawd', 'scripts', 'attachment-helper.sh')} detect "${taskId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Attachments] Auto-detect error:', error, stderr);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true, output: stdout });
    });
  });
});

// ============== FOLDER MANAGEMENT HANDLERS ==============
// IPC handlers for message folder/label system

// List all folders with conversation counts
ipcMain.handle('folders:list', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT f.id, f.name, f.icon, f.color, f.description, f.sort_order, f.is_smart, (SELECT COUNT(*) FROM conversation_folders WHERE folder_id = f.id) as conversation_count FROM message_folders f ORDER BY f.sort_order, f.name" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Folders] List error:', error);
        resolve({ success: false, folders: [] });
        return;
      }
      
      try {
        const folders = JSON.parse(stdout || '[]');
        resolve({ success: true, folders });
      } catch (e) {
        safeLog.error('[Folders] Parse error:', e);
        resolve({ success: false, folders: [] });
      }
    });
  });
});

// Create new folder
ipcMain.handle('folders:create', async (_, folder: { name: string; icon?: string; color?: string; description?: string }) => {
  const icon = folder.icon || '📁';
  const color = folder.color || '#6366f1';
  const description = folder.description || '';
  
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO message_folders (name, icon, color, description) VALUES ('${folder.name.replace(/'/g, "''")}', '${icon}', '${color}', '${description.replace(/'/g, "''")}'); SELECT last_insert_rowid()"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Folders] Create error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      const folderId = parseInt(stdout.trim());
      resolve({ success: true, folderId });
    });
  });
});

// Update folder properties
ipcMain.handle('folders:update', async (_, folderId: number, updates: { name?: string; icon?: string; color?: string; description?: string; sort_order?: number }) => {
  const setParts: string[] = [];
  
  if (updates.name) setParts.push(`name = '${updates.name.replace(/'/g, "''")}'`);
  if (updates.icon) setParts.push(`icon = '${updates.icon}'`);
  if (updates.color) setParts.push(`color = '${updates.color}'`);
  if (updates.description !== undefined) setParts.push(`description = '${updates.description.replace(/'/g, "''")}'`);
  if (updates.sort_order !== undefined) setParts.push(`sort_order = ${updates.sort_order}`);
  
  if (setParts.length === 0) {
    return { success: false, error: 'No updates provided' };
  }
  
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE message_folders SET ${setParts.join(', ')} WHERE id = ${folderId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Folders] Update error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Delete folder
ipcMain.handle('folders:delete', async (_, folderId: number) => {
  const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM message_folders WHERE id = ${folderId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Folders] Delete error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Assign conversation to folder
ipcMain.handle('folders:assign', async (_, folderId: number, sessionKey: string, notes?: string) => {
  const notesValue = notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL';
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT OR IGNORE INTO conversation_folders (folder_id, session_key, notes) VALUES (${folderId}, '${sessionKey.replace(/'/g, "''")}', ${notesValue})"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Folders] Assign error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Unassign conversation from folder
ipcMain.handle('folders:unassign', async (_, folderId: number, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_folders WHERE folder_id = ${folderId} AND session_key = '${sessionKey.replace(/'/g, "''")}'`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Folders] Unassign error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Get folders for a specific conversation
ipcMain.handle('folders:for-conversation', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT f.id, f.name, f.icon, f.color, cf.added_at, cf.notes FROM conversation_folders cf JOIN message_folders f ON cf.folder_id = f.id WHERE cf.session_key = '${sessionKey.replace(/'/g, "''")}' ORDER BY f.sort_order, f.name" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Folders] Get for conversation error:', error);
        resolve({ success: false, folders: [] });
        return;
      }
      
      try {
        const folders = JSON.parse(stdout || '[]');
        resolve({ success: true, folders });
      } catch (e) {
        safeLog.error('[Folders] Parse error:', e);
        resolve({ success: false, folders: [] });
      }
    });
  });
});

// Get conversations in a folder
ipcMain.handle('folders:conversations', async (_, folderId: number) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT session_key, added_at, added_by, notes FROM conversation_folders WHERE folder_id = ${folderId} ORDER BY added_at DESC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Folders] Get conversations error:', error);
        resolve({ success: false, conversations: [] });
        return;
      }
      
      try {
        const conversations = JSON.parse(stdout || '[]');
        resolve({ success: true, conversations });
      } catch (e) {
        safeLog.error('[Folders] Parse error:', e);
        resolve({ success: false, conversations: [] });
      }
    });
  });
});

// ============== SMART FOLDER RULES HANDLERS ==============
// IPC handlers for smart folder auto-assignment rules

// List all rules
ipcMain.handle('folders:rules:list', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT f.id, f.name as folder_name, f.rules FROM message_folders f WHERE f.is_smart = 1" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[FolderRules] List error:', error);
        resolve({ success: false, rules: [] });
        return;
      }
      
      try {
        const folders = JSON.parse(stdout || '[]');
        const rules = folders.map((f: any) => {
          try {
            const parsed = f.rules ? JSON.parse(f.rules) : null;
            return parsed ? { ...parsed, folderId: f.id, folderName: f.folder_name } : null;
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        resolve({ success: true, rules });
      } catch (e) {
        safeLog.error('[FolderRules] Parse error:', e);
        resolve({ success: false, rules: [] });
      }
    });
  });
});

// Get rules for a specific folder
ipcMain.handle('folders:rules:get', async (_, folderId: number) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT rules FROM message_folders WHERE id = ${folderId}" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[FolderRules] Get error:', error);
        resolve({ success: false, rule: null });
        return;
      }
      
      try {
        const rows = JSON.parse(stdout || '[]');
        if (rows.length > 0 && rows[0].rules) {
          const rule = JSON.parse(rows[0].rules);
          resolve({ success: true, rule });
        } else {
          resolve({ success: true, rule: null });
        }
      } catch (e) {
        safeLog.error('[FolderRules] Parse error:', e);
        resolve({ success: false, rule: null });
      }
    });
  });
});

// Save rules for a folder
ipcMain.handle('folders:rules:save', async (_, folderId: number, rule: any) => {
  const rulesJson = JSON.stringify(rule).replace(/'/g, "''");
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE message_folders SET rules = '${rulesJson}', is_smart = 1 WHERE id = ${folderId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[FolderRules] Save error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Delete rules for a folder (make it non-smart)
ipcMain.handle('folders:rules:delete', async (_, folderId: number) => {
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE message_folders SET rules = NULL, is_smart = 0 WHERE id = ${folderId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[FolderRules] Delete error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});

// Auto-assign conversation based on rules
ipcMain.handle('folders:auto-assign', async (_, sessionKey: string, conversationData: any) => {
  // First, load all smart folder rules
  const listCmd = `sqlite3 "${froggoDbPath}" "SELECT f.id, f.name, f.rules FROM message_folders f WHERE f.is_smart = 1 AND f.rules IS NOT NULL" -json`;
  
  return new Promise((resolve) => {
    exec(listCmd, { timeout: 5000 }, async (error, stdout) => {
      if (error) {
        safeLog.error('[FolderRules] Auto-assign list error:', error);
        resolve({ success: false, matchedFolderIds: [] });
        return;
      }
      
      try {
        const folders = JSON.parse(stdout || '[]');
        const matchedFolderIds: number[] = [];
        
        for (const folder of folders) {
          try {
            const rule = JSON.parse(folder.rules);
            // Import and use rule evaluation logic (simplified here)
            // In production, this would use the folderRules.ts logic
            if (evaluateRuleSimple(rule, conversationData)) {
              matchedFolderIds.push(folder.id);
              
              // Auto-assign to folder
              const assignCmd = `sqlite3 "${froggoDbPath}" "INSERT OR IGNORE INTO conversation_folders (folder_id, session_key, added_by) VALUES (${folder.id}, '${sessionKey.replace(/'/g, "''")}', 'rule')"`;
              exec(assignCmd, { timeout: 5000 }, () => {});
            }
          } catch (e) {
            safeLog.error(`[FolderRules] Error evaluating rule for folder ${folder.id}:`, e);
          }
        }
        
        resolve({ success: true, matchedFolderIds });
      } catch (e) {
        safeLog.error('[FolderRules] Auto-assign parse error:', e);
        resolve({ success: false, matchedFolderIds: [] });
      }
    });
  });
});

// Simple rule evaluation (matching subset of folderRules.ts logic)
function evaluateRuleSimple(rule: any, data: any): boolean {
  if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  const results = rule.conditions.map((cond: any) => {
    let result = false;

    switch (cond.type) {
      case 'sender_matches':
        result = data.sender ? data.sender.includes(cond.value) : false;
        break;
      case 'sender_name_contains':
        result = data.senderName ? data.senderName.toLowerCase().includes(String(cond.value).toLowerCase()) : false;
        break;
      case 'content_contains':
        result = data.content ? data.content.toLowerCase().includes(String(cond.value).toLowerCase()) : false;
        break;
      case 'platform_is':
        result = data.platform ? data.platform.toLowerCase() === String(cond.value).toLowerCase() : false;
        break;
      case 'priority_above':
        result = data.priorityScore !== undefined ? data.priorityScore > Number(cond.value) : false;
        break;
      case 'priority_below':
        result = data.priorityScore !== undefined ? data.priorityScore < Number(cond.value) : false;
        break;
      case 'is_urgent':
        result = Boolean(data.isUrgent);
        break;
      case 'has_attachment':
        result = Boolean(data.hasAttachment);
        break;
      default:
        result = false;
    }

    return cond.negate ? !result : result;
  });

  return rule.operator === 'AND' ? results.every((r: boolean) => r) : results.some((r: boolean) => r);
}

// ============== PINNED CONVERSATIONS HANDLERS ==============
// IPC handlers for pinning/unpinning conversations

// Get all pinned conversations
ipcMain.handle('pins:list', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT id, session_key, pinned_at, pinned_by, notes, pin_order FROM conversation_pins ORDER BY pin_order ASC, pinned_at DESC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Pins] List error:', error);
        resolve({ success: false, pins: [] });
        return;
      }
      
      try {
        const pins = JSON.parse(stdout || '[]');
        resolve({ success: true, pins });
      } catch (e) {
        safeLog.error('[Pins] Parse error:', e);
        resolve({ success: false, pins: [] });
      }
    });
  });
});

// Check if a conversation is pinned
ipcMain.handle('pins:is-pinned', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT id FROM conversation_pins WHERE session_key = '${sessionKey.replace(/'/g, "''")}' LIMIT 1" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Pins] Is-pinned error:', error);
        resolve({ success: false, pinned: false });
        return;
      }
      
      try {
        const result = JSON.parse(stdout || '[]');
        resolve({ success: true, pinned: result.length > 0 });
      } catch (e) {
        safeLog.error('[Pins] Is-pinned parse error:', e);
        resolve({ success: false, pinned: false });
      }
    });
  });
});

// Pin a conversation
ipcMain.handle('pins:pin', async (_, sessionKey: string, notes?: string) => {
  // Check pin count first (max 10)
  const countCmd = `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as count FROM conversation_pins" -json`;
  
  return new Promise((resolve) => {
    exec(countCmd, { timeout: 5000 }, (countError, countStdout) => {
      if (countError) {
        safeLog.error('[Pins] Count check error:', countError);
        resolve({ success: false, error: countError.message });
        return;
      }
      
      try {
        const countResult = JSON.parse(countStdout || '[{"count":0}]');
        const currentCount = countResult[0]?.count || 0;
        
        // Check if already pinned (don't count against limit)
        const checkCmd = `sqlite3 "${froggoDbPath}" "SELECT id FROM conversation_pins WHERE session_key = '${sessionKey.replace(/'/g, "''")}' LIMIT 1" -json`;
        
        exec(checkCmd, { timeout: 5000 }, (checkError, checkStdout) => {
          if (checkError) {
            safeLog.error('[Pins] Check existing error:', checkError);
            resolve({ success: false, error: checkError.message });
            return;
          }
          
          try {
            const existing = JSON.parse(checkStdout || '[]');
            const isAlreadyPinned = existing.length > 0;
            
            // If not already pinned and at limit, reject
            if (!isAlreadyPinned && currentCount >= 10) {
              safeLog.error('[Pins] Pin limit reached (10 max)');
              resolve({ success: false, error: 'Maximum 10 pinned conversations allowed. Unpin another conversation first.' });
              return;
            }
            
            // Get next pin_order (highest + 1)
            const orderCmd = `sqlite3 "${froggoDbPath}" "SELECT COALESCE(MAX(pin_order), -1) + 1 as next_order FROM conversation_pins" -json`;
            
            exec(orderCmd, { timeout: 5000 }, (orderError, orderStdout) => {
              if (orderError) {
                safeLog.error('[Pins] Get order error:', orderError);
                resolve({ success: false, error: orderError.message });
                return;
              }
              
              try {
                const orderResult = JSON.parse(orderStdout || '[{"next_order":0}]');
                const nextOrder = orderResult[0]?.next_order || 0;
                
                const notesValue = notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL';
                const cmd = `sqlite3 "${froggoDbPath}" "INSERT OR REPLACE INTO conversation_pins (session_key, notes, pin_order) VALUES ('${sessionKey.replace(/'/g, "''")}', ${notesValue}, ${nextOrder})"`;
                
                exec(cmd, { timeout: 5000 }, (error) => {
                  if (error) {
                    safeLog.error('[Pins] Pin error:', error);
                    resolve({ success: false, error: error.message });
                    return;
                  }
                  
                  safeLog.log('[Pins] Pinned:', sessionKey, 'at order', nextOrder);
                  resolve({ success: true });
                });
              } catch (e) {
                safeLog.error('[Pins] Order parse error:', e);
                resolve({ success: false, error: 'Parse error' });
              }
            });
          } catch (e) {
            safeLog.error('[Pins] Check parse error:', e);
            resolve({ success: false, error: 'Parse error' });
          }
        });
      } catch (e) {
        safeLog.error('[Pins] Count parse error:', e);
        resolve({ success: false, error: 'Parse error' });
      }
    });
  });
});

// Unpin a conversation
ipcMain.handle('pins:unpin', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_pins WHERE session_key = '${sessionKey.replace(/'/g, "''")}'`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Pins] Unpin error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      safeLog.log('[Pins] Unpinned:', sessionKey);
      resolve({ success: true });
    });
  });
});

// Toggle pin state
ipcMain.handle('pins:toggle', async (_, sessionKey: string) => {
  // First check if pinned
  const checkCmd = `sqlite3 "${froggoDbPath}" "SELECT id FROM conversation_pins WHERE session_key = '${sessionKey.replace(/'/g, "''")}' LIMIT 1" -json`;
  
  return new Promise((resolve) => {
    exec(checkCmd, { timeout: 5000 }, (checkError, checkStdout) => {
      if (checkError) {
        safeLog.error('[Pins] Toggle check error:', checkError);
        resolve({ success: false, error: checkError.message });
        return;
      }
      
      try {
        const result = JSON.parse(checkStdout || '[]');
        const isPinned = result.length > 0;
        
        if (isPinned) {
          // Unpin
          const toggleCmd = `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_pins WHERE session_key = '${sessionKey.replace(/'/g, "''")}'"`; 
          
          exec(toggleCmd, { timeout: 5000 }, (toggleError) => {
            if (toggleError) {
              safeLog.error('[Pins] Toggle unpin error:', toggleError);
              resolve({ success: false, error: toggleError.message });
              return;
            }
            
            safeLog.log('[Pins] Toggled:', sessionKey, '→ unpinned');
            resolve({ success: true, pinned: false });
          });
        } else {
          // Pin - check limit first
          const countCmd = `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as count FROM conversation_pins" -json`;
          
          exec(countCmd, { timeout: 5000 }, (countError, countStdout) => {
            if (countError) {
              safeLog.error('[Pins] Toggle count error:', countError);
              resolve({ success: false, error: countError.message });
              return;
            }
            
            try {
              const countResult = JSON.parse(countStdout || '[{"count":0}]');
              const currentCount = countResult[0]?.count || 0;
              
              if (currentCount >= 10) {
                safeLog.error('[Pins] Toggle pin limit reached (10 max)');
                resolve({ success: false, error: 'Maximum 10 pinned conversations allowed. Unpin another conversation first.' });
                return;
              }
              
              // Get next pin_order
              const orderCmd = `sqlite3 "${froggoDbPath}" "SELECT COALESCE(MAX(pin_order), -1) + 1 as next_order FROM conversation_pins" -json`;
              
              exec(orderCmd, { timeout: 5000 }, (orderError, orderStdout) => {
                if (orderError) {
                  safeLog.error('[Pins] Toggle order error:', orderError);
                  resolve({ success: false, error: orderError.message });
                  return;
                }
                
                try {
                  const orderResult = JSON.parse(orderStdout || '[{"next_order":0}]');
                  const nextOrder = orderResult[0]?.next_order || 0;
                  
                  const toggleCmd = `sqlite3 "${froggoDbPath}" "INSERT INTO conversation_pins (session_key, pin_order) VALUES ('${sessionKey.replace(/'/g, "''")}', ${nextOrder})"`;
                  
                  exec(toggleCmd, { timeout: 5000 }, (toggleError) => {
                    if (toggleError) {
                      safeLog.error('[Pins] Toggle pin error:', toggleError);
                      resolve({ success: false, error: toggleError.message });
                      return;
                    }
                    
                    safeLog.log('[Pins] Toggled:', sessionKey, '→ pinned at order', nextOrder);
                    resolve({ success: true, pinned: true });
                  });
                } catch (e) {
                  safeLog.error('[Pins] Toggle order parse error:', e);
                  resolve({ success: false, error: 'Parse error' });
                }
              });
            } catch (e) {
              safeLog.error('[Pins] Toggle count parse error:', e);
              resolve({ success: false, error: 'Parse error' });
            }
          });
        }
      } catch (e) {
        safeLog.error('[Pins] Toggle parse error:', e);
        resolve({ success: false, error: 'Parse error' });
      }
    });
  });
});

// Reorder pinned conversations
ipcMain.handle('pins:reorder', async (_, sessionKeys: string[]) => {
  // Check pin limit (max 10)
  if (sessionKeys.length > 10) {
    safeLog.error('[Pins] Reorder error: Too many pins (max 10)');
    return { success: false, error: 'Cannot have more than 10 pinned conversations' };
  }

  // Update pin_order for each session
  const updates: Promise<any>[] = sessionKeys.map((sessionKey, index) => {
    const cmd = `sqlite3 "${froggoDbPath}" "UPDATE conversation_pins SET pin_order = ${index} WHERE session_key = '${sessionKey.replace(/'/g, "''")}'"`; 
    
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          safeLog.error('[Pins] Reorder update error for', sessionKey, ':', error);
          resolve({ success: false });
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  try {
    const results = await Promise.all(updates);
    const allSuccess = results.every((r: any) => r.success);
    
    if (allSuccess) {
      safeLog.log('[Pins] Reordered', sessionKeys.length, 'pins');
      return { success: true };
    } else {
      return { success: false, error: 'Some updates failed' };
    }
  } catch (e) {
    safeLog.error('[Pins] Reorder error:', e);
    return { success: false, error: 'Reorder failed' };
  }
});

// Get pin count
ipcMain.handle('pins:count', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as count FROM conversation_pins" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Pins] Count error:', error);
        resolve({ success: false, count: 0 });
        return;
      }
      
      try {
        const result = JSON.parse(stdout || '[{"count":0}]');
        resolve({ success: true, count: result[0]?.count || 0 });
      } catch (e) {
        safeLog.error('[Pins] Count parse error:', e);
        resolve({ success: false, count: 0 });
      }
    });
  });
});

// ============== SNOOZE HANDLERS ==============
// IPC handlers for conversation snooze system

// List all snoozed conversations
ipcMain.handle('snooze:list', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM conversation_snoozes ORDER BY snooze_until ASC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Snooze] List error:', error);
        resolve({ success: false, snoozes: [] });
        return;
      }
      try {
        const snoozes = JSON.parse(stdout || '[]');
        resolve({ success: true, snoozes });
      } catch (e) {
        safeLog.error('[Snooze] Parse error:', e);
        resolve({ success: false, snoozes: [] });
      }
    });
  });
});

// Check if a session is snoozed
ipcMain.handle('snooze:get', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM conversation_snoozes WHERE session_id = '${sessionKey.replace(/'/g, "''")}' LIMIT 1" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Snooze] Get error:', error);
        resolve({ success: false, snooze: null });
        return;
      }
      try {
        const result = JSON.parse(stdout || '[]');
        resolve({ 
          success: true, 
          snooze: result.length > 0 ? result[0] : null 
        });
      } catch (e) {
        safeLog.error('[Snooze] Parse error:', e);
        resolve({ success: false, snooze: null });
      }
    });
  });
});

// Set/update snooze for a conversation
ipcMain.handle('snooze:set', async (_, sessionKey: string, snoozeUntil: number, reason?: string) => {
  const now = Date.now();
  const reasonEscaped = reason ? reason.replace(/'/g, "''") : '';
  
  // Check if already snoozed (for update vs insert)
  const checkCmd = `sqlite3 "${froggoDbPath}" "SELECT id FROM conversation_snoozes WHERE session_id = '${sessionKey.replace(/'/g, "''")}' LIMIT 1" -json`;
  
  return new Promise((resolve) => {
    exec(checkCmd, { timeout: 5000 }, (checkError, checkStdout) => {
      if (checkError) {
        safeLog.error('[Snooze] Set check error:', checkError);
        resolve({ success: false, error: checkError.message });
        return;
      }
      
      try {
        const existing = JSON.parse(checkStdout || '[]');
        let snoozeCmd: string;
        
        if (existing.length > 0) {
          // Update existing snooze
          snoozeCmd = `sqlite3 "${froggoDbPath}" "UPDATE conversation_snoozes SET snooze_until = ${snoozeUntil}, snooze_reason = '${reasonEscaped}', reminder_sent = 0, updated_at = ${now} WHERE session_id = '${sessionKey.replace(/'/g, "''")}'"`; 
        } else {
          // Insert new snooze
          snoozeCmd = `sqlite3 "${froggoDbPath}" "INSERT INTO conversation_snoozes (session_id, snooze_until, snooze_reason, reminder_sent, created_at, updated_at) VALUES ('${sessionKey.replace(/'/g, "''")}', ${snoozeUntil}, '${reasonEscaped}', 0, ${now}, ${now})"`;
        }
        
        exec(snoozeCmd, { timeout: 5000 }, (snoozeError) => {
          if (snoozeError) {
            safeLog.error('[Snooze] Set error:', snoozeError);
            resolve({ success: false, error: snoozeError.message });
            return;
          }
          
          safeLog.log('[Snooze] Set:', sessionKey, 'until', new Date(snoozeUntil).toISOString());
          resolve({ success: true });
        });
      } catch (e) {
        safeLog.error('[Snooze] Set parse error:', e);
        resolve({ success: false, error: 'Parse error' });
      }
    });
  });
});

// Unsnooze a conversation (remove snooze)
ipcMain.handle('snooze:unset', async (_, sessionKey: string) => {
  const now = Date.now();
  
  // First get the snooze data for history
  const getCmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM conversation_snoozes WHERE session_id = '${sessionKey.replace(/'/g, "''")}' LIMIT 1" -json`;
  
  return new Promise((resolve) => {
    exec(getCmd, { timeout: 5000 }, (getError, getStdout) => {
      if (getError) {
        safeLog.error('[Snooze] Unset get error:', getError);
        resolve({ success: false, error: getError.message });
        return;
      }
      
      try {
        const snoozes = JSON.parse(getStdout || '[]');
        
        if (snoozes.length === 0) {
          // Not snoozed, nothing to do
          resolve({ success: true });
          return;
        }
        
        const snooze = snoozes[0];
        const reasonEscaped = snooze.snooze_reason ? snooze.snooze_reason.replace(/'/g, "''") : '';
        
        // Add to history
        const historyCmd = `sqlite3 "${froggoDbPath}" "INSERT INTO snooze_history (session_id, snooze_until, snooze_reason, unsnoozed_at, created_at) VALUES ('${sessionKey.replace(/'/g, "''")}', ${snooze.snooze_until}, '${reasonEscaped}', ${now}, ${snooze.created_at})"`;
        
        exec(historyCmd, { timeout: 5000 }, (historyError) => {
          if (historyError) {
            safeLog.warn('[Snooze] History insert error (non-fatal):', historyError);
          }
          
          // Delete from active snoozes
          const deleteCmd = `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_snoozes WHERE session_id = '${sessionKey.replace(/'/g, "''")}'"`; 
          
          exec(deleteCmd, { timeout: 5000 }, (deleteError) => {
            if (deleteError) {
              safeLog.error('[Snooze] Unset delete error:', deleteError);
              resolve({ success: false, error: deleteError.message });
              return;
            }
            
            safeLog.log('[Snooze] Unsnoozed:', sessionKey);
            resolve({ success: true });
          });
        });
      } catch (e) {
        safeLog.error('[Snooze] Unset parse error:', e);
        resolve({ success: false, error: 'Parse error' });
      }
    });
  });
});

// Mark reminder as sent for a snooze
ipcMain.handle('snooze:markReminderSent', async (_, sessionKey: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE conversation_snoozes SET reminder_sent = 1 WHERE session_id = '${sessionKey.replace(/'/g, "''")}'"`; 
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Snooze] Mark reminder error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      safeLog.log('[Snooze] Reminder marked sent:', sessionKey);
      resolve({ success: true });
    });
  });
});

// Get expired snoozes (for reminder processing)
ipcMain.handle('snooze:expired', async () => {
  const now = Date.now();
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM conversation_snoozes WHERE snooze_until <= ${now} AND reminder_sent = 0 ORDER BY snooze_until ASC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Snooze] Expired list error:', error);
        resolve({ success: false, snoozes: [] });
        return;
      }
      try {
        const snoozes = JSON.parse(stdout || '[]');
        resolve({ success: true, snoozes });
      } catch (e) {
        safeLog.error('[Snooze] Expired parse error:', e);
        resolve({ success: false, snoozes: [] });
      }
    });
  });
});

// Get snooze history for a session
ipcMain.handle('snooze:history', async (_, sessionKey: string, limit: number = 10) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM snooze_history WHERE session_id = '${sessionKey.replace(/'/g, "''")}' ORDER BY created_at DESC LIMIT ${limit}" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Snooze] History error:', error);
        resolve({ success: false, history: [] });
        return;
      }
      try {
        const history = JSON.parse(stdout || '[]');
        resolve({ success: true, history });
      } catch (e) {
        safeLog.error('[Snooze] History parse error:', e);
        resolve({ success: false, history: [] });
      }
    });
  });
});

// ============== CALENDAR EVENTS HANDLERS ==============
// IPC handlers for Epic Calendar events CRUD operations
// Updated to work with existing calendar_events schema

ipcMain.handle('calendar:events:list', async () => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata FROM calendar_events ORDER BY start_time ASC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Calendar] List error:', error);
        resolve({ success: false, events: [] });
        return;
      }
      try {
        const events = JSON.parse(stdout || '[]');
        resolve({ success: true, events });
      } catch (e) {
        safeLog.error('[Calendar] Parse error:', e);
        resolve({ success: false, events: [] });
      }
    });
  });
});

ipcMain.handle('calendar:events:get', async (_, eventId: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata FROM calendar_events WHERE id='${eventId}'" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Calendar] Get error:', error);
        resolve({ success: false, event: null });
        return;
      }
      try {
        const events = JSON.parse(stdout || '[]');
        if (events.length === 0) {
          resolve({ success: false, event: null, error: 'Event not found' });
        } else {
          resolve({ success: true, event: events[0] });
        }
      } catch (e) {
        safeLog.error('[Calendar] Parse error:', e);
        resolve({ success: false, event: null });
      }
    });
  });
});

ipcMain.handle('calendar:events:create', async (_, event: {
  title: string;
  description?: string;
  start_time: string | number;  // ISO string or Unix timestamp
  end_time?: string | number;
  all_day?: boolean;
  location?: string;
  color?: string;
  category?: string;
  status?: string;
  recurrence?: any;  // JSON object
  attendees?: any;  // JSON array
  reminders?: any;  // JSON array
  source?: string;
  source_id?: string;
  task_id?: string;
  metadata?: any;
}) => {
  // Generate event ID
  const eventId = `event-${Date.now()}`;
  const now = Date.now();
  
  // Escape strings for SQL
  const escapeSQL = (str: string | undefined) => str ? str.replace(/'/g, "''") : '';
  
  // Convert start_time to Unix timestamp if it's ISO string
  let start_time_ms: number;
  if (typeof event.start_time === 'string') {
    start_time_ms = new Date(event.start_time).getTime();
  } else {
    start_time_ms = event.start_time;
  }
  
  // Convert end_time to Unix timestamp if provided
  let end_time_ms: number | null = null;
  if (event.end_time) {
    if (typeof event.end_time === 'string') {
      end_time_ms = new Date(event.end_time).getTime();
    } else {
      end_time_ms = event.end_time;
    }
  }
  
  const title = escapeSQL(event.title);
  const description = event.description ? escapeSQL(event.description) : '';
  const all_day = event.all_day ? 1 : 0;
  const location = event.location ? escapeSQL(event.location) : '';
  const color = event.color ? escapeSQL(event.color) : '';
  const category = event.category ? escapeSQL(event.category) : '';
  const status = event.status ? escapeSQL(event.status) : 'confirmed';
  const recurrence = event.recurrence ? escapeSQL(JSON.stringify(event.recurrence)) : '';
  const attendees = event.attendees ? escapeSQL(JSON.stringify(event.attendees)) : '';
  const reminders = event.reminders ? escapeSQL(JSON.stringify(event.reminders)) : '';
  const source = event.source ? escapeSQL(event.source) : 'manual';
  const source_id = event.source_id ? escapeSQL(event.source_id) : '';
  const task_id = event.task_id ? escapeSQL(event.task_id) : '';
  const metadata = event.metadata ? escapeSQL(JSON.stringify(event.metadata)) : '';
  
  const end_time_sql = end_time_ms !== null ? end_time_ms : 'NULL';
  
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO calendar_events (id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata) VALUES ('${eventId}', '${title}', '${description}', ${start_time_ms}, ${end_time_sql}, ${all_day}, '${location}', '${color}', '${category}', '${status}', '${recurrence}', '${attendees}', '${reminders}', '${source}', '${source_id}', ${task_id ? `'${task_id}'` : 'NULL'}, ${now}, ${now}, '${metadata}')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Calendar] Create error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ 
        success: true, 
        event: {
          id: eventId,
          title: event.title,
          description: event.description,
          start_time: start_time_ms,
          end_time: end_time_ms,
          all_day,
          location: event.location,
          color: event.color,
          category: event.category,
          status: status,
          recurrence: event.recurrence,
          attendees: event.attendees,
          reminders: event.reminders,
          source: source,
          source_id: event.source_id,
          task_id: event.task_id,
          created_at: now,
          updated_at: now,
          metadata: event.metadata
        }
      });
    });
  });
});

ipcMain.handle('calendar:events:update', async (_, eventId: string, updates: {
  title?: string;
  description?: string;
  start_time?: string | number;
  end_time?: string | number;
  all_day?: boolean;
  location?: string;
  color?: string;
  category?: string;
  status?: string;
  recurrence?: any;
  attendees?: any;
  reminders?: any;
  source?: string;
  source_id?: string;
  task_id?: string;
  metadata?: any;
}) => {
  // Build UPDATE SET clause
  const setParts: string[] = [];
  const escapeSQL = (str: string | undefined) => str ? str.replace(/'/g, "''") : '';
  
  if (updates.title !== undefined) {
    setParts.push(`title='${escapeSQL(updates.title)}'`);
  }
  if (updates.description !== undefined) {
    setParts.push(`description='${escapeSQL(updates.description)}'`);
  }
  if (updates.start_time !== undefined) {
    const start_ms = typeof updates.start_time === 'string' 
      ? new Date(updates.start_time).getTime()
      : updates.start_time;
    setParts.push(`start_time=${start_ms}`);
  }
  if (updates.end_time !== undefined) {
    const end_ms = typeof updates.end_time === 'string'
      ? new Date(updates.end_time).getTime()
      : updates.end_time;
    setParts.push(`end_time=${end_ms}`);
  }
  if (updates.all_day !== undefined) {
    setParts.push(`all_day=${updates.all_day ? 1 : 0}`);
  }
  if (updates.location !== undefined) {
    setParts.push(`location='${escapeSQL(updates.location)}'`);
  }
  if (updates.color !== undefined) {
    setParts.push(`color='${escapeSQL(updates.color)}'`);
  }
  if (updates.category !== undefined) {
    setParts.push(`category='${escapeSQL(updates.category)}'`);
  }
  if (updates.status !== undefined) {
    setParts.push(`status='${escapeSQL(updates.status)}'`);
  }
  if (updates.recurrence !== undefined) {
    setParts.push(`recurrence='${escapeSQL(JSON.stringify(updates.recurrence))}'`);
  }
  if (updates.attendees !== undefined) {
    setParts.push(`attendees='${escapeSQL(JSON.stringify(updates.attendees))}'`);
  }
  if (updates.reminders !== undefined) {
    setParts.push(`reminders='${escapeSQL(JSON.stringify(updates.reminders))}'`);
  }
  if (updates.source !== undefined) {
    setParts.push(`source='${escapeSQL(updates.source)}'`);
  }
  if (updates.source_id !== undefined) {
    setParts.push(`source_id='${escapeSQL(updates.source_id)}'`);
  }
  if (updates.task_id !== undefined) {
    if (updates.task_id) {
      setParts.push(`task_id='${escapeSQL(updates.task_id)}'`);
    } else {
      setParts.push(`task_id=NULL`);
    }
  }
  if (updates.metadata !== undefined) {
    setParts.push(`metadata='${escapeSQL(JSON.stringify(updates.metadata))}'`);
  }
  
  if (setParts.length === 0) {
    return { success: false, error: 'No updates provided' };
  }
  
  // Add updated_at timestamp
  setParts.push(`updated_at=${Date.now()}`);
  
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE calendar_events SET ${setParts.join(', ')} WHERE id='${eventId}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Calendar] Update error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      // Fetch updated event
      const getCmd = `sqlite3 "${froggoDbPath}" "SELECT id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata FROM calendar_events WHERE id='${eventId}'" -json`;
      
      exec(getCmd, { timeout: 5000 }, (getError, getStdout) => {
        if (getError) {
          resolve({ success: true, event: null });
          return;
        }
        
        try {
          const events = JSON.parse(getStdout || '[]');
          resolve({ success: true, event: events[0] || null });
        } catch (e) {
          resolve({ success: true, event: null });
        }
      });
    });
  });
});

ipcMain.handle('calendar:events:delete', async (_, eventId: string) => {
  const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM calendar_events WHERE id='${eventId}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Calendar] Delete error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true });
    });
  });
});
// ============== EXECUTION HANDLERS ==============
ipcMain.handle('execute:tweet', async (_, content: string, taskId?: string) => {
  if (taskId) {
    exec(`froggo-db task-progress "${taskId}" "Posting tweet via X API..." --step "Execution"`, () => {});
  }

  try {
    const result = await xApi.postTweet(content);
    if (result.success) {
      safeLog.log('[Execute] Tweet posted:', result.id);
      if (taskId) {
        exec(`froggo-db task-progress "${taskId}" "Tweet posted successfully" --step "Complete"`, () => {});
        exec(`froggo-db task-complete "${taskId}" --outcome success`, () => {});
      }
      return { success: true, id: result.id };
    } else {
      safeLog.error('[Execute] Tweet error:', result.error);
      if (taskId) {
        exec(`froggo-db task-progress "${taskId}" "Failed: ${result.error}" --step "Error"`, () => {});
        exec(`froggo-db task-update "${taskId}" --status failed`, () => {});
      }
      return { success: false, error: result.error };
    }
  } catch (e: any) {
    safeLog.error('[Execute] Tweet exception:', e.message);
    if (taskId) {
      exec(`froggo-db task-update "${taskId}" --status failed`, () => {});
    }
    return { success: false, error: e.message };
  }
});

// ============== EMAIL IPC HANDLERS ==============
ipcMain.handle('email:send', async (_, options: { to: string; subject: string; body: string; account?: string }) => {
  safeLog.log('[Email:send] Sending email to:', options.to);
  
  // GUARD: Require recipient and account to prevent auth loops
  if (!options.to || !options.to.trim()) {
    safeLog.error('[Email:send] Missing recipient');
    return { success: false, error: 'Missing email recipient' };
  }
  if (!options.account || !options.account.trim()) {
    safeLog.error('[Email:send] Missing account - cannot send without GOG_ACCOUNT');
    return { success: false, error: 'Missing account - please specify which email account to send from' };
  }
  
  return new Promise((resolve) => {
    // Escape for shell
    const escapedTo = options.to.replace(/"/g, '\\"');
    const escapedSubject = (options.subject || 'No Subject').replace(/"/g, '\\"');
    const escapedBody = options.body.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    
    const cmd = `GOG_ACCOUNT="${options.account}" gog gmail send --to "${escapedTo}" --subject "${escapedSubject}" --body "${escapedBody}"`;
    safeLog.log('[Email:send] Command:', cmd.slice(0, 100) + '...');
    
    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Email:send] Error:', error.message, stderr);
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Email:send] Sent successfully:', stdout);
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// ============== INBOX IPC HANDLERS (froggo-db backed) ==============
// Add inbox item with custom metadata (used for Stage 2 email items)
ipcMain.handle('inbox:addWithMetadata', async (_, item: { 
  type: string; 
  title: string; 
  content: string; 
  context?: string; 
  channel?: string;
  metadata?: string;
}) => {
  safeLog.log('[Inbox:addWithMetadata] Adding item:', item.title);
  
  return new Promise((resolve) => {
    const now = Date.now();
    const escapedTitle = item.title.replace(/'/g, "''");
    const escapedContent = item.content.replace(/'/g, "''");
    const escapedContext = (item.context || '').replace(/'/g, "''");
    const escapedMetadata = (item.metadata || '{}').replace(/'/g, "''");
    
    const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, metadata, created) VALUES ('${item.type}', '${escapedTitle}', '${escapedContent}', '${escapedContext}', 'pending', '${item.channel || 'system'}', '${escapedMetadata}', datetime('now'))"`;
    
    exec(sqlCmd, { timeout: 10000 }, (error) => {
      if (error) {
        safeLog.error('[Inbox:addWithMetadata] Error:', error);
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Inbox:addWithMetadata] Added successfully');
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('inbox:list', async (_, status?: string) => {
  // Default to 'pending' if no status specified - we only want pending items in the inbox
  const effectiveStatus = status || 'pending';
  
  return new Promise((resolve) => {
    // Query directly via sqlite3
    const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE status='${effectiveStatus}' ORDER BY created DESC LIMIT 50" -json`;
    
    safeLog.log('[Inbox:list] Executing query for status:', effectiveStatus);
    safeLog.log('[Inbox:list] Command:', sqlCmd);
    
    exec(sqlCmd, { timeout: 5000 }, (err, jsonOut, stderr) => {
      if (err) {
        safeLog.error('[Inbox:list] Exec error:', err);
        safeLog.error('[Inbox:list] Stderr:', stderr);
        resolve({ success: false, items: [], error: err.message });
      } else {
        try {
          safeLog.log('[Inbox:list] Raw output length:', jsonOut?.length || 0);
          const items = JSON.parse(jsonOut || '[]');
          safeLog.log('[Inbox:list] SUCCESS - Parsed', items.length, 'items with status:', effectiveStatus);
          safeLog.log('[Inbox:list] First item:', items[0] ? JSON.stringify(items[0]).substring(0, 100) : 'none');
          resolve({ success: true, items });
        } catch (e) {
          safeLog.error('[Inbox:list] JSON Parse error:', e);
          safeLog.error('[Inbox:list] Raw output:', jsonOut);
          resolve({ success: false, items: [], error: (e as Error).message });
        }
      }
    });
  });
});

ipcMain.handle('inbox:add', async (_, item: { type: string; title: string; content: string; context?: string; channel?: string }) => {
  const escapedTitle = item.title.replace(/"/g, '\\"');
  const escapedContent = item.content.replace(/"/g, '\\"');
  const contextArg = item.context ? `--context "${item.context.replace(/"/g, '\\"')}"` : '';
  const channelArg = item.channel ? `--channel ${item.channel}` : '';
  
  // Run injection detection on content
  const injectionScriptPath = path.join(os.homedir(), 'clawd', 'scripts', 'injection-detect.sh');
  
  return new Promise((resolve) => {
    // Escape content for shell - use base64 to avoid shell injection issues
    const contentBase64 = Buffer.from(item.content).toString('base64');
    const detectCmd = `echo "${contentBase64}" | base64 -d | ${injectionScriptPath}`;
    
    exec(detectCmd, { timeout: 5000 }, (detectError, detectStdout) => {
      let injectionResult = null;
      
      try {
        if (detectStdout) {
          injectionResult = JSON.parse(detectStdout.trim());
          safeLog.log('[Inbox] Injection detection result:', injectionResult);
        }
      } catch (e) {
        safeLog.error('[Inbox] Failed to parse injection detection result:', e);
      }
      
      // Build metadata with injection detection result
      let metadata: any = {};
      if (injectionResult && injectionResult.detected) {
        metadata.injectionWarning = {
          detected: true,
          type: injectionResult.type,
          pattern: injectionResult.pattern,
          risk: injectionResult.risk,
        };
        safeLog.log(`[Inbox] ⚠️ INJECTION DETECTED: ${injectionResult.type} (${injectionResult.risk}) - pattern: "${injectionResult.pattern}"`);
      }
      
      // Add to inbox via direct SQL to include metadata
      const now = Date.now();
      const metadataJson = JSON.stringify(metadata).replace(/'/g, "''");
      const escapedTitleSql = item.title.replace(/'/g, "''");
      const escapedContentSql = item.content.replace(/'/g, "''");
      const escapedContextSql = (item.context || '').replace(/'/g, "''");
      
      const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, metadata, created) VALUES ('${item.type}', '${escapedTitleSql}', '${escapedContentSql}', '${escapedContextSql}', 'pending', '${item.channel || 'unknown'}', '${metadataJson}', datetime('now'))"`;
      
      exec(sqlCmd, { timeout: 10000 }, (error) => {
        if (error) {
          safeLog.error('[Inbox] Add error:', error);
          resolve({ success: false, error: error.message });
        } else {
          resolve({ 
            success: true, 
            injectionWarning: injectionResult?.detected ? injectionResult : null 
          });
        }
      });
    });
  });
});

ipcMain.handle('inbox:update', async (_, id: number | string, updates: { status?: string; feedback?: string }) => {
  safeLog.log('[Inbox:update] Called with id:', id, 'type:', typeof id, 'updates:', updates);
  
  // Skip if it's a task-review item (those should go through tasks:update)
  if (typeof id === 'string' && id.startsWith('task-review-')) {
    safeLog.log('[Inbox:update] Skipping task-review item');
    return { success: true, skipped: true };
  }
  
  const sets: string[] = [];
  if (updates.status) sets.push(`status='${updates.status}'`);
  if (updates.feedback) sets.push(`feedback='${updates.feedback.replace(/'/g, "''")}'`);
  if (updates.status) sets.push(`reviewed_at=datetime('now')`);
  
  if (sets.length === 0) return { success: false };
  
  const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET ${sets.join(', ')} WHERE id=${id}"`;
  safeLog.log('[Inbox:update] Running:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      safeLog.log('[Inbox:update] Result - error:', error, 'stdout:', stdout, 'stderr:', stderr);
      resolve({ success: !error });
    });
  });
});

ipcMain.handle('inbox:approveAll', async () => {
  return new Promise((resolve) => {
    // Count pending items first
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT COUNT(*) FROM inbox WHERE status='pending'"`, (_, countOut) => {
      const count = parseInt(countOut?.trim() || '0', 10);
      
      // Approve all pending
      const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET status='approved', reviewed_at=datetime('now') WHERE status='pending'"`;
      
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, count });
        }
      });
    });
  });
});

// ============== INBOX REVISION HANDLERS ==============
// List items that need revision (for agents to process)
ipcMain.handle('inbox:listRevisions', async () => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE status='needs-revision' ORDER BY created DESC" -json`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Inbox] List revisions error:', error);
        resolve({ success: false, items: [] });
        return;
      }
      try {
        const items = JSON.parse(stdout || '[]');
        resolve({ success: true, items });
      } catch {
        resolve({ success: true, items: [] });
      }
    });
  });
});

// Submit revised content for an inbox item
// This creates a new pending item with the revised content and marks the original as 'revised'
ipcMain.handle('inbox:submitRevision', async (_, originalId: number, revisedContent: string, revisedTitle?: string) => {
  safeLog.log(`[Inbox] Submit revision for item ${originalId}`);
  
  return new Promise((resolve) => {
    // First, get the original item
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE id=${originalId}" -json`, (getErr, getOut) => {
      if (getErr) {
        safeLog.error('[Inbox] Get original error:', getErr);
        resolve({ success: false, error: 'Failed to get original item' });
        return;
      }
      
      try {
        const items = JSON.parse(getOut || '[]');
        if (items.length === 0) {
          resolve({ success: false, error: 'Original item not found' });
          return;
        }
        
        const original = items[0];
        const newTitle = revisedTitle || `[Revised] ${original.title}`;
        const escapedTitle = newTitle.replace(/'/g, "''");
        const escapedContent = revisedContent.replace(/'/g, "''");
        const context = `Revision of inbox item #${originalId}. Original feedback: ${(original.feedback || 'none').replace(/'/g, "''")}`;
        
        // Create new pending item with revised content
        const insertCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, created) VALUES ('${original.type}', '${escapedTitle}', '${escapedContent}', '${context}', 'pending', '${original.source_channel || 'revision'}', datetime('now'))"`;
        
        exec(insertCmd, { timeout: 5000 }, (insertErr) => {
          if (insertErr) {
            safeLog.error('[Inbox] Insert revision error:', insertErr);
            resolve({ success: false, error: insertErr.message });
            return;
          }
          
          // Mark original as 'revised' (completed state)
          const updateCmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE inbox SET status='revised', reviewed_at=datetime('now') WHERE id=${originalId}"`;
          
          exec(updateCmd, { timeout: 5000 }, (updateErr) => {
            if (updateErr) {
              safeLog.error('[Inbox] Update original error:', updateErr);
              // Still return success since the revision was created
            }
            
            safeLog.log(`[Inbox] Revision submitted: original #${originalId} -> new pending item`);
            
            // Notify frontend of inbox update
            safeSend('inbox-updated', { revision: true, originalId });
            
            resolve({ success: true, message: 'Revision submitted for approval' });
          });
        });
      } catch (e: any) {
        safeLog.error('[Inbox] Parse error:', e);
        resolve({ success: false, error: e.message });
      }
    });
  });
});

// Get revision details for a specific item (includes original content and feedback)
ipcMain.handle('inbox:getRevisionContext', async (_, itemId: number) => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM inbox WHERE id=${itemId} AND status='needs-revision'" -json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      try {
        const items = JSON.parse(stdout || '[]');
        if (items.length === 0) {
          resolve({ success: false, error: 'Item not found or not in needs-revision status' });
          return;
        }
        
        const item = items[0];
        resolve({
          success: true,
          item: {
            id: item.id,
            type: item.type,
            title: item.title,
            originalContent: item.content,
            feedback: item.feedback,
            context: item.context,
            created: item.created,
            sourceChannel: item.source_channel,
          }
        });
      } catch {
        resolve({ success: false, error: 'Failed to parse item' });
      }
    });
  });
});

// ============== INBOX FILTER & SEARCH IPC HANDLERS ==============
ipcMain.handle('inbox:toggleStar', async (_, messageId: string) => {
  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh toggle-star "${messageId}"`;
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

ipcMain.handle('inbox:markRead', async (_, messageId: string, isRead: boolean = true) => {
  // Also update comms_cache directly for consistency
  const escapedId = messageId.replace(/'/g, "''");
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  runMsgCmd(`sqlite3 "${dbPath}" "UPDATE comms_cache SET is_read=${isRead ? 1 : 0} WHERE external_id='${escapedId}'"`, 2000).catch(() => {});

  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh mark-read "${messageId}" "${isRead ? '1' : '0'}"`;
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

ipcMain.handle('inbox:addTag', async (_, messageId: string, tag: string) => {
  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh add-tag "${messageId}" "${tag}"`;
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

ipcMain.handle('inbox:removeTag', async (_, messageId: string, tag: string) => {
  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh remove-tag "${messageId}" "${tag}"`;
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

ipcMain.handle('inbox:setProject', async (_, messageId: string, project: string) => {
  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh set-project "${messageId}" "${project}"`;
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

ipcMain.handle('inbox:search', async (_, query: string, limit: number = 50) => {
  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh search "${query}" ${limit}`;
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        // Parse sqlite output (pipe-separated or JSON)
        const results = stdout.trim().split('\n').filter(Boolean);
        resolve({ success: true, results });
      } catch {
        resolve({ success: false, error: 'Failed to parse search results' });
      }
    });
  });
});

ipcMain.handle('inbox:filter', async (_, criteria: any) => {
  return new Promise((resolve) => {
    const criteriaJson = JSON.stringify(criteria).replace(/'/g, "\\'");
    const cmd = `echo '${criteriaJson}' | ~/clawd/scripts/inbox-filter.sh filter`;
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        const results = stdout.trim().split('\n').filter(Boolean);
        resolve({ success: true, results });
      } catch {
        resolve({ success: false, error: 'Failed to parse filter results' });
      }
    });
  });
});

ipcMain.handle('inbox:getSuggestions', async (_, type: 'senders' | 'projects' | 'tags' | 'platforms') => {
  return new Promise((resolve) => {
    const cmd = `~/clawd/scripts/inbox-filter.sh suggestions ${type}`;
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        const suggestions = stdout.trim().split('\n').filter(Boolean);
        resolve({ success: true, suggestions });
      } catch {
        resolve({ success: false, error: 'Failed to parse suggestions' });
      }
    });
  });
});

// ============== VIP SENDER IPC HANDLERS ==============

// List all VIP senders
ipcMain.handle('vip:list', async (_, category?: string) => {
  return new Promise((resolve) => {
    let cmd = `froggo-db vip-list --json`;
    if (category) {
      cmd += ` --category "${category}"`;
    }
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      
      try {
        const vips = JSON.parse(stdout || '[]');
        resolve(vips);
      } catch {
        resolve([]);
      }
    });
  });
});

// Add VIP sender
ipcMain.handle('vip:add', async (_, data: {
  identifier: string;
  label: string;
  type?: string;
  category?: string;
  boost?: number;
  notes?: string;
}) => {
  return new Promise((resolve) => {
    const type = data.type || 'email';
    const boost = data.boost || 30;
    
    let cmd = `froggo-db vip-add "${data.identifier}" "${data.label}" --type "${type}" --boost ${boost}`;
    
    if (data.category) {
      cmd += ` --category "${data.category}"`;
    }
    if (data.notes) {
      cmd += ` --notes "${data.notes}"`;
    }
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      // Extract VIP ID from output
      const idMatch = stdout.match(/ID: (\d+)/);
      const vipId = idMatch ? parseInt(idMatch[1]) : null;
      
      resolve({ 
        success: true, 
        id: vipId,
        message: 'VIP added successfully' 
      });
    });
  });
});

// Update VIP sender
ipcMain.handle('vip:update', async (_, id: number, updates: {
  label?: string;
  boost?: number;
  category?: string;
  notes?: string;
}) => {
  return new Promise((resolve) => {
    let cmd = `froggo-db vip-update ${id}`;
    
    if (updates.label) {
      cmd += ` --label "${updates.label}"`;
    }
    if (updates.boost !== undefined) {
      cmd += ` --boost ${updates.boost}`;
    }
    if (updates.category) {
      cmd += ` --category "${updates.category}"`;
    }
    if (updates.notes) {
      cmd += ` --notes "${updates.notes}"`;
    }
    
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true, message: 'VIP updated successfully' });
    });
  });
});

// Remove VIP sender
ipcMain.handle('vip:remove', async (_, id: number) => {
  return new Promise((resolve) => {
    const cmd = `froggo-db vip-remove ${id}`;
    
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      resolve({ success: true, message: 'VIP removed successfully' });
    });
  });
});

// Check if identifier is VIP
ipcMain.handle('vip:check', async (_, identifier: string) => {
  return new Promise((resolve) => {
    const cmd = `froggo-db vip-check "${identifier}" --json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      
      try {
        const result = JSON.parse(stdout || '{"vip":false}');
        if (result.vip === false) {
          resolve(null);
        } else {
          resolve(result);
        }
      } catch {
        resolve(null);
      }
    });
  });
});

// ============== SCREENSHOT IPC HANDLERS ==============
ipcMain.handle('screenshot:capture', async (_, outputPath: string) => {
  return new Promise((resolve) => {
    if (mainWindow) {
      mainWindow.webContents.capturePage().then((image) => {
        const pngBuffer = image.toPNG();
        const fs = require('fs');
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

// ============== SCHEDULE IPC HANDLERS ==============
const scheduleDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');

ipcMain.handle('schedule:list', async () => {
  safeLog.log('[Schedule:list] Called');
  return new Promise((resolve) => {
    const cmd = `sqlite3 ${scheduleDbPath} "
      CREATE TABLE IF NOT EXISTS schedule (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        sent_at TEXT,
        error TEXT,
        metadata TEXT
      );
      SELECT * FROM schedule ORDER BY scheduled_for ASC;
    " -json 2>/dev/null || echo '[]'`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      safeLog.log('[Schedule:list] Raw output:', stdout?.slice(0, 200));
      try {
        // JSON output may span multiple lines - find [ and take everything from there
        const trimmed = stdout.trim();
        const jsonStart = trimmed.indexOf('[');
        const jsonStr = jsonStart >= 0 ? trimmed.slice(jsonStart) : '[]';
        safeLog.log('[Schedule:list] JSON extracted, length:', jsonStr.length);
        const items = JSON.parse(jsonStr).map((row: any) => ({
          id: row.id,
          type: row.type,
          content: row.content,
          scheduledFor: row.scheduled_for,
          status: row.status,
          createdAt: row.created_at,
          sentAt: row.sent_at,
          error: row.error,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
        safeLog.log('[Schedule:list] Parsed', items.length, 'items');
        resolve({ success: true, items });
      } catch (e) {
        safeLog.error('[Schedule:list] Error:', e);
        resolve({ success: true, items: [] });
      }
    });
  });
});

ipcMain.handle('schedule:add', async (_, item: { type: string; content: string; scheduledFor: string; metadata?: any }) => {
  safeLog.log('[Schedule:add] Received:', JSON.stringify(item, null, 2));
  
  const id = `sched-${Date.now()}`;
  // Escape for SQL single-quoted strings: double the single quotes
  const escapedContent = item.content.replace(/'/g, "''");
  const escapedMetadata = item.metadata 
    ? JSON.stringify(item.metadata).replace(/'/g, "''")
    : null;
  
  safeLog.log('[Schedule:add] Escaped metadata:', escapedMetadata);
  
  return new Promise((resolve) => {
    // First ensure the schedule table exists
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS schedule (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        sent_at TEXT,
        error TEXT,
        metadata TEXT
      );
    `;
    
    exec(`sqlite3 "${scheduleDbPath}" "${createTableSql}"`, { timeout: 5000 }, (createError) => {
      if (createError) {
        safeLog.error('[Schedule:add] Failed to create table:', createError.message);
        resolve({ success: false, error: 'Failed to initialize schedule table: ' + createError.message });
        return;
      }
      
      // Build SQL and write to temp file to avoid shell escaping nightmares
      const metadataVal = escapedMetadata ? `'${escapedMetadata}'` : 'NULL';
      const sql = `INSERT INTO schedule (id, type, content, scheduled_for, metadata) VALUES ('${id}', '${item.type}', '${escapedContent}', '${item.scheduledFor}', ${metadataVal});`;
      const tmpFile = `/tmp/schedule-${id}.sql`;
      
      safeLog.log('[Schedule:add] SQL:', sql);
      safeLog.log('[Schedule:add] Writing to:', tmpFile);
      
      fs.writeFileSync(tmpFile, sql);
      const insertCmd = `sqlite3 "${scheduleDbPath}" < "${tmpFile}"`;
      
      exec(insertCmd, { timeout: 5000 }, (error) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}
      
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }

      // Create cron job to execute at scheduled time
      const cronTime = new Date(item.scheduledFor);
      const cronText = item.type === 'tweet' 
        ? `Execute scheduled tweet: ${item.content.slice(0, 50)}...`
        : `Execute scheduled email to ${item.metadata?.recipient}: ${item.content.slice(0, 50)}...`;
      
      // Use Clawdbot cron API
      fetch('http://localhost:18789/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          job: {
            id: id,
            text: cronText,
            schedule: cronTime.toISOString(),
            enabled: true,
          }
        })
      }).then(() => {
        resolve({ success: true, id });
      }).catch((e) => {
        // Cron failed but item is in DB
        resolve({ success: true, id, warning: 'Cron job creation failed' });
      });
    });
    }); // Close createTableSql exec callback
  });
});

ipcMain.handle('schedule:cancel', async (_, id: string) => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ${scheduleDbPath} "UPDATE schedule SET status='cancelled' WHERE id='${id}'"`;
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        // Also remove cron job
        fetch('http://localhost:18789/api/cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove', jobId: id })
        }).catch(() => {});
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('schedule:update', async (_, id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: any }) => {
  const sets: string[] = [];
  if (item.type) sets.push(`type='${item.type}'`);
  if (item.content) sets.push(`content='${item.content.replace(/'/g, "''")}'`);
  if (item.scheduledFor) sets.push(`scheduled_for='${item.scheduledFor}'`);
  if (item.metadata) sets.push(`metadata='${JSON.stringify(item.metadata).replace(/'/g, "''")}'`);
  
  if (sets.length === 0) return { success: false, error: 'No updates provided' };
  
  return new Promise((resolve) => {
    const cmd = `sqlite3 ${scheduleDbPath} "UPDATE schedule SET ${sets.join(', ')} WHERE id='${id}'"`;
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('schedule:sendNow', async (_, id: string) => {
  return new Promise((resolve) => {
    // Get the scheduled item
    exec(`sqlite3 ${scheduleDbPath} "SELECT * FROM schedule WHERE id='${id}'" -json`, async (_, stdout) => {
      try {
        const items = JSON.parse(stdout || '[]');
        if (items.length === 0) {
          resolve({ success: false, error: 'Item not found' });
          return;
        }

        const item = items[0];

        // Execute immediately based on type
        let execCmd = '';
        if (item.type === 'tweet') {
          // Post via X API directly
          try {
            const result = await xApi.postTweet(item.content);
            if (result.success) {
              exec(`sqlite3 "${scheduleDbPath}" "UPDATE schedule SET status='completed' WHERE id='${id}'"`, () => {});
              resolve({ success: true, id: result.id });
            } else {
              resolve({ success: false, error: result.error });
            }
          } catch (e: any) {
            resolve({ success: false, error: e.message });
          }
          return;
        } else if (item.type === 'email') {
          const meta = item.metadata ? JSON.parse(item.metadata) : {};
          const recipient = meta.recipient || meta.to || '';
          const account = meta.account || '';
          
          // GUARD: Require recipient and account for email sends
          if (!recipient || !recipient.trim()) {
            resolve({ success: false, error: 'Missing email recipient' });
            return;
          }
          if (!account || !account.trim()) {
            resolve({ success: false, error: 'Missing GOG account - cannot send email without account' });
            return;
          }
          
          // Create draft instead of sending directly (requires approval)
          execCmd = `GOG_ACCOUNT="${account}" gog gmail drafts create --to "${recipient}" --subject "${meta.subject || 'No subject'}" --body "${item.content.replace(/"/g, '\\"')}"`;
        }
        
        if (!execCmd) {
          resolve({ success: false, error: 'Unknown item type' });
          return;
        }
        
        exec(execCmd, { timeout: 30000 }, (execError) => {
          // Update status
          const status = execError ? 'failed' : 'sent';
          const errorMsg = execError ? execError.message.replace(/'/g, "''") : null;
          
          exec(`sqlite3 ${scheduleDbPath} "UPDATE schedule SET status='${status}', sent_at=datetime('now')${errorMsg ? ", error='" + errorMsg + "'" : ''} WHERE id='${id}'"`, () => {
            resolve({ success: !execError, error: execError?.message });
          });
        });
      } catch (e) {
        resolve({ success: false, error: String(e) });
      }
    });
  });
});

// ============== MESSAGING SEARCH IPC HANDLERS ==============
// NOTE: discordcli has no search command - would need to fetch recent messages and filter
// tgcli search only searches chat names, not message content
// wacli has proper FTS5 message search

ipcMain.handle('search:discord', async () => {
  // Discord CLI doesn't support search - return empty
  // Future: could fetch recent DMs and filter client-side
  return { success: false, messages: [], note: 'Discord search not available (CLI limitation)' };
});

ipcMain.handle('search:telegram', async (_, query: string) => {
  return new Promise((resolve) => {
    const escapedQuery = query.replace(/"/g, '\\"');
    // tgcli search only searches chat NAMES, not message content
    const cmd = `tgcli search "${escapedQuery}" --json 2>/dev/null || echo '{"chats":[]}'`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, chats: [], note: 'Telegram search failed' });
        return;
      }
      try {
        const result = JSON.parse(stdout || '{"chats":[]}');
        // Convert chat results to message-like format
        const chats = result.chats || result || [];
        resolve({ 
          success: true, 
          messages: Array.isArray(chats) ? chats.map((c: any) => ({
            id: c.id,
            type: 'chat',
            content: `Chat: ${c.name || c.title}`,
            from: c.name || c.title,
          })) : [],
          note: 'Searches chat names only'
        });
      } catch {
        resolve({ success: true, messages: [], raw: stdout });
      }
    });
  });
});

ipcMain.handle('search:whatsapp', async (_, query: string) => {
  return new Promise((resolve) => {
    const escapedQuery = query.replace(/"/g, '\\"');
    // wacli has proper FTS5 message search
    const cmd = `wacli messages search "${escapedQuery}" --json --limit 10`;
    
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, messages: [], error: error.message });
        return;
      }
      try {
        const result = JSON.parse(stdout || '{}');
        const messages = result.data?.messages || [];
        resolve({ 
          success: true, 
          messages: messages.map((m: any) => ({
            id: m.MsgID,
            content: m.Text || m.DisplayText,
            from: m.ChatName,
            timestamp: m.Timestamp,
            body: m.Text,
          }))
        });
      } catch {
        resolve({ success: true, messages: [], raw: stdout });
      }
    });
  });
});

// ============== FILESYSTEM IPC HANDLERS ==============
ipcMain.handle('fs:writeBase64', async (_, filePath: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error: any) {
    safeLog.error('[FS] Write error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (_, filePath: string, encoding?: string) => {
  try {
    const content = fs.readFileSync(filePath, encoding as BufferEncoding || 'utf8');
    return { success: true, content };
  } catch (error: any) {
    safeLog.error('[FS] Read error:', error);
    return { success: false, error: error.message };
  }
});

// Append to file
ipcMain.handle('fs:append', async (_, filePath: string, content: string) => {
  try {
    // Resolve ~ to home directory if present
    const resolvedPath = filePath.startsWith('~') 
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;
    
    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.appendFileSync(resolvedPath, content);
    return { success: true, path: resolvedPath };
  } catch (error: any) {
    safeLog.error('[FS] Append error:', error);
    return { success: false, error: error.message };
  }
});

// Execute SQL against froggo.db
ipcMain.handle('db:exec', async (_, query: string, params?: any[]) => {
  return new Promise((resolve) => {
    const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
    
    // For safety, only allow SELECT and INSERT statements from the renderer
    const queryLower = query.trim().toLowerCase();
    if (!queryLower.startsWith('select') && !queryLower.startsWith('insert')) {
      resolve({ success: false, error: 'Only SELECT and INSERT queries are allowed from renderer' });
      return;
    }
    
    // Escape params and build command
    let finalQuery = query;
    if (params && params.length > 0) {
      // Simple param substitution (replace ? with escaped values)
      params.forEach(param => {
        const escaped = String(param).replace(/'/g, "''");
        finalQuery = finalQuery.replace('?', `'${escaped}'`);
      });
    }
    
    const cmd = `sqlite3 "${dbPath}" "${finalQuery.replace(/"/g, '\\"')}" -json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[DB] Exec error:', error, stderr);
        resolve({ success: false, error: error.message });
        return;
      }
      
      try {
        // For INSERT, stdout might be empty
        if (queryLower.startsWith('insert')) {
          resolve({ success: true, result: [] });
        } else {
          const result = JSON.parse(stdout || '[]');
          resolve({ success: true, result });
        }
      } catch (parseError: any) {
        safeLog.error('[DB] Parse error:', parseError);
        resolve({ success: false, error: 'Failed to parse database result' });
      }
    });
  });
});

// ============== MEDIA UPLOAD IPC HANDLERS ==============
const uploadsDir = path.join(os.homedir(), 'clawd', 'uploads');

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
const libraryDir = path.join(os.homedir(), 'clawd', 'library');

ipcMain.handle('library:list', async (_, category?: string) => {
  // Ensure library directory exists
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }
  
  return new Promise((resolve) => {
    const categoryFilter = category ? `WHERE category='${category}'` : '';
    const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM library ${categoryFilter} ORDER BY updated_at DESC" -json 2>/dev/null || echo '[]'`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: true, files: [] });
        return;
      }
      try {
        const rawFiles = JSON.parse(stdout || '[]');
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
          
          return {
            id: f.id || '',
            name: f.name || 'Unnamed',
            path: f.path || '',
            category: f.category || 'other',
            size: f.size || 0,
            mimeType: f.mime_type || null,
            createdAt: f.created_at || new Date().toISOString(),
            updatedAt: f.updated_at || new Date().toISOString(),
            linkedTasks,
            tags,
          };
        });
        
        safeLog.log(`[library:list] Returning ${files.length} files`);
        resolve({ success: true, files });
      } catch (parseError) {
        safeLog.error('[library:list] Parse error:', parseError);
        resolve({ success: true, files: [] });
      }
    });
  });
});

ipcMain.handle('library:upload', async () => {
  const { dialog } = require('electron');
  
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
  const ext = path.extname(fileName).toLowerCase();
  let category = 'other';
  if (['.md', '.txt', '.draft'].includes(ext)) category = 'draft';
  else if (['.pdf', '.doc', '.docx'].includes(ext)) category = 'document';
  else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov'].includes(ext)) category = 'media';
  
  // Insert into database
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/clawd/data/froggo.db "
      CREATE TABLE IF NOT EXISTS library (
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
      );
      INSERT INTO library (id, name, path, category, size) VALUES ('${fileId}', '${fileName.replace(/'/g, "''")}', '${destPath.replace(/'/g, "''")}', '${category}', ${stats.size});
    "`;
    
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, file: { id: fileId, name: fileName, path: destPath, category, size: stats.size } });
      }
    });
  });
});

ipcMain.handle('library:delete', async (_, fileId: string) => {
  return new Promise((resolve) => {
    // Get file path first
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT path FROM library WHERE id='${fileId}'" -json`, (_, stdout) => {
      try {
        const rows = JSON.parse(stdout || '[]');
        if (rows.length > 0 && rows[0].path) {
          // Delete file
          if (fs.existsSync(rows[0].path)) {
            fs.unlinkSync(rows[0].path);
          }
        }
      } catch {}
      
      // Delete from database
      exec(`sqlite3 ~/clawd/data/froggo.db "DELETE FROM library WHERE id='${fileId}'"`, (error) => {
        resolve({ success: !error });
      });
    });
  });
});

ipcMain.handle('library:link', async (_, fileId: string, taskId: string) => {
  return new Promise((resolve) => {
    // Get current linked tasks
    exec(`sqlite3 ~/clawd/data/froggo.db "SELECT linked_tasks FROM library WHERE id='${fileId}'"`, (_, stdout) => {
      let linkedTasks: string[] = [];
      try {
        const current = stdout?.trim();
        if (current) linkedTasks = JSON.parse(current);
      } catch {}
      
      if (!linkedTasks.includes(taskId)) {
        linkedTasks.push(taskId);
      }
      
      const cmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE library SET linked_tasks='${JSON.stringify(linkedTasks)}', updated_at=datetime('now') WHERE id='${fileId}'"`;
      exec(cmd, (error) => {
        resolve({ success: !error });
      });
    });
  });
});

ipcMain.handle('library:view', async (_, fileId: string) => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/Froggo/clawd/data/froggo.db "SELECT path, mime_type, name FROM library WHERE id='${fileId}'" -json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      try {
        const rows = JSON.parse(stdout.trim() || '[]');
        if (rows.length === 0) {
          resolve({ success: false, error: 'File not found' });
          return;
        }
        
        const file = rows[0];
        const filePath = file.path.replace('~', process.env.HOME || '');
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          resolve({ success: false, error: 'File does not exist on disk' });
          return;
        }
        
        // For text files, read content
        const mimeType = file.mime_type || '';
        if (mimeType.includes('text/') || mimeType.includes('markdown') || mimeType.includes('json')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          resolve({ 
            success: true, 
            content, 
            mimeType,
            name: file.name,
            path: filePath,
            viewType: 'text'
          });
        } else if (mimeType.startsWith('image/')) {
          // For images, return base64
          const buffer = fs.readFileSync(filePath);
          const base64 = buffer.toString('base64');
          resolve({ 
            success: true, 
            content: `data:${mimeType};base64,${base64}`,
            mimeType,
            name: file.name,
            path: filePath,
            viewType: 'image'
          });
        } else {
          // For other files, just return metadata
          resolve({ 
            success: true, 
            mimeType,
            name: file.name,
            path: filePath,
            viewType: 'binary'
          });
        }
      } catch (parseError: any) {
        resolve({ success: false, error: parseError.message });
      }
    });
  });
});

ipcMain.handle('library:download', async (_, fileId: string) => {
  return new Promise((resolve) => {
    const cmd = `sqlite3 ~/Froggo/clawd/data/froggo.db "SELECT path, name FROM library WHERE id='${fileId}'" -json`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message });
        return;
      }
      
      try {
        const rows = JSON.parse(stdout.trim() || '[]');
        if (rows.length === 0) {
          resolve({ success: false, error: 'File not found' });
          return;
        }
        
        const file = rows[0];
        const sourcePath = file.path.replace('~', process.env.HOME || '');
        
        // Check if file exists
        if (!fs.existsSync(sourcePath)) {
          resolve({ success: false, error: 'File does not exist on disk' });
          return;
        }
        
        // Show save dialog
        dialog.showSaveDialog({
          title: 'Save File',
          defaultPath: file.name,
        }).then((result) => {
          if (result.canceled || !result.filePath) {
            resolve({ success: false, error: 'Cancelled' });
            return;
          }
          
          // Copy file to chosen location
          fs.copyFileSync(sourcePath, result.filePath);
          resolve({ success: true, path: result.filePath });
        }).catch((dialogError) => {
          resolve({ success: false, error: dialogError.message });
        });
      } catch (parseError: any) {
        resolve({ success: false, error: parseError.message });
      }
    });
  });
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
  const escapedQuery = query.replace(/'/g, "''");
  
  return new Promise((resolve) => {
    // Search froggo-db for tasks, facts, and messages with JSON output
    const cmd = `froggo-db search "${escapedQuery}" --limit 20 --json`;
    
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
  const keyPath = path.join(os.homedir(), '.clawdbot', 'anthropic.key');
  if (!anthropicApiKey && fs.existsSync(keyPath)) {
    anthropicApiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  }
} catch {}
// Fallback: read from openclaw.json config
if (!anthropicApiKey) {
  try {
    const ocConfigs = [
      path.join(os.homedir(), '.openclaw', 'openclaw.json'),
      path.join(os.homedir(), '.clawdbot', 'openclaw.json'),
    ];
    for (const cfgPath of ocConfigs) {
      if (!anthropicApiKey && fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        // Check models.providers.*.apiKey, providers.*, and plugins.entries.smartrouter.config
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
        // Also check smartrouter plugin config
        if (!anthropicApiKey) {
          const srKey = cfg.plugins?.entries?.smartrouter?.config?.anthropicApiKey;
          if (srKey?.startsWith('sk-ant')) anthropicApiKey = srKey;
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
  const keyPath = path.join(os.homedir(), '.clawdbot', 'openai.key');
  if (!openaiApiKey && fs.existsSync(keyPath)) {
    openaiApiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  }
} catch {}

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
      execFile('/Users/worker/.local/bin/froggo-db', args, {
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

ipcMain.handle('ai:generateContent', async (_, prompt: string, type: string, options?: { agent?: string }) => {
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
        `openclaw agent --message '${escapedPrompt}' --session-id '${sessionKey}' --agent ${agentId}`,
        {
          encoding: 'utf-8',
          timeout: 60000,
          env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
        },
        (error, stdout, stderr) => {
          if (error) {
            safeLog.error('[AI:Generate] CLI error:', error.message);
            reject(error);
            return;
          }
          
          const output = stdout.trim();
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

// ============== TWITTER IPC HANDLERS (X API v2) ==============

ipcMain.handle('twitter:mentions', async () => {
  safeLog.log('[Twitter] Mentions handler called');
  try {
    const mentions = await xApi.getMentions(20);
    safeLog.log('[Twitter] Got', mentions.length, 'mentions');
    return { success: true, mentions };
  } catch (e: any) {
    safeLog.error('[Twitter] Mentions error:', e.message);
    return { success: false, mentions: [], error: e.message };
  }
});

ipcMain.handle('twitter:home', async (_, limit?: number) => {
  safeLog.log('[Twitter] Home handler called, limit:', limit);
  try {
    const tweets = await xApi.getHomeTimeline(limit || 20);
    safeLog.log('[Twitter] Got', tweets.length, 'home tweets');
    return { success: true, tweets };
  } catch (e: any) {
    safeLog.error('[Twitter] Home error:', e.message);
    return { success: false, tweets: [], error: e.message };
  }
});

ipcMain.handle('twitter:queue-post', async (_, text: string, context?: string) => {
  // Queue tweet for approval via inbox
  const title = text.length > 50 ? `${text.slice(0, 47)}...` : text;
  const cmd = `froggo-db inbox-add --type tweet --title "${title.replace(/"/g, '\\"')}" --content "${text.replace(/"/g, '\\"')}" --channel dashboard`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Twitter] Queue error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, message: 'Tweet queued for approval in Inbox' });
    });
  });
});

// ============== MESSAGES IPC HANDLERS ==============

// Comms cache configuration
const COMMS_CACHE_TTL_MS = 30 * 1000; // 30 seconds - keep inbox live for ADHD-friendly real-time updates
const FROGGO_DB_PATH = '/Users/worker/.local/bin/froggo-db';

// Helper to run command and return promise (shared)
const runMsgCmd = (cmd: string, timeout = 10000): Promise<string> => {
  return new Promise((resolve) => {
    const fullPath = `/opt/homebrew/bin:/usr/bin:/bin:/Users/worker/.local/bin:${process.env.PATH || ''}`;
    exec(cmd, { timeout, env: { ...process.env, PATH: fullPath } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error(`[Messages] Command error: ${cmd.slice(0, 100)}...`, error.message);
        if (stderr) safeLog.error(`[Messages] stderr: ${stderr}`);
        resolve('');
      } else {
        resolve(stdout);
      }
    });
  });
};

// Check comms cache freshness
const getCommsCacheAge = async (): Promise<number> => {
  try {
    const raw = await runMsgCmd(`sqlite3 ~/clawd/data/froggo.db "SELECT MAX(fetched_at) FROM comms_cache"`, 2000);
    if (raw && raw.trim()) {
      const lastFetch = new Date(raw.trim()).getTime();
      return Date.now() - lastFetch;
    }
  } catch (e) {
    safeLog.error('[Messages] Cache age check error:', e);
  }
  return Infinity;
};

// Get messages from froggo-db cache
const getCommsFromCache = async (limit: number): Promise<any[] | null> => {
  try {
    const raw = await runMsgCmd(`${FROGGO_DB_PATH} comms-recent --limit ${limit} --max-age-hours 2160`, 3000);
    if (raw && raw.trim().startsWith('[')) {
      const cached = JSON.parse(raw);
      // Transform to match expected format
      return cached.map((m: any) => {
        // Parse metadata — may be string, double-quoted string, or object
        let meta: any = {};
        if (m.metadata) {
          try {
            meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
            // Handle double-encoded JSON
            if (typeof meta === 'string') meta = JSON.parse(meta);
          } catch { meta = {}; }
        }
        return {
        id: m.external_id,
        platform: m.platform,
        account: m.account || meta.account || undefined,
        name: m.sender_name || m.sender,
        from: m.sender,
        preview: m.preview,
        timestamp: m.timestamp,
        relativeTime: (() => {
          // Always recalculate relativeTime from timestamp (cached value goes stale)
          if (!m.timestamp) return '';
          const date = new Date(m.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);
          if (diffMins < 1) return 'just now';
          if (diffMins < 60) return `${diffMins}m ago`;
          if (diffHours < 24) return `${diffHours}h ago`;
          if (diffDays < 7) return `${diffDays}d ago`;
          return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        })(),
        hasReply: !!m.has_reply,
        has_reply: !!m.has_reply,
        isUrgent: !!m.is_urgent,
        is_read: !m.is_unread && !m.is_read ? false : !!m.is_read,
        is_starred: !!m.is_starred,
        has_attachment: !!m.has_attachment,
        thread_id: m.thread_id,
        message_count: m.thread_message_count || 1,
        unread_count: m.thread_message_count && !m.is_read ? m.thread_message_count : 0,
        unreplied_count: !m.has_reply ? 1 : 0,
      };});
    }
  } catch (e) {
    safeLog.error('[Messages] Cache read error:', e);
  }
  return null;
};

// Write messages to froggo-db cache
const writeCommsToCache = async (messages: any[]): Promise<void> => {
  try {
    // Transform to froggo-db format
    const cacheData = messages.map(m => ({
      platform: m.platform,
      external_id: m.id,
      sender: m.from || m.name,
      sender_name: m.name,
      preview: m.preview,
      timestamp: m.timestamp,
      is_urgent: m.isUrgent || false,
      ...(m.account ? { metadata: JSON.stringify({ account: m.account }) } : {}),
    }));
    
    // Write via stdin to comms-bulk
    const tmpFile = path.join(os.tmpdir(), `comms-cache-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(cacheData));
    await runMsgCmd(`${FROGGO_DB_PATH} comms-bulk --file "${tmpFile}"`, 5000);
    fs.unlinkSync(tmpFile);
    safeLog.log(`[Messages] Cached ${messages.length} messages to froggo-db`);
  } catch (e) {
    safeLog.error('[Messages] Cache write error:', e);
  }
};

// ============== COMMS DB INIT: Create tables for incremental fetch & AI analysis ==============
const initCommsDbTables = async () => {
  const db = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const tables = [
    `CREATE TABLE IF NOT EXISTS comms_fetch_state (
      platform TEXT NOT NULL,
      account TEXT DEFAULT '',
      last_fetch_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_message_ts TEXT,
      PRIMARY KEY (platform, account)
    )`,
    `CREATE TABLE IF NOT EXISTS comms_ai_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      triage TEXT,
      summary TEXT,
      tasks TEXT,
      events TEXT,
      reply_draft TEXT,
      reply_needed INTEGER DEFAULT 1,
      analyzed_at TEXT DEFAULT (datetime('now')),
      tokens_used INTEGER DEFAULT 0,
      UNIQUE(external_id, platform)
    )`,
  ];
  for (const sql of tables) {
    try {
      await runMsgCmd(`sqlite3 "${db}" "${sql.replace(/\n/g, ' ')}"`, 5000);
    } catch (e) {
      safeLog.error('[CommsDB] Table creation error:', e);
    }
  }
  safeLog.log('[CommsDB] Tables initialized');
};

// Run DB init on next tick (after app ready)
setTimeout(initCommsDbTables, 2000);

// ============== BACKGROUND COMMS POLLING ==============
let commsPollTimer: NodeJS.Timeout | null = null;
let commsRefreshInProgress = false;

async function refreshCommsBackground() {
  if (commsRefreshInProgress) return;
  commsRefreshInProgress = true;
  safeLog.log('[CommsPolling] Background refresh starting...');

  const allMessages: any[] = [];
  const db = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const WACLI_PATH = '/opt/homebrew/bin/wacli';
  const DISCORDCLI_PATH = '/Users/worker/.local/bin/discordcli';

  const relativeTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Helper to get last fetch state
  const getFetchState = async (platform: string, account = ''): Promise<string | null> => {
    try {
      const raw = await runMsgCmd(`sqlite3 "${db}" "SELECT last_message_ts FROM comms_fetch_state WHERE platform='${platform}' AND account='${account.replace(/'/g, "''")}'"`  , 2000);
      return raw?.trim() || null;
    } catch { return null; }
  };

  // Helper to update fetch state
  const updateFetchState = async (platform: string, account: string, lastTs: string) => {
    try {
      const escaped = account.replace(/'/g, "''");
      await runMsgCmd(`sqlite3 "${db}" "INSERT OR REPLACE INTO comms_fetch_state (platform, account, last_fetch_at, last_message_ts) VALUES ('${platform}', '${escaped}', datetime('now'), '${lastTs}')"`, 2000);
    } catch (e) {
      safeLog.error(`[CommsPolling] Failed to update fetch state for ${platform}:${account}`, e);
    }
  };

  try {
    // ===== WHATSAPP =====
    const waLastTs = await getFetchState('whatsapp');
    const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
    const waFilter = waLastTs ? `AND m.ts > ${Math.floor(new Date(waLastTs).getTime() / 1000)}` : '';
    const waQuery = `
      SELECT m.chat_jid, m.chat_name, m.text, m.ts, COALESCE(c.push_name, c.full_name, c.business_name) as contact_name
      FROM messages m
      LEFT JOIN contacts c ON m.chat_jid = c.jid
      WHERE m.from_me = 0
        AND (m.chat_jid LIKE '%@s.whatsapp.net' OR m.chat_jid LIKE '%@g.us')
        AND m.text IS NOT NULL AND m.text != ''
        ${waFilter}
      GROUP BY m.chat_jid
      ORDER BY m.ts DESC
      LIMIT 50
    `;
    try {
      const waRaw = await runMsgCmd(`sqlite3 "${waDbPath}" "${waQuery.replace(/\n/g, ' ')}" -json`, 10000);
      if (waRaw && waRaw.length > 10) {
        const waMessages = JSON.parse(waRaw);
        let maxTs = '';
        for (const msg of waMessages) {
          let name = msg.contact_name || msg.chat_name || msg.chat_jid || 'Unknown';
          if (name.includes('@')) name = name.split('@')[0];
          if (/^\d+$/.test(name)) name = `+${name}`;
          const timestamp = new Date(msg.ts * 1000).toISOString();
          if (!maxTs || timestamp > maxTs) maxTs = timestamp;
          allMessages.push({
            id: `wa-${msg.chat_jid}`, platform: 'whatsapp', name,
            preview: (msg.text || '').slice(0, 100), timestamp,
            relativeTime: relativeTime(timestamp), fromMe: false,
          });
        }
        if (maxTs) await updateFetchState('whatsapp', '', maxTs);
      }
    } catch (e) { safeLog.error('[CommsPolling] WhatsApp error:', e); }

    // ===== TELEGRAM (from cache) =====
    const tgCachePath = path.join(os.homedir(), 'clawd', 'data', 'telegram-cache.json');
    const TELEGRAM_SPAM_KEYWORDS = [
      'bc.game', 'casino', 'betting', 'airdrop', 'giveaway',
      'crypto wizard', 'alpha private', 'vip lounge', 'mystic dao',
      'slerf', 'pepe', 'zeus community', 'zeus army', 'ponke',
      'degen', 'memecoin', 'shitcoin', '$jug', '$sol',
    ];
    const TELEGRAM_SPAM_NAMES = new Set([
      'BC.GAME Official', 'Mystic Dao', 'Crypto Wizards Lounge',
      "Pepe's Dog Zeus Community #CC8", 'Alpha Private Vip Lounge 🐳 🌐',
      'SlerfTheSloth', 'ZEUS Army (COORDINATION GROUP)',
    ]);
    try {
      if (fs.existsSync(tgCachePath)) {
        const tgCache = JSON.parse(fs.readFileSync(tgCachePath, 'utf-8'));
        for (const chat of (tgCache.chats || []).slice(0, 50)) {
          if (!chat.lastMessage?.text || chat.lastMessage.text === '(no recent messages)') continue;
          const nameLower = (chat.name || '').toLowerCase();
          const previewLower = (chat.lastMessage.text || '').toLowerCase();
          if (TELEGRAM_SPAM_NAMES.has(chat.name)) continue;
          if (TELEGRAM_SPAM_KEYWORDS.some(kw => nameLower.includes(kw) || previewLower.includes(kw))) continue;
          let timestamp = chat.lastMessage.timestamp;
          if (timestamp && !timestamp.includes('Z')) timestamp += 'Z';
          allMessages.push({
            id: `tg-${chat.id}`, platform: 'telegram', name: chat.name || 'Unknown',
            preview: (chat.lastMessage.text || '').slice(0, 100), timestamp,
            relativeTime: relativeTime(timestamp), fromMe: false, chatType: chat.type,
          });
        }
      }
    } catch (e) { safeLog.error('[CommsPolling] Telegram error:', e); }

    // ===== DISCORD DMs =====
    try {
      const discordDmsRaw = await runMsgCmd(`${DISCORDCLI_PATH} dms`, 5000);
      if (discordDmsRaw && !discordDmsRaw.includes('Invalid token')) {
        const dmLines = discordDmsRaw.split('\n').filter((l: string) => l.trim() && !l.startsWith('ID') && !l.startsWith('---'));
        const dms = dmLines.slice(0, 15).map((line: string) => {
          const match = line.match(/^(\d+)\s+(.+)$/);
          if (match) return { id: match[1], name: match[2].trim() };
          return null;
        }).filter(Boolean) as { id: string; name: string }[];
        const dmResults = await Promise.allSettled(
          dms.map(async (dm) => {
            const msgRaw = await runMsgCmd(`${DISCORDCLI_PATH} messages ${dm.id} --limit 15`, 4000);
            if (!msgRaw) return null;
            const msgLines = msgRaw.split('\n').filter((l: string) => l.match(/^\[\d{4}-\d{2}-\d{2}/));
            for (const line of msgLines) {
              const msgMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
              if (msgMatch && msgMatch[2].trim() !== 'prof_froggo') {
                const timestamp = new Date(msgMatch[1].replace(' ', 'T') + ':00Z');
                return {
                  id: `discord-${dm.id}`, platform: 'discord',
                  name: dm.name.split(',')[0].trim(),
                  preview: msgMatch[3].trim().slice(0, 100),
                  timestamp: timestamp.toISOString(),
                  relativeTime: relativeTime(timestamp.toISOString()), fromMe: false,
                };
              }
            }
            return null;
          })
        );
        for (const result of dmResults) {
          if (result.status === 'fulfilled' && result.value) allMessages.push(result.value);
        }
      }
    } catch (e) { safeLog.error('[CommsPolling] Discord error:', e); }

    // ===== EMAIL =====
    let emailAccounts = ['kevin.macarthur@bitso.com', 'kevin@carbium.io'];
    try {
      const gogAuthRaw = await runMsgCmd('/opt/homebrew/bin/gog auth list --json', 10000);
      if (gogAuthRaw) {
        const gogData = JSON.parse(gogAuthRaw);
        const gmailAccts = (gogData.accounts || [])
          .filter((a: any) => a.services?.includes('gmail'))
          .map((a: any) => a.email);
        if (gmailAccts.length > 0) emailAccounts = gmailAccts;
      }
    } catch {}
    for (const acct of emailAccounts) {
      try {
        const lastTs = await getFetchState('email', acct);
        const timeFilter = lastTs ? `newer_than:30m` : 'newer_than:30d';
        const emailRaw = await runMsgCmd(`GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "${timeFilter}" --json --limit 50`, 30000);
        if (emailRaw) {
          const emailData = JSON.parse(emailRaw);
          const emails = emailData.threads || emailData || [];
          for (const email of emails) {
            const ts = email.date || email.Date || new Date().toISOString();
            allMessages.push({
              id: `email-${email.id || email.ID}`, platform: 'email', account: acct,
              name: email.from?.split('<')[0]?.trim() || email.From?.split('<')[0]?.trim() || 'Unknown',
              preview: email.subject || email.Subject || email.snippet || '',
              timestamp: ts, relativeTime: relativeTime(ts), fromMe: false,
            });
          }
          await updateFetchState('email', acct, new Date().toISOString());
        }
      } catch (e) { safeLog.error(`[CommsPolling] Email ${acct} error:`, e); }
    }

    // Sort and cache
    allMessages.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    await writeCommsToCache(allMessages).catch(e => safeLog.error('[CommsPolling] Cache write failed:', e));
    safeLog.log(`[CommsPolling] Refreshed ${allMessages.length} messages`);
  } catch (e) {
    safeLog.error('[CommsPolling] Background refresh error:', e);
  } finally {
    commsRefreshInProgress = false;
  }
}

function startCommsPolling() {
  // Initial background refresh after 10s
  setTimeout(() => {
    refreshCommsBackground().then(() => {
      safeSend('comms-updated', { ts: Date.now() });
    });
  }, 10000);

  // Then every 60s
  commsPollTimer = setInterval(async () => {
    await refreshCommsBackground();
    safeSend('comms-updated', { ts: Date.now() });
  }, 60000);
  safeLog.log('[CommsPolling] Started (60s interval)');
}

app.on('ready', () => {
  setTimeout(startCommsPolling, 8000);
});

// ============== INBOX HISTORICAL DATA CHECK ==============
ipcMain.handle('inbox:check-history', async () => {
  try {
    const inboxLauncherPath = path.join(os.homedir(), 'clawd', 'tools', 'inbox-launcher.js');
    const result = await runMsgCmd(`node "${inboxLauncherPath}" check`, 5000);
    const status = JSON.parse(result);
    safeLog.log('[Inbox] Historical data check:', status);
    return { success: true, ...status };
  } catch (e: any) {
    safeLog.error('[Inbox] Historical data check failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('inbox:trigger-backfill', async (_, days = 60) => {
  try {
    const inboxLauncherPath = path.join(os.homedir(), 'clawd', 'tools', 'inbox-launcher.js');
    // Trigger in background
    safeLog.log('[Inbox] Triggering historical backfill:', days, 'days');
    exec(`node "${inboxLauncherPath}" ensure`, (error, stdout) => {
      if (error) {
        safeLog.error('[Inbox] Backfill trigger error:', error);
      } else {
        safeLog.log('[Inbox] Backfill triggered:', stdout);
      }
    });
    return { success: true, message: 'Backfill started in background' };
  } catch (e: any) {
    safeLog.error('[Inbox] Backfill trigger failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('messages:recent', async (_, limit?: number, includeArchived = false) => {
  safeLog.log('[Messages] Handler called, limit:', limit, 'includeArchived:', includeArchived);
  const lim = limit || 10;
  
  // Get archived conversation session keys (unless includeArchived is true)
  let archivedKeys: Set<string> = new Set();
  if (!includeArchived) {
    try {
      const archivedRaw = await runMsgCmd(`sqlite3 ~/clawd/data/froggo.db "SELECT session_key FROM conversation_folders WHERE folder_id = 4"`, 3000);
      if (archivedRaw) {
        const keys = archivedRaw.trim().split('\n').filter((k: string) => k.length > 0);
        archivedKeys = new Set<string>(keys);
        safeLog.log(`[Messages] Found ${archivedKeys.size} archived conversations to filter`);
      }
    } catch (e) {
      safeLog.error('[Messages] Error fetching archived conversations:', e);
    }
  }
  
  // Helper to create session key from message
  const getSessionKey = (m: any): string => {
    return `${m.platform}:${m.from || m.sender}`;
  };
  
  // Check cache freshness
  const cacheAge = await getCommsCacheAge();
  safeLog.log(`[Messages] Cache age: ${Math.round(cacheAge / 1000)}s`);
  
  // If cache is fresh (< TTL), return cached data (filtered)
  if (cacheAge < COMMS_CACHE_TTL_MS) {
    const cached = await getCommsFromCache(lim);
    if (cached && cached.length > 0) {
      const filtered = cached.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
      safeLog.log(`[Messages] Returning ${filtered.length} messages from cache (${cached.length - filtered.length} archived filtered)`);
      return { success: true, chats: filtered, fromCache: true, cacheAge: Math.round(cacheAge / 1000) };
    }
  }
  
  // Cache stale — return cache immediately, trigger background refresh
  const staleCache = await getCommsFromCache(lim);
  if (staleCache && staleCache.length > 0) {
    const filtered = staleCache.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
    safeLog.log(`[Messages] Returning ${filtered.length} from stale cache, triggering background refresh`);
    // Trigger background refresh (non-blocking)
    refreshCommsBackground().then(() => {
      safeSend('comms-updated', { ts: Date.now() });
    }).catch(e => safeLog.error('[Messages] Background refresh failed:', e));
    return { success: true, chats: filtered, fromCache: true, refreshing: true };
  }

  // No cache at all — do synchronous fetch (first load)
  safeLog.log('[Messages] No cache, doing synchronous fetch...');
  await refreshCommsBackground();
  const freshCache = await getCommsFromCache(lim);
  if (freshCache && freshCache.length > 0) {
    const filtered = freshCache.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
    return { success: true, chats: filtered, fromCache: false };
  }
  return { success: true, chats: [], fromCache: false };
});

// ============== MESSAGE CONTEXT HANDLER ==============
ipcMain.handle('messages:context', async (_, messageId: string, platform: string, limit?: number) => {
  const lim = limit || 5;
  const messages: any[] = [];
  
  const runCmd = (cmd: string, timeout = 10000): Promise<string> => {
    return new Promise((resolve) => {
      exec(cmd, { timeout, env: { ...process.env, PATH: `/opt/homebrew/bin:/Users/worker/.local/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error) resolve('');
        else resolve(stdout);
      });
    });
  };
  
  try {
    if (platform === 'whatsapp') {
      // Extract JID from messageId (wa-JID format)
      const jid = messageId.replace('wa-', '');
      const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
      // Get contact name first
      const nameQuery = `SELECT COALESCE(c.push_name, c.full_name, m.chat_name, 'Unknown') as name FROM messages m LEFT JOIN contacts c ON m.chat_jid = c.jid WHERE m.chat_jid='${jid}' LIMIT 1`;
      const nameRaw = await runCmd(`sqlite3 "${waDbPath}" "${nameQuery}"`, 3000);
      const contactName = nameRaw?.trim() || 'Unknown';
      
      const query = `SELECT text, from_me, datetime(ts, 'unixepoch', 'localtime') as time FROM messages WHERE chat_jid='${jid}' ORDER BY ts DESC LIMIT ${lim}`;
      const raw = await runCmd(`sqlite3 "${waDbPath}" "${query}" -json`, 5000);
      if (raw) {
        const rows = JSON.parse(raw);
        for (const row of rows.reverse()) {
          messages.push({
            sender: row.from_me ? 'You' : contactName,
            text: row.text || '',
            timestamp: row.time || '',
            fromMe: !!row.from_me,
          });
        }
      }
    } else if (platform === 'telegram') {
      const chatId = messageId.replace('tg-', '');
      const raw = await runCmd(`/Users/worker/.local/bin/tgcli messages ${chatId} --limit ${lim}`, 5000);
      if (raw) {
        const lines = raw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
        for (const line of lines.reverse()) {
          const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
          if (match) {
            messages.push({
              sender: match[2].trim(),
              text: match[3].trim(),
              timestamp: match[1],
              fromMe: match[2].trim() === 'You',
            });
          }
        }
      }
    } else if (platform === 'discord') {
      const channelId = messageId.replace('discord-', '');
      const raw = await runCmd(`/Users/worker/.local/bin/discordcli messages ${channelId} --limit ${lim}`, 5000);
      if (raw) {
        const lines = raw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
        for (const line of lines.reverse()) {
          const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
          if (match) {
            messages.push({
              sender: match[2].trim(),
              text: match[3].trim(),
              timestamp: match[1],
              fromMe: match[2].trim() === 'prof_froggo',
            });
          }
        }
      }
    }
    
    return { success: true, messages };
  } catch (e: any) {
    safeLog.error('[Messages:Context] Error:', e);
    return { success: false, messages: [], error: e.message };
  }
});

// ============== MESSAGE SEND HANDLER ==============
ipcMain.handle('messages:send', async (_, { platform, to, message }: { platform: string; to: string; message: string }) => {
  const PATHS = {
    wacli: '/opt/homebrew/bin/wacli',
    tgcli: '~/.local/bin/tgcli',
    gog: '/opt/homebrew/bin/gog'
  };
  
  // Escape message for shell
  const escapeShell = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
  
  try {
    let result: string;
    
    switch (platform) {
      case 'whatsapp':
        result = execSync(`${PATHS.wacli} send ${escapeShell(to)} ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      case 'telegram':
        result = execSync(`${PATHS.tgcli} send ${escapeShell(to)} ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      case 'email':
        result = execSync(`${PATHS.gog} gmail send --to ${escapeShell(to)} --body ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      case 'discord':
        // Use openclaw message tool
        result = execSync(`openclaw message send --channel discord --to ${escapeShell(to)} --message ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
        break;
      default:
        return { success: false, error: `Unknown platform: ${platform}` };
    }
    
    safeLog.log(`[Messages:Send] Sent to ${platform}:${to}:`, result);
    return { success: true, result };
  } catch (e: any) {
    safeLog.error('[Messages:Send] Error:', e);
    return { success: false, error: e.message };
  }
});

// ============== CONVERSATION ARCHIVE HANDLERS ==============
// Archive a conversation (assign to Archive folder)
ipcMain.handle('conversations:archive', async (_, sessionKey: string) => {
  safeLog.log('[Conversations] Archive:', sessionKey);
  const ARCHIVE_FOLDER_ID = 4;
  const escapedKey = sessionKey.replace(/'/g, "''");
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT OR IGNORE INTO conversation_folders (folder_id, session_key, added_by) VALUES (${ARCHIVE_FOLDER_ID}, '${escapedKey}', 'user')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Conversations] Archive error:', error);
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Conversations] Archived:', sessionKey);
        resolve({ success: true });
      }
    });
  });
});

// Unarchive a conversation (remove from Archive folder)
ipcMain.handle('conversations:unarchive', async (_, sessionKey: string) => {
  safeLog.log('[Conversations] Unarchive:', sessionKey);
  const ARCHIVE_FOLDER_ID = 4;
  const escapedKey = sessionKey.replace(/'/g, "''");
  const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_folders WHERE folder_id = ${ARCHIVE_FOLDER_ID} AND session_key = '${escapedKey}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Conversations] Unarchive error:', error);
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Conversations] Unarchived:', sessionKey);
        resolve({ success: true });
      }
    });
  });
});

// Get archived conversations (with message details)
ipcMain.handle('conversations:archived', async () => {
  safeLog.log('[Conversations] Get archived list');
  const ARCHIVE_FOLDER_ID = 4;
  
  return new Promise((resolve) => {
    // Get archived session keys with metadata
    const cmd = `sqlite3 "${froggoDbPath}" "SELECT cf.session_key, cf.added_at, COUNT(c.id) as message_count, MAX(c.timestamp) as last_message FROM conversation_folders cf LEFT JOIN comms_cache c ON (c.platform || ':' || c.sender) = cf.session_key WHERE cf.folder_id = ${ARCHIVE_FOLDER_ID} GROUP BY cf.session_key ORDER BY cf.added_at DESC" -json`;
    
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Conversations] Archived list error:', error);
        resolve({ success: false, conversations: [] });
        return;
      }
      
      try {
        const conversations = JSON.parse(stdout || '[]');
        safeLog.log(`[Conversations] Found ${conversations.length} archived conversations`);
        resolve({ success: true, conversations });
      } catch (e) {
        safeLog.error('[Conversations] Parse error:', e);
        resolve({ success: false, conversations: [] });
      }
    });
  });
});

// Check if a conversation is archived
ipcMain.handle('conversations:isArchived', async (_, sessionKey: string) => {
  const ARCHIVE_FOLDER_ID = 4;
  const escapedKey = sessionKey.replace(/'/g, "''");
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as count FROM conversation_folders WHERE folder_id = ${ARCHIVE_FOLDER_ID} AND session_key = '${escapedKey}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 3000 }, (error, stdout) => {
      if (error) {
        resolve({ isArchived: false });
      } else {
        const count = parseInt(stdout.trim() || '0', 10);
        resolve({ isArchived: count > 0 });
      }
    });
  });
});

// Mark conversation as read (update all messages in session)
ipcMain.handle('conversations:markRead', async (_, sessionKey: string) => {
  safeLog.log('[Conversations] Mark as read:', sessionKey);
  const escapedKey = sessionKey.replace(/'/g, "''");
  
  // Update all messages in comms_cache for this session
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE comms_cache SET is_read = 1 WHERE (platform || ':' || sender) = '${escapedKey}' AND (is_read IS NULL OR is_read = 0)"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Conversations] Mark read error:', error);
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Conversations] Marked as read:', sessionKey);
        resolve({ success: true });
      }
    });
  });
});

// Delete conversation (remove from all folders and delete messages)
ipcMain.handle('conversations:delete', async (_, sessionKey: string) => {
  safeLog.log('[Conversations] Delete:', sessionKey);
  const escapedKey = sessionKey.replace(/'/g, "''");
  
  // Delete from conversation_folders, comms_cache, and any other related tables
  const cmds = [
    `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_folders WHERE session_key = '${escapedKey}'"`,
    `sqlite3 "${froggoDbPath}" "DELETE FROM comms_cache WHERE (platform || ':' || sender) = '${escapedKey}'"`,
    `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_snoozes WHERE session_id = '${escapedKey}'"`,
    `sqlite3 "${froggoDbPath}" "DELETE FROM conversation_pins WHERE session_key = '${escapedKey}'"`,
    // notification_settings might not exist, ignore error
    `sqlite3 "${froggoDbPath}" "DELETE FROM notification_settings WHERE session_key = '${escapedKey}'" 2>/dev/null || true`,
  ];
  
  return new Promise((resolve) => {
    // Execute all delete commands sequentially
    const execSequential = (commands: string[], index = 0) => {
      if (index >= commands.length) {
        safeLog.log('[Conversations] Deleted:', sessionKey);
        resolve({ success: true });
        return;
      }
      
      exec(commands[index], { timeout: 5000 }, (error) => {
        if (error) {
          safeLog.error(`[Conversations] Delete error (step ${index}):`, error);
          resolve({ success: false, error: error.message });
        } else {
          execSequential(commands, index + 1);
        }
      });
    };
    
    execSequential(cmds);
  });
});

// ============== EMAIL IPC HANDLERS ==============

// Discover all email accounts from gog auth (gmail-enabled accounts)
ipcMain.handle('email:accounts', async () => {
  return new Promise((resolve) => {
    exec('/opt/homebrew/bin/gog auth list --json', { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
      if (error || !stdout) {
        // Fallback to hardcoded defaults
        resolve({ success: true, accounts: [
          { email: 'kevin.macarthur@bitso.com', label: 'Bitso' },
          { email: 'kevin@carbium.io', label: 'Carbium' },
        ]});
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const gmailAccounts = (data.accounts || [])
          .filter((a: any) => a.services?.includes('gmail'))
          .map((a: any) => ({
            email: a.email,
            label: a.email.split('@')[0],
          }));
        resolve({ success: true, accounts: gmailAccounts.length > 0 ? gmailAccounts : [
          { email: 'kevin.macarthur@bitso.com', label: 'Bitso' },
          { email: 'kevin@carbium.io', label: 'Carbium' },
        ]});
      } catch {
        resolve({ success: true, accounts: [
          { email: 'kevin.macarthur@bitso.com', label: 'Bitso' },
          { email: 'kevin@carbium.io', label: 'Carbium' },
        ]});
      }
    });
  });
});

ipcMain.handle('email:unread', async (_, account?: string) => {
  if (!account) return { success: false, emails: [], error: 'No email account specified' };
  const acct = account;
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread" --json --limit 20`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
      if (error) {
        safeLog.error('[Email] Unread error:', error);
        resolve({ success: false, emails: [], error: error.message });
        return;
      }
      try {
        const emails = JSON.parse(stdout);
        resolve({ success: true, emails, account: acct });
      } catch {
        resolve({ success: true, emails: [], raw: stdout, account: acct });
      }
    });
  });
});

ipcMain.handle('email:body', async (_, emailId: string, account?: string) => {
  const envPath = `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}`;

  // Try to read with specified account, or try all known accounts
  const tryAccounts = account ? [account] : ['kevin.macarthur@bitso.com', 'kevin@carbium.io', 'kmacarthur.gpt@gmail.com'];

  for (const acct of tryAccounts) {
    // Try 'gog gmail read' first (more reliable), fallback to 'thread get'
    for (const subcmd of [`gmail read ${emailId}`, `gmail thread get ${emailId}`]) {
      try {
        const stdout = await new Promise<string>((resolve, reject) => {
          exec(`GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog ${subcmd}`, { timeout: 30000, env: { ...process.env, PATH: envPath } }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
          });
        });
        if (stdout && stdout.length > 10) {
          safeLog.log(`[Email] Body loaded for ${emailId} via ${subcmd} (${acct})`);
          return { success: true, body: stdout, emailId };
        }
      } catch (e) {
        // try next
      }
    }
  }

  safeLog.error(`[Email] Body failed for ${emailId}, tried ${tryAccounts.length} accounts`);
  return { success: false, body: '', error: 'Could not load email body from any account' };
});

ipcMain.handle('email:search', async (_, query: string, account?: string) => {
  if (!account) return { success: false, emails: [], error: 'No email account specified' };
  const acct = account;
  const escapedQuery = query.replace(/"/g, '\\"');
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "${escapedQuery}" --json --limit 20`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
      if (error) {
        safeLog.error('[Email] Search error:', error);
        resolve({ success: false, emails: [], error: error.message });
        return;
      }
      try {
        const emails = JSON.parse(stdout);
        resolve({ success: true, emails, account: acct });
      } catch {
        resolve({ success: true, emails: [], raw: stdout, account: acct });
      }
    });
  });
});

ipcMain.handle('email:queue-send', async (_, to: string, subject: string, body: string, account?: string) => {
  const acct = account || 'kevin@carbium.io';
  const title = `Email to ${to}: ${subject.slice(0, 30)}`;
  const content = `To: ${to}\nSubject: ${subject}\nAccount: ${acct}\n\n${body}`;
  const cmd = `/opt/homebrew/bin/froggo-db inbox-add --type email --title "${title.replace(/"/g, '\\"')}" --content "${content.replace(/"/g, '\\"')}" --channel dashboard`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error) => {
      if (error) {
        safeLog.error('[Email] Queue error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, message: 'Email queued for approval in Inbox' });
    });
  });
});

// ============== EMAIL AUTO-DETECT IMPORTANT ==============

// Track processed email IDs to avoid duplicates
const processedEmailIds = new Set<string>();
const processedEmailsFile = path.join(os.homedir(), 'clawd', 'data', 'processed-emails.json');

// Load processed emails on startup
try {
  if (fs.existsSync(processedEmailsFile)) {
    const data = JSON.parse(fs.readFileSync(processedEmailsFile, 'utf-8'));
    data.forEach((id: string) => processedEmailIds.add(id));
    safeLog.log(`[Email] Loaded ${processedEmailIds.size} processed email IDs`);
  }
} catch (e) {
  safeLog.error('[Email] Failed to load processed emails:', e);
}

function saveProcessedEmails() {
  try {
    const data = Array.from(processedEmailIds).slice(-500); // Keep last 500
    fs.writeFileSync(processedEmailsFile, JSON.stringify(data, null, 2));
  } catch (e) {
    safeLog.error('[Email] Failed to save processed emails:', e);
  }
}

interface ImportantEmailResult {
  id: string;
  from: string;
  subject: string;
  reason: string;
  priority: 'urgent' | 'high' | 'medium';
  amount?: string;
}

function detectImportantEmail(email: any): ImportantEmailResult | null {
  const id = email.id || email.ID || email.threadId;
  const from = email.from || email.From || '';
  const subject = email.subject || email.Subject || '';
  const labels = email.labels || email.Labels || [];
  const snippet = email.snippet || '';
  
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();
  const combined = `${subjectLower} ${snippet.toLowerCase()}`;
  
  // Extract amounts (e.g., $1,500 or €500 or £1000)
  const amountMatch = combined.match(/[\$€£]\s?[\d,]+(?:\.\d{2})?/);
  const amount = amountMatch ? amountMatch[0] : undefined;
  
  // Priority: Urgent
  const urgentPatterns = [
    /urgent/i,
    /immediate action/i,
    /action required/i,
    /expires? (today|soon|in \d)/i,
    /deadline/i,
    /asap/i,
  ];
  
  for (const pattern of urgentPatterns) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return { id, from, subject, reason: 'Urgent action required', priority: 'urgent', amount };
    }
  }
  
  // Priority: High - Financial
  const financialPatterns = [
    /invoice/i,
    /payment (due|received|failed|declined)/i,
    /billing/i,
    /receipt/i,
    /transaction/i,
    /wire transfer/i,
    /bank (statement|alert|notification)/i,
  ];
  
  const financialSenders = [
    /revolut/i,
    /stripe/i,
    /paypal/i,
    /wise\.com/i,
    /mercury/i,
    /brex/i,
    /@.*bank/i,
  ];
  
  for (const pattern of financialPatterns) {
    if (pattern.test(subject)) {
      return { id, from, subject, reason: 'Financial notification', priority: 'high', amount };
    }
  }
  
  for (const pattern of financialSenders) {
    if (pattern.test(from)) {
      return { id, from, subject, reason: `From ${from.split('<')[0].trim()}`, priority: 'high', amount };
    }
  }
  
  // Priority: High - Meeting/Calendar
  const meetingPatterns = [
    /meeting (request|invite|invitation)/i,
    /calendar invite/i,
    /event invitation/i,
    /interview scheduled/i,
    /you('ve| have) been invited/i,
  ];
  
  for (const pattern of meetingPatterns) {
    if (pattern.test(subject) || pattern.test(snippet)) {
      return { id, from, subject, reason: 'Meeting invitation', priority: 'high' };
    }
  }
  
  // Priority: Medium - Gmail IMPORTANT label
  if (labels.includes('IMPORTANT')) {
    return { id, from, subject, reason: 'Marked important by Gmail', priority: 'medium', amount };
  }
  
  // Priority: Medium - Large amounts (>$500)
  if (amount) {
    const numericAmount = parseFloat(amount.replace(/[\$€£,]/g, ''));
    if (numericAmount >= 500) {
      return { id, from, subject, reason: `Contains amount: ${amount}`, priority: 'high', amount };
    }
  }
  
  return null;
}

ipcMain.handle('email:checkImportant', async () => {
  return runImportantEmailCheck();
});

// Auto-check for important emails every 10 minutes
let emailCheckInterval: NodeJS.Timeout | null = null;

async function runImportantEmailCheck() {
  safeLog.log('[Email] Checking for important emails...');
  const results: ImportantEmailResult[] = [];
  const newInboxItems: string[] = [];
  
  // Discover email accounts from gog auth, fallback to defaults
  let emailAccounts = ['kevin.macarthur@bitso.com', 'kevin@carbium.io'];
  try {
    const gogAuthRaw = await new Promise<string>((resolve) => {
      exec('/opt/homebrew/bin/gog auth list --json', { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }, (error, stdout) => {
        resolve(error ? '' : stdout);
      });
    });
    if (gogAuthRaw) {
      const gogData = JSON.parse(gogAuthRaw);
      const gmailAccts = (gogData.accounts || [])
        .filter((a: any) => a.services?.includes('gmail'))
        .map((a: any) => a.email);
      if (gmailAccts.length > 0) emailAccounts = gmailAccts;
    }
  } catch (e) {
    safeLog.error('[Email] Failed to discover email accounts from gog, using defaults:', e);
  }
  
  for (const acct of emailAccounts) {
    try {
      const output = await new Promise<string>((resolve) => {
        exec(
          `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread newer_than:1d" --json --limit 20`,
          { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } },
          (error, stdout) => {
            if (error) resolve('[]');
            else resolve(stdout);
          }
        );
      });
      
      const emails = JSON.parse(output) || [];
      safeLog.log(`[Email] Checking ${emails.length} emails from ${acct}`);
      
      for (const email of emails) {
        const id = email.id || email.ID || email.threadId;
        if (!id || processedEmailIds.has(id)) continue;
        
        const important = detectImportantEmail(email);
        if (important) {
          results.push(important);
          processedEmailIds.add(id);
          
          // Create inbox item
          const title = important.amount 
            ? `${important.subject.slice(0, 50)} (${important.amount})`
            : important.subject.slice(0, 60);
          const content = `From: ${important.from}\nReason: ${important.reason}\nAccount: ${acct}`;
          const escapedTitle = title.replace(/"/g, '\\"').replace(/'/g, "''");
          const escapedContent = content.replace(/"/g, '\\"').replace(/'/g, "''");
          
          const insertCmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO inbox (type, title, content, context, status, source_channel, created) VALUES ('email', '${escapedTitle}', '${escapedContent}', '${important.priority} priority', 'pending', 'email', datetime('now'))"`;
          
          exec(insertCmd, { timeout: 5000 }, (err) => {
            if (err) safeLog.error('[Email] Failed to create inbox item:', err);
            else safeLog.log(`[Email] Created inbox item: ${title}`);
          });
          
          newInboxItems.push(title);
        }
      }
    } catch (e) {
      safeLog.error(`[Email] Error checking ${acct}:`, e);
    }
  }
  
  // Save processed IDs
  saveProcessedEmails();
  
  // Notify frontend if new items were added
  if (newInboxItems.length > 0) {
    safeSend('inbox-updated', { newItems: newInboxItems.length });
  }
  
  safeLog.log(`[Email] Found ${results.length} important emails, created ${newInboxItems.length} inbox items`);
  return { success: true, found: results.length, created: newInboxItems.length, items: results };
}

function startEmailAutoCheck() {
  if (emailCheckInterval) clearInterval(emailCheckInterval);
  
  // Initial check after 30 seconds (let app settle)
  setTimeout(() => {
    safeLog.log('[Email] Running initial important email check...');
    runImportantEmailCheck();
  }, 30000);
  
  // Then every 10 minutes
  emailCheckInterval = setInterval(() => {
    safeLog.log('[Email] Running periodic important email check...');
    runImportantEmailCheck();
  }, 10 * 60 * 1000);
}

// Start auto-check when app is ready
app.on('ready', () => {
  setTimeout(startEmailAutoCheck, 5000);
});

// ============== CALENDAR IPC HANDLERS ==============
ipcMain.handle('calendar:events', async (_, account?: string, days?: number) => {
  const acct = account || 'kevin.macarthur@bitso.com';
  const daysArg = days ? `--days ${days}` : '--days 7';
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar events ${daysArg} --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
      if (error) {
        safeLog.error('[Calendar] Events error:', error);
        resolve({ success: false, events: [], error: error.message });
        return;
      }
      try {
        const events = JSON.parse(stdout);
        resolve({ success: true, events, account: acct });
      } catch {
        resolve({ success: true, events: [], raw: stdout, account: acct });
      }
    });
  });
});

ipcMain.handle('calendar:createEvent', async (_, params: any) => {
  const { account, title, start, end, location, description, attendees, isAllDay, recurrence, timeZone } = params;
  const acct = account || 'kevin.macarthur@bitso.com';
  const calendarId = 'primary'; // Use primary calendar
  
  // Build gog calendar create command
  let cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar create ${calendarId}`;
  cmd += ` --summary "${title.replace(/"/g, '\\"')}"`;
  
  // Format dates for gog CLI (RFC3339 format or date-only for all-day)
  if (isAllDay) {
    cmd += ` --from "${start}"`;
    cmd += ` --to "${end || start}"`;
    cmd += ` --all-day`;
  } else {
    cmd += ` --from "${start}"`;
    cmd += ` --to "${end || start}"`;
  }
  
  if (location) cmd += ` --location "${location.replace(/"/g, '\\"')}"`;
  if (description) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
  
  if (attendees && attendees.length > 0) {
    const attendeeEmails = attendees.map((a: any) => a.email).join(',');
    cmd += ` --attendees "${attendeeEmails}"`;
  }
  
  if (recurrence && recurrence !== 'none') {
    const rrule = recurrence === 'daily' ? 'RRULE:FREQ=DAILY' :
                   recurrence === 'weekly' ? 'RRULE:FREQ=WEEKLY' :
                   recurrence === 'monthly' ? 'RRULE:FREQ=MONTHLY' : '';
    if (rrule) cmd += ` --rrule "${rrule}"`;
  }
  
  safeLog.log('[Calendar] Create event command:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Calendar] Create event error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      safeLog.log('[Calendar] Create event result:', stdout);
      resolve({ success: true, result: stdout });
    });
  });
});

ipcMain.handle('calendar:updateEvent', async (_, params: any) => {
  const { account, eventId, title, start, end, location, description, attendees, isAllDay, timeZone } = params;
  const acct = account || 'kevin.macarthur@bitso.com';
  const calendarId = 'primary';
  
  // Build gog calendar update command
  let cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar update ${calendarId} "${eventId}"`;
  
  if (title) cmd += ` --summary "${title.replace(/"/g, '\\"')}"`;
  
  if (start) {
    if (isAllDay) {
      cmd += ` --from "${start}"`;
      cmd += ` --to "${end || start}"`;
      cmd += ` --all-day`;
    } else {
      cmd += ` --from "${start}"`;
      cmd += ` --to "${end || start}"`;
    }
  }
  
  if (location !== undefined) cmd += ` --location "${location.replace(/"/g, '\\"')}"`;
  if (description !== undefined) cmd += ` --description "${description.replace(/"/g, '\\"')}"`;
  
  if (attendees && attendees.length > 0) {
    const attendeeEmails = attendees.map((a: any) => a.email).join(',');
    cmd += ` --attendees "${attendeeEmails}"`;
  }
  
  safeLog.log('[Calendar] Update event command:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Calendar] Update event error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      safeLog.log('[Calendar] Update event result:', stdout);
      resolve({ success: true, result: stdout });
    });
  });
});

ipcMain.handle('calendar:deleteEvent', async (_, params: any) => {
  const { account, eventId } = params;
  const acct = account || 'kevin.macarthur@bitso.com';
  const calendarId = 'primary';
  
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar delete ${calendarId} "${eventId}"`;
  
  safeLog.log('[Calendar] Delete event command:', cmd);
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Calendar] Delete event error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      safeLog.log('[Calendar] Delete event result:', stdout);
      resolve({ success: true, result: stdout });
    });
  });
});

// List available calendars for an account
ipcMain.handle('calendar:listCalendars', async (_, account: string) => {
  const cmd = `GOG_ACCOUNT=${account} /opt/homebrew/bin/gog calendar calendars --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Calendar] List calendars error:', error, stderr);
        resolve({ success: false, calendars: [], error: error.message || stderr });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const calendars = data.calendars || data || [];
        resolve({ success: true, calendars, account });
      } catch (parseError) {
        safeLog.error('[Calendar] Parse calendars error:', parseError);
        resolve({ success: false, calendars: [], error: 'Failed to parse calendar list' });
      }
    });
  });
});

// List authenticated accounts (check which accounts have valid credentials)
ipcMain.handle('calendar:listAccounts', async () => {
  const knownAccounts = [
    'kevin.macarthur@bitso.com',
    'kevin@carbium.io',
    'kmacarthur.gpt@gmail.com'
  ];
  
  // Test each account to see if it's authenticated
  const accountPromises = knownAccounts.map(async (email) => {
    const cmd = `GOG_ACCOUNT=${email} /opt/homebrew/bin/gog calendar calendars --json`;
    
    return new Promise<{ email: string; authenticated: boolean; calendarsCount?: number }>((resolve) => {
      exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
        if (error) {
          resolve({ email, authenticated: false });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          const calendars = data.calendars || data || [];
          resolve({ email, authenticated: true, calendarsCount: calendars.length });
        } catch {
          resolve({ email, authenticated: false });
        }
      });
    });
  });
  
  try {
    const accounts = await Promise.all(accountPromises);
    return { success: true, accounts };
  } catch (error) {
    safeLog.error('[Calendar] List accounts error:', error);
    return { success: false, accounts: [], error: String(error) };
  }
});

// Add/authenticate new account
ipcMain.handle('calendar:addAccount', async () => {
  // Launch gog auth flow in terminal
  // This will prompt the user in the terminal to authenticate
  const cmd = `/opt/homebrew/bin/gog auth`;
  
  return new Promise((resolve) => {
    // Run in a new terminal window so user can see the auth flow
    const terminalCmd = `osascript -e 'tell application "Terminal" to do script "${cmd}"'`;
    
    exec(terminalCmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Calendar] Add account error:', error, stderr);
        resolve({ success: false, error: 'Failed to launch authentication. Please run "gog auth" manually in Terminal.' });
        return;
      }
      
      // Return success - the actual auth happens in the terminal
      resolve({ 
        success: true, 
        message: 'Authentication started in Terminal. Please follow the prompts to complete authentication.' 
      });
    });
  });
});

// Remove account credentials
ipcMain.handle('calendar:removeAccount', async (_, account: string) => {
  // gog stores credentials in ~/Library/Application Support/gogcli/
  const credPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'gogcli', `${account}.json`);
  
  return new Promise((resolve) => {
    fs.unlink(credPath, (error) => {
      if (error) {
        safeLog.error('[Calendar] Remove account error:', error);
        resolve({ success: false, error: `Failed to remove credentials: ${error.message}` });
        return;
      }
      safeLog.log('[Calendar] Removed credentials for:', account);
      resolve({ success: true });
    });
  });
});

// Test account connection
ipcMain.handle('calendar:testConnection', async (_, account: string) => {
  const cmd = `GOG_ACCOUNT=${account} /opt/homebrew/bin/gog calendar calendars --json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Calendar] Test connection error:', error, stderr);
        resolve({ success: false, error: error.message || stderr });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const calendars = data.calendars || data || [];
        resolve({ success: true, calendarsCount: calendars.length, account });
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    });
  });
});

// ============== CONNECTED ACCOUNTS IPC HANDLERS ==============

// List all connected accounts
ipcMain.handle('accounts:list', async () => {
  try {
    // Use V2 service for OAuth status detection
    const result = await accountsServiceV2.listAccounts();
    return result;
  } catch (error: any) {
    safeLog.error('[Accounts] List error:', error);
    return { success: false, accounts: [], error: error.message };
  }
});

// Add new account
ipcMain.handle('accounts:add', async (_, request: {
  provider: string;
  email: string;
  dataTypes: string[];
  authType: 'oauth' | 'app-password';
  appPassword?: string;
}) => {
  try {
    safeLog.log('[Accounts] Adding account:', request.email);
    const result = await accountsService.addAccount(request as any);
    return result;
  } catch (error: any) {
    safeLog.error('[Accounts] Add error:', error);
    return { success: false, error: error.message };
  }
});

// Test account connection (kept for backward compatibility)
ipcMain.handle('accounts:test', async (_, accountId: string) => {
  try {
    const result = await accountsService.testAccount(accountId);
    return result;
  } catch (error: any) {
    safeLog.error('[Accounts] Test error:', error);
    return { success: false, error: error.message };
  }
});

// Refresh/renew account OAuth
ipcMain.handle('accounts:refresh', async (_, accountId: string) => {
  try {
    safeLog.log('[Accounts] Refreshing OAuth for:', accountId);
    const result = await accountsServiceV2.refreshAccount(accountId);
    return result;
  } catch (error: any) {
    safeLog.error('[Accounts] Refresh error:', error);
    return { success: false, error: error.message };
  }
});

// Remove account
ipcMain.handle('accounts:remove', async (_, accountId: string) => {
  try {
    safeLog.log('[Accounts] Removing account:', accountId);
    const result = await accountsServiceV2.removeAccount(accountId);
    return result;
  } catch (error: any) {
    safeLog.error('[Accounts] Remove error:', error);
    return { success: false, error: error.message };
  }
});

// ============== CALENDAR AGGREGATION IPC HANDLERS ==============
ipcMain.handle('calendar:aggregate', async (_, options?: {
  days?: number;
  includeGoogle?: boolean;
  includeMissionControl?: boolean;
  accounts?: string[];
}) => {
  try {
    safeLog.log('[Calendar:aggregate] Aggregating events with options:', options);
    const result = await calendarService.aggregateEvents(options || {});
    safeLog.log(`[Calendar:aggregate] Success: ${result.events.length} events from ${Object.keys(result.sources.google).length} sources`);
    return { success: true, ...result };
  } catch (error: any) {
    safeLog.error('[Calendar:aggregate] Error:', error);
    return { success: false, error: error.message, events: [], sources: { google: {}, missionControl: 0 }, errors: [] };
  }
});

ipcMain.handle('calendar:clearCache', async (_, source?: 'google' | 'mission-control' | 'all') => {
  try {
    calendarService.clearCache(source);
    safeLog.log(`[Calendar:clearCache] Cleared cache for: ${source || 'all'}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Calendar:clearCache] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calendar:cacheStats', async () => {
  try {
    const stats = calendarService.getCacheStats();
    safeLog.log('[Calendar:cacheStats] Stats:', stats);
    return { success: true, stats };
  } catch (error: any) {
    safeLog.error('[Calendar:cacheStats] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============== CONNECTED ACCOUNTS IPC HANDLERS ==============
import { connectedAccountsService } from './connected-accounts-service';

ipcMain.handle('connectedAccounts:list', async () => {
  try {
    // Use V2 service for real gog accounts with OAuth status
    const result = await accountsServiceV2.listAccounts();
    return result;
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] List error:', error);
    return { success: false, accounts: [], error: error.message };
  }
});

ipcMain.handle('connectedAccounts:get', async (_, accountId: string) => {
  try {
    const account = await connectedAccountsService.getAccount(accountId);
    return { success: true, account };
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Get error:', error);
    return { success: false, account: null, error: error.message };
  }
});

ipcMain.handle('connectedAccounts:getPermissions', async (_, accountId: string) => {
  try {
    const permissions = await connectedAccountsService.getAccountPermissions(accountId);
    return { success: true, permissions };
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Get permissions error:', error);
    return { success: false, permissions: [], error: error.message };
  }
});

ipcMain.handle('connectedAccounts:getAvailableTypes', async () => {
  try {
    const types = await connectedAccountsService.getAvailableAccountTypes();
    return { success: true, types };
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Get available types error:', error);
    return { success: false, types: [], error: error.message };
  }
});

ipcMain.handle('connectedAccounts:add', async (_, accountType: string, options?: any) => {
  try {
    const result = await connectedAccountsService.addAccount(accountType, options);
    return result;
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Add error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('connectedAccounts:remove', async (_, accountId: string) => {
  try {
    const result = await connectedAccountsService.removeAccount(accountId);
    return result;
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Remove error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('connectedAccounts:refresh', async (_, accountId: string) => {
  try {
    // Use V2 service for OAuth renewal (opens browser)
    safeLog.log('[ConnectedAccounts] Refreshing OAuth for:', accountId);
    const result = await accountsServiceV2.refreshAccount(accountId);
    return result;
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Refresh error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('connectedAccounts:getSyncHistory', async (_, accountId: string, limit?: number) => {
  try {
    const history = await connectedAccountsService.getSyncHistory(accountId, limit);
    return { success: true, history };
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Get sync history error:', error);
    return { success: false, history: [], error: error.message };
  }
});

ipcMain.handle('connectedAccounts:importGoogle', async () => {
  try {
    const result = await connectedAccountsService.importGoogleAccounts();
    return { success: true, ...result };
  } catch (error: any) {
    safeLog.error('[ConnectedAccounts] Import Google error:', error);
    return { success: false, imported: 0, errors: [error.message] };
  }
});

// ============== SESSIONS IPC HANDLERS ==============
// Session list with rate limiting and caching to prevent runaway process storms
// sessions:list, sessions:send removed - renderer uses gateway.ts WebSocket directly

// Shell execution for Code Agent Dashboard, Context Control Board
ipcMain.handle('exec:run', async (_, command: string) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  // Use the clawd workspace as default cwd for git commands
  const workDir = path.join(process.env.HOME || '', 'clawd');

  const result = await secureExec(
    command,
    async (cmd: string) => {
      return await execAsync(cmd, {
        maxBuffer: 1024 * 1024,
        timeout: 30000,
        cwd: workDir,
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/Users/worker/.local/bin:${process.env.PATH || '/usr/bin:/bin'}` },
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
  const registry = getAgentRegistry();
  const agents = Object.keys(registry).filter(id => id !== 'froggo'); // skip alias duplicate
  const metrics: Record<string, any> = {};
  const metricsScriptPath = path.join(os.homedir(), 'clawd', 'scripts', 'agent-metrics.sh');

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

  return metrics;
});

ipcMain.handle('agents:getDetails', async (_, agentId: string) => {
  safeLog.log(`[agents:getDetails] Called with agentId: ${agentId}`);
  debugLog(`[agents:getDetails] Called with agentId: ${agentId}`);
  const froggoDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  
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
      } catch (e) {
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
    const agentMdPath = path.join(os.homedir(), 'clawd', 'agents', agentId, 'AGENT.md');
    agentRules = fs.readFileSync(agentMdPath, 'utf-8');
  } catch (e) {
    try {
      const altPaths = [
        path.join(os.homedir(), 'clawd', 'agents', agentId.toLowerCase(), 'AGENT.md'),
        path.join(os.homedir(), 'clawd', 'agents', agentId === 'chief' ? 'lead-engineer' : agentId, 'AGENT.md'),
        // Try all aliases (e.g. froggo -> main)
        ...dbIds.filter(id => id !== agentId).map(id => path.join(os.homedir(), 'clawd', 'agents', id, 'AGENT.md')),
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
  const froggoDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const escapedSkill = skill.replace(/'/g, "''");
  
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO skill_evolution (skill_name, proficiency, success_count, failure_count) VALUES ('${escapedSkill}', 0.5, 0, 0) ON CONFLICT(skill_name) DO UPDATE SET updated_at = datetime('now')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('agents:updateSkill', async (_, agentId: string, skillName: string, proficiency: number) => {
  const froggoDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const escapedSkill = skillName.replace(/'/g, "''");
  
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE skill_evolution SET proficiency = ${proficiency}, updated_at = datetime('now') WHERE skill_name = '${escapedSkill}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('agents:search', async (_, query: string) => {
  const froggoDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  
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
      } catch (e) {
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
        `/opt/homebrew/bin/spawn-agent-with-retry.py notify "${agentId}" "Task assigned: ${taskId}"`,
        { 
          encoding: 'utf-8', 
          timeout: 10000,
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
    console.error('[agents:spawnForTask] Error:', error.message);
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
              
              const spawnCmd = `openclaw agent --agent-id ${agentId} --session-key ${sessionKey} --message "${systemPrompt.replace(/"/g, '\\"')}\n\nYou are now connected to the dashboard chat. Reply with: ready" --no-deliver`;
              
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
          `openclaw agent --message '${escapedMsg}' --session-id '${sessionKey}' --agent ${agentId}`,
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
      response = cliResult || 'No response from agent';
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
  const script = path.join(os.homedir(), 'clawd', 'scripts', 'agent-onboard-full.sh');

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
    const sessionsDbPath = path.join(os.homedir(), '.clawdbot', 'sessions.db');
    if (!fs.existsSync(sessionsDbPath)) {
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

    // Query sessions from gateway database
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    let query = `SELECT agent_id, model, input_tokens, output_tokens, total_tokens, created_at FROM sessions`;
    if (minTimestamp > 0) {
      query += ` WHERE created_at >= ${minTimestamp}`;
    }
    if (args?.agent) {
      query += minTimestamp > 0 ? ' AND' : ' WHERE';
      query += ` agent_id = '${args.agent}'`;
    }
    
    const { stdout } = await execAsync(`sqlite3 "${sessionsDbPath}" "${query}" -json`, { timeout: 10000 });
    let rows: any[] = [];
    try { rows = JSON.parse(stdout || '[]'); } catch { rows = []; }

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
    const sessionsDbPath = path.join(os.homedir(), '.clawdbot', 'sessions.db');
    if (!fs.existsSync(sessionsDbPath)) {
      return { error: 'sessions.db not found', entries: [] };
    }

    // Build query with filters
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const limit = args?.limit || 100;
    const since = args?.since || 0;
    
    let query = `SELECT session_id, agent_id, model, input_tokens, output_tokens, total_tokens, created_at, updated_at FROM sessions`;
    const whereClauses = [];
    if (args?.agent) whereClauses.push(`agent_id = '${args.agent}'`);
    if (since > 0) whereClauses.push(`created_at >= ${since}`);
    if (whereClauses.length > 0) query += ' WHERE ' + whereClauses.join(' AND ');
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const { stdout } = await execAsync(`sqlite3 "${sessionsDbPath}" "${query}" -json`, { timeout: 10000 });
    let rows: any[] = [];
    try { rows = JSON.parse(stdout || '[]'); } catch { rows = []; }

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
    const sessionsDbPath = path.join(os.homedir(), '.clawdbot', 'sessions.db');
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    
    let usedToday = 0;
    if (fs.existsSync(sessionsDbPath)) {
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const query = `SELECT SUM(total_tokens) as total FROM sessions WHERE agent_id = '${agent}' AND created_at >= ${startOfDay}`;
      const { stdout } = await execAsync(`sqlite3 "${sessionsDbPath}" "${query}" -json`, { timeout: 5000 });
      try {
        const rows = JSON.parse(stdout || '[{"total":0}]');
        usedToday = rows[0]?.total || 0;
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
      `/Users/worker/.local/bin/froggo-db performance-report --days ${days} --json`,
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
      `/Users/worker/.local/bin/froggo-db agent-audit ${args.agentId} --days ${days} --json`,
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
    const dbPath = path.join(os.homedir(), 'clawd/data/froggo.db');
    const query = `SELECT id, correlation_id, from_agent, to_agent, message_type, subject, body, status, created_at, read_at FROM agent_messages WHERE status != 'expired' ORDER BY created_at DESC LIMIT ${limit}`;
    const result = execSync(`sqlite3 -json "${dbPath}" "${query}"`, { encoding: 'utf-8', timeout: 5000 });
    return JSON.parse(result || '[]');
  } catch (e: any) {
    console.error('get-dm-history error:', e);
    return [];
  }
});

ipcMain.handle('get-circuit-status', async () => {
  try {
    const stateFile = path.join(os.homedir(), '.openclaw', 'dispatcher-state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    return state.circuit_breakers || {};
  } catch (e) {
    return {};
  }
});

// ============== CHAT MESSAGES IPC HANDLERS (froggo-db backed) ==============
ipcMain.handle('chat:saveMessage', async (_, msg: { role: string; content: string; timestamp: number; sessionKey?: string }) => {
  const session = msg.sessionKey || 'dashboard';
  const escapedContent = msg.content.replace(/'/g, "''");
  const ts = new Date(msg.timestamp).toISOString();
  
  const cmd = `sqlite3 ~/clawd/data/froggo.db "INSERT INTO messages (timestamp, session_key, channel, role, content) VALUES ('${ts}', '${session}', 'dashboard', '${msg.role}', '${escapedContent}')"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error, error: error?.message });
    });
  });
});

ipcMain.handle('chat:loadMessages', async (_, limit: number = 50, sessionKey?: string) => {
  const session = sessionKey || 'dashboard';
  const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT id, timestamp, role, content FROM messages WHERE session_key='${session}' AND channel='dashboard' ORDER BY timestamp DESC LIMIT ${limit}" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, messages: [] });
        return;
      }
      try {
        const rows = JSON.parse(stdout || '[]');
        const messages = rows.reverse().map((r: any) => ({
          id: `db-${r.id}`,
          role: r.role,
          content: r.content,
          timestamp: new Date(r.timestamp).getTime(),
        }));
        resolve({ success: true, messages });
      } catch {
        resolve({ success: true, messages: [] });
      }
    });
  });
});

ipcMain.handle('chat:clearMessages', async (_, sessionKey?: string) => {
  const session = sessionKey || 'dashboard';
  const cmd = `sqlite3 ~/clawd/data/froggo.db "DELETE FROM messages WHERE session_key='${session}' AND channel='dashboard'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
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
    const claudeCmd = `/Users/worker/.local/bin/claude --print "${prompt.replace(/"/g, '\\"')}"`;
    
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
  const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT COUNT(*) as total FROM starred_messages; SELECT category, COUNT(*) as count FROM starred_messages GROUP BY category;"`;
  
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
  const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT id FROM starred_messages WHERE message_id=${messageId}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 2000 }, (error, stdout) => {
      const isStarred = !error && stdout.trim().length > 0;
      resolve({ success: true, isStarred });
    });
  });
});

// ============== SECURITY IPC HANDLERS ==============
const SECURITY_DB = path.join(os.homedir(), 'clawd', 'data', 'security.db');

// Initialize security database
function initSecurityDB() {
  const dbDir = path.dirname(SECURITY_DB);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const schema = `
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
  `;
  
  execSync(`sqlite3 "${SECURITY_DB}" "${schema}"`, { stdio: 'pipe' });
}

// Ensure DB exists
initSecurityDB();

// List API keys
ipcMain.handle('security:listKeys', async () => {
  try {
    const cmd = `sqlite3 "${SECURITY_DB}" "SELECT * FROM api_keys ORDER BY created_at DESC" -json`;
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const keys = JSON.parse(result || '[]');
    return { success: true, keys };
  } catch (error: any) {
    safeLog.error('[Security] List keys error:', error);
    return { success: false, keys: [], error: error.message };
  }
});

// Add API key
ipcMain.handle('security:addKey', async (_, key: { name: string; service: string; key: string }) => {
  try {
    const id = `key-${Date.now()}`;
    const now = new Date().toISOString();
    const cmd = `sqlite3 "${SECURITY_DB}" "INSERT INTO api_keys (id, name, service, key, created_at) VALUES ('${id}', '${key.name.replace(/'/g, "''")}', '${key.service.replace(/'/g, "''")}', '${key.key.replace(/'/g, "''")}', '${now}')"`;
    execSync(cmd, { stdio: 'pipe' });
    return { success: true, id };
  } catch (error: any) {
    safeLog.error('[Security] Add key error:', error);
    return { success: false, error: error.message };
  }
});

// Delete API key
ipcMain.handle('security:deleteKey', async (_, keyId: string) => {
  try {
    const cmd = `sqlite3 "${SECURITY_DB}" "DELETE FROM api_keys WHERE id='${keyId}'"`;
    execSync(cmd, { stdio: 'pipe' });
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Security] Delete key error:', error);
    return { success: false, error: error.message };
  }
});

// List audit logs
ipcMain.handle('security:listAuditLogs', async () => {
  try {
    const cmd = `sqlite3 "${SECURITY_DB}" "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100" -json`;
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const logs = JSON.parse(result || '[]');
    return { success: true, logs };
  } catch (error: any) {
    safeLog.error('[Security] List audit logs error:', error);
    return { success: false, logs: [], error: error.message };
  }
});

// Update audit log status
ipcMain.handle('security:updateAuditLog', async (_, logId: string, updates: { status?: string }) => {
  try {
    const setClauses = [];
    if (updates.status) setClauses.push(`status='${updates.status}'`);
    const cmd = `sqlite3 "${SECURITY_DB}" "UPDATE audit_logs SET ${setClauses.join(', ')} WHERE id='${logId}'"`;
    execSync(cmd, { stdio: 'pipe' });
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Security] Update audit log error:', error);
    return { success: false, error: error.message };
  }
});

// List security alerts
ipcMain.handle('security:listAlerts', async () => {
  try {
    const cmd = `sqlite3 "${SECURITY_DB}" "SELECT * FROM security_alerts WHERE dismissed=0 ORDER BY timestamp DESC LIMIT 20" -json`;
    const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const alerts = JSON.parse(result || '[]');
    return { success: true, alerts };
  } catch (error: any) {
    safeLog.error('[Security] List alerts error:', error);
    return { success: false, alerts: [], error: error.message };
  }
});

// Dismiss alert
ipcMain.handle('security:dismissAlert', async (_, alertId: string) => {
  try {
    const cmd = `sqlite3 "${SECURITY_DB}" "UPDATE security_alerts SET dismissed=1 WHERE id='${alertId}'"`;
    execSync(cmd, { stdio: 'pipe' });
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
    const scriptPath = path.join(os.homedir(), 'clawd', 'scripts', 'security-audit.sh');
    const result = execSync(`bash "${scriptPath}"`, { 
      encoding: 'utf-8', 
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000 // 60s timeout
    });
    
    const output = JSON.parse(result);
    
    // Store findings in database
    const now = new Date().toISOString();
    for (const finding of output.findings || []) {
      const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const cmd = `sqlite3 "${SECURITY_DB}" "INSERT INTO audit_logs (id, timestamp, severity, category, finding, details, recommendation, status) VALUES ('${id}', '${now}', '${finding.severity}', '${finding.category.replace(/'/g, "''")}', '${finding.finding.replace(/'/g, "''")}', '${finding.details.replace(/'/g, "''")}', '${(finding.recommendation || '').replace(/'/g, "''")}', 'open')"`;
      execSync(cmd, { stdio: 'pipe' });
    }
    
    // Store alerts if any critical/high issues
    for (const alert of output.alerts || []) {
      const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const cmd = `sqlite3 "${SECURITY_DB}" "INSERT INTO security_alerts (id, timestamp, severity, message, source, dismissed) VALUES ('${id}', '${now}', '${alert.severity}', '${alert.message.replace(/'/g, "''")}', '${alert.source}', 0)"`;
      execSync(cmd, { stdio: 'pipe' });
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
    const reportsDir = path.join(os.homedir(), 'clawd', 'reports', 'hr');
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
    console.error('[HRReports] List error:', error);
    return { success: false, reports: [], error: error.message };
  }
});

ipcMain.handle('hrReports:read', async (_, filename: string) => {
  try {
    const reportsDir = path.join(os.homedir(), 'clawd', 'reports', 'hr');
    const filePath = path.join(reportsDir, path.basename(filename)); // Security: basename only
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Report not found' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error: any) {
    console.error('[HRReports] Read error:', error);
    return { success: false, error: error.message };
  }
});
