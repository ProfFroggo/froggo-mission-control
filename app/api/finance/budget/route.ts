import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();

    const budgetRow = db.prepare("SELECT value FROM settings WHERE key = 'finance_budget_usd'").get() as { value: string } | undefined;
    const budget = budgetRow ? parseFloat(budgetRow.value) : 500;

    const spendRow = db.prepare("SELECT COALESCE(SUM(costUsd), 0) AS total FROM token_usage").get() as { total: number };
    const spent = spendRow.total ?? 0;

    const byAgent = db.prepare(`
      SELECT agentId, COALESCE(SUM(costUsd), 0) AS spend
      FROM token_usage GROUP BY agentId ORDER BY spend DESC
    `).all() as { agentId: string; spend: number }[];

    return NextResponse.json({
      total:     budget,
      spent,
      remaining: Math.max(0, budget - spent),
      categories: byAgent.map(r => ({ name: r.agentId, amount: r.spend })),
    });
  } catch (error) {
    console.error('GET /api/finance/budget error:', error);
    return NextResponse.json({ total: 0, spent: 0, remaining: 0, categories: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { limit } = await request.json();
    if (typeof limit !== 'number' || limit < 0) {
      return NextResponse.json({ error: 'limit must be a non-negative number' }, { status: 400 });
    }
    getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('finance_budget_usd', ?)").run(String(limit));
    return NextResponse.json({ ok: true, limit });
  } catch (error) {
    console.error('PATCH /api/finance/budget error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
