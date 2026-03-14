// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET  /api/knowledge/[id]/analytics — { views, lastViewedAt, relatedArticles }
// POST /api/knowledge/[id]/analytics — body: { event: 'view' }
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const article = db.prepare('SELECT id, category FROM knowledge_base WHERE id = ?').get(params.id) as
    | { id: string; category: string }
    | undefined;
  if (!article) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const viewRow = db.prepare(
    `SELECT COUNT(*) as views, MAX(recordedAt) as lastViewedAt
     FROM knowledge_analytics WHERE articleId = ? AND event = 'view'`
  ).get(params.id) as { views: number; lastViewedAt: number | null };

  // Related = same category, ordered by view count desc, limit 5 (excluding current)
  const related = db.prepare(`
    SELECT kb.id, kb.title, kb.category, kb.tags, kb.updatedAt, kb.pinned,
           COUNT(ka.id) as viewCount
    FROM knowledge_base kb
    LEFT JOIN knowledge_analytics ka ON ka.articleId = kb.id AND ka.event = 'view'
    WHERE kb.category = ? AND kb.id != ?
    GROUP BY kb.id
    ORDER BY viewCount DESC, kb.updatedAt DESC
    LIMIT 5
  `).all(article.category, params.id) as Array<Record<string, unknown>>;

  const relatedParsed = related.map((a) => ({
    ...a,
    tags: (() => { try { return JSON.parse(a.tags as string); } catch { return []; } })(),
    pinned: Boolean(a.pinned),
  }));

  return NextResponse.json({
    success: true,
    views: viewRow.views ?? 0,
    lastViewedAt: viewRow.lastViewedAt ?? null,
    relatedArticles: relatedParsed,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  try {
    const body = await req.json().catch(() => ({}));
    const event = (body as { event?: string }).event ?? 'view';
    const article = db.prepare('SELECT id FROM knowledge_base WHERE id = ?').get(params.id);
    if (!article) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    db.prepare(
      `INSERT INTO knowledge_analytics (articleId, event, recordedAt) VALUES (?, ?, ?)`
    ).run(params.id, event, Date.now());
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
