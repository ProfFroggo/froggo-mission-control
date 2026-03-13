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

  const hasAgent         = !!assignedTo;
  const hasPlanningNotes = !!(task.planningNotes as string | null)?.trim();
  const hasDescription   = !!(task.description as string | null)?.trim();
  const hasSubtasks      = subtaskCount >= 1;
  const hasMinSubtasks   = subtaskCount >= 2;

  const message = [
    `## Pre-work Review — Task: ${task.id}`,
    `**Title:** ${task.title}`,
    hasDescription ? `**Description:** ${task.description}` : '**Description:** MISSING',
    `**Assigned to:** ${assignedTo || 'UNASSIGNED'}`,
    `**Planning notes:** ${hasPlanningNotes ? (task.planningNotes as string).slice(0, 500) : 'MISSING'}`,
    `**Subtasks:** ${subtaskCount} created`,
    `**Priority:** ${task.priority || 'p2'}`,
    '',
    '## Your job: check all 3 gates. Decide now.',
    '',
    `GATE 1 — Agent assigned: ${hasAgent ? 'PASS' : 'FAIL — no agent assigned'}`,
    `GATE 2 — Planning notes non-empty: ${hasPlanningNotes ? 'PASS' : 'FAIL — planningNotes is empty or missing'}`,
    `GATE 3 — At least 1 subtask: ${hasSubtasks ? `PASS (${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''})` : 'FAIL — no subtasks created yet'}`,
    !hasDescription ? 'NOTE — Description is empty (not a hard gate, but worth fixing)' : null,
    !hasMinSubtasks && hasSubtasks ? 'NOTE — Only 1 subtask. Ask agent to expand subtasks as they work.' : null,
    '',
    '## Decision rules',
    'ALL 3 gates pass → approve and dispatch.',
    'Exactly 2 of 3 pass AND the failing gate is minor (only 1 subtask instead of 2, or description missing) → approve, but add a note in reviewNotes asking the agent to expand subtasks as they work.',
    'Any hard gate fails (no agent assigned, OR planningNotes empty) → reject back to todo.',
    '',
    'If approving → use:',
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress", "reviewStatus": "pre-approved", "reviewNotes": "All gates passed." }`,
    '',
    'If rejecting → use this exact format. Your reviewNotes MUST list every missing item so the human knows exactly what to fix:',
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "todo", "reviewStatus": "pre-rejected", "reviewNotes": "MISSING: [item1], [item2]. To fix: [specific action required for each]." }`,
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

  // Fix 1a: wrap stdin write in try-catch so inPreReview is always cleaned up
  try {
    proc.stdin!.write(message);
    proc.stdin!.end();
  } catch (e) {
    inPreReview.delete(task.id as string);
    resetPreReviewStatus(task.id);
    try { proc.kill(); } catch { /* already exited */ }
    console.error('[clara-review-cron] stdin write failed for task', task.id, e);
    return;
  }
  proc.stdout!.resume();
  proc.stderr!.resume();

  const reviewTimeout = setTimeout(() => {
    try { proc.kill(); } catch { /* already exited */ }
  }, 3 * 60_000);

  proc.on('close', () => {
    clearTimeout(reviewTimeout);
    inPreReview.delete(task.id as string);
    trackEvent('clara.pre-review.complete', { taskId: task.id });

    // Fix 1b: only reset reviewStatus if Clara hasn't already made a decision.
    // If Clara approved/rejected, the DB already has the new status — don't clobber it.
    try {
      const dbCheck = getDb();
      const snapshot = dbCheck.prepare('SELECT status, reviewStatus FROM tasks WHERE id = ?')
        .get(task.id as string) as { status: string; reviewStatus: string | null } | undefined;
      if (snapshot?.status === 'internal-review' && snapshot?.reviewStatus === 'pre-review') {
        resetPreReviewStatus(task.id);
      }
    } catch { /* non-critical — fall back to always-reset */ resetPreReviewStatus(task.id); }

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

  // Fetch subtasks and activity for richer review context
  let subtaskSummary = '';
  let activitySummary = '';
  try {
    const dbCtx = getDb();
    const subtasks = dbCtx.prepare(
      'SELECT title, completed FROM subtasks WHERE taskId = ? ORDER BY position'
    ).all(task.id as string) as { title: string; completed: number }[];
    if (subtasks.length > 0) {
      const done = subtasks.filter(s => s.completed).length;
      subtaskSummary = `**Subtasks:** ${done}/${subtasks.length} complete\n` +
        subtasks.map(s => `  ${s.completed ? '[x]' : '[ ]'} ${s.title}`).join('\n');
    }
    const acts = dbCtx.prepare(
      `SELECT action, message FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC LIMIT 10`
    ).all(task.id as string) as { action: string; message: string }[];
    if (acts.length > 0) {
      activitySummary = '**Recent activity:**\n' +
        acts.map(a => `  - [${a.action}] ${(a.message || '').slice(0, 120)}`).join('\n');
    }
  } catch { /* non-critical */ }

  const message = [
    `## Post-work Review — Task: ${task.id}`,
    `**Title:** ${task.title}`,
    task.description ? `**Description:** ${task.description}` : null,
    `**Assigned to:** ${assignedTo || 'unassigned'}`,
    `**Progress:** ${task.progress ?? 0}%`,
    task.lastAgentUpdate ? `**Agent's final update:** ${task.lastAgentUpdate}` : null,
    subtaskSummary || null,
    activitySummary || null,
    '',
    '## Your review checklist — ALL must pass for approval:',
    '',
    '1. ALL subtasks complete (not "most" — every single one)',
    '2. task_activity log has meaningful entries (not just status changes)',
    '3. Output files saved to library (look for file mentions in activity log)',
    '4. The deliverable matches what was asked for in the description',
    '',
    'If APPROVED: write specific praise about what was done well in reviewNotes.',
    'If REJECTED: write specific, actionable feedback with example of what good output looks like.',
    '',
    'Make your decision now and call task_update immediately:',
    `- Approved → mcp__mission-control_db__task_update { "id": "${task.id}", "status": "done", "reviewStatus": "approved", "reviewNotes": "<specific praise>" }`,
    `- Rejected → mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress", "reviewStatus": "rejected", "reviewNotes": "<specific issues with examples of what good looks like>" }`,
    '',
    'Do not ask clarifying questions. Make the call now based only on the data above.',
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

  proc.stdin!.write(message);
  proc.stdin!.end();
  proc.stdout!.resume();
  proc.stderr!.resume();

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

  // On startup: recover tasks stuck in internal-review for > 10 minutes with no activity.
  // These are Clara's dropped reviews (process crash, timeout, etc.) — move back to todo.
  try {
    const staleThresholdMs = 10 * 60 * 1000; // 10 minutes
    const staleCutoff = now - staleThresholdMs;
    const timedOut = db.prepare(
      `SELECT t.id FROM tasks t
       WHERE t.status = 'internal-review'
         AND t.updatedAt < ?
         AND NOT EXISTS (
           SELECT 1 FROM task_activity a
           WHERE a.taskId = t.id AND a.timestamp > ?
         )`
    ).all(staleCutoff, staleCutoff) as { id: string }[];

    for (const { id } of timedOut) {
      db.prepare(`UPDATE tasks SET status = 'todo', reviewStatus = NULL, updatedAt = ? WHERE id = ?`).run(now, id);
      db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(id, 'system', 'pre-review-timeout',
          'Pre-review timed out — please reassign to restart review', now);
    }
    if (timedOut.length > 0) {
      console.log(`[clara-review-cron] Moved ${timedOut.length} timed-out pre-review task(s) back to todo`);
    }
  } catch { /* non-critical */ }

  // On startup: re-dispatch tasks stuck in 'in-progress' from a previous server session.
  recoverStuckInProgressTasks();

  const interval = setInterval(runReviewCycle, REVIEW_INTERVAL_MS);
  interval.unref?.();
  g._claraReviewCron = interval;
  console.log('[clara-review-cron] Started — runs every 3 minutes (pre-work + post-work passes)');
}
