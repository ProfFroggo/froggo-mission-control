#!/usr/bin/env node
/**
 * Mission Control TeammateIdle Hook
 *
 * Fires when an Agent Teams teammate goes idle.
 * Checks if the teammate's assigned task is actually complete and logs status.
 * Always outputs { "decision": "approve" } — observe-only, doesn't block.
 */

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

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  try {
    const parsed = JSON.parse(input);
    const agentId = parsed.agent_id || parsed.agentId || process.env.CLAUDE_AGENT_ID;
    const teamId  = parsed.team_id  || parsed.teamId;

    if (agentId) {
      const database = getDb();
      if (database) {
        // Find any in-progress tasks for this agent
        const inProgress = database.prepare(
          "SELECT id, title FROM tasks WHERE assignedTo = ? AND status = 'in-progress' LIMIT 1"
        ).get(agentId);

        if (inProgress) {
          // Log that the teammate went idle with an in-progress task
          try {
            database.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(
              inProgress.id,
              agentId,
              'teammate_idle',
              `Teammate ${agentId} went idle with task still in-progress (team: ${teamId || 'unknown'})`,
              Date.now()
            );
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
