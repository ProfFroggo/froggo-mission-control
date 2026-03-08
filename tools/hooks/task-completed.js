#!/usr/bin/env node
/**
 * Mission Control TaskCompleted Hook
 *
 * Fires when an Agent Teams task is marked completed.
 * For P0/P1 tasks: triggers Clara review automatically.
 * Always outputs { "decision": "approve" } — observe-only, doesn't block.
 */

const http = require('http');
const path = require('path');

const DB_PATH = process.env.DB_PATH ||
  path.join(process.env.HOME || require('os').homedir(), 'mission-control', 'data', 'mission-control.db');

let db = null;
function getDb() {
  if (!db) {
    try {
      const Database = require(
        path.join(
          path.dirname(path.dirname(path.dirname(__filename))),
          'node_modules', 'better-sqlite3'
        )
      );
      db = new Database(DB_PATH, { fileMustExist: true });
    } catch { return null; }
  }
  return db;
}

async function triggerClaraReview(taskId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ taskId });
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/agents/clara/review',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  try {
    const parsed = JSON.parse(input);
    // TaskCompleted provides task_id or taskId
    const taskId = parsed.task_id || parsed.taskId || parsed.id;
    const agentId = parsed.agent_id || parsed.agentId || process.env.CLAUDE_AGENT_ID;

    if (taskId) {
      const database = getDb();
      if (database) {
        // Log teammate task completion
        if (agentId) {
          try {
            database.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(taskId, agentId, 'teammate_completed', `Teammate ${agentId} completed task`, Date.now());
          } catch { /* non-critical */ }
        }

        // Check if P0 or P1 — auto-trigger Clara review
        const task = database.prepare('SELECT priority, status FROM tasks WHERE id = ?').get(taskId);
        if (task && (task.priority === 'p0' || task.priority === 'p1')) {
          triggerClaraReview(taskId).catch(() => {});
        }
      }
    }
  } catch { /* ignore parse errors */ }

  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
});
