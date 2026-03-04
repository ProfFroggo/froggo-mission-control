import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

function parseInboxItem(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.metadata === 'string') {
    try { parsed.metadata = JSON.parse(parsed.metadata as string); } catch { parsed.metadata = {}; }
  }
  if (typeof parsed.tags === 'string') {
    try { parsed.tags = JSON.parse(parsed.tags as string); } catch { parsed.tags = []; }
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const conditions: string[] = [];
    const values: unknown[] = [];

    const status = searchParams.get('status');
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const project = searchParams.get('project');
    if (project) {
      conditions.push('project = ?');
      values.push(project);
    }

    const starred = searchParams.get('starred');
    if (starred !== null) {
      conditions.push('starred = ?');
      values.push(starred === 'true' ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM inbox ${where} ORDER BY createdAt DESC`).all(...values) as Record<string, unknown>[];

    return NextResponse.json(rows.map(parseInboxItem));
  } catch (error) {
    console.error('GET /api/inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      type, title, content, context, channel, source_channel,
      status, metadata = {}, tags = [], project,
    } = body;

    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO inbox (type, title, content, context, channel, source_channel, status, createdAt, metadata, starred, isRead, tags, project)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(type, title, content, context ?? null, channel ?? null, source_channel ?? null, status ?? null, now, JSON.stringify(metadata), JSON.stringify(tags), project ?? null);

    const item = db.prepare('SELECT * FROM inbox WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
    return NextResponse.json(parseInboxItem(item), { status: 201 });
  } catch (error) {
    console.error('POST /api/inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
