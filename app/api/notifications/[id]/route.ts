// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

// DELETE /api/notifications/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/notifications/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
