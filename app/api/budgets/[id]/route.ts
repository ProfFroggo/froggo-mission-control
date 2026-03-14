// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// PATCH /api/budgets/[id] — update budget fields
// DELETE /api/budgets/[id] — delete a budget

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { calculatePeriodSpend } from '../route';

export const dynamic = 'force-dynamic';

// ── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as Record<string, unknown>;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    const allowed = ['name', 'agentId', 'period', 'limitUsd', 'alertAt'] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        vals.push(body[key] ?? null);
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    vals.push(id);
    db.prepare(`UPDATE budgets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

    const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as {
      id: string; name: string; agentId: string | null; period: string; limitUsd: number; alertAt: number; createdAt: number;
    };
    const currentUsd = calculatePeriodSpend(db, row);
    const pct = row.limitUsd > 0 ? (currentUsd / row.limitUsd) * 100 : 0;
    const status: 'ok' | 'warning' | 'exceeded' =
      pct >= 100 ? 'exceeded' : pct >= row.alertAt ? 'warning' : 'ok';

    return NextResponse.json({
      id: row.id,
      name: row.name,
      agentId: row.agentId ?? undefined,
      period: row.period,
      limitUsd: row.limitUsd,
      alertAt: row.alertAt,
      currentUsd,
      status,
      createdAt: row.createdAt,
    });
  } catch (err) {
    console.error('PATCH /api/budgets/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM budgets WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/budgets/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
