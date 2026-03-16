// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/projects/[id]/file?name=filename.ext — serve a file from the project directory
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
  '.sh': 'text/plain', '.py': 'text/plain', '.ts': 'text/plain', '.tsx': 'text/plain',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('name');

  if (!fileName) {
    return NextResponse.json({ error: 'name parameter required' }, { status: 400 });
  }

  // Sanitize — no path traversal, allow subdirectories
  const safe = fileName.replace(/\.\.\//g, '').replace(/^\//, '');
  const projectDir = join(homedir(), 'mission-control', 'library', 'projects', projectId);
  const filePath = join(projectDir, safe);

  // Ensure the resolved path is still inside the project directory
  if (!filePath.startsWith(projectDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: 'Not a file' }, { status: 400 });
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);

  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Content-Length': String(content.length),
    'Cache-Control': 'private, max-age=60',
  };

  // HTML files: remove CSP so CDN scripts (Tailwind, etc.) work in iframe preview
  if (ext === '.html' || ext === '.htm') {
    headers['Content-Security-Policy'] = '';
    headers['X-Frame-Options'] = 'SAMEORIGIN';
  }

  return new NextResponse(content, { headers });
}
