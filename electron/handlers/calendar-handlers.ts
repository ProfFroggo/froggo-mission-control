/**
 * Calendar & Accounts Handlers Module
 *
 * Calendar, accounts, and connected-accounts IPC handlers extracted from main.ts:
 * - calendar:events:list, get, create, update, delete (5)
 * - calendar:events, createEvent, updateEvent, deleteEvent,
 *   listCalendars, listAccounts, addAccount, removeAccount, testConnection (9)
 * - calendar:aggregate, clearCache, cacheStats (3)
 * - accounts:list, add, test, refresh, remove (5)
 * - connectedAccounts:list, get, getPermissions, getAvailableTypes,
 *   add, remove, refresh, getSyncHistory, importGoogle (9)
 *
 * 31 registerHandler calls total.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { prepare, db } from '../database';
import { safeLog } from '../logger';
import { FROGGO_DB } from '../paths';
import { calendarService } from '../calendar-service';
import { accountsService } from '../accounts-service';
import { accountsServiceV2 } from '../accounts-service-v2';
import { connectedAccountsService } from '../connected-accounts-service';

// ── Default email account helper ─────────────────────────────────────────────

function getDefaultGogEmail(): string {
  try {
    const gogList = execSync('/opt/homebrew/bin/gog auth list --json', {
      timeout: 5000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` },
    }).toString();
    const gogData = JSON.parse(gogList);
    const accounts = (gogData.accounts || []).filter((a: any) => a.services?.includes('gmail'));
    return accounts[0]?.email || '';
  } catch {
    return '';
  }
}

const froggoDbPath = FROGGO_DB;

// ── Register all calendar handlers ───────────────────────────────────────────

export function registerCalendarHandlers(): void {

  // ── Calendar events CRUD (5) ─────────────────────────────────────────────

  registerHandler('calendar:events:list', async () => {
    const cmd = `sqlite3 "${froggoDbPath}" "SELECT id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata FROM calendar_events ORDER BY start_time ASC" -json`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) {
          safeLog.error('[Calendar] List error:', error);
          resolve({ success: false, events: [] });
          return;
        }
        try { resolve({ success: true, events: JSON.parse(stdout || '[]') }); }
        catch (e) { safeLog.error('[Calendar] Parse error:', e); resolve({ success: false, events: [] }); }
      });
    });
  });

  registerHandler('calendar:events:get', async (_, eventId: string) => {
    const cmd = `sqlite3 "${froggoDbPath}" "SELECT id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata FROM calendar_events WHERE id='${eventId}'" -json`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { safeLog.error('[Calendar] Get error:', error); resolve({ success: false, event: null }); return; }
        try {
          const events = JSON.parse(stdout || '[]');
          if (events.length === 0) resolve({ success: false, event: null, error: 'Event not found' });
          else resolve({ success: true, event: events[0] });
        } catch (e) { safeLog.error('[Calendar] Parse error:', e); resolve({ success: false, event: null }); }
      });
    });
  });

  registerHandler('calendar:events:create', async (_, event: {
    title: string; description?: string; start_time: string | number; end_time?: string | number;
    all_day?: boolean; location?: string; color?: string; category?: string; status?: string;
    recurrence?: any; attendees?: any; reminders?: any; source?: string; source_id?: string;
    task_id?: string; metadata?: any;
  }) => {
    const eventId = `event-${Date.now()}`;
    const now = Date.now();
    let start_time_ms: number;
    if (typeof event.start_time === 'string') start_time_ms = new Date(event.start_time).getTime();
    else start_time_ms = event.start_time;
    let end_time_ms: number | null = null;
    if (event.end_time) {
      if (typeof event.end_time === 'string') end_time_ms = new Date(event.end_time).getTime();
      else end_time_ms = event.end_time;
    }
    const all_day = event.all_day ? 1 : 0;
    const status = event.status || 'confirmed';
    const source = event.source || 'manual';
    try {
      prepare(
        'INSERT INTO calendar_events (id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        eventId, event.title, event.description || '', start_time_ms, end_time_ms, all_day,
        event.location || '', event.color || '', event.category || '', status,
        event.recurrence ? JSON.stringify(event.recurrence) : '',
        event.attendees ? JSON.stringify(event.attendees) : '',
        event.reminders ? JSON.stringify(event.reminders) : '',
        source, event.source_id || '', event.task_id || null, now, now,
        event.metadata ? JSON.stringify(event.metadata) : ''
      );
      return {
        success: true,
        event: {
          id: eventId, title: event.title, description: event.description,
          start_time: start_time_ms, end_time: end_time_ms, all_day,
          location: event.location, color: event.color, category: event.category,
          status, recurrence: event.recurrence, attendees: event.attendees,
          reminders: event.reminders, source, source_id: event.source_id,
          task_id: event.task_id, created_at: now, updated_at: now, metadata: event.metadata
        }
      };
    } catch (error: any) {
      safeLog.error('[Calendar] Create error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('calendar:events:update', async (_, eventId: string, updates: {
    title?: string; description?: string; start_time?: string | number; end_time?: string | number;
    all_day?: boolean; location?: string; color?: string; category?: string; status?: string;
    recurrence?: any; attendees?: any; reminders?: any; source?: string; source_id?: string;
    task_id?: string; metadata?: any;
  }) => {
    const setParts: string[] = [];
    const params: any[] = [];
    if (updates.title !== undefined) { setParts.push('title = ?'); params.push(updates.title); }
    if (updates.description !== undefined) { setParts.push('description = ?'); params.push(updates.description); }
    if (updates.start_time !== undefined) {
      const start_ms = typeof updates.start_time === 'string' ? new Date(updates.start_time).getTime() : updates.start_time;
      setParts.push('start_time = ?'); params.push(start_ms);
    }
    if (updates.end_time !== undefined) {
      const end_ms = typeof updates.end_time === 'string' ? new Date(updates.end_time).getTime() : updates.end_time;
      setParts.push('end_time = ?'); params.push(end_ms);
    }
    if (updates.all_day !== undefined) { setParts.push('all_day = ?'); params.push(updates.all_day ? 1 : 0); }
    if (updates.location !== undefined) { setParts.push('location = ?'); params.push(updates.location); }
    if (updates.color !== undefined) { setParts.push('color = ?'); params.push(updates.color); }
    if (updates.category !== undefined) { setParts.push('category = ?'); params.push(updates.category); }
    if (updates.status !== undefined) { setParts.push('status = ?'); params.push(updates.status); }
    if (updates.recurrence !== undefined) { setParts.push('recurrence = ?'); params.push(JSON.stringify(updates.recurrence)); }
    if (updates.attendees !== undefined) { setParts.push('attendees = ?'); params.push(JSON.stringify(updates.attendees)); }
    if (updates.reminders !== undefined) { setParts.push('reminders = ?'); params.push(JSON.stringify(updates.reminders)); }
    if (updates.source !== undefined) { setParts.push('source = ?'); params.push(updates.source); }
    if (updates.source_id !== undefined) { setParts.push('source_id = ?'); params.push(updates.source_id); }
    if (updates.task_id !== undefined) { setParts.push('task_id = ?'); params.push(updates.task_id || null); }
    if (updates.metadata !== undefined) { setParts.push('metadata = ?'); params.push(JSON.stringify(updates.metadata)); }
    if (setParts.length === 0) return { success: false, error: 'No updates provided' };
    setParts.push('updated_at = ?'); params.push(Date.now());
    params.push(eventId);
    try {
      db.prepare(`UPDATE calendar_events SET ${setParts.join(', ')} WHERE id = ?`).run(...params);
      const updatedEvent = prepare(
        'SELECT id, title, description, start_time, end_time, all_day, location, color, category, status, recurrence, attendees, reminders, source, source_id, task_id, created_at, updated_at, metadata FROM calendar_events WHERE id = ?'
      ).get(eventId);
      return { success: true, event: updatedEvent || null };
    } catch (error: any) {
      safeLog.error('[Calendar] Update error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('calendar:events:delete', async (_, eventId: string) => {
    const cmd = `sqlite3 "${froggoDbPath}" "DELETE FROM calendar_events WHERE id='${eventId}'"`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error) => {
        if (error) { safeLog.error('[Calendar] Delete error:', error); resolve({ success: false, error: error.message }); return; }
        resolve({ success: true });
      });
    });
  });

  // ── Legacy calendar handlers (gog CLI) (9) ──────────────────────────────

  registerHandler('calendar:events', async (_, account?: string, days?: number) => {
    const daysArg = days === 1 ? '--today' : days ? `--days ${days}` : '--days 7';
    const execEnv = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` };
    const accounts: string[] = [];
    if (account) {
      accounts.push(account);
    } else {
      try {
        const gogList = execSync('/opt/homebrew/bin/gog auth list --json', { timeout: 5000, env: execEnv }).toString();
        const gogData = JSON.parse(gogList);
        for (const a of gogData.accounts || []) {
          if (a.email && a.services?.includes('calendar')) accounts.push(a.email);
        }
      } catch {
        const fallback = getDefaultGogEmail();
        if (fallback) accounts.push(fallback);
      }
    }
    if (accounts.length === 0) return { success: true, events: [] };
    const allEvents: any[] = [];
    const errors: string[] = [];
    await Promise.all(accounts.map((acct) => {
      const cmd = `/opt/homebrew/bin/gog calendar events ${daysArg} --account ${acct} --json`;
      return new Promise<void>((resolve) => {
        exec(cmd, { timeout: 30000, env: execEnv }, (error, stdout) => {
          if (error) { safeLog.error(`[Calendar] Events error for ${acct}:`, error.message); errors.push(`${acct}: ${error.message}`); resolve(); return; }
          try {
            const data = JSON.parse(stdout);
            const events = Array.isArray(data) ? data : (data.events || []);
            for (const ev of events) { ev.account = acct; ev.source = 'google'; }
            allEvents.push(...events);
          } catch { /* ignore */ }
          resolve();
        });
      });
    }));
    allEvents.sort((a, b) => {
      const aTime = a.start?.dateTime || a.start?.date || '';
      const bTime = b.start?.dateTime || b.start?.date || '';
      return aTime.localeCompare(bTime);
    });
    return { success: true, events: allEvents, accounts, errors };
  });

  registerHandler('calendar:createEvent', async (_, params: any) => {
    const { account, title, start, end, location, description, attendees, isAllDay, recurrence, _timeZone } = params;
    const acct = account || getDefaultGogEmail();
    const calendarId = 'primary';
    let cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar create ${calendarId}`;
    cmd += ` --summary "${title.replace(/"/g, '\\"')}"`;
    if (isAllDay) { cmd += ` --from "${start}" --to "${end || start}" --all-day`; }
    else { cmd += ` --from "${start}" --to "${end || start}"`; }
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
        if (error) { safeLog.error('[Calendar] Create event error:', error, stderr); resolve({ success: false, error: error.message || stderr }); return; }
        safeLog.log('[Calendar] Create event result:', stdout);
        resolve({ success: true, result: stdout });
      });
    });
  });

  registerHandler('calendar:updateEvent', async (_, params: any) => {
    const { account, eventId, title, start, end, location, description, attendees, isAllDay, _timeZone } = params;
    const acct = account || getDefaultGogEmail();
    const calendarId = 'primary';
    let cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar update ${calendarId} "${eventId}"`;
    if (title) cmd += ` --summary "${title.replace(/"/g, '\\"')}"`;
    if (start) {
      if (isAllDay) { cmd += ` --from "${start}" --to "${end || start}" --all-day`; }
      else { cmd += ` --from "${start}" --to "${end || start}"`; }
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
        if (error) { safeLog.error('[Calendar] Update event error:', error, stderr); resolve({ success: false, error: error.message || stderr }); return; }
        safeLog.log('[Calendar] Update event result:', stdout);
        resolve({ success: true, result: stdout });
      });
    });
  });

  registerHandler('calendar:deleteEvent', async (_, params: any) => {
    const { account, eventId } = params;
    const acct = account || getDefaultGogEmail();
    const calendarId = 'primary';
    const cmd = `GOG_ACCOUNT=${acct} /opt/homebrew/bin/gog calendar delete ${calendarId} "${eventId}"`;
    safeLog.log('[Calendar] Delete event command:', cmd);
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
        if (error) { safeLog.error('[Calendar] Delete event error:', error, stderr); resolve({ success: false, error: error.message || stderr }); return; }
        safeLog.log('[Calendar] Delete event result:', stdout);
        resolve({ success: true, result: stdout });
      });
    });
  });

  registerHandler('calendar:listCalendars', async (_, account: string) => {
    const cmd = `GOG_ACCOUNT=${account} /opt/homebrew/bin/gog calendar calendars --json`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
        if (error) { safeLog.error('[Calendar] List calendars error:', error, stderr); resolve({ success: false, calendars: [], error: error.message || stderr }); return; }
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

  registerHandler('calendar:listAccounts', async () => {
    let knownAccounts: string[] = [];
    try {
      const gogList = execSync('/opt/homebrew/bin/gog auth list --json', {
        timeout: 5000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` },
      }).toString();
      const gogData = JSON.parse(gogList);
      knownAccounts = (gogData.accounts || []).map((a: any) => a.email).filter(Boolean);
    } catch {
      safeLog.warn('[Calendar] Failed to discover gog accounts for listAccounts');
    }
    const accountPromises = knownAccounts.map(async (email) => {
      const cmd = `GOG_ACCOUNT=${email} /opt/homebrew/bin/gog calendar calendars --json`;
      return new Promise<{ email: string; authenticated: boolean; calendarsCount?: number }>((resolve) => {
        exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout) => {
          if (error) { resolve({ email, authenticated: false }); return; }
          try {
            const data = JSON.parse(stdout);
            const calendars = data.calendars || data || [];
            resolve({ email, authenticated: true, calendarsCount: calendars.length });
          } catch { resolve({ email, authenticated: false }); }
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

  registerHandler('calendar:addAccount', async () => {
    const cmd = `/opt/homebrew/bin/gog auth`;
    return new Promise((resolve) => {
      const terminalCmd = `osascript -e 'tell application "Terminal" to do script "${cmd}"'`;
      exec(terminalCmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[Calendar] Add account error:', error, stderr);
          resolve({ success: false, error: 'Failed to launch authentication. Please run "gog auth" manually in Terminal.' });
          return;
        }
        resolve({ success: true, message: 'Authentication started in Terminal. Please follow the prompts to complete authentication.' });
      });
    });
  });

  registerHandler('calendar:removeAccount', async (_, account: string) => {
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

  registerHandler('calendar:testConnection', async (_, account: string) => {
    const cmd = `GOG_ACCOUNT=${account} /opt/homebrew/bin/gog calendar calendars --json`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}` } }, (error, stdout, stderr) => {
        if (error) { safeLog.error('[Calendar] Test connection error:', error, stderr); resolve({ success: false, error: error.message || stderr }); return; }
        try {
          const data = JSON.parse(stdout);
          const calendars = data.calendars || data || [];
          resolve({ success: true, calendarsCount: calendars.length, account });
        } catch (_parseError) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });
    });
  });

  // ── Calendar aggregation (3) ─────────────────────────────────────────────

  registerHandler('calendar:aggregate', async (_, options?: {
    days?: number; includeGoogle?: boolean; includeMissionControl?: boolean; accounts?: string[];
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

  registerHandler('calendar:clearCache', async (_, source?: 'google' | 'mission-control' | 'all') => {
    try {
      calendarService.clearCache(source);
      safeLog.log(`[Calendar:clearCache] Cleared cache for: ${source || 'all'}`);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Calendar:clearCache] Error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('calendar:cacheStats', async () => {
    try {
      const stats = calendarService.getCacheStats();
      safeLog.log('[Calendar:cacheStats] Stats:', stats);
      return { success: true, stats };
    } catch (error: any) {
      safeLog.error('[Calendar:cacheStats] Error:', error);
      return { success: false, error: error.message };
    }
  });

  // ── Accounts service handlers (5) ────────────────────────────────────────

  registerHandler('accounts:list', async () => {
    try {
      const result = await accountsServiceV2.listAccounts();
      return result;
    } catch (error: any) {
      safeLog.error('[Accounts] List error:', error);
      return { success: false, accounts: [], error: error.message };
    }
  });

  registerHandler('accounts:add', async (_, request: {
    provider: string; email: string; dataTypes: string[];
    authType: 'oauth' | 'app-password'; appPassword?: string;
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

  registerHandler('accounts:test', async (_, accountId: string) => {
    try {
      const result = await accountsService.testAccount(accountId);
      return result;
    } catch (error: any) {
      safeLog.error('[Accounts] Test error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('accounts:refresh', async (_, accountId: string) => {
    try {
      safeLog.log('[Accounts] Refreshing OAuth for:', accountId);
      const result = await accountsServiceV2.refreshAccount(accountId);
      return result;
    } catch (error: any) {
      safeLog.error('[Accounts] Refresh error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('accounts:remove', async (_, accountId: string) => {
    try {
      safeLog.log('[Accounts] Removing account:', accountId);
      const result = await accountsServiceV2.removeAccount(accountId);
      return result;
    } catch (error: any) {
      safeLog.error('[Accounts] Remove error:', error);
      return { success: false, error: error.message };
    }
  });

  // ── Connected accounts handlers (9) ──────────────────────────────────────

  registerHandler('connectedAccounts:list', async () => {
    try {
      const result = await accountsServiceV2.listAccounts();
      return result;
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] List error:', error);
      return { success: false, accounts: [], error: error.message };
    }
  });

  registerHandler('connectedAccounts:get', async (_, accountId: string) => {
    try {
      const account = await connectedAccountsService.getAccount(accountId);
      return { success: true, account };
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Get error:', error);
      return { success: false, account: null, error: error.message };
    }
  });

  registerHandler('connectedAccounts:getPermissions', async (_, accountId: string) => {
    try {
      const permissions = await connectedAccountsService.getAccountPermissions(accountId);
      return { success: true, permissions };
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Get permissions error:', error);
      return { success: false, permissions: [], error: error.message };
    }
  });

  registerHandler('connectedAccounts:getAvailableTypes', async () => {
    try {
      const types = await connectedAccountsService.getAvailableAccountTypes();
      return { success: true, types };
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Get available types error:', error);
      return { success: false, types: [], error: error.message };
    }
  });

  registerHandler('connectedAccounts:add', async (_, accountType: string, options?: any) => {
    try {
      const result = await connectedAccountsService.addAccount(accountType, options);
      return result;
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Add error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('connectedAccounts:remove', async (_, accountId: string) => {
    try {
      const result = await connectedAccountsService.removeAccount(accountId);
      return result;
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Remove error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('connectedAccounts:refresh', async (_, accountId: string) => {
    try {
      safeLog.log('[ConnectedAccounts] Refreshing OAuth for:', accountId);
      const result = await accountsServiceV2.refreshAccount(accountId);
      return result;
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Refresh error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('connectedAccounts:getSyncHistory', async (_, accountId: string, limit?: number) => {
    try {
      const history = await connectedAccountsService.getSyncHistory(accountId, limit);
      return { success: true, history };
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Get sync history error:', error);
      return { success: false, history: [], error: error.message };
    }
  });

  registerHandler('connectedAccounts:importGoogle', async () => {
    try {
      const result = await connectedAccountsService.importGoogleAccounts();
      return { success: true, ...result };
    } catch (error: any) {
      safeLog.error('[ConnectedAccounts] Import Google error:', error);
      return { success: false, imported: 0, errors: [error.message] };
    }
  });
}
