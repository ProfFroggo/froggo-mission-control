// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();

    // Verify agent exists
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Count completed (done) tasks
    const doneRow = db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND status = 'done'`
    ).get(id) as { count: number };
    const tasksCompleted = doneRow.count;

    // Count rejected tasks (failed status)
    const rejectedRow = db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND status = 'failed'`
    ).get(id) as { count: number };
    const tasksRejected = rejectedRow.count;

    // Success rate
    const total = tasksCompleted + tasksRejected;
    const successRate = total > 0 ? Math.round((tasksCompleted / total) * 100) : null;

    // Average duration for done tasks (completedAt - createdAt) in ms
    const durRow = db.prepare(
      `SELECT AVG(completedAt - createdAt) as avg FROM tasks
       WHERE assignedTo = ? AND status = 'done' AND completedAt IS NOT NULL AND completedAt > 0`
    ).get(id) as { avg: number | null };
    const avgDurationMs = durRow.avg ? Math.round(durRow.avg) : null;

    return NextResponse.json({
      tasksCompleted,
      tasksRejected,
      successRate,
      avgDurationMs,
    });
  } catch (error) {
    console.error('GET /api/agents/[id]/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
