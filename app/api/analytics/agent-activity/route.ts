// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const rows = db.prepare(`
      SELECT
        assignedTo,
        COUNT(*)                                                              AS totalTasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)                    AS completedTasks,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END)             AS inProgressTasks,
        SUM(CASE WHEN status IN ('review','internal-review') THEN 1 ELSE 0 END) AS reviewTasks,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END)                 AS blockedTasks,
        AVG(CASE WHEN completedAt IS NOT NULL
                 THEN (completedAt - createdAt) / 3600000.0
                 ELSE NULL END)                                               AS avgTaskTimeHours,
        SUM(CASE WHEN completedAt IS NOT NULL AND completedAt > ?
                 THEN 1 ELSE 0 END)                                           AS completedLast7Days
      FROM tasks
      WHERE assignedTo IS NOT NULL
      GROUP BY assignedTo
    `).all(sevenDaysAgo) as {
      assignedTo: string;
      totalTasks: number;
      completedTasks: number;
      inProgressTasks: number;
      reviewTasks: number;
      blockedTasks: number;
      avgTaskTimeHours: number | null;
      completedLast7Days: number;
    }[];

    // Return a Record keyed by agentId for O(1) lookup in AgentPanel
    const byAgent: Record<string, object> = {};
    for (const row of rows) {
      const total = row.totalTasks || 0;
      const completed = row.completedTasks || 0;
      const reviewed = row.reviewTasks || 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
      const reviewSuccessRate = (completed + reviewed) > 0
        ? Math.round((completed / (completed + reviewed)) * 1000) / 10
        : 0;

      byAgent[row.assignedTo] = {
        totalTasks: total,
        completedTasks: completed,
        inProgressTasks: row.inProgressTasks || 0,
        reviewTasks: reviewed,
        blockedTasks: row.blockedTasks || 0,
        completionRate,
        avgTaskTimeHours: row.avgTaskTimeHours ?? 0,
        reviewSuccessRate,
        completedLast7Days: row.completedLast7Days || 0,
        subtaskCompletionRate: 0,
      };
    }

    // Enrich with subtask completion rates
    try {
      const subtaskRows = db.prepare(`
        SELECT t.assignedTo,
          COUNT(s.id)                                             AS total,
          SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END)       AS completed
        FROM subtasks s
        JOIN tasks t ON t.id = s.taskId
        WHERE t.assignedTo IS NOT NULL
        GROUP BY t.assignedTo
      `).all() as { assignedTo: string; total: number; completed: number }[];

      for (const sr of subtaskRows) {
        if (byAgent[sr.assignedTo]) {
          (byAgent[sr.assignedTo] as Record<string, number>).subtaskCompletionRate =
            sr.total > 0 ? Math.round((sr.completed / sr.total) * 1000) / 10 : 0;
        }
      }
    } catch { /* subtasks table may not exist */ }

    // ── Role-specific metrics for special agents ──────────────────────────────

    // Mission Control — orchestration metrics
    try {
      const mcDispatches = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'mission-control' AND action = 'dispatch'`
      ).get() as { c: number }).c;
      const mcCreations = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'mission-control' AND action IN ('created','started')`
      ).get() as { c: number }).c;
      const mcLast7 = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'mission-control' AND timestamp > ?`
      ).get(sevenDaysAgo) as { c: number }).c;
      const agentsActive = (db.prepare(
        `SELECT COUNT(*) AS c FROM agents WHERE status NOT IN ('disabled','archived','offline')`
      ).get() as { c: number }).c;
      const agentsTotal = (db.prepare(
        `SELECT COUNT(*) AS c FROM agents WHERE status != 'archived'`
      ).get() as { c: number }).c;
      const openTasks = (db.prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('done')`
      ).get() as { c: number }).c;
      const cronRuns = (db.prepare(
        `SELECT COUNT(*) AS c FROM sessions WHERE key LIKE 'cron:%'`
      ).get() as { c: number }).c;

      byAgent['mission-control'] = {
        ...(byAgent['mission-control'] || {}),
        _role: 'orchestrator',
        dispatches: mcDispatches,
        taskCreations: mcCreations,
        agentsActive,
        agentsTotal,
        openTasks,
        cronRuns,
        actionsLast7Days: mcLast7,
      };
    } catch { /* non-critical */ }

    // HR — hiring, skills, training metrics
    try {
      const agentsTotal = (db.prepare(
        `SELECT COUNT(*) AS c FROM agents WHERE status != 'archived'`
      ).get() as { c: number }).c;

      const skillsRows = db.prepare(
        `SELECT value FROM settings WHERE key LIKE 'agent.%.skills'`
      ).all() as { value: string }[];
      const agentsWithSkills = skillsRows.filter(r => {
        try { const a = JSON.parse(r.value); return Array.isArray(a) && a.length > 0; } catch { return false; }
      }).length;
      const skillSlotsTotal = skillsRows.reduce((sum, r) => {
        try { const a = JSON.parse(r.value); return sum + (Array.isArray(a) ? a.length : 0); } catch { return 0; }
      }, 0);

      const hrReviews = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'hr' AND action IN ('approved','completed','reviewed')`
      ).get() as { c: number }).c;
      const hrResolved = (db.prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE assignedTo = 'hr' AND status = 'done'`
      ).get() as { c: number }).c;
      const hrLast7 = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'hr' AND timestamp > ?`
      ).get(sevenDaysAgo) as { c: number }).c;

      byAgent['hr'] = {
        ...(byAgent['hr'] || {}),
        _role: 'hr',
        agentsTotal,
        agentsWithSkills,
        skillSlotsTotal,
        reviewsDone: hrReviews,
        problemsResolved: hrResolved,
        actionsLast7Days: hrLast7,
      };
    } catch { /* non-critical */ }

    // Clara — quality control metrics
    try {
      const claraApproved = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'clara' AND action IN ('approved','completed')`
      ).get() as { c: number }).c;
      const claraRejected = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'clara' AND action = 'rejected'`
      ).get() as { c: number }).c;
      const claraTotal = claraApproved + claraRejected;
      const claraPassRate = claraTotal > 0 ? Math.round((claraApproved / claraTotal) * 1000) / 10 : 0;
      const claraLast7 = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'clara' AND timestamp > ?`
      ).get(sevenDaysAgo) as { c: number }).c;
      const awaitingReview = (db.prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE status IN ('review','internal-review')`
      ).get() as { c: number }).c;
      const humanReview = (db.prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE status = 'human-review'`
      ).get() as { c: number }).c;

      byAgent['clara'] = {
        ...(byAgent['clara'] || {}),
        _role: 'qc',
        reviewsApproved: claraApproved,
        reviewsRejected: claraRejected,
        reviewsTotal: claraTotal,
        passRate: claraPassRate,
        awaitingReview,
        escalatedToHuman: humanReview,
        actionsLast7Days: claraLast7,
      };
    } catch { /* non-critical */ }

    // Inbox — communications metrics
    try {
      const inboxActions = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'inbox'`
      ).get() as { c: number }).c;
      const inboxTasksCreated = (db.prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE assignedTo = 'inbox'`
      ).get() as { c: number }).c;
      const inboxLast7 = (db.prepare(
        `SELECT COUNT(*) AS c FROM task_activity WHERE agentId = 'inbox' AND timestamp > ?`
      ).get(sevenDaysAgo) as { c: number }).c;

      let inboxTotal = 0;
      let inboxRead = 0;
      try {
        inboxTotal = (db.prepare(`SELECT COUNT(*) AS c FROM inbox`).get() as { c: number }).c;
        inboxRead = (db.prepare(`SELECT COUNT(*) AS c FROM inbox WHERE isRead = 1`).get() as { c: number }).c;
      } catch { /* inbox table may not exist */ }

      let approvalsHandled = 0;
      try {
        approvalsHandled = (db.prepare(
          `SELECT COUNT(*) AS c FROM approvals WHERE status IN ('approved','rejected')`
        ).get() as { c: number }).c;
      } catch { /* non-critical */ }

      byAgent['inbox'] = {
        ...(byAgent['inbox'] || {}),
        _role: 'inbox',
        messagesTotal: inboxTotal,
        messagesRead: inboxRead,
        tasksCreated: inboxTasksCreated,
        approvalsHandled,
        actionsLast7Days: inboxLast7,
        totalActions: inboxActions,
      };
    } catch { /* non-critical */ }

    return NextResponse.json(byAgent);
  } catch (error) {
    console.error('GET /api/analytics/agent-activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
