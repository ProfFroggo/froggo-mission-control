// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7', 10);
  const agentId = searchParams.get('agentId') || null;

  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    const db = getDb();

    // Per-agent summary
    const agentFilter = agentId ? 'AND agentId = ?' : '';
    const agentArgs   = agentId ? [since, agentId] : [since];

    const perAgent = db.prepare(`
      SELECT agentId,
             SUM(inputTokens)  AS totalInput,
             SUM(outputTokens) AS totalOutput,
             SUM(costUsd)      AS totalCost,
             COUNT(*)          AS invocations
      FROM token_usage
      WHERE timestamp >= ? ${agentFilter}
      GROUP BY agentId
      ORDER BY totalCost DESC
    `).all(...agentArgs);

    // Total summary
    const totals = db.prepare(`
      SELECT SUM(inputTokens)  AS totalInput,
             SUM(outputTokens) AS totalOutput,
             SUM(costUsd)      AS totalCost,
             COUNT(*)          AS invocations
      FROM token_usage
      WHERE timestamp >= ?
    `).get(since) as { totalInput: number; totalOutput: number; totalCost: number; invocations: number } | undefined;

    // Per-day totals for chart
    const dailyTotals = db.prepare(`
      SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') AS date,
             SUM(inputTokens + outputTokens) AS tokens,
             SUM(costUsd)                    AS cost
      FROM token_usage
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date
    `).all(since);

    return NextResponse.json({
      days,
      totals: totals || { totalInput: 0, totalOutput: 0, totalCost: 0, invocations: 0 },
      perAgent,
      dailyTotals,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
