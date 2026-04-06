// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/files/reveal — reveal a file in Finder/Explorer
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join, normalize, resolve } from 'path';

export const runtime = 'nodejs';

// Validate path stays within project root
const PROJECT_ROOT = process.cwd();

function isPathSafe(p: string): boolean {
  const resolved = resolve(p);
  return resolved.startsWith(PROJECT_ROOT);
}

export async function POST(request: NextRequest) {
  try {
    const { path: filePath } = await request.json();
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'path required' }, { status: 400 });
    }

    // Resolve to absolute path within project
    const absPath = filePath.startsWith('/') ? filePath : join(PROJECT_ROOT, filePath);
    const normalized = normalize(absPath);

    // Security: must stay within project root
    if (!isPathSafe(normalized)) {
      return NextResponse.json({ error: 'Path outside project root' }, { status: 403 });
    }

    if (!existsSync(normalized)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // macOS: open -R reveals in Finder; Linux: xdg-open directory
    // Use execFile with array args to prevent shell injection
    if (process.platform === 'darwin') {
      execFile('open', ['-R', normalized], (err) => {
        if (err) console.error('[files/reveal] exec error:', err);
      });
    } else {
      execFile('xdg-open', [dirname(normalized)], (err) => {
        if (err) console.error('[files/reveal] exec error:', err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/files/reveal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
