// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/knowledge — list all articles (with optional ?category=&scope=&search=)
// POST /api/knowledge — create article
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { syncArticleToFilesystem } from '@/lib/knowledgeSync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim();
  const category = searchParams.get('category');
  const scope = searchParams.get('scope');

  try {
    let articles: Record<string, unknown>[];
    if (search) {
      // FTS search — fall back to LIKE if FTS unavailable
      try {
        articles = db.prepare(`
          SELECT kb.* FROM knowledge_base kb
          JOIN knowledge_base_fts fts ON fts.rowid = kb.rowid
          WHERE knowledge_base_fts MATCH ?
          ORDER BY kb.pinned DESC, rank
          LIMIT 20
        `).all(search) as Record<string, unknown>[];
      } catch {
        articles = db.prepare(`
          SELECT * FROM knowledge_base
          WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
          ORDER BY pinned DESC, updatedAt DESC
          LIMIT 20
        `).all(`%${search}%`, `%${search}%`, `%${search}%`) as Record<string, unknown>[];
      }
    } else {
      let q = 'SELECT * FROM knowledge_base WHERE 1=1';
      const params: unknown[] = [];
      if (category) { q += ' AND category = ?'; params.push(category); }
      if (scope) { q += ' AND (scope = ? OR scope = \'all\')'; params.push(scope); }
      q += ' ORDER BY pinned DESC, updatedAt DESC';
      articles = db.prepare(q).all(...params) as Record<string, unknown>[];
    }

    // Parse tags JSON
    const parsed = articles.map((a) => ({
      ...a,
      tags: (() => { try { return JSON.parse(a.tags as string); } catch { return []; } })(),
      pinned: Boolean(a.pinned),
    }));

    return NextResponse.json({ success: true, articles: parsed }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'Content-Type': 'application/json',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const body = await req.json();
    const { title, content, category = 'general', tags = [], scope = 'all', pinned = false } = body;
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'title and content are required' }, { status: 400 });
    }
    const now = Date.now();
    const id = `kb-${now}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
      INSERT INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'human', ?, ?)
    `).run(id, title.trim(), content.trim(), category, JSON.stringify(tags), scope, pinned ? 1 : 0, now, now);

    // Sync to filesystem
    syncArticleToFilesystem({ id, title: title.trim(), content: content.trim(), category, tags, scope, createdBy: 'human', updatedAt: now });

    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
