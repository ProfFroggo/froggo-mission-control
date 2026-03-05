#!/usr/bin/env node
// tools/hooks/session-sync.js
// Claude Code Stop hook — exports session context to Obsidian vault, refreshes QMD index.

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT_PATH = process.env.VAULT_PATH || path.join(os.homedir(), 'mission-control', 'memory');
const DB_PATH = process.env.MC_DB_PATH || path.join(os.homedir(), 'mission-control', 'data', 'mission-control.db');
const QMD_BIN = process.env.QMD_BIN || '/opt/homebrew/bin/qmd';

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
  const sessionsDir = path.join(VAULT_PATH, 'sessions');
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
      const eventJson = JSON.stringify({ agent_id: agentId, session_id: sessionId, timestamp: now.toISOString() });
      execSync(`sqlite3 "${DB_PATH}" "INSERT INTO analytics_events (id, event_type, agent_id, metadata, created_at) VALUES ('$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo ${Date.now()})', 'session_sync', '${agentId}', '${eventJson.replace(/'/g, "''")}', '${now.toISOString()}');"`, { timeout: 5000 });
    }
  } catch {
    // DB may not exist yet — not fatal
  }

  process.exit(0);
}
