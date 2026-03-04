import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  const db = getDb();
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const since = parseInt(request.nextUrl.searchParams.get('since') || '0');
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
