/**
 * Notification Handlers Module
 * 
 * All notification-related IPC handlers:
 * - notification-settings:get, set, delete
 * - notification-settings:global-defaults, set-global-defaults
 * - notification-settings:get-effective, mute, unmute
 * - rejections:log
 */
import { ipcMain } from 'electron';
import { prepare } from './database';
import { safeLog } from './logger';

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification-settings:get', handleNotificationSettingsGet);
  ipcMain.handle('notification-settings:set', handleNotificationSettingsSet);
  ipcMain.handle('notification-settings:delete', handleNotificationSettingsDelete);
  ipcMain.handle('notification-settings:global-defaults', handleNotificationSettingsGlobalDefaults);
  ipcMain.handle('notification-settings:set-global-defaults', handleNotificationSettingsSetGlobalDefaults);
  ipcMain.handle('notification-settings:get-effective', handleNotificationSettingsGetEffective);
  ipcMain.handle('notification-settings:mute', handleNotificationSettingsMute);
  ipcMain.handle('notification-settings:unmute', handleNotificationSettingsUnmute);
  ipcMain.handle('rejections:log', handleRejectionsLog);
}

// ============ NOTIFICATION SETTINGS HANDLERS ============

interface NotificationSettings {
  session_key: string;
  settings: string;
  updated_at: number;
  muted_until?: number;
}

async function handleNotificationSettingsGet(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; settings?: NotificationSettings | null; error?: string }> {
  try {
    const settings = prepare('SELECT session_key, settings, updated_at, muted_until FROM notification_settings WHERE session_key = ?').get(sessionKey) as NotificationSettings | undefined;
    return { success: true, settings: settings || null };
  } catch (error) {
    safeLog.error('[NotificationSettings] Get error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsSet(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string,
  settings: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    prepare(`
      INSERT INTO notification_settings (session_key, settings, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        settings = excluded.settings,
        updated_at = excluded.updated_at
    `).run(sessionKey, JSON.stringify(settings), now);

    return { success: true };
  } catch (error) {
    safeLog.error('[NotificationSettings] Set error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsDelete(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    prepare('DELETE FROM notification_settings WHERE session_key = ?').run(sessionKey);
    return { success: true };
  } catch (error) {
    safeLog.error('[NotificationSettings] Delete error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsGlobalDefaults(): Promise<{ success: boolean; defaults?: Record<string, unknown> | null; error?: string }> {
  try {
    const row = prepare('SELECT settings FROM notification_settings WHERE session_key = ?').get('__global__') as { settings: string } | undefined;
    return { success: true, defaults: row ? JSON.parse(row.settings) : null };
  } catch (error) {
    safeLog.error('[NotificationSettings] Global defaults error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsSetGlobalDefaults(
  _: Electron.IpcMainInvokeEvent,
  defaults: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    prepare(`
      INSERT INTO notification_settings (session_key, settings, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        settings = excluded.settings,
        updated_at = excluded.updated_at
    `).run('__global__', JSON.stringify(defaults), now);

    return { success: true };
  } catch (error) {
    safeLog.error('[NotificationSettings] Set global defaults error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsGetEffective(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; settings?: Record<string, unknown>; error?: string }> {
  try {
    // Get session-specific settings
    const sessionRow = prepare('SELECT settings FROM notification_settings WHERE session_key = ?').get(sessionKey) as { settings: string } | undefined;
    const sessionSettings = sessionRow ? JSON.parse(sessionRow.settings) : {};

    // Get global defaults
    const globalRow = prepare('SELECT settings FROM notification_settings WHERE session_key = ?').get('__global__') as { settings: string } | undefined;
    const globalSettings = globalRow ? JSON.parse(globalRow.settings) : {};

    // Merge with session settings taking precedence
    const effective = { ...globalSettings, ...sessionSettings };

    return { success: true, settings: effective };
  } catch (error) {
    safeLog.error('[NotificationSettings] Get effective error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsMute(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string,
  duration?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const until = duration ? Date.now() + parseDuration(duration) : null;

    prepare(`
      INSERT INTO notification_settings (session_key, muted_until, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        muted_until = excluded.muted_until,
        updated_at = excluded.updated_at
    `).run(sessionKey, until, Date.now());

    return { success: true };
  } catch (error) {
    safeLog.error('[NotificationSettings] Mute error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleNotificationSettingsUnmute(
  _: Electron.IpcMainInvokeEvent,
  sessionKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    prepare(`
      UPDATE notification_settings
      SET muted_until = NULL, updated_at = ?
      WHERE session_key = ?
    `).run(Date.now(), sessionKey);

    return { success: true };
  } catch (error) {
    safeLog.error('[NotificationSettings] Unmute error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleRejectionsLog(
  _: Electron.IpcMainInvokeEvent,
  rejection: { type: string; title: string; content?: string; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    prepare(`
      INSERT INTO rejections (id, type, title, content, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `rej-${Date.now()}`,
      rejection.type,
      rejection.title,
      rejection.content || null,
      rejection.reason || null,
      Date.now()
    );

    return { success: true };
  } catch (error) {
    safeLog.error('[Rejections] Log error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// ============ UTILITIES ============

function parseDuration(duration: string): number {
  const units: Record<string, number> = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
  };
  
  const match = duration.match(/^(\d+)([mhd])$/);
  if (!match) return 60 * 60 * 1000; // Default 1 hour
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return value * (units[unit] || 60 * 60 * 1000);
}
