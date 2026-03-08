import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const { action, adjustedContent, notes } = body;

    if (!['approved', 'rejected', 'adjusted'].includes(action)) {
      return NextResponse.json({ error: 'action must be approved, rejected, or adjusted' }, { status: 400 });
    }

    const status = action as string;
    const respondedAt = Date.now();

    // Fetch before updating so we have type + metadata
    const existing = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as {
      type: string; metadata: string; requester: string | null; status: string;
    } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Already processed' }, { status: 409 });
    }

    db.prepare(`
      UPDATE approvals SET status = ?, respondedAt = ?, adjustedContent = ?, notes = ? WHERE id = ?
    `).run(status, respondedAt, adjustedContent ?? null, notes ?? null, id);

    // ── Downstream effects ────────────────────────────────────────────────────

    // Task approvals: sync task status
    if (existing.type === 'task') {
      try {
        const meta = typeof existing.metadata === 'string'
          ? JSON.parse(existing.metadata) : (existing.metadata || {});
        const taskId = meta.taskId as string | undefined;
        if (taskId) {
          const now = Date.now();
          if (action === 'approved') {
            db.prepare(
              `UPDATE tasks SET status = 'done', reviewStatus = 'approved', updatedAt = ? WHERE id = ?`
            ).run(now, taskId);
          } else if (action === 'rejected') {
            db.prepare(
              `UPDATE tasks SET status = 'in-progress', reviewStatus = 'rejected',
               reviewNotes = ?, updatedAt = ? WHERE id = ?`
            ).run(notes ?? null, now, taskId);
            // Re-dispatch the agent to address the rejection feedback
            const taskRow = db.prepare('SELECT assignedTo FROM tasks WHERE id = ?')
              .get(taskId) as { assignedTo: string | null } | undefined;
            if (taskRow?.assignedTo) dispatchTask(taskId);
          }
          db.prepare(
            `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).run(taskId, 'kevin', 'approval_' + action,
            `Human ${action}: ${notes || '(no notes)'}`, now);
        }
      } catch { /* non-critical */ }
    }

    const updated = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Record<string, unknown>;
    if (typeof updated.metadata === 'string') {
      try { updated.metadata = JSON.parse(updated.metadata as string); } catch { updated.metadata = {}; }
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/approvals/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
