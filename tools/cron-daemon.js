#!/usr/bin/env node
/**
 * Froggo Cron Daemon
 *
 * Reads ~/froggo/data/schedule.json every minute.
 * Executes claude CLI commands when jobs are due.
 * Start with: node tools/cron-daemon.js
 * Or with pm2: pm2 start tools/cron-daemon.js --name froggo-cron
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const SCHEDULE_PATH = process.env.SCHEDULE_PATH || path.join(os.homedir(), 'froggo/data/schedule.json');
const LOG_PATH = process.env.LOG_PATH || path.join(os.homedir(), 'froggo/logs/cron.log');
const CHECK_INTERVAL = 60000; // 1 minute

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line);
  } catch {}
}

function readSchedule() {
  try {
    if (!fs.existsSync(SCHEDULE_PATH)) return [];
    return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
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

function runJob(job) {
  log(`Running job ${job.id}: ${job.command}`);
  const proc = spawn('bash', ['-c', job.command], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.env.FROGGO_DIR || path.join(os.homedir(), 'git/froggo-nextjs'),
  });

  proc.stdout.on('data', d => log(`[${job.id}] ${d.toString().trim()}`));
  proc.stderr.on('data', d => log(`[${job.id}] ERR: ${d.toString().trim()}`));
  proc.on('close', code => log(`[${job.id}] exited with code ${code}`));
  proc.unref();
}

function checkJobs() {
  const jobs = readSchedule();
  const now = Date.now();
  let updated = false;

  for (const job of jobs) {
    if (job.status !== 'pending' && job.status !== 'scheduled') continue;
    if (job.runAt && job.runAt <= now) {
      runJob(job);
      job.status = 'executed';
      job.executedAt = now;
      updated = true;
    }
  }

  if (updated) writeSchedule(jobs);
}

log('Froggo cron daemon starting...');
checkJobs();
setInterval(checkJobs, CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => { log('Daemon shutting down.'); process.exit(0); });
process.on('SIGINT', () => { log('Daemon shutting down.'); process.exit(0); });
