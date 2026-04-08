// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * GET /api/artifacts/scan?since=<epoch_ms>&agent=<agent_id>&agents=<id1,id2,...>
 *
 * Scans ~/mission-control/ for files created/modified since `since` timestamp.
 * Returns file metadata so the frontend can auto-create artifact entries.
 * This is the reliable fallback — doesn't depend on agents mentioning paths in chat.
 *
 * Use `agent` for a single agent (1-1 chats) or `agents` for multiple (chat rooms).
 */
import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { homedir } from 'os';
import { ALL_ARTIFACT_EXTS } from '@/lib/missionControlPaths';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MC_BASE = join(homedir(), 'mission-control');
const EXT_SET = new Set(ALL_ARTIFACT_EXTS.map(e => `.${e}`));

interface ScannedFile {
  path: string;
  filename: string;
  ext: string;
  modified: number;
  size: number;
}

function scanDir(dir: string, since: number, results: ScannedFile[], depth = 0): void {
  if (depth > 5) return; // prevent runaway recursion
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip heavy/irrelevant dirs
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'data') continue;
        scanDir(full, since, results, depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!EXT_SET.has(ext)) continue;
        try {
          const stat = statSync(full);
          if (stat.mtimeMs >= since) {
            results.push({
              path: full,
              filename: basename(full),
              ext: ext.slice(1), // remove dot
              modified: stat.mtimeMs,
              size: stat.size,
            });
          }
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const since = parseInt(searchParams.get('since') ?? '0', 10);
  const agentId = searchParams.get('agent');
  const agentsCsv = searchParams.get('agents'); // comma-separated for rooms

  if (!since || since < 1) {
    return NextResponse.json({ error: 'since (epoch ms) is required' }, { status: 400 });
  }

  const results: ScannedFile[] = [];

  // Only scan agent-specific workspaces — never library/ globally.
  // library/ has no session affinity so files would bleed into unrelated sessions.
  // Rooms rely on text-based extraction from message content (tool_result blocks).
  if (agentId) {
    scanDir(join(MC_BASE, 'agents', agentId), since, results);
  } else if (agentsCsv) {
    const ids = agentsCsv.split(',').map(s => s.trim()).filter(Boolean);
    for (const id of ids) {
      scanDir(join(MC_BASE, 'agents', id), since, results);
    }
  }

  // Sort newest first, cap at 50
  results.sort((a, b) => b.modified - a.modified);

  return NextResponse.json({ files: results.slice(0, 50) });
}
