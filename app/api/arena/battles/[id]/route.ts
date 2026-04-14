// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { jsonResponse } from '@/lib/jsonResponse';
import { validateBattleTransition } from '@/lib/arena/battleStateMachine';
import type { BattleStatus, BattleParticipant } from '@/types/arena';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDb();
    const { id } = await params;

    const battle = db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    const positions = db.prepare(
      'SELECT * FROM paper_positions WHERE battleId = ? ORDER BY openedAt DESC'
    ).all(id);

    const parsed = parseBattle(battle);
    return jsonResponse({ ...parsed, positions }, request);
  } catch (error) {
    console.error('GET /api/arena/battles/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const battle = db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    // Status transition with state machine validation
    if (body.status) {
      const from = battle.status as BattleStatus;
      const to = body.status as BattleStatus;
      if (!validateBattleTransition(from, to)) {
        return NextResponse.json(
          { error: `Invalid transition: ${from} → ${to}` },
          { status: 400 },
        );
      }
      updates.push('status = ?');
      values.push(to);

      if (to === 'active') { updates.push('startedAt = ?'); values.push(Date.now()); }
      if (to === 'settling') { updates.push('endedAt = ?'); values.push(Date.now()); }
      if (to === 'settled' || to === 'resolved') { updates.push('settledAt = ?'); values.push(Date.now()); }
    }

    // Add participant
    if (body.addParticipant) {
      const currentParticipants: BattleParticipant[] = JSON.parse(battle.participants as string || '[]');
      const alreadyJoined = currentParticipants.some(p => p.id === body.addParticipant.id);
      if (alreadyJoined) {
        return NextResponse.json({ error: 'Participant already in battle' }, { status: 400 });
      }
      if (currentParticipants.length >= (battle.maxParticipants as number)) {
        return NextResponse.json({ error: 'Battle is full' }, { status: 400 });
      }
      currentParticipants.push({
        id: body.addParticipant.id,
        displayName: body.addParticipant.displayName || body.addParticipant.id,
        joinedAt: Date.now(),
      });
      updates.push('participants = ?');
      values.push(JSON.stringify(currentParticipants));
    }

    if (body.winnerId !== undefined) { updates.push('winnerId = ?'); values.push(body.winnerId); }
    if (body.metadata !== undefined) { updates.push('metadata = ?'); values.push(JSON.stringify(body.metadata)); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE battles SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as Record<string, unknown>;
    return jsonResponse(parseBattle(updated), request);
  } catch (error) {
    console.error('PATCH /api/arena/battles/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
