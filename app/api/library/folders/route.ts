// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

interface LibraryFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  createdAt: number;
  parentId?: string | null;
}

// GET /api/library/folders — return full folder tree with file counts
export async function GET() {
  try {
    const db = getDb();
    const folders = db.prepare(
      'SELECT * FROM library_folders ORDER BY sort_order ASC, name ASC'
    ).all() as LibraryFolder[];

    // Attach file count per folder
    const countRows = db.prepare(
      'SELECT folder_id, COUNT(*) as count FROM library_files WHERE folder_id IS NOT NULL GROUP BY folder_id'
    ).all() as { folder_id: string; count: number }[];
    const countMap = new Map(countRows.map(r => [r.folder_id, r.count]));

    const foldersWithCount = folders.map(f => ({
      ...f,
      fileCount: countMap.get(f.id) ?? 0,
    }));

    return NextResponse.json({ success: true, folders: foldersWithCount });
  } catch (error) {
    console.error('GET /api/library/folders error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/library/folders — create a folder { name, parentId?, color? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string; parentId?: string | null; color?: string; icon?: string; sortOrder?: number };

    const { name, parentId = null, color = 'default', icon = 'folder', sortOrder = 0 } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    if (name.length > 255) {
      return NextResponse.json({ success: false, error: 'name must be 255 characters or fewer' }, { status: 400 });
    }

    const db = getDb();

    // Verify parentId exists if provided
    if (parentId) {
      const parent = db.prepare('SELECT id FROM library_folders WHERE id = ?').get(parentId);
      if (!parent) {
        return NextResponse.json({ success: false, error: 'parentId not found' }, { status: 400 });
      }
    }

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO library_folders (id, name, color, icon, sort_order, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name.trim(), color, icon, sortOrder, Date.now());

    const folder = db.prepare('SELECT * FROM library_folders WHERE id = ?').get(id) as LibraryFolder;
    return NextResponse.json({ success: true, folder: { ...folder, fileCount: 0 } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/library/folders error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
