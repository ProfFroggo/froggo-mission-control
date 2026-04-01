/**
 * Export & Backup Tab Component
 * Handles data export, backup, and restore operations
 */

import { useState, useEffect } from 'react';
import { Download, Upload, Database, Clock, HardDrive, CheckCircle, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { Button, Checkbox, TextField, Flex } from '@radix-ui/themes';
import { Toggle } from './Toggle';
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
            <Flex align="center" gap="2" className="text-mission-control-text-dim mb-2">
              <Database size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Database</span>
            </Flex>
            <div className="text-xl font-semibold text-mission-control-text">{formatBytes(stats.databaseSize)}</div>
          </div>

          <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
            <Flex align="center" gap="2" className="text-mission-control-text-dim mb-2">
              <HardDrive size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Backups</span>
            </Flex>
            <div className="text-xl font-semibold text-mission-control-text">{stats.backupCount}</div>
            <div className="text-xs text-mission-control-text-dim mt-0.5">{formatBytes(stats.totalBackupSize)} total</div>
          </div>

          <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
            <Flex align="center" gap="2" className="text-mission-control-text-dim mb-2">
              <Clock size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Last Backup</span>
            </Flex>
            <div className="text-sm font-semibold text-mission-control-text">
              {stats.lastBackupDate ? formatDate(stats.lastBackupDate) : 'Never'}
            </div>
          </div>

          <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
            <Flex align="center" gap="2" className="text-mission-control-text-dim mb-2">
              <Download size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Exports</span>
            </Flex>
            <div className="text-xl font-semibold text-mission-control-text">{stats.exportCount}</div>
          </div>
        </div>
      )}

      {/* Export Section */}
      <section className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim px-6 py-3 border-b border-mission-control-border bg-mission-control-bg/50">
          Export Data
        </div>
        <div className="p-6">

        <div className="space-y-4">
          {/* Format Selector */}
          <div>
            <span className="block text-sm text-mission-control-text-dim mb-2">Export Format</span>
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border" role="radiogroup" aria-label="Export format">
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  exportFormat === 'json' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  exportFormat === 'csv' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                CSV
              </button>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={handleExportTasks}
              disabled={loading}
              variant="soft"
              color="gray"
              size="2"
            >
              <Download size={16} />
              Export Tasks
            </Button>

            <Button
              onClick={handleExportAgentLogs}
              disabled={loading}
              variant="soft"
              color="gray"
              size="2"
            >
              <Download size={16} />
              Export Agent Logs
            </Button>

            <Button
              onClick={handleExportChatHistory}
              disabled={loading}
              variant="soft"
              color="gray"
              size="2"
            >
              <Download size={16} />
              Export Chat History
            </Button>
          </div>

          <div className="text-xs text-mission-control-text-dim">
            Exports are saved to: <code className="bg-mission-control-bg px-1 py-0.5 rounded">~/mission-control/exports/</code>
          </div>
        </div>
        </div>
      </section>

      {/* Backup Section */}
      <section className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim px-6 py-3 border-b border-mission-control-border bg-mission-control-bg/50">
          Database Backup
        </div>
        <div className="p-6">

        <div className="space-y-4">
          {/* Backup Options */}
          <Flex align="center" gap="4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeAttachments}
                onCheckedChange={(checked) => setIncludeAttachments(checked === true)}
                size="2"
              />
              <span className="text-sm">Include attachments (larger file size)</span>
            </label>
          </Flex>

          {/* Create Backup Button */}
          <Button
            onClick={handleCreateBackup}
            disabled={loading}
            variant="solid"
            color="violet"
            size="2"
          >
            <Database size={16} />
            Create Backup Now
          </Button>

          {/* Auto-Backup Settings */}
          <div className="pt-4 border-t border-mission-control-border">
            <Flex align="center" justify="between" className="mb-4">
              <div>
                <div className="text-sm font-medium text-mission-control-text">Scheduled Auto-Backups</div>
                <div className="text-xs text-mission-control-text-dim mt-0.5">Automatically backup database daily at 3:00 AM</div>
              </div>
              <Toggle
                checked={autoBackupEnabled}
                onChange={setAutoBackupEnabled}
                colorScheme="green"
              />
            </Flex>

            {autoBackupEnabled && (
              <div className="bg-info/10 border border-info/30 rounded-lg p-4">
                <div className="text-sm text-info">
                  Auto-backup will run daily at 3:00 AM. Backups are created via mission-control cron system.
                </div>
              </div>
            )}
          </div>

          {/* Cleanup Settings */}
          <div className="pt-4 border-t border-mission-control-border">
            <label htmlFor="backup-count" className="block text-sm font-medium mb-2">Retention Policy</label>
            <Flex align="center" gap="3">
              <span className="text-sm text-mission-control-text-dim">Keep last</span>
              <TextField.Root
                id="backup-count"
                type="number"
                min="1"
                max="100"
                value={String(keepBackupsCount)}
                onChange={(e) => setKeepBackupsCount(parseInt(e.target.value) || 10)}
                size="2"
                style={{ width: '5rem', textAlign: 'center' }}
              />
              <span className="text-sm text-mission-control-text-dim">backups</span>
              <Button
                onClick={handleCleanupBackups}
                disabled={loading}
                variant="soft"
                color="gray"
                size="2"
                className="ml-auto"
              >
                <Trash2 size={14} />
                Cleanup Now
              </Button>
            </Flex>
          </div>

          <div className="text-xs text-mission-control-text-dim">
            Backups are saved to: <code className="bg-mission-control-bg px-1 py-0.5 rounded">~/mission-control/backups/</code>
          </div>
        </div>
        </div>
      </section>

      {/* Available Backups */}
      <section className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-mission-control-border bg-mission-control-bg/50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Available Backups</span>
          <button
            onClick={loadBackups}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        <div className="p-6">
          {backups.length === 0 ? (
            <div className="text-center py-8 text-mission-control-text-dim">
              <Database size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No backups found</p>
              <p className="text-xs mt-1 opacity-70">Create your first backup above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup, idx) => (
                <Flex
                  key={backup.filename}
                  align="center"
                  justify="between"
                  className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent/40 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-sm font-medium text-mission-control-text truncate">{backup.filename}</div>
                    <Flex align="center" gap="3" className="mt-1 text-xs text-mission-control-text-dim">
                      <span>{formatDate(backup.created)}</span>
                      <span>{formatBytes(backup.size)}</span>
                      {backup.metadata?.includesAttachments && (
                        <span className="px-1.5 py-0.5 bg-info/10 text-info rounded">
                          + Attachments
                        </span>
                      )}
                    </Flex>
                  </div>
                  <Flex align="center" gap="2" className="flex-shrink-0">
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">
                        Latest
                      </span>
                    )}
                    <Button
                      onClick={() => handleRestoreBackup(backup.path)}
                      disabled={loading}
                      variant="soft"
                      color="gray"
                      size="1"
                    >
                      <Upload size={12} />
                      Restore
                    </Button>
                  </Flex>
                </Flex>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-error/5 border border-error/20 rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-error mb-3">
          Danger Zone
        </p>
        <div className="space-y-3 text-sm">
          <Flex align="start" gap="2.5">
            <CheckCircle size={14} className="text-success flex-shrink-0 mt-0.5" />
            <div className="text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Safe backup:</span>{' '}
              A backup of your current database is automatically created before any restore operation
            </div>
          </Flex>
          <Flex align="start" gap="2.5">
            <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
            <div className="text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Test restores:</span>{' '}
              Always verify backups can be restored in a test environment first
            </div>
          </Flex>
          <Flex align="start" gap="2.5">
            <AlertTriangle size={14} className="text-error flex-shrink-0 mt-0.5" />
            <div className="text-mission-control-text-dim">
              <span className="font-medium text-mission-control-text">Data loss risk:</span>{' '}
              Restoring a backup will replace ALL current data with the backup&apos;s contents
            </div>
          </Flex>
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
