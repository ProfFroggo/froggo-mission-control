import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { execSync } from 'child_process';

function checkCliInstalled(): boolean {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkDatabase(): boolean {
  const dbPath = path.join(homedir(), 'mission-control', 'data', 'mission-control.db');
  return existsSync(dbPath);
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

export async function GET() {
  const cli = checkCliInstalled();
  const database = checkDatabase();
  const mcp = checkMcpServers();
  const agentsInfo = checkAgentsOnDisk();

  return NextResponse.json({
    cli: { ok: cli, label: 'Claude CLI installed' },
    database: { ok: database, label: 'Task database found', critical: true },
    mcp: { ok: mcp, label: 'MCP servers configured' },
    agents: { ok: agentsInfo.ok, label: `Agent souls on disk (${agentsInfo.count} found)`, count: agentsInfo.count },
  });
}
