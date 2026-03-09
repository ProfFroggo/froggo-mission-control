// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') ?? 'wow'; // wow | mom

    // Number of periods to return (e.g. 8 weeks or 6 months)
    const periodCount = mode === 'mom' ? 6 : 8;
    const periodMs = mode === 'mom'
      ? 30 * 24 * 60 * 60 * 1000
      : 7  * 24 * 60 * 60 * 1000;

    const now = Date.now();
    const periods: {
      period: string;
      tasksCompleted: number;
      completionRate: number;
      avgCompletionTime: number;
      totalHours: number;
      activeAgents: number;
    }[] = [];

    for (let i = periodCount - 1; i >= 0; i--) {
      const end   = now - i * periodMs;
      const start = end - periodMs;

      const row = db.prepare(`
        SELECT
          COUNT(*)                                                              AS total,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)                    AS completed,
          ROUND(AVG(CASE WHEN status = 'done' AND completedAt IS NOT NULL
                         THEN (completedAt - createdAt) / 3600000.0 END), 2)  AS avg_hours,
          COUNT(DISTINCT assignedTo)                                            AS agents
        FROM tasks
        WHERE createdAt >= ? AND createdAt < ?
      `).get(start, end) as {
        total: number; completed: number; avg_hours: number | null; agents: number;
      };

      const total     = row?.total     ?? 0;
      const completed = row?.completed ?? 0;
      const label = mode === 'mom'
        ? new Date(start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : `W${periodCount - i}`;

      periods.push({
        period:            label,
        tasksCompleted:    completed,
        completionRate:    total > 0 ? Math.round((completed / total) * 100) : 0,
        avgCompletionTime: row?.avg_hours ?? 0,
        totalHours:        total * (row?.avg_hours ?? 0),
        activeAgents:      row?.agents ?? 0,
      });
    }

    // Comparison metrics: current period vs previous
    const current  = periods[periods.length - 1];
    const previous = periods[periods.length - 2] ?? current;

    const comparison = [
      {
        label:    'Tasks Completed',
        current:  current.tasksCompleted,
        previous: previous.tasksCompleted,
        change:   previous.tasksCompleted > 0
          ? Math.round(((current.tasksCompleted - previous.tasksCompleted) / previous.tasksCompleted) * 100)
          : 0,
      },
      {
        label:    'Completion Rate',
        current:  current.completionRate,
        previous: previous.completionRate,
        change:   current.completionRate - previous.completionRate,
      },
      {
        label:    'Avg Completion Time (h)',
        current:  current.avgCompletionTime,
        previous: previous.avgCompletionTime,
        change:   previous.avgCompletionTime > 0
          ? Math.round(((current.avgCompletionTime - previous.avgCompletionTime) / previous.avgCompletionTime) * 100)
          : 0,
      },
      {
        label:    'Active Agents',
        current:  current.activeAgents,
        previous: previous.activeAgents,
        change:   current.activeAgents - previous.activeAgents,
      },
    ];

    return NextResponse.json({ periods, comparison, mode });
  } catch (error) {
    console.error('GET /api/analytics/benchmarks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
