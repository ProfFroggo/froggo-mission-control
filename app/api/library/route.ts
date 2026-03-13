// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ENV } from '@/lib/env';
import { resolveLibraryId } from '@/lib/apiAuth';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

const MIME_MAP: Record<string, string> = {
  '.md': 'text/markdown', '.txt': 'text/plain', '.pdf': 'application/pdf',
  '.json': 'application/json', '.ts': 'text/plain', '.tsx': 'text/plain',
  '.js': 'text/plain', '.jsx': 'text/plain', '.py': 'text/plain',
  '.sh': 'text/plain', '.csv': 'text/csv', '.html': 'text/html',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.mov': 'video/quicktime',
};
function getFileMime(filePath: string) {
  return MIME_MAP[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Unified /api/library action handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const db = getDb();

  try {
    if (action === 'folders') {
      const folders = db.prepare('SELECT * FROM library_folders ORDER BY sort_order ASC').all();
      return NextResponse.json({ success: true, folders });
    }

    if (action === 'skills') {
      // Delegate to library/skills data
      const skills = db.prepare('SELECT * FROM library_files WHERE category = ? ORDER BY createdAt DESC').all('skill');
      return NextResponse.json({ success: true, skills });
    }

    if (action === 'view') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

      // First: try to decode as base64 relative path (new filesystem-based IDs)
      let filePath: string | null = resolveLibraryId(id);

      // Fallback: legacy DB lookup
      if (!filePath) {
        const file = db.prepare('SELECT * FROM library_files WHERE id = ?').get(id) as { path?: string; content?: string } | undefined;
        if (file) {
          if (file.path && existsSync(file.path)) filePath = file.path;
          else if (file.content) return NextResponse.json({ success: true, content: file.content });
        }
      }

      if (!filePath) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

      const mime = getFileMime(filePath);
      // Binary files (images, video, audio) — return a raw URL instead of contents
      const isBinary = mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf';
      if (isBinary) {
        const rawUrl = `/api/library?action=raw&id=${encodeURIComponent(id)}`;
        return NextResponse.json({ success: true, content: rawUrl, mimeType: mime, isBinary: true });
      }

      try {
        const content = readFileSync(filePath, 'utf8');
        return NextResponse.json({ success: true, content, mimeType: mime });
      } catch {
        return NextResponse.json({ success: false, error: 'Could not read file' }, { status: 500 });
      }
    }

    if (action === 'raw') {
      const id = searchParams.get('id');
      if (!id) return new NextResponse('id required', { status: 400 });

      const filePath = resolveLibraryId(id);
      if (!filePath) return new NextResponse('Not found', { status: 404 });

      const bytes = readFileSync(filePath);
      const mime = getFileMime(filePath);
      const filename = path.basename(filePath);
      return new NextResponse(bytes, {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(bytes.length),
        },
      });
    }

    if (action === 'folder-rules') {
      const folderId = searchParams.get('folderId');
      if (!folderId) return NextResponse.json({ success: false, error: 'folderId required' }, { status: 400 });
      const rules = db.prepare('SELECT * FROM library_folder_rules WHERE folder_id = ?').all(folderId);
      return NextResponse.json({ success: true, rules });
    }

    if (action === 'folders-for-conversation') {
      const sessionKey = searchParams.get('sessionKey');
      if (!sessionKey) return NextResponse.json({ success: true, folders: [] });
      const assignments = db.prepare(`
        SELECT f.* FROM library_folders f
        JOIN library_folder_assignments a ON a.folder_id = f.id
        WHERE a.session_key = ?
      `).all(sessionKey);
      return NextResponse.json({ success: true, folders: assignments });
    }

    // Default: list all files
    const files = db.prepare('SELECT * FROM library_files ORDER BY createdAt DESC').all();
    return NextResponse.json({ success: true, files });
  } catch (error) {
    console.error('GET /api/library error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const db = getDb();

    if (action === 'delete') {
      const { id } = body;
      db.prepare('DELETE FROM library_files WHERE id = ?').run(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'link') {
      const { fileId, taskId } = body;
      db.prepare('UPDATE library_files SET taskId = ? WHERE id = ?').run(taskId, fileId);
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const { id, ...fields } = body;
      if (typeof fields.name === 'string' && fields.name.length > 255) {
        return NextResponse.json({ success: false, error: 'name must be 255 characters or fewer' }, { status: 400 });
      }
      const allowed = ['category', 'project', 'tags', 'name', 'path', 'content'];
      const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
      if (updates.length === 0) return NextResponse.json({ success: false, error: 'No valid fields' }, { status: 400 });
      const setClauses = updates.map(([k]) => `${k} = ?`).join(', ');
      const values = [...updates.map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : v)), id];
      db.prepare(`UPDATE library_files SET ${setClauses} WHERE id = ?`).run(...values);
      return NextResponse.json({ success: true });
    }

    if (action === 'append') {
      const { path: filePath, content } = body;
      const file = db.prepare('SELECT * FROM library_files WHERE path = ?').get(filePath) as { id: string; content?: string } | undefined;
      if (file) {
        const newContent = (file.content || '') + '\n' + content;
        db.prepare('UPDATE library_files SET content = ? WHERE id = ?').run(newContent, file.id);
      } else {
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO library_files (id, name, path, content, createdAt) VALUES (?, ?, ?, ?, ?)').run(
          id, filePath.split('/').pop() || filePath, filePath, content, Date.now()
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'folder-create') {
      const { name, color, icon, sort_order = 0 } = body;
      if (!name || typeof name !== 'string' || name.length > 255) {
        return NextResponse.json({ success: false, error: 'folder name must be 255 characters or fewer' }, { status: 400 });
      }
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO library_folders (id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)').run(id, name, color, icon, sort_order);
      const folder = db.prepare('SELECT * FROM library_folders WHERE id = ?').get(id);
      return NextResponse.json({ success: true, folder });
    }

    if (action === 'folder-update') {
      const { id, ...fields } = body;
      const allowed = ['name', 'color', 'icon', 'sort_order'];
      const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
      if (updates.length > 0) {
        const setClauses = updates.map(([k]) => `${k} = ?`).join(', ');
        const values = [...updates.map(([, v]) => v), id];
        db.prepare(`UPDATE library_folders SET ${setClauses} WHERE id = ?`).run(...values);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'folder-delete') {
      const { id } = body;
      db.prepare('DELETE FROM library_folders WHERE id = ?').run(id);
      db.prepare('DELETE FROM library_folder_assignments WHERE folder_id = ?').run(id);
      db.prepare('DELETE FROM library_folder_rules WHERE folder_id = ?').run(id);
      return NextResponse.json({ success: true });
    }

    if (action === 'folder-assign') {
      const { folderId, sessionKey, note } = body;
      db.prepare('INSERT OR REPLACE INTO library_folder_assignments (folder_id, session_key, note) VALUES (?, ?, ?)').run(folderId, sessionKey, note || null);
      return NextResponse.json({ success: true });
    }

    if (action === 'folder-unassign') {
      const { folderId, sessionKey } = body;
      db.prepare('DELETE FROM library_folder_assignments WHERE folder_id = ? AND session_key = ?').run(folderId, sessionKey);
      return NextResponse.json({ success: true });
    }

    if (action === 'folder-rules-save') {
      const { folderId, rule } = body;
      const id = crypto.randomUUID();
      db.prepare('DELETE FROM library_folder_rules WHERE folder_id = ?').run(folderId);
      if (rule) {
        db.prepare('INSERT INTO library_folder_rules (id, folder_id, rule) VALUES (?, ?, ?)').run(id, folderId, JSON.stringify(rule));
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'folder-rules-delete') {
      const { folderId } = body;
      db.prepare('DELETE FROM library_folder_rules WHERE folder_id = ?').run(folderId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('POST /api/library error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
