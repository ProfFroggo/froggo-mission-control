import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '30', 10);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Status breakdown
    const statusRows = db.prepare(
      `SELECT status, COUNT(*) as count FROM tasks GROUP BY status`
    ).all() as { status: string; count: number }[];
    const byStatus: Record<string, number> = {};
    for (const row of statusRows) byStatus[row.status] = row.count;
    const total = statusRows.reduce((s, r) => s + r.count, 0);

    // Daily completions (for trend chart)
    const completions = db.prepare(`
      SELECT date(completedAt / 1000, 'unixepoch') AS date,
             COUNT(*) AS tasks_completed
      FROM tasks
      WHERE status = 'done'
        AND completedAt IS NOT NULL
        AND completedAt >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(since) as { date: string; tasks_completed: number }[];

    // Daily creations
    const created = db.prepare(`
      SELECT date(createdAt / 1000, 'unixepoch') AS date,
             COUNT(*) AS tasks_created
      FROM tasks
      WHERE createdAt >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(since) as { date: string; tasks_created: number }[];

    // Per-project breakdown
    const projects = db.prepare(`
      SELECT
        COALESCE(project, 'Unassigned')               AS project,
        COUNT(*)                                       AS total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed,
        ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) AS completion_rate
      FROM tasks
      GROUP BY project
      ORDER BY total DESC
    `).all() as { project: string; total: number; completed: number; completion_rate: number }[];

    // Per-agent breakdown (for AnalyticsOverview agent chart)
    const agents = db.prepare(`
      SELECT
        assignedTo AS agent,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed
      FROM tasks
      WHERE assignedTo IS NOT NULL
      GROUP BY assignedTo
      ORDER BY total DESC
    `).all() as { agent: string; total: number; completed: number }[];

    return NextResponse.json({ success: true, byStatus, total, completions, created, projects, agents });
  } catch (error) {
    console.error('GET /api/analytics/task-stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
