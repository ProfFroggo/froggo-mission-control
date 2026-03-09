// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

const ALLOWED_FIELDS = ['type', 'title', 'content', 'context', 'channel', 'source_channel', 'status', 'project'];
const JSON_FIELDS = ['metadata', 'tags'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    for (const field of JSON_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(JSON.stringify(body[field]));
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(id);
    const result = db.prepare(`UPDATE inbox SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updated = db.prepare('SELECT * FROM inbox WHERE id = ?').get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/inbox/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const result = db.prepare('DELETE FROM inbox WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/inbox/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
