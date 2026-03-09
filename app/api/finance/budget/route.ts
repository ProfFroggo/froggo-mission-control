// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();

    // Active budgets from finance_budgets table
    const budgets = db.prepare(
      `SELECT id, category, limit_amt, spent, period, active, createdAt, updatedAt
       FROM finance_budgets
       WHERE active = 1
       ORDER BY limit_amt DESC`
    ).all() as { id: string; category: string; limit_amt: number; spent: number; period: string; active: number; createdAt: number; updatedAt: number }[];

    const totalLimit = budgets.reduce((sum, b) => sum + b.limit_amt, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

    return NextResponse.json({
      total:     totalLimit,
      spent:     totalSpent,
      remaining: Math.max(0, totalLimit - totalSpent),
      categories: budgets.map(b => ({
        id:       b.id,
        name:     b.category,
        amount:   b.limit_amt,
        spent:    b.spent,
        period:   b.period,
      })),
    });
  } catch (error) {
    console.error('GET /api/finance/budget error:', error);
    return NextResponse.json({ total: 0, spent: 0, remaining: 0, categories: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { category, limit_amt, period } = await request.json();
    if (!category || typeof category !== 'string' || category.length > 100) {
      return NextResponse.json({ error: 'category is required (max 100 chars)' }, { status: 400 });
    }
    if (typeof limit_amt !== 'number' || limit_amt < 0) {
      return NextResponse.json({ error: 'limit_amt must be a non-negative number' }, { status: 400 });
    }
    const validPeriods = ['weekly', 'monthly', 'quarterly', 'yearly'];
    const resolvedPeriod = period && validPeriods.includes(period) ? period : 'monthly';
    const id = crypto.randomUUID();
    const now = Date.now();
    getDb().prepare(
      `INSERT INTO finance_budgets (id, category, limit_amt, spent, period, active, createdAt, updatedAt)
       VALUES (?, ?, ?, 0, ?, 1, ?, ?)`
    ).run(id, category, limit_amt, resolvedPeriod, now, now);
    const created = getDb().prepare('SELECT * FROM finance_budgets WHERE id = ?').get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM finance_budgets WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }
    const body = await request.json();
    const allowedFields = ['category', 'limit_amt', 'spent', 'period', 'active'] as const;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const field of allowedFields) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    setClauses.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);
    db.prepare(`UPDATE finance_budgets SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM finance_budgets WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/finance/budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }
    const result = getDb().prepare('DELETE FROM finance_budgets WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
