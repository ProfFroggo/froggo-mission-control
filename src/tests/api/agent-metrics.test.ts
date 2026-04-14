// @vitest-environment node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for /api/agents/[id]/metrics/route.ts
 *
 * The metrics route reads from the agents, tasks, and task_activity tables
 * via getDb(), and checks the filesystem for memory notes. We mock the
 * database, next/server, fs, os, and path so no real I/O occurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/server ─────────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      _data: data,
    }),
  },
}));

// ─── Mock validateAgentId ─────────────────────────────────────────────────────
const mockValidateAgentId = vi.fn(() => null);
vi.mock('@/lib/validateId', () => ({
  validateAgentId: (...args: unknown[]) => mockValidateAgentId(...args),
}));

// ─── Mock fs ──────────────────────────────────────────────────────────────────
const mockExistsSync = vi.fn(() => false);
const mockReaddirSync = vi.fn(() => [] as string[]);
vi.mock('fs', () => {
  const mod = {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  };
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
// Responds based on the SQL query string
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);
const mockPrepare = vi.fn(() => ({
  get: mockGet,
  all: mockAll,
}));
const mockDb = { prepare: mockPrepare };

vi.mock('@/lib/database', () => ({
  getDb: vi.fn(() => mockDb),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(url: string) {
  return { url } as unknown as import('next/server').NextRequest;
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Sets up mockGet to return different values based on the SQL query.
 * This handles the multiple db.prepare().get() calls in the route.
 */
function setupDbMocks(overrides?: {
  agentExists?: boolean;
  tasksCompleted?: number;
  tasksInProgress?: number;
  tasksTotal?: number;
  reviewCount?: number;
  p1TasksCompleted?: number;
  reviewsApproved?: number;
  reviewsRejected?: number;
  recentActivityCount?: number;
  avgCompletionMs?: number | null;
  lastActive?: number | null;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostUsd?: number;
  last30DaysCostUsd?: number;
}) {
  const opts = {
    agentExists: true,
    tasksCompleted: 10,
    tasksInProgress: 2,
    tasksTotal: 15,
    reviewCount: 1,
    p1TasksCompleted: 3,
    reviewsApproved: 8,
    reviewsRejected: 1,
    recentActivityCount: 25,
    avgCompletionMs: 3600000,
    lastActive: Date.now(),
    totalInputTokens: 50000,
    totalOutputTokens: 12000,
    totalCostUsd: 1.2345,
    last30DaysCostUsd: 0.4567,
    ...overrides,
  };

  // Track call index to return appropriate values for sequential get() calls
  let getCallIndex = 0;
  mockGet.mockImplementation(() => {
    const idx = getCallIndex++;
    switch (idx) {
      case 0: // SELECT id FROM agents
        return opts.agentExists ? { id: 'coder' } : undefined;
      case 1: // tasksCompleted
        return { count: opts.tasksCompleted };
      case 2: // tasksInProgress
        return { count: opts.tasksInProgress };
      case 3: // tasksTotal
        return { count: opts.tasksTotal };
      case 4: // reviewCount
        return { count: opts.reviewCount };
      case 5: // p1TasksCompleted
        return { count: opts.p1TasksCompleted };
      case 6: // reviewsApproved
        return { count: opts.reviewsApproved };
      case 7: // reviewsRejected
        return { count: opts.reviewsRejected };
      case 8: // recentActivity count
        return { count: opts.recentActivityCount };
      case 9: // avgCompletionMs
        return { avg: opts.avgCompletionMs };
      case 10: // lastActive
        return { last: opts.lastActive };
      case 11: // token_usage lifetime stats
        return {
          totalInput: opts.totalInputTokens,
          totalOutput: opts.totalOutputTokens,
          totalCost: opts.totalCostUsd,
        };
      case 12: // token_usage last 30 days cost
        return { cost: opts.last30DaysCostUsd };
      default:
        return { count: 0 };
    }
  });

  // recentActivityEntries uses .all()
  mockAll.mockReturnValue([
    { taskId: 'task-1', action: 'completed', message: 'Done with task', timestamp: Date.now() },
    { taskId: 'task-2', action: 'progress', message: 'Working on it', timestamp: Date.now() - 1000 },
  ]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('/api/agents/[id]/metrics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAgentId.mockReturnValue(null);
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
  });

  describe('GET', () => {
    it('returns 200 with expected metrics shape for a known agent', async () => {
      setupDbMocks({ tasksCompleted: 10, tasksTotal: 15, tasksInProgress: 2 });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);

      const data = result._data;
      expect(data.agentId).toBe('coder');
      expect(data).toHaveProperty('tasksCompleted');
      expect(data).toHaveProperty('tasksInProgress');
      expect(data).toHaveProperty('tasksTotal');
      expect(data).toHaveProperty('completionRate');
      expect(data).toHaveProperty('reviewCount');
      expect(data).toHaveProperty('p1TasksCompleted');
      expect(data).toHaveProperty('reviewsApproved');
      expect(data).toHaveProperty('reviewsRejected');
      expect(data).toHaveProperty('approvalRate');
      expect(data).toHaveProperty('memoryNotes');
      expect(data).toHaveProperty('recentActivity');
      expect(data).toHaveProperty('recentActivityEntries');
      expect(data).toHaveProperty('avgCompletionMs');
      expect(data).toHaveProperty('lastActive');
      expect(data).toHaveProperty('tokenUsage');
    });

    it('returns 404 for an unknown agent ID', async () => {
      setupDbMocks({ agentExists: false });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/nonexistent/metrics');
      const result = await GET(req, makeParams('nonexistent')) as { status: number; _data: { error: string } };

      expect(result.status).toBe(404);
      expect(result._data.error).toBe('Agent not found');
    });

    it('returns 400 for an invalid agent ID format', async () => {
      // Simulate validateAgentId returning a 400 response
      mockValidateAgentId.mockReturnValue({
        status: 400,
        _data: { error: 'Invalid agent ID' },
      });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/../etc/passwd/metrics');
      const result = await GET(req, makeParams('../etc/passwd')) as { status: number; _data: { error: string } };

      expect(result.status).toBe(400);
      expect(result._data.error).toBe('Invalid agent ID');
    });

    it('computes completionRate correctly as tasksCompleted / tasksTotal', async () => {
      setupDbMocks({ tasksCompleted: 38, tasksTotal: 42 });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      // 38/42 = 0.9047... rounded to 3 decimal places = 0.905
      expect(result._data.completionRate).toBe(0.905);
    });

    it('returns completionRate as null when tasksTotal is 0', async () => {
      setupDbMocks({ tasksCompleted: 0, tasksTotal: 0 });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/newagent/metrics');
      const result = await GET(req, makeParams('newagent')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.completionRate).toBeNull();
    });

    it('returns recentActivityEntries as an array', async () => {
      setupDbMocks();

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(Array.isArray(result._data.recentActivityEntries)).toBe(true);
      const entries = result._data.recentActivityEntries as Array<Record<string, unknown>>;
      expect(entries.length).toBe(2);
      expect(entries[0]).toHaveProperty('taskId');
      expect(entries[0]).toHaveProperty('action');
      expect(entries[0]).toHaveProperty('message');
      expect(entries[0]).toHaveProperty('timestamp');
    });

    it('returns p1TasksCompleted count', async () => {
      setupDbMocks({ p1TasksCompleted: 5 });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.p1TasksCompleted).toBe(5);
    });

    it('returns reviewCount for tasks in review status', async () => {
      setupDbMocks({ reviewCount: 3 });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.reviewCount).toBe(3);
    });

    it('counts memory notes from filesystem when directory exists', async () => {
      setupDbMocks();
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'note-1.md',
        'note-2.md',
        '_private.md', // excluded (starts with _)
        'readme.txt',  // excluded (not .md)
      ] as unknown as string[]);

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.memoryNotes).toBe(2); // only note-1.md and note-2.md
    });

    it('returns tokenUsage with lifetime and 30-day stats', async () => {
      setupDbMocks({
        totalInputTokens: 100000,
        totalOutputTokens: 25000,
        totalCostUsd: 2.5678,
        last30DaysCostUsd: 0.9123,
      });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: { tokenUsage: Record<string, number> } };

      expect(result.status).toBe(200);
      expect(result._data.tokenUsage).toEqual({
        totalInputTokens: 100000,
        totalOutputTokens: 25000,
        totalCostUsd: 2.5678,
        last30DaysCostUsd: 0.9123,
      });
    });

    it('returns zero tokenUsage when agent has no token records', async () => {
      setupDbMocks({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        last30DaysCostUsd: 0,
      });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: { tokenUsage: Record<string, number> } };

      expect(result.status).toBe(200);
      expect(result._data.tokenUsage.totalInputTokens).toBe(0);
      expect(result._data.tokenUsage.totalOutputTokens).toBe(0);
      expect(result._data.tokenUsage.totalCostUsd).toBe(0);
      expect(result._data.tokenUsage.last30DaysCostUsd).toBe(0);
    });

    it('returns approvalRate null when no reviews exist', async () => {
      setupDbMocks({ reviewsApproved: 0, reviewsRejected: 0 });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.approvalRate).toBeNull();
    });

    it('returns avgCompletionMs null when no completed tasks have timestamps', async () => {
      setupDbMocks({ avgCompletionMs: null });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.avgCompletionMs).toBeNull();
    });

    it('returns lastActive null when agent has no activity history', async () => {
      setupDbMocks({ lastActive: null });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: Record<string, unknown> };

      expect(result.status).toBe(200);
      expect(result._data.lastActive).toBeNull();
    });

    it('returns 500 when database throws', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('SQLITE_ERROR: no such table');
      });

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      const req = makeRequest('http://localhost/api/agents/coder/metrics');
      const result = await GET(req, makeParams('coder')) as { status: number; _data: { error: string } };

      expect(result.status).toBe(500);
      expect(result._data.error).toBe('Internal server error');
    });

    it('uses parameterized queries for all DB calls', async () => {
      setupDbMocks();

      const { GET } = await import('../../../app/api/agents/[id]/metrics/route');
      await GET(
        makeRequest('http://localhost/api/agents/coder/metrics'),
        makeParams('coder'),
      );

      // Every prepare() call with a WHERE clause should use ? placeholders
      for (const call of mockPrepare.mock.calls) {
        const sql = call[0] as string;
        if (sql.includes('WHERE')) {
          expect(sql).toContain('?');
          expect(sql).not.toMatch(/= 'coder'/); // No hardcoded agent ID
        }
      }
    });
  });
});
