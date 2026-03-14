// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const body = await request.json();
  try {
    const existing = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.status !== undefined) { sets.push('status = ?'); values.push(body.status); }
    if (body.type !== undefined) { sets.push('type = ?'); values.push(body.type); }
    if (body.content !== undefined) { sets.push('content = ?'); values.push(body.content); }
    if (body.scheduledFor !== undefined) { sets.push('scheduledFor = ?'); values.push(body.scheduledFor); }
    if (body.recurrence !== undefined) { sets.push('recurrence = ?'); values.push(body.recurrence); }
    if (body.metadata !== undefined) {
      const existingMeta = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata || '{}') : {};
      sets.push('metadata = ?');
      values.push(JSON.stringify({ ...existingMeta, ...body.metadata }));
    }
    if (sets.length === 0) {
      return NextResponse.json({ success: true, id });
    }
    values.push(id);
    db.prepare(`UPDATE scheduled_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  try {
    const result = db.prepare('DELETE FROM scheduled_items WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
