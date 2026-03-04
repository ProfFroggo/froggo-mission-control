#!/usr/bin/env node
/**
 * Froggo Clara Review Gate Hook (PostToolUse)
 *
 * Fires after mcp__froggo_db__task_update
 * If task moved to 'review' status, logs a note that Clara should review it.
 * Always outputs { "decision": "approve" } so original tool call proceeds.
 */

const path = require('path');
const os = require('os');

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'froggo/data/froggo.db');

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const parsed = JSON.parse(input);
    const toolInput = parsed.tool_input || parsed.toolInput || {};
    const status = toolInput.status;
    const taskId = toolInput.id || toolInput.taskId;

    if (status === 'review' && taskId) {
      // Log analytics event — Clara should review this task
      try {
        const Database = require('better-sqlite3');
        const db = new Database(DB_PATH);
        db.prepare(`
          INSERT INTO analytics_events (type, agentId, data, timestamp)
          VALUES ('clara_review_queued', 'system', ?, ?)
        `).run(JSON.stringify({ taskId, triggeredBy: 'review-gate-hook' }), Date.now());
      } catch (e) {
        // Silently ignore DB errors
      }
    }
  } catch (e) {
    // Silently ignore parse errors
  }

  // Always approve — this hook observes, doesn't block
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
});
