// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

interface WeekBucket {
  weekStart: string;
  created: number;
  completed: number;
  inProgress: number;
}

interface CreatedRow {
  weekStart: string;
  count: number;
}

interface CompletedRow {
  weekStart: string;
  count: number;
}

interface InProgressRow {
  weekStart: string;
  count: number;
}

/**
 * Truncates a Unix-millisecond timestamp to the Monday of its ISO week.
 * SQLite expression: date(ts/1000 - ((strftime('%w',ts/1000,'unixepoch')+6)%7)*86400, 'unixepoch')
 * We use the simpler approach of computing week boundaries in JS and filtering per-week.
 *
 * Actually we'll just do it in SQL with strftime week grouping.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const weeks = Math.min(Math.max(parseInt(searchParams.get('weeks') ?? '8', 10), 1), 52);
    const since = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;

    // Week start = Monday. SQLite's strftime('%W') is Sunday-based, so we offset.
    // We group by (year, week) via strftime and compute the Monday date.
    const weekExpr = `
      date(
        createdAt / 1000 - ((strftime('%w', createdAt / 1000, 'unixepoch') + 6) % 7) * 86400,
        'unixepoch'
      )`;

    const createdRows = db
      .prepare(
        `SELECT ${weekExpr} AS weekStart, COUNT(*) AS count
         FROM tasks
         WHERE createdAt >= ?
         GROUP BY weekStart
         ORDER BY weekStart ASC`
      )
      .all(since) as CreatedRow[];

    const completedWeekExpr = `
      date(
        completedAt / 1000 - ((strftime('%w', completedAt / 1000, 'unixepoch') + 6) % 7) * 86400,
        'unixepoch'
      )`;

    const completedRows = db
      .prepare(
        `SELECT ${completedWeekExpr} AS weekStart, COUNT(*) AS count
         FROM tasks
         WHERE status = 'done'
           AND completedAt IS NOT NULL
           AND completedAt >= ?
         GROUP BY weekStart
         ORDER BY weekStart ASC`
      )
      .all(since) as CompletedRow[];

    const inProgressRows = db
      .prepare(
        `SELECT ${weekExpr} AS weekStart, COUNT(*) AS count
         FROM tasks
         WHERE status = 'in-progress'
           AND createdAt >= ?
         GROUP BY weekStart
         ORDER BY weekStart ASC`
      )
      .all(since) as InProgressRow[];

    // Build a unified week set
    const allWeeks = new Set<string>();
    for (const r of createdRows) allWeeks.add(r.weekStart);
    for (const r of completedRows) allWeeks.add(r.weekStart);
    for (const r of inProgressRows) allWeeks.add(r.weekStart);

    const createdMap = new Map(createdRows.map((r) => [r.weekStart, r.count]));
    const completedMap = new Map(completedRows.map((r) => [r.weekStart, r.count]));
    const inProgressMap = new Map(inProgressRows.map((r) => [r.weekStart, r.count]));

    const sortedWeeks = [...allWeeks].sort();
    const result: WeekBucket[] = sortedWeeks.map((w) => ({
      weekStart: w,
      created: createdMap.get(w) ?? 0,
      completed: completedMap.get(w) ?? 0,
      inProgress: inProgressMap.get(w) ?? 0,
    }));

    return NextResponse.json({ weeks: result });
  } catch (error) {
    console.error('GET /api/analytics/velocity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
