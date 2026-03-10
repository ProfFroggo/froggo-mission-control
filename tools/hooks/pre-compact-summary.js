#!/usr/bin/env node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Mission Control Pre-Compact Summary Hook
 *
 * Fires before Claude auto-compacts a long session context.
 * Writes a compaction log entry to ~/mission-control/data/compaction-log.jsonl
 * so we can track how often agents are compacting and what context is being lost.
 *
 * This hook runs AFTER precompact-hook.js (which injects task context).
 * It outputs nothing to stdout — its job is only to log.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = process.env.HOME || os.homedir();
const DATA_DIR = path.join(HOME, 'mission-control', 'data');
const LOG_FILE = path.join(DATA_DIR, 'compaction-log.jsonl');

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let agentId = process.env.CLAUDE_AGENT_ID || null;
  let sessionId = null;
  let messageCount = null;

  try {
    const parsed = JSON.parse(input);
    sessionId = parsed.session_id || parsed.sessionId || null;
    messageCount = parsed.message_count || parsed.messageCount || null;

    // Try to extract agent from session context
    if (!agentId && parsed.env) {
      agentId = parsed.env.CLAUDE_AGENT_ID || parsed.env.AGENT_ID || null;
    }
  } catch { /* non-JSON stdin is fine */ }

  // Write compaction log entry (non-critical — never block)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      agentId: agentId || 'unknown',
      sessionId: sessionId || null,
      messageCount: messageCount || null,
    });

    fs.appendFileSync(LOG_FILE, entry + '\n', 'utf-8');
  } catch { /* non-critical */ }

  // Output nothing — context injection is handled by precompact-hook.js
  process.stdout.write('');
}

main().catch(() => {
  process.stdout.write('');
});
