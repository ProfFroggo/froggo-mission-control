// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';
import { runReviewGate } from '@/lib/reviewGate';
import { emitSSEEvent } from '@/lib/sseEmitter';
import { trackEvent } from '@/lib/telemetry';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();

function computeNextDue(currentDue: number, rec: { frequency: string; interval: number }): number {
  const d = new Date(currentDue);
  const n = rec.interval || 1;
  switch (rec.frequency) {
    case 'daily':   d.setDate(d.getDate() + n); break;
    case 'weekly':  d.setDate(d.getDate() + n * 7); break;
    case 'monthly': d.setMonth(d.getMonth() + n); break;
    case 'yearly':  d.setFullYear(d.getFullYear() + n); break;
  }
  return d.getTime();
}

const SCALAR_FIELDS = [
  'title', 'description', 'status', 'priority', 'project', 'project_id', 'assignedTo',
  'reviewerId', 'reviewStatus', 'reviewNotes', 'planningNotes', 'dueDate',
  'estimatedHours', 'progress', 'lastAgentUpdate', 'completedAt',
  'projectName', 'stageNumber', 'stageName', 'nextStage', 'parentTaskId',
  'recurrenceParentId',
];
const JSON_FIELDS = ['tags', 'labels', 'blockedBy', 'blocks', 'recurrence'];

function parseTask(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        parsed[field] = field === 'recurrence' ? null : [];
      }
    }
  }
  return parsed;
}

export async function GET(
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

    return NextResponse.json(parseTask(task));
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    if ('title' in body && (typeof body.title !== 'string' || body.title.length > 500)) {
      return NextResponse.json({ error: 'title must be 500 characters or fewer' }, { status: 400 });
    }
    if ('description' in body && body.description !== null && typeof body.description === 'string' && body.description.length > 5000) {
      return NextResponse.json({ error: 'description must be 5000 characters or fewer' }, { status: 400 });
    }

    const VALID_STATUSES = ['todo', 'internal-review', 'in-progress', 'agent-review', 'human-review', 'done'];
    const VALID_PRIORITIES = ['p0', 'p1', 'p2', 'p3', ''];
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status as string)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority as string)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of SCALAR_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    for (const field of JSON_FIELDS) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(JSON.stringify(body[field]));
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Auto-advance status based on reviewStatus.
    // Only fires when reviewStatus is being set AND body does NOT already contain an explicit status.
    if ('reviewStatus' in body && !('status' in body)) {
      const current = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
      const effectiveStatus = current?.status;
      if (effectiveStatus === 'review') {
        if (body.reviewStatus === 'approved') {
          setClauses.push('status = ?');
          values.push('done');
        } else if (body.reviewStatus === 'rejected' || body.reviewStatus === 'needs-changes') {
          setClauses.push('status = ?');
          values.push('in-progress');
        }
      }
    }

    const now = Date.now();
    setClauses.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    // Always ensure Clara is reviewer — set whenever reviewerId isn't already populated
    if (!body.reviewerId) {
      const current2 = db.prepare('SELECT reviewerId FROM tasks WHERE id = ?').get(id) as { reviewerId: string | null } | undefined;
      if (!current2?.reviewerId) {
        db.prepare('UPDATE tasks SET reviewerId = ? WHERE id = ?').run('clara', id);
      }
    }

    // Auto-log activity
    const activityMsg = body.lastAgentUpdate ||
      (body.status ? `Status → ${body.status}` : null) ||
      (body.reviewStatus ? `Review: ${body.reviewStatus}` : null) ||
      'Task updated';
    db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(id, body.assignedTo || null, body.status ? 'status_change' : 'update', activityMsg, now);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Soft check: if moving to review, report incomplete subtasks as a warning (not a block)
    // The agent gets a chance to see what it missed; Clara will catch any remaining gaps.
    let incompleteSubtaskWarning: string | undefined;
    if (body.status === 'review') {
      try {
        const incompleteSubs = db.prepare(
          'SELECT id, title FROM subtasks WHERE taskId = ? AND completed = 0'
        ).all(id) as { id: string; title: string }[];
        if (incompleteSubs.length > 0) {
          const titles = incompleteSubs.map(s => `"${s.title}"`).join(', ');
          incompleteSubtaskWarning = `${incompleteSubs.length} subtask(s) still incomplete: ${titles}. Clara will review these.`;
        }
      } catch { /* non-critical */ }
    }

    // Handoff note: write when assignedTo changes (task is handed off to a new agent)
    // The outgoing agent's context is captured so the incoming agent can continue smoothly.
    if ('assignedTo' in body && body.assignedTo) {
      try {
        const previousAgent = (updated.assignedTo as string | null) !== body.assignedTo
          ? (updated.assignedTo as string | null)
          : null;
        if (previousAgent && previousAgent !== body.assignedTo) {
          const handoffDir = join(HOME, 'mission-control', 'memory', 'agents', previousAgent as string, 'handoffs');
          if (!existsSync(handoffDir)) mkdirSync(handoffDir, { recursive: true });
          const handoffPath = join(handoffDir, `${id}.md`);
          const taskTitle = updated.title as string;
          const lastUpdate = (updated.lastAgentUpdate as string | null) || 'No update recorded';
          const progress = updated.progress ?? 0;
          const handoffContent = [
            `# Handoff Note — Task ${id}`,
            ``,
            `**Title:** ${taskTitle}`,
            `**Previous Agent:** ${previousAgent}`,
            `**New Agent:** ${body.assignedTo}`,
            `**Handed off at:** ${new Date().toISOString()}`,
            `**Progress at handoff:** ${progress}%`,
            ``,
            `## Last Agent Update`,
            lastUpdate,
            ``,
            `## Planning Notes`,
            (updated.planningNotes as string | null) || '_No planning notes._',
          ].join('\n');
          writeFileSync(handoffPath, handoffContent, 'utf-8');
          trackEvent('task.handoff', { taskId: id, from: previousAgent, to: body.assignedTo as string });
        }
      } catch { /* non-critical */ }
    }

    // Auto-dispatch triggers:
    // 1. assignedTo set on a todo task (initial assignment)
    // Advance to internal-review — Clara's pre-work review cron picks it up,
    // approves it, and triggers dispatch. Do not call dispatchTask here.
    const wasAssigned = 'assignedTo' in body && body.assignedTo;
    const isTodoStatus = (updated.status as string) === 'todo';
    if (wasAssigned && isTodoStatus) {
      db.prepare('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?').run('internal-review', Date.now(), id);
      // Notify the assigned agent in their chat room
      try {
        const taskTitle = updated.title as string;
        const priority = (updated.priority as string | null) ?? 'p2';
        db.prepare(
          `INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)`
        ).run(
          body.assignedTo as string,
          'system',
          `New task assigned to you: "${taskTitle}" [${priority}]. Task is now in Pre-review — Clara will check the plan and dispatch you when approved.`,
          Date.now()
        );
      } catch { /* non-critical — chat table may not be ready */ }
    }

    // 2. Task rejected by Clara (reviewStatus=rejected/needs-changes → status=in-progress)
    const wasRejected = body.reviewStatus === 'rejected' || body.reviewStatus === 'needs-changes';
    if (wasRejected && updated.assignedTo) {
      dispatchTask(id);
    }

    // Auto-create approval record when task moves to human-review
    if (body.status === 'human-review') {
      try {
        const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        if (taskRow) {
          // Only create if no pending approval for this task already exists
          const existing = db.prepare(
            `SELECT id FROM approvals WHERE status = 'pending'
             AND json_extract(metadata, '$.taskId') = ?`
          ).get(id);
          if (!existing) {
            const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            db.prepare(`
              INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, createdAt)
              VALUES (?, 'action', ?, ?, ?, ?, 'pending', ?, 3, ?)
            `).run(
              approvalId,
              `Blocked: ${taskRow.title}`,
              taskRow.lastAgentUpdate || taskRow.description || 'Task requires human review',
              taskRow.planningNotes || null,
              JSON.stringify({ taskId: id, agentId: taskRow.assignedTo, project: taskRow.project, priority: taskRow.priority }),
              taskRow.assignedTo || null,
              now
            );
          }
        }
      } catch { /* non-critical */ }
    }

    // Review gate: when task moves to 'review', validate it
    // Gate auto-sets Clara as reviewer and may push back to 'todo' if incomplete
    const movingToReview = 'status' in body && body.status === 'review';
    if (movingToReview) {
      const gateResult = runReviewGate(id);
      // Re-fetch after gate may have modified the task
      const afterGate = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (afterGate) {
        const response = parseTask(afterGate) as Record<string, unknown>;
        if (!gateResult.passed && gateResult.failures.length > 0) {
          response.gateRejection = { reason: gateResult.failures.join(' | ') };
        }
        return NextResponse.json(response);
      }
    }

    // Auto-spawn next occurrence when a recurring task is marked done
    if (body.status === 'done' && updated.recurrence) {
      try {
        const rec = JSON.parse(updated.recurrence as string);
        if (rec && rec.frequency) {
          // Check if recurrence is exhausted
          let shouldSpawn = true;
          if (rec.endType === 'after') {
            shouldSpawn = rec.endAfter > 1;
          } else if (rec.endType === 'on' && rec.endDate) {
            shouldSpawn = Date.now() < rec.endDate;
          }

          if (shouldSpawn && updated.dueDate) {
            const nextDue = computeNextDue(Number(updated.dueDate), rec);
            // Don't spawn past the end date
            if (rec.endType !== 'on' || nextDue <= rec.endDate) {
              const nextRec = rec.endType === 'after'
                ? { ...rec, endAfter: rec.endAfter - 1 }
                : rec;
              const nextId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const parentId = (updated.recurrenceParentId as string) || id;
              const existingRecurrence = db.prepare(
                'SELECT id FROM tasks WHERE recurrenceParentId = ? AND dueDate = ? AND status != ?'
              ).get(parentId, nextDue, 'done');
              if (!existingRecurrence) {
                db.prepare(`
                  INSERT INTO tasks (
                    id, title, description, status, priority, project, assignedTo,
                    reviewerId, planningNotes, dueDate, estimatedHours, tags, labels,
                    blockedBy, blocks, progress, createdAt, updatedAt,
                    recurrence, recurrenceParentId
                  ) VALUES (
                    ?, ?, ?, 'todo', ?, ?, ?,
                    ?, ?, ?, ?, '[]', '[]',
                    '[]', '[]', 0, ?, ?,
                    ?, ?
                  )
                `).run(
                  nextId,
                  updated.title, updated.description ?? null,
                  updated.priority ?? 'p2', updated.project ?? null, updated.assignedTo ?? null,
                  updated.reviewerId ?? null, updated.planningNotes ?? null,
                  nextDue, updated.estimatedHours ?? null,
                  now, now,
                  JSON.stringify(nextRec), parentId
                );
              }
            }
          }
        }
      } catch { /* non-critical */ }
    }

    // Auto-generate task template when a task is done and 5+ similar completed tasks exist
    if (body.status === 'done') {
      try {
        const taskTitle = updated.title as string;
        // Extract first 3-4 words as the "pattern" for matching similar tasks
        const titleWords = taskTitle.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
        const similarCount = (db.prepare(
          `SELECT COUNT(*) as count FROM tasks WHERE status = 'done' AND LOWER(title) LIKE ? AND id != ?`
        ).get(`%${titleWords}%`, id) as { count: number }).count;

        if (similarCount >= 4) { // 4 similar + current = 5+ total
          const templatesDir = join(HOME, 'mission-control', 'library', 'docs', 'templates');
          if (!existsSync(templatesDir)) mkdirSync(templatesDir, { recursive: true });

          // Derive slug from title
          const slug = taskTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/-+$/, '');
          const templatePath = join(templatesDir, `${slug}.md`);

          // Only write if template doesn't already exist (avoid clobbering)
          if (!existsSync(templatePath)) {
            const templateContent = [
              `# Task Template: ${taskTitle}`,
              ``,
              `_Auto-generated from ${similarCount + 1} completed tasks. Last updated: ${new Date().toISOString().slice(0, 10)}_`,
              ``,
              `## Description`,
              (updated.description as string | null) || '_Add description here._',
              ``,
              `## Suggested Agent`,
              (updated.assignedTo as string | null) ? `- ${updated.assignedTo}` : `_Assign based on task type._`,
              ``,
              `## Planning Notes Template`,
              (updated.planningNotes as string | null) || `1. Review requirements\n2. Plan implementation\n3. Execute\n4. Verify and submit for review`,
              ``,
              `## Suggested Priority`,
              (updated.priority as string | null) || 'p2',
            ].join('\n');
            writeFileSync(templatePath, templateContent, 'utf-8');
            trackEvent('template.generated', { taskId: id, slug, similarCount: similarCount + 1 });
          }
        }
      } catch { /* non-critical */ }
    }

    // Notify SSE clients of task update
    const taskId = (updated as Record<string, unknown>)?.id as string | undefined;
    const taskStatus = (updated as Record<string, unknown>)?.status as string | undefined;
    if (taskId) emitSSEEvent('task.updated', {
      id: taskId,
      status: taskStatus ?? null,
      assignedTo: (updated as Record<string, unknown>)?.assignedTo ?? null,
      lastAgentUpdate: (updated as Record<string, unknown>)?.lastAgentUpdate ?? null,
    });

    // When a task moves to 'done', emit task.unblocked for tasks that were blocked by it
    if (body.status === 'done' && taskId) {
      try {
        const allTasks = db.prepare('SELECT id, blockedBy FROM tasks WHERE blockedBy IS NOT NULL AND blockedBy != \'[]\' AND status != ?').all('done') as { id: string; blockedBy: string }[];
        for (const t of allTasks) {
          try {
            const deps = JSON.parse(t.blockedBy) as string[];
            if (deps.includes(taskId)) {
              // Remove this task from the blockedBy array
              const newDeps = deps.filter((d: string) => d !== taskId);
              db.prepare('UPDATE tasks SET blockedBy = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(newDeps), Date.now(), t.id);
              if (newDeps.length === 0) {
                emitSSEEvent('task.unblocked', { id: t.id, unblockedBy: taskId });
              }
            }
          } catch { /* skip malformed */ }
        }
      } catch { /* non-critical */ }
    }

    return NextResponse.json(parseTask(updated));
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Cascade cleanup — non-critical, run before main delete
    try {
      db.prepare('DELETE FROM task_activity WHERE taskId = ?').run(id);
    } catch { /* non-critical */ }
    try {
      const approvalIds = db.prepare(
        `SELECT id FROM approvals WHERE json_extract(metadata, '$.taskId') = ?`
      ).all(id) as { id: string }[];
      for (const { id: approvalId } of approvalIds) {
        db.prepare('DELETE FROM approvals WHERE id = ?').run(approvalId);
      }
    } catch { /* non-critical */ }

    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
