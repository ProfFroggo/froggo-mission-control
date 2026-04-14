// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { jsonResponse } from '@/lib/jsonResponse';

/**
 * GET /api/arena/leaderboard
 *
 * Returns ranked leaderboard entries ordered by rankScore DESC.
 * Query params: ?limit=N&offset=N
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const rawLimit = searchParams.get('limit');
    const rawOffset = searchParams.get('offset');
    const limit = Math.min(Math.max(1, rawLimit ? parseInt(rawLimit, 10) || 50 : 50), 200);
    const offset = Math.max(0, rawOffset ? parseInt(rawOffset, 10) || 0 : 0);

    const rows = db.prepare(
      `SELECT *, ROW_NUMBER() OVER (ORDER BY rankScore DESC) as rank
       FROM leaderboard
       ORDER BY rankScore DESC
       LIMIT ? OFFSET ?`
    ).all(limit, offset);

    const { count: totalCount } = db.prepare(
      'SELECT COUNT(*) as count FROM leaderboard'
    ).get() as { count: number };

    return jsonResponse(rows, request, {
      headers: {
        'X-Total-Count': String(totalCount),
        'X-Limit': String(limit),
        'X-Offset': String(offset),
      },
    });
  } catch (error) {
    console.error('GET /api/arena/leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
