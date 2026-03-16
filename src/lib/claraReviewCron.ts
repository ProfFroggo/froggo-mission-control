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
import { existsSync, readFileSync, mkdirSync, appendFileSync, writeFileSync } from 'fs';
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
    const patternFile = join(HOME, 'mission-control', 'agents', 'clara', 'memory', 'agent-patterns', `${assignedTo}.md`);
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

  let assignedTo = (task.assignedTo as string | undefined) || undefined;

  // Fetch subtask count to include in Clara's review context
  let subtaskCount = 0;
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE taskId = ?')
      .get(task.id as string) as { cnt: number } | undefined;
    subtaskCount = row?.cnt ?? 0;
  } catch { /* non-critical */ }

  let hasAgent         = !!assignedTo;
  const hasPlanningNotes = !!(task.planningNotes as string | null)?.trim();
  const hasDescription   = !!(task.description as string | null)?.trim();
  let hasSubtasks      = subtaskCount >= 1;
  const hasMinSubtasks   = subtaskCount >= 2;

  // Fetch subtask details for Clara's review
  let subtaskDetails = '';
  try {
    const subs = getDb().prepare('SELECT title, completed FROM subtasks WHERE taskId = ? ORDER BY position').all(task.id as string) as { title: string; completed: number }[];
    if (subs.length > 0) {
      subtaskDetails = subs.map(s => `  [${s.completed ? 'x' : ' '}] ${s.title}`).join('\n');
    }
  } catch { /* non-critical */ }

  // Fetch recent activity for context
  let recentActivity = '';
  try {
    const acts = getDb().prepare('SELECT action, substr(message,1,150) as msg FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC LIMIT 5').all(task.id as string) as { action: string; msg: string }[];
    if (acts.length > 0) {
      recentActivity = acts.map(a => `  - [${a.action}] ${a.msg}`).join('\n');
    }
  } catch { /* non-critical */ }

  const message = [
    `## Pre-work Quality Review — Task: ${task.id}`,
    '',
    `**Title:** ${task.title}`,
    task.description ? `**Description:** ${task.description}` : '**Description:** (none)',
    `**Priority:** ${task.priority || 'p2'}`,
    `**Assigned to:** ${assignedTo || 'UNASSIGNED'}`,
    '',
    '**Planning notes:**',
    hasPlanningNotes ? (task.planningNotes as string).slice(0, 800) : '(empty)',
    '',
    `**Subtasks (${subtaskCount}):**`,
    subtaskDetails || '  (none)',
    '',
    recentActivity ? `**Recent activity:**\n${recentActivity}` : null,
    '',
    '---',
    '',
    '## Your Review',
    '',
    'You are Clara, the quality reviewer. Actually THINK about this task before deciding.',
    'Do NOT just check boxes — assess whether this task will succeed.',
    '',
    '### Evaluate these questions:',
    '',
    '1. **Is the right agent assigned?** Does this agent have the skills for this work?',
    '   If a coding task is assigned to hr, or a design task to coder — that\'s wrong.',
    '',
    '2. **Are the planning notes actionable?** Can the agent read them and know exactly',
    '   what to do? Vague notes like "do the thing" are not acceptable.',
    '   Good notes have: concrete steps, expected output location, clear deliverables.',
    '',
    '3. **Are subtasks well-defined?** Each subtask should be a verifiable unit of work.',
    '   A single subtask like "Complete: [task title]" is lazy — break it down.',
    '',
    '4. **Is the scope realistic?** Can this be done in one agent session?',
    '   If it\'s too big, recommend breaking into multiple tasks.',
    '',
    '5. **Is anything missing?** Output paths? Dependencies? Context the agent needs?',
    '',
    '### Your decision:',
    '',
    '**APPROVE** — task is well-defined, agent is right, plan is clear:',
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress", "reviewStatus": "pre-approved", "reviewNotes": "<what convinced you — be specific>" }`,
    '',
    '**FIX AND APPROVE** — minor issues you can fix yourself, then approve:',
    '  Use task_update, subtask_create, or subtask_update to fix the issues,',
    '  then approve with a note about what you fixed.',
    '',
    '**REJECT** — fundamental problems that need human attention:',
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "todo", "reviewStatus": "pre-rejected", "reviewNotes": "<specific problems and how to fix them>" }`,
    '',
    'Write specific, actionable reviewNotes. "All gates passed" is NOT acceptable.',
    'Say WHAT you reviewed and WHY you approved or rejected.',
  ].filter(Boolean).join('\n');

  // NOTE: claraReviewCount is incremented AFTER the review completes (not before)
  // to prevent false escalations when the subprocess fails/times out silently.

  // Check for human-review escalation BEFORE spawning Clara
  try {
    const reviewCountRow = getDb()
      .prepare('SELECT claraReviewCount FROM tasks WHERE id = ?')
      .get(task.id as string) as { claraReviewCount: number } | undefined;
    const reviewCount = reviewCountRow?.claraReviewCount ?? 0;
    if (reviewCount >= 5) {
      const now = Date.now();
      console.warn(`[clara-review-cron] Task ${task.id} has been reviewed ${reviewCount} times — escalating to human-review`);
      getDb()
        .prepare("UPDATE tasks SET status = 'human-review', updatedAt = ? WHERE id = ?")
        .run(now, task.id);
      getDb()
        .prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(task.id, 'clara', 'human-review-escalation',
          `Task has been reviewed by Clara ${reviewCount} times and is still not progressing — needs human attention.`,
          now);
      inPreReview.delete(task.id as string);
      return;
    }
  } catch { /* non-critical */ }

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

  const claraDisallowed = loadDisallowedTools('clara');
  const proc = spawnClaude([
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', 'claude-haiku-4-5-20251001',
    '--dangerously-skip-permissions',
    '--allowedTools', TIER_TOOLS['worker'].join(','),
    ...(claraDisallowed.length > 0 ? ['--disallowedTools', claraDisallowed.join(',')] : []),
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
  let stderrBuf = '';
  proc.stderr!.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });

  const reviewTimeout = setTimeout(() => {
    try { proc.kill(); } catch { /* already exited */ }
  }, 3 * 60_000);

  proc.on('close', (code: number | null) => {
    clearTimeout(reviewTimeout);
    inPreReview.delete(task.id as string);
    if (code && code !== 0) {
      console.error(`[clara-review-cron] Pre-review process exited ${code} for ${task.id}: ${stderrBuf.slice(0, 300)}`);
      try {
        getDb().prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)')
          .run(task.id, 'clara', 'clara-process-exit', `Pre-review exited code ${code}: ${stderrBuf.slice(0, 200)}`, Date.now());
      } catch { /* activity logging */ }
    }
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
        const current = db.prepare('SELECT status, assignedTo, reviewStatus, reviewNotes FROM tasks WHERE id = ?')
          .get(task.id as string) as { status: string; assignedTo: string | null; reviewStatus: string | null; reviewNotes: string | null } | undefined;

        if (current?.status === 'in-progress' && current?.assignedTo) {
          // Clara approved — dispatch the agent now
          const agentName = current.assignedTo;
          const approvalMsg = `Pre-review passed: agent assigned (${agentName}), planning notes present, ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''} defined. Dispatching to ${agentName}.`;
          console.log(`[clara-review-cron] Pre-review approved task ${task.id} — dispatching to ${agentName}`);
          db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
            .run(task.id, 'clara', 'pre-review-approved', approvalMsg, Date.now());
          // Increment count only on successful review (not on silent failures)
          db.prepare('UPDATE tasks SET claraReviewCount = COALESCE(claraReviewCount, 0) + 1 WHERE id = ?').run(task.id);
          dispatchTask(task.id as string);
        } else if (current?.status === 'todo') {
          // Clara rejected — increment count, set lastClaraReviewAt, log reason
          const now = Date.now();
          db.prepare('UPDATE tasks SET claraReviewCount = COALESCE(claraReviewCount, 0) + 1, lastClaraReviewAt = ?, updatedAt = ? WHERE id = ?').run(now, now, task.id);
          console.log(`[clara-review-cron] Pre-review rejected task ${task.id} — returned to todo`);

          let rejReason = (current.reviewNotes || '').trim();
          if (!rejReason || rejReason === 'Rejected') {
            const failedGates: string[] = [];
            if (!hasAgent) failedGates.push('no agent assigned (assignedTo is empty)');
            if (!hasPlanningNotes) failedGates.push('planningNotes is empty or missing');
            if (!hasSubtasks) failedGates.push('no subtasks created yet');
            rejReason = failedGates.length > 0
              ? `Gate failures: ${failedGates.join('; ')}`
              : 'Review criteria not met';
          }

          db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
            .run(task.id, 'clara', 'pre-review-rejected', `Pre-review failed: ${rejReason}. Task returned to todo.`, now);

          // ── Re-dispatch agent to fix planning ──
          // The agent needs to address Clara's feedback and resubmit with better planning.
          const planFixAgent = current.assignedTo || (task.assignedTo as string);
          if (planFixAgent) {
            console.log(`[clara-review-cron] Re-dispatching ${planFixAgent} to fix planning for ${task.id}`);
            db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
              .run(task.id, 'system', 'planning-fix-dispatch',
                `Re-dispatching ${planFixAgent} to fix task planning based on Clara's feedback`, now);
            // Delay so DB writes settle
            setTimeout(() => {
              try {
                const check = getDb().prepare('SELECT status, reviewStatus FROM tasks WHERE id = ?')
                  .get(task.id as string) as { status: string; reviewStatus: string | null } | undefined;
                if (check?.status === 'todo') {
                  dispatchTask(task.id as string);
                }
              } catch { /* non-critical */ }
            }, 3000);
          }
        } else {
          // Clara's subprocess didn't make a decision — DON'T increment count
          // Task stays in internal-review, will be retried next cycle
          console.warn(`[clara-review-cron] Clara subprocess produced no decision for ${task.id} (status=${current?.status}) — will retry next cycle`);
        }
      } catch { /* non-critical */ }
    }, 2000);
  });

  proc.on('error', (err: Error) => {
    clearTimeout(reviewTimeout);
    inPreReview.delete(task.id as string);
    resetPreReviewStatus(task.id);
    console.error(`[clara-review-cron] Spawn error for pre-review task ${task.id}:`, err.message);
    try {
      getDb().prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(task.id, 'clara', 'clara-spawn-error', `Pre-review spawn failed: ${err.message}`, Date.now());
    } catch { /* truly non-critical — activity logging */ }
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

  // NOTE: claraReviewCount is incremented AFTER review completes (not before)
  // to prevent false escalations when subprocess fails silently.

  try {
    const reviewCountRow = getDb()
      .prepare('SELECT claraReviewCount FROM tasks WHERE id = ?')
      .get(task.id as string) as { claraReviewCount: number } | undefined;
    const reviewCount = reviewCountRow?.claraReviewCount ?? 0;
    if (reviewCount >= 5) {
      const now = Date.now();
      console.warn(`[clara-review-cron] Task ${task.id} has been reviewed ${reviewCount} times — escalating to human-review`);
      getDb()
        .prepare("UPDATE tasks SET status = 'human-review', updatedAt = ? WHERE id = ?")
        .run(now, task.id);
      getDb()
        .prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(task.id, 'clara', 'human-review-escalation',
          `Task has been reviewed by Clara ${reviewCount} times and is still not progressing — needs human attention.`,
          now);
      inReview.delete(task.id as string);
      return;
    }
  } catch { /* non-critical */ }

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

  const claraDisallowed = loadDisallowedTools('clara');
  const proc = spawnClaude([
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', 'claude-haiku-4-5-20251001',
    '--dangerously-skip-permissions',
    '--allowedTools', TIER_TOOLS['worker'].join(','),
    ...(claraDisallowed.length > 0 ? ['--disallowedTools', claraDisallowed.join(',')] : []),
    '--system-prompt', buildClaraSystemPrompt(assignedTo),
  ], {
    cwd: process.cwd(),
    env: cleanEnv as NodeJS.ProcessEnv,
    stdio: 'pipe',
  });

  // Wrap stdin write in try-catch so inReview is always cleaned up on failure
  try {
    proc.stdin!.write(message);
    proc.stdin!.end();
  } catch (e) {
    inReview.delete(task.id as string);
    resetReviewStatus(task.id);
    try { proc.kill(); } catch { /* already exited */ }
    console.error('[clara-review-cron] stdin write failed for task', task.id, e);
    return;
  }
  proc.stdout!.resume();
  let stderrBuf = '';
  proc.stderr!.on('data', (chunk: Buffer) => { stderrBuf += chunk.toString(); });

  // Kill Clara's process after 3 minutes — prevents zombie reviews
  const reviewTimeout = setTimeout(() => {
    try { proc.kill(); } catch { /* already exited */ }
  }, 3 * 60_000);

  proc.on('close', (code: number | null) => {
    clearTimeout(reviewTimeout);
    inReview.delete(task.id as string);
    if (code && code !== 0) {
      console.error(`[clara-review-cron] Post-review process exited ${code} for ${task.id}: ${stderrBuf.slice(0, 300)}`);
      try {
        getDb().prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)')
          .run(task.id, 'clara', 'clara-process-exit', `Post-review exited code ${code}: ${stderrBuf.slice(0, 200)}`, Date.now());
      } catch { /* activity logging */ }
    }
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
          // Increment review count only on actual decisions (not silent failures)
          try { getDb().prepare('UPDATE tasks SET claraReviewCount = COALESCE(claraReviewCount, 0) + 1 WHERE id = ?').run(task.id); } catch { /* */ }
          const db2 = getDb();
          const notes = (reviewed.reviewNotes || '').slice(0, 500);
          const now2 = Date.now();

          // Write outcome to task_activity so it shows in the task detail activity tab
          if (reviewed.reviewStatus === 'rejected') {
            // Set lastClaraReviewAt on rejection so retry cooldown can be enforced
            try {
              db2.prepare('UPDATE tasks SET lastClaraReviewAt = ?, updatedAt = ? WHERE id = ?').run(now2, now2, task.id);
            } catch { /* non-critical */ }

            const rejMsg = notes
              ? `Post-review failed: ${notes}. Task returned to in-progress for rework.`
              : 'Post-review failed: work appears incomplete — subtasks may be unfinished, output files missing, or the deliverable does not match the description. Task returned to in-progress for rework.';
            db2.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
              .run(task.id, 'clara', 'review-rejected', rejMsg, now2);

            // ── Re-dispatch agent with Clara's feedback ──
            // The task is back in in-progress — re-spawn the agent so it can fix the issue
            const agentToRedispatch = assignedTo || (task.assignedTo as string);
            if (agentToRedispatch) {
              console.log(`[clara-review-cron] Re-dispatching ${agentToRedispatch} for ${task.id} with Clara's feedback`);
              db2.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
                .run(task.id, 'system', 'redispatch-after-rejection',
                  `Re-dispatching ${agentToRedispatch} to implement Clara's feedback: ${notes.slice(0, 200)}`,
                  now2);
              // Delay re-dispatch to let DB writes settle
              setTimeout(() => {
                try {
                  const check = getDb().prepare('SELECT status FROM tasks WHERE id = ?')
                    .get(task.id as string) as { status: string } | undefined;
                  if (check?.status === 'in-progress') {
                    dispatchTask(task.id as string);
                  }
                } catch { /* non-critical */ }
              }, 3000);
            }
          } else {
            db2.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
              .run(task.id, 'clara', 'review-approved', `Post-review passed: ${notes || 'Work complete and verified.'}`, now2);
          }

          // Also log to Clara's pattern memory file for future reviews
          const patternDir = join(HOME, 'mission-control', 'agents', 'clara', 'memory', 'agent-patterns');
          mkdirSync(patternDir, { recursive: true });

          const agentId = assignedTo || 'unknown';
          const patternFile = join(patternDir, `${agentId}.md`);
          const date = new Date().toISOString().slice(0, 10);
          const line = `${date} | ${task.title} | ${reviewed.reviewStatus} | ${notes.slice(0, 200)}\n`;
          appendFileSync(patternFile, line, 'utf-8');
          trackEvent('memory.written', { agentId: 'clara' });

          // ── Session checkpoint: save task learnings to agent memory ──
          if (reviewed.reviewStatus === 'approved' && agentId !== 'unknown') {
            try {
              const memDir = join(HOME, 'mission-control', 'agents', agentId, 'memory');
              mkdirSync(memDir, { recursive: true });

              // Gather task context for checkpoint
              const taskRow = getDb().prepare('SELECT title, description, lastAgentUpdate FROM tasks WHERE id = ?')
                .get(task.id as string) as { title: string; description: string | null; lastAgentUpdate: string | null } | undefined;
              const activities = getDb().prepare(
                `SELECT action, substr(message,1,120) as msg FROM task_activity WHERE taskId = ? AND action NOT IN ('status_change','update') ORDER BY timestamp DESC LIMIT 5`
              ).all(task.id as string) as { action: string; msg: string }[];
              const attachments = getDb().prepare(
                `SELECT fileName FROM task_attachments WHERE taskId = ? LIMIT 5`
              ).all(task.id as string) as { fileName: string }[];

              const slug = (taskRow?.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
              const checkpointPath = join(memDir, `${date}-${slug}.md`);

              const activityLines = activities.map(a => `- [${a.action}] ${a.msg}`).join('\n');
              const fileLines = attachments.map(a => `- ${a.fileName}`).join('\n');

              const checkpoint = [
                `---`,
                `date: ${date}`,
                `task: ${task.id}`,
                `agent: ${agentId}`,
                `outcome: approved`,
                `---`,
                ``,
                `# ${taskRow?.title || 'Task'}`,
                ``,
                taskRow?.lastAgentUpdate ? `**Result:** ${taskRow.lastAgentUpdate.slice(0, 200)}` : '',
                notes ? `**Clara's review:** ${notes.slice(0, 150)}` : '',
                activityLines ? `\n**Key steps:**\n${activityLines}` : '',
                fileLines ? `\n**Files created:**\n${fileLines}` : '',
              ].filter(Boolean).join('\n').slice(0, 800);

              writeFileSync(checkpointPath, checkpoint, 'utf-8');
              trackEvent('memory.checkpoint', { agentId, taskId: task.id as string });
            } catch { /* non-critical — never block review flow */ }
          }
        }
      } catch { /* non-critical */ }
    }, 2000); // Brief delay so DB write from MCP has settled
  });

  proc.on('error', (err: Error) => {
    clearTimeout(reviewTimeout);
    inReview.delete(task.id as string);
    resetReviewStatus(task.id);
    console.error(`[clara-review-cron] Spawn error for post-review task ${task.id}:`, err.message);
    try {
      getDb().prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(task.id, 'clara', 'clara-spawn-error', `Post-review spawn failed: ${err.message}`, Date.now());
    } catch { /* truly non-critical — activity logging */ }
  });
}

export function runReviewCycle(): { queued: number } {
  let queued = 0;
  let advanced = 0;
  let recovered = 0;
  let reset = 0;

  // ── Auto-advance: todo tasks with agent assigned → internal-review ───────────
  // Skip pre-rejected tasks — agent is fixing the planning, don't auto-advance until they resubmit
  try {
    const todoWithAgent = getDb()
      .prepare(`SELECT id FROM tasks WHERE status = 'todo' AND assignedTo IS NOT NULL AND assignedTo <> ''
                AND (reviewStatus IS NULL OR reviewStatus NOT IN ('pre-rejected'))
                AND (reviewNotes IS NULL OR reviewNotes = '')`)
      .all() as { id: string }[];
    if (todoWithAgent.length > 0) {
      const now = Date.now();
      for (const { id } of todoWithAgent) {
        // Check dependencies — don't advance if blocking tasks aren't done
        const blockers = getDb().prepare(
          `SELECT d.dependsOnId, t.status FROM task_dependencies d
           JOIN tasks t ON t.id = d.dependsOnId
           WHERE d.taskId = ? AND t.status != 'done'`
        ).all(id) as { dependsOnId: string; status: string }[];
        if (blockers.length > 0) {
          // Still blocked — skip this task
          continue;
        }
        getDb().prepare(`UPDATE tasks SET status = 'internal-review', updatedAt = ? WHERE id = ?`).run(now, id);
      }
      advanced = todoWithAgent.length;
      console.log(`[clara-review-cron] Auto-advanced ${todoWithAgent.length} todo task(s) to internal-review`);
    }
  } catch { /* non-critical */ }

  // ── Pre-work pass: tasks in internal-review waiting for Clara's gate ─────────
  try {
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

  // ── Stuck in-progress recovery: re-dispatch tasks with no recent activity ────
  try {
    const thirtyMinAgo = Date.now() - 30 * 60_000;
    const tenMinAgo = Date.now() - 10 * 60_000;
    const stuckTasks = getDb()
      .prepare(`SELECT t.id, t.title, t.assignedTo, t.lastClaraReviewAt FROM tasks t
                WHERE t.status = 'in-progress'
                  AND t.updatedAt < ?
                  AND t.id NOT IN (
                    SELECT DISTINCT taskId FROM task_activity WHERE timestamp > ?
                  )`)
      .all(thirtyMinAgo, thirtyMinAgo) as { id: string; title: string; assignedTo: string | null; lastClaraReviewAt: number | null }[];

    for (const stuck of stuckTasks) {
      // Skip if Clara just rejected (re-dispatch from rejection handler will handle it)
      if (stuck.lastClaraReviewAt && stuck.lastClaraReviewAt > tenMinAgo) continue;
      // Skip if no agent assigned
      if (!stuck.assignedTo) continue;

      console.log(`[clara-review-cron] Recovering stuck in-progress task ${stuck.id} — re-dispatching to ${stuck.assignedTo}`);
      const now = Date.now();
      getDb().prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
        .run(stuck.id, 'system', 'stuck-recovery',
          `Task stuck in-progress >30min with no activity. Re-dispatching to ${stuck.assignedTo}.`,
          now);
      getDb().prepare('UPDATE tasks SET updatedAt = ? WHERE id = ?').run(now, stuck.id);
      dispatchTask(stuck.id);
    }
    if (stuckTasks.length > 0) {
      recovered = stuckTasks.filter(s => s.assignedTo).length;
    console.log(`[clara-review-cron] Recovered ${stuckTasks.length} stuck in-progress task(s)`);
    }
  } catch { /* non-critical */ }

  // ── Stuck in-progress escalation: 4h+ with 3+ re-dispatches → human-review ─
  try {
    const fourHoursAgo = Date.now() - 4 * 60 * 60_000;
    const longStuck = getDb()
      .prepare(`SELECT t.id, t.title, t.assignedTo FROM tasks t
                WHERE t.status = 'in-progress'
                  AND t.updatedAt < ?
                  AND t.assignedTo IS NOT NULL`)
      .all(fourHoursAgo) as { id: string; title: string; assignedTo: string }[];

    for (const stuck of longStuck) {
      // Check how many stuck-recovery re-dispatches this task has had
      const recoveryCount = (getDb().prepare(
        `SELECT COUNT(*) as cnt FROM task_activity WHERE taskId = ? AND action IN ('stuck-recovery', 'auto_redispatch')`
      ).get(stuck.id) as { cnt: number } | undefined)?.cnt ?? 0;

      if (recoveryCount >= 3) {
        const now = Date.now();
        console.warn(`[clara-review-cron] Task ${stuck.id} stuck >4h with ${recoveryCount} re-dispatches — escalating to human-review`);
        getDb().prepare(`UPDATE tasks SET status = 'human-review', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`)
          .run(`Agent unable to complete after ${recoveryCount} re-dispatch attempts over 4+ hours. Needs human attention.`, now, stuck.id);
        getDb().prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
          .run(stuck.id, 'system', 'stuck-escalation',
            `Escalated to human-review: stuck in-progress >4h with ${recoveryCount} re-dispatch attempts`, now);
        // Notify in mission-control chat room
        try {
          getDb().prepare(`INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)`)
            .run('mission-control', 'system',
              `Task "${stuck.title}" (assigned to ${stuck.assignedTo}) has been stuck for 4+ hours after ${recoveryCount} re-dispatch attempts. Moved to human-review.`,
              now);
        } catch { /* non-critical */ }
      }
    }
  } catch { /* non-critical */ }

  // ── Stale human-review alert: tasks in human-review >24h → chat reminder ────
  try {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60_000;
    const staleHumanReview = getDb()
      .prepare(`SELECT t.id, t.title, t.assignedTo FROM tasks t
                WHERE t.status = 'human-review' AND t.updatedAt < ?`)
      .all(twentyFourHoursAgo) as { id: string; title: string; assignedTo: string | null }[];

    for (const stale of staleHumanReview) {
      // Only alert once per 24h — check if we already sent a reminder recently
      const recentAlert = (getDb().prepare(
        `SELECT COUNT(*) as cnt FROM task_activity WHERE taskId = ? AND action = 'stale-human-review-alert' AND timestamp > ?`
      ).get(stale.id, twentyFourHoursAgo) as { cnt: number } | undefined)?.cnt ?? 0;

      if (recentAlert === 0) {
        const now = Date.now();
        getDb().prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
          .run(stale.id, 'system', 'stale-human-review-alert',
            `Task has been in human-review for >24h — needs attention`, now);
        try {
          getDb().prepare(`INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)`)
            .run('mission-control', 'system',
              `Reminder: Task "${stale.title}" has been waiting in human-review for over 24 hours. Please review.`,
              now);
        } catch { /* non-critical */ }
      }
    }
  } catch { /* non-critical */ }

  // ── Orphaned review status cleanup: reset stale reviewStatus ────────────────
  try {
    const tenMinAgo = Date.now() - 10 * 60_000;
    // Reset stale pre-review (Clara subprocess timed out)
    const stalePreReview = getDb()
      .prepare(`UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE status = 'internal-review' AND reviewStatus = 'pre-review' AND updatedAt < ?`)
      .run(Date.now(), tenMinAgo);
    if (stalePreReview.changes > 0) {
      reset += stalePreReview.changes;
      console.log(`[clara-review-cron] Reset ${stalePreReview.changes} stale pre-review status(es)`);
    }

    // Reset stale in-review (Clara subprocess timed out)
    const staleInReview = getDb()
      .prepare(`UPDATE tasks SET reviewStatus = NULL, updatedAt = ? WHERE status = 'review' AND reviewStatus = 'in-review' AND updatedAt < ?`)
      .run(Date.now(), tenMinAgo);
    if (staleInReview.changes > 0) {
      reset += staleInReview.changes;
      console.log(`[clara-review-cron] Reset ${staleInReview.changes} stale in-review status(es)`);
    }
  } catch { /* non-critical */ }

  // ── Memory housekeeping: archive old memory files (once per hour) ─────────
  try {
    const g2 = globalThis as Record<string, unknown>;
    const lastHousekeeping = (g2._lastMemoryHousekeeping as number) || 0;
    if (Date.now() - lastHousekeeping > 60 * 60_000) {
      g2._lastMemoryHousekeeping = Date.now();
      const agentsBaseDir = join(HOME, 'mission-control', 'agents');
      if (existsSync(agentsBaseDir)) {
        const { readdirSync, renameSync, statSync } = require('fs') as typeof import('fs');
        const agentDirs = readdirSync(agentsBaseDir).filter((d: string) => !d.startsWith('.') && d !== '_archive');
        for (const agentId of agentDirs) {
          const memDir = join(agentsBaseDir, agentId as string, 'memory');
          if (!existsSync(memDir)) continue;
          const files = readdirSync(memDir)
            .filter((f: string) => f.endsWith('.md') && f !== 'README.md')
            .map((f: string) => ({ name: f, mtime: statSync(join(memDir, f)).mtimeMs }))
            .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);
          if (files.length > 30) {
            const archiveDir = join(memDir, 'archive');
            mkdirSync(archiveDir, { recursive: true });
            const toArchive = files.slice(20); // Keep 20 most recent
            for (const f of toArchive) {
              renameSync(join(memDir, f.name), join(archiveDir, f.name));
            }
            console.log(`[clara-review-cron] Archived ${toArchive.length} old memory files for agent ${agentId}`);
          }
        }
      }
    }
  } catch { /* non-critical */ }

  // ── Cycle summary ──────────────────────────────────────────────────────────
  if (queued > 0 || advanced > 0 || recovered > 0 || reset > 0) {
    console.log(`[clara-review-cron] Cycle complete: ${queued} queued, ${advanced} advanced, ${recovered} recovered, ${reset} reset`);
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
