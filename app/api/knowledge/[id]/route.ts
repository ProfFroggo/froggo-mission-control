// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/knowledge/:id — read article
// PATCH /api/knowledge/:id — update article
// DELETE /api/knowledge/:id — delete article
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const article = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!article) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  const links = db.prepare('SELECT * FROM knowledge_base_links WHERE knowledgeId = ? ORDER BY createdAt ASC').all(id);
  const assets = db.prepare('SELECT * FROM knowledge_base_assets WHERE knowledgeId = ? ORDER BY createdAt ASC').all(id);
  return NextResponse.json({
    success: true,
    article: {
      ...article,
      tags: (() => { try { return JSON.parse(article.tags as string); } catch { return []; } })(),
      pinned: Boolean(article.pinned),
      links,
      assets,
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
  db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
