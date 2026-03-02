import { app, BrowserWindow, shell, dialog, screen, systemPreferences, desktopCapturer, ipcMain } from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { exec, execFile, execSync, execFileSync } from 'child_process';
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
import { initializeDashboardAgents, shutdownDashboardAgents } from './dashboard-agents';
import { initializeFinanceAgentBridge } from './finance-agent-bridge';
import { registerFinanceHandlers } from './finance-service';
import { initXApiTokens, postTweet as xPostTweet } from './x-api-client';
import { registerXPublishingHandlers } from './x-publishing-service';
import { registerXAnalyticsHandlers } from './x-analytics-service';
import { registerAgentManagementHandlers } from './agent-management-service';
import { registerMemoryLifecycleHandlers } from './memory-lifecycle-service';
import { registerSearchHandlers } from './search-service';
import { registerKnowledgeHandlers } from './knowledge-service';
import { registerAllHandlers, startCommsPolling, startEmailAutoCheck } from './handlers/index';
import { registerOnboardingHandlers } from './onboarding-service';
import { prepare, closeDb, getDb } from './database';
import { DATA_DIR, verifyPaths, PathCheckResult } from './paths';
import { runMigrations } from './migrations';

// ============== SAFE LOGGER (EPIPE-proof) ==============
const safeLog = {
  log: (...args: unknown[]) => { try { if (process.stdout.writable) console.log(...args); } catch { /* ignore */ } },
  error: (...args: unknown[]) => { try { if (process.stderr.writable) console.error(...args); } catch { /* ignore */ } },
  warn: (...args: unknown[]) => { try { if (process.stderr.writable) console.warn(...args); } catch { /* ignore */ } },
  debug: (...args: unknown[]) => { try { if (process.stdout.writable) console.debug(...args); } catch { /* ignore */ } },
};

// Global EPIPE handler
process.on('uncaughtException', (error: any) => {
  if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') return;
  try { if (process.stderr.writable) safeLog.error('[UNCAUGHT EXCEPTION]', error); } catch { /* ignore */ }
});
process.on('unhandledRejection', (reason: any) => { safeLog.error('[UNHANDLED REJECTION]', reason); });
process.on('SIGPIPE', () => { /* Ignore SIGPIPE */ });

// Local server for serving model files in prod
let modelServer: http.Server | null = null;
const modelServerPort = 18799;

let mainWindow: BrowserWindow | null = null;

// ── Deep link protocol ──────────────────────────────────────────────────────
let pendingDeepLinkUrl: string | null = null;

// Register openclaw:// protocol handler
if (process.defaultApp) {
  // Dev mode: need to pass script path
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('openclaw', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('openclaw');
}

// Single-instance lock — focus existing window on second launch
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Windows/Linux: URL passed via argv
    const url = commandLine.find(arg => arg.startsWith('openclaw://'));
    if (url) handleDeepLink(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// macOS: open-url fires when app is already running OR during cold launch
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

function handleDeepLink(url: string) {
  safeLog.log('[DeepLink] Received:', url);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'openclaw:') return;
    // openclaw://install/module-id → action=install, moduleId=module-id
    const action = parsed.hostname || parsed.pathname.split('/')[1];
    const moduleId = parsed.pathname.replace(/^\/+/, '');
    if (action === 'install' && moduleId) {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('deep-link:install', { moduleId });
      } else {
        // Cold launch: buffer until renderer is ready
        pendingDeepLinkUrl = moduleId;
      }
    }
  } catch (err) {
    safeLog.error('[DeepLink] Failed to parse URL:', err);
  }
}

// Request microphone AND camera access on macOS
if (process.platform === 'darwin') {
  systemPreferences.askForMediaAccess('microphone').then(granted => { safeLog.log('Microphone access:', granted ? 'granted' : 'denied'); });
  systemPreferences.askForMediaAccess('camera').then(granted => { safeLog.log('Camera access:', granted ? 'granted' : 'denied'); });
}

const distPath = path.join(__dirname, '..', 'dist', 'index.html');
const isDev = process.env.ELECTRON_DEV === '1';

safeLog.log('App packaged:', app.isPackaged);
safeLog.log('Dist path:', distPath);
safeLog.log('isDev:', isDev);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f0f0f',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: true, sandbox: true },
  });

  const isDevApp = app.getName().includes('Dev') || isDev;
  const appVersion = app.getVersion();
  mainWindow.setTitle(isDevApp ? `Froggo [DEV] v${appVersion}` : `Froggo v${appVersion}`);

  // Setup notification handlers (mainWindow-dependent)
  setupNotificationHandlers(mainWindow);

  if (isDev) {
    safeLog.log('Running in dev mode, loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    safeLog.log('Running in production mode, loading from dist');
    mainWindow.loadFile(distPath);
  }

  // Handle permission requests
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture', 'display-capture', 'screen'];
    callback(allowed.includes(permission));
  });
  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture', 'display-capture', 'screen'].includes(permission);
  });
  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      if (sources.length > 0) {
        callback({ video: sources[0] });
      } else {
        callback({ video: { id: '', name: '' } as any, useSystemPicker: true } as any);
      }
    } catch (err) {
      safeLog.error('[DisplayMedia] Failed to get sources:', err);
      callback({ video: { id: '', name: '' } as any, useSystemPicker: true } as any);
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    safeLog.log('[Main] RENDERER CRASHED:', details.reason, details.exitCode);
  });

  // Navigation lockdown — block navigation to non-app URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = isDev
      ? ['http://localhost:5173']
      : ['file://'];
    const parsed = new URL(url);
    const origin = parsed.origin === 'null' ? 'file://' : parsed.origin;
    if (!allowedOrigins.includes(origin)) {
      event.preventDefault();
      safeLog.warn(`[Security] Blocked navigation to: ${url}`);
      shell.openExternal(url).catch(() => {});
    }
  });

  // Block popup windows — open safe URLs in system browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url).catch(() => {});
    }
    safeLog.warn(`[Security] Blocked window.open: ${url}`);
    return { action: 'deny' };
  });

  // Production CSP — override via session headers (stricter than meta tag)
  if (!isDev) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' blob:; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: https: blob:; " +
            "media-src 'self' blob:; " +
            "connect-src 'self' http://127.0.0.1:18789 http://localhost:18789 ws://127.0.0.1:18789 wss://127.0.0.1:18789 ws://localhost:18789 wss://localhost:18789 ws://127.0.0.1:18891 wss://127.0.0.1:18891 https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://api.elevenlabs.io https://api.twitter.com https://api.x.com https://wttr.in;"
          ],
        },
      });
    });
  }

  mainWindow.on('close', () => {
    if (mainWindow) { safeLog.log('[Main] Window closing - sending cleanup signal...'); safeSend('app-closing'); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function safeSend(channel: string, ...args: any[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send(channel, ...args); } catch (e) {
      if ((e as any).code !== 'EPIPE') safeLog.error(`[SafeSend] Error sending to ${channel}:`, e);
    }
  }
}

// Task notification file watcher
let taskNotifyWatcher: fs.FSWatcher | null = null;
const taskNotifyPath = path.join(DATA_DIR, 'task-notify.json');
let lastTaskNotifyMtime = 0;

function startTaskNotifyWatcher() {
  const dir = path.dirname(taskNotifyPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try {
    taskNotifyWatcher = fs.watch(path.dirname(taskNotifyPath), (_eventType, filename) => {
      if (filename === 'task-notify.json' && mainWindow && !mainWindow.isDestroyed()) {
        try {
          const stat = fs.statSync(taskNotifyPath);
          if (stat.mtimeMs > lastTaskNotifyMtime) {
            lastTaskNotifyMtime = stat.mtimeMs;
            const content = fs.readFileSync(taskNotifyPath, 'utf-8');
            const notification = JSON.parse(content);
            try { mainWindow!.webContents.send('task-notification', notification); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
    });
    safeLog.log('[TaskNotify] Watching for task notifications at:', taskNotifyPath);
  } catch (e) { safeLog.error('[TaskNotify] Failed to start watcher:', e); }
}

// Schedule processor
let scheduleProcessorInterval: NodeJS.Timeout | null = null;
const SCHEDULE_CHECK_INTERVAL = 30000;

async function processScheduledItems() {
  let items: any[] = [];
  try {
    items = prepare("SELECT id, type, content, scheduled_for, status, created_at, sent_at, error, metadata FROM schedule WHERE status = 'pending'").all() as any[];
  } catch (e: any) {
    safeLog.error('[ScheduleProcessor] Query error:', e.message);
    return;
  }
  if (items.length === 0) return;
  const now = new Date();
  items = items.filter(item => item.scheduled_for && new Date(item.scheduled_for) <= now);
  if (items.length === 0) return;
  safeLog.log(`[ScheduleProcessor] Found ${items.length} overdue item(s) to process`);
  const updateScheduleStatus = (itemId: string, status: string, error?: string | null) => {
    try { prepare("UPDATE schedule SET status = ?, sent_at = datetime('now'), error = ? WHERE id = ?").run(status, error || null, itemId); } catch { /* ignore */ }
  };
  for (const item of items) {
    let metadata: any = {};
    try { if (item.metadata) metadata = JSON.parse(item.metadata); } catch { /* ignore */ }
    if (item.type === 'tweet') {
      try {
        const result = await xPostTweet(item.content);
        if (result.success) { updateScheduleStatus(item.id, 'completed'); } else { updateScheduleStatus(item.id, 'failed', result.error || 'Unknown tweet error'); }
        continue;
      } catch (e: any) {
        safeLog.error(`[ScheduleProcessor] Tweet error:`, e.message);
        updateScheduleStatus(item.id, 'failed', (e.message || 'Tweet exception').slice(0, 500));
        continue;
      }
    } else if (item.type === 'email') {
      const recipient = metadata.recipient || metadata.to || '';
      const account = metadata.account || '';
      if (!recipient?.trim()) { updateScheduleStatus(item.id, 'failed', 'Missing recipient'); continue; }
      if (!account?.trim()) { updateScheduleStatus(item.id, 'failed', 'Missing GOG account'); continue; }
      const subject = metadata.subject || 'No subject';
      const body = item.content;
      execFile('/opt/homebrew/bin/gog', ['gmail', 'send', '--to', recipient, '--subject', subject, '--body', body], { timeout: 60000, env: { ...process.env, GOG_ACCOUNT: account } }, (execError) => {
        if (execError) { updateScheduleStatus(item.id, 'failed', (execError.message || '').slice(0, 500)); safeSend('schedule-processed', { id: item.id, type: item.type, success: false, error: execError.message }); }
        else { updateScheduleStatus(item.id, 'sent'); safeSend('schedule-processed', { id: item.id, type: item.type, success: true }); }
      });
    } else { updateScheduleStatus(item.id, 'failed', `Unknown type: ${item.type}`); }
  }
}

function startScheduleProcessor() {
  safeLog.log('[ScheduleProcessor] Starting schedule processor (every 30s)');
  processScheduledItems();
  scheduleProcessorInterval = setInterval(processScheduledItems, SCHEDULE_CHECK_INTERVAL);
}

function stopScheduleProcessor() {
  if (scheduleProcessorInterval) { clearInterval(scheduleProcessorInterval); scheduleProcessorInterval = null; }
}

// Scheduled auto-poster
let scheduleInterval: NodeJS.Timeout | null = null;
function startScheduledPoster() {
  if (scheduleInterval) return;
  scheduleInterval = setInterval(async () => {
    try {
      const now = Date.now();
      const pending = prepare(`SELECT * FROM scheduled_posts WHERE status = 'pending' AND scheduled_time <= ?`).all(now) as { id: string; content: string }[];
      for (const post of pending) {
        try {
          execFileSync('/opt/homebrew/bin/x-api', ['post', post.content], { encoding: 'utf-8' });
          prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run('posted', post.id);
          safeLog.log(`[X/AutoPost] Posted scheduled tweet: ${post.id}`);
        } catch (postError: any) {
          safeLog.error(`[X/AutoPost] Failed to post ${post.id}:`, postError.message);
          prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run('failed', post.id);
        }
      }
    } catch (error: any) { safeLog.error('[X/AutoPost] Interval error:', error.message); }
  }, 60000);
  safeLog.log('[X/AutoPost] Started scheduled poster interval');
}

// Notification event cleanup
let stopNotificationEvents: (() => void) | null = null;

/**
 * Check if the OpenClaw gateway is healthy and attempt to start it if not.
 * Returns true if the gateway is running (or was successfully started),
 * false if it could not be started.
 */
async function startGateway(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:18789/health', { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      // Gateway not running — try to start it via launchctl kickstart
      safeLog.log('[Startup] Gateway not running, attempting auto-start...');
      const uid = process.getuid?.() ?? 501;
      execFile('launchctl', ['kickstart', '-k', `gui/${uid}/ai.openclaw.gateway`],
        { timeout: 10000 },
        (kickErr) => {
          if (kickErr) {
            // Kickstart failed — try bootstrap as fallback (plist might not be loaded yet)
            const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/ai.openclaw.gateway.plist');
            execFile('launchctl', ['bootstrap', `gui/${uid}`, plistPath],
              { timeout: 10000 },
              (bootstrapErr) => {
                if (bootstrapErr) {
                  safeLog.warn('[Startup] Gateway auto-start failed:', bootstrapErr.message);
                  resolve(false);
                } else {
                  // Wait for gateway to come up after bootstrap
                  setTimeout(() => resolve(true), 3000);
                }
              }
            );
          } else {
            // Wait for gateway to come up after kickstart
            setTimeout(() => resolve(true), 3000);
          }
        }
      );
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

app.whenReady().then(async () => {
  // ── Pre-window startup checks ────────────────────────────────────────────
  const pathResults = verifyPaths();
  const criticalMissing = pathResults.filter(r => r.critical && !r.exists);

  if (criticalMissing.length > 0) {
    const missing = criticalMissing.map(r => `  - ${r.label}\n    ${r.path}`).join('\n');
    dialog.showErrorBox(
      'Froggo: Required Files Missing',
      `Cannot start — the following required files are missing:\n\n${missing}\n\nPlease ensure the Froggo project is set up at ~/froggo/ with a valid database.\n\nThe app will now quit.`
    );
    app.quit();
    return;
  }

  // Auto-start gateway if not running
  const gatewayRunning = await startGateway();
  if (gatewayRunning) {
    safeLog.log('[Startup] Gateway is running');
  } else {
    safeLog.warn('[Startup] Gateway is not running — app will start in degraded mode');
  }

  // Store startup state for renderer queries
  const startupState = { pathResults, gatewayRunning };

  // ── Start local HTTP server to serve model files in prod ─────────────────
  if (!isDev) {
    modelServer = http.createServer((req, res) => {
      const filePath = path.join(process.resourcesPath, 'models', path.basename(req.url || ''));
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size, 'Access-Control-Allow-Origin': '*' });
        fs.createReadStream(filePath).pipe(res);
      } else { res.writeHead(404); res.end('Not found'); }
    });
    modelServer.listen(modelServerPort, '127.0.0.1', () => { safeLog.log(`[ModelServer] Serving models on http://127.0.0.1:${modelServerPort}`); });
  }

  // Run database migrations
  runMigrations(getDb());

  // Initialize X API tokens from secret store
  try { initXApiTokens(); } catch (err) { safeLog.error('[Main] Failed to initialize X API tokens:', err); }

  // Register ALL extracted IPC handlers (Waves 1-3)
  registerAllHandlers();

  // Register service-file handlers
  registerXAutomationsHandlers();
  registerWritingProjectHandlers();
  registerWritingFeedbackHandlers();
  registerWritingMemoryHandlers();
  registerWritingResearchHandlers();
  registerWritingVersionHandlers();
  registerWritingChatHandlers();
  registerWritingWizardHandlers();
  registerFinanceHandlers();
  registerXPublishingHandlers();
  registerXAnalyticsHandlers();
  registerAgentManagementHandlers();
  registerMemoryLifecycleHandlers();
  registerSearchHandlers();
  registerKnowledgeHandlers();

  // Register Onboarding wizard IPC handlers (deps, permissions, sample data)
  registerOnboardingHandlers();

  // Expose startup state to renderer
  ipcMain.handle('startup:getState', () => startupState);

  // Start background services
  startTaskNotifyWatcher();
  startScheduleProcessor();
  startScheduledPoster();

  // Create window
  createWindow();

  // Flush any deep link that arrived during cold launch
  if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (pendingDeepLinkUrl) {
        mainWindow?.webContents.send('deep-link:install', { moduleId: pendingDeepLinkUrl });
        pendingDeepLinkUrl = null;
      }
    });
  }

  // Start notification event listeners (requires mainWindow)
  if (mainWindow) { stopNotificationEvents = setupNotificationEvents(mainWindow); }

  // Initialize persistent dashboard agent sessions
  initializeDashboardAgents().catch(err => { safeLog.error('[Main] Failed to initialize dashboard agents:', err); });
  initializeFinanceAgentBridge().catch(err => { safeLog.error('[Main] Failed to initialize Finance Agent Bridge:', err); });

  // Check for updates (prod only)
  if (!isDev && !app.getName().includes('Dev')) {
    checkForUpdates().catch(err => safeLog.error('[Updates] Failed to check for updates:', err));
  }

  // Start comms polling and email auto-check (extracted timers)
  setTimeout(startCommsPolling, 8000);
  setTimeout(startEmailAutoCheck, 5000);
});

// Update checker
async function checkForUpdates(): Promise<void> {
  const https = await import('https');
  return new Promise((resolve) => {
    const req = https.get('https://api.github.com/repos/ProfFroggo/froggo_bot/releases/latest', {
      headers: { 'User-Agent': 'Froggo-App', Accept: 'application/vnd.github.v3+json' }, timeout: 10000,
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
              type: 'info', title: 'Update Available',
              message: `Froggo v${remoteVersion} is available (you have v${localVersion}).`,
              buttons: ['View Release', 'Later'], defaultId: 0, cancelId: 1,
            });
            if (response === 0) shell.openExternal(release.html_url || `https://github.com/ProfFroggo/froggo_bot/releases/tag/v${remoteVersion}`);
          }
        } catch { /* ignore */ }
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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('will-quit', () => {
  if (modelServer) { modelServer.close(); modelServer = null; }
  if (taskNotifyWatcher) { taskNotifyWatcher.close(); taskNotifyWatcher = null; }
  stopScheduleProcessor();
  if (stopNotificationEvents) { stopNotificationEvents(); stopNotificationEvents = null; }
  if (scheduleInterval) { clearInterval(scheduleInterval); scheduleInterval = null; }
  shutdownDashboardAgents();
  closeAllResearchDbs();
  closeDb();
});

app.on('activate', () => { if (mainWindow === null) createWindow(); });
