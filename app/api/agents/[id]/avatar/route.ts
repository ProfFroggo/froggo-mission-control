// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();

// Max avatar dimension in pixels. Covers 2× retina at the largest display
// size (2xl = 80 CSS px → 160 device px). Rounding up to 192 for headroom.
const MAX_AVATAR_PX = 192;

type Params = { params: Promise<{ id: string }> };

// Lazy-load sharp — only imported when a raster image needs resizing.
// If sharp isn't available (e.g. edge runtime), we fall back to the original image.
let _sharp: typeof import('sharp') | null | false = null;
async function getSharp() {
  if (_sharp === false) return null; // previously failed
  if (_sharp) return _sharp;
  try {
    _sharp = (await import('sharp')).default as unknown as typeof import('sharp');
    return _sharp;
  } catch {
    _sharp = false;
    return null;
  }
}

// GET /api/agents/[id]/avatar
// Serves the agent's avatar image from ~/mission-control/agents/{id}/assets/avatar.webp (or .png fallback)
// Raster images are automatically resized to MAX_AVATAR_PX and converted to WebP
// to keep transfer size ≤ 20 KB. SVGs are served as-is.
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

  const cacheHeaders = {
    // Agent avatars are static images that rarely change.
    // Cache for 1 hour to avoid re-downloading on every page load.
    // Browsers will revalidate after max-age expires.
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  };

  const raw = readFileSync(found.path);

  // SVGs are vector — serve as-is (already small, sharp can't meaningfully optimize)
  if (found.type === 'image/svg+xml') {
    return new NextResponse(raw, {
      status: 200,
      headers: { 'Content-Type': found.type, ...cacheHeaders },
    });
  }

  // Raster images: resize to MAX_AVATAR_PX and convert to WebP.
  // No avatar is displayed larger than 80 CSS px (2xl size), so 192 px covers
  // 2× retina with headroom. This reduces 256-888 KB originals to ~5-15 KB.
  try {
    const sharp = await getSharp();
    if (sharp) {
      const resized = await (sharp as any)(raw)
        .resize(MAX_AVATAR_PX, MAX_AVATAR_PX, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      return new NextResponse(resized, {
        status: 200,
        headers: { 'Content-Type': 'image/webp', ...cacheHeaders },
      });
    }
  } catch {
    // Sharp resize failed — fall through to serve original
  }

  // Fallback: serve original image if sharp is unavailable or errors
  return new NextResponse(raw, {
    status: 200,
    headers: { 'Content-Type': found.type, ...cacheHeaders },
  });
}
