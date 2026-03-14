// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { createNotification } from '@/lib/notificationWriter';

export const dynamic = 'force-dynamic';

function parseNotification(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.metadata === 'string') {
    try { parsed.metadata = JSON.parse(parsed.metadata as string); } catch { parsed.metadata = {}; }
  }
  return parsed;
}

// GET /api/notifications
// Query params: unreadOnly=true, type=<type>, limit=<n>
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type');
    const rawLimit = searchParams.get('limit');
    const limit = rawLimit ? Math.min(parseInt(rawLimit, 10) || 50, 200) : 50;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (unreadOnly) {
      conditions.push('readAt IS NULL');
    }
    if (type) {
      conditions.push('type = ?');
      values.push(type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(
      `SELECT * FROM notifications ${where} ORDER BY createdAt DESC LIMIT ?`
    ).all(...values, limit) as Record<string, unknown>[];

    const total = (db.prepare(`SELECT COUNT(*) as count FROM notifications ${where}`).get(...values) as { count: number }).count;
    const unreadCount = (db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE readAt IS NULL`).get() as { count: number }).count;

    return NextResponse.json(
      { notifications: rows.map(parseNotification), total, unreadCount },
      { headers: { 'X-Unread-Count': String(unreadCount) } }
    );
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications — create a notification manually
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, title, body: notifBody, userId, metadata } = body;

    if (!type || !title) {
      return NextResponse.json({ error: 'type and title are required' }, { status: 400 });
    }

    await createNotification({ type, title, body: notifBody, userId, metadata });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/notifications — mark read
// Body: { action: 'mark_read', ids: string[] | 'all' }
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { action, ids } = body as { action: string; ids?: string[] | 'all' };

    if (action !== 'mark_read') {
      return NextResponse.json({ error: 'action must be mark_read' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (ids === 'all') {
      const result = db.prepare(`UPDATE notifications SET readAt = ? WHERE readAt IS NULL`).run(now);
      return NextResponse.json({ updated: result.changes });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array or "all"' }, { status: 400 });
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(
      `UPDATE notifications SET readAt = ? WHERE id IN (${placeholders}) AND readAt IS NULL`
    ).run(now, ...ids);

    return NextResponse.json({ updated: result.changes });
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
