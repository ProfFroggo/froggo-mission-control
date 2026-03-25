// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Serves files from the mission-control library directory.
 * Used by the ArtifactPanel to preview HTML/SVG/image files that agents create.
 *
 * GET /api/library/serve?path=/Users/.../mission-control/library/file.html
 */
import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import * as fs from 'fs';
import * as path from 'path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.svg':  'image/svg+xml; charset=utf-8',
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get('path');

  if (!rawPath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  // Resolve ~ to home dir
  const resolved = rawPath.startsWith('~/')
    ? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', rawPath.slice(2))
    : rawPath;

  // Security: must be inside the library directory
  const libraryDir = path.resolve(ENV.LIBRARY_PATH);
  const filePath = path.resolve(resolved);

  if (!filePath.startsWith(libraryDir + path.sep) && !filePath.startsWith(libraryDir)) {
    return NextResponse.json({ error: 'Path outside library directory' }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const isText = contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('svg');

  try {
    if (isText) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      const buffer = fs.readFileSync(filePath);
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
