import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const inboxItem = db.prepare('SELECT * FROM inbox WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!inboxItem) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 });
    }

    const now = Date.now();
    const taskId = `task-${now}-${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority,
        tags, labels, blockedBy, blocks, progress,
        createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, 'todo', 'p2',
        '[]', '[]', '[]', '[]', 0,
        ?, ?
      )
    `).run(taskId, inboxItem.title as string, inboxItem.content as string, now, now);

    // Mark inbox item as converted
    db.prepare("UPDATE inbox SET status = 'converted' WHERE id = ?").run(id);

    return NextResponse.json({ taskId });
  } catch (error) {
    console.error('POST /api/inbox/[id]/convert-to-task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
