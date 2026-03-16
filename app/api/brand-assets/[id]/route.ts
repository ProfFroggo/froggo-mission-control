// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/brand-assets/:id — single asset
// PATCH /api/brand-assets/:id — update asset
// DELETE /api/brand-assets/:id — delete asset
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const asset = db.prepare('SELECT * FROM brand_assets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!asset) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    success: true,
    asset: {
      ...asset,
      tags: (() => { try { return JSON.parse(asset.tags as string); } catch { return []; } })(),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const asset = db.prepare('SELECT * FROM brand_assets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!asset) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const sets: string[] = ['updatedAt = ?'];
  const vals: unknown[] = [Date.now()];

  if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name); }
  if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
  if (body.category !== undefined) { sets.push('category = ?'); vals.push(body.category); }
  if (body.fileType !== undefined) { sets.push('fileType = ?'); vals.push(body.fileType); }
  if (body.fileName !== undefined) { sets.push('fileName = ?'); vals.push(body.fileName); }
  if (body.filePath !== undefined) { sets.push('filePath = ?'); vals.push(body.filePath); }
  if (body.url !== undefined) { sets.push('url = ?'); vals.push(body.url); }
  if (body.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(body.tags)); }
  if (body.scope !== undefined) { sets.push('scope = ?'); vals.push(body.scope); }

  vals.push(id);
  db.prepare(`UPDATE brand_assets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM brand_assets WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
