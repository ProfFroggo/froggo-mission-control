// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

interface RejectionReasonRow {
  reason: string;
  count: number;
}

interface AgentRejectionRow {
  agentId: string;
  rejectionCount: number;
}

interface AgentRow {
  name: string;
}

interface LogCountRow {
  count: number;
}

interface AvgTimeRow {
  avg: number | null;
}

interface PendingRow {
  count: number;
}

export async function GET() {
  try {
    const db = getDb();
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartStr = todayStart.toISOString().slice(0, 10);

    // Pending review count
    const pendingRow = db.prepare(
      `SELECT COUNT(*) as count FROM tasks WHERE status = 'internal-review'`
    ).get() as PendingRow;
    const pendingReview = pendingRow.count;

    // Approved today
    const approvedTodayRow = db.prepare(`
      SELECT COUNT(*) as count FROM clara_review_log
      WHERE decision = 'approved' AND reviewedAt >= ?
    `).get(todayStartStr) as LogCountRow | undefined;
    const approvedToday = approvedTodayRow?.count ?? 0;

    // Rejected today
    const rejectedTodayRow = db.prepare(`
      SELECT COUNT(*) as count FROM clara_review_log
      WHERE decision = 'rejected' AND reviewedAt >= ?
    `).get(todayStartStr) as LogCountRow | undefined;
    const rejectedToday = rejectedTodayRow?.count ?? 0;

    // Approval rate last 30 days
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const totalLast30Row = db.prepare(`
      SELECT COUNT(*) as count FROM clara_review_log
      WHERE reviewedAt >= ?
    `).get(thirtyDaysAgo) as LogCountRow | undefined;
    const approvedLast30Row = db.prepare(`
      SELECT COUNT(*) as count FROM clara_review_log
      WHERE decision = 'approved' AND reviewedAt >= ?
    `).get(thirtyDaysAgo) as LogCountRow | undefined;
    const totalLast30 = totalLast30Row?.count ?? 0;
    const approvedLast30 = approvedLast30Row?.count ?? 0;
    const approvalRate = totalLast30 > 0 ? Math.round((approvedLast30 / totalLast30) * 100) : 0;

    // Average review time in minutes (all time)
    const avgTimeRow = db.prepare(`
      SELECT AVG(timeInReviewMinutes) as avg FROM clara_review_log
      WHERE timeInReviewMinutes IS NOT NULL
    `).get() as AvgTimeRow | undefined;
    const avgReviewMinutes = avgTimeRow?.avg != null ? Math.round(avgTimeRow.avg) : 0;

    // Top rejection reasons (last 30 days)
    const rejectionRows = db.prepare(`
      SELECT reason, COUNT(*) as count
      FROM clara_review_log
      WHERE decision = 'rejected' AND reason IS NOT NULL AND reviewedAt >= ?
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 5
    `).all(thirtyDaysAgo) as RejectionReasonRow[];

    const topRejectionReasons = rejectionRows.map(r => ({
      reason: (r.reason ?? '').slice(0, 120),
      count: r.count,
    }));

    // Agents with > 2 rejections in last 7 days
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const agentRejectionRows = db.prepare(`
      SELECT t.assignedTo as agentId, COUNT(*) as rejectionCount
      FROM clara_review_log l
      JOIN tasks t ON t.id = l.taskId
      WHERE l.decision = 'rejected' AND l.reviewedAt >= ? AND t.assignedTo IS NOT NULL
      GROUP BY t.assignedTo
      HAVING COUNT(*) > 2
      ORDER BY rejectionCount DESC
      LIMIT 10
    `).all(sevenDaysAgo) as AgentRejectionRow[];

    const agentsNeedingSupport = agentRejectionRows.map(row => {
      let name = row.agentId;
      try {
        const agentRow = db.prepare('SELECT name FROM agents WHERE id = ?').get(row.agentId) as AgentRow | undefined;
        if (agentRow?.name) name = agentRow.name;
      } catch { /* non-critical */ }
      return { agentId: row.agentId, name, rejectionCount: row.rejectionCount };
    });

    return NextResponse.json({
      pendingReview,
      approvedToday,
      rejectedToday,
      approvalRate,
      avgReviewMinutes,
      topRejectionReasons,
      agentsNeedingSupport,
    });
  } catch (error) {
    console.error('GET /api/clara/insights error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
