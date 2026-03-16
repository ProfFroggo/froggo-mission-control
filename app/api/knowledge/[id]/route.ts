// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/knowledge/:id — read article
// PATCH /api/knowledge/:id — update article
// DELETE /api/knowledge/:id — delete article
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { syncArticleToFilesystem, deleteArticleFromFilesystem } from '@/lib/knowledgeSync';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const article = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!article) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const links = db.prepare('SELECT * FROM knowledge_base_links WHERE knowledgeId = ? ORDER BY createdAt ASC').all(id);
  const assets = db.prepare('SELECT * FROM knowledge_base_assets WHERE knowledgeId = ? ORDER BY createdAt ASC').all(id);

  // Freshness score: 100 → 0 over 90 days
  const updatedAt = article.updatedAt as number || Date.now();
  const daysSinceUpdate = Math.floor((Date.now() - updatedAt) / (24 * 60 * 60 * 1000));
  const freshnessScore = Math.max(0, Math.min(100, 100 - Math.floor(daysSinceUpdate * (100 / 90))));

  // Related articles: overlapping tags (top 3)
  const articleTags: string[] = (() => { try { return JSON.parse(article.tags as string); } catch { return []; } })();
  let relatedArticles: Array<{ id: string; title: string; category: string }> = [];
  if (articleTags.length > 0) {
    const tagConditions = articleTags.filter(t => t.length > 2).slice(0, 5).map(() => 'tags LIKE ?').join(' OR ');
    if (tagConditions) {
      const tagParams = articleTags.filter(t => t.length > 2).slice(0, 5).map(t => `%${t}%`);
      relatedArticles = db.prepare(
        `SELECT id, title, category FROM knowledge_base WHERE id != ? AND (${tagConditions}) LIMIT 3`
      ).all(id, ...tagParams) as Array<{ id: string; title: string; category: string }>;
    }
  }

  return NextResponse.json({
    success: true,
    article: {
      ...article,
      tags: articleTags,
      pinned: Boolean(article.pinned),
      links,
      assets,
      freshnessScore,
      freshnessLabel: freshnessScore > 60 ? 'fresh' : freshnessScore > 30 ? 'aging' : 'stale',
      relatedArticles,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json().catch(() => ({}));
  const article = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!article) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  // Save current content to version history before updating (only if content is changing)
  if (body.content !== undefined && body.content !== article.content) {
    db.prepare(
      `INSERT INTO knowledge_versions (articleId, content, editedBy, editedAt, versionNote) VALUES (?, ?, ?, ?, ?)`
    ).run(id, article.content as string, body.editedBy ?? 'human', Date.now(), body.versionNote ?? null);
  }

  const sets: string[] = ['updatedAt = ?', 'version = version + 1'];
  const vals: unknown[] = [Date.now()];

  if (body.title !== undefined) { sets.push('title = ?'); vals.push(body.title); }
  if (body.content !== undefined) { sets.push('content = ?'); vals.push(body.content); }
  if (body.category !== undefined) { sets.push('category = ?'); vals.push(body.category); }
  if (body.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(body.tags)); }
  if (body.scope !== undefined) { sets.push('scope = ?'); vals.push(body.scope); }
  if (body.pinned !== undefined) { sets.push('pinned = ?'); vals.push(body.pinned ? 1 : 0); }

  vals.push(id);
  db.prepare(`UPDATE knowledge_base SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  // Sync updated article to filesystem
  const updated = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id) as Record<string, unknown>;
  if (updated) {
    syncArticleToFilesystem({
      id,
      title: updated.title as string,
      content: updated.content as string,
      category: updated.category as string,
      tags: (() => { try { return JSON.parse(updated.tags as string); } catch { return []; } })(),
      scope: updated.scope as string,
      updatedAt: updated.updatedAt as number,
    });
  }

  // Handle links upsert
  if (body.links !== undefined) {
    db.prepare('DELETE FROM knowledge_base_links WHERE knowledgeId = ?').run(id);
    for (const link of body.links as Array<{ url?: string; title?: string; description?: string }>) {
      if (!link.url?.trim()) continue;
      const lid = `kbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      db.prepare('INSERT INTO knowledge_base_links (id, knowledgeId, title, url, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(
        lid, id, link.title || link.url, link.url, link.description || '', Date.now()
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Get article before deleting for filesystem cleanup
  const article = db.prepare('SELECT title, category FROM knowledge_base WHERE id = ?').get(id) as { title: string; category: string } | undefined;

  db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);

  // Remove from filesystem
  if (article) {
    deleteArticleFromFilesystem({ title: article.title, category: article.category });
  }

  return NextResponse.json({ success: true });
}
