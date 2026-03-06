/**
 * Task Dispatcher — spawns a Claude agent process to work a task autonomously.
 * Called automatically when a task is created/assigned with an assignedTo agent.
 */

import { getDb } from './database';
import { calcCostUsd } from './env';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

const CLAUDE_BIN = '/Users/kevin.macarthur/.npm-global/bin/claude';
const HOME = homedir();

// ── Model resolution ─────────────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  'sonnet': 'claude-sonnet-4-6',
  'opus':   'claude-opus-4-6',
  'haiku':  'claude-haiku-4-5-20251001',
};

function resolveModel(short: string): string {
  return MODEL_MAP[short] ?? (short.startsWith('claude-') ? short : 'claude-sonnet-4-6');
}

// ── Task suffix ───────────────────────────────────────────────────────────────

const TASK_SUFFIX = `\n\n---
You are in autonomous task mode. Work through the assigned task using the MCP tools.
Task management: Use mcp__mission-control_db__task_* tools — NOT built-in TaskCreate/TaskList/TaskUpdate.
Do not ask for clarification — interpret and execute. Log activity frequently.`;

// ── Soul file / system prompt ─────────────────────────────────────────────────

function buildTaskSystemPrompt(agentId: string): string | null {
  const dir = join(HOME, 'mission-control', 'agents', agentId);
  const soulPath = join(dir, 'SOUL.md');
  if (existsSync(soulPath)) {
    const soul = readFileSync(soulPath, 'utf-8').trim();
    return soul + TASK_SUFFIX;
  }
  // Fall back to DB personality
  try {
    const agent = getDb().prepare('SELECT name, role, personality FROM agents WHERE id = ?').get(agentId) as {
      personality?: string; role?: string; name?: string;
    } | undefined;
    if (agent) {
      const parts: string[] = [];
      if (agent.role) parts.push(`You are ${agent.name || agentId}, a ${agent.role}.`);
      if (agent.personality) parts.push(agent.personality);
      parts.push(TASK_SUFFIX.trim());
      return parts.join('\n');
    }
  } catch { /* DB not available */ }
  return null;
}

// ── Session management ────────────────────────────────────────────────────────
// Uses agentId + ':task' as key to avoid colliding with chat sessions.

function loadTaskSession(agentId: string): string | null {
  try {
    const row = getDb().prepare(
      'SELECT sessionId, lastActivity FROM agent_sessions WHERE agentId = ? AND status = ?'
    ).get(agentId + ':task', 'active') as { sessionId: string; lastActivity: number } | undefined;
    if (!row?.sessionId) return null;
    // Expire sessions older than 2 hours (task sessions are shorter-lived than chat)
    if (Date.now() - row.lastActivity > 2 * 60 * 60 * 1000) return null;
    return row.sessionId;
  } catch { return null; }
}

function persistTaskSession(agentId: string, sessionId: string, model: string) {
  try {
    const now = Date.now();
    getDb().prepare(`
      INSERT OR REPLACE INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
      VALUES (?, ?, ?, COALESCE((SELECT createdAt FROM agent_sessions WHERE agentId = ?), ?), ?, 'active')
    `).run(agentId + ':task', sessionId, model, agentId + ':task', now, now);
  } catch { /* non-critical */ }
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildTaskMessage(task: Record<string, unknown>): string {
  const lines: string[] = [
    `You have been assigned a new task. Work on it autonomously now.`,
    ``,
    `**Task ID**: ${task.id}`,
    `**Title**: ${task.title}`,
  ];

  if (task.description) lines.push(`**Description**: ${task.description}`);
  if (task.priority) lines.push(`**Priority**: ${task.priority}`);
  if (task.project) lines.push(`**Project**: ${task.project}`);
  if (task.dueDate) lines.push(`**Due**: ${new Date(task.dueDate as number).toLocaleDateString()}`);

  lines.push(
    ``,
    `## Work steps:`,
    `1. IMMEDIATELY call mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress" } to claim the task`,
    `2. Check for a relevant skill: Read ~/git/mission-control-nextjs/.claude/skills/{skill-name}/SKILL.md if applicable (see CLAUDE.md skills table)`,
    `3. Write your plan in planningNotes: call mcp__mission-control_db__task_update { "id": "${task.id}", "planningNotes": "<your plan>" }`,
    `4. Break the task into subtasks using mcp__mission-control_db__subtask_create for each step (set taskId="${task.id}")`,
    `5. Log progress regularly: mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "message": "<what you did>" }`,
    `6. Do the actual work. Update progress as you go: mcp__mission-control_db__task_update { "id": "${task.id}", "progress": <0-100> }`,
    `7. When you need human input or are blocked: mcp__mission-control_db__task_update { "id": "${task.id}", "status": "human-review", "lastAgentUpdate": "Blocked: <reason>" }`,
    `8. When complete: mcp__mission-control_db__task_update { "id": "${task.id}", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <summary>" }`,
    `   (Clara will review. If she approves it moves to done. If rejected, it returns to you.)`,
    ``,
    `## Status meanings:`,
    `- "in-progress" → you are actively working`,
    `- "human-review" → you need Kevin's input (blocker, approval, clarification)`,
    `- "review" → you finished, waiting for Clara's review`,
    ``,
    `Work autonomously. Do not ask for clarification — interpret and execute. Log activity frequently.`,
  );

  return lines.join('\n');
}

// ── Dispatch debounce ────────────────────────────────────────────────────────
// Prevents rapid-fire dispatches to the same agent within 100ms.
// Uses a simple in-memory last-dispatch timestamp per agent.
type DG = typeof globalThis & { _lastDispatch?: Map<string, number> };
const lastDispatch: Map<string, number> = (globalThis as DG)._lastDispatch
  ?? ((globalThis as DG)._lastDispatch = new Map());
const DEBOUNCE_MS = 100;

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Dispatch a task to its assigned agent.
 * Spawns a detached Claude CLI process with full agent context.
 * Returns true if dispatch succeeded, false if skipped (no assignedTo, etc).
 */
export function dispatchTask(taskId: string): boolean {
  // Warn if Claude binary missing — don't throw, let spawn fail gracefully
  if (!existsSync(CLAUDE_BIN)) {
    console.warn(`[taskDispatcher] WARNING: Claude binary not found at ${CLAUDE_BIN}`);
  }

  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;

    if (!task) {
      console.warn(`[taskDispatcher] Task ${taskId} not found`);
      return false;
    }

    const agentId = task.assignedTo as string | null;
    if (!agentId) {
      return false; // No agent assigned — nothing to dispatch
    }

    // Debounce: skip if we dispatched to this agent within 100ms
    const now = Date.now();
    const last = lastDispatch.get(agentId) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      console.log(`[taskDispatcher] Debounced dispatch to ${agentId} (too rapid)`);
      return false;
    }
    lastDispatch.set(agentId, now);

    // Get per-agent model from DB
    const agentRow = db.prepare('SELECT model FROM agents WHERE id = ?').get(agentId) as { model?: string } | undefined;
    const model = resolveModel(agentRow?.model ?? 'sonnet');

    // Build args — use --resume if session exists, otherwise --system-prompt with soul file
    const existingSession = loadTaskSession(agentId);
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', model,
      '--dangerously-skip-permissions',
    ];

    if (existingSession) {
      args.push('--resume', existingSession);
      // Session already has context — don't add --system-prompt
    } else {
      const systemPrompt = buildTaskSystemPrompt(agentId);
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
    }

    const message = buildTaskMessage(task);

    // Strip Claude session env vars so nested spawn is allowed
    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } =
      process.env as Record<string, string | undefined>;

    // cwd = project root (not agent workspace) so .claude/settings.json MCP config is loaded
    const cwd = process.cwd();

    const proc = spawn(CLAUDE_BIN, args, {
      cwd,
      env: { ...cleanEnv, CLAUDE_AGENT_ID: agentId } as unknown as NodeJS.ProcessEnv,
      detached: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    // Write message to stdin
    proc.stdin.write(message);
    proc.stdin.end();

    // Parse stdout for session_id (from stream-json "result" event)
    let outBuf = '';
    proc.stdout.on('data', (data: Buffer) => {
      outBuf += data.toString();
      const lines = outBuf.split('\n');
      outBuf = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.trim()) as {
            type?: string; session_id?: string;
            input_tokens?: number; output_tokens?: number;
          };
          if (parsed.type === 'result') {
            if (parsed.session_id) {
              persistTaskSession(agentId, parsed.session_id, model);
            }
            // Log token usage
            const inputT  = parsed.input_tokens  ?? 0;
            const outputT = parsed.output_tokens ?? 0;
            if (inputT > 0 || outputT > 0) {
              try {
                const costUsd = calcCostUsd(model, inputT, outputT);
                getDb().prepare(
                  `INSERT INTO token_usage (agentId, taskId, sessionId, model, inputTokens, outputTokens, costUsd, source, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'dispatch', ?)`
                ).run(agentId, taskId, parsed.session_id ?? null, model, inputT, outputT, costUsd, Date.now());
              } catch { /* non-critical */ }
            }
          }
        } catch { /* not JSON, ignore */ }
      }
    });

    // Log exit code and update task status on failure
    proc.on('close', (code) => {
      try {
        const exitMsg = code === 0
          ? `Agent ${agentId} completed task dispatch (exit 0)`
          : `Agent ${agentId} exited with code ${code}`;
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
        ).run(taskId, agentId, 'dispatch_exit', exitMsg, Date.now());

        if (code !== 0) {
          const current = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
          if (current && (current.status === 'todo' || current.status === 'in-progress')) {
            db.prepare(
              `UPDATE tasks SET status = 'blocked', lastAgentUpdate = ? WHERE id = ?`
            ).run(`Dispatch process exited with code ${code}. Check logs.`, taskId);
          }
        }
      } catch { /* non-critical */ }
    });

    // Handle spawn errors (e.g. ENOENT if claude binary not found)
    proc.on('error', (err) => {
      console.error(`[taskDispatcher] Spawn error for task ${taskId}:`, err);
      try {
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
        ).run(taskId, agentId, 'dispatch_error', `Spawn failed: ${err.message}`, Date.now());
        db.prepare(
          `UPDATE tasks SET status = 'blocked', lastAgentUpdate = ? WHERE id = ?`
        ).run(`Could not start agent: ${err.message}`, taskId);
      } catch { /* non-critical */ }
    });

    proc.unref();

    // Log successful dispatch
    try {
      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      ).run(
        taskId,
        agentId,
        'dispatch',
        `Task dispatched to ${agentId} (model: ${model}, ${existingSession ? 'resumed session' : 'new session'})`,
        Date.now()
      );
    } catch { /* non-critical */ }

    console.log(`[taskDispatcher] Dispatched task ${taskId} to agent ${agentId} (model: ${model}, cwd: ${cwd})`);
    return true;
  } catch (err) {
    console.error('[taskDispatcher] Error:', err);
    return false;
  }
}
