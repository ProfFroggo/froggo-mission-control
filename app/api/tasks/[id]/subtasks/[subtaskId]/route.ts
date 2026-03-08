import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

const ALLOWED_FIELDS = ['title', 'description', 'completed', 'assignedTo', 'completedAt', 'completedBy', 'position'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const { subtaskId } = await params;
    const db = getDb();
    const body = await request.json();

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        // SQLite can't bind booleans — convert to integer
        const val = body[field];
        values.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(subtaskId);
    db.prepare(`UPDATE subtasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(subtaskId);
    if (!updated) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/tasks/[id]/subtasks/[subtaskId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  try {
    const { subtaskId } = await params;
    const db = getDb();
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(subtaskId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id]/subtasks/[subtaskId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
