#!/usr/bin/env node
// tools/hooks/session-sync.js
// Claude Code Stop hook — exports session context to Obsidian vault, refreshes QMD index.

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT_PATH = process.env.VAULT_PATH || path.join(os.homedir(), 'mission-control');
const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'mission-control', 'data', 'mission-control.db');
const QMD_BIN = process.env.QMD_BIN || path.join(os.homedir(), '.npm-global', 'bin', 'qmd');

// Read hook input from stdin
let hookInput = '';
process.stdin.on('data', chunk => { hookInput += chunk; });
process.stdin.on('end', () => {
  try {
    const data = hookInput.trim() ? JSON.parse(hookInput) : {};
    syncSession(data);
  } catch {
    syncSession({});
  }
});

function syncSession(data) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const dateStr = now.toISOString().slice(0, 10);

  // Build session summary
  const agentId = data.agent_id || data.agentId || process.env.CLAUDE_CODE_AGENT_ID || process.env.AGENT_ID || 'unknown';
  const sessionId = data.session_id || data.sessionId || process.env.CLAUDE_CODE_SESSION_ID || '';
  const summary = [
    `# Session Sync — ${timestamp}`,
    '',
    `**Agent**: ${agentId}`,
    `**Date**: ${dateStr}`,
    sessionId ? `**Session ID**: ${sessionId}` : '',
    '',
    '## Context',
    data.summary || data.context || '_No summary provided_',
    '',
  ].filter(line => line !== undefined).join('\n');

  // Write to vault sessions folder
  const sessionsDir = path.join(VAULT_PATH, 'memory', 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }
  const outFile = path.join(sessionsDir, `${timestamp}.md`);
  try {
    fs.writeFileSync(outFile, summary, 'utf8');
  } catch (e) {
    // vault may not exist yet — not fatal
  }

  // Refresh QMD index (non-blocking, non-fatal)
  if (fs.existsSync(QMD_BIN)) {
    spawnSync(QMD_BIN, ['index', VAULT_PATH], { timeout: 30000 });
  }

  // Log analytics event to DB (non-fatal)
  try {
    if (fs.existsSync(DB_PATH)) {
      const Database = require('better-sqlite3');
      const db = new Database(DB_PATH);
      db.prepare(`INSERT INTO analytics_events (event_type, timestamp, metadata) VALUES (?, ?, ?)`)
        .run('session_sync', Date.now(), JSON.stringify({ agent_id: agentId, session_id: sessionId }));
      db.close();
    }
  } catch {
    // DB may not exist yet — not fatal
  }

  process.exit(0);
}
