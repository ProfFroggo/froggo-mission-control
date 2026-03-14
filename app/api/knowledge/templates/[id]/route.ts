// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// DELETE /api/knowledge/templates/[id] — remove a template
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM knowledge_templates WHERE id = ?').get(params.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  db.prepare('DELETE FROM knowledge_templates WHERE id = ?').run(params.id);
  return NextResponse.json({ success: true });
}
