// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/modules/:id/tasks — get all tasks linked to a module
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: moduleId } = await params;
    const db = getDb();

    const tasks = db.prepare(
      `SELECT * FROM tasks WHERE moduleId = ? ORDER BY createdAt ASC`
    ).all(moduleId) as Record<string, unknown>[];

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({ tasks, total, completed, inProgress, progressPct });
  } catch (error) {
    console.error('GET /api/modules/:id/tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
