// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/knowledge/:id/versions — return last 10 versions of an article
// POST /api/knowledge/:id/versions/restore — restore a version (handled via PATCH on parent)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const article = db.prepare('SELECT id FROM knowledge_base WHERE id = ?').get(params.id);
  if (!article) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const versions = db.prepare(
    `SELECT id, articleId, editedBy, editedAt, versionNote, content
     FROM knowledge_versions
     WHERE articleId = ?
     ORDER BY editedAt DESC
     LIMIT 10`
  ).all(params.id) as Array<{
    id: number;
    articleId: string;
    editedBy: string;
    editedAt: number;
    versionNote: string | null;
    content: string;
  }>;

  return NextResponse.json({ success: true, versions });
}
