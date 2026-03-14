// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/tasks/[id]/dependencies/[depId]/route.ts
// DELETE: remove a specific dependency

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  try {
    const { id, depId } = await params;
    const db = getDb();

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        dependsOnId TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        UNIQUE(taskId, dependsOnId)
      )
    `);

    const existing = db.prepare(
      'SELECT id FROM task_dependencies WHERE id = ? AND taskId = ?'
    ).get(depId, id);

    if (!existing) {
      return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM task_dependencies WHERE id = ? AND taskId = ?').run(depId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id]/dependencies/[depId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
