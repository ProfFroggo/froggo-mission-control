// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

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
