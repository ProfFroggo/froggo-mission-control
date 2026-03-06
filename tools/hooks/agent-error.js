#!/usr/bin/env node
/**
 * Mission Control AgentError Hook
 *
 * Fires when a Claude agent process exits with a non-zero exit code.
 * Logs the error to task_activity and updates task to 'blocked' if still in-progress.
 * Always outputs { "decision": "approve" } — observe-only.
 */

const path = require('path');

const DB_PATH = process.env.DB_PATH ||
  path.join(process.env.HOME || '/Users/kevin.macarthur', 'mission-control', 'data', 'mission-control.db');

let db = null;
function getDb() {
  if (!db) {
    try {
      const Database = require(
        path.join(path.dirname(path.dirname(path.dirname(__filename))), 'node_modules', 'better-sqlite3')
      );
      db = new Database(DB_PATH, { fileMustExist: true });
    } catch { return null; }
  }
  return db;
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  try {
    const parsed = JSON.parse(input);
    const exitCode = parsed.exit_code ?? parsed.exitCode;
    const agentId  = parsed.agent_id  ?? parsed.agentId ?? process.env.CLAUDE_AGENT_ID;
    const errorMsg = parsed.error     ?? parsed.message ?? `Exit code ${exitCode}`;

    if (exitCode !== 0 && agentId) {
      const database = getDb();
      if (database) {
        // Find this agent's active in-progress task
        const task = database.prepare(
          "SELECT id, status FROM tasks WHERE assignedTo = ? AND status = 'in-progress' LIMIT 1"
        ).get(agentId);

        if (task) {
          try {
            database.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(task.id, agentId, 'agent_error', `Agent process error: ${errorMsg}`, Date.now());

            database.prepare(
              `UPDATE tasks SET status = 'blocked', lastAgentUpdate = ? WHERE id = ?`
            ).run(`Agent error: ${errorMsg}`, task.id);
          } catch { /* non-critical */ }
        }
      }
    }
  } catch { /* ignore parse errors */ }

  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
});
