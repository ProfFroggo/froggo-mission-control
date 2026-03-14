// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

<<<<<<< HEAD
/**
 * GET /api/projects/:id/health
 * Returns a health score (0–100) broken into four sub-scores:
 *   taskCompletion   (0–40)  completedTasks / totalTasks × 40
 *   onTimeDelivery   (0–30)  tasksOnTime   / completedTasks × 30
 *   teamEngagement   (0–20)  activeMembersLast7d / totalMembers × 20
 *   agentCoverage    (0–10)  tasksWithAgent / totalTasks × 10
 */
=======
// GET /api/projects/:id/health
// Returns a health score 0–100 with a 4-dimension breakdown.
>>>>>>> origin/feat/projects-panel-v3
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

<<<<<<< HEAD
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now          = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const taskRow = db.prepare(`
      SELECT
        COUNT(*)                                                                        AS totalTasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)                               AS completedTasks,
        SUM(CASE WHEN status = 'done' AND (dueDate IS NULL OR completedAt <= dueDate) THEN 1 ELSE 0 END) AS tasksOnTime,
        SUM(CASE WHEN assignedTo IS NOT NULL AND assignedTo != '' THEN 1 ELSE 0 END)   AS tasksWithAgent
      FROM tasks WHERE project_id = ?
    `).get(id) as { totalTasks: number; completedTasks: number; tasksOnTime: number; tasksWithAgent: number };

    const memberRow = db.prepare(
      `SELECT COUNT(*) AS totalMembers FROM project_members WHERE projectId = ?`
    ).get(id) as { totalMembers: number };

    const activeRow = db.prepare(`
      SELECT COUNT(DISTINCT ta.agentId) AS activeMembersLast7d
      FROM task_activity ta
      INNER JOIN tasks t ON t.id = ta.taskId
      WHERE t.project_id = ? AND ta.timestamp >= ? AND ta.agentId IS NOT NULL
    `).get(id, sevenDaysAgo) as { activeMembersLast7d: number };

    const totalTasks          = taskRow.totalTasks          ?? 0;
    const completedTasks      = taskRow.completedTasks      ?? 0;
    const tasksOnTime         = taskRow.tasksOnTime         ?? 0;
    const tasksWithAgent      = taskRow.tasksWithAgent      ?? 0;
    const totalMembers        = memberRow.totalMembers      ?? 0;
    const activeMembersLast7d = activeRow.activeMembersLast7d ?? 0;

    const taskCompletionScore = totalTasks > 0   ? (completedTasks / totalTasks) * 40   : 20;
    const onTimeScore         = completedTasks > 0 ? (tasksOnTime / completedTasks) * 30 : 15;
    const teamEngagementScore = totalMembers > 0  ? (Math.min(activeMembersLast7d, totalMembers) / totalMembers) * 20 : 5;
    const agentCoverageScore  = totalTasks > 0   ? (tasksWithAgent / totalTasks) * 10   : 5;

    const score = Math.min(100, Math.round(taskCompletionScore + onTimeScore + teamEngagementScore + agentCoverageScore));
=======
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // ── Sub-score 1: Task Completion (×40) ───────────────────────────────────
    const taskRow = db.prepare(`
      SELECT
        COUNT(*) AS totalTasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completedTasks,
        SUM(CASE WHEN status = 'done' AND (dueDate IS NULL OR completedAt <= dueDate) THEN 1 ELSE 0 END) AS tasksOnTime,
        SUM(CASE WHEN assignedTo IS NOT NULL AND assignedTo != '' THEN 1 ELSE 0 END) AS tasksWithAgent
      FROM tasks WHERE project_id = ?
    `).get(id) as {
      totalTasks: number;
      completedTasks: number;
      tasksOnTime: number;
      tasksWithAgent: number;
    } | undefined;

    const totalTasks = taskRow?.totalTasks ?? 0;
    const completedTasks = taskRow?.completedTasks ?? 0;
    const tasksOnTime = taskRow?.tasksOnTime ?? 0;
    const tasksWithAgent = taskRow?.tasksWithAgent ?? 0;

    const taskCompletionScore = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 40)
      : 20; // neutral when no tasks

    // ── Sub-score 2: On-Time Delivery (×30) ──────────────────────────────────
    const onTimeDeliveryScore = completedTasks > 0
      ? Math.round((tasksOnTime / completedTasks) * 30)
      : 15; // neutral when nothing completed yet

    // ── Sub-score 3: Team Engagement (×20) ───────────────────────────────────
    // Active members = those with task_activity in the last 7 days
    const memberRow = db.prepare(`
      SELECT COUNT(DISTINCT pm.agentId) AS memberCount
      FROM project_members pm
      WHERE pm.projectId = ?
    `).get(id) as { memberCount: number } | undefined;

    const memberCount = memberRow?.memberCount ?? 0;

    let activeMembers = 0;
    try {
      const activeRow = db.prepare(`
        SELECT COUNT(DISTINCT ta.agentId) AS activeMembers
        FROM task_activity ta
        JOIN tasks t ON t.id = ta.taskId
        WHERE t.project_id = ? AND ta.createdAt > ?
      `).get(id, Date.now() - 7 * 24 * 60 * 60 * 1000) as { activeMembers: number } | undefined;
      activeMembers = activeRow?.activeMembers ?? 0;
    } catch {
      // task_activity table may not have agentId — fall back gracefully
      activeMembers = memberCount > 0 ? Math.ceil(memberCount / 2) : 0;
    }

    const teamEngagementScore = memberCount > 0
      ? Math.round((Math.min(activeMembers, memberCount) / memberCount) * 20)
      : 5; // penalise no team

    // ── Sub-score 4: Agent Coverage (×10) ────────────────────────────────────
    const agentCoverageScore = totalTasks > 0
      ? Math.round((tasksWithAgent / totalTasks) * 10)
      : 5;

    const score = Math.min(100, taskCompletionScore + onTimeDeliveryScore + teamEngagementScore + agentCoverageScore);
>>>>>>> origin/feat/projects-panel-v3

    return NextResponse.json({
      projectId: id,
      score,
      breakdown: {
<<<<<<< HEAD
        taskCompletion:  Math.round(taskCompletionScore),
        onTimeDelivery:  Math.round(onTimeScore),
        teamEngagement:  Math.round(teamEngagementScore),
        agentCoverage:   Math.round(agentCoverageScore),
      },
      meta: { totalTasks, completedTasks, tasksOnTime, tasksWithAgent, totalMembers, activeMembersLast7d },
=======
        taskCompletion:  { score: taskCompletionScore,   weight: 40, label: 'Task Completion' },
        onTimeDelivery:  { score: onTimeDeliveryScore,   weight: 30, label: 'On-Time Delivery' },
        teamEngagement:  { score: teamEngagementScore,   weight: 20, label: 'Team Engagement' },
        agentCoverage:   { score: agentCoverageScore,    weight: 10, label: 'Agent Coverage' },
      },
      meta: {
        totalTasks,
        completedTasks,
        tasksOnTime,
        memberCount,
        activeMembers,
        tasksWithAgent,
      },
>>>>>>> origin/feat/projects-panel-v3
    });
  } catch (error) {
    console.error('GET /api/projects/:id/health error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
