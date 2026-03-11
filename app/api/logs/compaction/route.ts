// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/logs/compaction
// Returns parsed compaction-log.jsonl entries — one entry per agent context compaction.
// Used to surface how often agents hit context limits in the system panel.
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LOG_FILE = join(homedir(), 'mission-control', 'data', 'compaction-log.jsonl');

interface CompactionEntry {
  timestamp: string;
  agentId: string;
  sessionId: string | null;
  messageCount: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 1000);
    const agentId = searchParams.get('agentId') ?? null;

    if (!existsSync(LOG_FILE)) {
      return NextResponse.json({ entries: [], total: 0 });
    }

    const raw = readFileSync(LOG_FILE, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);

    const entries: CompactionEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as CompactionEntry;
        if (agentId && entry.agentId !== agentId) continue;
        entries.push(entry);
      } catch { /* skip malformed lines */ }
    }

    // Most recent first
    entries.reverse();

    return NextResponse.json({
      entries: entries.slice(0, limit),
      total: entries.length,
    });
  } catch (error) {
    console.error('GET /api/logs/compaction error:', error);
    return NextResponse.json({ entries: [], total: 0 });
  }
}
