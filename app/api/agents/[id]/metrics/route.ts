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
    } catch { /* non-critical */ }

    // Recent activity count (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentActivity = (db.prepare(
      `SELECT COUNT(*) as count FROM task_activity WHERE agentId = ? AND timestamp >= ?`
    ).get(id, sevenDaysAgo) as { count: number }).count;

    // Average completion time for done tasks (ms)
    let avgCompletionMs: number | null = null;
    try {
      const completionRow = db.prepare(
        `SELECT AVG(completedAt - createdAt) as avg FROM tasks WHERE assignedTo = ? AND status = 'done' AND completedAt IS NOT NULL AND createdAt IS NOT NULL`
      ).get(id) as { avg: number | null };
      if (completionRow.avg) avgCompletionMs = Math.round(completionRow.avg);
    } catch { /* non-critical */ }

    // Last active (most recent task activity)
    const lastActivityRow = db.prepare(
      `SELECT MAX(timestamp) as last FROM task_activity WHERE agentId = ?`
    ).get(id) as { last: number | null };

    return NextResponse.json({
      agentId: id,
      tasksCompleted,
      tasksInProgress,
      tasksTotal,
      reviewsApproved,
      reviewsRejected,
      approvalRate,
      memoryNotes,
      recentActivity,
      avgCompletionMs,
      lastActive: lastActivityRow.last,
    });
  } catch (error) {
    console.error('GET /api/agents/[id]/metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
