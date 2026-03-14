// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/budgets  — list all budgets with current spend + status
// POST /api/budgets — create a new budget

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BudgetRow {
  id: string;
  name: string;
  agentId: string | null;
  period: string;
  limitUsd: number;
  alertAt: number;
  createdAt: number;
}

type Period = 'daily' | 'weekly' | 'monthly';

// ── Period helpers ─────────────────────────────────────────────────────────────

function periodStartMs(period: Period): number {
  const now = new Date();
  switch (period) {
    case 'daily': {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    case 'weekly': {
      const day = now.getDay();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
    }
    case 'monthly': {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
  }
}

export function calculatePeriodSpend(
  db: ReturnType<typeof getDb>,
  budget: BudgetRow
): number {
  const since = periodStartMs(budget.period as Period);
  const agentFilter = budget.agentId ? 'AND agentId = ?' : '';
  const args: unknown[] = budget.agentId ? [since, budget.agentId] : [since];

  const row = db.prepare(
    `SELECT COALESCE(SUM(costUsd), 0) AS spend FROM token_usage WHERE timestamp >= ? ${agentFilter}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).get(...(args as any[])) as { spend: number };

  return row?.spend ?? 0;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM budgets ORDER BY createdAt ASC').all() as BudgetRow[];

    const budgets = rows.map(row => {
      const currentUsd = calculatePeriodSpend(db, row);
      const pct = row.limitUsd > 0 ? (currentUsd / row.limitUsd) * 100 : 0;
      const status: 'ok' | 'warning' | 'exceeded' =
        pct >= 100 ? 'exceeded' : pct >= row.alertAt ? 'warning' : 'ok';

      return {
        id: row.id,
        name: row.name,
        agentId: row.agentId ?? undefined,
        period: row.period as Period,
        limitUsd: row.limitUsd,
        alertAt: row.alertAt,
        currentUsd,
        status,
        createdAt: row.createdAt,
      };
    });

    return NextResponse.json(budgets);
  } catch (err) {
    console.error('GET /api/budgets error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name: string;
      agentId?: string;
      period: Period;
      limitUsd: number;
      alertAt?: number;
    };

    const { name, agentId, period, limitUsd, alertAt = 80 } = body;

    if (!name || !period || !limitUsd) {
      return NextResponse.json(
        { error: 'name, period, and limitUsd are required' },
        { status: 400 }
      );
    }

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json({ error: 'period must be daily, weekly, or monthly' }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();
    const now = Date.now();

    db.prepare(
      `INSERT INTO budgets (id, name, agentId, period, limitUsd, alertAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, agentId ?? null, period, limitUsd, alertAt, now);

    const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as BudgetRow;
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
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/budgets error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
