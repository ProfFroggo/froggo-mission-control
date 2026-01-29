import { ipcMain } from 'electron';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.homedir(), 'Froggo', 'clawd', 'data', 'froggo.db');

// Helper to execute SQL queries
function query(sql: string, params: any[] = []): any {
  try {
    const escapedParams = params.map(p => 
      typeof p === 'string' ? `'${p.replace(/'/g, "''")}'` : p
    );
    const fullSql = sql.replace(/\?/g, () => String(escapedParams.shift()));
    
    const result = execSync(
      `sqlite3 "${DB_PATH}" "${fullSql}"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    return result.trim();
  } catch (e: any) {
    console.error('[x-automations] Query error:', e.message);
    throw e;
  }
}

// Helper to parse JSON output from SQLite
function queryJSON(sql: string): any[] {
  try {
    const result = execSync(
      `sqlite3 -json "${DB_PATH}" "${sql}"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    const trimmed = result.trim();
    if (!trimmed || trimmed === '[]') return [];
    
    return JSON.parse(trimmed);
  } catch (e: any) {
    console.error('[x-automations] JSON query error:', e.message);
    return [];
  }
}

// Generate ID
function generateId(): string {
  return `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// List all automations
export function listAutomations() {
  const automations = queryJSON(
    'SELECT * FROM x_automations ORDER BY created_at DESC'
  );
  return { success: true, automations };
}

// Get single automation
export function getAutomation(id: string) {
  const automations = queryJSON(
    `SELECT * FROM x_automations WHERE id = '${id}'`
  );
  
  if (automations.length === 0) {
    return { success: false, error: 'Automation not found' };
  }
  
  return { success: true, automation: automations[0] };
}

// Create automation
export function createAutomation(data: {
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: string;
  conditions?: string;
  actions: string;
  max_executions_per_hour?: number;
  max_executions_per_day?: number;
}) {
  const id = generateId();
  const now = Date.now();
  
  const sql = `
    INSERT INTO x_automations (
      id, name, description, enabled,
      trigger_type, trigger_config, conditions, actions,
      max_executions_per_hour, max_executions_per_day,
      total_executions, created_at, updated_at, created_by
    ) VALUES (
      '${id}',
      '${data.name.replace(/'/g, "''")}',
      '${(data.description || '').replace(/'/g, "''")}',
      1,
      '${data.trigger_type}',
      '${data.trigger_config.replace(/'/g, "''")}',
      '${(data.conditions || '[]').replace(/'/g, "''")}',
      '${data.actions.replace(/'/g, "''")}',
      ${data.max_executions_per_hour || 10},
      ${data.max_executions_per_day || 50},
      0,
      ${now},
      ${now},
      'user'
    )
  `;
  
  try {
    query(sql);
    return { success: true, id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Update automation
export function updateAutomation(id: string, updates: {
  name?: string;
  description?: string;
  trigger_type?: string;
  trigger_config?: string;
  conditions?: string;
  actions?: string;
  max_executions_per_hour?: number;
  max_executions_per_day?: number;
}) {
  const setParts: string[] = [];
  
  if (updates.name !== undefined) {
    setParts.push(`name = '${updates.name.replace(/'/g, "''")}'`);
  }
  if (updates.description !== undefined) {
    setParts.push(`description = '${updates.description.replace(/'/g, "''")}'`);
  }
  if (updates.trigger_type !== undefined) {
    setParts.push(`trigger_type = '${updates.trigger_type}'`);
  }
  if (updates.trigger_config !== undefined) {
    setParts.push(`trigger_config = '${updates.trigger_config.replace(/'/g, "''")}'`);
  }
  if (updates.conditions !== undefined) {
    setParts.push(`conditions = '${updates.conditions.replace(/'/g, "''")}'`);
  }
  if (updates.actions !== undefined) {
    setParts.push(`actions = '${updates.actions.replace(/'/g, "''")}'`);
  }
  if (updates.max_executions_per_hour !== undefined) {
    setParts.push(`max_executions_per_hour = ${updates.max_executions_per_hour}`);
  }
  if (updates.max_executions_per_day !== undefined) {
    setParts.push(`max_executions_per_day = ${updates.max_executions_per_day}`);
  }
  
  setParts.push(`updated_at = ${Date.now()}`);
  
  const sql = `UPDATE x_automations SET ${setParts.join(', ')} WHERE id = '${id}'`;
  
  try {
    query(sql);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Delete automation
export function deleteAutomation(id: string) {
  try {
    query(`DELETE FROM x_automations WHERE id = '${id}'`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Toggle automation enabled/disabled
export function toggleAutomation(id: string, enabled: boolean) {
  try {
    query(`UPDATE x_automations SET enabled = ${enabled ? 1 : 0}, updated_at = ${Date.now()} WHERE id = '${id}'`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get executions
export function getExecutions(automationId?: string, limit: number = 50) {
  let sql = 'SELECT * FROM x_automation_executions';
  
  if (automationId) {
    sql += ` WHERE automation_id = '${automationId}'`;
  }
  
  sql += ` ORDER BY executed_at DESC LIMIT ${limit}`;
  
  const executions = queryJSON(sql);
  return { success: true, executions };
}

// Get rate limit status
export function getRateLimit(automationId: string) {
  const hourBucket = new Date().toISOString().substring(0, 13); // YYYY-MM-DD-HH
  
  const result = queryJSON(
    `SELECT execution_count FROM x_automation_rate_limits 
     WHERE automation_id = '${automationId}' AND hour_bucket = '${hourBucket}'`
  );
  
  const currentHour = result.length > 0 ? result[0].execution_count : 0;
  
  // Get today's total
  const todayBucket = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const todayResult = queryJSON(
    `SELECT SUM(execution_count) as total FROM x_automation_rate_limits 
     WHERE automation_id = '${automationId}' AND hour_bucket LIKE '${todayBucket}%'`
  );
  
  const currentDay = todayResult.length > 0 ? todayResult[0].total || 0 : 0;
  
  return { 
    success: true, 
    currentHour, 
    currentDay 
  };
}

// Register IPC handlers
export function registerXAutomationsHandlers() {
  ipcMain.handle('x-automations:list', async () => {
    return listAutomations();
  });
  
  ipcMain.handle('x-automations:get', async (_, id: string) => {
    return getAutomation(id);
  });
  
  ipcMain.handle('x-automations:create', async (_, data) => {
    return createAutomation(data);
  });
  
  ipcMain.handle('x-automations:update', async (_, id: string, updates) => {
    return updateAutomation(id, updates);
  });
  
  ipcMain.handle('x-automations:delete', async (_, id: string) => {
    return deleteAutomation(id);
  });
  
  ipcMain.handle('x-automations:toggle', async (_, id: string, enabled: boolean) => {
    return toggleAutomation(id, enabled);
  });
  
  ipcMain.handle('x-automations:executions', async (_, automationId?: string, limit?: number) => {
    return getExecutions(automationId, limit);
  });
  
  ipcMain.handle('x-automations:rate-limit', async (_, automationId: string) => {
    return getRateLimit(automationId);
  });
  
  console.log('[x-automations] IPC handlers registered');
}
