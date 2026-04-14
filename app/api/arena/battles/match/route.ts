// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { jsonResponse } from '@/lib/jsonResponse';
import { validateBattleTransition } from '@/lib/arena/battleStateMachine';
import type { BattleParticipant } from '@/types/arena';

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

/**
 * POST /api/arena/battles/match
 *
 * Find an existing battle in 'matching' status that fits the criteria,
 * or create a new one. Auto-transitions to 'active' when full.
 *
 * Body: { mode, stakeRange?: { min, max }, duration?, participantId, displayName? }
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { mode, stakeRange, duration, participantId, displayName } = body;

    if (!mode || !['1v1', 'tournament', 'free-for-all'].includes(mode)) {
      return NextResponse.json({ error: 'mode is required (1v1, tournament, free-for-all)' }, { status: 400 });
    }
    if (!participantId || typeof participantId !== 'string') {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const stakeMin = stakeRange?.min ?? 0;
    const stakeMax = stakeRange?.max ?? Number.MAX_SAFE_INTEGER;

    // Find an existing battle in 'matching' status that fits
    const candidates = db.prepare(`
      SELECT * FROM battles
      WHERE status = 'matching' AND mode = ? AND stakeAmount >= ? AND stakeAmount <= ?
      ORDER BY createdAt ASC
    `).all(mode, stakeMin, stakeMax) as Record<string, unknown>[];

    // Filter out battles where this participant already joined
    const match = candidates.find(b => {
      const participants: BattleParticipant[] = JSON.parse(b.participants as string || '[]');
      return !participants.some(p => p.id === participantId)
        && participants.length < (b.maxParticipants as number);
    });

    const now = Date.now();

    if (match) {
      // Join existing battle
      const participants: BattleParticipant[] = JSON.parse(match.participants as string || '[]');
      participants.push({ id: participantId, displayName: displayName || participantId, joinedAt: now });

      const isFull = participants.length >= (match.maxParticipants as number);

      if (isFull && validateBattleTransition('matching', 'active')) {
        db.prepare(`
          UPDATE battles SET participants = ?, status = 'active', startedAt = ?, updatedAt = ? WHERE id = ?
        `).run(JSON.stringify(participants), now, now, match.id);
      } else {
        db.prepare(`
          UPDATE battles SET participants = ?, updatedAt = ? WHERE id = ?
        `).run(JSON.stringify(participants), now, match.id);
      }

      const updated = db.prepare('SELECT * FROM battles WHERE id = ?').get(match.id) as Record<string, unknown>;
      return jsonResponse({ matched: true, ...parseBattle(updated) }, request);
    }

    // No match found — create a new battle in 'matching' status
    const id = `battle-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const participants: BattleParticipant[] = [{ id: participantId, displayName: displayName || participantId, joinedAt: now }];

    db.prepare(`
      INSERT INTO battles (id, mode, status, stakeAmount, stakeCurrency, duration, maxParticipants, createdBy, participants, metadata, createdAt, updatedAt)
      VALUES (?, ?, 'matching', ?, 'USDC', ?, ?, ?, ?, '{}', ?, ?)
    `).run(
      id,
      mode,
      stakeRange?.min ?? 0,
      duration ?? 300,
      mode === '1v1' ? 2 : 8,
      participantId,
      JSON.stringify(participants),
      now,
      now,
    );

    const battle = db.prepare('SELECT * FROM battles WHERE id = ?').get(id) as Record<string, unknown>;
    return jsonResponse({ matched: false, ...parseBattle(battle) }, request, { status: 201 });
  } catch (error) {
    console.error('POST /api/arena/battles/match error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
