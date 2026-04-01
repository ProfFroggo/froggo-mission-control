// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '30', 10);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const agents = db.prepare(`
      SELECT
        t.assignedTo                                                  AS agent_id,
        a.status,
        COUNT(*)                                                      AS total_tasks,
        ROUND(100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) AS success_rate,
        ROUND(AVG(CASE WHEN t.status = 'done' AND t.completedAt IS NOT NULL
                       THEN (t.completedAt - t.createdAt) / 3600000.0 END), 2)           AS avg_completion_hours,
        ROUND(100.0 * SUM(CASE WHEN t.status IN ('done','review') THEN 1 ELSE 0 END) / COUNT(*), 1) AS clara_approval_rate
      FROM tasks t
      LEFT JOIN agents a ON a.id = t.assignedTo
      WHERE t.assignedTo IS NOT NULL
        AND t.createdAt >= ?
      GROUP BY t.assignedTo
      ORDER BY total_tasks DESC
    `).all(since) as {
      agent_id: string;
      status: string;
      total_tasks: number;
      success_rate: number;
      avg_completion_hours: number;
      clara_approval_rate: number;
    }[];

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('GET /api/analytics/performance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
