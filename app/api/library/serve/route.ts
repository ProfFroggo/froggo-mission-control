// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Serves files from the mission-control library directory.
 * Used by the ArtifactPanel to preview HTML/SVG/image files that agents create.
 *
 * GET /api/library/serve?path=/Users/.../mission-control/library/file.html
 */
import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { isInsideMissionControl } from '@/lib/missionControlPaths';
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

  // Security: must be inside ~/mission-control/
  const mcBase = path.resolve(path.dirname(ENV.LIBRARY_PATH)); // ~/mission-control
  const filePath = path.resolve(resolved);

  if (!isInsideMissionControl(filePath, mcBase)) {
    return NextResponse.json({ error: 'Path outside mission-control directory' }, { status: 403 });
  }

  // Resolve the actual file — handles several common agent path variations:
  // 1. Exact path works as-is
  // 2. Path is a directory → look for same-named file or index.html inside
  // 3. Path like .../Name.html but actual file is .../Name/Name.html
  const resolvedFile = resolveLibraryFile(filePath);
  if (!resolvedFile || !isInsideMissionControl(resolvedFile, mcBase)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const ext = path.extname(resolvedFile).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const isText = contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('svg');

  try {
    if (isText) {
      const content = fs.readFileSync(resolvedFile, 'utf-8');
      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      const buffer = fs.readFileSync(resolvedFile);
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    }
  } catch (err) {
    console.warn('[library/serve] Non-critical:', err);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

/**
 * Resolve a library file path with fallbacks for common agent path variations.
 * Returns the resolved path or null if nothing found.
 */
function resolveLibraryFile(filePath: string): string | null {
  // 1. Exact path exists and is a file
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }

  // 2. Path is a directory → look for same-named file or index.html inside
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const dirName = path.basename(filePath);
    // Try same-named .html file inside (e.g. Report/Report.html)
    for (const ext of ['.html', '.htm', '.md', '.svg']) {
      const candidate = path.join(filePath, dirName + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
    // Try index.html
    const indexHtml = path.join(filePath, 'index.html');
    if (fs.existsSync(indexHtml)) return indexHtml;
    return null;
  }

  // 3. Path like .../Name.html doesn't exist → check if .../Name/Name.html does
  //    (agents often output the file path without the same-named parent directory)
  const ext = path.extname(filePath);
  if (ext) {
    const baseName = path.basename(filePath, ext);
    const parentCandidate = path.join(path.dirname(filePath), baseName, baseName + ext);
    if (fs.existsSync(parentCandidate) && fs.statSync(parentCandidate).isFile()) {
      return parentCandidate;
    }
  }

  return null;
}
