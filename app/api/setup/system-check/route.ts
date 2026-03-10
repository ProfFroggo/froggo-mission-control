// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
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

function checkMcpServers(): { ok: boolean; missing: string[] } {
  // Check the generated settings in ~/mission-control/.claude/settings.json
  const settingsPath = path.join(homedir(), 'mission-control', '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return { ok: false, missing: ['mission-control_db', 'memory'] };
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const requiredServers = ['mission-control_db', 'memory'];
    const installedServerKeys = Object.keys(settings.mcpServers ?? {});
    const missingServers = requiredServers.filter(s =>
      !installedServerKeys.some(key => key === s || key.replace(/-/g, '_') === s.replace(/-/g, '_'))
    );
    const mcpOk = missingServers.length === 0;
    return { ok: mcpOk, missing: missingServers };
  } catch {
    return { ok: false, missing: ['mission-control_db', 'memory'] };
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
  const mcpResult = checkMcpServers();
  const agentsInfo = checkAgentsOnDisk();
  const cronDaemon = checkCronDaemon();

  return NextResponse.json({
    cli: { ok: cli, label: 'Claude CLI installed' },
    database: { ok: database, label: 'Task database found', critical: true },
    mcp: {
      ok: mcpResult.ok,
      label: mcpResult.ok
        ? 'MCP servers configured'
        : `MCP servers missing: ${mcpResult.missing.join(', ')}`,
    },
    agents: { ok: agentsInfo.ok, label: `Agent souls on disk (${agentsInfo.count} found)`, count: agentsInfo.count },
    cronDaemon: { ok: cronDaemon, label: 'Cron daemon LaunchAgent installed' },
  });
}
