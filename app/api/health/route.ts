// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { startDispatcherCron } from '@/lib/taskDispatcherCron';
import { startClaraReviewCron } from '@/lib/claraReviewCron';
import { startSessionKeepalive } from '@/lib/sessionKeepalive';
import { startMemoryDecayCron, getVaultStats } from '@/lib/memoryDecayCron';
import { ENV } from '@/lib/env';
import { getDb } from '@/lib/database';

// Start background crons on server boot (once-per-process guard against HMR re-runs)
if (!(globalThis as any).__healthInitialized) {
  (globalThis as any).__healthInitialized = true;
  startDispatcherCron();
  startClaraReviewCron();
  startSessionKeepalive();
  startMemoryDecayCron();
}

function checkClaudeCli(): { found: boolean; authenticated: boolean; path: string } {
  const bin = ENV.CLAUDE_BIN;
  const found = !!(bin && (bin === 'claude' || existsSync(bin)));

  // Check ~/.claude.json for auth state
  let authenticated = false;
  try {
    const cfgPath = path.join(homedir(), '.claude.json');
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
      authenticated = !!(cfg.hasCompletedOnboarding || cfg.oauthAccount || cfg.primaryApiKey);
    }
  } catch { /* unreadable */ }

  // Fallback: try running claude --version (quick, non-interactive)
  if (found && !authenticated) {
    try {
      execSync(`"${bin}" --version`, { timeout: 3000, stdio: 'pipe' });
      authenticated = true; // if it runs without auth error, we're good
    } catch { /* not authenticated or not found */ }
  }

  return { found, authenticated, path: bin };
}

export async function GET() {
  const dbPath = path.join(homedir(), 'mission-control', 'data', 'mission-control.db');
  const database = existsSync(dbPath);

  const cronPlist = path.join(homedir(), 'Library', 'LaunchAgents', 'com.mission-control.cron.plist');
  const cronDaemonInstalled = existsSync(cronPlist);

  const vaultStats = getVaultStats();
  const claudeStatus = checkClaudeCli();

  // Richer task/agent stats — non-critical, fail gracefully
  let tasksInProgress = 0;
  let tasksInReview = 0;
  let tasksPreReview = 0;
  let agentsActive = 0;
  let agentsTotal = 0;
  let modulesTotal = 0;
  try {
    const db = getDb();
    const inProgress = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'in-progress'").get() as { cnt: number };
    const inReview = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'review'").get() as { cnt: number };
    const preReview = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'internal-review'").get() as { cnt: number };
    const activeThreshold = Date.now() - 5 * 60 * 1000; // 5 min
    const active = db.prepare(
      "SELECT COUNT(*) as cnt FROM agents WHERE lastSeen > ?"
    ).get(activeThreshold) as { cnt: number } | undefined;
    const totalAgents = db.prepare("SELECT COUNT(*) as cnt FROM agents").get() as { cnt: number } | undefined;
    tasksInProgress = inProgress?.cnt ?? 0;
    tasksInReview = inReview?.cnt ?? 0;
    tasksPreReview = preReview?.cnt ?? 0;
    agentsActive = active?.cnt ?? 0;
    agentsTotal = totalAgents?.cnt ?? 0;
    // modules table may not exist in all deployments — fail silently
    try {
      const totalModules = db.prepare("SELECT COUNT(*) as cnt FROM modules").get() as { cnt: number } | undefined;
      modulesTotal = totalModules?.cnt ?? 0;
    } catch { /* modules table not present */ }
  } catch { /* DB may not be ready — non-critical */ }

  // Git info — non-critical, fail silently
  let gitBranch: string | null = null;
  let gitCommit: string | null = null;
  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), timeout: 2000, stdio: 'pipe' }).toString().trim();
    gitCommit = execSync('git rev-parse --short HEAD', { cwd: process.cwd(), timeout: 2000, stdio: 'pipe' }).toString().trim();
  } catch { /* not a git repo or git not available */ }

  return NextResponse.json({
    cli: claudeStatus.found && claudeStatus.authenticated,
    claudeFound: claudeStatus.found,
    claudeAuthenticated: claudeStatus.authenticated,
    claudePath: claudeStatus.path,
    gateway: true,
    config: true,
    database,
    backend: 'claude-code-cli',
    cronDaemon: cronDaemonInstalled,
    vault: vaultStats,
    tasksInProgress,
    tasksInReview,
    tasksPreReview,
    agentsActive,
    agentsTotal,
    modulesTotal,
    gitBranch,
    gitCommit,
  });
}
