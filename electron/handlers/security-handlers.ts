/**
 * Security Handlers Module
 *
 * Channels: security:listKeys/addKey/deleteKey/listAuditLogs/
 * updateAuditLog/listAlerts/dismissAlert/runAudit
 *
 * 8 registerHandler calls total.
 */

import * as path from 'path';
import { execSync } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { getSecurityDb } from '../database';
import { safeLog } from '../logger';
import { SCRIPTS_DIR } from '../paths';

// Initialize security database tables
function initSecurityDB() {
  const secDb = getSecurityDb();
  secDb.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, service TEXT NOT NULL,
      key TEXT NOT NULL, created_at TEXT NOT NULL, last_used TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, severity TEXT NOT NULL,
      category TEXT NOT NULL, finding TEXT NOT NULL, details TEXT NOT NULL,
      recommendation TEXT, status TEXT DEFAULT 'open'
    );
    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, severity TEXT NOT NULL,
      message TEXT NOT NULL, source TEXT NOT NULL, dismissed INTEGER DEFAULT 0
    );
  `);
}

// Ensure DB exists on module load
initSecurityDB();

export function registerSecurityHandlers(): void {
  registerHandler('security:listKeys', async () => {
    try { const secDb = getSecurityDb(); return { success: true, keys: secDb.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() }; }
    catch (error: any) { safeLog.error('[Security] List keys error:', error); return { success: false, keys: [], error: error.message }; }
  });

  registerHandler('security:addKey', async (_event, key: { name: string; service: string; key: string }) => {
    try {
      const secDb = getSecurityDb();
      const id = `key-${Date.now()}`;
      secDb.prepare('INSERT INTO api_keys (id, name, service, key, created_at) VALUES (?, ?, ?, ?, ?)').run(id, key.name, key.service, key.key, new Date().toISOString());
      return { success: true, id };
    } catch (error: any) { safeLog.error('[Security] Add key error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('security:deleteKey', async (_event, keyId: string) => {
    try { const secDb = getSecurityDb(); secDb.prepare('DELETE FROM api_keys WHERE id = ?').run(keyId); return { success: true }; }
    catch (error: any) { safeLog.error('[Security] Delete key error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('security:listAuditLogs', async () => {
    try { const secDb = getSecurityDb(); return { success: true, logs: secDb.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all() }; }
    catch (error: any) { safeLog.error('[Security] List audit logs error:', error); return { success: false, logs: [], error: error.message }; }
  });

  registerHandler('security:updateAuditLog', async (_event, logId: string, updates: { status?: string }) => {
    try {
      if (!updates.status) return { success: false, error: 'No updates provided' };
      const secDb = getSecurityDb();
      secDb.prepare('UPDATE audit_logs SET status = ? WHERE id = ?').run(updates.status, logId);
      return { success: true };
    } catch (error: any) { safeLog.error('[Security] Update audit log error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('security:listAlerts', async () => {
    try { const secDb = getSecurityDb(); return { success: true, alerts: secDb.prepare('SELECT * FROM security_alerts WHERE dismissed = 0 ORDER BY timestamp DESC LIMIT 20').all() }; }
    catch (error: any) { safeLog.error('[Security] List alerts error:', error); return { success: false, alerts: [], error: error.message }; }
  });

  registerHandler('security:dismissAlert', async (_event, alertId: string) => {
    try { const secDb = getSecurityDb(); secDb.prepare('UPDATE security_alerts SET dismissed = 1 WHERE id = ?').run(alertId); return { success: true }; }
    catch (error: any) { safeLog.error('[Security] Dismiss alert error:', error); return { success: false, error: error.message }; }
  });

  registerHandler('security:runAudit', async () => {
    try {
      safeLog.log('[Security] Running AI security audit...');
      const scriptPath = path.join(SCRIPTS_DIR, 'security-audit.sh');
      const result = execSync(`bash "${scriptPath}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 60000 });
      const output = JSON.parse(result);
      const secDb = getSecurityDb();
      const now = new Date().toISOString();
      const insertFinding = secDb.prepare("INSERT INTO audit_logs (id, timestamp, severity, category, finding, details, recommendation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')");
      for (const finding of output.findings || []) {
        insertFinding.run(`audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, now, finding.severity, finding.category, finding.finding, finding.details, finding.recommendation || '');
      }
      const insertAlert = secDb.prepare('INSERT INTO security_alerts (id, timestamp, severity, message, source, dismissed) VALUES (?, ?, ?, ?, ?, 0)');
      for (const alert of output.alerts || []) {
        insertAlert.run(`alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, now, alert.severity, alert.message, alert.source);
      }
      return { success: true, findings: output.findings || [], alerts: output.alerts || [], summary: output.summary || 'Audit complete' };
    } catch (error: any) {
      safeLog.error('[Security] Run audit error:', error);
      return { success: false, error: error.message, findings: [], alerts: [] };
    }
  });
}
