import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { startDispatcherCron } from '@/lib/taskDispatcherCron';
import { startClaraReviewCron } from '@/lib/claraReviewCron';
import { startSessionKeepalive } from '@/lib/sessionKeepalive';

// Start background crons on server boot (once-per-process guard against HMR re-runs)
if (!(globalThis as any).__healthInitialized) {
  (globalThis as any).__healthInitialized = true;
  startDispatcherCron();
  startClaraReviewCron();
  startSessionKeepalive();
}

export async function GET() {
  const dbPath = path.join(homedir(), 'mission-control', 'data', 'mission-control.db');
  const database = existsSync(dbPath);

  const cronPlist = path.join(homedir(), 'Library', 'LaunchAgents', 'com.mission-control.cron.plist');
  const cronDaemonInstalled = existsSync(cronPlist);

  return NextResponse.json({
    // We use Claude Code CLI — no OpenClaw gateway needed
    cli: true,
    gateway: true,
    config: true,
    database,
    backend: 'claude-code-cli',
    cronDaemon: cronDaemonInstalled,
  });
}
