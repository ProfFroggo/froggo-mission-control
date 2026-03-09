// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { event_type, metadata = {} } = body;

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
    }

    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO analytics_events (event_type, timestamp, metadata)
      VALUES (?, ?, ?)
    `).run(event_type, now, JSON.stringify(metadata));

    const event = db.prepare('SELECT * FROM analytics_events WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('POST /api/analytics/events error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
