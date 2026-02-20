/**
 * Pins Handlers Module
 *
 * Conversation pinning IPC handlers:
 * - pins:list, pins:is-pinned, pins:pin, pins:unpin
 * - pins:toggle, pins:reorder, pins:count
 *
 * Extracted from main.ts as IPC modularization spike PoC.
 */

import { ipcMain } from 'electron';
import { prepare } from '../database';
import { safeLog } from '../logger';

const MAX_PINS = 10;

export function registerPinsHandlers(): void {
  ipcMain.handle('pins:list', handlePinsList);
  ipcMain.handle('pins:is-pinned', handleIsPinned);
  ipcMain.handle('pins:pin', handlePin);
  ipcMain.handle('pins:unpin', handleUnpin);
  ipcMain.handle('pins:toggle', handleToggle);
  ipcMain.handle('pins:reorder', handleReorder);
  ipcMain.handle('pins:count', handleCount);
}

async function handlePinsList(): Promise<{ success: boolean; pins: any[] }> {
  try {
    const pins = prepare(
      'SELECT id, session_key, pinned_at, pinned_by, notes, pin_order FROM conversation_pins ORDER BY pin_order ASC, pinned_at DESC'
    ).all();
    return { success: true, pins };
  } catch (error: any) {
    safeLog.error('[Pins] List error:', error);
    return { success: false, pins: [] };
  }
}

async function handleIsPinned(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; pinned: boolean }> {
  try {
    const row = prepare('SELECT id FROM conversation_pins WHERE session_key = ? LIMIT 1').get(sessionKey);
    return { success: true, pinned: !!row };
  } catch (error: any) {
    safeLog.error('[Pins] Is-pinned error:', error);
    return { success: false, pinned: false };
  }
}

async function handlePin(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const countResult = prepare('SELECT COUNT(*) as count FROM conversation_pins').get() as any;
    const currentCount = countResult?.count || 0;

    const existing = prepare('SELECT id FROM conversation_pins WHERE session_key = ? LIMIT 1').get(sessionKey);

    if (!existing && currentCount >= MAX_PINS) {
      safeLog.error(`[Pins] Pin limit reached (${MAX_PINS} max)`);
      return { success: false, error: `Maximum ${MAX_PINS} pinned conversations allowed. Unpin another conversation first.` };
    }

    const orderResult = prepare('SELECT COALESCE(MAX(pin_order), -1) + 1 as next_order FROM conversation_pins').get() as any;
    const nextOrder = orderResult?.next_order || 0;

    prepare('INSERT OR REPLACE INTO conversation_pins (session_key, notes, pin_order) VALUES (?, ?, ?)').run(
      sessionKey,
      notes || null,
      nextOrder
    );

    safeLog.log('[Pins] Pinned:', sessionKey, 'at order', nextOrder);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Pins] Pin error:', error);
    return { success: false, error: error.message };
  }
}

async function handleUnpin(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    prepare('DELETE FROM conversation_pins WHERE session_key = ?').run(sessionKey);
    safeLog.log('[Pins] Unpinned:', sessionKey);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Pins] Unpin error:', error);
    return { success: false, error: error.message };
  }
}

async function handleToggle(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; pinned?: boolean; error?: string }> {
  try {
    const existing = prepare('SELECT id FROM conversation_pins WHERE session_key = ? LIMIT 1').get(sessionKey);

    if (existing) {
      prepare('DELETE FROM conversation_pins WHERE session_key = ?').run(sessionKey);
      safeLog.log('[Pins] Toggled:', sessionKey, '-> unpinned');
      return { success: true, pinned: false };
    } else {
      const countResult = prepare('SELECT COUNT(*) as count FROM conversation_pins').get() as any;
      const currentCount = countResult?.count || 0;

      if (currentCount >= MAX_PINS) {
        safeLog.error(`[Pins] Toggle pin limit reached (${MAX_PINS} max)`);
        return { success: false, error: `Maximum ${MAX_PINS} pinned conversations allowed. Unpin another conversation first.` };
      }

      const orderResult = prepare('SELECT COALESCE(MAX(pin_order), -1) + 1 as next_order FROM conversation_pins').get() as any;
      const nextOrder = orderResult?.next_order || 0;

      prepare('INSERT INTO conversation_pins (session_key, pin_order) VALUES (?, ?)').run(sessionKey, nextOrder);
      safeLog.log('[Pins] Toggled:', sessionKey, '-> pinned at order', nextOrder);
      return { success: true, pinned: true };
    }
  } catch (error: any) {
    safeLog.error('[Pins] Toggle error:', error);
    return { success: false, error: error.message };
  }
}

async function handleReorder(
  _: Electron.IpcMainInvokeEvent,
  sessionKeys: string[]
): Promise<{ success: boolean; error?: string }> {
  if (sessionKeys.length > MAX_PINS) {
    safeLog.error(`[Pins] Reorder error: Too many pins (max ${MAX_PINS})`);
    return { success: false, error: `Cannot have more than ${MAX_PINS} pinned conversations` };
  }

  try {
    const updateStmt = prepare('UPDATE conversation_pins SET pin_order = ? WHERE session_key = ?');
    for (let i = 0; i < sessionKeys.length; i++) {
      updateStmt.run(i, sessionKeys[i]);
    }
    safeLog.log('[Pins] Reordered', sessionKeys.length, 'pins');
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Pins] Reorder error:', error);
    return { success: false, error: 'Reorder failed' };
  }
}

async function handleCount(): Promise<{ success: boolean; count: number }> {
  try {
    const result = prepare('SELECT COUNT(*) as count FROM conversation_pins').get() as any;
    return { success: true, count: result?.count || 0 };
  } catch (error: any) {
    safeLog.error('[Pins] Count error:', error);
    return { success: false, count: 0 };
  }
}
