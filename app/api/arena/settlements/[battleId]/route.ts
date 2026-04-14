// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { jsonResponse } from '@/lib/jsonResponse';

/**
 * GET /api/arena/settlements/[battleId]
 *
 * Returns settlement records for a specific battle.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> },
) {
  try {
    const db = getDb();
    const { battleId } = await params;

    const battle = db.prepare('SELECT id FROM battles WHERE id = ?').get(battleId);
    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    const settlements = db.prepare(
      'SELECT * FROM arena_settlements WHERE battleId = ? ORDER BY settledAt DESC'
    ).all(battleId);

    return jsonResponse(settlements, request);
  } catch (error) {
    console.error('GET /api/arena/settlements/[battleId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
