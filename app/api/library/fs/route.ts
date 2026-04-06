// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/library/fs?path= — list real filesystem directories under LIBRARY_PATH
// POST /api/library/fs — write a file to the library (auto-save artifacts)
import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, normalize, dirname } from 'path';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

interface DirEntry {
  name: string;
  path: string;         // absolute
  rel: string;          // relative to basePath
  depth: number;
  hasChildren: boolean; // has sub-directories
  fileCount: number;    // direct files (not recursive)
}

function countDirectFiles(dir: string): number {
  try {
    return readdirSync(dir).filter(e => {
      if (e.startsWith('.')) return false;
      try { return statSync(join(dir, e)).isFile(); } catch { return false; }
    }).length;
  } catch { return 0; }
}

function hasSubDirs(dir: string): boolean {
  try {
    return readdirSync(dir).some(e => {
      if (e.startsWith('.')) return false;
      try { return statSync(join(dir, e)).isDirectory(); } catch { return false; }
    });
  } catch { return false; }
}

function walkDirs(root: string, basePath: string, result: DirEntry[] = [], depth = 0): DirEntry[] {
  if (!existsSync(root)) return result;
  let entries: string[];
  try { entries = readdirSync(root).sort(); } catch { return result; }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = join(root, entry);
    let isDir = false;
    try { isDir = statSync(full).isDirectory(); } catch { continue; }
    if (!isDir) continue;
    const rel = relative(basePath, full);
    result.push({
      name: entry,
      path: full,
      rel,
      depth,
      hasChildren: hasSubDirs(full),
      fileCount: countDirectFiles(full),
    });
    walkDirs(full, basePath, result, depth + 1);
  }
  return result;
}

export async function GET(request: NextRequest) {
  const basePath = ENV.LIBRARY_PATH;
  const rawPath = new URL(request.url).searchParams.get('path');

  // If a specific path is requested, only list its immediate children
  if (rawPath) {
    const targetPath = normalize(rawPath.startsWith('~/') ? rawPath.replace('~', process.env.HOME || '') : rawPath);
    // Security: must be within library
    if (!targetPath.startsWith(basePath)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const dirs = walkDirs(targetPath, basePath);
    return NextResponse.json({ dirs, basePath });
  }

  // Full tree walk
  const dirs = walkDirs(basePath, basePath);
  return NextResponse.json({ dirs, basePath });
}

/** POST /api/library/fs — write a file to the library directory.
 *  Used by artifact auto-save to persist chat-generated deliverables. */
export async function POST(request: NextRequest) {
  try {
    const { action, path: filePath, content, folder } = await request.json();
    if (action !== 'write') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    if (!filePath || typeof filePath !== 'string' || !content) {
      return NextResponse.json({ error: 'path and content required' }, { status: 400 });
    }

    const basePath = ENV.LIBRARY_PATH;
    // Build target: library/{folder?}/{filename}
    const subdir = folder ? join(basePath, folder) : basePath;
    const safeName = filePath.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const target = join(subdir, safeName);

    // Security: must be within library
    if (!normalize(target).startsWith(normalize(basePath))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Don't overwrite existing files — add suffix
    let finalPath = target;
    if (existsSync(finalPath)) {
      const ext = safeName.includes('.') ? '.' + safeName.split('.').pop() : '';
      const base = ext ? safeName.slice(0, -ext.length) : safeName;
      let i = 2;
      while (existsSync(join(subdir, `${base}_${i}${ext}`))) i++;
      finalPath = join(subdir, `${base}_${i}${ext}`);
    }

    mkdirSync(dirname(finalPath), { recursive: true });
    writeFileSync(finalPath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      path: finalPath,
      relativePath: relative(basePath, finalPath),
    });
  } catch (error) {
    console.error('[library/fs] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
