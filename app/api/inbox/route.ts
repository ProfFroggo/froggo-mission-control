// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { emitSSEEvent } from '@/lib/sseEmitter';
import { join } from 'path';
import { homedir } from 'os';
import { TIER_TOOLS, loadDisallowedTools } from '@/lib/taskDispatcher';
import { ENV } from '@/lib/env';

function parseInboxItem(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.metadata === 'string') {
    try { parsed.metadata = JSON.parse(parsed.metadata as string); } catch { parsed.metadata = {}; }
  }
  if (typeof parsed.tags === 'string') {
    try { parsed.tags = JSON.parse(parsed.tags as string); } catch { parsed.tags = []; }
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const conditions: string[] = [];
    const values: unknown[] = [];

    const status = searchParams.get('status');
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const project = searchParams.get('project');
    if (project) {
      conditions.push('project = ?');
      values.push(project);
    }

    const starred = searchParams.get('starred');
    if (starred !== null) {
      conditions.push('starred = ?');
      values.push(starred === 'true' ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM inbox ${where} ORDER BY createdAt DESC LIMIT 200`).all(...values) as Record<string, unknown>[];

    return NextResponse.json(rows.map(parseInboxItem));
  } catch (error) {
    console.error('GET /api/inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      type, title, content, context, channel, source_channel,
      status, metadata = {}, tags = [], project,
    } = body;

    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO inbox (type, title, content, context, channel, source_channel, status, createdAt, metadata, starred, isRead, tags, project)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(type, title, content, context ?? null, channel ?? null, source_channel ?? null, status ?? null, now, JSON.stringify(metadata), JSON.stringify(tags), project ?? null);

    const item = db.prepare('SELECT * FROM inbox WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;

    // Notify SSE clients of new inbox item
    emitSSEEvent('inbox.count', { id: result.lastInsertRowid, type, title });

    // Fire-and-forget: wake inbox agent to triage the new item
    try {
      const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
      const inboxCwd = join(homedir(), 'mission-control', 'agents', 'inbox');
      const triggerMsg = `New inbox item received. Title: "${title}". Type: ${type || 'unknown'}. Channel: ${channel || 'unknown'}. Please triage this item, assign priority, and update its status.`;
      const proc = spawn(
        ENV.CLAUDE_BIN,
        ['--print', '--model', 'claude-haiku-4-5-20251001',
          '--allowedTools', TIER_TOOLS['worker'].join(','),
          '--disallowedTools', loadDisallowedTools('inbox').join(','),
          triggerMsg],
        { cwd: existsSync(inboxCwd) ? inboxCwd : homedir(), env: { ...cleanEnv } as NodeJS.ProcessEnv, detached: true, stdio: ['ignore', 'ignore', 'ignore'] }
      );
      proc.unref();
    } catch (err) {
      console.warn('[inbox] Failed to trigger inbox agent:', err instanceof Error ? err.message : String(err));
    }

    return NextResponse.json(parseInboxItem(item), { status: 201 });
  } catch (error) {
    console.error('POST /api/inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (body.action === 'mark-all-read') {
      const result = db.prepare(
        `UPDATE inbox SET isRead = 1 WHERE isRead = 0`
      ).run();
      emitSSEEvent('inbox.count', { count: 0 });
      return NextResponse.json({ updated: result.changes });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/inbox error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
