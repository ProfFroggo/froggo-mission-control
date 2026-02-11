import { ipcMain } from 'electron';
import { prepare } from './database';

// Generate ID
function generateId(): string {
  return `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// List all automations
export function listAutomations() {
  try {
    const automations = prepare('SELECT * FROM x_automations ORDER BY created_at DESC').all();
    return { success: true, automations };
  } catch (e: any) {
    console.error('[x-automations] List error:', e.message);
    return { success: true, automations: [] };
  }
}

// Get single automation
export function getAutomation(id: string) {
  try {
    const automation = prepare('SELECT * FROM x_automations WHERE id = ?').get(id);
    if (!automation) {
      return { success: false, error: 'Automation not found' };
    }
    return { success: true, automation };
  } catch (e: any) {
    console.error('[x-automations] Get error:', e.message);
    return { success: false, error: e.message };
  }
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

  try {
    prepare(`
      INSERT INTO x_automations (
        id, name, description, enabled,
        trigger_type, trigger_config, conditions, actions,
        max_executions_per_hour, max_executions_per_day,
        total_executions, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'user')
    `).run(
      id,
      data.name,
      data.description || '',
      data.trigger_type,
      data.trigger_config,
      data.conditions || '[]',
      data.actions,
      data.max_executions_per_hour || 10,
      data.max_executions_per_day || 50,
      now,
      now
    );
    return { success: true, id };
  } catch (e: any) {
    console.error('[x-automations] Create error:', e.message);
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
  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }
  if (updates.trigger_type !== undefined) {
    setClauses.push('trigger_type = ?');
    params.push(updates.trigger_type);
  }
  if (updates.trigger_config !== undefined) {
    setClauses.push('trigger_config = ?');
    params.push(updates.trigger_config);
  }
  if (updates.conditions !== undefined) {
    setClauses.push('conditions = ?');
    params.push(updates.conditions);
  }
  if (updates.actions !== undefined) {
    setClauses.push('actions = ?');
    params.push(updates.actions);
  }
  if (updates.max_executions_per_hour !== undefined) {
    setClauses.push('max_executions_per_hour = ?');
    params.push(updates.max_executions_per_hour);
  }
  if (updates.max_executions_per_day !== undefined) {
    setClauses.push('max_executions_per_day = ?');
    params.push(updates.max_executions_per_day);
  }

  setClauses.push('updated_at = ?');
  params.push(Date.now());

  // WHERE id = ?
  params.push(id);

  try {
    prepare(`UPDATE x_automations SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
    return { success: true };
  } catch (e: any) {
    console.error('[x-automations] Update error:', e.message);
    return { success: false, error: e.message };
  }
}

// Delete automation
export function deleteAutomation(id: string) {
  try {
    prepare('DELETE FROM x_automations WHERE id = ?').run(id);
    return { success: true };
  } catch (e: any) {
    console.error('[x-automations] Delete error:', e.message);
    return { success: false, error: e.message };
  }
}

// Toggle automation enabled/disabled
export function toggleAutomation(id: string, enabled: boolean) {
  try {
    prepare('UPDATE x_automations SET enabled = ?, updated_at = ? WHERE id = ?').run(
      enabled ? 1 : 0,
      Date.now(),
      id
    );
    return { success: true };
  } catch (e: any) {
    console.error('[x-automations] Toggle error:', e.message);
    return { success: false, error: e.message };
  }
}

// Get executions
export function getExecutions(automationId?: string, limit: number = 50) {
  try {
    let executions: any[];
    if (automationId) {
      executions = prepare(
        'SELECT * FROM x_automation_executions WHERE automation_id = ? ORDER BY executed_at DESC LIMIT ?'
      ).all(automationId, limit);
    } else {
      executions = prepare(
        'SELECT * FROM x_automation_executions ORDER BY executed_at DESC LIMIT ?'
      ).all(limit);
    }
    return { success: true, executions };
  } catch (e: any) {
    console.error('[x-automations] Executions error:', e.message);
    return { success: true, executions: [] };
  }
}

// Get rate limit status
export function getRateLimit(automationId: string) {
  try {
    const hourBucket = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH

    const hourRow = prepare(
      'SELECT execution_count FROM x_automation_rate_limits WHERE automation_id = ? AND hour_bucket = ?'
    ).get(automationId, hourBucket) as any;

    const currentHour = hourRow ? hourRow.execution_count : 0;

    // Get today's total
    const todayBucket = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    const dayRow = prepare(
      'SELECT SUM(execution_count) as total FROM x_automation_rate_limits WHERE automation_id = ? AND hour_bucket LIKE ?'
    ).get(automationId, todayBucket + '%') as any;

    const currentDay = dayRow ? dayRow.total || 0 : 0;

    return {
      success: true,
      currentHour,
      currentDay
    };
  } catch (e: any) {
    console.error('[x-automations] Rate limit error:', e.message);
    return { success: true, currentHour: 0, currentDay: 0 };
  }
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
