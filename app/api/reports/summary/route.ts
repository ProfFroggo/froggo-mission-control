// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/reports/summary?from=ISO&to=ISO
// Returns an executive summary for the period (default: last 7 days)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const toMs = toParam ? new Date(toParam).getTime() : Date.now();
  const fromMs = fromParam ? new Date(fromParam).getTime() : toMs - 7 * 24 * 60 * 60 * 1000;
  const periodDays = Math.max(1, Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000)));

  // Prior period for velocity comparison
  const priorFromMs = fromMs - (toMs - fromMs);
  const priorToMs = fromMs;

  try {
    const db = getDb();

    // ── Tasks ──────────────────────────────────────────────────────────
    const taskStats = db.prepare(`
      SELECT
        COUNT(*)                                                              AS created,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)                     AS completed,
        SUM(CASE WHEN status IN ('todo','in-progress','internal-review') THEN 1 ELSE 0 END) AS failed
      FROM tasks
      WHERE createdAt >= ? AND createdAt <= ?
    `).get(fromMs, toMs) as { created: number; completed: number; failed: number } | undefined;

    const priorCompleted = (db.prepare(`
      SELECT COUNT(*) AS cnt FROM tasks
      WHERE status = 'done' AND createdAt >= ? AND createdAt <= ?
    `).get(priorFromMs, priorToMs) as { cnt: number } | undefined)?.cnt ?? 0;

    const currentCompleted = taskStats?.completed ?? 0;
    const velocity = periodDays > 0 ? Math.round((currentCompleted / periodDays) * 10) / 10 : 0;

    // ── Agents ─────────────────────────────────────────────────────────
    const agentRows = db.prepare(`
      SELECT
        a.id,
        a.name,
        a.status,
        COUNT(t.id) AS totalTasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS doneTasks,
        ROUND(100.0 * SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.id), 0), 1) AS successRate
      FROM agents a
      LEFT JOIN tasks t ON t.assignedTo = a.id AND t.createdAt >= ? AND t.createdAt <= ?
      GROUP BY a.id
    `).all(fromMs, toMs) as Array<{
      id: string; name: string; status: string;
      totalTasks: number; doneTasks: number; successRate: number | null;
    }>;

    const activeAgents = agentRows.filter(a => a.status === 'online').length;
    const mostProductiveAgent = agentRows.sort((a, b) => (b.doneTasks ?? 0) - (a.doneTasks ?? 0))[0];
    const avgSuccessRate = agentRows.length > 0
      ? Math.round(agentRows.reduce((s, a) => s + (a.successRate ?? 0), 0) / agentRows.length)
      : 0;

    // ── Approvals ──────────────────────────────────────────────────────
    const approvalStats = db.prepare(`
      SELECT
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)      AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END)      AS rejected,
        ROUND(AVG(CASE WHEN respondedAt IS NOT NULL THEN (respondedAt - createdAt) END) / 3600000.0, 1) AS avgResponseHours
      FROM approvals
      WHERE createdAt >= ? AND createdAt <= ?
    `).get(fromMs, toMs) as {
      total: number; approved: number; rejected: number; avgResponseHours: number | null;
    } | undefined;

    // ── Tokens ─────────────────────────────────────────────────────────
    const tokenStats = db.prepare(`
      SELECT
        SUM(inputTokens + outputTokens) AS total,
        ROUND(SUM(costUsd), 4)          AS cost
      FROM token_usage
      WHERE timestamp >= ? AND timestamp <= ?
    `).get(fromMs, toMs) as { total: number | null; cost: number | null } | undefined;

    const topTokenConsumer = db.prepare(`
      SELECT
        tu.agentId,
        a.name,
        SUM(tu.inputTokens + tu.outputTokens) AS tokens
      FROM token_usage tu
      LEFT JOIN agents a ON a.id = tu.agentId
      WHERE tu.timestamp >= ? AND tu.timestamp <= ?
      GROUP BY tu.agentId
      ORDER BY tokens DESC
      LIMIT 1
    `).get(fromMs, toMs) as { agentId: string; name: string | null; tokens: number } | undefined;

    // ── Highlights ─────────────────────────────────────────────────────
    const highlights: string[] = [];

    // Velocity vs prior period
    if (priorCompleted > 0) {
      const velocityChange = Math.round(((currentCompleted - priorCompleted) / priorCompleted) * 100);
      if (velocityChange > 0) {
        highlights.push(`Task velocity improved ${velocityChange}% vs prior period`);
      } else if (velocityChange < 0) {
        highlights.push(`Task velocity declined ${Math.abs(velocityChange)}% vs prior period`);
      } else {
        highlights.push(`Task velocity held steady vs prior period`);
      }
    } else if (currentCompleted > 0) {
      highlights.push(`${currentCompleted} tasks completed this period`);
    }

    if (mostProductiveAgent && mostProductiveAgent.doneTasks > 0) {
      highlights.push(`${mostProductiveAgent.name} was the most productive agent with ${mostProductiveAgent.doneTasks} tasks completed`);
    }

    if (approvalStats && approvalStats.total > 0) {
      const approvalRate = Math.round((approvalStats.approved / approvalStats.total) * 100);
      highlights.push(`${approvalRate}% approval rate across ${approvalStats.total} approval requests`);
    }

    if (tokenStats?.cost && tokenStats.cost > 0) {
      highlights.push(`Total token spend: $${tokenStats.cost.toFixed(4)}`);
    }

    if (highlights.length === 0) {
      highlights.push('No significant activity in this period');
    }

    return NextResponse.json({
      period: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        days: periodDays,
      },
      tasks: {
        created: taskStats?.created ?? 0,
        completed: currentCompleted,
        failed: taskStats?.failed ?? 0,
        velocity,
      },
      agents: {
        active: activeAgents,
        total: agentRows.length,
        mostProductive: mostProductiveAgent
          ? { name: mostProductiveAgent.name, completed: mostProductiveAgent.doneTasks }
          : null,
        avgSuccessRate,
      },
      approvals: {
        total: approvalStats?.total ?? 0,
        approved: approvalStats?.approved ?? 0,
        rejected: approvalStats?.rejected ?? 0,
        avgResponseHours: approvalStats?.avgResponseHours ?? null,
      },
      tokens: {
        total: tokenStats?.total ?? 0,
        cost: tokenStats?.cost ?? 0,
        topConsumer: topTokenConsumer
          ? { name: topTokenConsumer.name ?? topTokenConsumer.agentId, tokens: topTokenConsumer.tokens }
          : null,
      },
      highlights,
    });
  } catch (err) {
    console.error('GET /api/reports/summary error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
