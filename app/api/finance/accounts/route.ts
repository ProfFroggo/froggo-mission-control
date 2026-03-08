import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT a.id, a.name, a.role,
             COALESCE(SUM(t.costUsd), 0)        AS totalSpend,
             COALESCE(SUM(t.inputTokens), 0)    AS inputTokens,
             COALESCE(SUM(t.outputTokens), 0)   AS outputTokens,
             COUNT(t.id)                         AS txCount
      FROM agents a
      LEFT JOIN token_usage t ON t.agentId = a.id
      GROUP BY a.id
      ORDER BY totalSpend DESC
    `).all() as Record<string, unknown>[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/finance/accounts error:', error);
    return NextResponse.json([]);
  }
}
