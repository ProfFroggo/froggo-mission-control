/**
 * Notification Settings Handlers Module
 *
 * Channels: notification-settings:get/set/delete/global-defaults/
 * set-global-defaults/get-effective/mute/unmute, rejections:log
 *
 * 9 registerHandler calls total.
 */

import { registerHandler } from '../ipc-registry';
import { prepare, getDb } from '../database';
import { safeLog } from '../logger';

export function registerNotificationHandlers(): void {
  registerHandler('notification-settings:get', async (_event, sessionKey: string) => {
    try {
      const row = prepare('SELECT * FROM conversation_notification_settings WHERE session_key = ?').get(sessionKey);
      return { success: true, settings: row || null };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Get error:', error);
      return { success: false, settings: null };
    }
  });

  registerHandler('notification-settings:set', async (_event, sessionKey: string, settings: any) => {
    try {
      const existing = prepare('SELECT id FROM conversation_notification_settings WHERE session_key = ?').get(sessionKey);
      if (existing) {
        const setParts: string[] = [];
        const params: any[] = [];
        if (settings.notification_level !== undefined) { setParts.push('notification_level = ?'); params.push(settings.notification_level); }
        if (settings.sound_enabled !== undefined) { setParts.push('sound_enabled = ?'); params.push(settings.sound_enabled ? 1 : 0); }
        if (settings.sound_type !== undefined) { setParts.push('sound_type = ?'); params.push(settings.sound_type); }
        if (settings.desktop_notifications !== undefined) { setParts.push('desktop_notifications = ?'); params.push(settings.desktop_notifications ? 1 : 0); }
        if (settings.quiet_hours_enabled !== undefined) { setParts.push('quiet_hours_enabled = ?'); params.push(settings.quiet_hours_enabled ? 1 : 0); }
        if (settings.quiet_start !== undefined) { setParts.push('quiet_start = ?'); params.push(settings.quiet_start); }
        if (settings.quiet_end !== undefined) { setParts.push('quiet_end = ?'); params.push(settings.quiet_end); }
        if (settings.keyword_alerts !== undefined) { setParts.push('keyword_alerts = ?'); params.push(JSON.stringify(settings.keyword_alerts)); }
        if (settings.priority_level !== undefined) { setParts.push('priority_level = ?'); params.push(settings.priority_level); }
        if (settings.mute_until !== undefined) { setParts.push('mute_until = ?'); params.push(settings.mute_until || null); }
        if (settings.notification_frequency !== undefined) { setParts.push('notification_frequency = ?'); params.push(settings.notification_frequency); }
        if (settings.show_message_preview !== undefined) { setParts.push('show_message_preview = ?'); params.push(settings.show_message_preview ? 1 : 0); }
        if (settings.badge_count_enabled !== undefined) { setParts.push('badge_count_enabled = ?'); params.push(settings.badge_count_enabled ? 1 : 0); }
        if (settings.notes !== undefined) { setParts.push('notes = ?'); params.push(settings.notes || ''); }
        if (setParts.length === 0) return { success: false, error: 'No updates provided' };
        params.push(sessionKey);
        getDb().prepare('UPDATE conversation_notification_settings SET ' + setParts.join(', ') + ' WHERE session_key = ?').run(...params);
      } else {
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
          sessionKey, notificationLevel, soundEnabled, soundType, desktopNotifications, quietHoursEnabled, quietStart, quietEnd, keywordAlerts, priorityLevel, muteUntil, notificationFrequency, showMessagePreview, badgeCountEnabled, notes
        );
      }
      return { success: true };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Set error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('notification-settings:delete', async (_event, sessionKey: string) => {
    try {
      prepare('DELETE FROM conversation_notification_settings WHERE session_key = ?').run(sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Delete error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('notification-settings:global-defaults', async () => {
    try {
      const row = prepare('SELECT * FROM global_notification_defaults WHERE id = 1').get();
      return { success: true, defaults: row || null };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Get global defaults error:', error);
      return { success: false, defaults: null };
    }
  });

  registerHandler('notification-settings:set-global-defaults', async (_event, defaults: any) => {
    try {
      const setParts: string[] = [];
      const params: any[] = [];
      if (defaults.default_notification_level !== undefined) { setParts.push('default_notification_level = ?'); params.push(defaults.default_notification_level); }
      if (defaults.default_sound_enabled !== undefined) { setParts.push('default_sound_enabled = ?'); params.push(defaults.default_sound_enabled ? 1 : 0); }
      if (defaults.default_sound_type !== undefined) { setParts.push('default_sound_type = ?'); params.push(defaults.default_sound_type); }
      if (defaults.default_desktop_notifications !== undefined) { setParts.push('default_desktop_notifications = ?'); params.push(defaults.default_desktop_notifications ? 1 : 0); }
      if (defaults.quiet_hours_enabled !== undefined) { setParts.push('quiet_hours_enabled = ?'); params.push(defaults.quiet_hours_enabled ? 1 : 0); }
      if (defaults.quiet_start !== undefined) { setParts.push('quiet_start = ?'); params.push(defaults.quiet_start); }
      if (defaults.quiet_end !== undefined) { setParts.push('quiet_end = ?'); params.push(defaults.quiet_end); }
      if (defaults.default_priority_level !== undefined) { setParts.push('default_priority_level = ?'); params.push(defaults.default_priority_level); }
      if (defaults.do_not_disturb_enabled !== undefined) { setParts.push('do_not_disturb_enabled = ?'); params.push(defaults.do_not_disturb_enabled ? 1 : 0); }
      if (defaults.dnd_until !== undefined) { setParts.push('dnd_until = ?'); params.push(defaults.dnd_until || null); }
      if (defaults.enable_batching !== undefined) { setParts.push('enable_batching = ?'); params.push(defaults.enable_batching ? 1 : 0); }
      if (defaults.batch_interval_minutes !== undefined) { setParts.push('batch_interval_minutes = ?'); params.push(defaults.batch_interval_minutes); }
      if (setParts.length === 0) return { success: false, error: 'No updates provided' };
      getDb().prepare('UPDATE global_notification_defaults SET ' + setParts.join(', ') + ' WHERE id = 1').run(...params);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Set global defaults error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('notification-settings:get-effective', async (_event, sessionKey: string) => {
    try {
      const row = prepare('SELECT * FROM effective_notification_settings WHERE session_key = ?').get(sessionKey);
      return { success: true, settings: row || null };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Get effective error:', error);
      return { success: false, settings: null };
    }
  });

  registerHandler('notification-settings:mute', async (_event, sessionKey: string, duration?: string) => {
    try {
      let muteUntil: string | null = null;
      if (duration) { muteUntil = duration; } else { const tomorrow = new Date(); tomorrow.setHours(tomorrow.getHours() + 24); muteUntil = tomorrow.toISOString(); }
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

  registerHandler('notification-settings:unmute', async (_event, sessionKey: string) => {
    try {
      prepare("UPDATE conversation_notification_settings SET mute_until = NULL, notification_level = 'all' WHERE session_key = ?").run(sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[NotificationSettings] Unmute error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('rejections:log', async (_event, rejection: { type: string; title: string; content?: string; reason?: string }) => {
    try {
      prepare('INSERT INTO rejected_decisions (type, title, content, reason) VALUES (?, ?, ?, ?)').run(rejection.type, rejection.title, rejection.content || '', rejection.reason || '');
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Rejections] Log error:', error);
      return { success: false, error: error.message };
    }
  });
}
