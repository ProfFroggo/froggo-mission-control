// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { emitSSEEvent } from '@/lib/sseEmitter';
import { dispatchTask } from '@/lib/taskDispatcher';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status !== 'internal-review') {
      return NextResponse.json({ error: 'Task is not in internal-review status' }, { status: 400 });
    }

    // Validate all 3 gates
    const gateFailures: string[] = [];

    // Gate 1: agent assigned
    if (!task.assignedTo) {
      gateFailures.push('Gate 1 failed: no agent assigned');
    }

    // Gate 2: planning notes non-empty
    if (!task.planningNotes || !(task.planningNotes as string).trim()) {
      gateFailures.push('Gate 2 failed: planning notes are empty');
    }

    // Gate 3: at least 1 subtask
    const subtaskRow = db.prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE taskId = ?').get(id) as { cnt: number };
    if (subtaskRow.cnt < 1) {
      gateFailures.push('Gate 3 failed: no subtasks defined');
    }

    if (gateFailures.length > 0) {
      return NextResponse.json(
        { error: 'Cannot approve: gate checks failed', failures: gateFailures },
        { status: 422 }
      );
    }

    const now = Date.now();

    // Move task to in-progress
    db.prepare(`
      UPDATE tasks SET status = 'in-progress', reviewStatus = 'pre-approved',
      reviewNotes = 'All 3 gates passed — approved by Clara dashboard.',
      updatedAt = ? WHERE id = ?
    `).run(now, id);

    // Log activity
    db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
      .run(id, 'clara', 'pre-review-approved', 'All 3 gates passed. Approved via Clara review dashboard. Dispatching agent.', now);

    // Calculate time in review for SLA logging
    let timeInReviewMinutes: number | null = null;
    if (task.reviewEnteredAt) {
      timeInReviewMinutes = Math.round((now - (task.reviewEnteredAt as number)) / 60000);
    }

    // Write to clara_review_log
    const logId = `crl-${now}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      db.prepare(`
        INSERT INTO clara_review_log (id, taskId, decision, reason, reviewedAt, timeInReviewMinutes)
        VALUES (?, ?, 'approved', 'All 3 gates passed.', datetime('now'), ?)
      `).run(logId, id, timeInReviewMinutes);
    } catch { /* non-critical */ }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown>;

    // Emit SSE update
    emitSSEEvent('task.updated', {
      id,
      status: 'in-progress',
      assignedTo: updatedTask.assignedTo ?? null,
    });

    // Dispatch the agent
    try {
      dispatchTask(id);
    } catch { /* non-critical — cron will pick it up */ }

    const activity = {
      id: logId,
      taskId: id,
      agentId: 'clara',
      action: 'pre-review-approved',
      message: 'All 3 gates passed. Approved via Clara review dashboard.',
      timestamp: now,
    };

    return NextResponse.json({ task: updatedTask, activity });
  } catch (error) {
    console.error('POST /api/tasks/[id]/approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
