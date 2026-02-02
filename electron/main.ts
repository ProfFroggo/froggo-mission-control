import { app, BrowserWindow, ipcMain, systemPreferences, protocol, desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec, execSync } from 'child_process';
import * as os from 'os';
import * as http from 'http';
import { calendarService } from './calendar-service';
import { accountsService } from './accounts-service';
import { notificationService, setupNotificationHandlers } from './notification-service';
import { setupNotificationEvents } from './notification-events';
import { secureExec, secureWrite, validateCommand, validateWritePath, getAuditLog, logAudit } from './shell-security';
import * as exportBackupService from './export-backup-service';
import { registerXAutomationsHandlers } from './x-automations-service';
import { initializeDashboardAgents, shutdownDashboardAgents, getDashboardAgentsStatus } from './dashboard-agents';
// const { registerThreadingHandlers } = require('./threading-handler'); // DISABLED - incomplete implementation

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
ipcMain.handle('agents:list', async () => {
  return new Promise((resolve) => {
    exec('clawdbot agents list', { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Agents] Failed to list agents:', error.message);
        resolve({ success: false, agents: [], error: error.message });
        return;
      }

      try {
        // Parse the output to extract agents
        const agents: any[] = [];
        const lines = stdout.split('\n');
        let currentAgent: any = null;

        for (const line of lines) {
          // Match agent header line: "- agent-id (Display Name)" or "- agent-id (default) (Display Name)"
          const headerMatch = line.match(/^- ([a-z-]+)(?:\s+\(default\))?\s+\((.+?)\)/);
          if (headerMatch) {
            // Save previous agent if exists
            if (currentAgent) {
              agents.push(currentAgent);
            }

            const [, id, displayName] = headerMatch;
            currentAgent = {
              id,
              name: displayName,
              avatar: '🤖', // Default, will be updated if Identity line found
              description: '',
              status: id === 'chat-agent' ? 'active' : 'idle',
              capabilities: [],
            };
            continue;
          }

          // Match identity line: "  Identity: 🐸 Froggo (IDENTITY.md)"
          if (currentAgent && line.includes('Identity:')) {
            const identityMatch = line.match(/Identity:\s*([^\s]+)\s+(.+?)\s+\(/);
            if (identityMatch) {
              const [, emoji, name] = identityMatch;
              currentAgent.avatar = emoji;
              // Use identity name if it's more specific than the role name
              if (name && name.trim() && name !== currentAgent.name) {
                currentAgent.description = currentAgent.name; // Role becomes description
                currentAgent.name = name.trim();
              }
            }
          }
        }

        // Don't forget the last agent
        if (currentAgent) {
          agents.push(currentAgent);
        }

        safeLog.log(`[Agents] Loaded ${agents.length} agents from gateway`);
        resolve({ success: true, agents });
      } catch (parseError: any) {
        safeLog.error('[Agents] Failed to parse agent list:', parseError);
        resolve({ success: false, agents: [], error: parseError.message });
      }
    });
  });
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
      webSecurity: false,
    },
  });

  // Setup notification handlers
  setupNotificationHandlers(mainWindow);

  // Setup threading handlers
  // registerThreadingHandlers(ipcMain); // DISABLED - incomplete implementation
  
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
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const query = `SELECT id, title, description, status, project, assigned_to, reviewerId as reviewer_id, priority, due_date, updated_at FROM tasks WHERE id='${taskId}'`;
  
  exec(`sqlite3 "${dbPath}" "${query}" -json`, { timeout: 1000 }, (error, stdout) => {
    if (error) {
      safeLog.error('[TaskEvents] Failed to get task data:', error.message);
      return;
    }
    
    try {
      const tasks = JSON.parse(stdout);
      if (tasks.length === 0) {
        safeLog.error('[TaskEvents] Task not found:', taskId);
        return;
      }
      
      const task = tasks[0];
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
    } catch (parseError) {
      safeLog.error('[TaskEvents] Failed to parse task data:', parseError);
    }
  });
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
        const escapedContent = item.content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        execCmd = `bird tweet "${escapedContent}"`;
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
ipcMain.handle('gateway:status', async () => {
  try {
    const response = await fetch('http://localhost:18789/api/status');
    return await response.json();
  } catch (error) {
    return { error: 'Gateway not reachable' };
  }
});

ipcMain.handle('gateway:sessions', async () => {
  try {
    const response = await fetch('http://localhost:18789/api/sessions');
    return await response.json();
  } catch (error) {
    return { error: 'Gateway not reachable' };
  }
});

// Get real sessions from centralized session store (SQLite)
ipcMain.handle('gateway:sessions:list', async () => {
  try {
    const sessionsDbPath = path.join(os.homedir(), '.clawdbot', 'sessions.db');
    if (!fs.existsSync(sessionsDbPath)) {
      safeLog.error('[Gateway] sessions.db not found at', sessionsDbPath);
      return { success: false, sessions: [], error: 'sessions.db not found' };
    }

    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const query = `SELECT agent_id, session_key, session_id, updated_at, created_at, model, input_tokens, output_tokens, total_tokens, context_tokens, channel, system_sent, aborted_last_run, extra FROM sessions ORDER BY updated_at DESC LIMIT 500`;
    const { stdout } = await execAsync(`sqlite3 "${sessionsDbPath}" "${query}" -json`, { timeout: 10000 });

    let rows: any[] = [];
    try { rows = JSON.parse(stdout || '[]'); } catch { rows = []; }

    const now = Date.now();
    const allSessions = rows.map((r: any) => {
      const key = r.session_key || '';
      let label: string | undefined;
      try {
        if (r.extra) {
          const extra = JSON.parse(r.extra);
          label = extra.label || undefined;
        }
      } catch {}
      return {
        key,
        agent: r.agent_id || '',
        agentId: r.agent_id || '',
        kind: key.includes(':subagent:') ? 'subagent' : 'direct',
        label,
        updatedAt: r.updated_at || 0,
        ageMs: r.updated_at ? now - r.updated_at : 0,
        sessionId: r.session_id || '',
        channel: r.channel || undefined,
        systemSent: !!r.system_sent,
        abortedLastRun: !!r.aborted_last_run,
        inputTokens: r.input_tokens || 0,
        outputTokens: r.output_tokens || 0,
        totalTokens: r.total_tokens || 0,
        model: r.model || undefined,
        contextTokens: r.context_tokens || 0,
      };
    });

    return { success: true, sessions: allSessions, count: allSessions.length };
  } catch (e: any) {
    safeLog.error('[Gateway] Sessions DB query error:', e);
    return { success: false, sessions: [], error: e.message };
  }
});

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

// ============== APPROVAL QUEUE ==============
const APPROVAL_QUEUE_PATH = path.join(process.env.HOME || '', 'clawd', 'approvals', 'queue.json');

ipcMain.handle('approvals:read', async () => {
  try {
    if (!fs.existsSync(APPROVAL_QUEUE_PATH)) {
      return { items: [] };
    }
    const data = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
    return data;
  } catch (error) {
    safeLog.error('Failed to read approval queue:', error);
    return { items: [] };
  }
});

ipcMain.handle('approvals:clear', async () => {
  try {
    const data = { description: "Approval queue - Froggo adds items here, dashboard picks them up", items: [] };
    fs.writeFileSync(APPROVAL_QUEUE_PATH, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    safeLog.error('Failed to clear approval queue:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('approvals:remove', async (_, itemId: string) => {
  try {
    if (!fs.existsSync(APPROVAL_QUEUE_PATH)) return { success: true };
    const data = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
    data.items = (data.items || []).filter((i: any) => i.id !== itemId);
    fs.writeFileSync(APPROVAL_QUEUE_PATH, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    safeLog.error('Failed to remove approval item:', error);
    return { success: false, error: String(error) };
  }
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
  // Split updates into SQL fields (not supported by CLI) and CLI fields
  const sqlFields: string[] = [];
  
  if (updates.planningNotes !== undefined) {
    const escapedNotes = updates.planningNotes.replace(/'/g, "''");
    sqlFields.push(`planning_notes='${escapedNotes}'`);
  }
  
  if (updates.reviewStatus !== undefined) {
    const escapedStatus = updates.reviewStatus.replace(/'/g, "''");
    sqlFields.push(`reviewStatus='${escapedStatus}'`);
  }
  
  if (updates.reviewerId !== undefined) {
    const escapedReviewer = updates.reviewerId.replace(/'/g, "''");
    sqlFields.push(`reviewerId='${escapedReviewer}'`);
  }
  
  // Add status to SQL if provided (more reliable than CLI for atomic updates)
  if (updates.status !== undefined) {
    const escapedStatus = updates.status.replace(/'/g, "''");
    sqlFields.push(`status='${escapedStatus}'`);
  }
  
  if (updates.assignedTo !== undefined) {
    const escapedAssignee = updates.assignedTo.replace(/'/g, "''");
    sqlFields.push(`assigned_to='${escapedAssignee}'`);
  }
  
  // Execute SQL update if we have any fields
  if (sqlFields.length > 0) {
    const sqlCmd = `sqlite3 ~/clawd/data/froggo.db "UPDATE tasks SET ${sqlFields.join(', ')}, updated_at=strftime('%s','now')*1000 WHERE id='${taskId}'"`;
    
    return new Promise((resolve) => {
      exec(sqlCmd, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[Tasks] Update error:', error.message, stderr);
          resolve({ success: false, error: error.message });
        } else {
          safeLog.log('[Tasks] Updated via SQL:', taskId, updates);
          // Emit task update event for real-time Dashboard refresh
          emitTaskEvent('task.updated', taskId);
          resolve({ success: true });
        }
      });
    });
  }
  
  // If no updates provided, return success
  return { success: true };
});

ipcMain.handle('tasks:list', async (_, status?: string) => {
  const statusArg = status ? `--status ${status}` : '';
  const cmd = `sqlite3 ~/clawd/data/froggo.db "SELECT * FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) ${status ? `AND status='${status}'` : ''} ORDER BY created_at DESC" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ success: false, tasks: [] });
      } else {
        try {
          const tasks = JSON.parse(stdout || '[]');
          resolve({ success: true, tasks });
        } catch {
          resolve({ success: false, tasks: [] });
        }
      }
    });
  });
});

// ============== ANALYTICS DATA HANDLER ==============
ipcMain.handle('analytics:getData', async (_, timeRange: string) => {
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');

  return new Promise((resolve) => {
    // Query 1: Daily task completions
    const completionsQuery = `SELECT date(updated_at/1000, 'unixepoch') as date, COUNT(*) as tasks_completed FROM tasks WHERE status = 'done' AND (cancelled IS NULL OR cancelled = 0) AND updated_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date ORDER BY date`;

    // Query 2: Daily task creation (as proxy for activity)
    const createdQuery = `SELECT date(created_at/1000, 'unixepoch') as date, COUNT(*) as tasks_created FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date ORDER BY date`;

    // Query 3: Agent activity
    const agentQuery = `SELECT assigned_to as agent, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND assigned_to IS NOT NULL AND assigned_to != '' AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY assigned_to ORDER BY total DESC`;

    // Query 4: Project progress
    const projectQuery = `SELECT project, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed, ROUND(CAST(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as completion_rate FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND project IS NOT NULL AND project != '' AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY project ORDER BY total DESC LIMIT 10`;

    const results: any = { completions: [], created: [], agents: [], projects: [] };
    let pending = 4;

    const done = () => {
      pending--;
      if (pending === 0) resolve({ success: true, ...results, days });
    };

    exec(`sqlite3 "${dbPath}" "${completionsQuery}" -json`, { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout?.trim()) {
        try { results.completions = JSON.parse(stdout); } catch {}
      }
      done();
    });

    exec(`sqlite3 "${dbPath}" "${createdQuery}" -json`, { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout?.trim()) {
        try { results.created = JSON.parse(stdout); } catch {}
      }
      done();
    });

    exec(`sqlite3 "${dbPath}" "${agentQuery}" -json`, { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout?.trim()) {
        try { results.agents = JSON.parse(stdout); } catch {}
      }
      done();
    });

    exec(`sqlite3 "${dbPath}" "${projectQuery}" -json`, { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout?.trim()) {
        try { results.projects = JSON.parse(stdout); } catch {}
      }
      done();
    });
  });
});

ipcMain.handle('analytics:subtaskStats', async () => {
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const query = `SELECT t.id as taskId, t.title as taskTitle, COUNT(s.id) as totalSubtasks, SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completedSubtasks, ROUND(CASE WHEN COUNT(s.id) > 0 THEN CAST(SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(s.id) * 100 ELSE 0 END, 2) as completionRate FROM tasks t LEFT JOIN subtasks s ON t.id = s.task_id WHERE t.status != 'done' AND (t.cancelled IS NULL OR t.cancelled = 0) GROUP BY t.id, t.title HAVING COUNT(s.id) > 0 ORDER BY completionRate ASC`;

  return new Promise((resolve) => {
    exec(`sqlite3 "${dbPath}" "${query}" -json`, { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout?.trim()) {
        try { resolve({ success: true, data: JSON.parse(stdout) }); return; } catch {}
      }
      resolve({ success: true, data: [] });
    });
  });
});

ipcMain.handle('analytics:heatmap', async (_, days: number = 30) => {
  const dbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
  const query = `SELECT date(timestamp / 1000, 'unixepoch') as date, CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as dayOfWeek, CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour, COUNT(*) as activityCount FROM task_activity WHERE timestamp >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date, dayOfWeek, hour ORDER BY date, hour`;

  return new Promise((resolve) => {
    exec(`sqlite3 "${dbPath}" "${query}" -json`, { timeout: 10000 }, (err, stdout) => {
      if (!err && stdout?.trim()) {
        try { resolve({ success: true, data: JSON.parse(stdout) }); return; } catch {}
      }
      resolve({ success: true, data: [] });
    });
  });
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
  const froggoDbPath = path.join(os.homedir(), 'clawd/data/froggo.db');
  const escapedId = taskId.replace(/'/g, "''");
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE tasks SET cancelled = 1, updated_at = ${Date.now()} WHERE id = '${escapedId}'"`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (error) => {
      if (error) {
        safeLog.error('[Tasks] Delete error:', error.message);
      } else {
        safeLog.log('[Tasks] Soft-deleted (cancelled=1):', taskId);
      }
      resolve({ success: !error });
    });
  });
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
  
  const pokePrompt = `You are Froggo responding to a poke/nudge about a task. Be casual, direct, bit of humor - like texting a mate about work.
Task: "${title}" (ID: ${taskId})
The user is poking you to ask what's happening with this task. Give a brief, personality-driven status update.
Examples of your vibe:
- "Oi why you poking me? 😂 Working on X, nearly done"
- "Getting there boss, just dealing with Y"
- "Almost cracked it, give me 5 more min"
Keep it SHORT (2-3 sentences max). This is a quick status check, not an essay.`;
  
  try {
    // Spawn a chat session scoped to this task poke
    const sessionKey = `poke-${taskId}-${Date.now()}`;
    const sessions = (global as any)._agentChatSessions = (global as any)._agentChatSessions || {};
    
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

    sessions[sessionKey] = {
      agentId: taskAgent,
      messages: [{ role: 'system', content: pokePrompt }],
      systemPrompt: pokePrompt,
      taskId,
      taskTitle: title,
      createdAt: Date.now(),
    };

    // Get initial response via agent CLI
    const escapedPrompt = pokePrompt.replace(/'/g, "'\\''");
    const response = await new Promise<string>((resolve, reject) => {
      exec(
        `clawdbot agent --message '${escapedPrompt}' --session-id '${sessionKey}' --agent ${taskAgent}`,
        { encoding: 'utf-8', timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
          } else {
            resolve(stdout.trim());
          }
        }
      );
    });
    
    // Store the response in session history
    sessions[sessionKey].messages.push(
      { role: 'user', content: `What's the status of "${title}"?` },
      { role: 'assistant', content: response }
    );
    
    safeLog.log(`[Tasks] Internal poke response (${response.length} chars): ${response.slice(0, 100)}...`);
    return { success: true, sessionKey, response };
  } catch (e: any) {
    safeLog.error(`[Tasks] Internal poke error: ${e.message}`);
    // Fallback: return a fun error message instead of boring error
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
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM subtasks WHERE task_id='${taskId}' ORDER BY position, created_at" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Subtasks] List error:', error);
        resolve({ success: false, subtasks: [] });
        return;
      }
      try {
        const subtasks = JSON.parse(stdout || '[]').map((st: any) => ({
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
        resolve({ success: true, subtasks });
      } catch {
        resolve({ success: true, subtasks: [] });
      }
    });
  });
});

ipcMain.handle('subtasks:add', async (_, taskId: string, subtask: { id: string; title: string; description?: string; assignedTo?: string }) => {
  safeLog.log('[Subtasks] Add called:', { taskId, subtask });
  
  // Validate inputs
  if (!taskId || !subtask?.id || !subtask?.title) {
    safeLog.error('[Subtasks] Invalid input:', { taskId, subtask });
    return { success: false, error: 'Invalid input: taskId, subtask.id, and subtask.title are required' };
  }
  
  const now = Date.now();
  const escapedTitle = subtask.title.replace(/'/g, "''");
  const escapedDesc = (subtask.description || '').replace(/'/g, "''");
  
  // Get next position
  return new Promise((resolve) => {
    exec(`sqlite3 "${froggoDbPath}" "SELECT COALESCE(MAX(position), -1) + 1 FROM subtasks WHERE task_id='${taskId}'"`, (posError, posOut, posStderr) => {
      if (posError) {
        safeLog.error('[Subtasks] Position query error:', posError.message, posStderr);
        // Continue with position 0 even if query fails
      }
      const position = parseInt(posOut?.trim() || '0', 10) || 0;
      safeLog.log('[Subtasks] Position:', position);
      
      const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO subtasks (id, task_id, title, description, assigned_to, position, created_at, updated_at) VALUES ('${subtask.id}', '${taskId}', '${escapedTitle}', '${escapedDesc}', ${subtask.assignedTo ? "'" + subtask.assignedTo + "'" : 'NULL'}, ${position}, ${now}, ${now})"`;
      safeLog.log('[Subtasks] Insert command:', cmd.slice(0, 200) + '...');
      
      exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[Subtasks] Add error:', error.message);
          safeLog.error('[Subtasks] stderr:', stderr);
          resolve({ success: false, error: error.message });
        } else {
          safeLog.log('[Subtasks] Insert success:', subtask.id);
          // Also log activity (fire and forget)
          exec(`sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, action, message, timestamp) VALUES ('${taskId}', 'subtask_added', 'Added subtask: ${escapedTitle}', ${now})"`, () => {});
          // Emit task update event for real-time Dashboard refresh
          emitTaskEvent('task.updated', taskId);
          resolve({ success: true, id: subtask.id });
        }
      });
    });
  });
});

ipcMain.handle('subtasks:update', async (_, subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => {
  const now = Date.now();
  const sets: string[] = [`updated_at=${now}`];
  
  if (updates.completed !== undefined) {
    sets.push(`completed=${updates.completed ? 1 : 0}`);
    if (updates.completed) {
      sets.push(`completed_at=${now}`);
      if (updates.completedBy) sets.push(`completed_by='${updates.completedBy}'`);
    } else {
      sets.push(`completed_at=NULL`);
      sets.push(`completed_by=NULL`);
    }
  }
  if (updates.title) sets.push(`title='${updates.title.replace(/'/g, "''")}'`);
  if (updates.assignedTo !== undefined) {
    sets.push(updates.assignedTo ? `assigned_to='${updates.assignedTo}'` : `assigned_to=NULL`);
  }
  
  const cmd = `sqlite3 "${froggoDbPath}" "UPDATE subtasks SET ${sets.join(', ')} WHERE id='${subtaskId}'"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Subtasks] Update error:', error);
        resolve({ success: false, error: error.message });
      } else {
        // Log activity for completion changes
        if (updates.completed !== undefined) {
          exec(`sqlite3 "${froggoDbPath}" "SELECT task_id, title FROM subtasks WHERE id='${subtaskId}'"`, (_, stOut) => {
            try {
              const [taskId, title] = stOut?.trim().split('|') || [];
              if (taskId) {
                const action = updates.completed ? 'subtask_completed' : 'subtask_uncompleted';
                const message = updates.completed 
                  ? `Completed: ${title}${updates.completedBy ? ' by ' + updates.completedBy : ''}`
                  : `Reopened: ${title}`;
                exec(`sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) VALUES ('${taskId}', '${action}', '${message.replace(/'/g, "''")}', ${updates.completedBy ? "'" + updates.completedBy + "'" : 'NULL'}, ${now})"`, () => {});
                // Emit task update event for real-time Dashboard refresh
                emitTaskEvent('task.updated', taskId);
              }
            } catch {}
          });
        }
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('subtasks:delete', async (_, subtaskId: string) => {
  return new Promise((resolve) => {
    // Get task_id and title first for activity log
    exec(`sqlite3 "${froggoDbPath}" "SELECT task_id, title FROM subtasks WHERE id='${subtaskId}'"`, (_, stOut) => {
      const [taskId, title] = stOut?.trim().split('|') || [];
      
      const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM subtasks WHERE id='${subtaskId}'"`;
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          if (taskId) {
            exec(`sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, action, message, timestamp) VALUES ('${taskId}', 'subtask_deleted', 'Deleted subtask: ${(title || '').replace(/'/g, "''")}', ${Date.now()})"`, () => {});
            // Emit task update event for real-time Dashboard refresh
            emitTaskEvent('task.updated', taskId);
          }
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('subtasks:reorder', async (_, subtaskIds: string[]) => {
  const now = Date.now();
  const updates = subtaskIds.map((id, idx) => 
    `UPDATE subtasks SET position=${idx}, updated_at=${now} WHERE id='${id}';`
  ).join(' ');
  
  const cmd = `sqlite3 "${froggoDbPath}" "${updates}"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      resolve({ success: !error });
    });
  });
});

// ============== TASK ACTIVITY IPC HANDLERS ==============
ipcMain.handle('activity:list', async (_, taskId: string, limit?: number) => {
  const lim = limit || 50;
  const cmd = `sqlite3 "${froggoDbPath}" "SELECT * FROM task_activity WHERE task_id='${taskId}' ORDER BY timestamp DESC LIMIT ${lim}" -json`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        safeLog.error('[Activity] List error:', error);
        resolve({ success: false, activities: [] });
        return;
      }
      try {
        const activities = JSON.parse(stdout || '[]').map((a: any) => ({
          id: a.id,
          taskId: a.task_id,
          agentId: a.agent_id,
          action: a.action,
          message: a.message,
          details: a.details,
          timestamp: a.timestamp,
        }));
        resolve({ success: true, activities });
      } catch {
        resolve({ success: true, activities: [] });
      }
    });
  });
});

ipcMain.handle('activity:add', async (_, taskId: string, entry: { action: string; message: string; agentId?: string; details?: string }) => {
  const now = Date.now();
  const escapedMessage = entry.message.replace(/'/g, "''");
  const escapedDetails = entry.details ? entry.details.replace(/'/g, "''") : null;
  
  const cmd = `sqlite3 "${froggoDbPath}" "INSERT INTO task_activity (task_id, agent_id, action, message, details, timestamp) VALUES ('${taskId}', ${entry.agentId ? "'" + entry.agentId + "'" : 'NULL'}, '${entry.action}', '${escapedMessage}', ${escapedDetails ? "'" + escapedDetails + "'" : 'NULL'}, ${now})"`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (!error) {
        // Emit task update event for real-time Dashboard refresh
        emitTaskEvent('task.updated', taskId);
      }
      resolve({ success: !error });
    });
  });
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
  // Actually post the tweet via bird CLI
  const escapedContent = content.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const cmd = `bird tweet "${escapedContent}"`;
  
  // Log progress if taskId provided
  if (taskId) {
    exec(`froggo-db task-progress "${taskId}" "Posting tweet via bird CLI..." --step "Execution"`, () => {});
  }
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Execute] Tweet error:', error.message, stderr);
        if (taskId) {
          exec(`froggo-db task-progress "${taskId}" "Failed: ${error.message}" --step "Error"`, () => {});
          exec(`froggo-db task-update "${taskId}" --status failed`, () => {});
        }
        resolve({ success: false, error: error.message });
      } else {
        safeLog.log('[Execute] Tweet posted:', stdout);
        if (taskId) {
          exec(`froggo-db task-progress "${taskId}" "Tweet posted successfully" --step "Complete"`, () => {});
          exec(`froggo-db task-complete "${taskId}" --outcome success`, () => {});
        }
        resolve({ success: true, output: stdout });
      }
    });
  });
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
      
      // ADD TO APPROVAL QUEUE
      try {
        let queueData: { description: string; items: any[] } = { 
          description: "Approval queue - Froggo adds items here, dashboard picks them up", 
          items: [] 
        };
        if (fs.existsSync(APPROVAL_QUEUE_PATH)) {
          queueData = JSON.parse(fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8'));
        }
        
        const approvalEntry = {
          id: `approval-${id}`,
          type: 'scheduled-post',
          platform: item.type,
          content: item.content,
          scheduledFor: item.scheduledFor,
          createdAt: new Date().toISOString(),
          status: 'pending',
          scheduleId: id,
          metadata: item.metadata || {}
        };
        
        queueData.items.push(approvalEntry);
        fs.writeFileSync(APPROVAL_QUEUE_PATH, JSON.stringify(queueData, null, 2));
        safeLog.log('[Schedule:add] Added to approval queue:', approvalEntry.id);
      } catch (queueError) {
        safeLog.error('[Schedule:add] Failed to add to approval queue:', queueError);
        // Non-fatal, continue with scheduling
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
    exec(`sqlite3 ${scheduleDbPath} "SELECT * FROM schedule WHERE id='${id}'" -json`, (_, stdout) => {
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
          execCmd = `bird tweet "${item.content.replace(/"/g, '\\"')}"`;
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
        const files = JSON.parse(stdout || '[]');
        resolve({ success: true, files });
      } catch {
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

// ============== SYSTEM STATUS IPC HANDLERS ==============
ipcMain.handle('system:status', async () => {
  return new Promise((resolve) => {
    // Check watcher status
    exec('pgrep -f task-watcher.sh', (watcherErr) => {
      const watcherRunning = !watcherErr;
      
      // Check kill switch from env file
      exec('grep EXTERNAL_ACTIONS_ENABLED ~/clawd/config/env.sh 2>/dev/null || echo "false"', (_, envOut) => {
        const killSwitchOn = !envOut?.includes('true');
        
        // Count pending inbox items
        exec('froggo-db inbox-list 2>/dev/null | grep -c "pending" || echo 0', (_, inboxOut) => {
          const pendingInbox = parseInt(inboxOut?.trim() || '0', 10);
          
          // Count in-progress tasks
          exec('froggo-db task-list --status in-progress 2>/dev/null | wc -l || echo 0', (_, taskOut) => {
            const inProgressTasks = parseInt(taskOut?.trim() || '0', 10);
            
            resolve({
              success: true,
              status: {
                watcherRunning,
                killSwitchOn,
                pendingInbox,
                inProgressTasks,
              }
            });
          });
        });
      });
    });
  });
});

// ============== SETTINGS IPC HANDLERS ==============
ipcMain.handle('settings:get', async () => {
  const configPath = path.join(os.homedir(), 'clawd', 'config', 'settings.json');
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return { success: true, settings: JSON.parse(content) };
  } catch {
    return { success: true, settings: {} };
  }
});

ipcMain.handle('settings:save', async (_, settings: any) => {
  const configDir = path.join(os.homedir(), 'clawd', 'config');
  const configPath = path.join(configDir, 'settings.json');
  
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
    
    // Also update environment for task-helpers.sh
    const envLine = settings.externalActionsEnabled 
      ? 'export EXTERNAL_ACTIONS_ENABLED=true'
      : 'export EXTERNAL_ACTIONS_ENABLED=false';
    const envPath = path.join(os.homedir(), 'clawd', 'config', 'env.sh');
    fs.writeFileSync(envPath, `# Auto-generated by Froggo Dashboard\n${envLine}\nexport RATE_LIMIT_TWEETS=${settings.rateLimitTweets || 10}\nexport RATE_LIMIT_EMAILS=${settings.rateLimitEmails || 20}\n`);
    
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Settings] Save error:', error);
    return { success: false, error: error.message };
  }
});

// ============== AI CONTENT GENERATION ==============
// Load Anthropic API key from environment or config
let anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
try {
  const keyPath = path.join(os.homedir(), '.clawdbot', 'anthropic.key');
  if (!anthropicApiKey && fs.existsSync(keyPath)) {
    anthropicApiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  }
} catch {}

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

ipcMain.handle('ai:generate-content', async (_, prompt: string, type: 'ideas' | 'draft' | 'cleanup' | 'chat') => {
  safeLog.log('[AI] Generate content called:', { type, promptLength: prompt.length, hasKey: !!anthropicApiKey });
  
  if (!anthropicApiKey) {
    safeLog.error('[AI] No Anthropic API key configured!');
    return { success: false, error: 'No API key' };
  }
  
  let systemPrompt: string;
  let maxTokens = 1024;
  
  if (type === 'cleanup') {
    // Fast cleanup for transcription errors - very concise prompt
    systemPrompt = `Fix transcription errors in the text. Only correct obvious mistakes, preserve meaning. Return ONLY the corrected text.`;
    maxTokens = 256;
  } else if (type === 'chat') {
    // Chat mode for research/planning agents
    systemPrompt = prompt.includes('[RESEARCH]') 
      ? `You are an X/Twitter research agent. Help research trends, competitors, topics, and content strategies. Be concise and actionable.`
      : `You are an X/Twitter content planning agent. Help plan, strategize, and create engaging content. Be concise and actionable.`;
  } else if (type === 'ideas') {
    systemPrompt = `You are a social media content strategist for X (Twitter). Generate 5 unique post ideas/angles based on the given topic. Each idea should:
- Be engaging and suitable for X/Twitter
- Have a different angle or approach
- Be concise (can fit in 280 characters)
- Include relevant hashtag suggestions where appropriate

Format your response as a JSON array of objects with "idea" and "hook" fields. Example:
[{"idea": "Post idea text here", "hook": "Why this works: explanation"}]`;
  } else {
    systemPrompt = `You are a social media copywriter for X (Twitter). Write a compelling post draft based on the given topic. The post should:
- Be under 280 characters
- Be engaging and shareable
- Include relevant hashtags if appropriate
- Have a strong hook

Return just the tweet text, nothing else.`;
  }

  // Use Anthropic API directly via fetch
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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      safeLog.error('[AI] API error:', response.status, errText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    safeLog.log('[AI] Response length:', content.length);

    if (type === 'cleanup') {
      // Return cleaned text directly
      return { success: true, cleaned: content.trim() };
    } else if (type === 'chat') {
      // Return chat response
      return { success: true, response: content.trim() };
    } else if (type === 'ideas') {
      try {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const ideas = JSON.parse(jsonMatch[0]);
          return { success: true, ideas };
        } else {
          // Fallback: split by newlines
          const ideas = content.trim().split('\n').filter((l: string) => l.trim()).map((line: string) => ({
            idea: line.replace(/^\d+\.\s*/, '').trim(),
            hook: ''
          }));
          return { success: true, ideas };
        }
      } catch (e) {
        safeLog.error('[AI] Parse error:', e);
        return { success: true, ideas: [{ idea: content.trim(), hook: '' }] };
      }
    } else {
      return { success: true, draft: content.trim() };
    }
  } catch (e: any) {
    safeLog.error('[AI] Error:', e.message);
    return { success: false, error: e.message };
  }
});

// ============== AI REPLY GENERATION ==============

ipcMain.handle('ai:generateReply', async (_, context: {
  threadMessages: Array<{role: string, content: string}>,
  platform?: string,
  recipientName?: string,
  subject?: string,
  tone?: 'formal' | 'casual' | 'auto'
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

  const systemPrompt = `You are drafting a reply on behalf of the user. Generate a helpful, contextual reply to the conversation below.

${toneInstruction}
${platformInstruction}

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

// ============== TWITTER IPC HANDLERS ==============
const BIRD_PATH = '/opt/homebrew/bin/bird';
const execEnv = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` };

// Startup test: verify bird CLI is available
exec(`${BIRD_PATH} --version`, { timeout: 5000, env: execEnv }, (error, stdout, stderr) => {
  if (error) {
    safeLog.error('[Twitter] STARTUP TEST FAILED: bird CLI not available!', error.message);
    safeLog.error('[Twitter] stderr:', stderr);
  } else {
    safeLog.log('[Twitter] STARTUP TEST OK: bird version:', stdout.trim());
  }
});

ipcMain.handle('twitter:mentions', async () => {
  safeLog.log('[Twitter] Mentions handler called');
  
  return new Promise((resolve) => {
    try {
      // Use JSON output from bird with full path and extended PATH
      exec(`${BIRD_PATH} mentions --json`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: execEnv }, (error, stdout, stderr) => {
        safeLog.log('[Twitter] exec completed, error:', !!error, 'stdout length:', stdout?.length || 0);
        
        if (error) {
          safeLog.error('[Twitter] Mentions error:', error.message);
          safeLog.error('[Twitter] stderr:', stderr);
          // Return error immediately instead of fallback to avoid double-exec issues
          resolve({ success: false, mentions: [], error: error.message, stderr });
          return;
        }
        
        try {
          const mentions = JSON.parse(stdout || '[]');
          safeLog.log('[Twitter] Parsed', Array.isArray(mentions) ? mentions.length : 0, 'mentions');
          resolve({ success: true, mentions: Array.isArray(mentions) ? mentions : [] });
        } catch (e: any) {
          safeLog.error('[Twitter] JSON parse error:', e.message);
          safeLog.error('[Twitter] Raw stdout:', stdout?.slice(0, 200));
          resolve({ success: true, mentions: [], raw: stdout || '', parseError: e.message });
        }
      });
    } catch (e: any) {
      safeLog.error('[Twitter] Handler exception:', e);
      resolve({ success: false, mentions: [], error: e.message });
    }
  });
});

ipcMain.handle('twitter:home', async (_, limit?: number) => {
  safeLog.log('[Twitter] Home handler called, limit:', limit);
  const countArg = limit ? `--count ${limit}` : '--count 20';
  
  return new Promise((resolve) => {
    try {
      exec(`${BIRD_PATH} home ${countArg} --json`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: execEnv }, (error, stdout, stderr) => {
        safeLog.log('[Twitter] Home exec completed, error:', !!error, 'stdout length:', stdout?.length || 0);
        
        if (error) {
          safeLog.error('[Twitter] Home error:', error.message);
          safeLog.error('[Twitter] stderr:', stderr);
          resolve({ success: false, tweets: [], error: error.message, stderr });
          return;
        }
        
        try {
          const tweets = JSON.parse(stdout || '[]');
          safeLog.log('[Twitter] Parsed', Array.isArray(tweets) ? tweets.length : 0, 'home tweets');
          resolve({ success: true, tweets: Array.isArray(tweets) ? tweets : [] });
        } catch (e: any) {
          safeLog.error('[Twitter] Home JSON parse error:', e.message);
          safeLog.error('[Twitter] Raw stdout:', stdout?.slice(0, 200));
          resolve({ success: true, tweets: [], raw: stdout || '', parseError: e.message });
        }
      });
    } catch (e: any) {
      safeLog.error('[Twitter] Home handler exception:', e);
      resolve({ success: false, tweets: [], error: e.message });
    }
  });
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
    const raw = await runMsgCmd(`${FROGGO_DB_PATH} comms-recent --limit ${limit}`, 3000);
    if (raw && raw.trim().startsWith('[')) {
      const cached = JSON.parse(raw);
      // Transform to match expected format
      return cached.map((m: any) => ({
        id: m.external_id,
        platform: m.platform,
        account: m.account || (m.metadata && typeof m.metadata === 'object' ? m.metadata.account : undefined),
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
      }));
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
  
  // Cache miss or stale - fetch fresh data
  const allMessages: any[] = [];
  
  // Full paths for CLIs (Electron GUI apps don't inherit terminal PATH)
  const WACLI_PATH = '/opt/homebrew/bin/wacli';
  const TGCLI_PATH = '/Users/worker/.local/bin/tgcli';
  
  // Helper to run command and return promise
  const runCmd = (cmd: string, timeout = 10000): Promise<string> => {
    return runMsgCmd(cmd, timeout);
  };
  
  // Helper to format relative time
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
  
  try {
    // ===== WHATSAPP (direct DB query - wacli CLI has bugs) =====
    safeLog.log('[Messages] Fetching WhatsApp messages from DB...');
    const waDbPath = path.join(os.homedir(), '.wacli', 'wacli.db');
    // Get recent INCOMING messages from DM chats AND group chats
    const waQuery = `
      SELECT m.chat_jid, m.chat_name, m.text, m.ts, COALESCE(c.push_name, c.full_name, c.business_name) as contact_name
      FROM messages m
      LEFT JOIN contacts c ON m.chat_jid = c.jid
      WHERE m.from_me = 0 
        AND (m.chat_jid LIKE '%@s.whatsapp.net' OR m.chat_jid LIKE '%@g.us')
        AND m.text IS NOT NULL AND m.text != ''
      GROUP BY m.chat_jid
      ORDER BY m.ts DESC
      LIMIT 15
    `;
    const waRaw = await runCmd(`sqlite3 "${waDbPath}" "${waQuery.replace(/\n/g, ' ')}" -json`, 10000);
    safeLog.log('[Messages] WhatsApp DB result:', waRaw ? `${waRaw.length} chars` : 'EMPTY');
    if (waRaw && waRaw.length > 10) {
      try {
        const waMessages = JSON.parse(waRaw);
        for (const msg of waMessages) {
          let name = msg.contact_name || msg.chat_name || msg.chat_jid || 'Unknown';
          // Clean up JID-style names
          if (name.includes('@')) {
            name = name.split('@')[0];
          }
          if (/^\d+$/.test(name)) {
            name = `+${name}`;
          }
          
          const timestamp = new Date(msg.ts * 1000).toISOString(); // Convert seconds to ms
          allMessages.push({
            id: `wa-${msg.chat_jid}`,
            platform: 'whatsapp',
            name: name,
            preview: (msg.text || '').slice(0, 100),
            timestamp: timestamp,
            relativeTime: relativeTime(timestamp),
            fromMe: false,
          });
        }
      } catch (e) {
        safeLog.error('[Messages] WhatsApp DB parse error:', e);
      }
    }
    
    // ===== TELEGRAM (from cache - tgcli is slow) =====
    safeLog.log('[Messages] Fetching Telegram from cache...');
    const tgCachePath = path.join(os.homedir(), 'clawd', 'data', 'telegram-cache.json');
    
    // Filter out Telegram spam/noise groups - only show work-relevant chats
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
    
    const isTelegramSpam = (chatName: string, preview: string): boolean => {
      const nameLower = (chatName || '').toLowerCase();
      const previewLower = (preview || '').toLowerCase();
      // Exact name match
      if (TELEGRAM_SPAM_NAMES.has(chatName)) return true;
      // Keyword match in name or preview
      return TELEGRAM_SPAM_KEYWORDS.some(kw => nameLower.includes(kw) || previewLower.includes(kw));
    };
    
    try {
      if (fs.existsSync(tgCachePath)) {
        const tgCacheRaw = fs.readFileSync(tgCachePath, 'utf-8');
        const tgCache = JSON.parse(tgCacheRaw);
        
        // Check staleness (warn if > 15 min old)
        const cacheAge = Date.now() - new Date(tgCache.lastUpdated).getTime();
        const isStale = cacheAge > 15 * 60 * 1000;
        
        safeLog.log(`[Messages] Telegram cache: ${tgCache.chats?.length || 0} chats, age: ${Math.round(cacheAge / 60000)}min${isStale ? ' (STALE)' : ''}`);
        
        let spamFiltered = 0;
        for (const chat of (tgCache.chats || [])) {
          if (!chat.lastMessage?.text || chat.lastMessage.text === '(no recent messages)') continue;
          
          // Filter out spam groups
          if (isTelegramSpam(chat.name || '', chat.lastMessage.text || '')) {
            spamFiltered++;
            continue;
          }
          
          // Build timestamp
          let timestamp = chat.lastMessage.timestamp;
          if (timestamp && !timestamp.includes('Z')) {
            timestamp = timestamp + 'Z'; // Assume UTC if no timezone
          }
          
          allMessages.push({
            id: `tg-${chat.id}`,
            platform: 'telegram',
            name: chat.name || 'Unknown',
            preview: (chat.lastMessage.text || '').slice(0, 100),
            timestamp: timestamp,
            relativeTime: relativeTime(timestamp),
            fromMe: false,
            isStale: isStale,
            chatType: chat.type,
          });
        }
        if (spamFiltered > 0) {
          safeLog.log(`[Messages] Filtered ${spamFiltered} Telegram spam groups`);
        }
      } else {
        safeLog.log('[Messages] Telegram cache not found, run telegram-cache.js to populate');
      }
    } catch (e) {
      safeLog.error('[Messages] Telegram cache read error:', e);
    }
    
    // ===== DISCORD DMs (with overall timeout + parallel fetch) =====
    safeLog.log('[Messages] Fetching Discord DMs...');
    const DISCORDCLI_PATH = '/Users/worker/.local/bin/discordcli';
    const DISCORD_OVERALL_TIMEOUT = 12000; // 12s max for all Discord ops
    try {
      const discordPromise = (async () => {
        const discordDmsRaw = await runCmd(`${DISCORDCLI_PATH} dms`, 5000);
        if (!discordDmsRaw || discordDmsRaw.includes('Invalid token')) return;
        
        const dmLines = discordDmsRaw.split('\n').filter(l => l.trim() && !l.startsWith('ID') && !l.startsWith('---'));
        const dms = dmLines.slice(0, 5).map(line => {
          const match = line.match(/^(\d+)\s+(.+)$/);
          if (match) return { id: match[1], name: match[2].trim() };
          return null;
        }).filter(Boolean) as { id: string; name: string }[];
        
        // Fetch DM messages in parallel (not sequential)
        const dmResults = await Promise.allSettled(
          dms.map(async (dm) => {
            const msgRaw = await runCmd(`${DISCORDCLI_PATH} messages ${dm.id} --limit 5`, 4000);
            if (!msgRaw) return null;
            const msgLines = msgRaw.split('\n').filter(l => l.match(/^\[\d{4}-\d{2}-\d{2}/));
            for (const line of msgLines) {
              const msgMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] ([^:]+): (.+)/);
              if (msgMatch && msgMatch[2].trim() !== 'prof_froggo') {
                const timestamp = new Date(msgMatch[1].replace(' ', 'T') + ':00Z');
                return {
                  id: `discord-${dm.id}`,
                  platform: 'discord',
                  name: dm.name.split(',')[0].trim(),
                  preview: msgMatch[3].trim().slice(0, 100),
                  timestamp: timestamp.toISOString(),
                  relativeTime: relativeTime(timestamp.toISOString()),
                  fromMe: false,
                };
              }
            }
            return null;
          })
        );
        
        for (const result of dmResults) {
          if (result.status === 'fulfilled' && result.value) {
            allMessages.push(result.value);
          }
        }
      })();
      
      // Race Discord fetch against overall timeout
      await Promise.race([
        discordPromise,
        new Promise<void>(resolve => setTimeout(() => {
          safeLog.log('[Messages] Discord fetch timed out after ' + DISCORD_OVERALL_TIMEOUT + 'ms, continuing with cached data');
          resolve();
        }, DISCORD_OVERALL_TIMEOUT)),
      ]);
    } catch (e) {
      safeLog.error('[Messages] Discord fetch error (non-fatal):', e);
    }
    
    // ===== EMAIL (via gog gmail) =====
    safeLog.log('[Messages] Fetching emails...');
    // Read email accounts from settings, fallback to defaults
    let emailAccounts = ['kevin.macarthur@bitso.com', 'kevin@carbium.io'];
    try {
      const settingsPath = path.join(os.homedir(), 'clawd', 'config', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settingsContent = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (settingsContent.emailAccounts && Array.isArray(settingsContent.emailAccounts)) {
          emailAccounts = settingsContent.emailAccounts.map((a: any) => a.email || a.address);
        }
      }
    } catch (e) {
      safeLog.error('[Messages] Failed to read email accounts from settings:', e);
    }
    for (const acct of emailAccounts) {
      const emailRaw = await runCmd(`GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail search "is:unread" --json --limit 5`, 15000);
      if (emailRaw) {
        try {
          const emailData = JSON.parse(emailRaw);
          const emails = emailData.threads || emailData || [];
          safeLog.log(`[Messages] Email account ${acct}: ${emails.length} threads`);
          for (const email of emails.slice(0, 3)) {
            allMessages.push({
              id: `email-${email.id || email.ID}`,
              platform: 'email',
              account: acct,
              name: email.from?.split('<')[0]?.trim() || email.From?.split('<')[0]?.trim() || 'Unknown',
              preview: email.subject || email.Subject || email.snippet || '',
              timestamp: email.date || email.Date || new Date().toISOString(),
              relativeTime: relativeTime(email.date || email.Date || new Date().toISOString()),
              fromMe: false,
            });
          }
        } catch (e) {
          safeLog.error('[Messages] Email parse error:', e);
        }
      }
    }
    
    // ===== X/Twitter DMs (via bird) =====
    // bird doesn't have DM support yet - skip for now
    
    // Sort by timestamp (most recent first)
    allMessages.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
    
    // Filter out archived conversations (unless includeArchived is true)
    const filteredMessages = allMessages.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
    safeLog.log(`[Messages] Filtered ${allMessages.length - filteredMessages.length} archived messages`);
    
    const result = filteredMessages.slice(0, lim);
    
    // Write to froggo-db cache (async, don't wait)
    writeCommsToCache(result).catch(e => safeLog.error('[Messages] Cache write failed:', e));
    
    return { success: true, chats: result, fromCache: false };
  } catch (e: any) {
    safeLog.error('[Messages] Error:', e);
    
    // On error, try to return stale cache if available
    const staleCache = await getCommsFromCache(lim);
    if (staleCache && staleCache.length > 0) {
      const filtered = staleCache.filter(m => includeArchived || !archivedKeys.has(getSessionKey(m)));
      safeLog.log('[Messages] Returning stale cache due to fetch error');
      return { success: true, chats: filtered, fromCache: true, stale: true, error: e.message };
    }
    
    return { success: false, chats: [], error: e.message };
  }
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
      const raw = await runCmd(`/opt/homebrew/bin/tgcli messages ${chatId} --limit ${lim}`, 5000);
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
        // Use clawdbot message tool
        result = execSync(`clawdbot message send --channel discord --to ${escapeShell(to)} --message ${escapeShell(message)}`, { encoding: 'utf-8', timeout: 30000 });
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
ipcMain.handle('email:unread', async (_, account?: string) => {
  const acct = account || 'kevin@carbium.io';
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
  const acct = account || 'kevin@carbium.io';
  const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog gmail read ${emailId}`;
  
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } }, (error, stdout) => {
      if (error) {
        safeLog.error('[Email] Body error:', error);
        resolve({ success: false, body: '', error: error.message });
        return;
      }
      resolve({ success: true, body: stdout, emailId });
    });
  });
});

ipcMain.handle('email:search', async (_, query: string, account?: string) => {
  const acct = account || 'kevin@carbium.io';
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
  
  // Read email accounts from settings, fallback to defaults
  let emailAccounts = ['kevin.macarthur@bitso.com', 'kevin@carbium.io'];
  try {
    const settingsPath = path.join(os.homedir(), 'clawd', 'config', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const sc = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (sc.emailAccounts && Array.isArray(sc.emailAccounts)) {
        emailAccounts = sc.emailAccounts.map((a: any) => a.email || a.address);
      }
    }
  } catch (e) {
    safeLog.error('[Email] Failed to read email accounts from settings:', e);
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
    const result = await accountsService.listAccounts();
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

// Test account connection
ipcMain.handle('accounts:test', async (_, accountId: string) => {
  try {
    const result = await accountsService.testAccount(accountId);
    return result;
  } catch (error: any) {
    safeLog.error('[Accounts] Test error:', error);
    return { success: false, error: error.message };
  }
});

// Remove account
ipcMain.handle('accounts:remove', async (_, accountId: string) => {
  try {
    safeLog.log('[Accounts] Removing account:', accountId);
    const result = await accountsService.removeAccount(accountId);
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
    const accounts = await connectedAccountsService.listAccounts();
    return { success: true, accounts };
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
    const result = await connectedAccountsService.refreshAccount(accountId);
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
ipcMain.handle('sessions:list', async () => {
  try {
    // Query centralized session store instead of gateway API
    const sessionsDbPath = path.join(os.homedir(), '.clawdbot', 'sessions.db');
    if (!fs.existsSync(sessionsDbPath)) {
      return { success: false, sessions: [] };
    }
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const query = `SELECT agent_id, session_key, session_id, updated_at, model, input_tokens, output_tokens, total_tokens, context_tokens, channel, system_sent, extra FROM sessions ORDER BY updated_at DESC LIMIT 200`;
    const { stdout } = await execAsync(`sqlite3 "${sessionsDbPath}" "${query}" -json`, { timeout: 10000 });
    let rows: any[] = [];
    try { rows = JSON.parse(stdout || '[]'); } catch { rows = []; }

    const now = Date.now();
    const sessions = rows.map((r: any) => {
      const key = r.session_key || '';
      let label: string | undefined;
      try { if (r.extra) { label = JSON.parse(r.extra).label; } } catch {}
      return {
        key,
        agent: r.agent_id || '',
        agentId: r.agent_id || '',
        kind: key.includes(':subagent:') ? 'subagent' : 'direct',
        label,
        updatedAt: r.updated_at || 0,
        ageMs: r.updated_at ? now - r.updated_at : 0,
        sessionId: r.session_id || '',
        channel: r.channel || undefined,
        model: r.model || undefined,
        totalTokens: r.total_tokens || 0,
        inputTokens: r.input_tokens || 0,
        outputTokens: r.output_tokens || 0,
        contextTokens: r.context_tokens || 0,
      };
    });

    return { success: true, sessions };
  } catch (error) {
    safeLog.error('[Sessions] List error:', error);
    return { success: false, sessions: [] };
  }
});

ipcMain.handle('sessions:history', async (_, sessionKey: string, limit?: number) => {
  try {
    const limitParam = limit ? `?limit=${limit}` : '';
    const response = await fetch(`http://localhost:18789/api/sessions/${sessionKey}/history${limitParam}`);
    const data = await response.json();
    return { success: true, messages: data.messages || [] };
  } catch (error) {
    safeLog.error('[Sessions] History error:', error);
    return { success: false, messages: [] };
  }
});

ipcMain.handle('sessions:send', async (_, sessionKey: string, message: string) => {
  try {
    safeLog.log(`[Sessions] Sending to ${sessionKey}:`, message.slice(0, 100));
    const response = await fetch('http://localhost:18789/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        sessionKey,
        source: 'dashboard-chat-agent'
      }),
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    safeLog.error('[Sessions] Send error:', error);
    return { success: false, error: String(error) };
  }
});

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

// Watch for changes to the approval queue
let queueWatcher: fs.FSWatcher | null = null;
let lastQueueContent = '';

function startQueueWatcher() {
  if (queueWatcher) return;
  
  const queueDir = path.dirname(APPROVAL_QUEUE_PATH);
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }
  
  // Initial content
  try {
    if (fs.existsSync(APPROVAL_QUEUE_PATH)) {
      lastQueueContent = fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8');
    }
  } catch {}
  
  // Watch for changes
  queueWatcher = fs.watch(queueDir, (eventType, filename) => {
    if (filename !== 'queue.json') return;
    
    try {
      const newContent = fs.existsSync(APPROVAL_QUEUE_PATH) 
        ? fs.readFileSync(APPROVAL_QUEUE_PATH, 'utf-8')
        : '';
      
      if (newContent !== lastQueueContent) {
        lastQueueContent = newContent;
        const data = newContent ? JSON.parse(newContent) : { items: [] };
        
        // Notify renderer of new items
        if (data.items?.length > 0) {
          safeSend('approvals:updated', data.items);
        }
      }
    } catch (error) {
      safeLog.error('Error watching queue:', error);
    }
  });
  
  safeLog.log('Approval queue watcher started:', APPROVAL_QUEUE_PATH);
}

// Start watcher after window is created
app.whenReady().then(() => {
  setTimeout(startQueueWatcher, 1000);
  
  // Self-test: verify agent DB queries work on startup
  setTimeout(() => {
    debugLog('[SELF-TEST] Testing agents:getDetails DB queries...');
    const testDbPath = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
    try {
      const testCmd = `sqlite3 "${testDbPath}" "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE assigned_to IN ('coder') AND (cancelled IS NULL OR cancelled = 0)" -json`;
      debugLog('[SELF-TEST] Running:', testCmd);
      const testResult = execSync(testCmd, { encoding: 'utf-8', timeout: 5000 });
      debugLog('[SELF-TEST] Result:', testResult.trim());
      const parsed = JSON.parse(testResult);
      debugLog('[SELF-TEST] Parsed:', JSON.stringify(parsed));
      debugLog('[SELF-TEST] ✅ DB queries work! total=' + parsed[0]?.total + ' completed=' + parsed[0]?.completed);
    } catch (e: any) {
      debugLog('[SELF-TEST] ❌ FAILED:', e.message);
    }
  }, 3000);
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

ipcMain.handle('agents:spawnChat', async (_, agentId: string) => {
  safeLog.log(`[agents:spawnChat] Called with agentId: ${agentId}`);
  debugLog(`[agents:spawnChat] Called with agentId: ${agentId}`);
  try {
    // Spawn a real agent chat session via the gateway WebSocket
    const gatewayWsUrl = 'ws://127.0.0.1:18789';
    const gatewayToken = '14ac9fc2afdd3363df3842a36ab269ca4137b8059ca3b0ba';
    
    // Use the gateway HTTP API to spawn a session
    const httpUrl = 'http://127.0.0.1:18789';
    const label = `dashboard-chat-${agentId}-${Date.now()}`;
    
    // Agent system prompts from registry
    const chatRegistry = getAgentRegistry();
    const systemPrompt = chatRegistry[agentId]?.prompt || `You are the ${agentId} agent. Help the user with tasks related to your role.`;
    
    // Store session info for later chat calls
    const sessionKey = `chat-${agentId}-${Date.now()}`;
    
    // Store the agent context for this session
    if (!(global as any)._agentChatSessions) {
      (global as any)._agentChatSessions = {};
    }
    (global as any)._agentChatSessions[sessionKey] = {
      agentId,
      systemPrompt,
      messages: [{ role: 'system', content: systemPrompt }],
      label,
    };
    
    safeLog.log(`[agents:spawnChat] Spawned session for ${agentId}: ${sessionKey}`);
    debugLog(`[agents:spawnChat] Spawned session for ${agentId}: ${sessionKey}`);
    return { success: true, sessionKey };
  } catch (error: any) {
    safeLog.error(`Failed to spawn chat for ${agentId}:`, error);
    return { success: false, error: error.message || 'Failed to spawn chat session' };
  }
});

ipcMain.handle('agents:chat', async (_, sessionKey: string, message: string) => {
  safeLog.log(`[agents:chat] Called with sessionKey: ${sessionKey}, message length: ${message.length}`);
  debugLog(`[agents:chat] Called with sessionKey: ${sessionKey}, message length: ${message.length}`);
  try {
    const sessions = (global as any)._agentChatSessions || {};
    const session = sessions[sessionKey];
    
    if (!session) {
      return { success: false, error: `Session ${sessionKey} not found. Please reconnect.` };
    }
    
    // Add user message to history
    session.messages.push({ role: 'user', content: message });
    
    let response: string;
    
    // Map dashboard agent IDs to clawdbot agent IDs
    const chatReg = getAgentRegistry();
    const clawdAgentId = chatReg[session.agentId]?.clawdAgentId || session.agentId;
    
    // Build context from conversation history (last few exchanges)
    const recentHistory = session.messages
      .filter((m: any) => m.role !== 'system')
      .slice(-6) // last 3 exchanges
      .map((m: any) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    
    // Compose full message with system prompt context + history
    const fullMessage = session.messages.length <= 2
      ? `${session.systemPrompt}\n\nRespond to this message from the dashboard user:\n${message}`
      : `${session.systemPrompt}\n\nConversation so far:\n${recentHistory}`;
    
    // Primary: use clawdbot agent CLI (routes through gateway with proper auth)
    const escapedMsg = fullMessage.replace(/'/g, "'\\''");
    
    try {
      const cliResult = await new Promise<string>((resolve, reject) => {
        exec(
          `clawdbot agent --message '${escapedMsg}' --session-id '${sessionKey}' --agent ${clawdAgentId}`,
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
      
      // Fallback: direct Anthropic API if key available
      if (anthropicApiKey) {
        const https = await import('https');
        response = await new Promise<string>((resolve, reject) => {
          const body = JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: session.systemPrompt,
            messages: session.messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
              role: m.role,
              content: m.content,
            })),
          });
          
          const req = https.request({
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
            },
          }, (res: any) => {
            let data = '';
            res.on('data', (chunk: any) => data += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  reject(new Error(parsed.error.message || 'API error'));
                  return;
                }
                resolve(parsed.content?.[0]?.text || 'No response content');
              } catch (e) {
                reject(new Error(`Failed to parse: ${data.slice(0, 200)}`));
              }
            });
          });
          req.on('error', reject);
          req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
          req.write(body);
          req.end();
        });
      } else {
        response = `⚠️ Agent unavailable: ${cliErr.message}. Ensure clawdbot gateway is running.`;
      }
    }
    
    // Add assistant response to history
    session.messages.push({ role: 'assistant', content: response });
    
    // Keep history manageable
    if (session.messages.length > 41) {
      session.messages = [session.messages[0], ...session.messages.slice(-40)];
    }
    
    return { success: true, response };
  } catch (error: any) {
    safeLog.error('Agent chat error:', error);
    return { success: false, error: error.message || 'Unknown error', response: `❌ Error: ${error.message || 'Unknown error'}` };
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
