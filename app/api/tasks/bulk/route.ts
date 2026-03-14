// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { emitSSEEvent } from '@/lib/sseEmitter';

const VALID_STATUSES = ['todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done'];
const VALID_PRIORITIES = ['p0', 'p1', 'p2', 'p3'];

/**
 * POST /api/tasks/bulk
 * Body: { ids: string[], action: 'status' | 'assign' | 'delete' | 'priority', value?: string }
 * Returns: { updated: number, failed: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { ids, action, value } = body as {
      ids: unknown;
      action: unknown;
      value?: unknown;
    };

    // Validate ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: 'Cannot bulk-operate on more than 500 tasks at once' }, { status: 400 });
    }
    const idList = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (idList.length === 0) {
      return NextResponse.json({ error: 'ids must be strings' }, { status: 400 });
    }

    // Validate action
    if (!['status', 'assign', 'delete', 'priority'].includes(action as string)) {
      return NextResponse.json({ error: 'action must be one of: status, assign, delete, priority' }, { status: 400 });
    }

    // Validate value for actions that require it
    if (action === 'status') {
      if (typeof value !== 'string' || !VALID_STATUSES.includes(value)) {
        return NextResponse.json(
          { error: `value must be a valid status: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
    }
    if (action === 'priority') {
      if (typeof value !== 'string' || !VALID_PRIORITIES.includes(value)) {
        return NextResponse.json(
          { error: `value must be a valid priority: ${VALID_PRIORITIES.join(', ')}` },
          { status: 400 }
        );
      }
    }
    if (action === 'assign') {
      // value can be a string (agentId) or null/undefined to unassign
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: 'value must be a string agentId or null' }, { status: 400 });
      }
    }

    const now = Date.now();
    const updated: string[] = [];
    const failed: string[] = [];

    if (action === 'delete') {
      // Delete all listed tasks
      for (const id of idList) {
        try {
          // Cascade cleanup
          try { db.prepare('DELETE FROM task_activity WHERE taskId = ?').run(id); } catch { /* non-critical */ }
          try {
            const approvalIds = db.prepare(
              `SELECT id FROM approvals WHERE json_extract(metadata, '$.taskId') = ?`
            ).all(id) as { id: string }[];
            for (const { id: approvalId } of approvalIds) {
              db.prepare('DELETE FROM approvals WHERE id = ?').run(approvalId);
            }
          } catch { /* non-critical */ }

          const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
          if (result.changes > 0) {
            updated.push(id);
          } else {
            failed.push(id); // Not found
          }
        } catch {
          failed.push(id);
        }
      }

      // Emit SSE for each deleted task
      for (const id of updated) {
        try { emitSSEEvent('task.deleted', { id }); } catch { /* non-critical */ }
      }

      return NextResponse.json({ updated: updated.length, failed });
    }

    if (action === 'status') {
      const newStatus = value as string;
      for (const id of idList) {
        try {
          const result = db.prepare(
            'UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?'
          ).run(newStatus, now, id);
          if (result.changes > 0) {
            updated.push(id);
            // Log activity
            db.prepare(
              'INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)'
            ).run(id, null, 'status_change', `Bulk status update → ${newStatus}`, now);
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }

      // Emit SSE
      try { emitSSEEvent('task.updated', { ids: updated, status: newStatus }); } catch { /* non-critical */ }

      return NextResponse.json({ updated: updated.length, failed });
    }

    if (action === 'assign') {
      const agentId = (value ?? null) as string | null;
      for (const id of idList) {
        try {
          const result = db.prepare(
            'UPDATE tasks SET assignedTo = ?, updatedAt = ? WHERE id = ?'
          ).run(agentId, now, id);
          if (result.changes > 0) {
            updated.push(id);
            db.prepare(
              'INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)'
            ).run(id, agentId, 'update', agentId ? `Bulk assigned to ${agentId}` : 'Bulk unassigned', now);
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }

      try { emitSSEEvent('task.updated', { ids: updated, assignedTo: agentId }); } catch { /* non-critical */ }

      return NextResponse.json({ updated: updated.length, failed });
    }

    if (action === 'priority') {
      const newPriority = value as string;
      for (const id of idList) {
        try {
          const result = db.prepare(
            'UPDATE tasks SET priority = ?, updatedAt = ? WHERE id = ?'
          ).run(newPriority, now, id);
          if (result.changes > 0) {
            updated.push(id);
            db.prepare(
              'INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)'
            ).run(id, null, 'update', `Bulk priority set to ${newPriority}`, now);
          } else {
            failed.push(id);
          }
        } catch {
          failed.push(id);
        }
      }

      try { emitSSEEvent('task.updated', { ids: updated, priority: newPriority }); } catch { /* non-critical */ }

      return NextResponse.json({ updated: updated.length, failed });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/tasks/bulk error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
