/**
 * Session Keepalive — pings active Claude CLI sessions every 25 minutes.
 *
 * Claude CLI sessions expire after ~60 min of inactivity on Anthropic's servers.
 * This service sends a silent "." ping via --resume to reset that timer.
 *
 * Pings are NOT written to the messages table — they will never appear in the chat UI.
 * They DO appear in Claude's server-side conversation history, but as a single dot
 * followed by a brief reply, which is negligible noise for a language model.
 *
 * History injection (in stream/route.ts) remains as a fallback for:
 *   - Server restarts (all in-memory sessions lost)
 *   - Network gaps longer than 60 min
 *   - Sessions missed by this cron (e.g. session created after last cycle)
 */

import { getDb } from './database';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { spawn } from 'child_process';

const HOME = homedir();
const CLAUDE_BIN = '/Users/kevin.macarthur/.npm-global/bin/claude';

// Ping sessions that are idle between 25 min and 90 min
// (< 25 min = recently active, no need; > 90 min = too late, let failsafe handle it)
const KEEPALIVE_INTERVAL_MS = 25 * 60 * 1000;
const ACTIVE_WINDOW_MS      = 90 * 60 * 1000;
const MIN_IDLE_MS           = 25 * 60 * 1000;

// Prevent duplicate concurrent pings for the same sessionKey
const inFlight = new Set<string>();

function pingSession(sessionKey: string, sessionId: string): void {
  if (inFlight.has(sessionKey)) return;
  inFlight.add(sessionKey);

  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;

  const proc = spawn(CLAUDE_BIN, [
    '--resume', sessionId,
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
  ], {
    cwd: HOME,
    env: cleanEnv as NodeJS.ProcessEnv,
    stdio: 'pipe',
  });

  // Minimal ping — single dot keeps the session alive with minimal history noise
  proc.stdin.write('.');
  proc.stdin.end();
  proc.stdout.resume(); // discard output — we don't need it
  proc.stderr.resume();

  proc.on('close', () => {
    inFlight.delete(sessionKey);
    // Update lastActivity so loadSessionFromDb doesn't expire it prematurely
    try {
      getDb()
        .prepare('UPDATE agent_sessions SET lastActivity = ? WHERE agentId = ?')
        .run(Date.now(), sessionKey);
    } catch { /* non-critical */ }
  });

  proc.on('error', () => {
    inFlight.delete(sessionKey);
  });
}

export function runKeepaliveCycle(): { pinged: number } {
  const now = Date.now();

  let rows: { agentId: string; sessionId: string }[] = [];
  try {
    rows = getDb()
      .prepare(`SELECT agentId, sessionId FROM agent_sessions
                WHERE status = 'active'
                AND lastActivity > ?
                AND lastActivity < ?`)
      .all(now - ACTIVE_WINDOW_MS, now - MIN_IDLE_MS) as { agentId: string; sessionId: string }[];
  } catch { return { pinged: 0 }; }

  let pinged = 0;
  for (const { agentId, sessionId } of rows) {
    pingSession(agentId, sessionId);
    pinged++;
  }

  if (pinged > 0) {
    console.log(`[session-keepalive] Pinged ${pinged} session(s) to prevent expiry`);
  }

  return { pinged };
}

// ── Cron timer ────────────────────────────────────────────────────────────────
type G = typeof globalThis & { _sessionKeepaliveCron?: ReturnType<typeof setInterval> };

export function startSessionKeepalive(): void {
  const g = globalThis as G;
  if (g._sessionKeepaliveCron) return;
  // Set sentinel before setInterval to prevent concurrent callers from racing in
  g._sessionKeepaliveCron = true as unknown as ReturnType<typeof setInterval>;

  const interval = setInterval(runKeepaliveCycle, KEEPALIVE_INTERVAL_MS);
  interval.unref?.();
  g._sessionKeepaliveCron = interval;

  const claudeBinExists = existsSync(CLAUDE_BIN);
  if (!claudeBinExists) {
    console.warn('[session-keepalive] Claude binary not found — keepalive disabled');
    return;
  }

  console.log('[session-keepalive] Started — pings idle sessions every 25 minutes');
}
