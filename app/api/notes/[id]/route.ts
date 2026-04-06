// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.content !== undefined) { sets.push('content = ?'); values.push(body.content); }
    if (body.color !== undefined) { sets.push('color = ?'); values.push(body.color); }
    if (body.pinned !== undefined) { sets.push('pinned = ?'); values.push(body.pinned ? 1 : 0); }

    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;

    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    if (result.changes === 0) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
