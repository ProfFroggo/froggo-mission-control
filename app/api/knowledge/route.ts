// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/knowledge — list all articles (with optional ?category=&scope=&search=)
// POST /api/knowledge — create article
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { syncArticleToFilesystem } from '@/lib/knowledgeSync';

export const dynamic = 'force-dynamic';

/**
 * Sanitize a user-provided search string for safe use in FTS5 MATCH expressions.
 *
 * FTS5 has special syntax characters: " ( ) ^ * - that can cause SQLITE_ERROR
 * when passed directly as MATCH operands. This function strips those characters
 * so that arbitrary user input never triggers a parse error in the FTS engine.
 *
 * Hyphens are also stripped: FTS5 can treat "-term" as a NOT operator, and the
 * unicode61 tokenizer treats hyphens as word boundaries — so stripping them
 * produces the same tokens the tokenizer would anyway (e.g. "step-by-step"
 * becomes "step by step", matching all three terms).
 *
 * We deliberately do NOT support FTS5 boolean operators from user input —
 * the query is treated as a set of plain terms, all of which must appear.
 */
// Canonical export lives in @/lib/knowledgeSearch — do not export from route file.
function sanitizeFtsQuery(q: string): string {
  return q
    .replace(/["()*^-]/g, ' ') // strip FTS5 special chars (including hyphen/NOT operator)
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim();
  const category = searchParams.get('category');
  const scope = searchParams.get('scope');

  try {
    let articles: Record<string, unknown>[];
    if (search) {
      // Build optional filter clauses that apply to BOTH FTS and LIKE paths.
      // Previously, category and scope were silently ignored when search was
      // provided — the two branches were mutually exclusive. Now both filters
      // are combined with the search on both code paths.
      const filterClauses: string[] = [];
      const filterParams: unknown[] = [];
      if (category) {
        filterClauses.push('kb.category = ?');
        filterParams.push(category);
      }
      if (scope) {
        filterClauses.push("(kb.scope = ? OR kb.scope = 'all')");
        filterParams.push(scope);
      }
      const filterSql = filterClauses.length
        ? ' AND ' + filterClauses.join(' AND ')
        : '';

      // FTS search with BM25 relevance ranking and snippet extraction.
      // Falls back to LIKE if FTS is unavailable.
      try {
        const safeQuery = sanitizeFtsQuery(search);
        if (!safeQuery) {
          // After sanitization nothing remains — return empty without hitting the DB
          articles = [];
        } else {
          // BM25 weights: title=10× content=1× tags=5× — boosts title and tag
          // matches over body matches, reflecting typical user intent.
          // snippet() extracts the most relevant 15-token excerpt from content
          // (column index 1) with <mark> highlighting so the UI can show why
          // a result matched without loading the full article body.
          // knowledge_base_fts MUST be the first (primary) table in FROM.
          // SQLite FTS5 auxiliary functions bm25() and snippet() are only
          // available when the FTS virtual table is the leftmost table in the
          // FROM clause — they raise "no such function" if used on a JOIN target.
          articles = db.prepare(`
            SELECT kb.*,
              snippet(knowledge_base_fts, 1, '<mark>', '</mark>', '...', 15) AS matchSnippet
            FROM knowledge_base_fts
            JOIN knowledge_base kb ON kb.rowid = knowledge_base_fts.rowid
            WHERE knowledge_base_fts MATCH ?${filterSql}
            ORDER BY kb.pinned DESC, bm25(knowledge_base_fts, 10.0, 1.0, 5.0)
            LIMIT 20
          `).all(safeQuery, ...filterParams) as Record<string, unknown>[];
        }
      } catch {
        // FTS unavailable or query still failed — fall back to LIKE with filters
        const likeClauses: string[] = ['(title LIKE ? OR content LIKE ? OR tags LIKE ?)'];
        const likeParams: unknown[] = [`%${search}%`, `%${search}%`, `%${search}%`];
        if (category) {
          likeClauses.push('category = ?');
          likeParams.push(category);
        }
        if (scope) {
          likeClauses.push("(scope = ? OR scope = 'all')");
          likeParams.push(scope);
        }
        articles = db.prepare(`
          SELECT * FROM knowledge_base
          WHERE ${likeClauses.join(' AND ')}
          ORDER BY pinned DESC, updatedAt DESC
          LIMIT 20
        `).all(...likeParams) as Record<string, unknown>[];
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
