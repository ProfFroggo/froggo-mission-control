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

    // Last 7 days — count task_activity rows grouped by day
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const rows = db.prepare(`
      SELECT
        date(timestamp / 1000, 'unixepoch', 'localtime') AS day,
        COUNT(*) AS cnt
      FROM task_activity
      WHERE agentId = ?
        AND timestamp >= ?
      GROUP BY day
      ORDER BY day ASC
    `).all(id, sevenDaysAgo) as Array<{ day: string; cnt: number }>;

    // Build complete 7-day array filling in zeros for missing days
    const today = new Date();
    const days: Array<{ date: string; count: number }> = [];
    const countByDay: Record<string, number> = {};
    for (const r of rows) countByDay[r.day] = r.cnt;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({ date: dateStr, count: countByDay[dateStr] ?? 0 });
    }

    return NextResponse.json({ days });
  } catch (error) {
    console.error('GET /api/agents/[id]/activity-timeline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
