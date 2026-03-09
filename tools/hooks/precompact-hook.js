#!/usr/bin/env node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Mission Control PreCompact Hook
 *
 * Fires before Claude auto-compacts a long session context.
 * Re-injects the agent's current task context so continuity is preserved.
 *
 * Output: a string written to stdout that gets prepended to the compacted context.
 */

const http = require('http');
const path = require('path');

// SQLite DB path
const DB_PATH = process.env.DB_PATH ||
  path.join(process.env.HOME || require('os').homedir(), 'mission-control', 'data', 'mission-control.db');

// Lazy DB open — only if we have something to inject
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
      db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    } catch {
      return null;
    }
  }
  return db;
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  // Determine agent ID: try env var first, then session lookup
  let agentId = process.env.CLAUDE_AGENT_ID || null;

  if (!agentId) {
    // Try to extract from stdin session_id
    try {
      const parsed = JSON.parse(input);
      const sessionId = parsed.session_id || parsed.sessionId;
      if (sessionId) {
        const database = getDb();
        if (database) {
          const row = database.prepare(
            "SELECT agentId FROM agent_sessions WHERE sessionId = ?"
          ).get(sessionId);
          if (row?.agentId) {
            agentId = row.agentId.replace(/:task$/, '');
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }

  if (!agentId) {
    // No agent context available — output empty (no injection)
    process.stdout.write('');
    process.exit(0);
  }

  const database = getDb();
  if (!database) {
    process.stdout.write('');
    process.exit(0);
  }

  try {
    // Get agent's in-progress task
    const task = database.prepare(
      "SELECT id, title, description, status, progress, planningNotes FROM tasks WHERE assignedTo = ? AND status IN ('in-progress', 'todo') ORDER BY updatedAt DESC LIMIT 1"
    ).get(agentId);

    if (!task) {
      process.stdout.write('');
      process.exit(0);
    }

    // Get last 5 activity entries
    const activities = database.prepare(
      "SELECT message, timestamp FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC LIMIT 5"
    ).all(task.id);

    // Build re-injection context
    const lines = [
      `## Context Restored After Compaction`,
      ``,
      `**Agent**: ${agentId}`,
      `**Active Task**: [${task.id}] ${task.title}`,
      `**Status**: ${task.status} (${task.progress || 0}% complete)`,
    ];

    if (task.description) {
      lines.push(`**Description**: ${task.description}`);
    }

    if (task.planningNotes) {
      lines.push(`**Your Plan**: ${task.planningNotes}`);
    }

    if (activities.length > 0) {
      lines.push(``, `**Recent Activity** (last ${activities.length} entries):`);
      for (const a of [...activities].reverse()) {
        const ts = new Date(a.timestamp).toISOString().replace('T', ' ').slice(0, 19);
        lines.push(`- [${ts}] ${a.message}`);
      }
    }

    lines.push(
      ``,
      `**Continue where you left off.** Use mcp__mission-control_db__task_* tools to update progress.`,
      `Do not restart — continue the in-progress task above.`
    );

    process.stdout.write(lines.join('\n'));
  } catch {
    process.stdout.write('');
  }
}

main().catch(() => {
  process.stdout.write('');
});
