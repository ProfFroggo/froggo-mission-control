import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from   = searchParams.get('from');
    const to     = searchParams.get('to');

    const db = getDb();
    const conditions = ["(type LIKE '%meeting%' OR type LIKE '%call%' OR type LIKE '%event%')"];
    const params: unknown[] = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (from)   { conditions.push('scheduledAt >= ?'); params.push(new Date(from).getTime()); }
    if (to)     { conditions.push('scheduledAt <= ?'); params.push(new Date(to).getTime()); }

    const rows = db.prepare(
      `SELECT * FROM scheduled_items WHERE ${conditions.join(' AND ')} ORDER BY scheduledAt ASC`
    ).all(...params) as Record<string, unknown>[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/meetings error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, scheduledAt, duration, attendees, type = 'meeting' } = body;
    if (!title || !scheduledAt) {
      return NextResponse.json({ error: 'title and scheduledAt required' }, { status: 400 });
    }

    const db = getDb();
    const id  = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO scheduled_items (id, title, description, type, scheduledAt, duration, attendees, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
    `).run(
      id, title, description ?? null, type,
      new Date(scheduledAt).getTime(),
      duration ?? 60,
      attendees ? JSON.stringify(attendees) : null,
      now, now
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/meetings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
