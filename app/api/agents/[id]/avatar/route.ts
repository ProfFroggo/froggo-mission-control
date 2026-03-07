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
// Serves the agent's avatar image from ~/mission-control/agents/{id}/assets/avatar.png
// Returns 404 if no avatar exists.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const guard = validateAgentId(id);
  if (guard) return new NextResponse(null, { status: 400 });

  // 1. Hired workspace avatar
  // 2. Catalog package avatar (pre-hire)
  const candidates = [
    join(HOME, 'mission-control', 'agents', id, 'assets', 'avatar.png'),
    join(process.cwd(), 'catalog', 'agents', id, 'avatar.png'),
  ];

  const avatarPath = candidates.find(p => existsSync(p));
  if (!avatarPath) {
    return new NextResponse(null, { status: 404 });
  }

  const image = readFileSync(avatarPath);
  return new NextResponse(image, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
