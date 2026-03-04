import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const attachments = db.prepare(
      'SELECT * FROM task_attachments WHERE taskId = ? ORDER BY createdAt DESC'
    ).all(id);

    return NextResponse.json(attachments);
  } catch (error) {
    console.error('GET /api/tasks/[id]/attachments error:', error);
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

    const { filePath, fileName, category, uploadedBy } = body;

    const result = db.prepare(`
      INSERT INTO task_attachments (taskId, filePath, fileName, category, uploadedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, filePath, fileName ?? null, category ?? null, uploadedBy ?? null, Date.now());

    const attachment = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/[id]/attachments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
