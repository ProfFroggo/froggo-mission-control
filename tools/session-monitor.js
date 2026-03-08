#!/usr/bin/env node
// tools/session-monitor.js
// Checks all active agent sessions every 5 minutes.
// Forks any session older than 80 minutes to avoid context limit crashes.
// Run via: pm2 start tools/session-monitor.js --name mission-control-session-monitor

const Database = require('better-sqlite3');
const { execSync } = require('child_process');
const path = require('path');

const DB_PATH = process.env.MC_DB_PATH
  || path.join(process.env.HOME, 'mission-control', 'data', 'mission-control.db');
const MAX_SESSION_AGE_MS = 80 * 60 * 1000; // 80 minutes
const CHECK_INTERVAL_MS  = 5 * 60 * 1000;  // 5 minutes

console.log('[session-monitor] Starting. DB:', DB_PATH);

setInterval(() => {
  try {
    const db = new Database(DB_PATH);
    const now = Date.now();

    // Sessions that have been active recently (lastActivity < 5 min ago)
    // AND are older than 80 minutes from creation
    const stale = db.prepare(`
      SELECT agentId, sessionId, createdAt FROM agent_sessions
      WHERE status = 'active'
        AND (? - lastActivity) < 300000
        AND (? - createdAt) > ?
    `).all(now, now, MAX_SESSION_AGE_MS);

    for (const session of stale) {
      console.log(`[session-monitor] Forking stale session for ${session.agentId}`);
      try {
        execSync(
          `claude --resume ${session.sessionId} --fork-session --agents ${session.agentId}`,
          { timeout: 30000 }
        );
      } catch (e) {
        console.error(`[session-monitor] Fork failed for ${session.agentId}:`, e.message);
      }
    }

    db.close();
  } catch (e) {
    console.error('[session-monitor] Error:', e.message);
  }
}, CHECK_INTERVAL_MS);
