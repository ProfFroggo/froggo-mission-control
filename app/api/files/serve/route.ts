// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/files/serve?path=... — serve raw file bytes for preview (images, HTML, PDF, video)
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { homedir } from 'os';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  pdf: 'application/pdf',
  html: 'text/html', htm: 'text/html',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  md: 'text/plain', txt: 'text/plain', json: 'application/json',
};

const ALLOWED_ROOTS = [
  ENV.LIBRARY_PATH,
  ENV.VAULT_PATH,
  `${homedir()}/mission-control/agents`,
];

function isAllowedPath(p: string): boolean {
  return ALLOWED_ROOTS.some(root => p.startsWith(root + '/') || p === root);
}

export async function GET(request: NextRequest) {
  const rawPath = new URL(request.url).searchParams.get('path');
  if (!rawPath) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const filePath = rawPath.startsWith('~/') ? `${homedir()}${rawPath.slice(1)}` : rawPath;

  if (!isAllowedPath(filePath)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!statSync(filePath).isFile()) return NextResponse.json({ error: 'Not a file' }, { status: 400 });

  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME[ext] ?? 'application/octet-stream';
  const bytes = readFileSync(filePath);

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=300',
    },
  });
}
