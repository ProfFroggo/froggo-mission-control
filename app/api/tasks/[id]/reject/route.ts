// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { emitSSEEvent } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
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

    const body = await request.json() as { reason?: string };
    const reason = (body.reason ?? '').trim();

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const now = Date.now();

    // Calculate time in review for SLA logging
    let timeInReviewMinutes: number | null = null;
    if (task.reviewEnteredAt) {
      timeInReviewMinutes = Math.round((now - (task.reviewEnteredAt as number)) / 60000);
    }

    // Build updated planning notes — append rejection reason as a comment
    const existingNotes = ((task.planningNotes as string | null) ?? '').trim();
    const rejectionComment = `\n\n---\nRejected by Clara (${new Date(now).toISOString().slice(0, 16).replace('T', ' ')}): ${reason}`;
    const updatedNotes = existingNotes + rejectionComment;

    // Move task back to todo, append rejection reason to planningNotes
    db.prepare(`
      UPDATE tasks SET status = 'todo', reviewStatus = 'pre-rejected',
      reviewNotes = ?, planningNotes = ?,
      lastClaraReviewAt = ?, updatedAt = ?
      WHERE id = ?
    `).run(reason, updatedNotes, now, now, id);

    // Log activity
    db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
      .run(id, 'clara', 'pre-review-rejected', `Pre-review rejected via Clara dashboard: ${reason}. Task returned to todo.`, now);

    // Write to clara_review_log
    const logId = `crl-${now}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      db.prepare(`
        INSERT INTO clara_review_log (id, taskId, decision, reason, reviewedAt, timeInReviewMinutes)
        VALUES (?, ?, 'rejected', ?, datetime('now'), ?)
      `).run(logId, id, reason, timeInReviewMinutes);
    } catch { /* non-critical */ }

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown>;

    // Emit SSE update
    emitSSEEvent('task.updated', {
      id,
      status: 'todo',
      assignedTo: updatedTask.assignedTo ?? null,
    });

    const activity = {
      id: logId,
      taskId: id,
      agentId: 'clara',
      action: 'pre-review-rejected',
      message: `Pre-review rejected: ${reason}. Task returned to todo.`,
      timestamp: now,
    };

    return NextResponse.json({ task: updatedTask, activity });
  } catch (error) {
    console.error('POST /api/tasks/[id]/reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
