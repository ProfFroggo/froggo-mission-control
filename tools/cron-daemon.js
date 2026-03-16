#!/usr/bin/env node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
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
 *     payload: { kind?: 'task'|'message', message: string, model?: string },
 *     taskTemplate?: {                   // When set, cron creates a task instead of messaging agent
 *       title: string,                   // Supports {date} placeholder
 *       description?: string,
 *       planningNotes?: string,          // Agent instructions / acceptance criteria
 *       assignTo?: string,              // Agent ID to assign
 *       priority?: string,              // p0, p1, p2, p3
 *       project?: string,
 *       project_id?: string,
 *       tags?: string[],
 *       subtasks?: Array<string | { title: string, description?: string, assignedTo?: string }>,
 *     },
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
const CLAUDE_BIN = process.env.CLAUDE_BIN || (() => {
  try { return require('child_process').execSync('which claude', { encoding: 'utf-8', timeout: 2000 }).trim(); } catch {}
  const candidates = ['/usr/local/bin/claude', path.join(HOME, '.npm-global', 'bin', 'claude'), '/opt/homebrew/bin/claude'];
  return candidates.find(f => require('fs').existsSync(f)) || 'claude';
})();
const DB_PATH = process.env.DB_PATH || path.join(HOME, 'mission-control/data/mission-control.db');
const PID_PATH = path.join(HOME, 'mission-control/logs/cron-daemon.pid');
const CHECK_INTERVAL = 60_000;        // 1 minute — schedule job check

// ── Single-instance lock ──────────────────────────────────────────────────────
// Prevent duplicate daemons from running concurrently.
try {
  if (fs.existsSync(PID_PATH)) {
    const existingPid = parseInt(fs.readFileSync(PID_PATH, 'utf8').trim(), 10);
    if (existingPid && existingPid !== process.pid) {
      try { process.kill(existingPid, 0); // Check if process is alive
        console.error(`Cron daemon already running (PID ${existingPid}). Exiting.`);
        process.exit(0);
      } catch { /* stale PID — proceed */ }
    }
  }
  fs.mkdirSync(path.dirname(PID_PATH), { recursive: true });
  fs.writeFileSync(PID_PATH, String(process.pid));
} catch (e) {
  console.error('PID lock error:', e.message);
}
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
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.jobs)) return parsed.jobs;
    return [];
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

// ── Chat message persistence ──────────────────────────────────────────────────

function saveChatMessage(sessionKey, role, content) {
  const database = getDb();
  if (!database) return;
  try {
    const agentId = sessionKey.replace(/^(cron:|inbox:)/, '');
    const now = Date.now();
    // Session must exist before message (FK constraint: messages.sessionKey → sessions.key)
    database.prepare(
      `INSERT OR IGNORE INTO sessions (key, agentId, createdAt, lastActivity, messageCount)
       VALUES (?, ?, ?, ?, 0)`
    ).run(sessionKey, agentId, now, now);
    database.prepare(
      `UPDATE sessions SET lastActivity = ?, messageCount = messageCount + 1 WHERE key = ?`
    ).run(now, sessionKey);
    const id = `cron-${now}-${Math.random().toString(36).slice(2, 7)}`;
    database.prepare(
      `INSERT OR IGNORE INTO messages (id, sessionKey, role, content, timestamp, channel)
       VALUES (?, ?, ?, ?, ?, 'cron')`
    ).run(id, sessionKey, role, content, now);
  } catch (e) {
    log(`saveChatMessage error: ${e.message}`);
  }
}

// ── Job execution ─────────────────────────────────────────────────────────────

// Route generic/unknown targets to mission-control
const GENERIC_TARGETS = new Set(['isolated', 'main', 'froggo']);

async function runApiJob(job) {
  const payload = job.payload || {};
  const message = payload.message || 'Check your tasks and report status.';
  const model = payload.model || 'claude-haiku-4-5-20251001';
  const rawTarget = job.sessionTarget || 'mission-control';
  const agentId = GENERIC_TARGETS.has(rawTarget) ? 'mission-control' : rawTarget;
  const sessionKey = `cron:${agentId}`;

  log(`Dispatching cron job "${job.name}" → agent=${agentId} session=${sessionKey}`);

  // Save the trigger message to chat so it's visible in UI
  saveChatMessage(sessionKey, 'user', `[Scheduled: ${job.name}] ${message}`);

  return new Promise((resolve) => {
    const body = JSON.stringify({ message, model, sessionKey });
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: `/api/agents/${agentId}/stream`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let buf = '';
      let accumulated = '';

      res.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'assistant' && evt.message?.content) {
              for (const block of evt.message.content) {
                if (block.type === 'text') accumulated += block.text;
              }
            } else if (evt.type === 'text' && evt.text) {
              accumulated += evt.text;
            } else if (evt.type === 'error') {
              log(`[${job.id}] agent error: ${evt.text}`);
              accumulated += `[Error: ${evt.text}]`;
            }
          } catch {}
        }
      });

      res.on('end', () => {
        if (accumulated) {
          log(`[${job.id}] ${agentId} responded (${accumulated.length} chars)`);
          saveChatMessage(sessionKey, 'agent', accumulated);
        } else {
          log(`[${job.id}] ${agentId} produced no response`);
        }
        resolve();
      });
    });

    req.on('error', err => {
      log(`[${job.id}] Stream request error: ${err.message}`);
      resolve();
    });

    // 3-minute timeout per job
    req.setTimeout(180_000, () => {
      log(`[${job.id}] Timed out after 3 min`);
      req.destroy();
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// ── Task-based job execution ──────────────────────────────────────────────────
// Instead of messaging an agent directly, create a proper task in the pipeline.
// The task goes through: todo → Clara review → agent assigned → in-progress → done

async function runTaskJob(job) {
  const template = job.taskTemplate || {};
  const payload = job.payload || {};
  const rawTarget = job.sessionTarget || 'mission-control';
  const agentId = GENERIC_TARGETS.has(rawTarget) ? null : rawTarget;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Build task title — support {date} placeholder
  const title = (template.title || job.name || 'Scheduled Task')
    .replace(/\{date\}/g, dateStr);

  // Build planning notes from the cron message + template description
  const planningNotes = [
    template.planningNotes || payload.message || '',
    template.description ? `\n\nContext: ${template.description}` : '',
  ].join('').trim() || `Scheduled cron job: ${job.name}`;

  // Subtasks from template
  const subtasks = template.subtasks || [];

  const taskBody = {
    title,
    description: template.description || `Recurring scheduled task: ${job.name}`,
    status: 'todo',
    priority: template.priority || 'p2',
    assignedTo: template.assignTo || agentId || null,
    tags: template.tags || ['scheduled', 'cron'],
    planningNotes,
    project: template.project || null,
    project_id: template.project_id || null,
  };

  log(`Creating task for cron job "${job.name}" → "${title}" assigned=${taskBody.assignedTo}`);

  return new Promise((resolve) => {
    const body = JSON.stringify(taskBody);
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/tasks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const task = JSON.parse(data);
          if (task.id) {
            log(`[${job.id}] Task created: ${task.id} — "${title}"`);

            // Create subtasks if template defines them
            if (subtasks.length > 0) {
              let created = 0;
              for (const st of subtasks) {
                const stBody = JSON.stringify({
                  title: typeof st === 'string' ? st : st.title,
                  description: typeof st === 'string' ? null : (st.description || null),
                  assignedTo: typeof st === 'string' ? null : (st.assignedTo || null),
                });
                const stReq = http.request({
                  host: '127.0.0.1',
                  port: 3000,
                  path: `/api/tasks/${task.id}/subtasks`,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(stBody),
                  },
                }, (stRes) => {
                  let stData = '';
                  stRes.on('data', c => { stData += c; });
                  stRes.on('end', () => {
                    created++;
                    if (created === subtasks.length) {
                      log(`[${job.id}] ${created} subtasks created for ${task.id}`);
                    }
                  });
                });
                stReq.on('error', () => {});
                stReq.write(stBody);
                stReq.end();
              }
            }

            // Log activity
            const actBody = JSON.stringify({
              agentId: 'system',
              action: 'created',
              message: `Cron job "${job.name}" created task: ${title}`,
            });
            const actReq = http.request({
              host: '127.0.0.1',
              port: 3000,
              path: `/api/tasks/${task.id}/activity`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(actBody),
              },
            }, () => {});
            actReq.on('error', () => {});
            actReq.write(actBody);
            actReq.end();
          } else {
            log(`[${job.id}] Task creation failed: ${data}`);
          }
        } catch (e) {
          log(`[${job.id}] Task creation parse error: ${e.message}`);
        }
        resolve();
      });
    });

    req.on('error', err => {
      log(`[${job.id}] Task creation request error: ${err.message}`);
      resolve();
    });

    req.setTimeout(30_000, () => {
      log(`[${job.id}] Task creation timed out`);
      req.destroy();
      resolve();
    });

    req.write(body);
    req.end();
  });
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
      // Route to task creation or direct agent messaging
      const execFn = (job.taskTemplate || (job.payload && job.payload.kind === 'task'))
        ? runTaskJob
        : runApiJob;
      const startedAt = Date.now();
      execFn(job).then(() => {
        logRunToDb(job.id, 'success', `Job "${job.name}" completed`, startedAt);
      }).catch(e => {
        log(`[${job.id}] runApiJob error: ${e.message}`);
        logRunToDb(job.id, 'failed', e.message, startedAt);
        try {
          const errLogPath = path.join(HOME, 'mission-control', 'cron-errors.log');
          fs.appendFileSync(errLogPath, `${new Date().toISOString()} Job ${job.id} failed: ${e.message}\n`);
        } catch { /* non-critical */ }
      });
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

/** Log cron execution to automation_runs table */
function logRunToDb(jobId, status, message, startedAt) {
  try {
    const db = getDb();
    if (!db) return;
    const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(
      `INSERT INTO automation_runs (id, automationId, status, message, startedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, jobId, status, (message || '').slice(0, 500), startedAt, Date.now());
    // Keep last 100 runs per job
    db.prepare(
      `DELETE FROM automation_runs WHERE automationId = ? AND id NOT IN (SELECT id FROM automation_runs WHERE automationId = ? ORDER BY startedAt DESC LIMIT 100)`
    ).run(jobId, jobId);
    // Also update automations table last_run if matching
    db.prepare(`UPDATE automations SET last_run = ?, updated_at = ? WHERE id = ?`).run(Date.now(), Date.now(), jobId);
  } catch { /* non-critical */ }
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

// ── Scheduled items processing ───────────────────────────────────────────────
// Processes pending items from the scheduled_items table at their scheduled time.

async function processScheduledItems() {
  const database = getDb();
  if (!database) return;

  try {
    const now = Date.now();
    const nowIso = new Date().toISOString();

    // Find pending items where scheduledFor <= now
    // scheduledFor can be ISO string or unix timestamp
    const pending = database.prepare(
      `SELECT * FROM scheduled_items WHERE status = 'pending' AND (
        (typeof(scheduledFor) = 'text' AND scheduledFor <= ?) OR
        (typeof(scheduledFor) = 'integer' AND scheduledFor <= ?) OR
        (scheduledAt IS NOT NULL AND scheduledAt <= ?)
      )`
    ).all(nowIso, now, now);

    if (pending.length === 0) return;

    log(`Processing ${pending.length} scheduled item(s)`);

    for (const item of pending) {
      try {
        const type = item.type || 'event';
        const content = item.content || '';
        const title = item.title || content.slice(0, 80);

        if (type === 'tweet' || type === 'thread' || ((type === 'post' || type === 'social') && (item.platform === 'twitter' || item.platform === 'x'))) {
          // Post tweet directly to X API
          let tweetContent = content;
          try { const parsed = JSON.parse(content); if (parsed.tweets) tweetContent = parsed.tweets[0]; } catch { /* use raw */ }

          const tweetBody = JSON.stringify({ text: tweetContent });
          const postResult = await new Promise((resolve) => {
            const req = http.request({
              host: '127.0.0.1', port: 3000,
              path: '/api/x/tweet', method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(tweetBody) },
            }, (res) => {
              let data = '';
              res.on('data', c => { data += c; });
              res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); } });
            });
            req.on('error', (e) => resolve({ error: e.message }));
            req.setTimeout(30000, () => { req.destroy(); resolve({ error: 'timeout' }); });
            req.write(tweetBody);
            req.end();
          });

          if (postResult.ok || postResult.id) {
            log(`[scheduled] Tweet posted: ${postResult.id || 'ok'}`);
            database.prepare(`UPDATE scheduled_items SET status = 'published', updatedAt = ? WHERE id = ?`).run(now, item.id);

            // If thread, post remaining tweets as replies
            try {
              const parsed = JSON.parse(content);
              if (parsed.tweets && parsed.tweets.length > 1) {
                let replyTo = postResult.id;
                for (let i = 1; i < parsed.tweets.length; i++) {
                  const replyBody = JSON.stringify({ text: parsed.tweets[i], reply_to: replyTo });
                  const replyResult = await new Promise((resolve) => {
                    const req = http.request({
                      host: '127.0.0.1', port: 3000,
                      path: '/api/x/tweet', method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(replyBody) },
                    }, (res) => { let d = ''; res.on('data', c => { d += c; }); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } }); });
                    req.on('error', () => resolve({}));
                    req.write(replyBody);
                    req.end();
                  });
                  if (replyResult.id) replyTo = replyResult.id;
                }
                log(`[scheduled] Thread posted: ${parsed.tweets.length} tweets`);
              }
            } catch { /* not a thread */ }
            continue; // skip the generic status update below
          } else {
            log(`[scheduled] Tweet post failed: ${postResult.error || 'unknown'}`);
            database.prepare(`UPDATE scheduled_items SET status = 'failed', updatedAt = ? WHERE id = ?`).run(now, item.id);
            continue;
          }
        } else if (type === 'post' || type === 'social') {
          // Non-twitter social post — create task for agent
          const taskBody = JSON.stringify({
            title: `Post: ${title}`,
            description: content,
            status: 'todo',
            priority: 'p2',
            assignedTo: 'social-manager',
            planningNotes: `Scheduled social post. Content:\n\n${content}\n\nPlatform: ${item.platform || 'unknown'}`,
            tags: ['scheduled', 'social'],
          });
          const req = http.request({
            host: '127.0.0.1', port: 3000,
            path: '/api/tasks', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(taskBody) },
          }, (res) => { res.resume(); });
          req.on('error', () => {});
          req.write(taskBody);
          req.end();
          log(`[scheduled] Created social post task: "${title}"`);
        } else if (type === 'meeting') {
          // Post reminder to mission-control chat
          await postToRoom('general', `Meeting reminder: **${title}**\n${content}`);
          log(`[scheduled] Posted meeting reminder: "${title}"`);
        } else {
          // Generic event — log to activity
          log(`[scheduled] Processed event: "${title}"`);
        }

        // Mark as completed
        database.prepare(`UPDATE scheduled_items SET status = 'completed', updatedAt = ? WHERE id = ?`).run(now, item.id);
      } catch (e) {
        log(`[scheduled] Error processing item ${item.id}: ${e.message}`);
        database.prepare(`UPDATE scheduled_items SET status = 'failed', updatedAt = ? WHERE id = ?`).run(now, item.id);
      }
    }
  } catch (e) {
    log(`Error in processScheduledItems: ${e.message}`);
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

// Scheduled items processing every minute
processScheduledItems();
setInterval(processScheduledItems, CHECK_INTERVAL);

// ── Social Media: Mention Processing ─────────────────────────────────────────
// Fetch new mentions from X API, store in inbox, generate AI reply suggestions
const MENTION_PROCESS_INTERVAL = 15 * 60_000; // every 15 minutes

async function processMentions() {
  try {
    // Check if X is configured first
    const flagResult = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port: 3000, path: '/api/settings/twitter_setup_complete' }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
      }).on('error', () => resolve(null));
    });
    if (!flagResult || flagResult.value !== 'true') return;

    log('[social] Processing mentions...');
    const result = await new Promise((resolve) => {
      const req = http.request({
        host: '127.0.0.1', port: 3000,
        path: '/api/x/mentions/process',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); } });
      });
      req.on('error', (e) => resolve({ error: e.message }));
      req.setTimeout(55000, () => { req.destroy(); resolve({ error: 'timeout' }); });
      req.write('{}');
      req.end();
    });

    if (result.ok) {
      const parts = [];
      if (result.newMentions > 0) parts.push(`${result.newMentions} new`);
      if (result.aiRepliesGenerated > 0) parts.push(`${result.aiRepliesGenerated} AI replies`);
      if (parts.length > 0) {
        log(`[social] Mentions processed: ${parts.join(', ')}`);
      } else {
        log(`[social] Mentions checked: ${result.fetched} fetched, no new`);
      }
    } else if (result.error) {
      log(`[social] Mention processing error: ${result.error}`);
    }
  } catch (e) {
    log(`[social] Mention processing failed: ${e.message || e}`);
  }
}

// Initial run after 30s delay (let server start), then every 15 min
setTimeout(processMentions, 30_000);
setInterval(processMentions, MENTION_PROCESS_INTERVAL);

function shutdown() {
  log('Cron daemon shutting down.');
  try { fs.unlinkSync(PID_PATH); } catch {}
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
