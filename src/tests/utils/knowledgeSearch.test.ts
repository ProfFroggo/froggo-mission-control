// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Unit tests for src/lib/knowledgeSearch.ts
 *
 * Both exports are pure functions — no mocks needed.
 *
 *  sanitizeFtsQuery — strips FTS5 special chars from user input
 *  buildKnowledgeSearchQueries — builds SQL + param pairs for FTS + LIKE paths
 */

import { describe, it, expect } from 'vitest';
import { sanitizeFtsQuery, buildKnowledgeSearchQueries } from '@/lib/knowledgeSearch';

// ─── sanitizeFtsQuery ─────────────────────────────────────────────────────────
describe('sanitizeFtsQuery', () => {
  it('returns plain alphanumeric terms unchanged', () => {
    expect(sanitizeFtsQuery('hello world')).toBe('hello world');
  });

  it('strips double-quote phrase operator', () => {
    expect(sanitizeFtsQuery('"exact phrase"')).toBe('exact phrase');
  });

  it('strips parentheses', () => {
    expect(sanitizeFtsQuery('(group)')).toBe('group');
  });

  it('strips asterisk prefix operator', () => {
    expect(sanitizeFtsQuery('pre*')).toBe('pre');
  });

  it('strips caret initial-token operator', () => {
    expect(sanitizeFtsQuery('^title')).toBe('title');
  });

  it('strips hyphen negation operator', () => {
    // The hyphen is replaced by a space, then the \s+ collapse step reduces
    // the resulting double-space ("email" + " " + " " from hyphen) to one space.
    expect(sanitizeFtsQuery('email -spam')).toBe('email spam');
  });

  it('collapses multiple spaces after stripping', () => {
    // Special chars (", (, ), *) are each replaced by a space, then \s+ collapse
    // reduces all resulting runs of whitespace to a single space.
    expect(sanitizeFtsQuery('"(agent)*  setup"')).toBe('agent setup');
    // Normalize: expect all internal whitespace to be single spaces
    expect(sanitizeFtsQuery('a    b    c')).toBe('a b c');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFtsQuery('  agent  ')).toBe('agent');
  });

  it('returns empty string when only special chars are present', () => {
    expect(sanitizeFtsQuery('***')).toBe('');
    expect(sanitizeFtsQuery('()')).toBe('');
    expect(sanitizeFtsQuery('"^*"')).toBe('');
  });
});

// ─── buildKnowledgeSearchQueries ──────────────────────────────────────────────
describe('buildKnowledgeSearchQueries', () => {
  it('returns null fts when query sanitizes to empty', () => {
    const { fts, fallback } = buildKnowledgeSearchQueries({ query: '***' });
    expect(fts).toBeNull();
    expect(fallback).toBeDefined();
  });

  it('returns FTS query with sanitized term in params', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'agent*' });
    expect(fts).not.toBeNull();
    expect(fts!.sql).toContain('knowledge_base_fts MATCH ?');
    // Sanitized: 'agent' (asterisk stripped)
    expect(fts!.params[0]).toBe('agent');
  });

  it('FTS query includes no filter clauses when category/scope absent', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'deploy' });
    expect(fts!.sql).not.toContain('category');
    expect(fts!.sql).not.toContain('scope');
    expect(fts!.params).toEqual(['deploy']);
  });

  it('FTS query appends category filter when provided', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'deploy', category: 'ops' });
    expect(fts!.sql).toContain('kb.category = ?');
    expect(fts!.params).toEqual(['deploy', 'ops']);
  });

  it('FTS query appends scope filter when provided', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'deploy', scope: 'agents' });
    expect(fts!.sql).toContain("kb.scope = ?");
    expect(fts!.params).toEqual(['deploy', 'agents']);
  });

  it('FTS query appends both category and scope filters', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'policy', category: 'hr', scope: 'internal' });
    expect(fts!.sql).toContain('kb.category = ?');
    expect(fts!.sql).toContain("kb.scope = ?");
    expect(fts!.params).toEqual(['policy', 'hr', 'internal']);
  });

  it('fallback query contains LIKE patterns for title, content, tags', () => {
    const { fallback } = buildKnowledgeSearchQueries({ query: 'guide' });
    expect(fallback.sql).toContain('title LIKE ?');
    expect(fallback.sql).toContain('content LIKE ?');
    expect(fallback.sql).toContain('tags LIKE ?');
    expect(fallback.params[0]).toBe('%guide%');
    expect(fallback.params[1]).toBe('%guide%');
    expect(fallback.params[2]).toBe('%guide%');
  });

  it('fallback query appends category filter when provided', () => {
    const { fallback } = buildKnowledgeSearchQueries({ query: 'guide', category: 'ops' });
    expect(fallback.sql).toContain('category = ?');
    expect(fallback.params).toContain('ops');
  });

  it('fallback query appends scope filter when provided', () => {
    const { fallback } = buildKnowledgeSearchQueries({ query: 'guide', scope: 'devops' });
    expect(fallback.sql).toContain("scope = ?");
    expect(fallback.params).toContain('devops');
  });

  it('fallback uses the raw (unsanitized) query for LIKE patterns', () => {
    // LIKE handles % natively in SQL and doesn't need FTS sanitization
    const { fallback } = buildKnowledgeSearchQueries({ query: 'agent*' });
    // Raw query wrapped in % for LIKE
    expect(fallback.params[0]).toBe('%agent*%');
  });

  it('respects custom limit in FTS SQL', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'doc', limit: 5 });
    expect(fts!.sql).toContain('LIMIT 5');
  });

  it('respects custom limit in fallback SQL', () => {
    const { fallback } = buildKnowledgeSearchQueries({ query: 'doc', limit: 5 });
    expect(fallback.sql).toContain('LIMIT 5');
  });

  it('defaults to limit 20 when not specified', () => {
    const { fts, fallback } = buildKnowledgeSearchQueries({ query: 'doc' });
    expect(fts!.sql).toContain('LIMIT 20');
    expect(fallback.sql).toContain('LIMIT 20');
  });

  it('orders FTS results by pinned DESC then bm25 relevance', () => {
    const { fts } = buildKnowledgeSearchQueries({ query: 'test' });
    expect(fts!.sql).toContain('kb.pinned DESC');
    // Explicit bm25() call with custom column weights — not the implicit "rank" alias.
    // Weights: title=10×, content=1×, tags=5×.
    expect(fts!.sql).toContain('bm25(knowledge_base_fts');
  });

  it('orders fallback results by pinned DESC then updatedAt DESC', () => {
    const { fallback } = buildKnowledgeSearchQueries({ query: 'test' });
    expect(fallback.sql).toContain('pinned DESC');
    expect(fallback.sql).toContain('updatedAt DESC');
  });
});
