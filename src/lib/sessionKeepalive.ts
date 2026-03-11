// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { ENV } from './env';
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
 *
 * Memory checkpoints:
 *   On each keepalive cycle, chat sessions (chat:{agentId}) that have messages
 *   get a session checkpoint written to the agent's memory vault. This means even
 *   if the server dies immediately after, the next session starts with structured
 *   memory context (loaded via memory_recall) rather than just raw message history.
 */

import { getDb } from './database';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

const HOME          = homedir();
const CLAUDE_BIN    = ENV.CLAUDE_BIN;
const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN      = process.execPath;

// Ping sessions that are idle between 25 min and 90 min
// (< 25 min = recently active, no need; > 90 min = too late, let failsafe handle it)
const KEEPALIVE_INTERVAL_MS = 25 * 60 * 1000;
const ACTIVE_WINDOW_MS      = 90 * 60 * 1000;
const MIN_IDLE_MS           = 25 * 60 * 1000;

// Prevent duplicate concurrent pings for the same sessionKey
const inFlight = new Set<string>();

// Track which sessions have already had a checkpoint written this cycle
// so we don't re-write on every ping.
const checkpointWritten = new Set<string>();

/**
 * Write a structured session checkpoint to the agent's memory vault.
 * Called on every keepalive cycle for chat sessions with message history.
 * The checkpoint is loaded via memory_recall when a new session starts —
 * giving the agent structured context even after server restart or expiry.
 *
 * Only writes for chat:{agentId} session keys — task and room sessions
 * have separate context mechanisms (task activity log, room message table).
 */
function writeMemoryCheckpoint(sessionKey: string): void {
  // Only handle chat sessions: chat:{agentId}
  if (!sessionKey.startsWith('chat:')) return;
  const agentId = sessionKey.slice(5);
  if (!agentId) return;

  // Avoid re-writing within the same process lifetime unless the session key changes
  if (checkpointWritten.has(sessionKey)) return;

  try {
    const db = getDb();

    // Fetch last 30 messages for this session
    const rows = db
      .prepare(`SELECT role, content, timestamp FROM messages
                WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT 30`)
      .all(sessionKey) as { role: string; content: string; timestamp: number }[];

    if (rows.length === 0) return;

    const reversed = rows.reverse();
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const lines = [
      `# Session Checkpoint — ${dateStr}`,
      ``,
      `**Agent**: ${agentId}`,
      `**Written**: ${timeStr} UTC`,
      `**Messages captured**: ${reversed.length}`,
      ``,
      `## Conversation`,
      ``,
    ];

    for (const msg of reversed) {
      const speaker = msg.role === 'user' ? '**User**' : '**Assistant**';
      const ts = new Date(msg.timestamp).toISOString().replace('T', ' ').slice(0, 16);
      // Truncate very long messages — detail is in the raw messages table
      const content = msg.content.length > 2000
        ? msg.content.slice(0, 2000) + '\n…[truncated]'
        : msg.content;
      lines.push(`${speaker} _(${ts})_`);
      lines.push(content);
      lines.push('');
    }

    lines.push(`---`);
    lines.push(`*Use this as context — full history available via message DB.*`);

    const vaultDir = join(HOME, 'mission-control', 'memory', 'agents', agentId);
    mkdirSync(vaultDir, { recursive: true });
    const filePath = join(vaultDir, `${dateStr}-session-checkpoint.md`);
    writeFileSync(filePath, lines.join('\n'), 'utf-8');

    checkpointWritten.add(sessionKey);
  } catch { /* non-critical — never block the keepalive */ }
}

function pingSession(sessionKey: string, sessionId: string): void {
  if (inFlight.has(sessionKey)) return;
  inFlight.add(sessionKey);

  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;

  const proc = spawn(NODE_BIN, [CLAUDE_SCRIPT,
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
    // Write memory checkpoint for chat sessions so agents have structured
    // context if this session later expires or the server restarts
    writeMemoryCheckpoint(agentId);
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
