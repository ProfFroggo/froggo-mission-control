// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();
    const history = db
      .prepare(
        `SELECT id, agentId, status, reason, changedAt
         FROM agent_status_history
         WHERE agentId = ?
         ORDER BY changedAt DESC
         LIMIT 50`
      )
      .all(id);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('GET /api/agents/[id]/status-history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();

    // Ensure agent exists
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, reason } = body as { status?: unknown; reason?: unknown };

    if (typeof status !== 'string' || status.trim().length === 0) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const entryId = randomUUID();
    db.prepare(
      `INSERT INTO agent_status_history (id, agentId, status, reason)
       VALUES (?, ?, ?, ?)`
    ).run(entryId, id, status.trim(), typeof reason === 'string' ? reason.trim() : null);

    const entry = db
      .prepare('SELECT * FROM agent_status_history WHERE id = ?')
      .get(entryId);

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('POST /api/agents/[id]/status-history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
