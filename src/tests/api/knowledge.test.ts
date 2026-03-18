// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for /api/knowledge/route.ts
 *
 * Coverage:
 *  - sanitizeFtsQuery: unit tests for the FTS5 query sanitizer
 *  - GET: search-only, search+category, search+scope, search+both filters,
 *         FTS fallback to LIKE (with filters), empty-after-sanitization,
 *         filter-only path, error handling
 *  - POST: creation, validation (missing title/content), error handling
 *
 * The database and next/server are mocked so no real I/O occurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/server ─────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    _body: string | undefined;
    constructor(url: string, init?: { body?: string }) {
      this.url = url;
      this._body = init?.body;
    }
    async json() {
      return JSON.parse(this._body ?? '{}');
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      _data: data,
    }),
  },
}));

// ─── Mock @/lib/knowledgeSync ─────────────────────────────────────────────────
vi.mock('@/lib/knowledgeSync', () => ({
  syncArticleToFilesystem: vi.fn(),
}));

// ─── Mock @/lib/database ──────────────────────────────────────────────────────
const mockRun = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
const mockAll = vi.fn(() => []);
const mockGet = vi.fn();

const mockPrepare = vi.fn(() => ({
  run: mockRun,
  all: mockAll,
  get: mockGet,
}));

const mockDb = { prepare: mockPrepare };

vi.mock('@/lib/database', () => ({
  getDb: vi.fn(() => mockDb),
}));

// ─── Request helpers ──────────────────────────────────────────────────────────
class StubRequest {
  url: string;
  _body: string | undefined;
  constructor(url: string, body?: unknown) {
    this.url = url;
    this._body = body !== undefined ? JSON.stringify(body) : undefined;
  }
  async json() {
    return JSON.parse(this._body ?? '{}');
  }
}

function makeRequest(url: string, body?: unknown) {
  return new StubRequest(url, body) as unknown as import('next/server').NextRequest;
}

// ─── Sample article row (as returned by SQLite) ───────────────────────────────
const sampleRow = {
  id: 'kb-1-abc',
  title: 'Agent Setup',
  content: 'How to set up an agent.',
  category: 'technical',
  tags: '["setup","agents"]',
  scope: 'all',
  pinned: 0,
  version: 1,
  createdBy: 'human',
  createdAt: 1000000,
  updatedAt: 1000001,
};

// ─── sanitizeFtsQuery tests ───────────────────────────────────────────────────
describe('sanitizeFtsQuery', () => {
  it('passes through a clean alphanumeric query unchanged', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('agent setup')).toBe('agent setup');
  });

  it('strips double-quote characters and collapses resulting spaces', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    // "agent" "setup" → strip quotes → ' agent   setup ' → collapse spaces → 'agent setup'
    expect(sanitizeFtsQuery('"agent" "setup"')).toBe('agent setup');
    expect(sanitizeFtsQuery('"agent"')).toBe('agent');
  });

  it('strips parentheses', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('agent(setup)')).toBe('agent setup');
  });

  it('strips asterisk wildcard', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('agent*')).toBe('agent');
  });

  it('strips caret operator', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('^agent')).toBe('agent');
  });

  it('collapses multiple spaces into one', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('agent    setup   guide')).toBe('agent setup guide');
  });

  it('returns empty string when only special chars remain after stripping', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('***')).toBe('');
    expect(sanitizeFtsQuery('"()"')).toBe('');
  });

  it('trims leading and trailing whitespace', async () => {
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('  agent  ')).toBe('agent');
  });

  it('strips hyphen (FTS5 negation operator) — prevents SQLITE_ERROR on hyphenated terms', async () => {
    // Regression guard: queries like "step-by-step" or "e-mail" previously reached
    // the MATCH engine unsanitized, causing SQLITE_ERROR: fts5: syntax error.
    const { sanitizeFtsQuery } = await import('../../../app/api/knowledge/route');
    expect(sanitizeFtsQuery('step-by-step')).toBe('step by step');
    expect(sanitizeFtsQuery('how-to guide')).toBe('how to guide');
    expect(sanitizeFtsQuery('e-mail setup')).toBe('e mail setup');
    expect(sanitizeFtsQuery('-')).toBe('');
  });
});

// ─── GET tests ────────────────────────────────────────────────────────────────
describe('GET /api/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('returns all articles when no params provided', async () => {
    mockAll.mockReturnValue([sampleRow]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge');
    const result = await GET(req) as { status: number; _data: { success: boolean; articles: unknown[] } };

    expect(result.status).toBe(200);
    expect(result._data.success).toBe(true);
    expect(result._data.articles).toHaveLength(1);
    // tags should be parsed from JSON string to array
    expect((result._data.articles[0] as { tags: unknown }).tags).toEqual(['setup', 'agents']);
    // pinned should be a boolean
    expect((result._data.articles[0] as { pinned: unknown }).pinned).toBe(false);
  });

  it('uses FTS path when ?search= is provided (no filters)', async () => {
    mockAll.mockReturnValue([sampleRow]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=agent');
    await GET(req);

    // The FTS path prepares a query containing MATCH
    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('MATCH')
    );
    expect(prepareCall).toBeDefined();
    // Params: just the sanitized search term (no filter params)
    expect(mockAll).toHaveBeenCalledWith('agent');
  });

  it('combines FTS search with category filter', async () => {
    mockAll.mockReturnValue([sampleRow]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=agent&category=technical');
    await GET(req);

    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('MATCH')
    );
    expect(prepareCall).toBeDefined();

    const sql = prepareCall?.[0] as string;
    expect(sql).toContain('kb.category = ?');
    // FTS param first, then category param
    expect(mockAll).toHaveBeenCalledWith('agent', 'technical');
  });

  it('combines FTS search with scope filter', async () => {
    mockAll.mockReturnValue([sampleRow]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=setup&scope=agents');
    await GET(req);

    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('MATCH')
    );
    expect(prepareCall).toBeDefined();
    const sql = prepareCall?.[0] as string;
    expect(sql).toContain("kb.scope = ?");
    expect(mockAll).toHaveBeenCalledWith('setup', 'agents');
  });

  it('combines FTS search with both category and scope filters', async () => {
    mockAll.mockReturnValue([sampleRow]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest(
      'http://localhost/api/knowledge?search=deploy&category=ops&scope=devops'
    );
    await GET(req);

    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('MATCH')
    );
    expect(prepareCall).toBeDefined();
    const sql = prepareCall?.[0] as string;
    expect(sql).toContain('kb.category = ?');
    expect(sql).toContain('kb.scope = ?');
    // FTS param, then category, then scope
    expect(mockAll).toHaveBeenCalledWith('deploy', 'ops', 'devops');
  });

  it('falls back to LIKE when FTS throws, preserving category filter', async () => {
    // First prepare call (FTS path) throws; second (LIKE fallback) succeeds
    mockPrepare
      .mockReturnValueOnce({
        run: mockRun,
        all: vi.fn(() => { throw new Error('no such table: knowledge_base_fts'); }),
        get: mockGet,
      })
      .mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });

    mockAll.mockReturnValue([sampleRow]);

    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=agent&category=technical');
    const result = await GET(req) as { status: number; _data: { success: boolean; articles: unknown[] } };

    expect(result.status).toBe(200);
    expect(result._data.success).toBe(true);

    // The LIKE fallback SQL should include category filter
    const likeCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('LIKE') && (call[0] as string).includes('category = ?')
    );
    expect(likeCall).toBeDefined();
    // Params: three LIKE params + category param
    expect(mockAll).toHaveBeenCalledWith('%agent%', '%agent%', '%agent%', 'technical');
  });

  it('falls back to LIKE when FTS throws, preserving scope filter', async () => {
    mockPrepare
      .mockReturnValueOnce({
        run: mockRun,
        all: vi.fn(() => { throw new Error('fts error'); }),
        get: mockGet,
      })
      .mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });

    mockAll.mockReturnValue([]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=docs&scope=devops');
    await GET(req);

    const likeCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('LIKE') && (call[0] as string).includes("scope = ?")
    );
    expect(likeCall).toBeDefined();
    expect(mockAll).toHaveBeenCalledWith('%docs%', '%docs%', '%docs%', 'devops');
  });

  it('returns empty array when search sanitizes to nothing', async () => {
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=***');
    const result = await GET(req) as { status: number; _data: { success: boolean; articles: unknown[] } };

    expect(result.status).toBe(200);
    expect(result._data.articles).toHaveLength(0);
    // Should not call the database for an empty query
    expect(mockAll).not.toHaveBeenCalled();
  });

  it('uses weighted bm25 and snippet in the FTS query for relevance ranking', async () => {
    const rowWithSnippet = {
      ...sampleRow,
      matchSnippet: 'How to set up an <mark>agent</mark>...',
    };
    mockAll.mockReturnValue([rowWithSnippet]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=agent');
    await GET(req);

    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('MATCH')
    );
    expect(prepareCall).toBeDefined();
    const sql = prepareCall?.[0] as string;

    // Must use bm25 with custom weights for relevance ranking
    expect(sql).toContain('bm25(knowledge_base_fts, 10.0, 1.0, 5.0)');
    // Must include snippet extraction
    expect(sql).toContain('snippet(knowledge_base_fts');
    expect(sql).toContain('<mark>');
  });

  it('includes matchSnippet in FTS search results', async () => {
    const rowWithSnippet = {
      ...sampleRow,
      matchSnippet: 'How to set up an <mark>agent</mark> on the platform...',
    };
    mockAll.mockReturnValue([rowWithSnippet]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?search=agent');
    const result = await GET(req) as { _data: { articles: Array<Record<string, unknown>> } };

    expect(result._data.articles).toHaveLength(1);
    expect(result._data.articles[0].matchSnippet).toBe(
      'How to set up an <mark>agent</mark> on the platform...'
    );
  });

  it('uses filter-only path when only category is provided', async () => {
    mockAll.mockReturnValue([sampleRow]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?category=technical');
    await GET(req);

    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('SELECT')
    );
    const sql = prepareCall?.[0] as string;
    expect(sql).not.toContain('MATCH');
    expect(sql).toContain('category = ?');
    expect(mockAll).toHaveBeenCalledWith('technical');
  });

  it('uses filter-only path when only scope is provided', async () => {
    mockAll.mockReturnValue([]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge?scope=agents');
    await GET(req);

    const prepareCall = mockPrepare.mock.calls.find(
      (call) => (call[0] as string).includes('SELECT')
    );
    const sql = prepareCall?.[0] as string;
    expect(sql).not.toContain('MATCH');
    expect(sql).toContain("scope = ?");
    expect(mockAll).toHaveBeenCalledWith('agents');
  });

  it('parses tags from JSON string in returned rows', async () => {
    mockAll.mockReturnValue([{ ...sampleRow, tags: '["alpha","beta"]' }]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge');
    const result = await GET(req) as { _data: { articles: Array<{ tags: unknown }> } };

    expect(result._data.articles[0].tags).toEqual(['alpha', 'beta']);
  });

  it('returns empty tags array when tags JSON is malformed', async () => {
    mockAll.mockReturnValue([{ ...sampleRow, tags: 'not-json' }]);
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge');
    const result = await GET(req) as { _data: { articles: Array<{ tags: unknown }> } };

    expect(result._data.articles[0].tags).toEqual([]);
  });

  it('returns 500 when database throws', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('SQLITE_ERROR: database is locked');
    });
    const { GET } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge');
    const result = await GET(req) as { status: number; _data: { success: boolean; error: string } };

    expect(result.status).toBe(500);
    expect(result._data.success).toBe(false);
    expect(result._data.error).toContain('SQLITE_ERROR');
  });
});

// ─── POST tests ───────────────────────────────────────────────────────────────
describe('POST /api/knowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({ lastInsertRowid: 1, changes: 1 });
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
  });

  it('creates an article and returns 200 with generated id', async () => {
    const { POST } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge', {
      title: 'New Article',
      content: 'Article content here.',
      category: 'general',
      tags: ['alpha'],
    });

    const result = await POST(req) as { status: number; _data: { success: boolean; id: string } };

    expect(result.status).toBe(200);
    expect(result._data.success).toBe(true);
    expect(result._data.id).toMatch(/^kb-\d+-[a-z0-9]+$/);

    // Verify INSERT was called with correct structure
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO knowledge_base')
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringMatching(/^kb-/), // id
      'New Article',                 // title
      'Article content here.',       // content
      'general',                     // category
      JSON.stringify(['alpha']),      // tags as JSON
      'all',                         // scope default
      0,                             // pinned default
      expect.any(Number),            // createdAt
      expect.any(Number),            // updatedAt
    );
  });

  it('returns 400 when title is missing', async () => {
    const { POST } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge', {
      content: 'Some content',
    });
    const result = await POST(req) as { status: number; _data: { success: boolean; error: string } };

    expect(result.status).toBe(400);
    expect(result._data.success).toBe(false);
    expect(result._data.error).toContain('required');
  });

  it('returns 400 when title is blank whitespace', async () => {
    const { POST } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge', {
      title: '   ',
      content: 'Some content',
    });
    const result = await POST(req) as { status: number; _data: { success: boolean; error: string } };

    expect(result.status).toBe(400);
    expect(result._data.error).toContain('required');
  });

  it('returns 400 when content is missing', async () => {
    const { POST } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge', {
      title: 'Valid Title',
    });
    const result = await POST(req) as { status: number; _data: { success: boolean; error: string } };

    expect(result.status).toBe(400);
    expect(result._data.success).toBe(false);
  });

  it('uses provided scope and pinned values', async () => {
    const { POST } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge', {
      title: 'Pinned Guide',
      content: 'Important guide content.',
      scope: 'agents',
      pinned: true,
    });
    await POST(req);

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String),   // id
      'Pinned Guide',       // title
      'Important guide content.', // content
      'general',            // category default
      JSON.stringify([]),   // tags default
      'agents',             // scope
      1,                    // pinned = true → 1
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('returns 500 when database throws', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
    });

    const { POST } = await import('../../../app/api/knowledge/route');
    const req = makeRequest('http://localhost/api/knowledge', {
      title: 'Article',
      content: 'Content',
    });
    const result = await POST(req) as { status: number; _data: { success: boolean; error: string } };

    expect(result.status).toBe(500);
    expect(result._data.success).toBe(false);
    expect(result._data.error).toContain('SQLITE_CONSTRAINT');
  });
});
