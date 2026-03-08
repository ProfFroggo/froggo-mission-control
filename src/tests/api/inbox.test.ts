/**
 * Tests for /api/inbox/route.ts
 *
 * The inbox route reads/writes to SQLite via getDb(), and fire-and-forgets
 * a claude CLI spawn on POST. We mock the database, next/server, child_process,
 * fs, and os so no real I/O occurs.
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
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      _data: data,
    }),
  },
}));

// ─── Mock child_process ───────────────────────────────────────────────────────
const mockProc = { unref: vi.fn() };
const mockSpawn = vi.fn(() => mockProc);
vi.mock('child_process', () => {
  const mod = { spawn: mockSpawn };
  return { ...mod, default: mod };
});

// ─── Mock fs ──────────────────────────────────────────────────────────────────
const mockExistsSync = vi.fn(() => false);
vi.mock('fs', () => {
  const mod = { existsSync: mockExistsSync };
  return { ...mod, default: mod };
});

// ─── Mock os ──────────────────────────────────────────────────────────────────
vi.mock('os', () => {
  const mod = { homedir: vi.fn(() => '/home/testuser') };
  return { ...mod, default: mod };
});

// ─── Mock path ────────────────────────────────────────────────────────────────
vi.mock('path', () => {
  const join = (...parts: string[]) => parts.join('/');
  const mod = { join };
  return { ...mod, default: mod };
});

// ─── Mock @/lib/database ──────────────────────────────────────────────────────
// We'll configure this per-test in beforeEach
const mockRun = vi.fn(() => ({ lastInsertRowid: 42 }));
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Use a stub to avoid the "GET/HEAD method cannot have body" guard in Next.js.
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

describe('/api/inbox route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({ lastInsertRowid: 42 });
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    mockPrepare.mockReturnValue({ run: mockRun, all: mockAll, get: mockGet });
    mockExistsSync.mockReturnValue(false);
    mockSpawn.mockReturnValue(mockProc);
  });

  // ─── POST ─────────────────────────────────────────────────────────────────

  describe('POST', () => {
    it('inserts item and returns 201 with created item', async () => {
      const createdRow = {
        id: 42,
        type: 'email',
        title: 'Test Email',
        content: 'Hello world',
        status: 'unread',
        createdAt: Date.now(),
        metadata: '{}',
        tags: '[]',
        starred: 0,
        isRead: 0,
      };

      mockGet.mockReturnValue(createdRow);

      const { POST } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox', {
        type: 'email',
        title: 'Test Email',
        content: 'Hello world',
        status: 'unread',
      });

      const result = await POST(req) as { status: number; _data: unknown };

      expect(result.status).toBe(201);
      // Verify INSERT was called
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inbox')
      );
      expect(mockRun).toHaveBeenCalled();
    });

    it('calls spawn with the inbox agent trigger message', async () => {
      mockGet.mockReturnValue({
        id: 1,
        type: 'slack',
        title: 'Urgent: Deploy needed',
        content: 'Please deploy now',
        metadata: '{}',
        tags: '[]',
      });

      const { POST } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox', {
        type: 'slack',
        title: 'Urgent: Deploy needed',
        content: 'Please deploy now',
        channel: 'slack-ops',
      });

      await POST(req);

      expect(mockSpawn).toHaveBeenCalledOnce();
      const spawnArgs = mockSpawn.mock.calls[0];
      // First arg: path to claude binary
      expect(spawnArgs[0]).toContain('claude');
      // Third arg array: includes the trigger message
      const claudeArgs: string[] = spawnArgs[1];
      const messageArg = claudeArgs[claudeArgs.length - 1];
      expect(messageArg).toContain('Urgent: Deploy needed');
      expect(messageArg).toContain('triage');
    });

    it('succeeds even if spawn throws (fire-and-forget)', async () => {
      mockGet.mockReturnValue({
        id: 2,
        type: 'note',
        title: 'Fire Test',
        content: 'test content',
        metadata: '{}',
        tags: '[]',
      });
      mockSpawn.mockImplementationOnce(() => { throw new Error('spawn ENOENT'); });

      const { POST } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox', {
        type: 'note',
        title: 'Fire Test',
        content: 'test content',
      });

      const result = await POST(req) as { status: number; _data: unknown };

      // Should not throw — spawn failure is caught silently
      expect(result.status).toBe(201);
    });

    it('parses metadata and tags from JSON strings in returned row', async () => {
      mockGet.mockReturnValue({
        id: 3,
        type: 'email',
        title: 'Parsed',
        content: 'body',
        metadata: '{"priority":"high"}',
        tags: '["important","work"]',
        starred: 0,
        isRead: 0,
      });

      const { POST } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox', {
        type: 'email',
        title: 'Parsed',
        content: 'body',
        metadata: { priority: 'high' },
        tags: ['important', 'work'],
      });

      const result = await POST(req) as { status: number; _data: { metadata: unknown; tags: unknown } };

      expect(result._data.metadata).toEqual({ priority: 'high' });
      expect(result._data.tags).toEqual(['important', 'work']);
    });

    it('returns 500 when database throws', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('SQLITE_ERROR: no such table');
      });

      const { POST } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox', {
        type: 'email',
        title: 'Will fail',
        content: 'content',
      });

      const result = await POST(req) as { status: number; _data: unknown };
      expect(result.status).toBe(500);
      expect((result._data as { error: string }).error).toBe('Internal server error');
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────────────

  describe('GET', () => {
    it('returns all items when no filters provided', async () => {
      const rows = [
        { id: 1, type: 'email', title: 'Email 1', content: 'body', metadata: '{}', tags: '[]' },
        { id: 2, type: 'slack', title: 'Slack msg', content: 'hey', metadata: '{}', tags: '[]' },
      ];
      mockAll.mockReturnValue(rows);

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox');

      const result = await GET(req) as { status: number; _data: unknown[] };

      expect(result.status).toBe(200);
      expect(result._data).toHaveLength(2);
    });

    it('filters by status when status param is provided', async () => {
      const rows = [
        { id: 1, type: 'email', title: 'Unread Email', content: 'body', status: 'unread', metadata: '{}', tags: '[]' },
      ];
      mockAll.mockReturnValue(rows);

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox?status=unread');

      await GET(req);

      // Verify the SQL includes a WHERE clause with status filter
      const sqlCall = mockPrepare.mock.calls.find(
        (call) => (call[0] as string).includes('SELECT')
      );
      expect(sqlCall?.[0]).toContain('status = ?');
      expect(mockAll).toHaveBeenCalledWith('unread');
    });

    it('filters by project when project param is provided', async () => {
      mockAll.mockReturnValue([]);

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox?project=mission-control');

      await GET(req);

      const sqlCall = mockPrepare.mock.calls.find(
        (call) => (call[0] as string).includes('SELECT')
      );
      expect(sqlCall?.[0]).toContain('project = ?');
      expect(mockAll).toHaveBeenCalledWith('mission-control');
    });

    it('filters by starred=true', async () => {
      mockAll.mockReturnValue([]);

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox?starred=true');

      await GET(req);

      const sqlCall = mockPrepare.mock.calls.find(
        (call) => (call[0] as string).includes('SELECT')
      );
      expect(sqlCall?.[0]).toContain('starred = ?');
      expect(mockAll).toHaveBeenCalledWith(1);
    });

    it('filters by starred=false', async () => {
      mockAll.mockReturnValue([]);

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox?starred=false');

      await GET(req);

      expect(mockAll).toHaveBeenCalledWith(0);
    });

    it('combines multiple filters with AND', async () => {
      mockAll.mockReturnValue([]);

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox?status=unread&project=mission-control&starred=true');

      await GET(req);

      const sqlCall = mockPrepare.mock.calls.find(
        (call) => (call[0] as string).includes('SELECT')
      );
      const sql = sqlCall?.[0] as string;
      expect(sql).toContain('status = ?');
      expect(sql).toContain('project = ?');
      expect(sql).toContain('starred = ?');
      expect(mockAll).toHaveBeenCalledWith('unread', 'mission-control', 1);
    });

    it('returns 500 on database error', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const { GET } = await import('../../../app/api/inbox/route');
      const req = makeRequest('http://localhost/api/inbox');

      const result = await GET(req) as { status: number; _data: unknown };
      expect(result.status).toBe(500);
    });
  });
});
