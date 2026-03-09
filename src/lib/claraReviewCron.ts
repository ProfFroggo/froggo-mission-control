// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { ENV } from './env';
/**
 * Clara Review Cron — runs every 3 minutes on the server.
 * Finds all tasks in 'review' status without an active/completed review
 * and triggers Clara to review each one.
 */

import { getDb } from './database';
import { TIER_TOOLS, loadDisallowedTools } from './taskDispatcher';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

const HOME          = homedir();
const CLAUDE_BIN    = ENV.CLAUDE_BIN;
const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN      = process.execPath;
const REVIEW_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// Track tasks currently being reviewed to avoid duplicates
const inReview = new Set<string>();

function readFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8').trim();
}

function buildClaraSystemPrompt(): string {
  const soul = readFile(join(HOME, 'mission-control', 'agents', 'clara', 'SOUL.md'));
  const mem = readFile(join(HOME, 'mission-control', 'agents', 'clara', 'MEMORY.md'));
  let prompt = soul || 'You are Clara, the quality reviewer for the Mission Control platform.';
  if (mem) prompt += `\n\n---\n## Your Memory\n${mem}`;
  return prompt;
}

function resetReviewStatus(taskId: unknown): void {
  try {
    getDb()
      .prepare("UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE id = ? AND reviewStatus = 'in-review'")
      .run(Date.now(), taskId);
  } catch { /* non-critical */ }
}

export function spawnClaraReview(task: Record<string, unknown>): void {
  if (inReview.has(task.id as string)) return;
  inReview.add(task.id as string);

  const message = [
    `## Review Task: ${task.id}`,
    `**Title:** ${task.title}`,
    task.description ? `**Description:** ${task.description}` : null,
    `**Assigned to:** ${task.assignedTo || 'unassigned'}`,
    `**Progress:** ${task.progress ?? 0}%`,
    task.lastAgentUpdate ? `**Agent's update:** ${task.lastAgentUpdate}` : null,
    '',
    'Review this task and update it immediately:',
    `- Approved → mcp__mission-control-db__task_update { "id": "${task.id}", "status": "done", "reviewStatus": "approved", "reviewNotes": "..." }`,
    `- Rejected → mcp__mission-control-db__task_update { "id": "${task.id}", "status": "in-progress", "reviewStatus": "rejected", "reviewNotes": "<specific issues>" }`,
    '',
    'Make your decision now. Do not ask clarifying questions.',
  ].filter(Boolean).join('\n');

  // Stamp reviewedAt so we can detect stale in-review rows
  const startedAt = Date.now();
  try {
    getDb()
      .prepare("UPDATE tasks SET reviewStatus = 'in-review', updatedAt = ? WHERE id = ?")
      .run(startedAt, task.id);
  } catch { /* non-critical */ }

  const claraDir = join(HOME, 'mission-control', 'agents', 'clara');
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;

  const proc = spawn(NODE_BIN, [CLAUDE_SCRIPT,
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', 'claude-haiku-4-5-20251001',
    '--allowedTools', TIER_TOOLS['worker'].join(','),
    '--disallowedTools', loadDisallowedTools('clara').join(','),
    '--system-prompt', buildClaraSystemPrompt(),
  ], {
    cwd: existsSync(claraDir) ? claraDir : HOME,
    env: cleanEnv as NodeJS.ProcessEnv,
    stdio: 'pipe',
  });

  proc.stdin.write(message);
  proc.stdin.end();
  proc.stdout.resume();
  proc.stderr.resume();

  // Kill Clara's process after 3 minutes — prevents zombie reviews
  const reviewTimeout = setTimeout(() => {
    try { proc.kill(); } catch { /* already exited */ }
  }, 3 * 60_000);

  proc.on('close', () => {
    clearTimeout(reviewTimeout);
    inReview.delete(task.id as string);
    // If Clara exited without calling task_update (MCP failure, model responded without
    // using tools, process killed), reviewStatus is still 'in-review' in the DB.
    // Reset it so the next cron sweep retries.
    resetReviewStatus(task.id);
  });

  proc.on('error', () => {
    clearTimeout(reviewTimeout);
    inReview.delete(task.id as string);
    resetReviewStatus(task.id);
  });
}

export function runReviewCycle(): { queued: number } {
  // Safety net: advance any orphaned approved tasks that never moved to done
  try {
    const orphaned = getDb()
      .prepare(`SELECT id FROM tasks WHERE status = 'review' AND reviewStatus = 'approved'`)
      .all() as { id: string }[];
    for (const { id } of orphaned) {
      const now = Date.now();
      getDb().prepare(`UPDATE tasks SET status = 'done', completedAt = ?, updatedAt = ? WHERE id = ?`).run(now, now, id);
      getDb().prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(id, 'system', 'status_change', 'Status → done (auto-advanced orphaned approved task)', now);
    }
  } catch { /* non-critical */ }

  let tasks: Record<string, unknown>[] = [];
  try {
    tasks = getDb()
      .prepare(`SELECT id, title, description, assignedTo, progress, lastAgentUpdate FROM tasks
                WHERE status = 'review' AND (reviewStatus IS NULL OR reviewStatus NOT IN ('in-review', 'approved'))`)
      .all() as Record<string, unknown>[];
  } catch {
    return { queued: 0 };
  }

  let queued = 0;
  for (const task of tasks) {
    spawnClaraReview(task);
    queued++;
  }

  if (queued > 0) {
    console.log(`[clara-review-cron] Queued ${queued} task(s) for Clara review`);
  }
  return { queued };
}

// ── Cron timer ────────────────────────────────────────────────────────────────
type G = typeof globalThis & { _claraReviewCron?: ReturnType<typeof setInterval> };

export function startClaraReviewCron(): void {
  const g = globalThis as G;
  if (g._claraReviewCron) return;
  // Set sentinel immediately (before setInterval) to prevent concurrent callers from racing in
  g._claraReviewCron = true as unknown as ReturnType<typeof setInterval>;

  // On startup: reset any tasks stuck at 'in-review' from a previous server session.
  // The in-memory inReview Set is empty after restart, so these would never be retried
  // without this cleanup.
  try {
    const stale = getDb()
      .prepare(`UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE status = 'review' AND reviewStatus = 'in-review'`)
      .run(Date.now());
    if (stale.changes > 0) {
      console.log(`[clara-review-cron] Reset ${stale.changes} stale in-review task(s) from previous session`);
    }
  } catch { /* DB may not be ready yet — runReviewCycle will handle them */ }

  const interval = setInterval(runReviewCycle, REVIEW_INTERVAL_MS);
  interval.unref?.();
  g._claraReviewCron = interval;
  console.log('[clara-review-cron] Started — runs every 3 minutes');
}
