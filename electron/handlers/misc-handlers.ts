/**
 * Misc Handlers Module (DB, FS, Exec, Search, Module Builder)
 *
 * Channels: db:exec, db:query (NEW alias), fs:writeBase64/readFile/append,
 * exec:run/audit/validate, search:local, module:list/get/save/delete
 *
 * 13 registerHandler calls total.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { registerHandler } from '../ipc-registry';
import { prepare, db } from '../database';
import { validateFsPath } from '../fs-validation';
import { secureExec, getAuditLog, validateCommand } from '../shell-security';
import { safeLog } from '../logger';
import { PROJECT_ROOT, SHELL_PATH } from '../paths';

const execAsync = promisify(exec);

export function registerMiscHandlers(): void {
  // Core db:exec handler
  registerHandler('db:exec', async (_event, query: string, params?: any[]) => {
    try {
      const queryLower = query.trim().toLowerCase();
      if (!queryLower.startsWith('select') && !queryLower.startsWith('insert')) {
        return { success: false, error: 'Only SELECT and INSERT queries are allowed from renderer' };
      }
      const stmt = prepare(query);
      const bindParams = params && params.length > 0 ? params : [];
      if (queryLower.startsWith('insert')) { stmt.run(...bindParams); return { success: true, result: [] }; }
      else { return { success: true, result: stmt.all(...bindParams) }; }
    } catch (error: any) { safeLog.error('[DB] Exec error:', error); return { success: false, error: error.message }; }
  });

  // NEW: db:query alias for db:exec
  registerHandler('db:query', async (_event, query: string, params?: any[]) => {
    try {
      const queryLower = query.trim().toLowerCase();
      if (!queryLower.startsWith('select') && !queryLower.startsWith('insert')) {
        return { success: false, error: 'Only SELECT and INSERT queries are allowed from renderer' };
      }
      const stmt = prepare(query);
      const bindParams = params && params.length > 0 ? params : [];
      if (queryLower.startsWith('insert')) { stmt.run(...bindParams); return { success: true, result: [] }; }
      else { return { success: true, result: stmt.all(...bindParams) }; }
    } catch (error: any) { safeLog.error('[DB] Query error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('fs:writeBase64', async (_event, filePath: string, base64Data: string) => {
    try {
      const check = validateFsPath(filePath);
      if (!check.valid) { safeLog.error('[FS] Write blocked:', check.error); return { success: false, error: check.error }; }
      fs.writeFileSync(check.resolved, Buffer.from(base64Data, 'base64'));
      return { success: true, path: check.resolved };
    } catch (error: any) { safeLog.error('[FS] Write error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('fs:readFile', async (_event, filePath: string, encoding?: string) => {
    try {
      const check = validateFsPath(filePath);
      if (!check.valid) { safeLog.error('[FS] Read blocked:', check.error); return { success: false, error: check.error }; }
      const content = fs.readFileSync(check.resolved, encoding as BufferEncoding || 'utf8');
      return { success: true, content };
    } catch (error: any) { safeLog.error('[FS] Read error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('fs:append', async (_event, filePath: string, content: string) => {
    try {
      const check = validateFsPath(filePath);
      if (!check.valid) { safeLog.error('[FS] Append blocked:', check.error); return { success: false, error: check.error }; }
      const dir = path.dirname(check.resolved);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(check.resolved, content);
      return { success: true, path: check.resolved };
    } catch (error: any) { safeLog.error('[FS] Append error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('exec:run', async (_event, command: string) => {
    const workDir = PROJECT_ROOT;
    const result = await secureExec(command, async (cmd: string) => {
      return await execAsync(cmd, { maxBuffer: 1024 * 1024, timeout: 30000, cwd: workDir, env: { ...process.env, PATH: `${SHELL_PATH}:${process.env.PATH || ''}` } });
    }, 'exec');
    if (!result.success && result.blocked) safeLog.warn(`[Exec] Blocked: ${result.reason}`);
    return result;
  });

  registerHandler('exec:audit', async (_event, limit?: number) => getAuditLog(limit || 100));

  registerHandler('exec:validate', async (_event, command: string) => validateCommand(command));

  registerHandler('search:local', async (_event, query: string) => {
    return new Promise((resolve) => {
      execFile('/opt/homebrew/bin/froggo-db', ['search', query, '--limit', '20', '--json'], { timeout: 15000 }, (error, stdout) => {
        if (error) { safeLog.error('[Search] Local search error:', error); resolve({ success: false, results: [] }); return; }
        try {
          const data = JSON.parse(stdout);
          const allResults = [...(data.messages || []), ...(data.facts || [])];
          allResults.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
          resolve({ success: true, results: allResults, stats: data.stats || { total: allResults.length, duration_ms: 0 } });
        } catch {
          const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('===') && !l.startsWith('\u{1F4CA}'));
          const results = lines.slice(0, 10).map((line, i) => ({ id: `search-${i}`, type: 'message', title: line.slice(0, 50), text: line, snippet: line, relevance_score: 0 }));
          resolve({ success: true, results });
        }
      });
    });
  });

  // Module Builder persistence
  registerHandler('module:list', async () => {
    try {
      const rows = db.prepare(`SELECT id, name, description, status, overall_progress, created_at, updated_at FROM module_specs WHERE status != 'archived' ORDER BY updated_at DESC`).all();
      return { success: true, modules: rows };
    } catch (error: any) { safeLog.error('[ModuleBuilder] list error:', error.message); return { success: false, modules: [], error: error.message }; }
  });

  registerHandler('module:get', async (_event, id: string) => {
    try {
      const row = db.prepare('SELECT * FROM module_specs WHERE id = ?').get(id) as any;
      if (!row) return { success: false, error: 'not found' };
      row.spec = JSON.parse(row.spec || '{}');
      row.conversation = JSON.parse(row.conversation || '[]');
      row.conversation_state = JSON.parse(row.conversation_state || '{}');
      return { success: true, module: row };
    } catch (error: any) { safeLog.error('[ModuleBuilder] get error:', error.message); return { success: false, error: error.message }; }
  });

  registerHandler('module:save', async (_event, data: any) => {
    try {
      const now = Date.now();
      const existing = db.prepare('SELECT created_at FROM module_specs WHERE id = ?').get(data.id) as any;
      const createdAt = existing?.created_at || data.created_at || now;
      db.prepare(`INSERT OR REPLACE INTO module_specs (id, name, description, status, spec, conversation, conversation_state, overall_progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        data.id, data.name || '', data.description || '', data.status || 'in-progress',
        JSON.stringify(data.spec || {}), JSON.stringify(data.conversation || []),
        JSON.stringify(data.conversation_state || {}), data.overall_progress || 0, createdAt, now
      );
      return { success: true };
    } catch (error: any) { safeLog.error('[ModuleBuilder] save error:', error.message); return { success: false, error: error.message }; }
  });

  registerHandler('module:delete', async (_event, id: string) => {
    try {
      db.prepare('UPDATE module_specs SET status = ?, updated_at = ? WHERE id = ?').run('archived', Date.now(), id);
      return { success: true };
    } catch (error: any) { safeLog.error('[ModuleBuilder] delete error:', error.message); return { success: false, error: error.message }; }
  });
}
