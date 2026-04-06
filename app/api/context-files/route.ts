// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET  /api/context-files?entityType=project&entityId=xxx — list files for entity
// PATCH /api/context-files — update contextNotes on entity
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    const db = getDb();
    const files = db.prepare(
      'SELECT * FROM context_files WHERE entityType = ? AND entityId = ? ORDER BY createdAt ASC'
    ).all(entityType, entityId);

    // Get contextNotes from entity
    let contextNotes: string | null = null;
    if (entityType === 'project') {
      const p = db.prepare('SELECT contextNotes FROM projects WHERE id = ?').get(entityId) as { contextNotes: string } | undefined;
      contextNotes = p?.contextNotes ?? null;
    } else if (entityType === 'campaign') {
      const c = db.prepare('SELECT contextNotes FROM campaigns WHERE id = ?').get(entityId) as { contextNotes: string } | undefined;
      contextNotes = c?.contextNotes ?? null;
    }

    return NextResponse.json({ files, contextNotes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityType, entityId, notes } = body as { entityType: string; entityId: string; notes: string };

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    if (entityType === 'project') {
      db.prepare('UPDATE projects SET contextNotes = ?, updatedAt = ? WHERE id = ?').run(notes ?? null, now, entityId);
    } else if (entityType === 'campaign') {
      db.prepare('UPDATE campaigns SET contextNotes = ?, updatedAt = ? WHERE id = ?').run(notes ?? null, now, entityId);
    } else {
      return NextResponse.json({ error: 'entityType must be project or campaign' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
