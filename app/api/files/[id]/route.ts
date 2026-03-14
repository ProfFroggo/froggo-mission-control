// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/files/[id] — update file metadata
// Body: { tags?: string[], folderId?: string | null, starred?: boolean, description?: string }
// Note: 'starred' is a client-side preference (localStorage) — stored here for server-side access if needed.
// Note: folderId maps to library_files.folder_id (TEXT UUID).
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const body = await request.json() as {
      tags?: string[];
      folderId?: string | null;
      starred?: boolean;
      description?: string;
    };

    const db = getDb();

    // Verify file exists (check library_files first)
    const file = db.prepare('SELECT * FROM library_files WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!file) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const updates: [string, unknown][] = [];

    // tags: validate array of strings
    if ('tags' in body) {
      if (!Array.isArray(body.tags) || !body.tags.every(t => typeof t === 'string')) {
        return NextResponse.json({ success: false, error: 'tags must be an array of strings' }, { status: 400 });
      }
      updates.push(['tags', JSON.stringify(body.tags)]);
    }

    // folderId: maps to folder_id column
    if ('folderId' in body) {
      const folderId = body.folderId ?? null;
      if (folderId !== null) {
        const folder = db.prepare('SELECT id FROM library_folders WHERE id = ?').get(folderId);
        if (!folder) {
          return NextResponse.json({ success: false, error: 'folderId not found' }, { status: 400 });
        }
      }
      updates.push(['folder_id', folderId]);
    }

    // description: optional text field — add as column migration if not present
    if ('description' in body) {
      if (body.description !== undefined && typeof body.description !== 'string') {
        return NextResponse.json({ success: false, error: 'description must be a string' }, { status: 400 });
      }
      // Attempt to add the column if it doesn't exist (idempotent)
      try {
        db.exec('ALTER TABLE library_files ADD COLUMN description TEXT');
      } catch { /* column already exists */ }
      updates.push(['description', body.description ?? null]);
    }

    // starred: store as INTEGER 0/1 — attempt column migration
    if ('starred' in body) {
      if (typeof body.starred !== 'boolean') {
        return NextResponse.json({ success: false, error: 'starred must be a boolean' }, { status: 400 });
      }
      try {
        db.exec('ALTER TABLE library_files ADD COLUMN starred INTEGER DEFAULT 0');
      } catch { /* column already exists */ }
      updates.push(['starred', body.starred ? 1 : 0]);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No patchable fields provided' }, { status: 400 });
    }

    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ');
    const values = [...updates.map(([, v]) => v), id];
    db.prepare(`UPDATE library_files SET ${setClauses} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM library_files WHERE id = ?').get(id);
    return NextResponse.json({ success: true, file: updated });
  } catch (error) {
    console.error('PATCH /api/files/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
