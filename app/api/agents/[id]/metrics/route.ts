// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { getDb } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

export const runtime = 'nodejs';

const HOME = homedir();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();

    // Verify agent exists — return 404 for unknown IDs
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Task completion stats
    const tasksCompleted = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND status = 'done'`
    ).get(id) as { count: number }).count;

    const tasksInProgress = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND status = 'in-progress'`
    ).get(id) as { count: number }).count;

    const tasksTotal = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ?`
    ).get(id) as { count: number }).count;

    // Completion rate (0-1 decimal)
    const completionRate = tasksTotal > 0
      ? Math.round((tasksCompleted / tasksTotal) * 1000) / 1000
      : null;

    // Tasks in review status
    const reviewCount = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND status = 'review'`
    ).get(id) as { count: number }).count;

    // P1 tasks completed
    const p1TasksCompleted = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND status = 'done' AND priority = 'p1'`
    ).get(id) as { count: number }).count;

    // Clara review stats for this agent
    const reviewsApproved = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND reviewStatus = 'approved'`
    ).get(id) as { count: number }).count;

    const reviewsRejected = (db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE assignedTo = ? AND reviewStatus = 'rejected'`
    ).get(id) as { count: number }).count;

    const approvalRate = (reviewsApproved + reviewsRejected) > 0
      ? Math.round((reviewsApproved / (reviewsApproved + reviewsRejected)) * 100)
      : null;

    // Memory write count from agent memory folder
    let memoryNotes = 0;
    try {
      const agentMemDir = path.join(HOME, 'mission-control', 'memory', 'agents', id);
      if (fs.existsSync(agentMemDir)) {
        memoryNotes = fs.readdirSync(agentMemDir)
          .filter(f => f.endsWith('.md') && !f.startsWith('_')).length;
      }
    } catch (err) { console.warn('[agents/[id]/metrics] Non-critical:', err); }

    // Recent activity count (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentActivity = (db.prepare(
      `SELECT COUNT(*) as count FROM task_activity WHERE agentId = ? AND timestamp >= ?`
    ).get(id, sevenDaysAgo) as { count: number }).count;

    // Recent activity entries (last 5)
    const recentActivityEntries = db.prepare(
      `SELECT taskId, action, message, timestamp FROM task_activity WHERE agentId = ? ORDER BY timestamp DESC LIMIT 5`
    ).all(id) as Array<{ taskId: string; action: string; message: string; timestamp: number }>;

    // Average completion time for done tasks (ms)
    let avgCompletionMs: number | null = null;
    try {
      const completionRow = db.prepare(
        `SELECT AVG(completedAt - createdAt) as avg FROM tasks WHERE assignedTo = ? AND status = 'done' AND completedAt IS NOT NULL AND createdAt IS NOT NULL`
      ).get(id) as { avg: number | null };
      if (completionRow.avg) avgCompletionMs = Math.round(completionRow.avg);
    } catch (err) { console.warn('[agents/[id]/metrics] Non-critical:', err); }

    // Last active (most recent task activity)
    const lastActivityRow = db.prepare(
      `SELECT MAX(timestamp) as last FROM task_activity WHERE agentId = ?`
    ).get(id) as { last: number | null };

    // Token usage stats (lifetime + last 30 days)
    const tokenLifetime = db.prepare(
      `SELECT COALESCE(SUM(inputTokens), 0) as totalInput,
              COALESCE(SUM(outputTokens), 0) as totalOutput,
              ROUND(COALESCE(SUM(costUsd), 0), 4) as totalCost
       FROM token_usage WHERE agentId = ?`
    ).get(id) as { totalInput: number; totalOutput: number; totalCost: number };

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const tokenRecent = db.prepare(
      `SELECT ROUND(COALESCE(SUM(costUsd), 0), 4) as cost
       FROM token_usage WHERE agentId = ? AND timestamp >= ?`
    ).get(id, thirtyDaysAgo) as { cost: number };

    return NextResponse.json({
      agentId: id,
      tasksCompleted,
      tasksInProgress,
      tasksTotal,
      completionRate,
      reviewCount,
      p1TasksCompleted,
      reviewsApproved,
      reviewsRejected,
      approvalRate,
      memoryNotes,
      recentActivity,
      recentActivityEntries,
      avgCompletionMs,
      lastActive: lastActivityRow.last,
      tokenUsage: {
        totalInputTokens: tokenLifetime.totalInput,
        totalOutputTokens: tokenLifetime.totalOutput,
        totalCostUsd: tokenLifetime.totalCost,
        last30DaysCostUsd: tokenRecent.cost,
      },
    });
  } catch (error) {
    console.error('GET /api/agents/[id]/metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
