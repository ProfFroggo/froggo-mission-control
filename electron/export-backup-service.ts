/**
 * Export and Backup Service
 * Handles data export, backup, and restore operations for Froggo Dashboard
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const DB_PATH = path.join(os.homedir(), 'clawd', 'data', 'froggo.db');
const BACKUP_DIR = path.join(os.homedir(), 'clawd', 'backups');
const EXPORT_DIR = path.join(os.homedir(), 'clawd', 'exports');

// Ensure directories exist
[BACKUP_DIR, EXPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export interface ExportOptions {
  format: 'json' | 'csv';
  filters?: {
    status?: string;
    project?: string;
    assignedTo?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface BackupOptions {
  includeAttachments?: boolean;
  compressionLevel?: number;
}

export interface BackupMetadata {
  timestamp: string;
  version: string;
  size: number;
  tables: string[];
  includesAttachments: boolean;
}

/**
 * Execute SQLite query and return JSON results
 */
async function queryDb(query: string): Promise<any[]> {
  try {
    const { stdout } = await execPromise(
      `sqlite3 "${DB_PATH}" "${query}" -json`,
      { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer for large exports
    );
    
    const trimmed = stdout.trim();
    if (!trimmed || trimmed === '[]') {
      return [];
    }
    
    return JSON.parse(trimmed);
  } catch (error: any) {
    console.error('[ExportBackup] Query error:', error.message);
    throw new Error(`Database query failed: ${error.message}`);
  }
}

/**
 * Convert JSON array to CSV format
 */
function jsonToCsv(data: any[]): string {
  if (data.length === 0) return '';
  
  // Get all unique keys from all objects
  const keys = Array.from(
    new Set(data.flatMap(obj => Object.keys(obj)))
  );
  
  // CSV header
  const header = keys.map(k => `"${k}"`).join(',');
  
  // CSV rows
  const rows = data.map(obj => {
    return keys.map(key => {
      const value = obj[key];
      if (value === null || value === undefined) return '';
      // Escape quotes and wrap in quotes
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
}

/**
 * Export tasks with optional filters
 */
export async function exportTasks(options: ExportOptions): Promise<string> {
  console.log('[ExportBackup] Exporting tasks with options:', options);
  
  let query = `
    SELECT 
      t.id,
      t.title,
      t.description,
      t.status,
      t.project,
      t.assigned_to,
      t.reviewerId as reviewer_id,
      t.priority,
      t.tags,
      t.due_date,
      t.created_at,
      t.updated_at,
      t.started_at,
      t.completed_at,
      t.planning_notes,
      (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND completed = 1) as completed_subtasks,
      (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) as attachment_count
    FROM tasks t
    WHERE 1=1
  `;
  
  // Apply filters
  const filters = options.filters || {};
  if (filters.status) {
    query += ` AND t.status = '${filters.status}'`;
  }
  if (filters.project) {
    query += ` AND t.project = '${filters.project}'`;
  }
  if (filters.assignedTo) {
    query += ` AND t.assigned_to = '${filters.assignedTo}'`;
  }
  if (filters.dateFrom) {
    query += ` AND t.created_at >= '${filters.dateFrom}'`;
  }
  if (filters.dateTo) {
    query += ` AND t.created_at <= '${filters.dateTo}'`;
  }
  
  query += ` ORDER BY t.created_at DESC`;
  
  const tasks = await queryDb(query);
  
  // Also fetch subtasks for each task
  const taskIds = tasks.map(t => t.id);
  let subtasks: any[] = [];
  
  if (taskIds.length > 0) {
    const subtasksQuery = `
      SELECT * FROM subtasks 
      WHERE task_id IN (${taskIds.map(id => `'${id}'`).join(',')})
      ORDER BY task_id, created_at
    `;
    subtasks = await queryDb(subtasksQuery);
  }
  
  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `tasks-export-${timestamp}.${options.format}`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  // Write export file
  if (options.format === 'json') {
    const exportData = {
      exported_at: new Date().toISOString(),
      filters: options.filters,
      task_count: tasks.length,
      tasks: tasks,
      subtasks: subtasks
    };
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
  } else {
    // CSV format
    const tasksCSV = jsonToCsv(tasks);
    fs.writeFileSync(filepath, tasksCSV);
    
    // Also export subtasks to separate CSV
    if (subtasks.length > 0) {
      const subtasksFilename = `subtasks-export-${timestamp}.csv`;
      const subtasksFilepath = path.join(EXPORT_DIR, subtasksFilename);
      const subtasksCSV = jsonToCsv(subtasks);
      fs.writeFileSync(subtasksFilepath, subtasksCSV);
    }
  }
  
  console.log('[ExportBackup] Tasks exported to:', filepath);
  return filepath;
}

/**
 * Export agent activity logs
 */
export async function exportAgentLogs(options: ExportOptions): Promise<string> {
  console.log('[ExportBackup] Exporting agent logs');
  
  let query = `
    SELECT 
      a.id,
      a.task_id,
      a.activity_type,
      a.details,
      a.created_at,
      a.agent_id,
      a.metadata,
      t.title as task_title,
      t.project as task_project
    FROM task_activity a
    LEFT JOIN tasks t ON a.task_id = t.id
    WHERE 1=1
  `;
  
  const filters = options.filters || {};
  if (filters.dateFrom) {
    query += ` AND a.created_at >= '${filters.dateFrom}'`;
  }
  if (filters.dateTo) {
    query += ` AND a.created_at <= '${filters.dateTo}'`;
  }
  
  query += ` ORDER BY a.created_at DESC`;
  
  const logs = await queryDb(query);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `agent-logs-${timestamp}.${options.format}`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  if (options.format === 'json') {
    const exportData = {
      exported_at: new Date().toISOString(),
      log_count: logs.length,
      logs: logs
    };
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
  } else {
    const csv = jsonToCsv(logs);
    fs.writeFileSync(filepath, csv);
  }
  
  console.log('[ExportBackup] Agent logs exported to:', filepath);
  return filepath;
}

/**
 * Export chat history
 */
export async function exportChatHistory(options: ExportOptions): Promise<string> {
  console.log('[ExportBackup] Exporting chat history');
  
  let query = `
    SELECT 
      id,
      timestamp,
      session_key,
      channel,
      role,
      content,
      message_id,
      metadata
    FROM messages
    WHERE 1=1
  `;
  
  const filters = options.filters || {};
  if (filters.dateFrom) {
    query += ` AND timestamp >= '${filters.dateFrom}'`;
  }
  if (filters.dateTo) {
    query += ` AND timestamp <= '${filters.dateTo}'`;
  }
  
  query += ` ORDER BY timestamp DESC LIMIT 10000`; // Limit to last 10k messages
  
  const messages = await queryDb(query);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `chat-history-${timestamp}.${options.format}`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  if (options.format === 'json') {
    const exportData = {
      exported_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages
    };
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
  } else {
    const csv = jsonToCsv(messages);
    fs.writeFileSync(filepath, csv);
  }
  
  console.log('[ExportBackup] Chat history exported to:', filepath);
  return filepath;
}

/**
 * Create full database backup
 */
export async function createBackup(options: BackupOptions = {}): Promise<string> {
  console.log('[ExportBackup] Creating database backup');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `froggo-backup-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);
  const metadataPath = path.join(BACKUP_DIR, `froggo-backup-${timestamp}.json`);
  
  // Use SQLite backup command for safe, consistent backup
  await execPromise(`sqlite3 "${DB_PATH}" ".backup '${backupPath}'"`);
  
  // Get backup metadata
  const stats = fs.statSync(backupPath);
  const tablesResult = await queryDb(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `);
  const tables = tablesResult.map((t: any) => t.name);
  
  const metadata: BackupMetadata = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    size: stats.size,
    tables: tables,
    includesAttachments: options.includeAttachments || false
  };
  
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  // Optionally backup attachments
  if (options.includeAttachments) {
    const attachmentsDir = path.join(os.homedir(), 'clawd', 'deliverables');
    const backupAttachmentsDir = path.join(BACKUP_DIR, `attachments-${timestamp}`);
    
    if (fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(backupAttachmentsDir, { recursive: true });
      
      // Copy attachments directory
      await execPromise(`cp -R "${attachmentsDir}"/* "${backupAttachmentsDir}/" || true`);
    }
  }
  
  console.log('[ExportBackup] Backup created:', backupPath);
  return backupPath;
}

/**
 * Restore database from backup
 */
export async function restoreBackup(backupPath: string): Promise<void> {
  console.log('[ExportBackup] Restoring from backup:', backupPath);
  
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found');
  }
  
  // Create a backup of current database first
  const safeguardPath = DB_PATH + '.before-restore';
  fs.copyFileSync(DB_PATH, safeguardPath);
  console.log('[ExportBackup] Created safeguard backup:', safeguardPath);
  
  try {
    // Restore the backup
    fs.copyFileSync(backupPath, DB_PATH);
    console.log('[ExportBackup] Database restored successfully');
    
    // Verify the restored database
    await queryDb('SELECT COUNT(*) as count FROM tasks');
    console.log('[ExportBackup] Database verification passed');
    
  } catch (error: any) {
    // Restore failed, revert to safeguard
    console.error('[ExportBackup] Restore failed, reverting:', error.message);
    fs.copyFileSync(safeguardPath, DB_PATH);
    throw new Error(`Restore failed: ${error.message}`);
  }
}

/**
 * List available backups
 */
export async function listBackups(): Promise<Array<{ filename: string; path: string; size: number; created: Date; metadata?: BackupMetadata }>> {
  const files = fs.readdirSync(BACKUP_DIR);
  const backupFiles = files.filter(f => f.endsWith('.db'));
  
  const backups = backupFiles.map(filename => {
    const filepath = path.join(BACKUP_DIR, filename);
    const stats = fs.statSync(filepath);
    
    // Try to load metadata
    const metadataPath = filepath.replace('.db', '.json');
    let metadata: BackupMetadata | undefined;
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      } catch {}
    }
    
    return {
      filename,
      path: filepath,
      size: stats.size,
      created: stats.mtime,
      metadata
    };
  });
  
  // Sort by created date, newest first
  backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  
  return backups;
}

/**
 * Delete old backups (keep last N)
 */
export async function cleanupOldBackups(keepCount: number = 10): Promise<number> {
  const backups = await listBackups();
  
  if (backups.length <= keepCount) {
    return 0;
  }
  
  const toDelete = backups.slice(keepCount);
  let deletedCount = 0;
  
  for (const backup of toDelete) {
    try {
      fs.unlinkSync(backup.path);
      
      // Also delete metadata file if it exists
      const metadataPath = backup.path.replace('.db', '.json');
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
      
      deletedCount++;
    } catch (error: any) {
      console.error('[ExportBackup] Failed to delete backup:', backup.filename, error.message);
    }
  }
  
  console.log('[ExportBackup] Cleaned up', deletedCount, 'old backups');
  return deletedCount;
}

/**
 * Import tasks from JSON export
 */
export async function importTasks(filepath: string): Promise<{ imported: number; skipped: number; errors: number }> {
  console.log('[ExportBackup] Importing tasks from:', filepath);
  
  if (!fs.existsSync(filepath)) {
    throw new Error('Import file not found');
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  let data: any;
  
  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
  
  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid export format: missing tasks array');
  }
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const task of data.tasks) {
    try {
      // Check if task already exists
      const existing = await queryDb(`SELECT id FROM tasks WHERE id='${task.id}'`);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      // Insert task
      const fields = Object.keys(task).filter(k => task[k] !== undefined && task[k] !== null);
      const values = fields.map(k => {
        const value = task[k];
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        }
        return value;
      });
      
      const insertQuery = `
        INSERT INTO tasks (${fields.join(', ')})
        VALUES (${values.join(', ')})
      `;
      
      await execPromise(`sqlite3 "${DB_PATH}" "${insertQuery}"`);
      imported++;
      
    } catch (error: any) {
      console.error('[ExportBackup] Failed to import task:', task.id, error.message);
      errors++;
    }
  }
  
  // Import subtasks if available
  if (data.subtasks && Array.isArray(data.subtasks)) {
    for (const subtask of data.subtasks) {
      try {
        const fields = Object.keys(subtask).filter(k => subtask[k] !== undefined && subtask[k] !== null);
        const values = fields.map(k => {
          const value = subtask[k];
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          return value;
        });
        
        const insertQuery = `
          INSERT OR IGNORE INTO subtasks (${fields.join(', ')})
          VALUES (${values.join(', ')})
        `;
        
        await execPromise(`sqlite3 "${DB_PATH}" "${insertQuery}"`);
      } catch (error: any) {
        console.error('[ExportBackup] Failed to import subtask:', error.message);
      }
    }
  }
  
  console.log('[ExportBackup] Import complete:', { imported, skipped, errors });
  return { imported, skipped, errors };
}

/**
 * Get export/backup statistics
 */
export async function getStats(): Promise<{
  backupCount: number;
  totalBackupSize: number;
  lastBackupDate: Date | null;
  exportCount: number;
  databaseSize: number;
}> {
  const backups = await listBackups();
  const totalBackupSize = backups.reduce((sum, b) => sum + b.size, 0);
  const lastBackupDate = backups.length > 0 ? backups[0].created : null;
  
  const exportFiles = fs.readdirSync(EXPORT_DIR);
  const exportCount = exportFiles.filter(f => f.endsWith('.json') || f.endsWith('.csv')).length;
  
  let databaseSize = 0;
  if (fs.existsSync(DB_PATH)) {
    databaseSize = fs.statSync(DB_PATH).size;
  }
  
  return {
    backupCount: backups.length,
    totalBackupSize,
    lastBackupDate,
    exportCount,
    databaseSize
  };
}
