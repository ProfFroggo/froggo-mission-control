/**
 * Task Handlers Module
 * 
 * All task-related IPC handlers:
 * - tasks:sync, tasks:update, tasks:list, tasks:search
 * - tasks:getWithProgress, tasks:start, tasks:complete
 * - tasks:delete, tasks:archiveDone, tasks:poke
 * - subtasks:list, subtasks:add, subtasks:update, subtasks:delete, subtasks:reorder
 * - activity:list, activity:add
 * - attachments:list, attachments:listAll
 */
import { ipcMain } from 'electron';
import { prepare } from './database';
import { safeLog } from './logger';
import { emitTaskEvent } from './events';

// Task row interface
interface TaskRow {
  id: string;
  title: string;
  description?: string;
  status: string;
  assigned_to?: string;
  project?: string;
  priority: string;
  created_at: number;
  updated_at: number;
  reviewerId?: string;
  due_date?: number;
  started_at?: number;
  completed_at?: number;
  tags?: string;
  planning_notes?: string;
  subtask_count?: number;
  completed_subtasks?: number;
  activity_count?: number;
}

// Subtask row interface
interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  completed: number;
  position: number;
  created_at: number;
  updated_at: number;
}

// Activity row interface
interface ActivityRow {
  id: number;
  task_id: string;
  action: string;
  message?: string;
  details?: string;
  agent_id?: string;
  timestamp: number;
}

// Attachment row interface
interface AttachmentRow {
  id: string;
  task_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  description?: string;
  created_at: number;
}

export function registerTaskHandlers(): void {
  // Task CRUD Operations
  ipcMain.handle('tasks:sync', handleTaskSync);
  ipcMain.handle('tasks:update', handleTaskUpdate);
  ipcMain.handle('tasks:list', handleTaskList);
  ipcMain.handle('tasks:search', handleTaskSearch);
  ipcMain.handle('tasks:getWithProgress', handleTaskGetWithProgress);
  ipcMain.handle('tasks:start', handleTaskStart);
  ipcMain.handle('tasks:complete', handleTaskComplete);
  ipcMain.handle('tasks:delete', handleTaskDelete);
  ipcMain.handle('tasks:archiveDone', handleTaskArchiveDone);
  ipcMain.handle('tasks:poke', handleTaskPoke);
  ipcMain.handle('tasks:pokeInternal', handleTaskPokeInternal);

  // Subtask Operations
  ipcMain.handle('subtasks:list', handleSubtaskList);
  ipcMain.handle('subtasks:add', handleSubtaskAdd);
  ipcMain.handle('subtasks:update', handleSubtaskUpdate);
  ipcMain.handle('subtasks:delete', handleSubtaskDelete);
  ipcMain.handle('subtasks:reorder', handleSubtaskReorder);

  // Activity Operations
  ipcMain.handle('activity:list', handleActivityList);
  ipcMain.handle('activity:add', handleActivityAdd);

  // Attachment Operations
  ipcMain.handle('attachments:list', handleAttachmentsList);
  ipcMain.handle('attachments:listAll', handleAttachmentsListAll);
}

// ============ TASK HANDLERS ============

async function handleTaskSync(_: Electron.IpcMainInvokeEvent, task: { 
  id: string; 
  title: string; 
  description?: string; 
  status?: string; 
  assignedTo?: string;
  project?: string;
  priority?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const now = Date.now();
    const taskData = {
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status || 'todo',
      assigned_to: task.assignedTo || null,
      project: task.project || null,
      priority: task.priority || 'p2',
      created_at: now,
      updated_at: now,
    };

    const stmt = prepare(`
      INSERT OR REPLACE INTO tasks 
      (id, title, description, status, assigned_to, project, priority, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      taskData.id,
      taskData.title,
      taskData.description,
      taskData.status,
      taskData.assigned_to,
      taskData.project,
      taskData.priority,
      taskData.created_at,
      taskData.updated_at
    );

    safeLog.log('[Tasks] Synced:', taskData.id);
    emitTaskEvent('task.created', taskData.id);
    return { success: true, id: taskData.id };
  } catch (error) {
    safeLog.error('[Tasks] Sync error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskUpdate(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  updates: {
    status?: string;
    assignedTo?: string;
    planningNotes?: string;
    reviewStatus?: string;
    reviewerId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const sqlFields: string[] = [];
    const params: unknown[] = [];
    
    if (updates.planningNotes !== undefined) {
      sqlFields.push('planning_notes = ?');
      params.push(updates.planningNotes);
    }
    
    if (updates.reviewStatus !== undefined) {
      sqlFields.push('reviewStatus = ?');
      params.push(updates.reviewStatus);
    }
    
    if (updates.reviewerId !== undefined) {
      sqlFields.push('reviewerId = ?');
      params.push(updates.reviewerId);
    }
    
    if (updates.status !== undefined) {
      sqlFields.push('status = ?');
      params.push(updates.status);
    }
    
    if (updates.assignedTo !== undefined) {
      sqlFields.push('assigned_to = ?');
      params.push(updates.assignedTo);
    }
    
    if (sqlFields.length > 0) {
      const now = Date.now();
      sqlFields.push('updated_at = ?');
      params.push(now);
      params.push(taskId);
      
      const result = prepare(
        `UPDATE tasks SET ${sqlFields.join(', ')} WHERE id = ?`
      ).run(...params);
      
      if (result.changes > 0) {
        safeLog.log('[Tasks] Updated:', taskId, updates);
        emitTaskEvent('task.updated', taskId);
        return { success: true };
      } else {
        safeLog.warn('[Tasks] Update: task not found:', taskId);
        return { success: false, error: 'Task not found' };
      }
    }
    
    return { success: true };
  } catch (error) {
    safeLog.error('[Tasks] Update error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskList(
  _: Electron.IpcMainInvokeEvent,
  status?: string
): Promise<{ success: boolean; tasks: TaskRow[]; totalDone?: number; totalArchived?: number; error?: string }> {
  try {
    const columns = 'id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, priority, due_date, last_agent_update, reviewerId, reviewStatus, planning_notes, cancelled, archived';
    let whereClause = '(cancelled IS NULL OR cancelled = 0) AND (archived IS NULL OR archived = 0)';
    const params: unknown[] = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const tasks = prepare(`
      SELECT ${columns}, 
        (SELECT MAX(timestamp) FROM task_activity WHERE task_id = tasks.id) as last_activity_at
      FROM tasks 
      WHERE ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT 500
    `).all(...params);

    const countResult = prepare(`SELECT COUNT(*) as count FROM tasks WHERE status='done' AND (cancelled IS NULL OR cancelled = 0)`).get() as { count: number };
    const totalDone = countResult.count;
    const totalArchived = totalDone - (tasks as TaskRow[]).filter((t) => t.status === 'done').length;

    return { success: true, tasks: tasks as TaskRow[], totalDone, totalArchived };
  } catch (error) {
    safeLog.error('[tasks:list] Error:', (error as Error).message);
    return { success: false, tasks: [] };
  }
}

async function handleTaskSearch(
  _: Electron.IpcMainInvokeEvent,
  query: string,
  includeArchived = true
): Promise<{ success: boolean; tasks: TaskRow[]; error?: string }> {
  try {
    const pattern = `%${query}%`;
    const archiveFilter = includeArchived ? '' : 'AND (archived IS NULL OR archived = 0)';
    
    const columns = 'id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, priority, due_date, last_agent_update, reviewerId, reviewStatus, planning_notes, cancelled, archived, started_at, tags';
    const tasks = prepare(`
      SELECT ${columns} FROM tasks
      WHERE (title LIKE ? OR description LIKE ?) ${archiveFilter}
      ORDER BY created_at DESC
      LIMIT 100
    `).all(pattern, pattern);

    return { success: true, tasks: tasks as TaskRow[] };
  } catch (error) {
    safeLog.error('[tasks:search] Error:', (error as Error).message);
    return { success: false, tasks: [] };
  }
}

async function handleTaskGetWithProgress(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; task?: Record<string, unknown>; error?: string }> {
  try {
    const taskColumns = 'id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, priority, due_date, last_agent_update, reviewerId, reviewStatus, planning_notes, cancelled, archived, started_at, tags, metadata, progress, gates_passed, gates_total, approval_required, approval_status, approved_by, approved_at, independent_review_required, independent_review_status, is_test, archived_at, attempted_agents, project_name, stage_number, stage_name, next_stage, parent_task_id, blocked_by, blocks_tasks';
    const task = prepare(`SELECT ${taskColumns} FROM tasks WHERE id = ?`).get(taskId) as TaskRow | undefined;
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const activityColumns = 'id, task_id, agent_id, action, message, details, timestamp';
    const subtaskColumns = 'id, task_id, title, description, completed, completed_at, completed_by, assigned_to, position, created_at, updated_at';
    const attachmentColumns = 'id, task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at, metadata';
    const progress = prepare(`SELECT ${activityColumns} FROM task_activity WHERE task_id = ? ORDER BY timestamp DESC`).all(taskId) as ActivityRow[];
    const subtasks = prepare(`SELECT ${subtaskColumns} FROM subtasks WHERE task_id = ? ORDER BY created_at ASC`).all(taskId) as SubtaskRow[];
    const attachments = prepare(`SELECT ${attachmentColumns} FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC`).all(taskId) as AttachmentRow[];

    return {
      success: true,
      task: { ...task, progress, subtasks, attachments }
    };
  } catch (error) {
    safeLog.error('[tasks:getWithProgress] Error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskStart(
  _: Electron.IpcMainInvokeEvent, 
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    const result = prepare(`
      UPDATE tasks SET status = 'in-progress', started_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, taskId);
    
    if (result.changes > 0) {
      safeLog.log('[Tasks] Started:', taskId);
      emitTaskEvent('task.started', taskId);
      return { success: true };
    }
    return { success: false, error: 'Task not found' };
  } catch (error: any) {
    safeLog.error('[Tasks] Start error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskComplete(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  outcome?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    const result = prepare(`
      UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ?, outcome = ? WHERE id = ?
    `).run(now, now, outcome || null, taskId);

    if (result.changes > 0) {
      safeLog.log('[Tasks] Completed:', taskId);
      emitTaskEvent('task.completed', taskId);
      return { success: true };
    }
    return { success: false, error: 'Task not found' };
  } catch (error) {
    safeLog.error('[Tasks] Complete error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskDelete(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Soft delete - mark as cancelled
    const result = prepare(`
      UPDATE tasks SET cancelled = 1, updated_at = ? WHERE id = ?
    `).run(Date.now(), taskId);

    if (result.changes > 0) {
      safeLog.log('[Tasks] Deleted (cancelled):', taskId);
      emitTaskEvent('task.deleted', taskId);
      return { success: true };
    }
    return { success: false, error: 'Task not found' };
  } catch (error) {
    safeLog.error('[Tasks] Delete error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskArchiveDone(): Promise<{ success: boolean; archived?: number; error?: string }> {
  try {
    const result = prepare(`
      UPDATE tasks SET archived = 1, updated_at = ?
      WHERE status = 'done' AND (archived IS NULL OR archived = 0)
    `).run(Date.now());

    safeLog.log('[Tasks] Archived done tasks:', result.changes);
    return { success: true, archived: result.changes };
  } catch (error) {
    safeLog.error('[Tasks] Archive error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskPoke(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  try {
    safeLog.log('[Tasks] Poke:', taskId, title);
    return { success: true };
  } catch (error) {
    safeLog.error('[Tasks] Poke error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleTaskPokeInternal(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  title: string
): Promise<{ success: boolean; error?: string }> {
  try {
    safeLog.log('[Tasks] Internal poke:', taskId, title);
    return { success: true };
  } catch (error) {
    safeLog.error('[Tasks] Internal poke error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// ============ SUBTASK HANDLERS ============

async function handleSubtaskList(
  _: Electron.IpcMainInvokeEvent, 
  taskId: string
): Promise<{ success: boolean; subtasks: SubtaskRow[]; error?: string }> {
  try {
    const subtasks = prepare('SELECT id, task_id, title, description, completed, completed_at, completed_by, assigned_to, position, created_at, updated_at FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as SubtaskRow[];
    return { success: true, subtasks };
  } catch (error) {
    safeLog.error('[Subtasks] List error:', (error as Error).message);
    return { success: false, subtasks: [] };
  }
}

async function handleSubtaskAdd(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  subtask: { id: string; title: string; description?: string; assignedTo?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    prepare(`
      INSERT INTO subtasks (id, task_id, title, description, assigned_to, created_at, completed)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(subtask.id, taskId, subtask.title, subtask.description || '', subtask.assignedTo || null, Date.now());

    safeLog.log('[Subtasks] Added:', subtask.id);
    emitTaskEvent('subtask.added', taskId);
    return { success: true };
  } catch (error) {
    safeLog.error('[Subtasks] Add error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleSubtaskUpdate(
  _: Electron.IpcMainInvokeEvent,
  subtaskId: string,
  updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
      if (updates.completed) {
        fields.push('completed_at = ?');
        params.push(Date.now());
      }
    }

    if (updates.completedBy !== undefined) {
      fields.push('completed_by = ?');
      params.push(updates.completedBy);
    }

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }

    if (updates.assignedTo !== undefined) {
      fields.push('assigned_to = ?');
      params.push(updates.assignedTo);
    }

    if (fields.length === 0) {
      return { success: true };
    }

    params.push(subtaskId);
    const result = prepare(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    if (result.changes > 0) {
      safeLog.log('[Subtasks] Updated:', subtaskId);
      return { success: true };
    }
    return { success: false, error: 'Subtask not found' };
  } catch (error) {
    safeLog.error('[Subtasks] Update error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleSubtaskDelete(
  _: Electron.IpcMainInvokeEvent,
  subtaskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);

    if (result.changes > 0) {
      safeLog.log('[Subtasks] Deleted:', subtaskId);
      return { success: true };
    }
    return { success: false, error: 'Subtask not found' };
  } catch (error) {
    safeLog.error('[Subtasks] Delete error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

async function handleSubtaskReorder(
  _: Electron.IpcMainInvokeEvent,
  subtaskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const stmt = prepare('UPDATE subtasks SET sort_order = ? WHERE id = ?');
    subtaskIds.forEach((id, index) => {
      stmt.run(index, id);
    });

    safeLog.log('[Subtasks] Reordered:', subtaskIds.length);
    return { success: true };
  } catch (error) {
    safeLog.error('[Subtasks] Reorder error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// ============ ACTIVITY HANDLERS ============

async function handleActivityList(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  limit?: number
): Promise<{ success: boolean; activity: ActivityRow[]; error?: string }> {
  try {
    const actCols = 'id, task_id, agent_id, action, message, details, timestamp';
    const sql = limit
      ? `SELECT ${actCols} FROM task_activity WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT ${actCols} FROM task_activity WHERE task_id = ? ORDER BY timestamp DESC`;
    const params = limit ? [taskId, limit] : [taskId];
    const activity = prepare(sql).all(...params) as ActivityRow[];

    return { success: true, activity };
  } catch (error) {
    safeLog.error('[Activity] List error:', (error as Error).message);
    return { success: false, activity: [] };
  }
}

async function handleActivityAdd(
  _: Electron.IpcMainInvokeEvent, 
  taskId: string, 
  entry: { action: string; message: string; agentId?: string; details?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    prepare(`
      INSERT INTO task_activity (id, task_id, action, message, agent_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `act-${Date.now()}`,
      taskId,
      entry.action,
      entry.message,
      entry.agentId || null,
      entry.details || null,
      Date.now()
    );
    
    safeLog.log('[Activity] Added:', entry.action);
    return { success: true };
  } catch (error) {
    safeLog.error('[Activity] Add error:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

// ============ ATTACHMENT HANDLERS ============

async function handleAttachmentsList(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; attachments: AttachmentRow[]; error?: string }> {
  try {
    const attCols = 'id, task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at, metadata';
    const attachments = prepare(`SELECT ${attCols} FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC`).all(taskId) as AttachmentRow[];
    return { success: true, attachments };
  } catch (error) {
    safeLog.error('[Attachments] List error:', (error as Error).message);
    return { success: false, attachments: [] };
  }
}

async function handleAttachmentsListAll(): Promise<{ success: boolean; attachments: AttachmentRow[]; error?: string }> {
  try {
    const attCols = 'id, task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at, metadata';
    const attachments = prepare(`SELECT ${attCols} FROM task_attachments ORDER BY created_at DESC LIMIT 1000`).all() as AttachmentRow[];
    return { success: true, attachments };
  } catch (error) {
    safeLog.error('[Attachments] ListAll error:', (error as Error).message);
    return { success: false, attachments: [] };
  }
}
