/**
 * Review Gate — validates tasks before they can stay in "review" status.
 *
 * Requirements for a task to enter review:
 *   1. Has planningNotes (a plan)
 *   2. Has at least one subtask
 *   3. Has assignedTo (a worker agent)
 *   4. Has reviewerId = "clara" (always auto-set to Clara)
 *
 * If any requirement fails, the task is pushed back to "todo" with a clear message.
 * Clara is always set as reviewer automatically.
 */

import { getDb } from './database';

const REVIEWER = 'clara';

interface ReviewGateResult {
  passed: boolean;
  failures: string[];
  autoFixed: string[];
}

export function runReviewGate(taskId: string): ReviewGateResult {
  const failures: string[] = [];
  const autoFixed: string[] = [];

  try {
    const db = getDb();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
    if (!task) return { passed: false, failures: ['Task not found'], autoFixed };

    // Auto-fix: always ensure Clara is reviewer
    if (!task.reviewerId || task.reviewerId !== REVIEWER) {
      db.prepare('UPDATE tasks SET reviewerId = ?, updatedAt = ? WHERE id = ?')
        .run(REVIEWER, Date.now(), taskId);
      autoFixed.push(`Reviewer set to ${REVIEWER}`);
    }

    // Check 1: Has a plan (planningNotes ≥ 20 chars)
    const plan = ((task.planningNotes as string) ?? '').trim();
    if (plan.length < 20) {
      failures.push('planningNotes is required and must contain a meaningful plan (min 20 chars)');
    }

    // Check 2: At least one subtask
    const subtaskCount = (db.prepare(
      'SELECT COUNT(*) as c FROM subtasks WHERE taskId = ?'
    ).get(taskId) as { c: number }).c;
    if (subtaskCount < 1) {
      failures.push(`at least 1 subtask required to enter review (currently ${subtaskCount})`);
    }

    // Check 3: Has an assigned worker
    if (!task.assignedTo) {
      failures.push('No worker agent assigned (assignedTo is required)');
    }

    // Check 4: Task not clearly incomplete
    const progress = (task.progress as number) ?? 0;
    const hasUpdate = task.lastAgentUpdate && (task.lastAgentUpdate as string).trim().length > 0;
    if (progress < 50 && !hasUpdate) {
      failures.push('Task appears incomplete (progress < 50% with no agent update)');
    }

    // If any check fails, push task back to todo
    if (failures.length > 0) {
      const failureMsg = `Review gate failed — pushed back to todo:\n${failures.map(f => `• ${f}`).join('\n')}`;
      db.prepare(
        `UPDATE tasks SET status = 'todo', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`
      ).run(failureMsg, Date.now(), taskId);

      // Log activity
      try {
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp)
           VALUES (?, ?, ?, ?, ?)`
        ).run(taskId, 'system', 'review_gate', failureMsg, Date.now());
      } catch { /* non-critical */ }
    }
  } catch (err) {
    console.error('[reviewGate] Error:', err);
    return { passed: false, failures: [`Internal error: ${err}`], autoFixed };
  }

  return {
    passed: failures.length === 0,
    failures,
    autoFixed,
  };
}
