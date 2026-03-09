// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '30', 10);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Heatmap: day-of-week × hour from task_activity timestamps
    const rows = db.prepare(`
      SELECT
        CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) AS dayOfWeek,
        CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) AS hour,
        COUNT(*) AS activityCount,
        date(timestamp / 1000, 'unixepoch') AS date
      FROM task_activity
      WHERE timestamp >= ?
      GROUP BY dayOfWeek, hour
      ORDER BY dayOfWeek, hour
    `).all(since) as { dayOfWeek: number; hour: number; activityCount: number; date: string }[];

    return NextResponse.json({ success: true, heatmap: rows, days });
  } catch (error) {
    console.error('GET /api/analytics/heatmap error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
