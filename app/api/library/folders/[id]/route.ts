// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/library/folders/[id] — rename or recolor a folder
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { name?: string; color?: string; icon?: string; sortOrder?: number };

    const db = getDb();
    const folder = db.prepare('SELECT id FROM library_folders WHERE id = ?').get(id);
    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 });
    }

    const allowed = ['name', 'color', 'icon'] as const;
    const updates: [string, unknown][] = [];

    for (const key of allowed) {
      if (key in body) {
        const val = body[key];
        if (key === 'name') {
          if (typeof val !== 'string' || !val.trim()) {
            return NextResponse.json({ success: false, error: 'name must be a non-empty string' }, { status: 400 });
          }
          if (val.length > 255) {
            return NextResponse.json({ success: false, error: 'name must be 255 characters or fewer' }, { status: 400 });
          }
          updates.push(['name', val.trim()]);
        } else {
          if (typeof val === 'string') updates.push([key, val]);
        }
      }
    }

    if ('sortOrder' in body && typeof body.sortOrder === 'number') {
      updates.push(['sort_order', body.sortOrder]);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No patchable fields provided' }, { status: 400 });
    }

    const setClauses = updates.map(([k]) => `${k} = ?`).join(', ');
    const values = [...updates.map(([, v]) => v), id];
    db.prepare(`UPDATE library_folders SET ${setClauses} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM library_folders WHERE id = ?').get(id);
    return NextResponse.json({ success: true, folder: updated });
  } catch (error) {
    console.error('PATCH /api/library/folders/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/library/folders/[id] — delete folder, move contents to parent or NULL
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();

    const folder = db.prepare('SELECT * FROM library_folders WHERE id = ?').get(id) as
      | { id: string; name: string; parentId?: string | null }
      | undefined;

    if (!folder) {
      return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 });
    }

    // Move files to parent folder (or NULL if no parent)
    const parentId = (folder as Record<string, unknown>).parentId ?? null;
    db.prepare('UPDATE library_files SET folder_id = ? WHERE folder_id = ?').run(parentId, id);

    // Also handle child folders — reparent to deleted folder's parent
    db.prepare('UPDATE library_folders SET parentId = ? WHERE parentId = ?').run(parentId, id);

    // Remove associated folder data (rules, assignments)
    try { db.prepare('DELETE FROM library_folder_rules WHERE folder_id = ?').run(id); } catch { /* table may not exist */ }
    try { db.prepare('DELETE FROM library_folder_assignments WHERE folder_id = ?').run(id); } catch { /* table may not exist */ }

    db.prepare('DELETE FROM library_folders WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/library/folders/[id] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
