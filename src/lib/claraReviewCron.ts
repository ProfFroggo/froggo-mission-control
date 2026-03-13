// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { ENV } from './env';
/**
 * Clara Review Cron — runs every 3 minutes on the server.
 *
 * Two review passes per cycle:
 *
 * 1. PRE-WORK (internal-review): Clara gates tasks before the agent starts.
 *    Approved → in-progress + agent dispatched.
 *    Rejected → back to todo with notes.
 *
 * 2. POST-WORK (review): Clara verifies completed work.
 *    Approved → done.
 *    Rejected → in-progress (agent re-dispatched with feedback).
 */

import { getDb } from './database';
import { TIER_TOOLS, loadDisallowedTools, dispatchTask, recoverStuckInProgressTasks } from './taskDispatcher';
import { trackEvent } from './telemetry';
import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

const HOME          = homedir();
const CLAUDE_BIN    = ENV.CLAUDE_BIN;
const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN      = process.execPath;
const IS_NATIVE_BIN = !CLAUDE_SCRIPT.endsWith('.js');
const REVIEW_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// Track tasks currently being reviewed to avoid duplicates
const inReview    = new Set<string>(); // post-work review
const inPreReview = new Set<string>(); // pre-work review

function spawnClaude(args: string[], opts: Parameters<typeof spawn>[2]) {
  return IS_NATIVE_BIN
    ? spawn(CLAUDE_BIN, args, opts)
    : spawn(NODE_BIN, [CLAUDE_SCRIPT, ...args], opts);
}

function readFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, 'utf-8').trim();
}

function buildClaraSystemPrompt(assignedTo?: string): string {
  const soul = readFile(join(HOME, 'mission-control', 'agents', 'clara', 'SOUL.md'));
  const mem = readFile(join(HOME, 'mission-control', 'agents', 'clara', 'MEMORY.md'));
  let prompt = soul || 'You are Clara, the quality reviewer for the Mission Control platform.';
  if (mem && mem.trim()) prompt += `\n\n---\n## Your Memory\n${mem}`;

  // Load agent-specific review history
  if (assignedTo) {
    const patternFile = join(HOME, 'mission-control', 'memory', 'agents', 'clara', 'agent-patterns', `${assignedTo}.md`);
    const patterns = readFile(patternFile);
    if (patterns) {
      // Keep last 20 lines to control token usage
      const recentPatterns = patterns.split('\n').filter(Boolean).slice(-20).join('\n');
      prompt += `\n\n---\n## Your Past Reviews of ${assignedTo}\n${recentPatterns}`;
    }
  }

  return prompt;
}

function resetReviewStatus(taskId: unknown): void {
  try {
    getDb()
      .prepare("UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE id = ? AND reviewStatus = 'in-review'")
      .run(Date.now(), taskId);
  } catch { /* non-critical */ }
}

function resetPreReviewStatus(taskId: unknown): void {
  try {
    getDb()
      .prepare("UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE id = ? AND reviewStatus = 'pre-review'")
      .run(Date.now(), taskId);
  } catch { /* non-critical */ }
}

// ── Pre-work review (internal-review → in-progress or back to todo) ───────────

export function spawnClaraPreReview(task: Record<string, unknown>): void {
  if (inPreReview.has(task.id as string)) return;
  inPreReview.add(task.id as string);

  const assignedTo = (task.assignedTo as string | undefined) || undefined;

  // Fetch subtask count to include in Clara's review context
  let subtaskCount = 0;
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE taskId = ?')
      .get(task.id as string) as { cnt: number } | undefined;
    subtaskCount = row?.cnt ?? 0;
  } catch { /* non-critical */ }

  const hasAgent       = !!assignedTo;
  const hasPlanningNotes = !!(task.planningNotes as string | null)?.trim();
  const hasSubtasks    = subtaskCount >= 1;

  const message = [
    `## Pre-work Review — Task: ${task.id}`,
    `**Title:** ${task.title}`,
    task.description ? `**Description:** ${task.description}` : '**Description:** MISSING',
    `**Assigned to:** ${assignedTo || 'UNASSIGNED'}`,
    `**Planning notes:** ${hasPlanningNotes ? (task.planningNotes as string).slice(0, 500) : 'MISSING'}`,
    `**Subtasks:** ${subtaskCount} created`,
    `**Priority:** ${task.priority || 'p2'}`,
    '',
    '## Your job: check all 3 gates. ALL must pass before work starts.',
    '',
    `GATE 1 — Agent assigned: ${hasAgent ? '✓ PASS' : '✗ FAIL — no agent assigned'}`,
    `GATE 2 — Planning notes: ${hasPlanningNotes ? '✓ PASS' : '✗ FAIL — planningNotes is empty'}`,
    `GATE 3 — Subtasks: ${hasSubtasks ? `✓ PASS (${subtaskCount})` : '✗ FAIL — no subtasks created yet'}`,
    '',
    'If ALL gates pass → approve:',
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress", "reviewStatus": "pre-approved", "reviewNotes": "All gates passed." }`,
    '',
    'If ANY gate fails → reject back to todo with specific notes listing exactly what is missing:',
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "todo", "reviewStatus": "pre-rejected", "reviewNotes": "<list each failing gate and what must be added>" }`,
    '',
    'Do not ask clarifying questions. Make the call now based only on the data above.',
  ].filter(Boolean).join('\n');

  trackEvent('clara.pre-review.start', { taskId: task.id });
  try {
    getDb()
      .prepare("UPDATE tasks SET reviewStatus = 'pre-review', updatedAt = ? WHERE id = ?")
      .run(Date.now(), task.id);
  } catch { /* non-critical */ }

  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env as Record<string, string>;

  // Inject binary dirs into PATH (same as taskDispatcher)
  if (!cleanEnv.PATH) cleanEnv.PATH = process.env.PATH || '';
  const nodeBinDir = dirname(NODE_BIN);
  if (!cleanEnv.PATH.includes(nodeBinDir)) cleanEnv.PATH = nodeBinDir + ':' + cleanEnv.PATH;
  const claudeBinDir = dirname(CLAUDE_BIN || '');
  if (claudeBinDir && claudeBinDir !== '.' && !cleanEnv.PATH.includes(claudeBinDir)) {
    cleanEnv.PATH = claudeBinDir + ':' + cleanEnv.PATH;
  }

  const proc = spawnClaude([
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', 'claude-haiku-4-5-20251001',
    '--allowedTools', TIER_TOOLS['worker'].join(','),
    '--disallowedTools', loadDisallowedTools('clara').join(','),
    '--system-prompt', buildClaraSystemPrompt(assignedTo),
  ], {
    cwd: process.cwd(),
    env: cleanEnv as NodeJS.ProcessEnv,
    stdio: 'pipe',
  });

  proc.stdin.write(message);
  proc.stdin.end();
  proc.stdout.resume();
  proc.stderr.resume();

  const reviewTimeout = setTimeout(() => {
    try { proc.kill(); } catch { /* already exited */ }
  }, 3 * 60_000);

  proc.on('close', () => {
    clearTimeout(reviewTimeout);
    inPreReview.delete(task.id as string);
    trackEvent('clara.pre-review.complete', { taskId: task.id });

    // If Clara exited without acting, reset so the next sweep retries
    resetPreReviewStatus(task.id);

    // Brief delay so DB write from MCP has settled, then check outcome
    setTimeout(() => {
      try {
        const db = getDb();
        const current = db.prepare('SELECT status, assignedTo, reviewStatus FROM tasks WHERE id = ?')
          .get(task.id as string) as { status: string; assignedTo: string | null; reviewStatus: string | null } | undefined;

        if (current?.status === 'in-progress' && current?.assignedTo) {
          // Clara approved — dispatch the agent now
          console.log(`[clara-review-cron] Pre-review approved task ${task.id} — dispatching to ${current.assignedTo}`);
          db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
            .run(task.id, 'clara', 'pre-review-approved', 'Clara approved — dispatching agent', Date.now());
          dispatchTask(task.id as string);
        } else if (current?.status === 'todo') {
          // Clara rejected — log it
          console.log(`[clara-review-cron] Pre-review rejected task ${task.id} — returned to todo`);
        }
      } catch { /* non-critical */ }
    }, 2000);
  });

  proc.on('error', () => {
    clearTimeout(reviewTimeout);
    inPreReview.delete(task.id as string);
    resetPreReviewStatus(task.id);
  });
}

// ── Post-work review (review → done or back to in-progress) ──────────────────

export function spawnClaraReview(task: Record<string, unknown>): void {
  if (inReview.has(task.id as string)) return;
  inReview.add(task.id as string);

  const assignedTo = (task.assignedTo as string | undefined) || undefined;

  const message = [
    `## Review Task: ${task.id}`,
    `**Title:** ${task.title}`,
    task.description ? `**Description:** ${task.description}` : null,
    `**Assigned to:** ${assignedTo || 'unassigned'}`,
    `**Progress:** ${task.progress ?? 0}%`,
    task.lastAgentUpdate ? `**Agent's update:** ${task.lastAgentUpdate}` : null,
    '',
    'Review this task and update it immediately:',
    `- Approved → mcp__mission-control_db__task_update { "id": "${task.id}", "status": "done", "reviewStatus": "approved", "reviewNotes": "..." }`,
    `- Rejected → mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress", "reviewStatus": "rejected", "reviewNotes": "<specific issues>" }`,
    '',
    'Make your decision now. Do not ask clarifying questions.',
  ].filter(Boolean).join('\n');

  // Stamp reviewedAt so we can detect stale in-review rows
  const startedAt = Date.now();
  trackEvent('clara.review.start', { taskId: task.id });
  try {
    getDb()
      .prepare("UPDATE tasks SET reviewStatus = 'in-review', updatedAt = ? WHERE id = ?")
      .run(startedAt, task.id);
  } catch { /* non-critical */ }

  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env as Record<string, string>;

  // Inject binary dirs into PATH
  if (!cleanEnv.PATH) cleanEnv.PATH = process.env.PATH || '';
  const nodeBinDir = dirname(NODE_BIN);
  if (!cleanEnv.PATH.includes(nodeBinDir)) cleanEnv.PATH = nodeBinDir + ':' + cleanEnv.PATH;
  const claudeBinDir = dirname(CLAUDE_BIN || '');
  if (claudeBinDir && claudeBinDir !== '.' && !cleanEnv.PATH.includes(claudeBinDir)) {
    cleanEnv.PATH = claudeBinDir + ':' + cleanEnv.PATH;
  }

  const proc = spawnClaude([
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', 'claude-haiku-4-5-20251001',
    '--allowedTools', TIER_TOOLS['worker'].join(','),
    '--disallowedTools', loadDisallowedTools('clara').join(','),
    '--system-prompt', buildClaraSystemPrompt(assignedTo),
  ], {
    cwd: process.cwd(),
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
    trackEvent('clara.review.complete', { taskId: task.id });
    // If Clara exited without calling task_update (MCP failure, model responded without
    // using tools, process killed), reviewStatus is still 'in-review' in the DB.
    // Reset it so the next cron sweep retries.
    resetReviewStatus(task.id);

    // After Clara's review, log the outcome to her pattern memory
    setTimeout(() => {
      try {
        const reviewed = getDb()
          .prepare(`SELECT reviewStatus, reviewNotes FROM tasks WHERE id = ?`)
          .get(task.id as string) as { reviewStatus: string; reviewNotes: string } | undefined;

        if (reviewed?.reviewStatus === 'approved' || reviewed?.reviewStatus === 'rejected') {
          const patternDir = join(HOME, 'mission-control', 'memory', 'agents', 'clara', 'agent-patterns');
          mkdirSync(patternDir, { recursive: true });

          const agentId = assignedTo || 'unknown';
          const patternFile = join(patternDir, `${agentId}.md`);
          const date = new Date().toISOString().slice(0, 10);
          const line = `${date} | ${task.title} | ${reviewed.reviewStatus} | ${(reviewed.reviewNotes || '').slice(0, 200)}\n`;
          appendFileSync(patternFile, line, 'utf-8');
          trackEvent('memory.written', { agentId: 'clara' });
        }
      } catch { /* non-critical */ }
    }, 2000); // Brief delay so DB write from MCP has settled
  });

  proc.on('error', () => {
    clearTimeout(reviewTimeout);
    inReview.delete(task.id as string);
    resetReviewStatus(task.id);
  });
}

export function runReviewCycle(): { queued: number } {
  let queued = 0;

  // ── Pre-work pass: tasks in internal-review waiting for Clara's gate ─────────
  try {
    // Include tasks with no agent too — Clara rejects them with "no agent assigned"
    const preTasks = getDb()
      .prepare(`SELECT id, title, description, assignedTo, priority, planningNotes FROM tasks
                WHERE status = 'internal-review'
                  AND (reviewStatus IS NULL OR reviewStatus NOT IN ('pre-review', 'pre-approved'))`)
      .all() as Record<string, unknown>[];

    for (const task of preTasks) {
      spawnClaraPreReview(task);
      queued++;
    }
    if (preTasks.length > 0) {
      console.log(`[clara-review-cron] Queued ${preTasks.length} task(s) for pre-work review`);
    }
  } catch { /* non-critical */ }

  // ── Post-work pass: safety net for orphaned approved tasks ───────────────────
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

  // ── Post-work pass: tasks in review waiting for Clara's sign-off ─────────────
  try {
    const reviewTasks = getDb()
      .prepare(`SELECT id, title, description, assignedTo, progress, lastAgentUpdate FROM tasks
                WHERE status = 'review' AND (reviewStatus IS NULL OR reviewStatus NOT IN ('in-review', 'approved'))`)
      .all() as Record<string, unknown>[];

    for (const task of reviewTasks) {
      spawnClaraReview(task);
      queued++;
    }
    if (reviewTasks.length > 0) {
      console.log(`[clara-review-cron] Queued ${reviewTasks.length} task(s) for post-work review`);
    }
  } catch { /* non-critical */ }

  return { queued };
}

// ── Cron timer ────────────────────────────────────────────────────────────────
type G = typeof globalThis & { _claraReviewCron?: ReturnType<typeof setInterval> };

export function startClaraReviewCron(): void {
  const g = globalThis as G;
  if (g._claraReviewCron) return;
  // Set sentinel immediately (before setInterval) to prevent concurrent callers from racing in
  g._claraReviewCron = true as unknown as ReturnType<typeof setInterval>;

  const db = getDb();
  const now = Date.now();

  // On startup: reset stale post-work 'in-review' markers
  try {
    const stale = db
      .prepare(`UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE status = 'review' AND reviewStatus = 'in-review'`)
      .run(now);
    if (stale.changes > 0) {
      console.log(`[clara-review-cron] Reset ${stale.changes} stale post-review task(s) from previous session`);
    }
  } catch { /* DB may not be ready yet */ }

  // On startup: reset stale pre-work 'pre-review' markers
  try {
    const stale = db
      .prepare(`UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE status = 'internal-review' AND reviewStatus = 'pre-review'`)
      .run(now);
    if (stale.changes > 0) {
      console.log(`[clara-review-cron] Reset ${stale.changes} stale pre-review task(s) from previous session`);
    }
  } catch { /* non-critical */ }

  // On startup: re-dispatch tasks stuck in 'in-progress' from a previous server session.
  recoverStuckInProgressTasks();

  const interval = setInterval(runReviewCycle, REVIEW_INTERVAL_MS);
  interval.unref?.();
  g._claraReviewCron = interval;
  console.log('[clara-review-cron] Started — runs every 3 minutes (pre-work + post-work passes)');
}
