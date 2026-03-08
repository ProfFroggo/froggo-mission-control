import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

export async function GET() {
  const vaultPath = path.join(homedir(), 'mission-control', 'memory');
  const obsidianMarker = path.join(vaultPath, '.obsidian');
  const exists = existsSync(vaultPath);
  // .obsidian/ is created when Obsidian opens the vault — confirms it was actually opened
  const opened = existsSync(obsidianMarker);
  return NextResponse.json({ exists, opened, path: vaultPath });
}
