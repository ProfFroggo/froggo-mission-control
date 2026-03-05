/**
 * Task Dispatcher — spawns a Claude agent process to work a task autonomously.
 * Called automatically when a task is created/assigned with an assignedTo agent.
 */

import { getDb } from './database';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

const CLAUDE_BIN = '/Users/kevin.macarthur/.npm-global/bin/claude';

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
    `1. IMMEDIATELY call mcp__mission-control-db__task_update { "id": "${task.id}", "status": "in-progress" } to claim the task`,
    `2. Write your plan in planningNotes: call mcp__mission-control-db__task_update { "id": "${task.id}", "planningNotes": "<your plan>" }`,
    `3. Break the task into subtasks using mcp__mission-control-db__task_create for each subtask (set parentTaskId="${task.id}")`,
    `4. Log progress regularly: mcp__mission-control-db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "message": "<what you did>" }`,
    `5. Do the actual work. Update progress as you go: mcp__mission-control-db__task_update { "id": "${task.id}", "progress": <0-100> }`,
    `6. When you need human input or are blocked: mcp__mission-control-db__task_update { "id": "${task.id}", "status": "human-review", "lastAgentUpdate": "Blocked: <reason>" }`,
    `7. When complete: mcp__mission-control-db__task_update { "id": "${task.id}", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <summary>" }`,
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

/**
 * Dispatch a task to its assigned agent.
 * Spawns a detached Claude CLI process in the agent's workspace.
 * Returns true if dispatch succeeded, false if skipped (no assignedTo, etc).
 */
export function dispatchTask(taskId: string): boolean {
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

    const message = buildTaskMessage(task);
    const agentCwd = join(homedir(), 'mission-control', 'agents', agentId);
    const cwd = existsSync(agentCwd) ? agentCwd : homedir();

    // Strip Claude session env vars so nested spawn is allowed
    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } =
      process.env as Record<string, string | undefined>;

    const proc = spawn(CLAUDE_BIN, [
      '--print',
      '--model', 'claude-sonnet-4-6',
      '--dangerously-skip-permissions',
      message,
    ], {
      cwd,
      env: cleanEnv as NodeJS.ProcessEnv,
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();

    // Log the dispatch to task_activity
    try {
      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      ).run(taskId, agentId, 'dispatch', `Task dispatched to ${agentId}`, Date.now());
    } catch {
      // Activity log is non-critical
    }

    console.log(`[taskDispatcher] Dispatched task ${taskId} to agent ${agentId} (cwd: ${cwd})`);
    return true;
  } catch (err) {
    console.error('[taskDispatcher] Error:', err);
    return false;
  }
}
