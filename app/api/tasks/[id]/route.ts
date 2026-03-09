// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';
import { runReviewGate } from '@/lib/reviewGate';
import { emitSSEEvent } from '@/lib/sseEmitter';

function computeNextDue(currentDue: number, rec: { frequency: string; interval: number }): number {
  const d = new Date(currentDue);
  const n = rec.interval || 1;
  switch (rec.frequency) {
    case 'daily':   d.setDate(d.getDate() + n); break;
    case 'weekly':  d.setDate(d.getDate() + n * 7); break;
    case 'monthly': d.setMonth(d.getMonth() + n); break;
    case 'yearly':  d.setFullYear(d.getFullYear() + n); break;
  }
  return d.getTime();
}

const SCALAR_FIELDS = [
  'title', 'description', 'status', 'priority', 'project', 'project_id', 'assignedTo',
  'reviewerId', 'reviewStatus', 'reviewNotes', 'planningNotes', 'dueDate',
  'estimatedHours', 'progress', 'lastAgentUpdate', 'completedAt',
  'projectName', 'stageNumber', 'stageName', 'nextStage', 'parentTaskId',
  'recurrenceParentId',
];
const JSON_FIELDS = ['tags', 'labels', 'blockedBy', 'blocks', 'recurrence'];

function parseTask(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        parsed[field] = field === 'recurrence' ? null : [];
      }
    }
  }
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(parseTask(task));
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    if ('title' in body && (typeof body.title !== 'string' || body.title.length > 500)) {
      return NextResponse.json({ error: 'title must be 500 characters or fewer' }, { status: 400 });
    }
    if ('description' in body && body.description !== null && typeof body.description === 'string' && body.description.length > 5000) {
      return NextResponse.json({ error: 'description must be 5000 characters or fewer' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of SCALAR_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    for (const field of JSON_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(JSON.stringify(body[field]));
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Auto-advance status based on reviewStatus.
    // Only fires when reviewStatus is being set AND body does NOT already contain an explicit status.
    if ('reviewStatus' in body && !('status' in body)) {
      const current = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
      const effectiveStatus = current?.status;
      if (effectiveStatus === 'review') {
        if (body.reviewStatus === 'approved') {
          setClauses.push('status = ?');
          values.push('done');
        } else if (body.reviewStatus === 'rejected' || body.reviewStatus === 'needs-changes') {
          setClauses.push('status = ?');
          values.push('in-progress');
        }
      }
    }

    const now = Date.now();
    setClauses.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    // Always ensure Clara is reviewer — set whenever reviewerId isn't already populated
    if (!body.reviewerId) {
      const current2 = db.prepare('SELECT reviewerId FROM tasks WHERE id = ?').get(id) as { reviewerId: string | null } | undefined;
      if (!current2?.reviewerId) {
        db.prepare('UPDATE tasks SET reviewerId = ? WHERE id = ?').run('clara', id);
      }
    }

    // Auto-log activity
    const activityMsg = body.lastAgentUpdate ||
      (body.status ? `Status → ${body.status}` : null) ||
      (body.reviewStatus ? `Review: ${body.reviewStatus}` : null) ||
      'Task updated';
    db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(id, body.assignedTo || null, body.status ? 'status_change' : 'update', activityMsg, now);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Auto-dispatch triggers:
    // 1. assignedTo set on a todo task (initial assignment)
    const wasAssigned = 'assignedTo' in body && body.assignedTo;
    const isTodoStatus = (updated.status as string) === 'todo';
    if (wasAssigned && isTodoStatus) {
      dispatchTask(id);
    }

    // 2. Task rejected by Clara (reviewStatus=rejected/needs-changes → status=in-progress)
    const wasRejected = body.reviewStatus === 'rejected' || body.reviewStatus === 'needs-changes';
    if (wasRejected && updated.assignedTo) {
      dispatchTask(id);
    }

    // Auto-create approval record when task moves to human-review
    if (body.status === 'human-review') {
      try {
        const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        if (taskRow) {
          // Only create if no pending approval for this task already exists
          const existing = db.prepare(
            `SELECT id FROM approvals WHERE type = 'task' AND status = 'pending'
             AND json_extract(metadata, '$.taskId') = ?`
          ).get(id);
          if (!existing) {
            const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            db.prepare(`
              INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, createdAt)
              VALUES (?, 'task', ?, ?, ?, ?, 'pending', ?, 3, ?)
            `).run(
              approvalId,
              taskRow.title,
              taskRow.lastAgentUpdate || taskRow.description || 'Task requires human review',
              taskRow.planningNotes || null,
              JSON.stringify({ taskId: id, project: taskRow.project, priority: taskRow.priority }),
              taskRow.assignedTo || null,
              now
            );
          }
        }
      } catch { /* non-critical */ }
    }

    // Review gate: when task moves to 'review', validate it
    // Gate auto-sets Clara as reviewer and may push back to 'todo' if incomplete
    const movingToReview = 'status' in body && body.status === 'review';
    if (movingToReview) {
      runReviewGate(id);
      // Re-fetch after gate may have modified the task
      const afterGate = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (afterGate) return NextResponse.json(parseTask(afterGate));
    }

    // Auto-spawn next occurrence when a recurring task is marked done
    if (body.status === 'done' && updated.recurrence) {
      try {
        const rec = JSON.parse(updated.recurrence as string);
        if (rec && rec.frequency) {
          // Check if recurrence is exhausted
          let shouldSpawn = true;
          if (rec.endType === 'after') {
            shouldSpawn = rec.endAfter > 1;
          } else if (rec.endType === 'on' && rec.endDate) {
            shouldSpawn = Date.now() < rec.endDate;
          }

          if (shouldSpawn && updated.dueDate) {
            const nextDue = computeNextDue(Number(updated.dueDate), rec);
            // Don't spawn past the end date
            if (rec.endType !== 'on' || nextDue <= rec.endDate) {
              const nextRec = rec.endType === 'after'
                ? { ...rec, endAfter: rec.endAfter - 1 }
                : rec;
              const nextId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const parentId = (updated.recurrenceParentId as string) || id;
              const existingRecurrence = db.prepare(
                'SELECT id FROM tasks WHERE recurrenceParentId = ? AND dueDate = ? AND status != ?'
              ).get(parentId, nextDue, 'done');
              if (!existingRecurrence) {
                db.prepare(`
                  INSERT INTO tasks (
                    id, title, description, status, priority, project, assignedTo,
                    reviewerId, planningNotes, dueDate, estimatedHours, tags, labels,
                    blockedBy, blocks, progress, createdAt, updatedAt,
                    recurrence, recurrenceParentId
                  ) VALUES (
                    ?, ?, ?, 'todo', ?, ?, ?,
                    ?, ?, ?, ?, '[]', '[]',
                    '[]', '[]', 0, ?, ?,
                    ?, ?
                  )
                `).run(
                  nextId,
                  updated.title, updated.description ?? null,
                  updated.priority ?? 'p2', updated.project ?? null, updated.assignedTo ?? null,
                  updated.reviewerId ?? null, updated.planningNotes ?? null,
                  nextDue, updated.estimatedHours ?? null,
                  now, now,
                  JSON.stringify(nextRec), parentId
                );
              }
            }
          }
        }
      } catch { /* non-critical */ }
    }

    // Notify SSE clients of task update
    const taskId = (updated as Record<string, unknown>)?.id as string | undefined;
    const taskStatus = (updated as Record<string, unknown>)?.status as string | undefined;
    if (taskId) emitSSEEvent('task.updated', { id: taskId, status: taskStatus ?? null });

    return NextResponse.json(parseTask(updated));
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
