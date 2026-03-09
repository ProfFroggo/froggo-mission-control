import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';
import { spawnSync } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

type ApprovalRow = {
  id: string; type: string; title: string; content: string; context: string | null;
  metadata: string; status: string; requester: string | null;
  tier: number; category: string | null; actionRef: string | null;
  createdAt: number; respondedAt: number | null;
};

type ActionRow = {
  id: string; executor: string; payload: string; agentId: string | null;
  description: string | null; scheduledFor: number | null; approvalId: string | null;
};

async function fireExecutor(action: ActionRow, overriddenPayload?: Record<string, unknown>) {
  const db = getDb();
  const payload = overriddenPayload ?? JSON.parse(action.payload || '{}');
  const executorPath = path.join(process.cwd(), 'tools', 'executors', action.executor);

  db.prepare('UPDATE pending_actions SET status = ?, updatedAt = ? WHERE id = ?')
    .run('executing', Date.now(), action.id);

  const result = spawnSync('python3', [executorPath, JSON.stringify(payload)], {
    encoding: 'utf-8',
    timeout: 60_000,
    env: { ...process.env },
  });

  const success = result.status === 0 && !result.error;
  let resultData: unknown;
  try { resultData = JSON.parse(result.stdout || '{}'); } catch {
    resultData = { ok: success, output: result.stdout, error: result.stderr };
  }

  const finalStatus = success ? 'completed' : 'failed';
  db.prepare('UPDATE pending_actions SET status = ?, result = ?, updatedAt = ? WHERE id = ?')
    .run(finalStatus, JSON.stringify(resultData), Date.now(), action.id);

  return { success, finalStatus, resultData };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const { action, adjustedContent, notes } = body;

    if (!['approved', 'rejected', 'adjusted', 'cancelled'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approved, rejected, adjusted, or cancelled' },
        { status: 400 }
      );
    }

    const existing = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as ApprovalRow | undefined;
    if (!existing) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Already processed' }, { status: 409 });
    }

    const status = action === 'cancelled' ? 'rejected' : action;
    const respondedAt = Date.now();

    db.prepare(`
      UPDATE approvals SET status = ?, respondedAt = ?, adjustedContent = ?, notes = ? WHERE id = ?
    `).run(status, respondedAt, adjustedContent ?? null, notes ?? null, id);

    // ── Downstream: task approvals ─────────────────────────────────────────────
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
            const taskRow = db.prepare('SELECT assignedTo FROM tasks WHERE id = ?')
              .get(taskId) as { assignedTo: string | null } | undefined;
            if (taskRow?.assignedTo) dispatchTask(taskId);
          }
          db.prepare(
            `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).run(taskId, 'human', 'approval_' + action, `Human ${action}: ${notes || '(no notes)'}`, respondedAt);
        }
      } catch { /* non-critical */ }
    }

    // ── Downstream: executable actions ────────────────────────────────────────
    const category = existing.category;
    const actionRef = existing.actionRef;

    if (actionRef && (category === 'executable_action' || category === 'scheduled_action')) {
      const pendingAction = db.prepare('SELECT * FROM pending_actions WHERE id = ?')
        .get(actionRef) as ActionRow | undefined;

      if (pendingAction) {
        if (action === 'cancelled') {
          // Cancel: just mark as cancelled, do not execute
          db.prepare('UPDATE pending_actions SET status = ?, updatedAt = ? WHERE id = ?')
            .run('cancelled', Date.now(), actionRef);

        } else if (action === 'approved' && category === 'executable_action') {
          // Immediate execution: fire executor now
          const overridden = adjustedContent ? (() => {
            try { return JSON.parse(adjustedContent); } catch { return undefined; }
          })() : undefined;

          fireExecutor(pendingAction, overridden).catch(err => {
            console.error('[actions] Executor error:', err);
          });

        } else if (action === 'approved' && category === 'scheduled_action') {
          // Scheduled: mark approved, executor fires at scheduledFor time
          db.prepare('UPDATE pending_actions SET status = ?, updatedAt = ? WHERE id = ?')
            .run('approved', Date.now(), actionRef);

        } else if (action === 'rejected') {
          db.prepare('UPDATE pending_actions SET status = ?, updatedAt = ? WHERE id = ?')
            .run('rejected', Date.now(), actionRef);
        }
      }
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
