// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

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

const VALID_GOAL_ID = /^[0-9a-f-]{36}$/;

function validateGoalId(goalId: unknown): NextResponse | null {
  if (typeof goalId !== 'string' || !VALID_GOAL_ID.test(goalId)) {
    return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 });
  }
  return null;
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

// PATCH /api/agents/[id]/goals/[goalId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  try {
    const { id, goalId } = await params;

    const agentGuard = validateAgentId(id);
    if (agentGuard) return agentGuard;

    const goalGuard = validateGoalId(goalId);
    if (goalGuard) return goalGuard;

    const db = getDb();

    const existing = db.prepare(
      'SELECT * FROM agent_goals WHERE id = ? AND agentId = ?'
    ).get(goalId, id) as GoalRow | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as { current?: string; status?: string };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (typeof body.current === 'string') {
      setClauses.push('current = ?');
      values.push(body.current.trim().slice(0, 200));
    }

    const VALID_STATUSES = ['active', 'completed', 'cancelled', 'paused'];
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) {
      setClauses.push('status = ?');
      values.push(body.status);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(goalId, id);
    db.prepare(
      `UPDATE agent_goals SET ${setClauses.join(', ')} WHERE id = ? AND agentId = ?`
    ).run(...values);

    const updated = db.prepare('SELECT * FROM agent_goals WHERE id = ?').get(goalId) as GoalRow;
    return NextResponse.json(rowToGoal(updated));
  } catch (error) {
    console.error('PATCH /api/agents/[id]/goals/[goalId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/agents/[id]/goals/[goalId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; goalId: string }> }
) {
  try {
    const { id, goalId } = await params;

    const agentGuard = validateAgentId(id);
    if (agentGuard) return agentGuard;

    const goalGuard = validateGoalId(goalId);
    if (goalGuard) return goalGuard;

    const db = getDb();

    const result = db.prepare(
      'DELETE FROM agent_goals WHERE id = ? AND agentId = ?'
    ).run(goalId, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/agents/[id]/goals/[goalId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
