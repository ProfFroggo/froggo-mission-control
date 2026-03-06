import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';
import { runReviewGate } from '@/lib/reviewGate';

const SCALAR_FIELDS = [
  'title', 'description', 'status', 'priority', 'project', 'assignedTo',
  'reviewerId', 'reviewStatus', 'reviewNotes', 'planningNotes', 'dueDate',
  'estimatedHours', 'progress', 'lastAgentUpdate', 'completedAt',
  'projectName', 'stageNumber', 'stageName', 'nextStage', 'parentTaskId',
];
const JSON_FIELDS = ['tags', 'labels', 'blockedBy', 'blocks'];

function parseTask(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        parsed[field] = [];
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

    // Auto-advance status when reviewStatus is set without an explicit status change
    if ('reviewStatus' in body && !('status' in body)) {
      const current = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
      if (current?.status === 'review') {
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

    // Auto-assign Clara as reviewer when task enters review or internal-review (if not already set)
    if ((body.status === 'review' || body.status === 'internal-review') && !body.reviewerId) {
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

    // Auto-dispatch when assignedTo is being set on a todo task
    const wasAssigned = 'assignedTo' in body && body.assignedTo;
    const isTodoStatus = (updated.status as string) === 'todo';
    if (wasAssigned && isTodoStatus) {
      dispatchTask(id);
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
