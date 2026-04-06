// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/brand-assets/[id]/file — serve the physical file for a brand asset
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  pdf: 'application/pdf',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare('SELECT filePath, fileName FROM brand_assets WHERE id = ?')
      .get(id) as { filePath: string; fileName: string } | undefined;

    if (!row?.filePath) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (!fs.existsSync(row.filePath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    const ext = path.extname(row.fileName || row.filePath).slice(1).toLowerCase();
    const mimeType = EXT_TO_MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(row.filePath);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${row.fileName || 'asset'}"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
