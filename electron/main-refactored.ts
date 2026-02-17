/**
 * Main Process Entry Point (Refactored)
 * 
 * Thin orchestrator that imports and registers all IPC handlers.
 * Handlers are organized by domain in the handlers/ directory.
 * 
 * Original main.ts was 9043 lines - this version delegates to handler modules.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// Existing service imports (already modularized)
import { notificationService, setupNotificationHandlers } from './notification-service';
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
import { initXApiTokens } from './x-api-client';
import { prepare, closeDb } from './database';
import { initializeFinanceAgentBridge } from './finance-agent-bridge';
import { safeLog } from './logger';

// Path constants - only importing what's actually used
import {
  verifyPaths,
} from './paths';

// NEW: Modular IPC handlers
import {
  registerAgentHandlers,
  registerXTwitterHandlers,
  // Future: registerTaskHandlers,
  // Future: registerFinanceHandlers,
  // Future: registerSecurityHandlers,
  // Future: registerChatHandlers,
  // Future: registerExportHandlers,
} from './handlers';

// ============== WINDOW MANAGEMENT ==============

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ============== APP LIFECYCLE ==============

app.whenReady().then(async () => {
  safeLog.log('[Main] App ready, initializing...');

  // Verify paths
  verifyPaths();

  // Initialize services
  try {
    await initializeDashboardAgents();
    await initializeFinanceAgentBridge();
    initXApiTokens();
    safeLog.log('[Main] Services initialized');
  } catch (err: any) {
    safeLog.error('[Main] Service initialization error:', err.message);
  }

  // Create main window
  mainWindow = createMainWindow();

  // Setup notification events
  setupNotificationEvents(mainWindow);

  // Setup notification handlers
  setupNotificationHandlers(mainWindow);

  // Register writing service handlers
  registerWritingProjectHandlers();
  registerWritingFeedbackHandlers();
  registerWritingMemoryHandlers();
  registerWritingResearchHandlers();
  registerWritingVersionHandlers();
  registerWritingChatHandlers();
  registerWritingWizardHandlers();

  // Register X automations handlers
  registerXAutomationsHandlers();

  // NEW: Register modular handlers
  registerAgentHandlers();
  registerXTwitterHandlers();
  // Future: registerTaskHandlers();
  // Future: registerFinanceHandlers();
  // Future: registerSecurityHandlers();
  // Future: registerChatHandlers();
  // Future: registerExportHandlers();

  safeLog.log('[Main] All handlers registered');

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cleanup
  closeAllResearchDbs();
  shutdownDashboardAgents();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Final cleanup
  closeDb();
  closeAllResearchDbs();
  shutdownDashboardAgents();
});

// ============== SAFE LOGGER (EPIPE-proof) ==============
// Note: This is now imported from './logger' but kept here for reference
// The safeLog utility handles EPIPE errors when logging to stdout/stderr

// ============== IPC HANDLER REGISTRATION ==============
// NOTE: Most handlers have been moved to the handlers/ directory
// and are registered via the register*Handlers() functions above.
// 
// The following handlers still need to be extracted in future phases:
// - Tasks, subtasks, activity, attachments (lines ~1099-2135)
// - Folders, pins, snooze (lines ~2136-2750)
// - Finance (lines ~7590-7789)
// - Security (lines ~7240-7420)
// - Chat, starred messages (lines ~7015-7239)
// - Export/backup (lines ~7421-7589)
// - Voice, whisper (lines ~949-1098)
// - Settings, screen capture, media permissions (lines ~862-948)
// - Toolbar (lines ~8701-8843)

// ============== LEGACY HANDLERS (TO BE EXTRACTED) ==============
// These are placeholders for handlers that still need to be extracted.
// During the transition, they can be copied from the original main.ts.

// Example placeholder for handlers not yet extracted:
// ipcMain.handle('some:handler', async () => {
//   safeLog.warn('[Legacy] Handler not yet extracted to module');
//   return { success: false, error: 'Handler being refactored' };
// });

// ============== WINDOW STATE IPC ==============

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// ============== DEV TOOLS ==============

ipcMain.handle('dev:openDevTools', () => {
  mainWindow?.webContents.openDevTools();
});

ipcMain.handle('dev:reload', () => {
  mainWindow?.webContents.reload();
});

// ============== APP INFO ==============

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', (_, name: string) => {
  return app.getPath(name as any);
});

// ============== HEALTH CHECK ==============

ipcMain.handle('app:health', async () => {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    services: {
      database: false,
      agents: false,
      notifications: false,
    },
  };

  try {
    // Check database
    prepare('SELECT 1').get();
    health.services.database = true;
  } catch {
    health.services.database = false;
  }

  try {
    // Check agents - consider healthy if at least one agent is spawned
    const agentStatus = getDashboardAgentsStatus();
    health.services.agents = agentStatus.some(a => a.spawned);
  } catch {
    health.services.agents = false;
  }

  health.services.notifications = notificationService.getPreferences().enabled;

  return health;
});

// ============== REFACTORING NOTES ==============
/**
 * REFACTORING PROGRESS:
 * 
 * Phase 1 (COMPLETE):
 * - Created handlers/ directory structure
 * - Extracted agent-handlers.ts (gateway:getToken, agents:list, sessions:list, etc.)
 * - Extracted x-twitter-handlers.ts (x:research:*, x:plan:*, x:draft:*, etc.)
 * - Created main-refactored.ts as new entry point
 * 
 * Phase 2 (TODO):
 * - Extract task-handlers.ts (currently exists but unused)
 * - Extract finance-handlers.ts
 * - Extract security-handlers.ts
 * - Extract chat-handlers.ts
 * - Extract export-handlers.ts
 * 
 * Phase 3 (TODO):
 * - Extract remaining utility handlers
 * - Remove duplicate handlers from main.ts
 * - Rename main-refactored.ts to main.ts
 * - Delete old main.ts or archive as main.ts.legacy
 * 
 * Phase 4 (TODO):
 * - Test all functionality
 * - Update imports and exports
 * - Verify build passes
 * - Update documentation
 */
