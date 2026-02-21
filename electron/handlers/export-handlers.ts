/**
 * Export & Backup Handlers Module
 *
 * Channels: export:tasks/agentLogs/chatHistory, backup:create/restore/list/cleanup,
 * import:tasks, exportBackup:stats, hrReports:list/read
 *
 * 11 registerHandler calls total.
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerHandler } from '../ipc-registry';
import {
  exportTasks, exportAgentLogs, exportChatHistory,
  createBackup, restoreBackup, listBackups, getStats,
  cleanupOldBackups, importTasks,
} from '../export-backup-service';
import { safeLog } from '../logger';
import { REPORTS_DIR } from '../paths';

export function registerExportHandlers(): void {
  registerHandler('export:tasks', async (_event, options: { format: 'json' | 'csv'; filters?: any }) => {
    try { safeLog.log('[Export] Exporting tasks with format:', options.format); return { success: true, filepath: await exportTasks(options) }; }
    catch (error: any) { safeLog.error('[Export] Task export error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('export:agentLogs', async (_event, options: { format: 'json' | 'csv'; filters?: any }) => {
    try { safeLog.log('[Export] Exporting agent logs'); return { success: true, filepath: await exportAgentLogs(options) }; }
    catch (error: any) { safeLog.error('[Export] Agent logs export error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('export:chatHistory', async (_event, options: { format: 'json' | 'csv'; filters?: any }) => {
    try { safeLog.log('[Export] Exporting chat history'); return { success: true, filepath: await exportChatHistory(options) }; }
    catch (error: any) { safeLog.error('[Export] Chat history export error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('backup:create', async (_event, options?: { includeAttachments?: boolean }) => {
    try { safeLog.log('[Backup] Creating database backup'); return { success: true, filepath: await createBackup(options) }; }
    catch (error: any) { safeLog.error('[Backup] Create backup error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('backup:restore', async (_event, backupPath: string) => {
    try { safeLog.log('[Backup] Restoring from:', backupPath); await restoreBackup(backupPath); return { success: true }; }
    catch (error: any) { safeLog.error('[Backup] Restore error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('backup:list', async () => {
    try { return { success: true, backups: await listBackups() }; }
    catch (error: any) { safeLog.error('[Backup] List backups error:', error); return { success: false, backups: [], error: error.message }; }
  });

  registerHandler('backup:cleanup', async (_event, keepCount: number) => {
    try { safeLog.log('[Backup] Cleaning up old backups, keeping:', keepCount); return { success: true, deletedCount: await cleanupOldBackups(keepCount) }; }
    catch (error: any) { safeLog.error('[Backup] Cleanup error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('import:tasks', async (_event, filepath: string) => {
    try { safeLog.log('[Import] Importing tasks from:', filepath); return { success: true, ...(await importTasks(filepath)) }; }
    catch (error: any) { safeLog.error('[Import] Import error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('exportBackup:stats', async () => {
    try { return { success: true, stats: await getStats() }; }
    catch (error: any) { safeLog.error('[ExportBackup] Stats error:', error); return { success: false, stats: null, error: error.message }; }
  });

  registerHandler('hrReports:list', async () => {
    try {
      const reportsDir = path.join(REPORTS_DIR, 'hr');
      if (!fs.existsSync(reportsDir)) return { success: true, reports: [] };
      const files = fs.readdirSync(reportsDir);
      const reports = files.filter(f => f.endsWith('.md') && f !== 'README.md').map(f => {
        const filePath = path.join(reportsDir, f);
        const stat = fs.statSync(filePath);
        return { name: f, path: filePath, size: stat.size, createdAt: stat.birthtime.getTime(), modifiedAt: stat.mtime.getTime() };
      }).sort((a, b) => b.createdAt - a.createdAt);
      return { success: true, reports };
    } catch (error: any) { safeLog.error('[HRReports] List error:', error); return { success: false, reports: [], error: error.message }; }
  });

  registerHandler('hrReports:read', async (_event, filename: string) => {
    try {
      const reportsDir = path.join(REPORTS_DIR, 'hr');
      const filePath = path.join(reportsDir, path.basename(filename));
      if (!fs.existsSync(filePath)) return { success: false, error: 'Report not found' };
      return { success: true, content: fs.readFileSync(filePath, 'utf-8') };
    } catch (error: any) { safeLog.error('[HRReports] Read error:', error); return { success: false, error: error.message }; }
  });
}
