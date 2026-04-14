// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { jsonResponse } from '@/lib/jsonResponse';

function parseBattle(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of ['participants', 'metadata']) {
    if (typeof parsed[field] === 'string') {
      try { parsed[field] = JSON.parse(parsed[field] as string); }
      catch { parsed[field] = field === 'participants' ? [] : {}; }
    }
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
    if (status) { conditions.push('status = ?'); values.push(status); }

    const mode = searchParams.get('mode');
    if (mode) { conditions.push('mode = ?'); values.push(mode); }

    const createdBy = searchParams.get('createdBy');
    if (createdBy) { conditions.push('createdBy = ?'); values.push(createdBy); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rawLimit = searchParams.get('limit');
    const rawOffset = searchParams.get('offset');
    const limit = Math.min(Math.max(1, rawLimit ? parseInt(rawLimit, 10) || 50 : 50), 200);
    const offset = Math.max(0, rawOffset ? parseInt(rawOffset, 10) || 0 : 0);

    const rows = db.prepare(
      `SELECT * FROM battles ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    ).all(...values, limit, offset) as Record<string, unknown>[];

    const { count: totalCount } = db.prepare(
      `SELECT COUNT(*) as count FROM battles ${where}`
    ).get(...values) as { count: number };

    return jsonResponse(rows.map(parseBattle), request, {
      headers: {
        'X-Total-Count': String(totalCount),
        'X-Limit': String(limit),
        'X-Offset': String(offset),
      },
    });
  } catch (error) {
    console.error('GET /api/arena/battles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { mode, stakeAmount, stakeCurrency, duration, maxParticipants, createdBy, metadata } = body;

    if (!mode || !['1v1', 'tournament', 'free-for-all'].includes(mode)) {
      return NextResponse.json({ error: 'mode is required and must be 1v1, tournament, or free-for-all' }, { status: 400 });
    }
    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return NextResponse.json({ error: 'duration is required and must be a positive number (seconds)' }, { status: 400 });
    }
    if (!createdBy || typeof createdBy !== 'string') {
      return NextResponse.json({ error: 'createdBy is required' }, { status: 400 });
    }

    const id = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO battles (id, mode, status, stakeAmount, stakeCurrency, duration, maxParticipants, createdBy, participants, metadata, createdAt, updatedAt)
      VALUES (?, ?, 'created', ?, ?, ?, ?, ?, '[]', ?, ?, ?)
    `).run(
      id,
      mode,
      stakeAmount ?? 0,
      stakeCurrency ?? 'USDC',
      duration,
      maxParticipants ?? (mode === '1v1' ? 2 : 8),
      createdBy,
      JSON.stringify(metadata ?? {}),
      now,
      now,
    );

    const battle = db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as Record<string, unknown>;
    return jsonResponse(parseBattle(battle), request, { status: 201 });
  } catch (error) {
    console.error('POST /api/arena/battles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
