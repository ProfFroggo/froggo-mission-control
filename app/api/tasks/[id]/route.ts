import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

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

    setClauses.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
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
