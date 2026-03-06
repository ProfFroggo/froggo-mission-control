#!/usr/bin/env node
/**
 * Mission Control Cron Daemon
 *
 * Reads ~/mission-control/data/schedule.json every minute.
 * Executes jobs via Claude CLI when they are due.
 *
 * Job schema (API format):
 *   {
 *     id: string,
 *     name: string,
 *     enabled: boolean,
 *     deleteAfterRun: boolean,
 *     schedule: {
 *       kind: 'once' | 'interval' | 'cron',
 *       atMs?: number,        // once
 *       everyMs?: number,     // interval
 *       expr?: string,        // cron (5-field: min hour dom month dow)
 *     },
 *     sessionTarget: string,  // agent id | 'isolated' | 'main'
 *     payload: { message: string, model?: string },
 *     state: { lastRunAtMs?: number, nextRunAtMs?: number, runningAtMs?: number },
 *   }
 *
 * Legacy format also supported:
 *   { id, command, runAt: timestamp, status: 'pending'|'scheduled'|'executed' }
 *
 * Start: node tools/cron-daemon.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

const HOME = os.homedir();
const SCHEDULE_PATH = process.env.SCHEDULE_PATH || path.join(HOME, 'mission-control/data/schedule.json');
const LOG_PATH = process.env.LOG_PATH || path.join(HOME, 'mission-control/logs/cron.log');
const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(HOME, '.npm-global/bin/claude');
const DB_PATH = process.env.DB_PATH || path.join(HOME, 'mission-control/data/mission-control.db');
const CHECK_INTERVAL = 60_000;        // 1 minute — schedule job check
const STUCK_CHECK_INTERVAL = 30 * 60_000; // 30 minutes — stuck task sweep
const STUCK_THRESHOLD_MS = 4 * 60 * 60_000; // 4 hours in-progress = stuck

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line);
  } catch {}
}

// ── Schedule I/O ─────────────────────────────────────────────────────────────

function readSchedule() {
  try {
    if (!fs.existsSync(SCHEDULE_PATH)) return [];
    const raw = fs.readFileSync(SCHEDULE_PATH, 'utf8').trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    log(`Error reading schedule: ${e.message}`);
    return [];
  }
}

function writeSchedule(jobs) {
  try {
    fs.mkdirSync(path.dirname(SCHEDULE_PATH), { recursive: true });
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(jobs, null, 2));
  } catch (e) {
    log(`Error writing schedule: ${e.message}`);
  }
}

// ── Cron expression parser ────────────────────────────────────────────────────
// Supports: * */N N N,M,P  (5-field: minute hour dom month dow)

function fieldMatches(field, value, min, max) {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return step > 0 && (value - min) % step === 0;
  }
  if (field.includes(',')) {
    return field.split(',').some(f => fieldMatches(f.trim(), value, min, max));
  }
  if (field.includes('-')) {
    const [lo, hi] = field.split('-').map(Number);
    return value >= lo && value <= hi;
  }
  return parseInt(field, 10) === value;
}

function cronMatches(expr, date) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minF, hourF, domF, monF, dowF] = parts;
  const d = date || new Date();
  return (
    fieldMatches(minF,  d.getMinutes(),    0, 59) &&
    fieldMatches(hourF, d.getHours(),      0, 23) &&
    fieldMatches(domF,  d.getDate(),       1, 31) &&
    fieldMatches(monF,  d.getMonth() + 1,  1, 12) &&
    fieldMatches(dowF,  d.getDay(),        0, 6)
  );
}

// ── Job execution ─────────────────────────────────────────────────────────────

function runApiJob(job) {
  const payload = job.payload || {};
  const message = payload.message || 'Check your tasks and report status.';
  const model = payload.model || 'claude-haiku-4-5-20251001';
  const sessionTarget = job.sessionTarget || 'isolated';

  const isGeneric = sessionTarget === 'isolated' || sessionTarget === 'main';
  const agentCwd = isGeneric
    ? HOME
    : path.join(HOME, 'mission-control', 'agents', sessionTarget);

  const cwd = fs.existsSync(agentCwd) ? agentCwd : HOME;

  log(`Running API job ${job.id} (${job.name}): model=${model} cwd=${cwd}`);

  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;

  const proc = spawn(
    CLAUDE_BIN,
    ['--print', '--model', model, '--dangerously-skip-permissions', message],
    { cwd, env: cleanEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  proc.stdout.on('data', d => log(`[${job.id}] ${d.toString().trim()}`));
  proc.stderr.on('data', d => log(`[${job.id}] ERR: ${d.toString().trim()}`));
  proc.on('close', code => log(`[${job.id}] exited ${code}`));
  proc.unref();
}

function runLegacyJob(job) {
  log(`Running legacy job ${job.id}: ${job.command}`);
  const proc = spawn('bash', ['-c', job.command], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.join(HOME, 'git/mission-control-nextjs'),
  });
  proc.stdout.on('data', d => log(`[${job.id}] ${d.toString().trim()}`));
  proc.stderr.on('data', d => log(`[${job.id}] ERR: ${d.toString().trim()}`));
  proc.on('close', code => log(`[${job.id}] exited ${code}`));
  proc.unref();
}

// ── Scheduling logic ──────────────────────────────────────────────────────────

function isDue(job, now) {
  const s = job.schedule || {};
  const state = job.state || {};

  if (s.kind === 'once') {
    return typeof s.atMs === 'number' && s.atMs <= now && !state.lastRunAtMs;
  }

  if (s.kind === 'interval') {
    const every = s.everyMs;
    if (!every || every <= 0) return false;
    const last = state.lastRunAtMs || 0;
    return now - last >= every;
  }

  if (s.kind === 'cron') {
    if (!s.expr) return false;
    // Only run once per minute window
    const last = state.lastRunAtMs || 0;
    const minuteStart = Math.floor(now / 60_000) * 60_000;
    if (last >= minuteStart) return false; // already ran this minute
    return cronMatches(s.expr, new Date(now));
  }

  return false;
}

function computeNextRun(job, now) {
  const s = job.schedule || {};
  if (s.kind === 'once') return null;
  if (s.kind === 'interval') {
    return now + (s.everyMs || 0);
  }
  if (s.kind === 'cron') {
    // Compute approximate next run (next minute boundary that matches)
    for (let i = 1; i <= 60 * 24; i++) {
      const candidate = new Date(now + i * 60_000);
      if (cronMatches(s.expr, candidate)) {
        return candidate.getTime();
      }
    }
  }
  return null;
}

// ── Main check loop ───────────────────────────────────────────────────────────

function checkJobs() {
  const jobs = readSchedule();
  const now = Date.now();
  let updated = false;

  const result = jobs.map(job => {
    // Legacy format
    if (job.command && !job.schedule) {
      if ((job.status === 'pending' || job.status === 'scheduled') && job.runAt && job.runAt <= now) {
        runLegacyJob(job);
        return { ...job, status: 'executed', executedAt: now };
      }
      return job;
    }

    // API format
    if (!job.enabled) return job;

    if (isDue(job, now)) {
      runApiJob(job);
      updated = true;
      const nextRunAtMs = computeNextRun(job, now);
      const newState = { ...job.state, lastRunAtMs: now, nextRunAtMs };

      if (job.deleteAfterRun && job.schedule?.kind === 'once') {
        return null; // will be filtered out
      }
      return { ...job, state: newState };
    }

    return job;
  }).filter(Boolean);

  // Check if anything changed
  const legacyUpdated = result.some((j, i) => j !== jobs[i]);
  if (updated || legacyUpdated) writeSchedule(result);
}

// ── Stuck task detection ──────────────────────────────────────────────────────

let _db = null;
function getDb() {
  if (_db) return _db;
  try {
    const Database = require(path.join(path.dirname(__filename), '..', 'node_modules', 'better-sqlite3'));
    _db = new Database(DB_PATH, { fileMustExist: true });
    return _db;
  } catch { return null; }
}

function postToRoom(roomId, content) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ agentId: 'mission-control', content, role: 'system' });
    const req = http.request({
      host: '127.0.0.1', port: 3000,
      path: `/api/chat-rooms/${roomId}/messages`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function checkStuckTasks() {
  const database = getDb();
  if (!database) return;

  try {
    const cutoff = Date.now() - STUCK_THRESHOLD_MS;
    const stuck = database.prepare(
      `SELECT id, title, assignedTo, updatedAt FROM tasks
       WHERE status = 'in-progress' AND updatedAt < ?
       ORDER BY updatedAt ASC`
    ).all(cutoff);

    if (stuck.length === 0) return;

    const lines = [`⚠️ **Stuck Task Alert** — ${stuck.length} task(s) in-progress > 4 hours:`];
    for (const t of stuck) {
      const hrs = Math.floor((Date.now() - t.updatedAt) / 3_600_000);
      lines.push(`- [${t.id}] **${t.title}** — assigned to ${t.assignedTo || 'unassigned'} (${hrs}h ago)`);
    }

    log(`Stuck tasks: ${stuck.length} found`);
    await postToRoom('general', lines.join('\n'));

    // Log alert to task_activity for each stuck task
    for (const t of stuck) {
      try {
        database.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
        ).run(t.id, 'cron', 'stuck_alert', `Task stuck in-progress for > 4 hours. Alert posted to #general.`, Date.now());
      } catch { /* non-critical */ }
    }
  } catch (e) {
    log(`Error in checkStuckTasks: ${e.message}`);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

log('Mission Control cron daemon starting...');
log(`Schedule: ${SCHEDULE_PATH}`);
log(`Claude: ${CLAUDE_BIN}`);

checkJobs();
setInterval(checkJobs, CHECK_INTERVAL);

// Stuck task sweep every 30 minutes
checkStuckTasks();
setInterval(checkStuckTasks, STUCK_CHECK_INTERVAL);

process.on('SIGTERM', () => { log('Cron daemon shutting down.'); process.exit(0); });
process.on('SIGINT',  () => { log('Cron daemon shutting down.'); process.exit(0); });
