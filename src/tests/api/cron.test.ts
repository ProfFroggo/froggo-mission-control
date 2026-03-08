/**
 * Tests for /api/cron/route.ts
 *
 * The cron route manages a schedule.json file on disk and spawns
 * claude CLI processes for job execution. We mock fs, child_process,
 * and next/server to isolate pure handler logic.
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

// ─── Mock fs ──────────────────────────────────────────────────────────────────
// We provide only the fs functions used by the cron route. The `default` key is
// required because the route uses named imports from the CJS `fs` module, which
// Vitest resolves via the mock's default export.
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn();
vi.mock('fs', () => {
  const mod = {
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
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

// ─── Mock child_process ───────────────────────────────────────────────────────
const mockProc = { unref: vi.fn() };
const mockSpawn = vi.fn(() => mockProc);
vi.mock('child_process', () => {
  const mod = { spawn: mockSpawn };
  return { ...mod, default: mod };
});

// ─── Helper: build a NextRequest-like object ──────────────────────────────────
// We use a stub class rather than the real NextRequest to avoid the
// "GET/HEAD method cannot have body" guard in Next.js internals.
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

describe('/api/cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: schedule file does not exist
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('[]');
    mockWriteFileSync.mockImplementation(() => undefined);
    mockSpawn.mockReturnValue(mockProc);
  });

  // ─── GET ──────────────────────────────────────────────────────────────────

  describe('GET', () => {
    it('returns { jobs: [] } when schedule.json does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const { GET } = await import('../../../app/api/cron/route');
      const result = await GET() as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      expect(result._data).toEqual({ jobs: [] });
    });

    it('returns { jobs: [] } when schedule.json is empty array', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('[]');

      const { GET } = await import('../../../app/api/cron/route');
      const result = await GET() as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      expect(result._data).toEqual({ jobs: [] });
    });

    it('returns existing jobs from schedule.json', async () => {
      const existingJobs = [
        { id: 'job-1', name: 'Daily Sync', enabled: true, schedule: { kind: 'cron', expr: '0 9 * * *' } },
      ];
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingJobs));

      const { GET } = await import('../../../app/api/cron/route');
      const result = await GET() as { status: number; _data: { jobs: unknown[] } };

      expect(result.status).toBe(200);
      expect(result._data.jobs).toHaveLength(1);
      expect((result._data.jobs[0] as { name: string }).name).toBe('Daily Sync');
    });

    it('returns { jobs: [] } when schedule.json contains invalid JSON', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('NOT VALID JSON {{{');

      const { GET } = await import('../../../app/api/cron/route');
      const result = await GET() as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      expect(result._data).toEqual({ jobs: [] });
    });
  });

  // ─── POST (create job) ────────────────────────────────────────────────────

  describe('POST - create job', () => {
    it('creates a job and writes to schedule.json', async () => {
      mockExistsSync.mockReturnValue(false);
      const capturedWrites: string[] = [];
      mockWriteFileSync.mockImplementation((_path: unknown, data: unknown) => {
        capturedWrites.push(data as string);
      });

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron', {
        name: 'Test Job',
        description: 'A test cron job',
        schedule: { kind: 'cron', expr: '*/5 * * * *' },
        sessionTarget: 'isolated',
        payload: { kind: 'agentTurn', message: 'Do something useful' },
      });

      const result = await POST(req) as { status: number; _data: { job: Record<string, unknown> } };

      expect(result.status).toBe(201);
      expect(result._data.job.name).toBe('Test Job');
      expect(result._data.job.enabled).toBe(true);
      expect(result._data.job.id).toBeDefined();
      expect(typeof result._data.job.id).toBe('string');

      // Verify file was written with the new job
      expect(capturedWrites.length).toBeGreaterThan(0);
      const written = JSON.parse(capturedWrites[capturedWrites.length - 1]);
      expect(Array.isArray(written)).toBe(true);
      expect(written[0].name).toBe('Test Job');
    });

    it('appends to existing jobs in schedule.json', async () => {
      const existingJobs = [{ id: 'existing-job', name: 'Existing Job', enabled: true }];
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingJobs));

      let writtenData: unknown[] = [];
      mockWriteFileSync.mockImplementation((_path: unknown, data: unknown) => {
        writtenData = JSON.parse(data as string);
      });

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron', {
        name: 'New Job',
        schedule: { kind: 'cron', expr: '0 * * * *' },
      });

      await POST(req);

      expect(writtenData).toHaveLength(2);
      expect((writtenData[0] as { id: string }).id).toBe('existing-job');
      expect((writtenData[1] as { name: string }).name).toBe('New Job');
    });

    it('sets deleteAfterRun to false and state to {} by default', async () => {
      mockExistsSync.mockReturnValue(false);
      let written: unknown[] = [];
      mockWriteFileSync.mockImplementation((_p: unknown, d: unknown) => {
        written = JSON.parse(d as string);
      });

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron', {
        name: 'Minimal Job',
        schedule: { kind: 'cron', expr: '0 0 * * *' },
      });
      await POST(req);

      const job = written[0] as Record<string, unknown>;
      expect(job.deleteAfterRun).toBe(false);
      expect(job.state).toEqual({});
    });
  });

  // ─── POST?action=run ──────────────────────────────────────────────────────

  describe('POST?action=run', () => {
    it('returns 404 when job id is not found', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify([{ id: 'other-job', name: 'Other' }]));

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron?action=run', { id: 'nonexistent-id' });

      const result = await POST(req) as { status: number; _data: unknown };
      expect(result.status).toBe(404);
      expect((result._data as { error: string }).error).toBe('Job not found');
    });

    it('spawns claude process with correct args when job is found', async () => {
      const job = {
        id: 'job-xyz',
        name: 'Spawn Test',
        enabled: true,
        sessionTarget: 'isolated',
        payload: { message: 'Run the daily sync', model: 'claude-haiku-4-5-20251001' },
        state: {},
      };
      // existsSync: true for schedule file (so readFileSync is called), false for agentCwd
      mockExistsSync.mockImplementation((p: unknown) => {
        return (p as string).endsWith('schedule.json');
      });
      mockReadFileSync.mockReturnValue(JSON.stringify([job]));

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron?action=run', { id: 'job-xyz' });

      const result = await POST(req) as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      expect((result._data as { success: boolean }).success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledOnce();

      const spawnArgs = mockSpawn.mock.calls[0];
      expect(spawnArgs[0]).toContain('claude');
      expect(spawnArgs[1]).toContain('--print');
      expect(spawnArgs[1]).toContain('Run the daily sync');
    });

    it('returns success even if spawn throws (fire-and-forget)', async () => {
      const job = {
        id: 'job-abc',
        name: 'Fire And Forget',
        enabled: true,
        sessionTarget: 'isolated',
        payload: { message: 'Check tasks' },
        state: {},
      };
      mockExistsSync.mockImplementation((p: unknown) => (p as string).endsWith('schedule.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify([job]));
      mockSpawn.mockImplementationOnce(() => { throw new Error('spawn failed'); });

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron?action=run', { id: 'job-abc' });

      const result = await POST(req) as { status: number; _data: unknown };

      // Should still succeed — spawn failure is swallowed
      expect(result.status).toBe(200);
      expect((result._data as { success: boolean }).success).toBe(true);
    });

    it('updates job state with runningAtMs after run', async () => {
      const job = {
        id: 'job-run',
        name: 'State Update',
        enabled: true,
        sessionTarget: 'isolated',
        payload: { message: 'Go' },
        state: {},
      };
      mockExistsSync.mockImplementation((p: unknown) => (p as string).endsWith('schedule.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify([job]));

      const before = Date.now();
      let writtenJobs: unknown[] = [];
      mockWriteFileSync.mockImplementation((_p: unknown, d: unknown) => {
        writtenJobs = JSON.parse(d as string);
      });

      const { POST } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron?action=run', { id: 'job-run' });
      await POST(req);
      const after = Date.now();

      const updatedJob = writtenJobs[0] as { state: { runningAtMs: number } };
      expect(updatedJob.state.runningAtMs).toBeGreaterThanOrEqual(before);
      expect(updatedJob.state.runningAtMs).toBeLessThanOrEqual(after);
    });
  });

  // ─── PATCH ────────────────────────────────────────────────────────────────

  describe('PATCH', () => {
    it('updates a job field and writes back to file', async () => {
      const jobs = [
        { id: 'job-1', name: 'Job One', enabled: true },
        { id: 'job-2', name: 'Job Two', enabled: true },
      ];
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(jobs));

      let writtenJobs: unknown[] = [];
      mockWriteFileSync.mockImplementation((_p: unknown, d: unknown) => {
        writtenJobs = JSON.parse(d as string);
      });

      const { PATCH } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron', { id: 'job-1', enabled: false });

      const result = await PATCH(req) as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      expect((result._data as { success: boolean }).success).toBe(true);

      const updated = writtenJobs.find((j) => (j as { id: string }).id === 'job-1') as { enabled: boolean };
      expect(updated.enabled).toBe(false);
      // Other job untouched
      const other = writtenJobs.find((j) => (j as { id: string }).id === 'job-2') as { enabled: boolean };
      expect(other.enabled).toBe(true);
    });

    it('can update arbitrary fields on a job', async () => {
      const jobs = [{ id: 'job-3', name: 'Orig Name', enabled: true, description: 'Old desc' }];
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(jobs));

      let writtenJobs: unknown[] = [];
      mockWriteFileSync.mockImplementation((_p: unknown, d: unknown) => {
        writtenJobs = JSON.parse(d as string);
      });

      const { PATCH } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron', { id: 'job-3', name: 'New Name', description: 'New desc' });
      await PATCH(req);

      const j = writtenJobs[0] as { name: string; description: string };
      expect(j.name).toBe('New Name');
      expect(j.description).toBe('New desc');
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────

  describe('DELETE', () => {
    it('returns 400 when id param is missing', async () => {
      const { DELETE } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron');

      const result = await DELETE(req) as { status: number; _data: unknown };
      expect(result.status).toBe(400);
      expect((result._data as { error: string }).error).toBe('id required');
    });

    it('removes job by id from schedule.json', async () => {
      const jobs = [
        { id: 'keep-me', name: 'Keep' },
        { id: 'delete-me', name: 'Delete' },
      ];
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(jobs));

      let writtenJobs: unknown[] = [];
      mockWriteFileSync.mockImplementation((_p: unknown, d: unknown) => {
        writtenJobs = JSON.parse(d as string);
      });

      const { DELETE } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron?id=delete-me');

      const result = await DELETE(req) as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      expect((result._data as { success: boolean }).success).toBe(true);
      expect(writtenJobs).toHaveLength(1);
      expect((writtenJobs[0] as { id: string }).id).toBe('keep-me');
    });

    it('returns success even if job id does not exist (idempotent)', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify([{ id: 'other', name: 'Other' }]));

      let writtenJobs: unknown[] = [];
      mockWriteFileSync.mockImplementation((_p: unknown, d: unknown) => {
        writtenJobs = JSON.parse(d as string);
      });

      const { DELETE } = await import('../../../app/api/cron/route');
      const req = makeRequest('http://localhost/api/cron?id=no-such-job');
      const result = await DELETE(req) as { status: number; _data: unknown };

      expect(result.status).toBe(200);
      // Original jobs untouched
      expect(writtenJobs).toHaveLength(1);
    });
  });
});
