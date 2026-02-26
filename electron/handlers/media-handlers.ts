/**
 * Media, Screenshot & Library Handlers Module
 *
 * Channels: media:upload/delete/cleanup, screenshot:capture/navigate,
 * library:list/upload/delete/link/view/download/update/uploadBuffer,
 * skills:list, shell:openPath
 *
 * 15 registerHandler calls total.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow, dialog, shell } from 'electron';
import { registerHandler } from '../ipc-registry';
import { prepare, db } from '../database';
import { safeLog } from '../logger';
import { UPLOADS_DIR, LIBRARY_DIR } from '../paths';

const VALID_FILE_CATEGORIES = ['marketing', 'design', 'dev', 'research', 'finance', 'test-logs', 'content', 'social', 'other'] as const;
type FileCategory = typeof VALID_FILE_CATEGORIES[number];

function inferFileCategory(filename: string, _mimeType?: string, taskTitle?: string, assignee?: string): FileCategory {
  const ext = path.extname(filename).toLowerCase();
  const name = filename.toLowerCase();
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.sql', '.json', '.css', '.html', '.diff', '.patch'].includes(ext)) return 'dev';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.mov'].includes(ext)) return 'design';
  if (['.csv', '.xls', '.xlsx'].includes(ext)) return 'finance';
  if (['.zip', '.rar', '.7z'].includes(ext) || name.endsWith('.tar.gz')) return 'other';
  if (['.md', '.txt', '.pdf', '.doc', '.docx', '.draft'].includes(ext)) {
    const ctx = ` ${name.replace(/[_\-./]/g, ' ')} ${(taskTitle || '').replace(/[_\-./]/g, ' ').toLowerCase()} `;
    const agent = (assignee || '').toLowerCase();
    if (/\b(finance|budget|revenue|cost|invoice|expense)\b/.test(ctx)) return 'finance';
    if (/\b(marketing|growth|tweet|campaign|engagement|follower)\b/.test(ctx) || ctx.includes('content plan')) return 'marketing';
    if (/\b(design|wireframe|mockup|figma|layout|theme|modal)\b/.test(ctx) || /\bui\b|\bux\b|\bstyle\b/.test(ctx) || agent === 'designer') return 'design';
    if (/\b(test|qa|checklist|verification|e2e|playwright|benchmark|coverage)\b/.test(ctx)) return 'test-logs';
    if (/\b(research|analysis|investigation|audit|review|study)\b/.test(ctx)) return 'research';
    if (/\b(discord|telegram|twitter|instagram|social)\b/.test(ctx) || ctx.includes('x api') || ['social-manager', 'growth-director'].includes(agent)) return 'social';
    if (/\b(implementation|refactor|migration|schema|api|fix|bug|deploy|build|lint|react|electron)\b/.test(ctx) || ['coder', 'senior-coder', 'lead-engineer'].includes(agent)) return 'dev';
    return 'content';
  }
  return 'other';
}

export function registerMediaHandlers(): void {
  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  registerHandler('media:upload', async (_event, fileName: string, base64Data: string) => {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const uniqueFileName = `${Date.now()}-${baseName}${ext}`;
      const filePath = path.join(UPLOADS_DIR, uniqueFileName);
      fs.writeFileSync(filePath, buffer);
      const stats = fs.statSync(filePath);
      safeLog.log('[Media] Uploaded:', uniqueFileName, 'size:', stats.size);
      return { success: true, path: filePath, fileName: uniqueFileName, size: stats.size };
    } catch (error: any) { safeLog.error('[Media] Upload error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('media:delete', async (_event, filePath: string) => {
    try {
      if (!filePath.startsWith(UPLOADS_DIR)) return { success: false, error: 'Invalid file path' };
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); safeLog.log('[Media] Deleted:', filePath); }
      return { success: true };
    } catch (error: any) { safeLog.error('[Media] Delete error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('media:cleanup', async () => {
    try {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const files = fs.readdirSync(UPLOADS_DIR);
      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < sevenDaysAgo) { fs.unlinkSync(filePath); deletedCount++; }
      }
      safeLog.log('[Media] Cleanup complete:', deletedCount, 'files deleted');
      return { success: true, deletedCount };
    } catch (error: any) { safeLog.error('[Media] Cleanup error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('screenshot:capture', async (_event, outputPath: string) => {
    return new Promise((resolve) => {
      const mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      if (mainWin) {
        mainWin.webContents.capturePage().then((image) => {
          const pngBuffer = image.toPNG();
          fs.writeFileSync(outputPath, pngBuffer);
          resolve({ success: true, path: outputPath, size: pngBuffer.length });
        }).catch((err) => { resolve({ success: false, error: String(err) }); });
      } else { resolve({ success: false, error: 'No main window' }); }
    });
  });

  registerHandler('screenshot:navigate', async (_event, view: string) => {
    const wins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
    if (wins.length > 0) { wins[0].webContents.send('navigate-to', view); return { success: true }; }
    return { success: false, error: 'No main window' };
  });

  // Sync froggo-library filesystem to database
  async function syncLibraryFromFilesystem() {
    const libraryRoot = LIBRARY_DIR;
    const categories = ['content', 'creative', 'dev', 'finance', 'marketing', 'projects', 'reports', 'research', 'social', 'test-logs', 'ui-design', 'docs', 'other'];
    const scannedFiles: any[] = [];
    
    for (const category of categories) {
      const categoryPath = path.join(libraryRoot, category);
      if (!fs.existsSync(categoryPath)) continue;
      
      function scanDir(dirPath: string, relativeCategory: string) {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith('.')) continue;
          const fullPath = path.join(dirPath, item.name);
          
          if (item.isDirectory()) {
            scanDir(fullPath, relativeCategory);
          } else {
            const stats = fs.statSync(fullPath);
            const relativePath = path.relative(libraryRoot, fullPath);
            scannedFiles.push({
              id: `fs-${Buffer.from(relativePath).toString('base64').substring(0, 20)}`,
              name: item.name,
              path: fullPath,
              category: relativeCategory,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              updatedAt: stats.mtime.toISOString(),
            });
          }
        }
      }
      
      scanDir(categoryPath, category);
    }
    
    // Create table if not exists
    db.exec(`CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      size INTEGER,
      mime_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      linked_tasks TEXT,
      tags TEXT,
      project TEXT
    )`);
    
    const upsertStmt = prepare(`INSERT OR REPLACE INTO library 
      (id, name, path, category, size, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
      
    for (const file of scannedFiles) {
      upsertStmt.run(
        file.id,
        file.name,
        file.path,
        file.category,
        file.size,
        file.createdAt,
        file.updatedAt
      );
    }
    
    return { success: true, synced: scannedFiles.length };
  }

  registerHandler('library:sync', async () => {
    try {
      return await syncLibraryFromFilesystem();
    } catch (error: any) {
      safeLog.error('[library:sync] Error:', error);
      return { success: false, error: error.message };
    }
  });

  registerHandler('library:list', async (_event, category?: string) => {
    if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    try {
      let rawFiles: any[];
      if (category) rawFiles = prepare('SELECT * FROM library WHERE category = ? ORDER BY updated_at DESC').all(category) as any[];
      else rawFiles = prepare('SELECT * FROM library ORDER BY updated_at DESC').all() as any[];
      const files = rawFiles.map((f: any) => {
        let linkedTasks: string[] = []; let tags: string[] = [];
        try { linkedTasks = f.linked_tasks ? JSON.parse(f.linked_tasks) : []; } catch { /* ignore */ }
        try { tags = f.tags ? JSON.parse(f.tags) : []; } catch { /* ignore */ }
        const rawCat = f.category || 'other';
        const cat = (VALID_FILE_CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : inferFileCategory(f.name || '');
        return { id: f.id || '', name: f.name || 'Unnamed', path: f.path || '', category: cat, size: f.size || 0, mimeType: f.mime_type || null, createdAt: f.created_at || new Date().toISOString(), updatedAt: f.updated_at || new Date().toISOString(), linkedTasks, tags, project: f.project || null };
      });
      return { success: true, files };
    } catch (error: any) { safeLog.error('[library:list] Error:', error); return { success: true, files: [] }; }
  });

  registerHandler('library:upload', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'All Files', extensions: ['*'] }, { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] }, { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }] });
    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'No file selected' };
    const sourcePath = result.filePaths[0];
    const fileName = path.basename(sourcePath);
    const fileId = `file-${Date.now()}`;
    const destPath = path.join(LIBRARY_DIR, fileId + '-' + fileName);
    if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    const stats = fs.statSync(destPath);
    const cat = inferFileCategory(fileName);
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS library (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, category TEXT DEFAULT 'other', size INTEGER, mime_type TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), linked_tasks TEXT, tags TEXT)`);
      prepare('INSERT INTO library (id, name, path, category, size) VALUES (?, ?, ?, ?, ?)').run(fileId, fileName, destPath, cat, stats.size);
      return { success: true, file: { id: fileId, name: fileName, path: destPath, category: cat, size: stats.size } };
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  registerHandler('library:delete', async (_event, fileId: string) => {
    try {
      const row = prepare('SELECT path FROM library WHERE id = ?').get(fileId) as any;
      if (row?.path && fs.existsSync(row.path)) fs.unlinkSync(row.path);
      const info = prepare('DELETE FROM library WHERE id = ?').run(fileId);
      if (info.changes === 0) return { success: false, error: 'File not found' };
      return { success: true };
    } catch (error: any) { safeLog.error('[Library] Delete error:', error); return { success: false }; }
  });

  registerHandler('library:link', async (_event, fileId: string, taskId: string) => {
    try {
      const row = prepare('SELECT linked_tasks FROM library WHERE id = ?').get(fileId) as any;
      let linkedTasks: string[] = [];
      try { if (row?.linked_tasks) linkedTasks = JSON.parse(row.linked_tasks); } catch { /* ignore */ }
      if (!linkedTasks.includes(taskId)) linkedTasks.push(taskId);
      prepare("UPDATE library SET linked_tasks = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(linkedTasks), fileId);
      return { success: true };
    } catch (error: any) { safeLog.error('[Library] Link error:', error); return { success: false }; }
  });

  registerHandler('library:view', async (_event, fileId: string) => {
    try {
      const file = prepare('SELECT path, mime_type, name FROM library WHERE id = ?').get(fileId) as any;
      if (!file) return { success: false, error: 'File not found' };
      const filePath = file.path.replace('~', process.env.HOME || '');
      if (!fs.existsSync(filePath)) return { success: false, error: 'File does not exist on disk' };
      const mimeType = file.mime_type || '';
      if (mimeType.includes('text/') || mimeType.includes('markdown') || mimeType.includes('json')) {
        return { success: true, content: fs.readFileSync(filePath, 'utf-8'), mimeType, name: file.name, path: filePath, viewType: 'text' };
      } else if (mimeType.startsWith('image/')) {
        const base64 = fs.readFileSync(filePath).toString('base64');
        return { success: true, content: `data:${mimeType};base64,${base64}`, mimeType, name: file.name, path: filePath, viewType: 'image' };
      } else {
        return { success: true, mimeType, name: file.name, path: filePath, viewType: 'binary' };
      }
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  registerHandler('library:download', async (_event, fileId: string) => {
    try {
      const file = prepare('SELECT path, name FROM library WHERE id = ?').get(fileId) as any;
      if (!file) return { success: false, error: 'File not found' };
      const sourcePath = file.path.replace('~', process.env.HOME || '');
      if (!fs.existsSync(sourcePath)) return { success: false, error: 'File does not exist on disk' };
      const saveResult = await dialog.showSaveDialog({ title: 'Save File', defaultPath: file.name });
      if (saveResult.canceled || !saveResult.filePath) return { success: false, error: 'Cancelled' };
      fs.copyFileSync(sourcePath, saveResult.filePath);
      return { success: true, path: saveResult.filePath };
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  registerHandler('library:update', async (_event, fileId: string, updates: { category?: string; tags?: string[]; project?: string }) => {
    try {
      if (updates.category) prepare('UPDATE library SET category = ?, updated_at = datetime("now") WHERE id = ?').run(updates.category, fileId);
      if (updates.tags !== undefined) prepare('UPDATE library SET tags = ?, updated_at = datetime("now") WHERE id = ?').run(JSON.stringify(updates.tags), fileId);
      if (updates.project !== undefined) prepare('UPDATE library SET project = ?, updated_at = datetime("now") WHERE id = ?').run(updates.project, fileId);
      return { success: true };
    } catch (error: any) { safeLog.error('[library:update] Error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('library:uploadBuffer', async (_event, data: { name: string; type: string; buffer: ArrayBuffer }) => {
    try {
      if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
      const fileId = `file-${Date.now()}`;
      const destPath = path.join(LIBRARY_DIR, fileId + '-' + data.name);
      fs.writeFileSync(destPath, Buffer.from(data.buffer));
      const stats = fs.statSync(destPath);
      const cat = inferFileCategory(data.name, data.type);
      prepare('INSERT INTO library (id, name, path, category, size, mime_type) VALUES (?, ?, ?, ?, ?, ?)').run(fileId, data.name, destPath, cat, stats.size, data.type || null);
      return { success: true, file: { id: fileId, name: data.name, path: destPath, category: cat, size: stats.size } };
    } catch (error: any) { safeLog.error('[library:uploadBuffer] Error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('skills:list', async () => {
    try {
      const dbSkills = prepare(`SELECT as2.agent_id, as2.skill_name, as2.proficiency, as2.success_count, as2.failure_count, as2.last_used, as2.notes, ar.name as agent_name, ar.emoji as agent_emoji FROM agent_skills as2 LEFT JOIN agent_registry ar ON as2.agent_id = ar.id ORDER BY as2.agent_id, as2.proficiency DESC`).all();
      return { success: true, skills: dbSkills };
    } catch (error: any) { safeLog.error('[skills:list] Error:', error); return { success: false, error: error.message, skills: [] }; }
  });

  registerHandler('shell:openPath', async (_event, filePath: string) => {
    try {
      const expandedPath = filePath.replace('~', process.env.HOME || '');
      if (!fs.existsSync(expandedPath)) return { success: false, error: 'Path does not exist' };
      const result = await shell.openPath(expandedPath);
      return result === '' ? { success: true } : { success: false, error: result };
    } catch (error: any) { return { success: false, error: error.message }; }
  });
}
