// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for /api/search/route.ts — knowledge FTS5 upgrade
 *
 * Focuses on the knowledge base section:
 *  - Uses FTS when the virtual table is available (safeQuery non-empty)
 *  - Falls back to LIKE when FTS throws
 *  - Falls back to LIKE when safeQuery is empty after sanitization
 *  - Respects limit/offset pagination
 *  - Returns correct shape for all other groups when knowledge-only types requested
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/server ─────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    nextUrl: URL;
    constructor(url: string) {
      this.url = url;
      this.nextUrl = new URL(url);
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      _data: data,
    }),
  },
}));

// ─── Mock @/lib/database ──────────────────────────────────────────────────────
const mockAll = vi.fn(() => []);
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ all: mockAll, run: mockRun, get: mockGet }));
const mockDb = { prepare: mockPrepare };

vi.mock('@/lib/database', () => ({
  getDb: vi.fn(() => mockDb),
}));

// ─── Stub request helper ──────────────────────────────────────────────────────
class StubRequest {
  url: string;
  nextUrl: URL;
  constructor(url: string) {
    this.url = url;
    this.nextUrl = new URL(url);
  }
}
function makeRequest(url: string) {
  return new StubRequest(url) as unknown as import('next/server').NextRequest;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('GET /api/search — knowledge FTS upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockPrepare.mockReturnValue({ all: mockAll, run: mockRun, get: mockGet });
  });

  it('returns empty response for short queries (< 2 chars)', async () => {
    const { GET } = await import('../../../app/api/search/route');
    const req = makeRequest('http://localhost/api/search?q=a');
    const result = await GET(req) as { status: number; _data: { knowledge: { items: unknown[]; total: number } } };

    expect(result.status).toBe(200);
    expect(result._data.knowledge.items).toEqual([]);
    expect(result._data.knowledge.total).toBe(0);
  });

  it('uses FTS for knowledge when virtual table is available', async () => {
    const kbRows = [
      { id: 'kb-1', title: 'Agent Guide', category: 'technical', scope: 'all', updatedAt: 1000 },
    ];
    mockAll.mockReturnValue(kbRows);

    const { GET } = await import('../../../app/api/search/route');
    const req = makeRequest('http://localhost/api/search?q=agent&types=knowledge');
    const result = await GET(req) as { _data: { knowledge: { items: unknown[]; total: number } } };

    // The FTS prepare call includes a MATCH clause
    const ftsPrepareCall = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('knowledge_base_fts MATCH')
    );
    expect(ftsPrepareCall).toBeDefined();

    // All rows should be returned (within default limit)
    expect(result._data.knowledge.items).toHaveLength(1);
    expect(result._data.knowledge.total).toBe(1);
  });

  it('passes sanitized query to FTS MATCH (not raw user input)', async () => {
    mockAll.mockReturnValue([]);

    const { GET } = await import('../../../app/api/search/route');
    // Query with an asterisk that must be stripped by sanitizeFtsQuery
    const req = makeRequest('http://localhost/api/search?q=agent*&types=knowledge');
    await GET(req);

    const ftsPrepareCall = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('MATCH')
    );
    expect(ftsPrepareCall).toBeDefined();
    // mockAll should have been called with the sanitized query (no asterisk)
    const allArgs = mockAll.mock.calls[0];
    expect(allArgs?.[0]).toBe('agent');
  });

  it('falls back to LIKE when FTS throws', async () => {
    const likeRows = [
      { id: 'kb-2', title: 'Deploy Doc', category: 'ops', scope: 'all', updatedAt: 2000 },
    ];

    // First prepare call (FTS) returns a statement that throws on .all()
    // Second prepare call (LIKE) returns actual rows
    let callIndex = 0;
    mockPrepare.mockImplementation((sql: string) => {
      callIndex++;
      if ((sql as string).includes('MATCH') && callIndex === 1) {
        return {
          all: () => { throw new Error('no such table: knowledge_base_fts'); },
          run: mockRun,
          get: mockGet,
        };
      }
      mockAll.mockReturnValue(likeRows);
      return { all: mockAll, run: mockRun, get: mockGet };
    });

    const { GET } = await import('../../../app/api/search/route');
    const req = makeRequest('http://localhost/api/search?q=deploy&types=knowledge');
    const result = await GET(req) as { _data: { knowledge: { items: unknown[]; total: number } } };

    // Should fall back gracefully
    expect(result._data.knowledge.total).toBeGreaterThanOrEqual(0);

    // A LIKE query should have been prepared
    const likePrepareCall = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('LIKE') && !(c[0] as string).includes('MATCH')
    );
    expect(likePrepareCall).toBeDefined();
  });

  it('falls back to LIKE when sanitized query is empty (only special chars)', async () => {
    mockAll.mockReturnValue([]);

    const { GET } = await import('../../../app/api/search/route');
    // "**" is >= 2 chars so passes length check, but sanitizes to empty
    const req = makeRequest('http://localhost/api/search?q=**&types=knowledge');
    await GET(req);

    // No FTS call should have been made (safeQuery is empty)
    const ftsPrepareCall = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('MATCH')
    );
    expect(ftsPrepareCall).toBeUndefined();

    // LIKE fallback should have been used instead
    const likePrepareCall = mockPrepare.mock.calls.find(
      (c) => (c[0] as string).includes('LIKE')
    );
    expect(likePrepareCall).toBeDefined();
  });

  it('strips rank_group from LIKE-path results before returning', async () => {
    const rowsWithRank = [
      { id: 'kb-3', title: 'Onboarding', category: 'hr', scope: 'all', updatedAt: 3000, rank_group: 0 },
      { id: 'kb-4', title: 'Policy Doc', category: 'hr', scope: 'all', updatedAt: 2000, rank_group: 1 },
    ];

    // Force LIKE path by making FTS throw
    let first = true;
    mockPrepare.mockImplementation((sql: string) => {
      if ((sql as string).includes('MATCH') && first) {
        first = false;
        return {
          all: () => { throw new Error('fts error'); },
          run: mockRun,
          get: mockGet,
        };
      }
      return { all: () => rowsWithRank, run: mockRun, get: mockGet };
    });

    const { GET } = await import('../../../app/api/search/route');
    const req = makeRequest('http://localhost/api/search?q=onboarding&types=knowledge');
    const result = await GET(req) as {
      _data: { knowledge: { items: Array<Record<string, unknown>>; total: number } }
    };

    // rank_group should not be present in the output items
    for (const item of result._data.knowledge.items) {
      expect(item).not.toHaveProperty('rank_group');
    }
    expect(result._data.knowledge.total).toBe(2);
  });

  it('respects the limit parameter for knowledge results', async () => {
    const manyRows = Array.from({ length: 10 }, (_, i) => ({
      id: `kb-${i}`,
      title: `Doc ${i}`,
      category: 'general',
      scope: 'all',
      updatedAt: i * 1000,
    }));
    mockAll.mockReturnValue(manyRows);

    const { GET } = await import('../../../app/api/search/route');
    const req = makeRequest('http://localhost/api/search?q=doc&types=knowledge&limit=3');
    const result = await GET(req) as {
      _data: { knowledge: { items: unknown[]; total: number } }
    };

    expect(result._data.knowledge.items).toHaveLength(3);
    expect(result._data.knowledge.total).toBe(10);
  });

  it('returns empty knowledge group when table does not exist', async () => {
    mockPrepare.mockImplementation(() => {
      throw new Error('no such table: knowledge_base');
    });

    const { GET } = await import('../../../app/api/search/route');
    const req = makeRequest('http://localhost/api/search?q=missing&types=knowledge');
    const result = await GET(req) as {
      _data: { knowledge: { items: unknown[]; total: number } }
    };

    expect(result._data.knowledge.items).toEqual([]);
    expect(result._data.knowledge.total).toBe(0);
  });
});
