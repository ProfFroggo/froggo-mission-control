// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Catch-all: GET /api/projects/[id]/images/hero.png → serves from project dir
// This enables relative paths in HTML files (e.g., <img src="images/hero.png">)
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { homedir } from 'os';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.md': 'text/markdown',
  '.txt': 'text/plain', '.csv': 'text/csv',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.sh': 'text/plain', '.py': 'text/plain', '.ts': 'text/plain',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; filepath: string[] }> }
) {
  const { id: projectId, filepath } = await params;
  const relativePath = filepath.join('/');

  // Sanitize
  if (relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const projectDir = join(homedir(), 'mission-control', 'library', 'projects', projectId);
  const filePath = join(projectDir, relativePath);

  if (!filePath.startsWith(projectDir) || !existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: 'Not a file' }, { status: 400 });
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);

  return new NextResponse(content, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(content.length),
      'Cache-Control': 'private, max-age=300',
    },
  });
}
