/**
 * Toolbar Handlers Module
 *
 * Channels: toolbar:popOut, toolbar:popIn, toolbar:getState,
 * toolbar:resize, toolbar:setIgnoreMouseEvents (ipcMain.on),
 * toolbar:action (NEW - broadcasts to all windows)
 *
 * 5 registerHandler calls + 1 ipcMain.on = 6 total.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BrowserWindow, ipcMain, screen as electronScreen } from 'electron';
import { registerHandler } from '../ipc-registry';
import { safeLog } from '../logger';

// Module-level floating toolbar window state
let floatingToolbarWindow: BrowserWindow | null = null;

const isDev = process.env.ELECTRON_DEV === '1';

export function registerToolbarHandlers(): void {
  registerHandler('toolbar:popOut', async (_event, data?: { x?: number; y?: number; width?: number; height?: number }) => {
    try {
      if (floatingToolbarWindow && !floatingToolbarWindow.isDestroyed()) {
        floatingToolbarWindow.close();
        floatingToolbarWindow = null;
      }
      const configPath = path.join(os.homedir(), 'froggo', 'config', 'floating-toolbar.json');
      let savedPos: { x?: number; y?: number } = {};
      try { if (fs.existsSync(configPath)) { const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8')); savedPos = { x: saved.x, y: saved.y }; } } catch { /* ignore */ }
      const mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w !== floatingToolbarWindow);
      const currentDisplay = mainWin ? electronScreen.getDisplayNearestPoint(mainWin.getBounds()) : electronScreen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = currentDisplay.workArea;
      const TOOLBAR_W = 700;
      const TOOLBAR_H = 520;
      const windowX = data?.x ?? savedPos.x ?? (screenWidth - TOOLBAR_W - 20);
      const windowY = data?.y ?? savedPos.y ?? (screenHeight - TOOLBAR_H - 40);
      floatingToolbarWindow = new BrowserWindow({
        width: TOOLBAR_W, height: TOOLBAR_H, x: windowX, y: windowY,
        alwaysOnTop: true, frame: false, transparent: true, resizable: false,
        minimizable: false, maximizable: false, skipTaskbar: true, hasShadow: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, '..', 'preload.js') },
      });
      floatingToolbarWindow.on('ready-to-show', () => {
        if (floatingToolbarWindow && !floatingToolbarWindow.isDestroyed()) floatingToolbarWindow.setIgnoreMouseEvents(true, { forward: true });
      });
      const toolbarUrl = isDev ? 'http://localhost:5173/#/floating-toolbar' : `file://${path.join(__dirname, '../../dist/index.html')}#/floating-toolbar`;
      floatingToolbarWindow.loadURL(toolbarUrl);
      const savePosition = () => {
        if (!floatingToolbarWindow || floatingToolbarWindow.isDestroyed()) return;
        const b = floatingToolbarWindow.getBounds();
        try { const dir = path.dirname(configPath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(configPath, JSON.stringify({ x: b.x, y: b.y }, null, 2), 'utf-8'); } catch { /* ignore */ }
      };
      floatingToolbarWindow.on('moved', savePosition);
      floatingToolbarWindow.on('closed', () => {
        savePosition();
        floatingToolbarWindow = null;
        BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) { try { w.webContents.send('toolbar:closed'); } catch { /* ignore */ } } });
      });
      safeLog.log('[Toolbar] Floating toolbar window created');
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Toolbar] Pop-out error:', error.message);
      return { success: false, error: error.message };
    }
  });

  registerHandler('toolbar:popIn', async () => {
    try {
      if (floatingToolbarWindow && !floatingToolbarWindow.isDestroyed()) {
        floatingToolbarWindow.close();
        floatingToolbarWindow = null;
        BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) { try { w.webContents.send('toolbar:popped-in'); } catch { /* ignore */ } } });
        safeLog.log('[Toolbar] Floating toolbar closed');
        return { success: true };
      }
      return { success: false, error: 'No floating toolbar window' };
    } catch (error: any) {
      safeLog.error('[Toolbar] Pop-in error:', error.message);
      return { success: false, error: error.message };
    }
  });

  registerHandler('toolbar:getState', async () => {
    try {
      const isFloating = floatingToolbarWindow && !floatingToolbarWindow.isDestroyed();
      const bounds = isFloating ? floatingToolbarWindow!.getBounds() : null;
      return { success: true, isFloating, bounds };
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  registerHandler('toolbar:resize', async (event, height: number) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) {
        const bounds = win.getBounds();
        const clampedH = Math.max(60, Math.min(700, Math.round(height)));
        const delta = clampedH - bounds.height;
        const newY = Math.max(0, bounds.y - delta);
        win.setBounds({ x: bounds.x, y: newY, width: bounds.width, height: clampedH });
      }
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  // NEW: toolbar:action broadcasts to all windows
  registerHandler('toolbar:action', async (_event, action: string) => {
    BrowserWindow.getAllWindows().forEach(w => {
      if (!w.isDestroyed()) {
        try { w.webContents.send('toolbar:action', action); } catch { /* ignore */ }
      }
    });
    return { success: true };
  });

  // ipcMain.on (not handle) for mouse events
  ipcMain.on('toolbar:setIgnoreMouseEvents', (event, ignore: boolean) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, { forward: true });
    } catch { /* ignore */ }
  });
}
