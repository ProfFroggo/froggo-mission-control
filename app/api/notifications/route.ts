// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  const db = getDb();
  const rawLimit = request.nextUrl.searchParams.get('limit');
  const limit = rawLimit ? parseInt(rawLimit) : 20;
  if (isNaN(limit) || limit < 1 || limit > 200) {
    return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  }
  const rawSince = request.nextUrl.searchParams.get('since');
  const since = rawSince ? parseInt(rawSince) : 0;
  if (isNaN(since) || since < 0) {
    return NextResponse.json({ error: 'Invalid since' }, { status: 400 });
  }
  const notifications = db.prepare(
    'SELECT * FROM analytics_events WHERE event_type = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT ?'
  ).all('notification', since, limit);
  return NextResponse.json(notifications);
}

export async function POST(request: Request) {
  const db = getDb();
  const { title, body, agentId } = await request.json();
  db.prepare(
    'INSERT INTO analytics_events (event_type, metadata, timestamp) VALUES (?, ?, ?)'
  ).run('notification', JSON.stringify({ title, body, agentId: agentId || 'system' }), Date.now());
  return NextResponse.json({ success: true });
}
