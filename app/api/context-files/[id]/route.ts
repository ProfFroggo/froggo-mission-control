// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET    /api/context-files/[id] — get a single context file record
// DELETE /api/context-files/[id] — remove from DB and delete from disk
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const file = db.prepare('SELECT * FROM context_files WHERE id = ?').get(id);
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(file);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const file = db.prepare('SELECT filePath FROM context_files WHERE id = ?').get(id) as { filePath: string } | undefined;
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Delete file from disk
    try {
      if (fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
    } catch (err) { console.warn('[context-files/[id]] Non-critical: file may have been moved', err); }

    db.prepare('DELETE FROM context_files WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
