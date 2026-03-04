import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  const db = getDb();
  try {
    const items = db.prepare('SELECT * FROM scheduled_items ORDER BY scheduledFor ASC').all();
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  try {
    db.prepare(
      'INSERT INTO scheduled_items (id, type, content, scheduledFor, metadata, status, platform) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      body.type || 'task',
      body.content || body.title || '',
      body.scheduledFor || String(now),
      JSON.stringify(body.metadata || {}),
      'pending',
      body.platform || null
    );
    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
