// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();

type Params = { params: Promise<{ id: string }> };

// GET /api/agents/[id]/avatar
// Serves the agent's avatar image from ~/mission-control/agents/{id}/assets/avatar.webp (or .png fallback)
// Returns 404 if no avatar exists.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const guard = validateAgentId(id);
  if (guard) return new NextResponse(null, { status: 400 });

  // 1. Hired workspace avatar (webp → png → svg)
  // 2. Catalog package avatar (webp → png)
  const candidates = [
    { path: join(HOME, 'mission-control', 'agents', id, 'assets', 'avatar.webp'), type: 'image/webp' },
    { path: join(HOME, 'mission-control', 'agents', id, 'assets', 'avatar.png'), type: 'image/png' },
    { path: join(HOME, 'mission-control', 'agents', id, 'assets', 'avatar.svg'), type: 'image/svg+xml' },
    { path: join(process.cwd(), 'catalog', 'agents', id, 'avatar.webp'), type: 'image/webp' },
    { path: join(process.cwd(), 'catalog', 'agents', id, 'avatar.png'), type: 'image/png' },
  ];

  const found = candidates.find(c => existsSync(c.path));
  if (!found) {
    return new NextResponse(null, { status: 404 });
  }

  const image = readFileSync(found.path);
  return new NextResponse(image, {
    status: 200,
    headers: {
      'Content-Type': found.type,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
