// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/export — download a full backup of the user's data
// Returns a SQLite database backup as a downloadable file.

import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const dbPath = ENV.DB_PATH;
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    // Create a temporary backup using SQLite's online backup API
    const backupPath = join(tmpdir(), `mc-export-${Date.now()}.db`);

    try {
      execSync(`sqlite3 "${dbPath}" ".backup '${backupPath}'"`, { timeout: 30000 });
    } catch {
      return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
    }

    if (!existsSync(backupPath)) {
      return NextResponse.json({ error: 'Backup file not created' }, { status: 500 });
    }

    const data = readFileSync(backupPath);

    // Clean up temp file
    try { unlinkSync(backupPath); } catch { /* best effort */ }

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="mission-control-backup-${date}.db"`,
        'Content-Length': String(data.length),
      },
    });
  } catch (error) {
    console.error('GET /api/export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
