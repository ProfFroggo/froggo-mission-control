// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/token-usage?agentId=&days=30
// Returns: { totalTokens, totalCost, byAgent, byDay }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.max(1, parseInt(searchParams.get('days') || '30', 10));
  const agentId = searchParams.get('agentId') || null;

  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    const db = getDb();

    const agentFilter = agentId ? 'AND agentId = ?' : '';
    const agentArgs   = agentId ? [since, agentId] : [since];

    // Per-agent summary
    const byAgent = db.prepare(`
      SELECT
        agentId,
        SUM(inputTokens)           AS tokens,
        SUM(outputTokens)          AS outputTokens,
        SUM(inputTokens)           AS inputTokens,
        SUM(costUsd)               AS cost,
        COUNT(*)                   AS taskCount
      FROM token_usage
      WHERE timestamp >= ? ${agentFilter}
      GROUP BY agentId
      ORDER BY tokens DESC
    `).all(...agentArgs) as Array<{
      agentId: string;
      tokens: number;
      outputTokens: number;
      inputTokens: number;
      cost: number;
      taskCount: number;
    }>;

    // Total summary
    const totals = db.prepare(`
      SELECT
        SUM(inputTokens + outputTokens) AS totalTokens,
        SUM(costUsd)                    AS totalCost
      FROM token_usage
      WHERE timestamp >= ? ${agentFilter}
    `).get(...agentArgs) as { totalTokens: number | null; totalCost: number | null } | undefined;

    // Per-day totals for sparkline
    const byDay = db.prepare(`
      SELECT
        strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') AS date,
        SUM(inputTokens + outputTokens)                      AS tokens,
        SUM(costUsd)                                         AS cost
      FROM token_usage
      WHERE timestamp >= ? ${agentFilter}
      GROUP BY date
      ORDER BY date ASC
    `).all(...agentArgs) as Array<{ date: string; tokens: number; cost: number }>;

    return NextResponse.json({
      days,
      agentId: agentId ?? undefined,
      totalTokens: totals?.totalTokens ?? 0,
      totalCost:   totals?.totalCost   ?? 0,
      byAgent: byAgent.map(r => ({
        agentId:    r.agentId,
        tokens:     r.tokens     ?? 0,
        inputTokens: r.inputTokens ?? 0,
        outputTokens: r.outputTokens ?? 0,
        cost:       r.cost       ?? 0,
        taskCount:  r.taskCount  ?? 0,
      })),
      byDay: byDay.map(r => ({
        date:   r.date,
        tokens: r.tokens ?? 0,
        cost:   r.cost   ?? 0,
      })),
    });
  } catch (err) {
    console.error('GET /api/token-usage error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
