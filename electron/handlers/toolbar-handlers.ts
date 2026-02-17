/**
 * Toolbar Handlers Module
 * 
 * IPC handlers for toolbar actions:
 * - toolbar:action — broadcast toolbar actions to all windows
 */

import { ipcMain, BrowserWindow, webContents } from 'electron';
import { safeLog } from '../logger';

/**
 * Register all toolbar IPC handlers
 */
export function registerToolbarHandlers(): void {
  /**
   * Handle toolbar actions from renderer processes
   * Broadcasts the action to all windows so they can respond via onAction listener
   */
  ipcMain.handle('toolbar:action', async (_, action: string) => {
    try {
      safeLog.log('[Toolbar] Received action:', action);
      
      // Broadcast action to all webContents (windows)
      const allContents = webContents.getAllWebContents();
      let sentCount = 0;
      
      for (const content of allContents) {
        // Only send to valid, non-destroyed windows
        if (!content.isDestroyed() && content.getURL()) {
          content.send('toolbar:action', action);
          sentCount++;
        }
      }
      
      safeLog.log(`[Toolbar] Broadcast "${action}" to ${sentCount} window(s)`);
      return { success: true, action, sentTo: sentCount };
    } catch (error) {
      safeLog.error('[Toolbar] Error broadcasting action:', error);
      return { success: false, error: String(error) };
    }
  });

  safeLog.log('[Toolbar] Handlers registered');
}
