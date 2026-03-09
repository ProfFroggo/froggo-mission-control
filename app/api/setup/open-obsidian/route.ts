// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import os from 'os';

export async function POST() {
  const vaultPath = `${os.homedir()}/mission-control/memory`;
  try {
    // Try obsidian:// URI scheme first
    if (process.platform === 'darwin') {
      execSync(`open "obsidian://open?path=${encodeURIComponent(vaultPath)}"`, { timeout: 5000 });
    } else {
      execSync(`xdg-open "obsidian://open?path=${encodeURIComponent(vaultPath)}"`, { timeout: 5000 });
    }
    return NextResponse.json({ opened: true });
  } catch {
    // Fall back to opening the folder
    try {
      if (process.platform === 'darwin') {
        execSync(`open "${vaultPath}"`, { timeout: 3000 });
      }
      return NextResponse.json({ opened: true, fallback: true });
    } catch {
      return NextResponse.json({ opened: false }, { status: 500 });
    }
  }
}
