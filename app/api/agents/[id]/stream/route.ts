import { NextRequest } from 'next/server';
import { getDb } from '@/lib/database';
import { calcCostUsd } from '@/lib/env';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();
const CLAUDE_BIN = '/Users/kevin.macarthur/.npm-global/bin/claude';

// ── File cache ─────────────────────────────────────────────────────────────
interface CacheEntry { content: string; mtime: number; }
const soulCache = new Map<string, CacheEntry>();
const memCache  = new Map<string, CacheEntry>();

function readCached(cache: Map<string, CacheEntry>, path: string): string | null {
  if (!existsSync(path)) return null;
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.content;
  const content = readFileSync(path, 'utf-8').trim();
  cache.set(path, { content, mtime });
  return content;
}

const CHAT_SUFFIX = `\n\n---
You are in chat mode. Respond conversationally and stay in character.
Task management: Use mcp__mission-control_db__task_* tools — NOT built-in TaskCreate/TaskList/TaskUpdate.
Artifacts: Wrap code/scripts/data in fenced code blocks.`;

function buildSystemPrompt(id: string): string | null {
  const dir = join(HOME, 'mission-control', 'agents', id);
  const soul = readCached(soulCache, join(dir, 'SOUL.md'));
  if (soul) {
    let p = soul + CHAT_SUFFIX;
    const mem = readCached(memCache, join(dir, 'MEMORY.md'));
    if (mem) p += `\n\n---\n## Your Memory\n${mem}`;
    return p;
  }
  try {
    const agent = getDb().prepare('SELECT name, role, personality FROM agents WHERE id = ?').get(id) as {
      personality?: string; role?: string; name?: string;
    } | undefined;
    if (agent) {
      const parts: string[] = [];
      if (agent.role) parts.push(`You are ${agent.name || id}, a ${agent.role}.`);
      if (agent.personality) parts.push(agent.personality);
      parts.push('Task management: Use mcp__mission-control_db__task_* tools.\nArtifacts: Wrap code in fenced code blocks.');
      return parts.join('\n');
    }
  } catch { /* DB not available */ }
  return null;
}

// ── Session pool ────────────────────────────────────────────────────────────
// Tracks Claude CLI session IDs per agent for conversation continuity.
// Each message spawns a --print process; --resume keeps the conversation going.
// This is faster than maintaining context in the prompt and preserves native history.

interface SessionEntry {
  sessionId:    string;
  soulMtime:    number;  // invalidate when SOUL.md changes
  lastActivity: number;
}

type G = typeof globalThis & { _agentSessions?: Map<string, SessionEntry> };
const sessions: Map<string, SessionEntry> = (globalThis as G)._agentSessions
  ?? ((globalThis as G)._agentSessions = new Map());

// Reap sessions inactive for 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, s] of sessions) {
    if (s.lastActivity < cutoff) sessions.delete(id);
  }
}, 60_000).unref();

function loadSessionFromDb(agentId: string): SessionEntry | null {
  try {
    const row = getDb().prepare('SELECT sessionId, lastActivity FROM agent_sessions WHERE agentId = ? AND status = ?')
      .get(agentId, 'active') as { sessionId: string; lastActivity: number } | undefined;
    if (!row?.sessionId) return null;
    return { sessionId: row.sessionId, soulMtime: 0, lastActivity: row.lastActivity };
  } catch { return null; }
}

function persistSessionToDb(agentId: string, sessionId: string, model: string) {
  try {
    const now = Date.now();
    getDb().prepare(`INSERT OR REPLACE INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
      VALUES (?, ?, ?, COALESCE((SELECT createdAt FROM agent_sessions WHERE agentId = ?), ?), ?, 'active')`)
      .run(agentId, sessionId, model, agentId, now, now);
  } catch { /* non-critical */ }
}

function soulMtime(id: string): number {
  const p = join(HOME, 'mission-control', 'agents', id, 'SOUL.md');
  return existsSync(p) ? statSync(p).mtimeMs : 0;
}

// ── Per-agent spawn lock ─────────────────────────────────────────────────────
// Prevents duplicate concurrent streams to the same agent.
type G2 = typeof globalThis & { _agentLocks?: Set<string> };
const agentLocks: Set<string> = (globalThis as G2)._agentLocks
  ?? ((globalThis as G2)._agentLocks = new Set());

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[a-z0-9][a-z0-9-_]*$/.test(id) || id.length > 64) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', text: 'Invalid agent ID' })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    );
  }

  const { message, model } = await request.json();

  // Reject if another stream is already active for this agent
  if (agentLocks.has(id)) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', text: `Agent ${id} is already processing a message. Please wait.` })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    );
  }

  agentLocks.add(id);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const enc = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      enc({ type: 'init' });

      try {
        const chatModel = model || 'claude-haiku-4-5-20251001';
        const sm = soulMtime(id);

        // Get session ID for conversation continuity (null = new session)
        // Check in-memory pool first, fall back to DB if not found
        let existing = sessions.get(id);
        if (!existing) {
          const fromDb = loadSessionFromDb(id);
          if (fromDb) {
            existing = { ...fromDb, soulMtime: sm };
            sessions.set(id, existing);
          }
        }
        const resumeId = (existing && existing.soulMtime === sm) ? existing.sessionId : null;

        const dir = join(HOME, 'mission-control', 'agents', id);
        const cwd = existsSync(dir) ? dir : HOME;

        const args = [
          '--print',                        // non-interactive, exits after response
          '--output-format', 'stream-json', // JSON event stream on stdout
          '--verbose',                      // required by stream-json format
          '--model', chatModel,
          '--dangerously-skip-permissions',
        ];

        if (resumeId) {
          // Resume existing conversation — history is preserved by the CLI
          args.push('--resume', resumeId);
        } else {
          // New conversation — inject system prompt
          const systemPrompt = buildSystemPrompt(id);
          if (systemPrompt) args.push('--system-prompt', systemPrompt);
        }

        // Strip Claude CLI env vars so nested spawning is allowed
        const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;

        const proc = spawn(CLAUDE_BIN, args, {
          cwd,
          env: cleanEnv,
          stdio: 'pipe',
        });

        // Pipe message to stdin and close it (--print reads plain text from stdin)
        proc.stdin.write(message);
        proc.stdin.end();

        let buf = '';

        proc.stdout.on('data', (data: Buffer) => {
          buf += data.toString();
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line) as {
                type?: string; session_id?: string;
                input_tokens?: number; output_tokens?: number;
              };
              enc(parsed);
              if (parsed.type === 'result') {
                // Save session ID for the next message (in-memory + DB)
                if (parsed.session_id) {
                  sessions.set(id, {
                    sessionId: parsed.session_id,
                    soulMtime: sm,
                    lastActivity: Date.now(),
                  });
                  persistSessionToDb(id, parsed.session_id, chatModel);
                }
                // Log token usage
                const inputT  = parsed.input_tokens  ?? 0;
                const outputT = parsed.output_tokens ?? 0;
                if (inputT > 0 || outputT > 0) {
                  try {
                    const costUsd = calcCostUsd(chatModel, inputT, outputT);
                    getDb().prepare(
                      `INSERT INTO token_usage (agentId, sessionId, model, inputTokens, outputTokens, costUsd, source, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?, 'stream', ?)`
                    ).run(id, parsed.session_id ?? null, chatModel, inputT, outputT, costUsd, Date.now());
                  } catch { /* non-critical */ }
                }
              }
            } catch {
              enc({ type: 'text', text: line });
            }
          }
        });

        proc.stderr.on('data', (data: Buffer) => {
          const text = data.toString().trim();
          if (text) enc({ type: 'debug', text });
        });

        const timeout = setTimeout(() => {
          proc.kill();
          enc({ type: 'timeout', text: 'Response timed out' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          try { controller.close(); } catch { /* already closed */ }
        }, 120_000);

        proc.on('close', (code) => {
          agentLocks.delete(id);
          clearTimeout(timeout);
          enc({ type: 'done', code: code ?? 0 });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          try { controller.close(); } catch { /* already closed */ }

          try {
            getDb().prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?')
              .run('idle', Date.now(), id);
          } catch { /* non-critical */ }
        });

        proc.on('error', (err) => {
          agentLocks.delete(id);
          clearTimeout(timeout);
          enc({ type: 'error', text: err.message });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          try { controller.close(); } catch { /* already closed */ }
        });

      } catch (err: unknown) {
        agentLocks.delete(id);
        enc({ type: 'error', text: err instanceof Error ? err.message : String(err) });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
