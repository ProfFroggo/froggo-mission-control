// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

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
    const row = db
      .prepare('SELECT schedule FROM agent_schedules WHERE agentId = ?')
      .get(id) as { schedule: string } | undefined;

    let schedule: Record<string, unknown> = {};
    if (row?.schedule) {
      try {
        schedule = JSON.parse(row.schedule);
      } catch {
        schedule = {};
      }
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('GET /api/agents/[id]/schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const { schedule } = body as { schedule?: unknown };

    if (typeof schedule !== 'object' || schedule === null || Array.isArray(schedule)) {
      return NextResponse.json({ error: 'schedule must be an object' }, { status: 400 });
    }

    const scheduleJson = JSON.stringify(schedule);

    db.prepare(
      `INSERT INTO agent_schedules (agentId, schedule, updatedAt)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(agentId) DO UPDATE SET
         schedule = excluded.schedule,
         updatedAt = excluded.updatedAt`
    ).run(id, scheduleJson);

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('PATCH /api/agents/[id]/schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
