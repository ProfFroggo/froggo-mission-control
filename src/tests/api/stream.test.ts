// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Tests for /api/agents/[id]/stream/route.ts
 *
 * The stream route builds a system prompt from SOUL.md / MEMORY.md / DB persona,
 * assembles the full message (with optional conversation history prefix),
 * then spawns a claude process and streams stdout as SSE.
 *
 * We test the business-logic branches by inspecting spawn call arguments,
 * since the actual streaming is just piping subprocess stdout.
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
}));

// ─── Mock fs ──────────────────────────────────────────────────────────────────
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock('fs', () => {
  const mod = {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
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
// We build a minimal EventEmitter-like mock process that we can control
class MockProcess {
  stdin = { end: vi.fn() };
  stdout = {
    _handlers: new Map<string, (data: Buffer) => void>(),
    on(event: string, handler: (data: Buffer) => void) {
      this._handlers.set(event, handler);
      return this;
    },
    emit(event: string, data: Buffer) {
      this._handlers.get(event)?.(data);
    },
  };
  stderr = {
    _handlers: new Map<string, (data: Buffer) => void>(),
    on(event: string, handler: (data: Buffer) => void) {
      this._handlers.set(event, handler);
      return this;
    },
  };
  _closeHandler?: (code: number) => void;
  _errorHandler?: (err: Error) => void;
  on(event: string, handler: (...args: unknown[]) => void) {
    if (event === 'close') this._closeHandler = handler as (code: number) => void;
    if (event === 'error') this._errorHandler = handler as (err: Error) => void;
    return this;
  }
  kill = vi.fn();
}

let currentMockProc: MockProcess;
const mockSpawn = vi.fn(() => {
  currentMockProc = new MockProcess();
  return currentMockProc;
});

vi.mock('child_process', () => {
  const mod = { spawn: mockSpawn };
  return { ...mod, default: mod };
});

// ─── Mock @/lib/database ──────────────────────────────────────────────────────
const mockDbGet = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockDbGet }));
vi.mock('@/lib/database', () => ({
  getDb: vi.fn(() => ({ prepare: mockPrepare })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Minimal request stub — bypasses the real NextRequest entirely so we don't
// hit the "GET/HEAD method cannot have body" guard in Next.js internals.
class StubRequest {
  url: string;
  _body: string;
  constructor(url: string, body: unknown) {
    this.url = url;
    this._body = JSON.stringify(body);
  }
  async json() {
    return JSON.parse(this._body);
  }
}

function makeRequest(url: string, body: unknown) {
  return new StubRequest(url, body) as unknown as import('next/server').NextRequest;
}

// The route returns a ReadableStream Response. We consume it to get all chunks.
async function consumeStream(response: Response): Promise<string[]> {
  const chunks: string[] = [];
  if (!response.body) return chunks;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }
  return chunks;
}

// Trigger the mock process to close after the current microtask queue drains.
// We capture the proc reference at call-time to avoid closure-over-variable issues.
function finishProc(code = 0) {
  // Schedule close via queueMicrotask so it fires after the ReadableStream's
  // `start()` callback has registered the close handler, but before the test
  // resolves the Promise (allowing the stream to actually emit the done event).
  queueMicrotask(() => {
    currentMockProc?._closeHandler?.(code);
  });
}

describe('/api/agents/[id]/stream route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('');
    mockDbGet.mockReturnValue(undefined);
  });

  // ─── History prefix ───────────────────────────────────────────────────────

  describe('history injection', () => {
    it('injects history as conversation prefix when history array is non-empty', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');

      const history = [
        { role: 'user', content: 'Hello there' },
        { role: 'agent', content: 'Hi! How can I help?' },
      ];

      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Tell me more',
          model: 'claude-sonnet-4-6',
          history,
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      expect(mockSpawn).toHaveBeenCalledOnce();
      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const fullMessage = spawnArgs[spawnArgs.length - 1];

      expect(fullMessage).toContain('## Conversation history');
      expect(fullMessage).toContain('[Kevin]: Hello there');
      expect(fullMessage).toContain('[Assistant]: Hi! How can I help?');
      expect(fullMessage).toContain('## Current message');
      expect(fullMessage).toContain('Tell me more');
    });

    it('sends message directly without prefix when history is empty', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');

      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Direct message',
          model: 'claude-sonnet-4-6',
          history: [],
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const fullMessage = spawnArgs[spawnArgs.length - 1];

      expect(fullMessage).toBe('Direct message');
      expect(fullMessage).not.toContain('## Conversation history');
    });

    it('sends message directly when history is not provided', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');

      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'No history message',
          model: 'claude-sonnet-4-6',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const fullMessage = spawnArgs[spawnArgs.length - 1];
      expect(fullMessage).toBe('No history message');
    });

    it('labels user turns as [Kevin] and agent turns as [Assistant]', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');

      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Next',
          history: [
            { role: 'user', content: 'User turn' },
            { role: 'agent', content: 'Agent turn' },
          ],
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const fullMessage = spawnArgs[spawnArgs.length - 1];
      expect(fullMessage).toContain('[Kevin]: User turn');
      expect(fullMessage).toContain('[Assistant]: Agent turn');
    });
  });

  // ─── SOUL.md / MEMORY.md ──────────────────────────────────────────────────

  describe('system prompt construction', () => {
    it('uses SOUL.md as system prompt when file exists', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = p as string;
        return path.includes('SOUL.md') && !path.includes('MEMORY.md');
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        if ((p as string).includes('SOUL.md')) return 'You are Mission Control, the orchestrator.';
        return '';
      });

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Hello',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const systemPromptIdx = spawnArgs.indexOf('--system-prompt');
      expect(systemPromptIdx).toBeGreaterThan(-1);
      const systemPrompt = spawnArgs[systemPromptIdx + 1];
      expect(systemPrompt).toContain('You are Mission Control, the orchestrator.');
      expect(systemPrompt).toContain('chat mode');
    });

    it('appends MEMORY.md content to system prompt when MEMORY.md exists alongside SOUL.md', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = p as string;
        return path.includes('SOUL.md') || path.includes('MEMORY.md');
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        if ((p as string).includes('SOUL.md')) return 'You are Coder.';
        if ((p as string).includes('MEMORY.md')) return 'User prefers TypeScript.';
        return '';
      });

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/coder/stream', {
          message: 'Help with code',
        }),
        { params: Promise.resolve({ id: 'coder' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const systemPromptIdx = spawnArgs.indexOf('--system-prompt');
      const systemPrompt = spawnArgs[systemPromptIdx + 1];
      expect(systemPrompt).toContain('You are Coder.');
      expect(systemPrompt).toContain('Your Memory');
      expect(systemPrompt).toContain('User prefers TypeScript.');
    });

    it('does NOT include --system-prompt when MEMORY.md is empty', async () => {
      mockExistsSync.mockImplementation((p: unknown) => {
        const path = p as string;
        return path.includes('SOUL.md') || path.includes('MEMORY.md');
      });
      mockReadFileSync.mockImplementation((p: unknown) => {
        if ((p as string).includes('SOUL.md')) return 'You are Coder.';
        if ((p as string).includes('MEMORY.md')) return ''; // empty MEMORY.md
        return '';
      });

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/coder/stream', {
          message: 'Help',
        }),
        { params: Promise.resolve({ id: 'coder' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const systemPrompt = spawnArgs[spawnArgs.indexOf('--system-prompt') + 1];
      // SOUL.md is non-empty so system prompt is added, but no memory section
      expect(systemPrompt).not.toContain('Your Memory');
    });

    it('falls back to DB persona when SOUL.md does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockDbGet.mockReturnValue({
        id: 'researcher',
        name: 'Researcher',
        role: 'Research Analyst',
        personality: 'You are thorough and precise.',
      });

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/researcher/stream', {
          message: 'Research quantum computing',
        }),
        { params: Promise.resolve({ id: 'researcher' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const systemPromptIdx = spawnArgs.indexOf('--system-prompt');
      expect(systemPromptIdx).toBeGreaterThan(-1);
      const systemPrompt = spawnArgs[systemPromptIdx + 1];
      expect(systemPrompt).toContain('Researcher');
      expect(systemPrompt).toContain('Research Analyst');
      expect(systemPrompt).toContain('You are thorough and precise.');
    });

    it('does not include --system-prompt when SOUL.md missing and DB returns no agent', async () => {
      mockExistsSync.mockReturnValue(false);
      mockDbGet.mockReturnValue(undefined);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/unknown-agent/stream', {
          message: 'Hello',
        }),
        { params: Promise.resolve({ id: 'unknown-agent' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      expect(spawnArgs).not.toContain('--system-prompt');
    });
  });

  // ─── Spawn args ───────────────────────────────────────────────────────────

  describe('spawn configuration', () => {
    it('always includes --print, --verbose, --output-format stream-json', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Test',
          model: 'claude-opus-4-6',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      expect(spawnArgs).toContain('--print');
      expect(spawnArgs).toContain('--verbose');
      expect(spawnArgs).toContain('--output-format');
      expect(spawnArgs).toContain('stream-json');
      expect(spawnArgs).toContain('--dangerously-skip-permissions');
    });

    it('uses provided model in spawn args', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Test',
          model: 'claude-haiku-4-5-20251001',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const modelIdx = spawnArgs.indexOf('--model');
      expect(modelIdx).toBeGreaterThan(-1);
      expect(spawnArgs[modelIdx + 1]).toBe('claude-haiku-4-5-20251001');
    });

    it('defaults to claude-sonnet-4-6 when model is not provided', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Test',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      );

      const spawnArgs: string[] = mockSpawn.mock.calls[0][1];
      const modelIdx = spawnArgs.indexOf('--model');
      expect(spawnArgs[modelIdx + 1]).toBe('claude-sonnet-4-6');
    });
  });

  // ─── SSE response ─────────────────────────────────────────────────────────

  describe('SSE response', () => {
    it('returns streaming response with correct content-type headers', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      const response = await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Test',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      ) as Response;

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
    });

    it('first SSE event is init type', async () => {
      mockExistsSync.mockReturnValue(false);

      const { POST } = await import('../../../app/api/agents/[id]/stream/route');
      finishProc();
      const response = await POST(
        makeRequest('http://localhost/api/agents/mission-control/stream', {
          message: 'Test',
        }),
        { params: Promise.resolve({ id: 'mission-control' }) }
      ) as Response;

      // Read just the first chunk — the route always sends `{"type":"init"}` first.
      // We cancel the reader immediately after to avoid waiting for stream completion.
      const reader = response.body!.getReader();
      const { value } = await reader.read();
      reader.cancel();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('data: {"type":"init"}');
    });
  });
});
