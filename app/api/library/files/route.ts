import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ENV } from '@/lib/env';
import * as fs from 'fs';
import * as path from 'path';

const MIME_MAP: Record<string, string> = {
  '.md':   'text/markdown',
  '.txt':  'text/plain',
  '.pdf':  'application/pdf',
  '.json': 'application/json',
  '.ts':   'text/x-typescript',
  '.tsx':  'text/x-typescript',
  '.js':   'text/javascript',
  '.jsx':  'text/javascript',
  '.py':   'text/x-python',
  '.sh':   'text/x-shellscript',
  '.csv':  'text/csv',
  '.html': 'text/html',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.mp3':  'audio/mpeg',
  '.mov':  'video/quicktime',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

function getCategory(filePath: string, libraryRoot: string): string {
  const rel = path.relative(libraryRoot, filePath).replace(/\\/g, '/');
  const topDir = rel.split('/')[0];
  // Category = top-level library directory name
  if (topDir === 'code')      return 'code';
  if (topDir === 'design')    return 'design';
  if (topDir === 'docs')      return 'docs';
  if (topDir === 'campaigns') return 'campaigns';
  if (topDir === 'projects')  return 'projects';
  return 'other';
}

function isPlaceholder(p: string): boolean {
  return p.includes('{') || p.includes('}');
}

function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue; // skip .DS_Store, hidden
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!isPlaceholder(entry)) walkDir(full, files);
    } else {
      if (!isPlaceholder(full)) files.push(full);
    }
  }
  return files;
}

export async function GET() {
  try {
    const libraryRoot = ENV.LIBRARY_PATH;
    const db = getDb();

    // Walk filesystem
    const fsFiles = walkDir(libraryRoot);

    // Build a map of filePath → task attachment metadata
    const attachments = db.prepare(
      'SELECT filePath, taskId, uploadedBy, category, createdAt FROM task_attachments'
    ).all() as { filePath: string; taskId: string; uploadedBy: string; category: string; createdAt: number }[];
    const attachMap = new Map<string, typeof attachments[0]>();
    for (const a of attachments) {
      attachMap.set(path.normalize(a.filePath), a);
    }

    // Build file list from filesystem
    const seen = new Set<string>();
    type FileItem = {
      id: string; name: string; path: string; category: string;
      size: number; mimeType: string; createdAt: string; updatedAt: string;
      linkedTasks: string[]; tags: string[]; project: string | null;
    };
    const files: FileItem[] = [];

    for (const filePath of fsFiles) {
      const normalized = path.normalize(filePath);
      seen.add(normalized);
      const stat = fs.statSync(filePath);
      const attach = attachMap.get(normalized);
      const relForId = path.relative(libraryRoot, filePath);

      files.push({
        id: Buffer.from(relForId).toString('base64url'),
        name: path.basename(filePath),
        path: filePath,
        category: attach?.category || getCategory(filePath, libraryRoot),
        size: stat.size,
        mimeType: getMimeType(filePath),
        createdAt: new Date(stat.birthtime || stat.mtime).toISOString(),
        updatedAt: new Date(stat.mtime).toISOString(),
        linkedTasks: attach?.taskId ? [attach.taskId] : [],
        tags: [],
        project: null,
      });
    }

    // Add any DB-tracked attachments that point outside the library root or weren't found
    for (const attach of attachments) {
      const normalized = path.normalize(attach.filePath);
      if (seen.has(normalized)) continue; // already included
      if (!fs.existsSync(attach.filePath)) continue; // file gone
      const stat = fs.statSync(attach.filePath);
      const relForId = attach.filePath.replace(/\//g, '_');
      files.push({
        id: Buffer.from(relForId).toString('base64url'),
        name: path.basename(attach.filePath),
        path: attach.filePath,
        category: attach.category || 'other',
        size: stat.size,
        mimeType: getMimeType(attach.filePath),
        createdAt: new Date(attach.createdAt).toISOString(),
        updatedAt: new Date(stat.mtime).toISOString(),
        linkedTasks: [attach.taskId],
        tags: [],
        project: null,
      });
    }

    // Sort newest first (by mtime)
    files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ files });
  } catch (error) {
    console.error('GET /api/library/files error:', error);
    return NextResponse.json({ files: [] });
  }
}
