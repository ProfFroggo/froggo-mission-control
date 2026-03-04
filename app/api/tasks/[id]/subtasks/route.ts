import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const subtasks = db.prepare(
      'SELECT * FROM subtasks WHERE taskId = ? ORDER BY position ASC, createdAt ASC'
    ).all(id);

    return NextResponse.json(subtasks);
  } catch (error) {
    console.error('GET /api/tasks/[id]/subtasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const db = getDb();
    const body = await request.json();

    const subtaskId = crypto.randomUUID();
    const now = Date.now();

    // Auto-position: count existing subtasks
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE taskId = ?').get(taskId) as { cnt: number };
    const position = body.position ?? countRow.cnt;

    const { title, description, assignedTo } = body;

    db.prepare(`
      INSERT INTO subtasks (id, taskId, title, description, completed, assignedTo, position, createdAt)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(subtaskId, taskId, title, description ?? null, assignedTo ?? null, position, now);

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId);
    return NextResponse.json(subtask, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/[id]/subtasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
