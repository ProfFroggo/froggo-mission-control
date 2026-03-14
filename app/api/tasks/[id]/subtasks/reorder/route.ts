// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const db = getDb();
    const body = await request.json();
    const { orderedIds } = body as { orderedIds: string[] };

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
    }

    // Verify all subtasks belong to this task
    const existing = db.prepare('SELECT id FROM subtasks WHERE taskId = ?').all(taskId) as { id: string }[];
    const existingIds = new Set(existing.map(r => r.id));
    for (const sid of orderedIds) {
      if (!existingIds.has(sid)) {
        return NextResponse.json({ error: `Subtask ${sid} not found on this task` }, { status: 400 });
      }
    }

    const updateStmt = db.prepare('UPDATE subtasks SET position = ? WHERE id = ?');
    const reorderAll = db.transaction((ids: string[]) => {
      ids.forEach((id, index) => updateStmt.run(index, id));
    });
    reorderAll(orderedIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/tasks/[id]/subtasks/reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
