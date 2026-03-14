// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

function parseAgent(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.capabilities === 'string') {
    try {
      parsed.capabilities = JSON.parse(parsed.capabilities as string);
    } catch {
      parsed.capabilities = [];
    }
  }
  return parsed;
}

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();

    // Staleness sweep: agents with no activity in 30+ minutes revert to offline
    const cutoff = Date.now() - 30 * 60 * 1000;
    db.prepare(
      `UPDATE agents SET status = 'offline'
       WHERE status IN ('active', 'idle')
         AND lastActivity IS NOT NULL
         AND lastActivity < ?`
    ).run(cutoff);

    const rows = db.prepare(
      `SELECT * FROM agents WHERE status != 'archived' ORDER BY CASE id WHEN 'mission-control' THEN 0 WHEN 'hr' THEN 1 WHEN 'coder' THEN 2 WHEN 'inbox' THEN 3 ELSE 4 END, name ASC`
    ).all() as Record<string, unknown>[];
    return NextResponse.json(rows.map(parseAgent), {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'Content-Type': 'application/json',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (error) {
    console.error('GET /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, capabilities } = body;
    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO agents (id, name, capabilities, status)
      VALUES (?, ?, ?, 'idle')
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,
        capabilities=excluded.capabilities
    `).run(id, name,
      JSON.stringify(Array.isArray(capabilities) ? capabilities : []));
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseAgent(row), { status: 201 });
  } catch (error) {
    console.error('POST /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
