// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/tasks/[id]/dependencies/route.ts
// GET: list dependencies; POST: add dependency

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const JSON_FIELDS = ['tags', 'labels', 'blockedBy', 'blocks', 'recurrence'];

function parseTask(row: Record<string, unknown>) {
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

    // Check task exists
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Tasks this task depends on (blocked by)
    const blockedByRows = db.prepare(`
      SELECT t.* FROM tasks t
      INNER JOIN task_dependencies d ON d.dependsOnId = t.id
      WHERE d.taskId = ?
      ORDER BY t.createdAt DESC
    `).all(id) as Record<string, unknown>[];

    // Tasks that depend on this task (blocks)
    const blocksRows = db.prepare(`
      SELECT t.* FROM tasks t
      INNER JOIN task_dependencies d ON d.taskId = t.id
      WHERE d.dependsOnId = ?
      ORDER BY t.createdAt DESC
    `).all(id) as Record<string, unknown>[];

    return NextResponse.json({
      blockedBy: blockedByRows.map(parseTask),
      blocks: blocksRows.map(parseTask),
    });
  } catch (error) {
    console.error('GET /api/tasks/[id]/dependencies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await request.json();
    const { dependsOnId } = body as { dependsOnId?: string };

    if (!dependsOnId || typeof dependsOnId !== 'string') {
      return NextResponse.json({ error: 'dependsOnId is required' }, { status: 400 });
    }

    if (dependsOnId === id) {
      return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
    }

    const dependsOnTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(dependsOnId);
    if (!dependsOnTask) {
      return NextResponse.json({ error: 'Dependency task not found' }, { status: 404 });
    }

    // Check for circular dependency: if dependsOnTask already depends on this task
    const wouldCycle = db.prepare(`
      SELECT 1 FROM task_dependencies WHERE taskId = ? AND dependsOnId = ?
    `).get(dependsOnId, id);
    if (wouldCycle) {
      return NextResponse.json({ error: 'Circular dependency detected' }, { status: 400 });
    }

    const depId = randomUUID();
    try {
      db.prepare(`
        INSERT INTO task_dependencies (id, taskId, dependsOnId)
        VALUES (?, ?, ?)
      `).run(depId, id, dependsOnId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) {
        return NextResponse.json({ error: 'Dependency already exists' }, { status: 409 });
      }
      throw err;
    }

    const created = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(depId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/[id]/dependencies error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
