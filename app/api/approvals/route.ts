import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

function parseApproval(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.metadata === 'string') {
    try {
      parsed.metadata = JSON.parse(parsed.metadata as string);
    } catch {
      parsed.metadata = {};
    }
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let sql = 'SELECT * FROM approvals';
    const values: unknown[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      values.push(status);
    }

    sql += ' ORDER BY createdAt DESC';

    const rows = db.prepare(sql).all(...values) as Record<string, unknown>[];
    return NextResponse.json(rows.map(parseApproval));
  } catch (error) {
    console.error('GET /api/approvals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const id = crypto.randomUUID();
    const now = Date.now();

    const { type, title, content, context, metadata = {}, requester, tier = 3 } = body;

    db.prepare(`
      INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(id, type, title, content, context ?? null, JSON.stringify(metadata), requester ?? null, tier, now);

    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseApproval(approval), { status: 201 });
  } catch (error) {
    console.error('POST /api/approvals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
