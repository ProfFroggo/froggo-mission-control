/**
 * Export & Backup Tab Component
 * Handles data export, backup, and restore operations
 */

import { useState, useEffect } from 'react';
import { Download, Upload, Database, Clock, HardDrive, CheckCircle, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { taskApi, agentApi, chatApi, settingsApi } from '../lib/api';

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  // Load backups and stats on mount
  useEffect(() => {
    loadBackups();
    loadStats();
  }, []);

  const loadBackups = async () => {
    try {
      const result = await settingsApi.get('backups.list').catch(() => null);
      const backupList = result?.value || result?.backups || [];
      setBackups(Array.isArray(backupList) ? backupList as BackupInfo[] : []);
    } catch (error) {
      // '[ExportBackup] Failed to load backups:', error;
    }
  };

  const loadStats = async () => {
    try {
      const result = await settingsApi.get('backups.stats').catch(() => null);
      if (result?.value || result?.stats) {
        setStats(result.value || result.stats);
      }
    } catch (error) {
      // '[ExportBackup] Failed to load stats:', error;
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
      const tasks = await taskApi.getAll();
      const data = Array.isArray(tasks) ? tasks : (tasks?.tasks || []);
      const filename = `tasks-export-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      if (exportFormat === 'csv') {
        downloadCSV(data, filename);
      } else {
        downloadJSON(data, filename);
      }
      showToast('success', 'Tasks Exported', `Downloaded as ${filename}`);
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
      const agents = await agentApi.getAll();
      const data = Array.isArray(agents) ? agents : (agents?.agents || []);
      const filename = `agent-logs-export-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      if (exportFormat === 'csv') {
        downloadCSV(data, filename);
      } else {
        downloadJSON(data, filename);
      }
      showToast('success', 'Agent Logs Exported', `Downloaded as ${filename}`);
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
      const sessions = await chatApi.getSessions();
      const sessionList = Array.isArray(sessions) ? sessions : (sessions?.sessions || []);
      const filename = `chat-history-export-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      if (exportFormat === 'csv') {
        downloadCSV(sessionList, filename);
      } else {
        downloadJSON(sessionList, filename);
      }
      showToast('success', 'Chat History Exported', `Downloaded as ${filename}`);
    } catch (error) {
      showToast('error', 'Export Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Create Backup (downloads full data dump as JSON)
  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const [tasks, agents, sessions, settings] = await Promise.all([
        taskApi.getAll().catch(() => []),
        agentApi.getAll().catch(() => []),
        chatApi.getSessions().catch(() => []),
        settingsApi.getAll().catch(() => ({})),
      ]);
      const backup = { tasks, agents, sessions, settings, timestamp: new Date().toISOString(), version: '1.0' };
      const filename = `mission-control-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadJSON(backup, filename);
      showToast('success', 'Backup Created', `Downloaded as ${filename}`);
    } catch (error) {
      showToast('error', 'Backup Failed', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  // Restore Backup (stubbed for web - no file dialog)
  const handleRestoreBackup = async (_backupPath: string) => {
    showConfirm({
      title: 'Restore Backup',
      message: 'Backup restore from browser is not yet supported. Please use the CLI or server-side tools.',
      confirmLabel: 'OK',
      type: 'danger',
    }, async () => {
      showToast('info', 'Not available', 'Restore is not supported in web mode');
    });
  };

  // Cleanup Old Backups (stubbed for web)
  const handleCleanupBackups = async () => {
    showConfirm({
      title: 'Cleanup Backups',
      message: `Backup cleanup is managed server-side. This action is not available in web mode.`,
      confirmLabel: 'OK',
      type: 'danger',
    }, async () => {
      showToast('info', 'Not available', 'Cleanup is managed server-side');
    });
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-2">
              <Database size={16} />
              <span className="text-sm">Database Size</span>
            </div>
            <div className="text-2xl font-semibold">{formatBytes(stats.databaseSize)}</div>
          </div>
          
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-2">
              <HardDrive size={16} />
              <span className="text-sm">Backups</span>
            </div>
            <div className="text-2xl font-semibold">{stats.backupCount}</div>
            <div className="text-xs text-mission-control-text-dim">{formatBytes(stats.totalBackupSize)} total</div>
          </div>
          
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-2">
              <Clock size={16} />
              <span className="text-sm">Last Backup</span>
            </div>
            <div className="text-sm font-semibold">
              {stats.lastBackupDate ? formatDate(stats.lastBackupDate) : 'Never'}
            </div>
          </div>
          
          <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
            <div className="flex items-center gap-2 text-mission-control-text-dim mb-2">
              <Download size={16} />
              <span className="text-sm">Exports</span>
            </div>
            <div className="text-2xl font-semibold">{stats.exportCount}</div>
          </div>
        </div>
      )}

      {/* Export Section */}
      <section className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6">
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Download size={20} />
          Export Data
        </h2>
        
        <div className="space-y-4">
          {/* Format Selector */}
          <div>
            <span className="block text-sm text-mission-control-text-dim mb-2">Export Format</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Export format">
              <button
                onClick={() => setExportFormat('json')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  exportFormat === 'json'
                    ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-accent/50'
                }`}
              >
                JSON
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  exportFormat === 'csv'
                    ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-accent/50'
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
              className="flex items-center justify-center gap-2 px-4 py-3 bg-mission-control-bg hover:bg-mission-control-surface border border-mission-control-border rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Export Tasks
            </button>
            
            <button
              onClick={handleExportAgentLogs}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-mission-control-bg hover:bg-mission-control-surface border border-mission-control-border rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Export Agent Logs
            </button>
            
            <button
              onClick={handleExportChatHistory}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-mission-control-bg hover:bg-mission-control-surface border border-mission-control-border rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              Export Chat History
            </button>
          </div>

          <div className="text-xs text-mission-control-text-dim">
            Exports are saved to: <code className="bg-mission-control-bg px-1 py-0.5 rounded">~/mission-control/exports/</code>
          </div>
        </div>
      </section>

      {/* Backup Section */}
      <section className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6">
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
                className="w-4 h-4 rounded border-mission-control-border bg-mission-control-bg checked:bg-mission-control-accent"
              />
              <span className="text-sm">Include attachments (larger file size)</span>
            </label>
          </div>

          {/* Create Backup Button */}
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-mission-control-accent hover:bg-mission-control-accent/80 text-white rounded-lg transition-colors disabled:opacity-50 w-full md:w-auto"
          >
            <Database size={16} />
            Create Backup Now
          </button>

          {/* Auto-Backup Settings */}
          <div className="pt-4 border-t border-mission-control-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-medium">Scheduled Auto-Backups</div>
                <div className="text-sm text-mission-control-text-dim">Automatically backup database daily</div>
              </div>
              <button
                onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  autoBackupEnabled ? 'bg-mission-control-accent' : 'bg-mission-control-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-mission-control-text shadow transition-transform ${
                  autoBackupEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {autoBackupEnabled && (
              <div className="bg-info-subtle border border-info-border rounded-lg p-4">
                <div className="text-sm text-info">
                  Auto-backup will run daily at 3:00 AM. Backups are created via mission-control cron system.
                </div>
              </div>
            )}
          </div>

          {/* Cleanup Settings */}
          <div className="pt-4 border-t border-mission-control-border">
            <label htmlFor="backup-count" className="block text-sm font-medium mb-2">Retention Policy</label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-mission-control-text-dim">Keep last</span>
              <input
                id="backup-count"
                type="number"
                min="1"
                max="100"
                value={keepBackupsCount}
                onChange={(e) => setKeepBackupsCount(parseInt(e.target.value) || 10)}
                className="w-20 px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-center"
              />
              <span className="text-sm text-mission-control-text-dim">backups</span>
              <button
                onClick={handleCleanupBackups}
                disabled={loading}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-mission-control-bg hover:bg-mission-control-surface border border-mission-control-border rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                Cleanup Now
              </button>
            </div>
          </div>

          <div className="text-xs text-mission-control-text-dim">
            Backups are saved to: <code className="bg-mission-control-bg px-1 py-0.5 rounded">~/mission-control/backups/</code>
          </div>
        </div>
      </section>

      {/* Available Backups */}
      <section className="bg-mission-control-surface rounded-lg border border-mission-control-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Database size={20} />
            Available Backups
          </h2>
          <button
            onClick={loadBackups}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-mission-control-text-dim">
            <Database size={48} className="mx-auto mb-3 opacity-50" />
            <p>No backups found</p>
            <p className="text-sm mt-1">Create your first backup above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup, idx) => (
              <div
                key={backup.filename}
                className="flex items-center justify-between p-4 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">{backup.filename}</div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-mission-control-text-dim">
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
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-mission-control-accent/10 hover:bg-mission-control-accent/20 text-mission-control-accent rounded transition-colors disabled:opacity-50"
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
      <section className="bg-error-subtle border border-error-border rounded-lg p-6">
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

      <ConfirmDialog
        open={open}
        onClose={closeConfirm}
        onConfirm={onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        cancelLabel={config.cancelLabel}
        type={config.type}
      />
    </div>
  );
}
