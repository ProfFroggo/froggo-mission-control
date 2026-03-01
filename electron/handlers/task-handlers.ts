/**
 * Task Handlers Module
 *
 * Task-domain IPC handlers extracted from main.ts:
 * - tasks:sync, tasks:update, tasks:list, tasks:search
 * - tasks:getWithProgress, tasks:start, tasks:complete, tasks:delete
 * - tasks:archiveDone, tasks:poke, tasks:pokeInternal
 * - subtasks:list, subtasks:add, subtasks:update, subtasks:delete, subtasks:reorder
 * - activity:list, activity:add
 * - attachments:list, attachments:listAll, attachments:add, attachments:delete
 * - attachments:open, attachments:auto-detect
 *
 * Plus 3 fork/hierarchy handlers from orphan task-handlers.ts:
 * - tasks:fork, tasks:children, tasks:parent
 *
 * 27 registerHandler calls total.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { shell } from 'electron';
import { registerHandler } from '../ipc-registry';
import { prepare, db } from '../database';
import { safeLog } from '../logger';
import { emitTaskEvent } from '../events';
import { SCRIPTS_DIR } from '../paths';
import { validateTaskId, validateFilePath, validateString } from '../ipc-validation';

// PATH env for child processes that call froggo-db or openclaw by name
const CHILD_ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };

// ── File category helpers (for attachments:listAll) ──────────────────────────

const VALID_FILE_CATEGORIES = ['marketing', 'design', 'dev', 'research', 'finance', 'test-logs', 'content', 'social', 'other'] as const;
type FileCategory = typeof VALID_FILE_CATEGORIES[number];

function inferFileCategory(filename: string, _mimeType?: string, taskTitle?: string, assignee?: string): FileCategory {
  const ext = path.extname(filename).toLowerCase();
  const name = filename.toLowerCase();

  // Unambiguous by extension
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.sh', '.sql', '.json', '.css', '.html', '.diff', '.patch'].includes(ext)) return 'dev';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.mov'].includes(ext)) return 'design';
  if (['.csv', '.xls', '.xlsx'].includes(ext)) return 'finance';
  if (['.zip', '.rar', '.7z'].includes(ext) || name.endsWith('.tar.gz')) return 'other';

  // Text-like files — use filename + task context keywords
  if (['.md', '.txt', '.pdf', '.doc', '.docx', '.draft'].includes(ext)) {
    const ctx = ` ${name.replace(/[_\-./]/g, ' ')} ${(taskTitle || '').replace(/[_\-./]/g, ' ').toLowerCase()} `;
    const agent = (assignee || '').toLowerCase();

    if (/\b(finance|budget|revenue|cost|invoice|expense)\b/.test(ctx)) return 'finance';
    if (/\b(marketing|growth|tweet|campaign|engagement|follower)\b/.test(ctx) || ctx.includes('content plan')) return 'marketing';
    if (/\b(design|wireframe|mockup|figma|layout|theme|modal)\b/.test(ctx) || /\bui\b|\bux\b|\bstyle\b/.test(ctx) || agent === 'designer') return 'design';
    if (/\b(test|qa|checklist|verification|e2e|playwright|benchmark|coverage)\b/.test(ctx)) return 'test-logs';
    if (/\b(research|analysis|investigation|audit|review|study)\b/.test(ctx)) return 'research';
    if (/\b(discord|telegram|twitter|instagram|social)\b/.test(ctx) || ctx.includes('x api') || ['social-manager', 'growth-director'].includes(agent)) return 'social';
    if (/\b(implementation|refactor|migration|schema|api|fix|bug|deploy|build|lint|react|electron)\b/.test(ctx) || ['coder', 'senior-coder'].includes(agent)) return 'dev';

    return 'content';
  }

  return 'other';
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerTaskHandlers(): void {
  // Task CRUD
  registerHandler('tasks:sync', handleTaskSync);
  registerHandler('tasks:update', handleTaskUpdate);
  registerHandler('tasks:list', handleTaskList);
  registerHandler('tasks:search', handleTaskSearch);
  registerHandler('tasks:getWithProgress', handleTaskGetWithProgress);
  registerHandler('tasks:start', handleTaskStart);
  registerHandler('tasks:complete', handleTaskComplete);
  registerHandler('tasks:delete', handleTaskDelete);
  registerHandler('tasks:archiveDone', handleTaskArchiveDone);
  registerHandler('tasks:poke', handleTaskPoke);
  registerHandler('tasks:pokeInternal', handleTaskPokeInternal);

  // Subtask Operations
  registerHandler('subtasks:list', handleSubtaskList);
  registerHandler('subtasks:add', handleSubtaskAdd);
  registerHandler('subtasks:update', handleSubtaskUpdate);
  registerHandler('subtasks:delete', handleSubtaskDelete);
  registerHandler('subtasks:reorder', handleSubtaskReorder);

  // Activity Operations
  registerHandler('activity:list', handleActivityList);
  registerHandler('activity:add', handleActivityAdd);

  // Attachment Operations
  registerHandler('attachments:list', handleAttachmentsList);
  registerHandler('attachments:listAll', handleAttachmentsListAll);
  registerHandler('attachments:add', handleAttachmentsAdd);
  registerHandler('attachments:delete', handleAttachmentsDelete);
  registerHandler('attachments:open', handleAttachmentsOpen);
  registerHandler('attachments:auto-detect', handleAttachmentsAutoDetect);

  // Fork / hierarchy (from orphan task-handlers.ts)
  registerHandler('tasks:fork', handleTaskFork);
  registerHandler('tasks:children', handleTaskChildren);
  registerHandler('tasks:parent', handleTaskParent);
}

// ── Task handlers ─────────────────────────────────────────────────────────────

async function handleTaskSync(
  _: Electron.IpcMainInvokeEvent,
  task: {
    id: string;
    title: string;
    status: string;
    project?: string;
    assignedTo?: string;
    description?: string;
    priority?: string;
    dueDate?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!validateTaskId(task.id)) return { success: false, error: 'Invalid task ID' };
  safeLog.log('[Tasks] Sync called with:', JSON.stringify(task));

  return new Promise((resolve) => {
    execFile('froggo-db', ['task-get', task.id], { timeout: 5000, env: CHILD_ENV }, (getError, getStdout) => {
      if (!getError && getStdout && getStdout.includes('"id"')) {
        safeLog.log('[Tasks] Task already exists:', task.id);
        resolve({ success: true });
        return;
      }

      try {
        const dueStr = task.dueDate ? new Date(task.dueDate).toISOString() : null;
        const nowMs = Date.now();

        prepare('INSERT OR REPLACE INTO tasks (id, title, description, status, project, assigned_to, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          task.id,
          task.title,
          task.description || '',
          task.status || 'todo',
          task.project || 'Default',
          task.assignedTo || '',
          task.priority || '',
          dueStr,
          nowMs,
          nowMs
        );

        safeLog.log('[Tasks] Created:', task.id);
        resolve({ success: true });
      } catch (err: any) {
        safeLog.error('[Tasks] Create error:', err.message);
        resolve({ success: false, error: err.message });
      }
    });
  });
}

async function handleTaskUpdate(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  updates: { status?: string; assignedTo?: string; planningNotes?: string; reviewStatus?: string; reviewerId?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const sqlFields: string[] = [];
    const params: any[] = [];

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

      const result = prepare(`UPDATE tasks SET ${sqlFields.join(', ')} WHERE id = ?`).run(...params);

      if (result.changes > 0) {
        safeLog.log('[Tasks] Updated via prepared statement:', taskId, updates);
        emitTaskEvent('task.updated', taskId);
        return { success: true };
      } else {
        safeLog.warn('[Tasks] Update: task not found:', taskId);
        return { success: false, error: 'Task not found' };
      }
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Tasks] Update error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleTaskList(
  _: Electron.IpcMainInvokeEvent,
  status?: string
): Promise<{ success: boolean; tasks: any[]; totalDone?: number; totalArchived?: number; error?: string }> {
  try {
    const columns = 'id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, priority, due_date, last_agent_update, reviewerId, reviewStatus, planning_notes, cancelled, archived';
    let whereClause = '(cancelled IS NULL OR cancelled = 0) AND (archived IS NULL OR archived = 0)';
    const params: any[] = [];

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

    const { 'COUNT(*)': totalDone } = prepare(`SELECT COUNT(*) FROM tasks WHERE status='done' AND (cancelled IS NULL OR cancelled = 0)`).get() as any;
    const totalArchived = totalDone - (tasks as any[]).filter((t: any) => t.status === 'done').length;

    return { success: true, tasks, totalDone, totalArchived };
  } catch (error: any) {
    safeLog.error('[tasks:list] Error:', error.message);
    return { success: false, tasks: [] };
  }
}

async function handleTaskSearch(
  _: Electron.IpcMainInvokeEvent,
  query: string,
  includeArchived = true
): Promise<{ success: boolean; tasks: any[]; error?: string }> {
  try {
    const pattern = `%${query}%`;
    const archiveFilter = includeArchived ? '' : 'AND (archived IS NULL OR archived = 0)';
    const tasks = prepare(`SELECT id, title, description, status, project, assigned_to, created_at, updated_at, completed_at, archived, cancelled FROM tasks WHERE (title LIKE ? OR description LIKE ? OR id LIKE ?) ${archiveFilter} ORDER BY updated_at DESC LIMIT 100`).all(pattern, pattern, pattern);
    return { success: true, tasks };
  } catch (error: any) {
    safeLog.error('[tasks:search] Error:', error.message);
    return { success: false, tasks: [] };
  }
}

async function handleTaskGetWithProgress(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; task?: any; error?: string }> {
  try {
    const task = prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    return { success: true, task: task || null };
  } catch (error: any) {
    safeLog.error('[tasks:getWithProgress] Error:', error.message);
    return { success: false, task: null };
  }
}

async function handleTaskStart(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  if (!validateTaskId(taskId)) return { success: false, error: 'Invalid task ID' };
  return new Promise((resolve) => {
    execFile('froggo-db', ['task-start', taskId], { timeout: 10000, env: CHILD_ENV }, (error) => {
      resolve({ success: !error });
    });
  });
}

async function handleTaskComplete(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  outcome?: string
): Promise<{ success: boolean; error?: string }> {
  if (!validateTaskId(taskId)) return { success: false, error: 'Invalid task ID' };
  if (outcome && !validateString(outcome, 500)) return { success: false, error: 'Invalid outcome' };
  return new Promise((resolve) => {
    const args = ['task-complete', taskId];
    if (outcome) args.push('--outcome', outcome);
    execFile('froggo-db', args, { timeout: 10000, env: CHILD_ENV }, (error) => {
      resolve({ success: !error });
    });
  });
}

async function handleTaskDelete(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  if (!validateTaskId(taskId)) return { success: false, error: 'Invalid task ID' };
  // Direct SQL: set cancelled=1 to soft-delete.
  // The enforce_valid_state_transitions trigger blocks 'cancelled' as a status value.
  // The cancelled column is the proper soft-delete mechanism.
  try {
    const now = Date.now();
    const result = prepare('UPDATE tasks SET cancelled = 1, updated_at = ? WHERE id = ?').run(now, taskId);

    if (result.changes > 0) {
      safeLog.log('[Tasks] Soft-deleted (cancelled=1):', taskId);
      return { success: true };
    } else {
      safeLog.warn('[Tasks] Delete: task not found:', taskId);
      return { success: false, error: 'Task not found' };
    }
  } catch (error: any) {
    safeLog.error('[Tasks] Delete error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleTaskArchiveDone(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const now = Date.now();

    const archive = db.transaction(() => {
      const result = prepare(
        'UPDATE tasks SET archived = 1, updated_at = ? WHERE status = ? AND (cancelled IS NULL OR cancelled = 0) AND (archived IS NULL OR archived = 0)'
      ).run(now, 'done');
      return result.changes;
    });

    const count = archive();
    safeLog.log(`[Tasks] Archived ${count} done tasks`);
    return { success: true, count };
  } catch (error: any) {
    safeLog.error('[Tasks] Archive done error:', error.message);
    return { success: false, error: error.message, count: 0 };
  }
}

async function handleTaskPoke(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  title: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  // Legacy handler kept for backwards compat — just logs internally now
  safeLog.log(`[Tasks] Poke (legacy): ${taskId} - ${title}`);
  return { success: true, message: `Poke registered for "${title}"` };
}

async function handleTaskPokeInternal(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  title: string
): Promise<{ success: boolean; agentId?: string; response?: string; sessionKey?: null; error?: string }> {
  if (!validateTaskId(taskId)) return { success: false, error: 'Invalid task ID' };
  safeLog.log(`[Tasks] Internal Poke: ${taskId} - ${title}`);

  try {
    const taskAgent = await new Promise<string>((resolve) => {
      execFile(
        'froggo-db', ['task-get', taskId],
        { encoding: 'utf-8', timeout: 5000, env: CHILD_ENV },
        (error, stdout) => {
          if (!error && stdout) {
            try {
              const taskData = JSON.parse(stdout);
              if (taskData.assigned_to) {
                resolve(taskData.assigned_to);
                return;
              }
            } catch (err) { safeLog.debug('[Poke] Failed to parse task data:', err); }
          }
          resolve('froggo');
        }
      );
    });

    const pokePrompt = `You are ${taskAgent} responding to a poke/nudge about a task. Be casual, direct, bit of humor - like texting a mate about work.
Task: "${title}" (ID: ${taskId})
The user is poking you to ask what's happening with this task. Give a brief, personality-driven status update.
Keep it SHORT (2-3 sentences max). This is a quick status check, not an essay.`;

    const response = await new Promise<string>((resolve, reject) => {
      execFile(
        'openclaw', ['agent', '--local', '--message', pokePrompt, '--agent', taskAgent, '--json', '--timeout', '30'],
        {
          encoding: 'utf-8',
          timeout: 35000,
          maxBuffer: 5 * 1024 * 1024,
          env: CHILD_ENV
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }

          safeLog.log(`[Tasks] Raw poke stdout length: ${stdout.length}`);

          try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : stdout;
            const result = JSON.parse(jsonStr);

            let text = '';
            if (result.payloads && Array.isArray(result.payloads) && result.payloads[0]?.text) {
              text = result.payloads[0].text;
            } else if (result.text) {
              text = result.text;
            } else if (typeof result === 'string') {
              text = result;
            } else {
              safeLog.warn('[Tasks] Could not extract text from JSON response');
              text = 'No response text';
            }

            resolve(text);
          } catch (_parseError) {
            safeLog.log('[Tasks] Not JSON, using raw output');
            const lines = stdout.trim().split('\n');
            const cleanLines = lines.filter((l: string) => !l.startsWith('[') && !l.includes('plugins'));
            resolve(cleanLines.join('\n').trim() || stdout.trim());
          }
        }
      );
    });

    safeLog.log(`[Tasks] Internal poke response from ${taskAgent}: ${response.slice(0, 100)}...`);
    return { success: true, agentId: taskAgent, response };
  } catch (e: any) {
    safeLog.error(`[Tasks] Internal poke error: ${e.message}`);
    return {
      success: true,
      sessionKey: null,
      response: `Couldn't reach the agent right now - they might be deep in something. Try again in a sec? (Error: ${e.message})`
    };
  }
}

// ── Subtask handlers ──────────────────────────────────────────────────────────

async function handleSubtaskList(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; subtasks: any[]; error?: string }> {
  try {
    const rows = prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY position, created_at').all(taskId);
    const subtasks = (rows as any[]).map((st: any) => ({
      id: st.id,
      taskId: st.task_id,
      title: st.title,
      description: st.description,
      completed: st.completed === 1,
      completedAt: st.completed_at,
      completedBy: st.completed_by,
      assignedTo: st.assigned_to,
      position: st.position,
      createdAt: st.created_at,
    }));
    return { success: true, subtasks };
  } catch (error: any) {
    safeLog.error('[Subtasks] List error:', error);
    return { success: false, subtasks: [] };
  }
}

async function handleSubtaskAdd(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  subtask: { id: string; title: string; description?: string; assignedTo?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  safeLog.log('[Subtasks] Add called:', { taskId, subtask });

  if (!taskId || !subtask?.id || !subtask?.title) {
    safeLog.error('[Subtasks] Invalid input:', { taskId, subtask });
    return { success: false, error: 'Invalid input: taskId, subtask.id, and subtask.title are required' };
  }

  try {
    const now = Date.now();

    const posResult = prepare('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM subtasks WHERE task_id = ?').get(taskId) as any;
    const position = posResult?.next_pos || 0;
    safeLog.log('[Subtasks] Position:', position);

    prepare('INSERT INTO subtasks (id, task_id, title, description, assigned_to, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      subtask.id,
      taskId,
      subtask.title,
      subtask.description || null,
      subtask.assignedTo || null,
      position,
      now,
      now
    );

    safeLog.log('[Subtasks] Insert success:', subtask.id);

    prepare('INSERT INTO task_activity (task_id, action, message, timestamp) VALUES (?, ?, ?, ?)').run(
      taskId,
      'subtask_added',
      `Added subtask: ${subtask.title}`,
      now
    );

    emitTaskEvent('task.updated', taskId);
    return { success: true, id: subtask.id };
  } catch (error: any) {
    safeLog.error('[Subtasks] Add error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleSubtaskUpdate(
  _: Electron.IpcMainInvokeEvent,
  subtaskId: string,
  updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (updates.completed !== undefined) {
      sets.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
      if (updates.completed) {
        sets.push('completed_at = ?');
        params.push(now);
        if (updates.completedBy) {
          sets.push('completed_by = ?');
          params.push(updates.completedBy);
        }
      } else {
        sets.push('completed_at = NULL');
        sets.push('completed_by = NULL');
      }
    }
    if (updates.title) {
      sets.push('title = ?');
      params.push(updates.title);
    }
    if (updates.assignedTo !== undefined) {
      sets.push('assigned_to = ?');
      params.push(updates.assignedTo || null);
    }

    params.push(subtaskId);
    prepare(`UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    if (updates.completed !== undefined) {
      const subtask = prepare('SELECT task_id, title FROM subtasks WHERE id = ?').get(subtaskId) as any;
      if (subtask?.task_id) {
        const action = updates.completed ? 'subtask_completed' : 'subtask_uncompleted';
        const message = updates.completed
          ? `Completed: ${subtask.title}${updates.completedBy ? ' by ' + updates.completedBy : ''}`
          : `Reopened: ${subtask.title}`;
        prepare('INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          subtask.task_id,
          action,
          message,
          updates.completedBy || null,
          now
        );
        emitTaskEvent('task.updated', subtask.task_id);
      }
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Subtasks] Update error:', error);
    return { success: false, error: error.message };
  }
}

async function handleSubtaskDelete(
  _: Electron.IpcMainInvokeEvent,
  subtaskId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const subtask = prepare('SELECT task_id, title FROM subtasks WHERE id = ?').get(subtaskId) as any;

    prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);

    if (subtask?.task_id) {
      const now = Date.now();
      prepare('INSERT INTO task_activity (task_id, action, message, timestamp) VALUES (?, ?, ?, ?)').run(
        subtask.task_id,
        'subtask_deleted',
        `Deleted subtask: ${subtask.title || ''}`,
        now
      );
      emitTaskEvent('task.updated', subtask.task_id);
    }

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Subtasks] Delete error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleSubtaskReorder(
  _: Electron.IpcMainInvokeEvent,
  subtaskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    const stmt = prepare('UPDATE subtasks SET position = ?, updated_at = ? WHERE id = ?');

    subtaskIds.forEach((id, idx) => {
      stmt.run(idx, now, id);
    });

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Subtasks] Reorder error:', error.message);
    return { success: false };
  }
}

// ── Activity handlers ─────────────────────────────────────────────────────────

async function handleActivityList(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  limit?: number
): Promise<{ success: boolean; activities: any[]; error?: string }> {
  try {
    const lim = limit || 50;
    const rows = prepare('SELECT * FROM task_activity WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?').all(taskId, lim);
    const activities = (rows as any[]).map((a: any) => ({
      id: a.id,
      taskId: a.task_id,
      agentId: a.agent_id,
      action: a.action,
      message: a.message,
      details: a.details,
      timestamp: a.timestamp,
    }));
    return { success: true, activities };
  } catch (error: any) {
    safeLog.error('[Activity] List error:', error);
    return { success: false, activities: [] };
  }
}

async function handleActivityAdd(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  entry: { action: string; message: string; agentId?: string; details?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = Date.now();
    prepare('INSERT INTO task_activity (task_id, agent_id, action, message, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(
      taskId,
      entry.agentId || null,
      entry.action,
      entry.message,
      entry.details || null,
      now
    );

    emitTaskEvent('task.updated', taskId);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Activity] Add error:', error.message);
    return { success: false };
  }
}

// ── Attachment handlers ───────────────────────────────────────────────────────

async function handleAttachmentsList(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; attachments: any[]; error?: string }> {
  try {
    const attachments = prepare('SELECT id, task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at FROM task_attachments WHERE task_id = ? ORDER BY uploaded_at DESC').all(taskId);
    return { success: true, attachments };
  } catch (error: any) {
    safeLog.error('[Attachments] List error:', error);
    return { success: false, attachments: [] };
  }
}

async function handleAttachmentsListAll(): Promise<{ success: boolean; attachments: any[]; error?: string }> {
  try {
    const attachments = (prepare(`
      SELECT ta.id, ta.task_id, ta.file_path, ta.filename, ta.file_size, ta.mime_type, ta.category, ta.uploaded_by, ta.uploaded_at,
             t.title as task_title, t.assigned_to as task_assignee, t.project as task_project
      FROM task_attachments ta
      LEFT JOIN tasks t ON ta.task_id = t.id
      ORDER BY ta.uploaded_at DESC
    `).all() as any[]).map((row: any) => ({
      ...row,
      category: inferFileCategory(row.filename || '', row.mime_type, row.task_title, row.task_assignee),
    }));
    return { success: true, attachments };
  } catch (error: any) {
    safeLog.error('[Attachments] ListAll error:', error);
    return { success: false, attachments: [] };
  }
}

async function handleAttachmentsAdd(
  _: Electron.IpcMainInvokeEvent,
  taskId: string,
  filePath: string,
  category: string = 'deliverable',
  uploadedBy: string = 'user'
): Promise<{ success: boolean; attachment?: any; error?: string }> {
  if (!validateTaskId(taskId)) return { success: false, error: 'Invalid task ID' };
  const validPath = validateFilePath(filePath);
  if (!validPath) return { success: false, error: 'Invalid file path' };
  const filename = path.basename(validPath);

  let fileSize = 0;
  let mimeType = 'application/octet-stream';

  try {
    const stats = fs.statSync(validPath);
    fileSize = stats.size;

    const ext = path.extname(validPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.sh': 'text/x-shellscript',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };
    mimeType = mimeTypes[ext] || mimeType;
  } catch (e) {
    safeLog.error('[Attachments] File stat error:', e);
    return { success: false, error: 'File not accessible' };
  }

  const now = Date.now();

  try {
    const result = prepare('INSERT INTO task_attachments (task_id, file_path, filename, file_size, mime_type, category, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      taskId, validPath, filename, fileSize, mimeType, category, uploadedBy, now
    );

    const attachmentId = Number(result.lastInsertRowid);

    execFile('froggo-db', ['task-activity', taskId, 'file_attached', `Attached: ${filename} (${category})`, '--details', validPath], { env: CHILD_ENV }, () => {});

    return {
      success: true,
      attachment: {
        id: attachmentId,
        task_id: taskId,
        file_path: validPath,
        filename,
        file_size: fileSize,
        mime_type: mimeType,
        category,
        uploaded_by: uploadedBy,
        uploaded_at: now
      }
    };
  } catch (error: any) {
    safeLog.error('[Attachments] Add error:', error);
    return { success: false, error: error.message };
  }
}

async function handleAttachmentsDelete(
  _: Electron.IpcMainInvokeEvent,
  attachmentId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const attachment = prepare('SELECT task_id, filename FROM task_attachments WHERE id = ?').get(attachmentId) as any;
    if (!attachment) {
      return { success: false, error: 'Attachment not found' };
    }

    const { task_id, filename } = attachment;

    prepare('DELETE FROM task_attachments WHERE id = ?').run(attachmentId);

    execFile('froggo-db', ['task-activity', task_id, 'file_deleted', `Deleted attachment: ${filename}`], { env: CHILD_ENV }, () => {});

    return { success: true };
  } catch (error: any) {
    safeLog.error('[Attachments] Delete error:', error);
    return { success: false, error: error.message };
  }
}

async function handleAttachmentsOpen(
  _: Electron.IpcMainInvokeEvent,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  const validPath = validateFilePath(filePath);
  if (!validPath) return { success: false, error: 'Invalid file path' };
  try {
    const err = await shell.openPath(validPath);
    return { success: !err, error: err || undefined };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function handleAttachmentsAutoDetect(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; output?: string; error?: string }> {
  if (!validateTaskId(taskId)) return { success: false, error: 'Invalid task ID' };
  return new Promise((resolve) => {
    execFile(path.join(SCRIPTS_DIR, 'attachment-helper.sh'), ['detect', taskId], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        safeLog.error('[Attachments] Auto-detect error:', error, stderr);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
}

// ── Fork / hierarchy handlers (from orphan task-handlers.ts) ─────────────────

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
  project_name?: string;
  parent_task_id?: string;
  stage_number?: number;
  stage_name?: string;
}

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

async function handleTaskFork(
  _: Electron.IpcMainInvokeEvent,
  parentTaskId: string,
  data: { title: string; description?: string; assignedTo?: string; priority?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const parent = prepare('SELECT * FROM tasks WHERE id = ?').get(parentTaskId) as TaskRow | undefined;
    if (!parent) return { success: false, error: 'Parent task not found' };

    const now = Date.now();
    const newId = `task-${now}`;
    const desc = `[Forked from: ${parent.title} (${parent.id})]\n\n${data.description || ''}`;

    prepare(`
      INSERT INTO tasks (id, title, description, status, assigned_to, priority, project_name, parent_task_id, reviewerId, independent_review_required, independent_review_status, created_at, updated_at)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, 'clara', 1, 'pending', ?, ?)
    `).run(
      newId,
      data.title,
      desc,
      data.assignedTo || parent.assigned_to || null,
      data.priority || parent.priority || 'p2',
      parent.project_name || null,
      parentTaskId,
      now,
      now
    );

    try {
      const attachments = prepare('SELECT * FROM task_attachments WHERE task_id = ?').all(parentTaskId) as AttachmentRow[];
      for (const att of attachments) {
        const attId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        prepare(`
          INSERT INTO task_attachments (id, task_id, filename, file_path, file_size, mime_type, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(attId, newId, att.filename, att.file_path, att.file_size, att.mime_type, `[From parent] ${att.description || ''}`, Date.now());
      }
    } catch { /* non-critical */ }

    safeLog.log('[Tasks] Forked:', newId, 'from', parentTaskId);
    emitTaskEvent('task.created', newId);
    return { success: true, id: newId };
  } catch (error: any) {
    safeLog.error('[Tasks] Fork error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleTaskChildren(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; children: TaskRow[]; error?: string }> {
  try {
    const children = prepare(
      'SELECT id, title, status, priority, assigned_to, created_at, project_name, stage_number, stage_name FROM tasks WHERE parent_task_id = ? ORDER BY stage_number, created_at'
    ).all(taskId) as TaskRow[];
    return { success: true, children };
  } catch (error: any) {
    safeLog.error('[Tasks] Children error:', error.message);
    return { success: false, children: [] };
  }
}

async function handleTaskParent(
  _: Electron.IpcMainInvokeEvent,
  taskId: string
): Promise<{ success: boolean; parent?: TaskRow; error?: string }> {
  try {
    const task = prepare('SELECT parent_task_id FROM tasks WHERE id = ?').get(taskId) as { parent_task_id?: string } | undefined;
    if (!task?.parent_task_id) return { success: true };

    const parent = prepare('SELECT id, title, status, priority, assigned_to, project_name, stage_number, stage_name FROM tasks WHERE id = ?').get(task.parent_task_id) as TaskRow | undefined;
    return { success: true, parent };
  } catch (error: any) {
    safeLog.error('[Tasks] Parent error:', error.message);
    return { success: false };
  }
}
