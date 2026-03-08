import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LIBRARY_ROOT = join(homedir(), 'mission-control', 'library');

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(
      'DELETE FROM task_attachments WHERE id = ? AND taskId = ?'
    ).run(Number(attachmentId), taskId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id]/attachments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/tasks/[id]/attachments/auto-detect
// Scans library for files related to this task by agent/date and registers them.
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const db = getDb();
    const task = db.prepare('SELECT id, assignedTo, createdAt, updatedAt FROM tasks WHERE id = ?').get(taskId) as {
      id: string; assignedTo: string | null; createdAt: number; updatedAt: number;
    } | undefined;

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const taskData = task;

    // Find files in library not already attached
    const existing = new Set(
      (db.prepare('SELECT filePath FROM task_attachments WHERE taskId = ?').all(taskId) as { filePath: string }[])
        .map(r => r.filePath)
    );

    const found: string[] = [];
    function scanDir(dir: string) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (!entry.name.startsWith('.') && !existing.has(full)) {
          const stat = statSync(full);
          // Match by: file modified within task timeframe (+/- 30min grace)
          const grace = 30 * 60 * 1000;
          const withinRange = stat.mtimeMs >= (taskData.createdAt - grace) && stat.mtimeMs <= (taskData.updatedAt + grace);
          if (withinRange) found.push(full);
        }
      }
    }
    scanDir(LIBRARY_ROOT);

    if (found.length === 0) {
      return NextResponse.json({ attached: 0, message: 'No new files found in library matching task timeframe' });
    }

    const now = Date.now();
    const insert = db.prepare(
      'INSERT OR IGNORE INTO task_attachments (taskId, filePath, fileName, category, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((files: string[]) => {
      for (const fp of files) {
        insert.run(taskId, fp, fp.split('/').pop() ?? fp, 'output', taskData.assignedTo ?? null, now);
      }
    });
    insertMany(found);

    return NextResponse.json({ attached: found.length, files: found.map(f => f.split('/').pop()) });
  } catch (error) {
    console.error('PATCH /api/tasks/[id]/attachments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
