// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for src/lib/knowledgeSearch.ts
 *
 * Pure-function coverage — no database, no mocks needed:
 *   - sanitizeFtsQuery: all FTS5 special chars, edge cases
 *   - buildKnowledgeSearchQueries: FTS and fallback SQL structure, filters,
 *     empty-after-sanitization, limit override
 */

import { describe, it, expect } from 'vitest';
import { sanitizeFtsQuery, buildKnowledgeSearchQueries } from './knowledgeSearch';

// ─── sanitizeFtsQuery ──────────────────────────────────────────────────────────
describe('sanitizeFtsQuery', () => {
  it('passes through a plain alphanumeric query unchanged', () => {
    expect(sanitizeFtsQuery('agent setup')).toBe('agent setup');
  });

  it('strips double-quote characters (FTS5 phrase syntax)', () => {
    // "agent" "setup" → strip quotes → ' agent   setup ' → 'agent setup'
    expect(sanitizeFtsQuery('"agent" "setup"')).toBe('agent setup');
    expect(sanitizeFtsQuery('"agent"')).toBe('agent');
  });

  it('strips parentheses (FTS5 grouping syntax)', () => {
    expect(sanitizeFtsQuery('agent(setup)')).toBe('agent setup');
    // Leading/trailing parens become spaces, which trim() removes from ends
    expect(sanitizeFtsQuery('(agent OR setup)')).toBe('agent OR setup');
  });

  it('strips asterisk (FTS5 prefix wildcard)', () => {
    expect(sanitizeFtsQuery('agent*')).toBe('agent');
    expect(sanitizeFtsQuery('set*')).toBe('set');
  });

  it('strips caret (FTS5 initial token operator)', () => {
    expect(sanitizeFtsQuery('^agent')).toBe('agent');
  });

  it('strips hyphen (FTS5 negation operator)', () => {
    // Without this fix, "step-by-step" would cause SQLITE_ERROR in MATCH.
    expect(sanitizeFtsQuery('step-by-step')).toBe('step by step');
    expect(sanitizeFtsQuery('how-to')).toBe('how to');
    expect(sanitizeFtsQuery('e-mail setup')).toBe('e mail setup');
    // Bare hyphen alone should reduce to empty
    expect(sanitizeFtsQuery('-')).toBe('');
  });

  it('collapses multiple consecutive spaces into one', () => {
    expect(sanitizeFtsQuery('agent    setup   guide')).toBe('agent setup guide');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFtsQuery('  agent  ')).toBe('agent');
    expect(sanitizeFtsQuery('   ')).toBe('');
  });

  it('returns empty string when only special chars remain after stripping', () => {
    expect(sanitizeFtsQuery('***')).toBe('');
    expect(sanitizeFtsQuery('"()"')).toBe('');
    expect(sanitizeFtsQuery('--')).toBe('');
    expect(sanitizeFtsQuery('^*"()')).toBe('');
  });

  it('preserves numbers and non-Latin characters', () => {
    expect(sanitizeFtsQuery('agent123')).toBe('agent123');
    expect(sanitizeFtsQuery('café setup')).toBe('café setup');
  });

  it('handles empty string input', () => {
    expect(sanitizeFtsQuery('')).toBe('');
  });
});

// ─── buildKnowledgeSearchQueries ──────────────────────────────────────────────
describe('buildKnowledgeSearchQueries', () => {
  describe('FTS query (fts property)', () => {
    it('returns a non-null FTS query when the sanitized query is non-empty', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'agent' });
      expect(fts).not.toBeNull();
      expect(fts!.sql).toContain('knowledge_base_fts MATCH ?');
    });

    it('returns null FTS query when the sanitized query is empty', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: '***' });
      expect(fts).toBeNull();
    });

    it('returns null FTS query when input is blank', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: '   ' });
      expect(fts).toBeNull();
    });

    it('sanitizes the query before using it in FTS params', () => {
      // "step-by-step" should become "step by step" in the FTS param
      const { fts } = buildKnowledgeSearchQueries({ query: 'step-by-step' });
      expect(fts).not.toBeNull();
      expect(fts!.params[0]).toBe('step by step');
    });

    it('includes kb.pinned DESC in FTS ORDER BY', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'deploy' });
      expect(fts!.sql).toContain('kb.pinned DESC');
    });

    it('places knowledge_base_fts as the primary (first) FROM table for bm25/snippet compatibility', () => {
      // SQLite FTS5 auxiliary functions bm25() and snippet() require the FTS
      // virtual table to be the leftmost table in the FROM clause. Placing it as
      // a JOIN target instead causes a runtime "no such function" error.
      const { fts } = buildKnowledgeSearchQueries({ query: 'agent' });
      const sql = fts!.sql.replace(/\s+/g, ' ');
      // "FROM knowledge_base_fts" must appear BEFORE any "JOIN knowledge_base"
      const ftsFromPos = sql.indexOf('FROM knowledge_base_fts');
      const joinPos = sql.indexOf('JOIN knowledge_base');
      expect(ftsFromPos).toBeGreaterThanOrEqual(0); // FTS table must be in FROM
      expect(joinPos).toBeGreaterThan(ftsFromPos);  // real table must come after
    });

    it('applies no extra filter clauses when category and scope are omitted', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'setup' });
      expect(fts!.params).toHaveLength(1); // only the MATCH param
      expect(fts!.sql).not.toContain('kb.category');
      expect(fts!.sql).not.toContain('kb.scope');
    });

    it('appends category filter in SQL when category is provided', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'docs', category: 'technical' });
      expect(fts!.sql).toContain('kb.category = ?');
      // params: [safeQuery, category]
      expect(fts!.params).toEqual(['docs', 'technical']);
    });

    it('appends scope filter in SQL when scope is provided', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'docs', scope: 'agents' });
      expect(fts!.sql).toContain("kb.scope = ?");
      // params: [safeQuery, scope]
      expect(fts!.params).toEqual(['docs', 'agents']);
    });

    it('appends both category and scope filters in SQL when both are provided', () => {
      const { fts } = buildKnowledgeSearchQueries({
        query: 'deploy',
        category: 'ops',
        scope: 'devops',
      });
      expect(fts!.sql).toContain('kb.category = ?');
      expect(fts!.sql).toContain("kb.scope = ?");
      // params: [safeQuery, category, scope]
      expect(fts!.params).toEqual(['deploy', 'ops', 'devops']);
    });

    it('respects the limit option in the FTS SQL', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'agent', limit: 5 });
      expect(fts!.sql).toContain('LIMIT 5');
    });

    it('defaults limit to 20 in the FTS SQL', () => {
      const { fts } = buildKnowledgeSearchQueries({ query: 'agent' });
      expect(fts!.sql).toContain('LIMIT 20');
    });
  });

  describe('LIKE fallback query (fallback property)', () => {
    it('always returns a fallback query (never null)', () => {
      // Even when the FTS query would be null (all-special chars), fallback uses raw query
      const { fallback } = buildKnowledgeSearchQueries({ query: '***' });
      expect(fallback).not.toBeNull();
      expect(fallback.sql).toContain('LIKE');
    });

    it('uses the raw (unsanitized) query in LIKE params', () => {
      // LIKE is safe — no special chars to strip. "%" is added by the builder.
      const { fallback } = buildKnowledgeSearchQueries({ query: 'step-by-step' });
      expect(fallback.params[0]).toBe('%step-by-step%');
    });

    it('includes three LIKE params (title, content, tags) with no filters by default', () => {
      const { fallback } = buildKnowledgeSearchQueries({ query: 'docs' });
      expect(fallback.params).toEqual(['%docs%', '%docs%', '%docs%']);
    });

    it('appends category filter param when category is provided', () => {
      const { fallback } = buildKnowledgeSearchQueries({ query: 'docs', category: 'technical' });
      expect(fallback.sql).toContain('category = ?');
      expect(fallback.params).toEqual(['%docs%', '%docs%', '%docs%', 'technical']);
    });

    it('appends scope filter param when scope is provided', () => {
      const { fallback } = buildKnowledgeSearchQueries({ query: 'docs', scope: 'agents' });
      expect(fallback.sql).toContain("scope = ?");
      expect(fallback.params).toEqual(['%docs%', '%docs%', '%docs%', 'agents']);
    });

    it('includes pinned DESC in fallback ORDER BY', () => {
      const { fallback } = buildKnowledgeSearchQueries({ query: 'docs' });
      expect(fallback.sql).toContain('pinned DESC');
    });

    it('respects the limit option in the LIKE fallback SQL', () => {
      const { fallback } = buildKnowledgeSearchQueries({ query: 'agent', limit: 10 });
      expect(fallback.sql).toContain('LIMIT 10');
    });
  });

  describe('combined scenarios', () => {
    it('category filter appears in BOTH fts and fallback when provided', () => {
      const { fts, fallback } = buildKnowledgeSearchQueries({
        query: 'brand guide',
        category: 'brand',
      });
      expect(fts!.sql).toContain('kb.category = ?');
      expect(fallback.sql).toContain('category = ?');
    });

    it('scope filter appears in BOTH fts and fallback when provided', () => {
      const { fts, fallback } = buildKnowledgeSearchQueries({
        query: 'deployment',
        scope: 'devops',
      });
      expect(fts!.sql).toContain("kb.scope = ?");
      expect(fallback.sql).toContain("scope = ?");
    });
  });
});
