/**
 * Schedule Handlers Module
 *
 * Schedule, snooze, pins, and folders IPC handlers extracted from main.ts:
 * - schedule:list, add, cancel, update, sendNow (5)
 * - snooze:list, get, set, unset, markReminderSent, expired, history (7)
 * - pins:list, is-pinned, pin, unpin, toggle, reorder, count (7)
 * - folders:list, create, update, delete, assign, unassign,
 *   for-conversation, conversations (8)
 * - folders:rules:list, get, save, delete (4)
 * - folders:auto-assign (1)
 *
 * 32 registerHandler calls total.
 */

import { execFile } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { prepare, getDb } from '../database';
import { safeLog } from '../logger';
import { postTweet as xPostTweet } from '../x-api-client';

const MAX_PINS = 10;

// ── Smart folder rule evaluator ──────────────────────────────────────────────

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

// ── Register all schedule handlers ───────────────────────────────────────────

export function registerScheduleHandlers(): void {

  // ── Schedule handlers (5) ────────────────────────────────────────────────

  registerHandler('schedule:list', async () => {
    safeLog.log('[Schedule:list] Called');
    try {
      getDb().exec(`
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
        )
      `);
      const rows = prepare('SELECT * FROM schedule ORDER BY scheduled_for ASC').all() as any[];
      const items = rows.map((row: any) => ({
        id: row.id, type: row.type, content: row.content,
        scheduledFor: row.scheduled_for, status: row.status,
        createdAt: row.created_at, sentAt: row.sent_at, error: row.error,
        metadata: row.metadata ? (() => { try { return JSON.parse(row.metadata); } catch { return undefined; } })() : undefined,
      }));
      safeLog.log('[Schedule:list] Parsed', items.length, 'items');
      return { success: true, items };
    } catch (e: any) {
      safeLog.error('[Schedule:list] Error:', e);
      return { success: true, items: [] };
    }
  });

  registerHandler('schedule:add', async (_, item: { type: string; content: string; scheduledFor: string; metadata?: any }) => {
    safeLog.log('[Schedule:add] Received:', JSON.stringify(item, null, 2));
    const id = `sched-${Date.now()}`;
    try {
      getDb().exec(`
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
        )
      `);
      prepare('INSERT INTO schedule (id, type, content, scheduled_for, metadata) VALUES (?, ?, ?, ?, ?)').run(
        id, item.type, item.content, item.scheduledFor,
        item.metadata ? JSON.stringify(item.metadata) : null
      );
      const cronTime = new Date(item.scheduledFor);
      const cronText = item.type === 'tweet'
        ? `Execute scheduled tweet: ${item.content.slice(0, 50)}...`
        : `Execute scheduled email to ${item.metadata?.recipient}: ${item.content.slice(0, 50)}...`;
      try {
        await fetch('http://localhost:18789/api/cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', job: { id, text: cronText, schedule: cronTime.toISOString(), enabled: true } })
        });
      } catch {
        return { success: true, id, warning: 'Cron job creation failed' };
      }
      return { success: true, id };
    } catch (error: any) {
      safeLog.error('[Schedule:add] Error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('schedule:cancel', async (_, id: string) => {
    try {
      prepare("UPDATE schedule SET status = 'cancelled' WHERE id = ?").run(id);
      fetch('http://localhost:18789/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId: id })
      }).catch((err) => safeLog.error('[Cron] Failed to remove job via API:', err));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  registerHandler('schedule:update', async (_, id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: any }) => {
    try {
      const setClauses: string[] = [];
      const params: any[] = [];
      if (item.type) { setClauses.push('type = ?'); params.push(item.type); }
      if (item.content) { setClauses.push('content = ?'); params.push(item.content); }
      if (item.scheduledFor) { setClauses.push('scheduled_for = ?'); params.push(item.scheduledFor); }
      if (item.metadata) { setClauses.push('metadata = ?'); params.push(JSON.stringify(item.metadata)); }
      if (setClauses.length === 0) return { success: false, error: 'No updates provided' };
      params.push(id);
      prepare(`UPDATE schedule SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  registerHandler('schedule:sendNow', async (_, id: string) => {
    try {
      const item = prepare('SELECT * FROM schedule WHERE id = ?').get(id) as any;
      if (!item) return { success: false, error: 'Item not found' };

      if (item.type === 'tweet') {
        const result = await xPostTweet(item.content);
        if (result.success) {
          prepare("UPDATE schedule SET status = 'completed' WHERE id = ?").run(id);
          return { success: true, id: result.id };
        } else {
          return { success: false, error: result.error };
        }
      } else if (item.type === 'email') {
        let meta: Record<string, string> = {};
        try { meta = item.metadata ? JSON.parse(item.metadata) : {}; }
        catch (e) { safeLog.error('[ScheduleProcessor] Failed to parse email metadata:', e); meta = {}; }
        const recipient = meta.recipient || meta.to || '';
        const account = meta.account || '';
        if (!recipient || !recipient.trim()) return { success: false, error: 'Missing email recipient' };
        if (!account || !account.trim()) return { success: false, error: 'Missing GOG account - cannot send email without account' };
        return new Promise((resolve) => {
          execFile('/opt/homebrew/bin/gog', ['gmail', 'drafts', 'create', '--to', recipient, '--subject', meta.subject || 'No subject', '--body', item.content], {
            timeout: 30000,
            env: { ...process.env, GOG_ACCOUNT: account, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` }
          }, (execError) => {
            const status = execError ? 'failed' : 'sent';
            try {
              prepare("UPDATE schedule SET status = ?, sent_at = datetime('now'), error = ? WHERE id = ?").run(
                status, execError ? execError.message.slice(0, 500) : null, id
              );
            } catch (dbErr: any) { safeLog.error('[Schedule:sendNow] DB update error:', dbErr); }
            resolve({ success: !execError, error: execError?.message });
          });
        });
      }
      return { success: false, error: 'Unknown item type' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // ── Snooze handlers (7) ──────────────────────────────────────────────────

  registerHandler('snooze:list', async () => {
    try {
      const snoozes = prepare('SELECT * FROM conversation_snoozes ORDER BY snooze_until ASC').all();
      return { success: true, snoozes };
    } catch (error: any) {
      safeLog.error('[Snooze] List error:', error);
      return { success: false, snoozes: [] };
    }
  });

  registerHandler('snooze:get', async (_, sessionKey: string) => {
    try {
      const row = prepare('SELECT * FROM conversation_snoozes WHERE session_id = ? LIMIT 1').get(sessionKey);
      return { success: true, snooze: row || null };
    } catch (error: any) {
      safeLog.error('[Snooze] Get error:', error);
      return { success: false, snooze: null };
    }
  });

  registerHandler('snooze:set', async (_, sessionKey: string, snoozeUntil: number, reason?: string) => {
    try {
      const now = Date.now();
      const snoozeReason = reason || '';
      const existing = prepare('SELECT id FROM conversation_snoozes WHERE session_id = ? LIMIT 1').get(sessionKey);
      if (existing) {
        prepare('UPDATE conversation_snoozes SET snooze_until = ?, snooze_reason = ?, reminder_sent = 0, updated_at = ? WHERE session_id = ?').run(snoozeUntil, snoozeReason, now, sessionKey);
      } else {
        prepare('INSERT INTO conversation_snoozes (session_id, snooze_until, snooze_reason, reminder_sent, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)').run(sessionKey, snoozeUntil, snoozeReason, now, now);
      }
      safeLog.log('[Snooze] Set:', sessionKey, 'until', new Date(snoozeUntil).toISOString());
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Snooze] Set error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('snooze:unset', async (_, sessionKey: string) => {
    try {
      const now = Date.now();
      const snooze = prepare('SELECT * FROM conversation_snoozes WHERE session_id = ? LIMIT 1').get(sessionKey) as any;
      if (!snooze) return { success: true };
      getDb().transaction(() => {
        prepare('INSERT INTO snooze_history (session_id, snooze_until, snooze_reason, unsnoozed_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
          sessionKey, snooze.snooze_until, snooze.snooze_reason || '', now, snooze.created_at
        );
        prepare('DELETE FROM conversation_snoozes WHERE session_id = ?').run(sessionKey);
      })();
      safeLog.log('[Snooze] Unsnoozed:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Snooze] Unset error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('snooze:markReminderSent', async (_, sessionKey: string) => {
    try {
      prepare('UPDATE conversation_snoozes SET reminder_sent = 1 WHERE session_id = ?').run(sessionKey);
      safeLog.log('[Snooze] Reminder marked sent:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Snooze] Mark reminder error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('snooze:expired', async () => {
    try {
      const now = Date.now();
      const snoozes = prepare('SELECT * FROM conversation_snoozes WHERE snooze_until <= ? AND reminder_sent = 0 ORDER BY snooze_until ASC').all(now);
      return { success: true, snoozes };
    } catch (error: any) {
      safeLog.error('[Snooze] Expired list error:', error);
      return { success: false, snoozes: [] };
    }
  });

  registerHandler('snooze:history', async (_, sessionKey: string, limit: number = 10) => {
    try {
      const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
      const history = prepare('SELECT * FROM snooze_history WHERE session_id = ? ORDER BY created_at DESC LIMIT ?').all(sessionKey, safeLimit);
      return { success: true, history };
    } catch (error: any) {
      safeLog.error('[Snooze] History error:', error);
      return { success: false, history: [] };
    }
  });

  // ── Pins handlers (7) ────────────────────────────────────────────────────

  registerHandler('pins:list', async () => {
    try {
      const pins = prepare('SELECT id, session_key, pinned_at, pinned_by, notes, pin_order FROM conversation_pins ORDER BY pin_order ASC, pinned_at DESC').all();
      return { success: true, pins };
    } catch (error: any) {
      safeLog.error('[Pins] List error:', error);
      return { success: false, pins: [] };
    }
  });

  registerHandler('pins:is-pinned', async (_, sessionKey: string) => {
    try {
      const row = prepare('SELECT id FROM conversation_pins WHERE session_key = ? LIMIT 1').get(sessionKey);
      return { success: true, pinned: !!row };
    } catch (error: any) {
      safeLog.error('[Pins] Is-pinned error:', error);
      return { success: false, pinned: false };
    }
  });

  registerHandler('pins:pin', async (_, sessionKey: string, notes?: string) => {
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
      prepare('INSERT OR REPLACE INTO conversation_pins (session_key, notes, pin_order) VALUES (?, ?, ?)').run(sessionKey, notes || null, nextOrder);
      safeLog.log('[Pins] Pinned:', sessionKey, 'at order', nextOrder);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Pins] Pin error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('pins:unpin', async (_, sessionKey: string) => {
    try {
      prepare('DELETE FROM conversation_pins WHERE session_key = ?').run(sessionKey);
      safeLog.log('[Pins] Unpinned:', sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Pins] Unpin error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('pins:toggle', async (_, sessionKey: string) => {
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
  });

  registerHandler('pins:reorder', async (_, sessionKeys: string[]) => {
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
  });

  registerHandler('pins:count', async () => {
    try {
      const result = prepare('SELECT COUNT(*) as count FROM conversation_pins').get() as any;
      return { success: true, count: result?.count || 0 };
    } catch (error: any) {
      safeLog.error('[Pins] Count error:', error);
      return { success: false, count: 0 };
    }
  });

  // ── Folders handlers (8) ─────────────────────────────────────────────────

  registerHandler('folders:list', async () => {
    try {
      const folders = prepare('SELECT f.id, f.name, f.icon, f.color, f.description, f.sort_order, f.is_smart, (SELECT COUNT(*) FROM conversation_folders WHERE folder_id = f.id) as conversation_count FROM message_folders f ORDER BY f.sort_order, f.name').all();
      return { success: true, folders };
    } catch (error: any) {
      safeLog.error('[Folders] List error:', error);
      return { success: false, folders: [] };
    }
  });

  registerHandler('folders:create', async (_, folder: { name: string; icon?: string; color?: string; description?: string }) => {
    const icon = folder.icon || '\uD83D\uDCC1';
    const color = folder.color || '#6366f1';
    const description = folder.description || '';
    try {
      const result = prepare('INSERT INTO message_folders (name, icon, color, description) VALUES (?, ?, ?, ?)').run(folder.name, icon, color, description);
      return { success: true, folderId: Number(result.lastInsertRowid) };
    } catch (error: any) {
      safeLog.error('[Folders] Create error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:update', async (_, folderId: number, updates: { name?: string; icon?: string; color?: string; description?: string; sort_order?: number }) => {
    const setParts: string[] = [];
    const params: any[] = [];
    if (updates.name) { setParts.push('name = ?'); params.push(updates.name); }
    if (updates.icon) { setParts.push('icon = ?'); params.push(updates.icon); }
    if (updates.color) { setParts.push('color = ?'); params.push(updates.color); }
    if (updates.description !== undefined) { setParts.push('description = ?'); params.push(updates.description); }
    if (updates.sort_order !== undefined) { setParts.push('sort_order = ?'); params.push(updates.sort_order); }
    if (setParts.length === 0) return { success: false, error: 'No updates provided' };
    params.push(folderId);
    try {
      getDb().prepare(`UPDATE message_folders SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Folders] Update error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:delete', async (_, folderId: number) => {
    try {
      prepare('DELETE FROM message_folders WHERE id = ?').run(folderId);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Folders] Delete error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:assign', async (_, folderId: number, sessionKey: string, notes?: string) => {
    try {
      prepare('INSERT OR IGNORE INTO conversation_folders (folder_id, session_key, notes) VALUES (?, ?, ?)').run(folderId, sessionKey, notes || null);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Folders] Assign error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:unassign', async (_, folderId: number, sessionKey: string) => {
    try {
      prepare('DELETE FROM conversation_folders WHERE folder_id = ? AND session_key = ?').run(folderId, sessionKey);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Folders] Unassign error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:for-conversation', async (_, sessionKey: string) => {
    try {
      const folders = prepare('SELECT f.id, f.name, f.icon, f.color, cf.added_at, cf.notes FROM conversation_folders cf JOIN message_folders f ON cf.folder_id = f.id WHERE cf.session_key = ? ORDER BY f.sort_order, f.name').all(sessionKey);
      return { success: true, folders };
    } catch (error: any) {
      safeLog.error('[Folders] Get for conversation error:', error);
      return { success: false, folders: [] };
    }
  });

  registerHandler('folders:conversations', async (_, folderId: number) => {
    try {
      const conversations = prepare('SELECT session_key, added_at, added_by, notes FROM conversation_folders WHERE folder_id = ? ORDER BY added_at DESC').all(folderId);
      return { success: true, conversations };
    } catch (error: any) {
      safeLog.error('[Folders] Get conversations error:', error);
      return { success: false, conversations: [] };
    }
  });

  // ── Folder rules handlers (4) + auto-assign (1) ─────────────────────────

  registerHandler('folders:rules:list', async () => {
    try {
      const folders = prepare('SELECT f.id, f.name as folder_name, f.rules FROM message_folders f WHERE f.is_smart = 1').all() as any[];
      const rules = folders.map((f: any) => {
        try {
          const parsed = f.rules ? JSON.parse(f.rules) : null;
          return parsed ? { ...parsed, folderId: f.id, folderName: f.folder_name } : null;
        } catch (_e) { return null; }
      }).filter(Boolean);
      return { success: true, rules };
    } catch (error: any) {
      safeLog.error('[FolderRules] List error:', error);
      return { success: false, rules: [] };
    }
  });

  registerHandler('folders:rules:get', async (_, folderId: number) => {
    try {
      const row = prepare('SELECT rules FROM message_folders WHERE id = ?').get(folderId) as any;
      if (row && row.rules) {
        const rule = JSON.parse(row.rules);
        return { success: true, rule };
      }
      return { success: true, rule: null };
    } catch (error: any) {
      safeLog.error('[FolderRules] Get error:', error);
      return { success: false, rule: null };
    }
  });

  registerHandler('folders:rules:save', async (_, folderId: number, rule: any) => {
    try {
      const rulesJson = JSON.stringify(rule);
      prepare('UPDATE message_folders SET rules = ?, is_smart = 1 WHERE id = ?').run(rulesJson, folderId);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[FolderRules] Save error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:rules:delete', async (_, folderId: number) => {
    try {
      prepare('UPDATE message_folders SET rules = NULL, is_smart = 0 WHERE id = ?').run(folderId);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[FolderRules] Delete error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('folders:auto-assign', async (_, sessionKey: string, conversationData: any) => {
    try {
      const folders = prepare('SELECT f.id, f.name, f.rules FROM message_folders f WHERE f.is_smart = 1 AND f.rules IS NOT NULL').all() as any[];
      const matchedFolderIds: number[] = [];
      for (const folder of folders) {
        try {
          const rule = JSON.parse(folder.rules);
          if (evaluateRuleSimple(rule, conversationData)) {
            matchedFolderIds.push(folder.id);
            prepare('INSERT OR IGNORE INTO conversation_folders (folder_id, session_key, added_by) VALUES (?, ?, ?)').run(folder.id, sessionKey, 'rule');
          }
        } catch (e) {
          safeLog.error(`[FolderRules] Error evaluating rule for folder ${folder.id}:`, e);
        }
      }
      return { success: true, matchedFolderIds };
    } catch (error: any) {
      safeLog.error('[FolderRules] Auto-assign error:', error);
      return { success: false, matchedFolderIds: [] };
    }
  });
}
