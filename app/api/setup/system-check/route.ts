import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { getDb } from '@/lib/database';

function checkCliInstalled(): boolean {
  // Check common install locations — 'which claude' fails in LaunchAgent PATH context
  const candidates = [
    process.env.CLAUDE_BIN,                        // set by cli.js in LaunchAgent env
    '/opt/homebrew/bin/claude',                     // Homebrew Apple Silicon
    '/usr/local/bin/claude',                        // Homebrew Intel / manual
    `${homedir()}/.npm-global/bin/claude`,          // npm global custom prefix
    `${homedir()}/.local/bin/claude`,               // Linux local
    '/usr/bin/claude',
  ];
  if (candidates.some(p => p && existsSync(p))) return true;
  try {
    execSync('which claude', { stdio: 'pipe', env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${homedir()}/.npm-global/bin:${process.env.PATH}` } });
    return true;
  } catch {
    return false;
  }
}

function checkDatabase(): boolean {
  const dbPath = path.join(homedir(), 'mission-control', 'data', 'mission-control.db');
  if (existsSync(dbPath)) return true;
  // DB file doesn't exist yet — trigger initialization now so the wizard can proceed
  try {
    getDb(); // creates the file, runs migrations, seeds core agents
    return existsSync(dbPath);
  } catch {
    return false;
  }
}

function checkMcpServers(): boolean {
  const settingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return false;
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    return Object.keys(settings.mcpServers ?? {}).length > 0;
  } catch {
    return false;
  }
}

function checkAgentsOnDisk(): { count: number; ok: boolean } {
  const agentsDir = path.join(process.cwd(), '.claude', 'agents');
  if (!existsSync(agentsDir)) return { count: 0, ok: false };
  try {
    // Count agent SOUL files or agent directories
    const { readdirSync } = require('fs');
    const entries = readdirSync(agentsDir);
    const count = entries.length;
    return { count, ok: count > 0 };
  } catch {
    return { count: 0, ok: false };
  }
}

function checkCronDaemon(): boolean {
  const cronPlist = path.join(homedir(), 'Library', 'LaunchAgents', 'com.mission-control.cron.plist');
  return existsSync(cronPlist);
}

export async function GET() {
  const cli = checkCliInstalled();
  const database = checkDatabase();
  const mcp = checkMcpServers();
  const agentsInfo = checkAgentsOnDisk();
  const cronDaemon = checkCronDaemon();

  return NextResponse.json({
    cli: { ok: cli, label: 'Claude CLI installed' },
    database: { ok: database, label: 'Task database found', critical: true },
    mcp: { ok: mcp, label: 'MCP servers configured' },
    agents: { ok: agentsInfo.ok, label: `Agent souls on disk (${agentsInfo.count} found)`, count: agentsInfo.count },
    cronDaemon: { ok: cronDaemon, label: 'Cron daemon LaunchAgent installed' },
  });
}
