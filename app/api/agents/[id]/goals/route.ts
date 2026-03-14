// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface GoalRow {
  id: string;
  agentId: string;
  title: string;
  target: string;
  current: string;
  deadline: string;
  status: string;
}

function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_goals (
      id       TEXT PRIMARY KEY,
      agentId  TEXT NOT NULL,
      title    TEXT NOT NULL,
      target   TEXT NOT NULL DEFAULT '',
      current  TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL DEFAULT '',
      status   TEXT NOT NULL DEFAULT 'active'
    )
  `);
}

function rowToGoal(row: GoalRow) {
  return {
    id:       row.id,
    title:    row.title,
    target:   row.target,
    current:  row.current,
    deadline: row.deadline,
    status:   row.status,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();
    ensureTable(db);

    const agentRow = db.prepare('SELECT id FROM agents WHERE id = ?').get(id) as { id: string } | undefined;
    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const rows = db.prepare(
      `SELECT * FROM agent_goals WHERE agentId = ? ORDER BY rowid ASC`
    ).all(id) as GoalRow[];

    return NextResponse.json({ goals: rows.map(rowToGoal) });
  } catch (error) {
    console.error('GET /api/agents/[id]/goals error:', error);
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
    ensureTable(db);

    const agentRow = db.prepare('SELECT id FROM agents WHERE id = ?').get(id) as { id: string } | undefined;
    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as { title?: string; target?: string; deadline?: string };

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const goalId   = randomUUID();
    const title    = body.title.trim().slice(0, 200);
    const target   = typeof body.target === 'string' ? body.target.trim().slice(0, 200) : '';
    const deadline = typeof body.deadline === 'string' ? body.deadline.trim().slice(0, 50) : '';

    db.prepare(
      `INSERT INTO agent_goals (id, agentId, title, target, current, deadline, status)
       VALUES (?, ?, ?, ?, '', ?, 'active')`
    ).run(goalId, id, title, target, deadline);

    const created = db.prepare('SELECT * FROM agent_goals WHERE id = ?').get(goalId) as GoalRow;
    return NextResponse.json(rowToGoal(created), { status: 201 });
  } catch (error) {
    console.error('POST /api/agents/[id]/goals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
