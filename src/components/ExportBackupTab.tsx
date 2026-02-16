/**
 * Export & Backup Tab Component
 * Handles data export, backup, and restore operations
 */

import { useState, useEffect } from 'react';
import { Download, Upload, Database, Clock, HardDrive, CheckCircle, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { showToast } from './Toast';

interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  created: Date;
  metadata?: {
    timestamp: string;
    version: string;
    size: number;
    tables: string[];
    includesAttachments: boolean;
  };
}

interface ExportStats {
  backupCount: number;
  totalBackupSize: number;
  lastBackupDate: Date | null;
  exportCount: number;
  databaseSize: number;
}

export default function ExportBackupTab() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [keepBackupsCount, setKeepBackupsCount] = useState(10);

  // Load backups and stats on mount
  useEffect(() => {
    loadBackups();
    loadStats();
  }, []);

  const loadBackups = async () => {
    try {
      const result = await (window as any).clawdbot?.exportBackup?.listBackups();
      if (result?.success) {
        setBackups(result.backups);
      }
    } catch (error) {
      console.error('[ExportBackup] Failed to load backups:', error);
    }
  };

  const loadStats = async () => {
    try {
      const result = await (window as any).clawdbot?.exportBackup?.getStats();
      if (result?.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('[ExportBackup] Failed to load stats:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Export Tasks
  const handleExportTasks = async () => {
    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.exportBackup?.exportTasks({
        format: exportFormat,
        filters: {} // Could add filters UI later
      });
      
      if (result?.success) {
        showToast('success', 'Tasks Exported', `Saved to: ${result.filepath}`);
        loadStats();
      } else {
        showToast('error', 'Export Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Export Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Export Agent Logs
  const handleExportAgentLogs = async () => {
    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.exportBackup?.exportAgentLogs({
        format: exportFormat,
        filters: {}
      });
      
      if (result?.success) {
        showToast('success', 'Agent Logs Exported', `Saved to: ${result.filepath}`);
        loadStats();
      } else {
        showToast('error', 'Export Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Export Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Export Chat History
  const handleExportChatHistory = async () => {
    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.exportBackup?.exportChatHistory({
        format: exportFormat,
        filters: {}
      });
      
      if (result?.success) {
        showToast('success', 'Chat History Exported', `Saved to: ${result.filepath}`);
        loadStats();
      } else {
        showToast('error', 'Export Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Export Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Create Backup
  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.exportBackup?.createBackup({
        includeAttachments
      });
      
      if (result?.success) {
        showToast('success', 'Backup Created', `Saved to: ${result.filepath}`);
        loadBackups();
        loadStats();
      } else {
        showToast('error', 'Backup Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Backup Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Restore Backup
  const handleRestoreBackup = async (backupPath: string) => {
    if (!confirm('⚠️ This will replace your current database. Are you sure you want to restore from this backup?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.exportBackup?.restoreBackup(backupPath);
      
      if (result?.success) {
        showToast('success', 'Backup Restored', 'Database restored successfully. Refreshing...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showToast('error', 'Restore Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Restore Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Cleanup Old Backups
  const handleCleanupBackups = async () => {
    if (!confirm(`Delete all but the ${keepBackupsCount} most recent backups?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.exportBackup?.cleanupOldBackups(keepBackupsCount);
      
      if (result?.success) {
        showToast('success', 'Cleanup Complete', `Deleted ${result.deletedCount} old backups`);
        loadBackups();
        loadStats();
      } else {
        showToast('error', 'Cleanup Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Cleanup Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-clawd-surface rounded-lg border border-clawd-border p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-2">
              <Database size={16} />
              <span className="text-sm">Database Size</span>
            </div>
            <div className="text-2xl font-semibold">{formatBytes(stats.databaseSize)}</div>
          </div>
          
          <div className="bg-clawd-surface rounded-lg border border-clawd-border p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-2">
              <HardDrive size={16} />
              <span className="text-sm">Backups</span>
            </div>
            <div className="text-2xl font-semibold">{stats.backupCount}</div>
            <div className="text-xs text-clawd-text-dim">{formatBytes(stats.totalBackupSize)} total</div>
          </div>
          
          <div className="bg-clawd-surface rounded-lg border border-clawd-border p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-2">
              <Clock size={16} />
              <span className="text-sm">Last Backup</span>
            </div>
            <div className="text-sm font-semibold">
              {stats.lastBackupDate ? formatDate(stats.lastBackupDate) : 'Never'}
            </div>
          </div>
          
          <div className="bg-clawd-surface rounded-lg border border-clawd-border p-4">
            <div className="flex items-center gap-2 text-clawd-text-dim mb-2">
              <Download size={16} />
              <span className="text-sm">Exports</span>
            </div>
            <div className="text-2xl font-semibold">{stats.exportCount}</div>
          </div>
        </div>
      )}

      {/* Export Section */}
      <section className="bg-clawd-surface rounded-xl border border-clawd-border p-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Download size={20} />
          Export Data
        </h2>
        
        <div className="space-y-4">
          {/* Format Selector */}
          <div>
            <label className="block text-sm text-clawd-text-dim mb-2">Export Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('json')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  exportFormat === 'json'
                    ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                    : 'border-clawd-border text-clawd-text-dim hover:border-clawd-accent/50'
                }`}
              >
                JSON
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  exportFormat === 'csv'
                    ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                    : 'border-clawd-border text-clawd-text-dim hover:border-clawd-accent/50'
                }`}
              >
                CSV
              </button>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={handleExportTasks}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-clawd-bg hover:bg-clawd-surface border border-clawd-border rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Export Tasks
            </button>
            
            <button
              onClick={handleExportAgentLogs}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-clawd-bg hover:bg-clawd-surface border border-clawd-border rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Export Agent Logs
            </button>
            
            <button
              onClick={handleExportChatHistory}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-clawd-bg hover:bg-clawd-surface border border-clawd-border rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Export Chat History
            </button>
          </div>

          <div className="text-xs text-clawd-text-dim">
            Exports are saved to: <code className="bg-clawd-bg px-1 py-0.5 rounded">~/clawd/exports/</code>
          </div>
        </div>
      </section>

      {/* Backup Section */}
      <section className="bg-clawd-surface rounded-xl border border-clawd-border p-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <HardDrive size={20} />
          Database Backup
        </h2>
        
        <div className="space-y-4">
          {/* Backup Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                className="w-4 h-4 rounded border-clawd-border bg-clawd-bg checked:bg-clawd-accent"
              />
              <span className="text-sm">Include attachments (larger file size)</span>
            </label>
          </div>

          {/* Create Backup Button */}
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-clawd-accent hover:bg-clawd-accent/80 text-white rounded-lg transition-colors disabled:opacity-50 w-full md:w-auto"
          >
            <Database size={16} />
            Create Backup Now
          </button>

          {/* Auto-Backup Settings */}
          <div className="pt-4 border-t border-clawd-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-medium">Scheduled Auto-Backups</div>
                <div className="text-sm text-clawd-text-dim">Automatically backup database daily</div>
              </div>
              <button
                onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  autoBackupEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  autoBackupEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {autoBackupEnabled && (
              <div className="bg-info-subtle border border-blue-500/20 rounded-lg p-4">
                <div className="text-sm text-blue-300">
                  Auto-backup will run daily at 3:00 AM. Backups are created via Clawdbot cron system.
                </div>
              </div>
            )}
          </div>

          {/* Cleanup Settings */}
          <div className="pt-4 border-t border-clawd-border">
            <label className="block text-sm font-medium mb-2">Retention Policy</label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-clawd-text-dim">Keep last</span>
              <input
                type="number"
                min="1"
                max="100"
                value={keepBackupsCount}
                onChange={(e) => setKeepBackupsCount(parseInt(e.target.value) || 10)}
                className="w-20 px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-center"
              />
              <span className="text-sm text-clawd-text-dim">backups</span>
              <button
                onClick={handleCleanupBackups}
                disabled={loading}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-clawd-bg hover:bg-clawd-surface border border-clawd-border rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                Cleanup Now
              </button>
            </div>
          </div>

          <div className="text-xs text-clawd-text-dim">
            Backups are saved to: <code className="bg-clawd-bg px-1 py-0.5 rounded">~/clawd/backups/</code>
          </div>
        </div>
      </section>

      {/* Available Backups */}
      <section className="bg-clawd-surface rounded-xl border border-clawd-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Database size={20} />
            Available Backups
          </h2>
          <button
            onClick={loadBackups}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-clawd-text-dim hover:text-clawd-accent transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-clawd-text-dim">
            <Database size={48} className="mx-auto mb-3 opacity-50" />
            <p>No backups found</p>
            <p className="text-sm mt-1">Create your first backup above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup, idx) => (
              <div
                key={backup.filename}
                className="flex items-center justify-between p-4 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">{backup.filename}</div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-clawd-text-dim">
                    <span>{formatDate(backup.created)}</span>
                    <span>{formatBytes(backup.size)}</span>
                    {backup.metadata?.includesAttachments && (
                      <span className="text-xs px-2 py-0.5 bg-info-subtle text-info rounded">
                        + Attachments
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <span className="text-xs px-2 py-1 bg-success-subtle text-success rounded">
                      Latest
                    </span>
                  )}
                  <button
                    onClick={() => handleRestoreBackup(backup.path)}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-clawd-accent/10 hover:bg-clawd-accent/20 text-clawd-accent rounded transition-colors disabled:opacity-50"
                  >
                    <Upload size={14} />
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger Zone */}
      <section className="bg-error-subtle border border-red-500/20 rounded-xl p-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2 text-error">
          <AlertTriangle size={20} />
          Danger Zone
        </h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
            <div>
              <strong>Safe backup:</strong> A backup of your current database is automatically created before any restore operation
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <strong>Test restores:</strong> Always verify backups can be restored in a test environment first
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
            <div>
              <strong>Data loss risk:</strong> Restoring a backup will replace ALL current data with the backup&apos;s contents
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
