// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export const runtime = 'nodejs';

const PERIOD_MS: Record<string, number> = {
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

interface TaskRow {
  status: string;
  createdAt: number;
  completedAt: number | null;
}

interface ActivityRow {
  action: string;
  message: string;
}

interface TokenRow {
  totalTokens: number;
  totalCost: number;
}

function calcMetrics(tasks: TaskRow[]) {
  const done     = tasks.filter(t => t.status === 'done');
  const rejected = tasks.filter(t => t.status === 'failed');
  const total    = tasks.length;
  const tasksCompleted = done.length;
  const tasksRejected  = rejected.length;
  const successRate    = total > 0 ? Math.round((tasksCompleted / total) * 100) : 0;

  const durationSamples = done
    .filter(t => t.completedAt && t.createdAt)
    .map(t => (t.completedAt as number) - t.createdAt);
  const avgDurationMs = durationSamples.length > 0
    ? Math.round(durationSamples.reduce((s, v) => s + v, 0) / durationSamples.length)
    : 0;

  return { tasksCompleted, tasksRejected, successRate, avgDurationMs, total };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const body = await request.json().catch(() => ({})) as { period?: string };
    const period: string = ['7d', '30d', '90d'].includes(body.period ?? '') ? (body.period as string) : '30d';

    const db = getDb();

    // Verify agent exists
    const agentRow = db.prepare('SELECT id, name FROM agents WHERE id = ?').get(id) as { id: string; name: string } | undefined;
    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const periodMs = PERIOD_MS[period];
    const now = Date.now();
    const periodStart = now - periodMs;
    const priorStart  = periodStart - periodMs; // same length before current period

    // ── Current period tasks ──────────────────────────────────────────────
    const currentTasks = db.prepare(
      `SELECT status, createdAt, completedAt FROM tasks
       WHERE assignedTo = ? AND createdAt >= ? AND createdAt < ?`
    ).all(id, periodStart, now) as TaskRow[];

    // ── Prior period tasks (for trend) ──────────────────────────────────
    const priorTasks = db.prepare(
      `SELECT status, createdAt, completedAt FROM tasks
       WHERE assignedTo = ? AND createdAt >= ? AND createdAt < ?`
    ).all(id, priorStart, periodStart) as TaskRow[];

    const cur  = calcMetrics(currentTasks);
    const prev = calcMetrics(priorTasks);

    // ── Token / cost totals ───────────────────────────────────────────────
    const tokenRow = db.prepare(
      `SELECT
         COALESCE(SUM(inputTokens + outputTokens), 0) AS totalTokens,
         COALESCE(SUM(costUsd), 0)                    AS totalCost
       FROM token_usage WHERE agentId = ? AND timestamp >= ?`
    ).get(id, periodStart) as TokenRow;

    // ── Activity: rejection reasons ───────────────────────────────────────
    const rejectionActivity = db.prepare(
      `SELECT action, message FROM task_activity
       WHERE agentId = ? AND action = 'rejected' AND timestamp >= ?
       ORDER BY timestamp DESC LIMIT 100`
    ).all(id, periodStart) as ActivityRow[];

    // ── Trend calculation ─────────────────────────────────────────────────
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (prev.total > 0 && cur.total > 0) {
      const diff = cur.successRate - prev.successRate;
      if (diff >= 5)       trend = 'improving';
      else if (diff <= -5) trend = 'declining';
    } else if (cur.total > 0 && prev.total === 0) {
      trend = 'improving';
    }

    // ── Strengths ─────────────────────────────────────────────────────────
    const strengths: string[] = [];
    if (cur.successRate >= 90) strengths.push(`Excellent success rate (${cur.successRate}%)`);
    else if (cur.successRate >= 75) strengths.push(`Good success rate (${cur.successRate}%)`);
    if (cur.avgDurationMs > 0 && cur.avgDurationMs < 30 * 60 * 1000) strengths.push('Fast task execution');
    if (cur.tasksCompleted >= 10) strengths.push(`High output (${cur.tasksCompleted} tasks completed)`);
    if (tokenRow.totalCost < 0.5 && cur.tasksCompleted > 0) strengths.push('Low token cost per task');
    if (trend === 'improving') strengths.push('Trending upward vs prior period');
    if (strengths.length === 0 && cur.tasksCompleted > 0) strengths.push(`Completed ${cur.tasksCompleted} task${cur.tasksCompleted !== 1 ? 's' : ''} in period`);

    // ── Improvements ─────────────────────────────────────────────────────
    const improvements: string[] = [];
    if (cur.tasksRejected > 0) improvements.push(`${cur.tasksRejected} task${cur.tasksRejected !== 1 ? 's' : ''} rejected or failed`);
    if (cur.successRate < 60 && cur.total > 0) improvements.push('Success rate below 60% — review failure patterns');
    if (cur.avgDurationMs > 4 * 60 * 60 * 1000) improvements.push('High average task duration (>4h)');
    if (tokenRow.totalTokens > 1_000_000) improvements.push('High token consumption this period');
    if (trend === 'declining') improvements.push('Performance declining vs prior period');
    if (cur.total === 0) improvements.push('No tasks assigned in this period');

    // ── Recommendations ───────────────────────────────────────────────────
    const recommendations: string[] = [];
    if (cur.tasksRejected > 2) recommendations.push('Add more detailed planning notes before starting tasks');
    if (cur.successRate < 70 && cur.total > 0) recommendations.push('Break tasks into smaller, more focused units');
    if (tokenRow.totalTokens > 1_000_000) recommendations.push('Consider summarizing context before long tasks to reduce token usage');
    if (cur.avgDurationMs > 2 * 60 * 60 * 1000) recommendations.push('Review if tasks are scoped appropriately');
    if (trend === 'declining') recommendations.push('Review rejection activity logs for recurring patterns');
    if (recommendations.length === 0) recommendations.push('Keep up the current workflow — performance is healthy');

    // ── Skill gap analysis from rejection messages ────────────────────────
    const gapCounts: Record<string, number> = {};
    const PATTERNS: Array<[RegExp, string]> = [
      [/missing subtask/i,       'Missing subtasks'],
      [/no planning note/i,      'No planning notes'],
      [/too vague/i,             'Task too vague'],
      [/unclear requirement/i,   'Unclear requirements'],
      [/missing context/i,       'Missing context'],
      [/timed? ?out/i,           'Timeout'],
      [/token limit/i,           'Token limit exceeded'],
    ];
    for (const { message } of rejectionActivity) {
      for (const [re, label] of PATTERNS) {
        if (re.test(message)) {
          gapCounts[label] = (gapCounts[label] || 0) + 1;
          break;
        }
      }
    }
    const skillGaps = Object.entries(gapCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([pattern, count]) => ({ pattern, count }));

    // ── Score (0–100) ─────────────────────────────────────────────────────
    // Weighted: success rate (60%), output (20%), cost efficiency (10%), trend (10%)
    let score = 0;
    if (cur.total > 0) {
      const successComponent = cur.successRate * 0.6;
      const outputMax  = 20;
      const outputNorm = Math.min(cur.tasksCompleted / 10, 1) * outputMax;
      const costMax    = 10;
      const costNorm   = tokenRow.totalTokens === 0 ? costMax
        : Math.max(0, costMax - (tokenRow.totalCost / Math.max(cur.tasksCompleted, 1)) * 20);
      const trendBonus = trend === 'improving' ? 10 : trend === 'stable' ? 5 : 0;
      score = Math.round(Math.min(100, successComponent + outputNorm + costNorm + trendBonus));
    }

    return NextResponse.json({
      period,
      agentId: id,
      agentName: agentRow.name,
      metrics: {
        tasksCompleted: cur.tasksCompleted,
        tasksRejected:  cur.tasksRejected,
        successRate:    cur.successRate,
        avgDurationMs:  cur.avgDurationMs,
        totalTokens:    tokenRow.totalTokens,
        totalCostUsd:   tokenRow.totalCost,
      },
      trend,
      strengths,
      improvements,
      recommendations,
      skillGaps,
      score,
    });
  } catch (error) {
    console.error('POST /api/agents/[id]/review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
