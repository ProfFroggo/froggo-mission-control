#!/usr/bin/env node
/**
 * Froggo Session Sync Hook (Stop)
 *
 * Fires at the end of every Claude Code session.
 * Exports session summary to Obsidian vault, logs to analytics.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'froggo/data/froggo.db');
const VAULT_PATH = process.env.VAULT_PATH || path.join(os.homedir(), 'froggo/memory');

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let sessionData = {};
  try {
    sessionData = JSON.parse(input);
  } catch (e) {
    // No session data — still proceed
  }

  const timestamp = Date.now();
  const date = new Date(timestamp).toISOString().split('T')[0];
  const sessionId = sessionData.sessionId || `session-${timestamp}`;
  const agentId = sessionData.agentId || 'unknown';

  // Write session summary to Obsidian vault
  try {
    const sessionsDir = path.join(VAULT_PATH, 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });

    const sessionFile = path.join(sessionsDir, `${date}-${agentId}-${sessionId.slice(-8)}.md`);
    const content = `# Session: ${agentId} — ${date}

## Metadata
- Agent: ${agentId}
- Session ID: ${sessionId}
- Timestamp: ${new Date(timestamp).toISOString()}

## Summary
${sessionData.summary || 'No summary available'}

## Tool Usage
${JSON.stringify(sessionData.toolUsage || {}, null, 2)}
`;
    fs.writeFileSync(sessionFile, content);
  } catch (e) {
    // Silently ignore filesystem errors
  }

  // Log to analytics
  try {
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    db.prepare(`
      INSERT INTO analytics_events (type, agentId, data, timestamp)
      VALUES ('session_end', ?, ?, ?)
    `).run(agentId, JSON.stringify({ sessionId, summary: sessionData.summary }), timestamp);

    // Update agent session status if tracked
    db.prepare(`
      UPDATE agent_sessions SET status = 'inactive', lastActivity = ?
      WHERE agentId = ? AND status = 'active'
    `).run(timestamp, agentId);
  } catch (e) {
    // Silently ignore DB errors
  }

  process.stdout.write(JSON.stringify({ success: true }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ success: true }));
});
