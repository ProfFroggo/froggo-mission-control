/**
 * Main Electron Process - Modular Architecture
 * 
 * Thin orchestrator that imports and registers all IPC handlers from modules.
 * Each module is responsible for a specific domain:
 * - task-handlers.ts: Task CRUD, subtasks, activity, attachments
 * - agent-handlers.ts: Agent management, sessions, registry
 * - notification-handlers.ts: Notifications, settings
 * - chat-handlers.ts: Chat, voice, messaging
 * - x-handlers.ts: Twitter/X API integrations
 * - settings-handlers.ts: Settings, API keys, configuration
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// Import handler modules
import { registerTaskHandlers } from './task-handlers';
import { registerAgentHandlers } from './agent-handlers';
import { registerNotificationHandlers } from './notification-handlers';
import { registerSettingsHandlers } from './settings-handlers';
// TODO: Import additional modules as they are created
// import { registerChatHandlers } from './chat-handlers';
// import { registerXHandlers } from './x-handlers';

// Initialize database
import { initializeDatabase } from './database';

// Initialize handlers
export function initializeIpcHandlers(): void {
  console.log('[Main] Initializing IPC handlers...');
  
  // Register all handler modules
  registerTaskHandlers();
  console.log('[Main] ✓ Task handlers registered');
  
  registerAgentHandlers();
  console.log('[Main] ✓ Agent handlers registered');
  
  registerNotificationHandlers();
  console.log('[Main] ✓ Notification handlers registered');
  
  registerSettingsHandlers();
  console.log('[Main] ✓ Settings handlers registered');
  
  // TODO: Register additional modules as they are migrated
  // registerChatHandlers();
  // registerXHandlers();
  
  console.log('[Main] IPC handlers initialized');
}

// Legacy handlers that haven't been migrated yet
// These will be moved to their respective modules
function registerLegacyHandlers(): void {
  // TODO: Migrate these to appropriate modules
  // For now, keep them here to maintain functionality
}

// App initialization
app.whenReady().then(() => {
  initializeDatabase();
  initializeIpcHandlers();
  registerLegacyHandlers();
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Export for testing
export { 
  registerTaskHandlers, 
  registerAgentHandlers, 
  registerNotificationHandlers,
  registerSettingsHandlers 
};
