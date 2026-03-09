// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const conditions: string[] = ["event_type = 'token_usage'"];
    const values: unknown[] = [];

    const agent = searchParams.get('agent');
    if (agent) {
      // Filter by agent in metadata JSON (SQLite JSON functions)
      conditions.push("json_extract(metadata, '$.agentId') = ?");
      values.push(agent);
    }

    const period = searchParams.get('period');
    if (period) {
      const now = Date.now();
      let cutoff = now;
      if (period === 'day') cutoff = now - 86400000;
      else if (period === 'week') cutoff = now - 7 * 86400000;
      else if (period === 'month') cutoff = now - 30 * 86400000;
      conditions.push('timestamp >= ?');
      values.push(cutoff);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const rows = db.prepare(`SELECT * FROM analytics_events ${where} ORDER BY timestamp DESC`).all(...values) as Record<string, unknown>[];

    const parsed = rows.map((row) => {
      const r = { ...row };
      if (typeof r.metadata === 'string') {
        try { r.metadata = JSON.parse(r.metadata as string); } catch { r.metadata = {}; }
      }
      return r;
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('GET /api/analytics/token-usage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
