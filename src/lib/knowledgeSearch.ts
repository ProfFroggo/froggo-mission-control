// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/knowledgeSearch.ts
// Shared search utilities for knowledge base FTS5 queries.

/**
 * Sanitize a user-provided search string for safe use in FTS5 MATCH expressions.
 *
 * FTS5 special syntax characters that cause SQLITE_ERROR when passed directly:
 *   "   — phrase quotes
 *   ( ) — sub-expression grouping
 *   *   — prefix token query
 *   ^   — initial token query
 *   -   — negation operator (e.g. "email -spam" would exclude "spam")
 *
 * We strip all of these so that arbitrary user input is treated as plain terms.
 * We deliberately do NOT support FTS5 boolean operators from user input —
 * every remaining term is implicitly ANDed by the FTS engine.
 *
 * Note: the hyphen (-) is placed last in the bracket expression to prevent the
 * regex engine from treating it as a character-range operator.
 *
 * Returns an empty string when the sanitized result has no usable terms.
 */
export function sanitizeFtsQuery(q: string): string {
  return q
    .replace(/["()*^-]/g, ' ') // strip all FTS5 special chars, including hyphen
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Query builder ─────────────────────────────────────────────────────────────

/**
 * Options for buildKnowledgeSearchQueries.
 */
export interface KnowledgeSearchOptions {
  /** Raw user query — sanitized internally for the FTS path. */
  query: string;
  /** Optional category filter applied in SQL (not post-query). */
  category?: string;
  /** Optional scope filter applied in SQL (not post-query). */
  scope?: string;
  /** Maximum rows to return. Defaults to 20. */
  limit?: number;
}

export interface SearchQuery {
  sql: string;
  params: unknown[];
}

export interface KnowledgeSearchQueries {
  /**
   * FTS5 query via knowledge_base_fts virtual table.
   * null when the sanitized query is empty (nothing to search for).
   */
  fts: SearchQuery | null;
  /** LIKE-based fallback used when FTS is unavailable or errors. */
  fallback: SearchQuery;
}

/**
 * Build the SQL + parameter pairs for a knowledge base search.
 *
 * Returns both an FTS query and a LIKE fallback so callers can try FTS first
 * and fall back gracefully on SQLITE_ERROR or a missing virtual table.
 *
 * Both paths:
 *   - Apply category and scope filters in SQL (never post-query in JS)
 *   - Order by pinned DESC first so pinned articles always surface at the top
 *   - Respect the limit cap
 *
 * The FTS path orders by: pinned DESC, then rank (FTS relevance score).
 * The LIKE fallback orders by: pinned DESC, then updatedAt DESC.
 */
export function buildKnowledgeSearchQueries(opts: KnowledgeSearchOptions): KnowledgeSearchQueries {
  const { query, category, scope, limit = 20 } = opts;
  const safeQuery = sanitizeFtsQuery(query);

  // ── FTS path filter clauses (uses kb.* alias) ─────────────────────────────
  const ftsFilterClauses: string[] = [];
  const ftsFilterParams: unknown[] = [];
  if (category) {
    ftsFilterClauses.push('kb.category = ?');
    ftsFilterParams.push(category);
  }
  if (scope) {
    ftsFilterClauses.push("(kb.scope = ? OR kb.scope = 'all')");
    ftsFilterParams.push(scope);
  }
  const ftsFilterSql = ftsFilterClauses.length
    ? ' AND ' + ftsFilterClauses.join(' AND ')
    : '';

  // ── FTS query ─────────────────────────────────────────────────────────────
  // bm25() weights: title=10×, content=1×, tags=5× — title matches rank first.
  // snippet() extracts a 15-token excerpt with <mark> highlighting from the
  // content column (index 1) so callers can show why a result matched.
  // knowledge_base_fts MUST be the first (primary) table in FROM.
  // SQLite FTS5 auxiliary functions bm25() and snippet() require the FTS virtual
  // table to be the leftmost table in the FROM clause; using it only as a JOIN
  // target causes "no such function: bm25 / snippet" at runtime.
  const fts: SearchQuery | null = safeQuery
    ? {
        sql: `
          SELECT kb.*,
            snippet(knowledge_base_fts, 1, '<mark>', '</mark>', '...', 15) AS matchSnippet
          FROM knowledge_base_fts
          JOIN knowledge_base kb ON kb.rowid = knowledge_base_fts.rowid
          WHERE knowledge_base_fts MATCH ?${ftsFilterSql}
          ORDER BY kb.pinned DESC, bm25(knowledge_base_fts, 10.0, 1.0, 5.0)
          LIMIT ${limit}
        `,
        params: [safeQuery, ...ftsFilterParams],
      }
    : null;

  // ── LIKE fallback (unaliased columns) ─────────────────────────────────────
  const likeClauses: string[] = ['(title LIKE ? OR content LIKE ? OR tags LIKE ?)'];
  const likeParams: unknown[] = [`%${query}%`, `%${query}%`, `%${query}%`];
  if (category) {
    likeClauses.push('category = ?');
    likeParams.push(category);
  }
  if (scope) {
    likeClauses.push("(scope = ? OR scope = 'all')");
    likeParams.push(scope);
  }

  const fallback: SearchQuery = {
    sql: `
      SELECT * FROM knowledge_base
      WHERE ${likeClauses.join(' AND ')}
      ORDER BY pinned DESC, updatedAt DESC
      LIMIT ${limit}
    `,
    params: likeParams,
  };

  return { fts, fallback };
}
