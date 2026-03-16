// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/brand-assets — list brand assets
// POST /api/brand-assets — create brand asset
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim();
  const category = searchParams.get('category');
  const scope = searchParams.get('scope');
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    let assets: Record<string, unknown>[];

    if (search) {
      assets = db.prepare(`
        SELECT * FROM brand_assets
        WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `).all(`%${search}%`, `%${search}%`, `%${search}%`, limit, offset) as Record<string, unknown>[];
    } else {
      let q = 'SELECT * FROM brand_assets WHERE 1=1';
      const params: unknown[] = [];
      if (category && category !== 'all') { q += ' AND category = ?'; params.push(category); }
      if (scope) { q += ' AND (scope = ? OR scope = \'all\')'; params.push(scope); }
      q += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      assets = db.prepare(q).all(...params) as Record<string, unknown>[];
    }

    const parsed = assets.map((a) => ({
      ...a,
      tags: (() => { try { return JSON.parse(a.tags as string); } catch { return []; } })(),
    }));

    return NextResponse.json({ success: true, assets: parsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const body = await req.json();
    const {
      name,
      description = '',
      category = 'general',
      fileType = 'image',
      fileName = '',
      filePath = '',
      url = '',
      tags = [],
      scope = 'all',
    } = body as {
      name?: string;
      description?: string;
      category?: string;
      fileType?: string;
      fileName?: string;
      filePath?: string;
      url?: string;
      tags?: string[];
      scope?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const now = Date.now();
    const id = `ba-${now}-${Math.random().toString(36).slice(2, 7)}`;

    db.prepare(`
      INSERT INTO brand_assets (id, name, description, category, fileType, fileName, filePath, url, tags, scope, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'human', ?, ?)
    `).run(id, name.trim(), description, category, fileType, fileName, filePath, url, JSON.stringify(tags), scope, now, now);

    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
