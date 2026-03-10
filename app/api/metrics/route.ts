// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 85: /api/metrics — telemetry summary for the last 24 hours

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const since = Date.now() - 24 * 60 * 60 * 1000; // Last 24 hours

  try {
    const eventCounts = db.prepare(`
      SELECT event, COUNT(*) as count
      FROM telemetry
      WHERE ts > ?
      GROUP BY event
      ORDER BY count DESC
      LIMIT 50
    `).all(since) as { event: string; count: number }[];

    const agentErrors = db.prepare(`
      SELECT agentId, COUNT(*) as errors
      FROM telemetry
      WHERE event = 'dispatch.error' AND ts > ? AND agentId IS NOT NULL
      GROUP BY agentId
      ORDER BY errors DESC
      LIMIT 20
    `).all(since) as { agentId: string; errors: number }[];

    const recentEvents = db.prepare(`
      SELECT ts, event, agentId, data
      FROM telemetry
      WHERE ts > ?
      ORDER BY ts DESC
      LIMIT 100
    `).all(since) as { ts: number; event: string; agentId: string | null; data: string | null }[];

    return NextResponse.json({
      period: '24h',
      since,
      events: Object.fromEntries(eventCounts.map(c => [c.event, c.count])),
      agentErrors,
      recentEvents: recentEvents.map(e => ({
        ts: e.ts,
        event: e.event,
        agentId: e.agentId,
        data: e.data ? (() => { try { return JSON.parse(e.data!); } catch { return e.data; } })() : null,
      })),
      generatedAt: Date.now(),
    });
  } catch (e) {
    console.error('GET /api/metrics error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
