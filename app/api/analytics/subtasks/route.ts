// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();

    // Per-agent subtask completion rates
    const byAgent = db.prepare(`
      SELECT
        t.assignedTo AS agent,
        COUNT(s.id) AS total,
        SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) AS completed,
        ROUND(100.0 * SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) / COUNT(s.id), 1) AS completionRate
      FROM subtasks s
      JOIN tasks t ON t.id = s.taskId
      WHERE t.assignedTo IS NOT NULL
      GROUP BY t.assignedTo
      ORDER BY completionRate DESC
    `).all() as { agent: string; total: number; completed: number; completionRate: number }[];

    // Overall totals
    const totals = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed
      FROM subtasks
    `).get() as { total: number; completed: number };

    return NextResponse.json({
      success: true,
      byAgent,
      total: totals?.total ?? 0,
      completed: totals?.completed ?? 0,
      completionRate: totals?.total > 0
        ? Math.round((totals.completed / totals.total) * 1000) / 10
        : 0,
    });
  } catch (error) {
    console.error('GET /api/analytics/subtasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
