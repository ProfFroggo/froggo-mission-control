// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Reveals a library file in the macOS Finder (or file manager on other platforms).
 *
 * POST /api/library/reveal  { "path": "/Users/.../mission-control/library/file.html" }
 */
import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export async function POST(req: Request) {
  let rawPath: string;
  try {
    const body = await req.json();
    rawPath = body.path;
  } catch (err) {
    console.warn('[library/reveal] Non-critical:', err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!rawPath || typeof rawPath !== 'string') {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Resolve ~ to home directory
  const resolved = rawPath.startsWith('~/')
    ? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', rawPath.slice(2))
    : rawPath;

  // Security: must be inside the library directory
  const libraryDir = path.resolve(ENV.LIBRARY_PATH);
  const filePath = path.resolve(resolved);

  if (!filePath.startsWith(libraryDir + path.sep) && filePath !== libraryDir) {
    return NextResponse.json({ error: 'Path outside library directory' }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  return new Promise<NextResponse>((resolve) => {
    // `open -R` reveals the file in Finder (macOS); falls back gracefully on other platforms
    const cmd = process.platform === 'darwin'
      ? `open -R "${filePath.replace(/"/g, '\\"')}"`
      : process.platform === 'win32'
        ? `explorer /select,"${filePath.replace(/"/g, '\\"')}"`
        : `xdg-open "${path.dirname(filePath).replace(/"/g, '\\"')}"`;

    exec(cmd, (err) => {
      if (err) {
        resolve(NextResponse.json({ error: 'Failed to reveal file' }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ success: true }));
      }
    });
  });
}
