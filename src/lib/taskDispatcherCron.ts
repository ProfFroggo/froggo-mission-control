// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Task Dispatcher Cron — runs every 30 seconds on the server.
 * Finds all "todo" tasks with an assignedTo agent and dispatches them.
 * Uses a cooldown to prevent re-dispatching the same task too quickly.
 */

import { getDb } from './database';
import { dispatchTask } from './taskDispatcher';

// Track recently dispatched tasks to avoid re-dispatching within 5 minutes
const recentlyDispatched = new Map<string, number>();
const DISPATCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function runDispatchCycle(): { dispatched: number; skipped: number } {
  let dispatched = 0;
  let skipped = 0;

  try {
    const db = getDb();

    // 1. Stuck in-progress recovery — tasks with no activity for 30+ minutes
    const stuckInProgress = db.prepare(
      `SELECT id, assignedTo FROM tasks
       WHERE status = 'in-progress' AND assignedTo IS NOT NULL AND assignedTo != ''
         AND updatedAt < ?`
    ).all(Date.now() - 30 * 60_000) as Array<{ id: string; assignedTo: string }>;

    // 2. Pre-rejected todo retry — tasks Clara rejected that need planning fixes.
    //    Only picks them up if the rejection is >60s old (avoids racing with Clara's
    //    own 3-second re-dispatch attempt).
    const preRejectedTodos = db.prepare(
      `SELECT id, assignedTo FROM tasks
       WHERE status = 'todo' AND assignedTo IS NOT NULL AND assignedTo != ''
         AND (reviewStatus = 'pre-rejected' OR (reviewNotes IS NOT NULL AND reviewNotes != ''))
         AND updatedAt < ?`
    ).all(Date.now() - 60_000) as Array<{ id: string; assignedTo: string }>;

    const tasks = [...stuckInProgress, ...preRejectedTodos];

    const now = Date.now();
    for (const task of tasks) {
      const lastDispatched = recentlyDispatched.get(task.id);
      if (lastDispatched && now - lastDispatched < DISPATCH_COOLDOWN_MS) {
        skipped++;
        continue; // Recently dispatched, skip this cycle
      }

      if (dispatchTask(task.id)) {
        recentlyDispatched.set(task.id, now);
        dispatched++;
      }
    }

    // Clean up stale entries
    for (const [id, ts] of recentlyDispatched.entries()) {
      if (now - ts > DISPATCH_COOLDOWN_MS * 2) {
        recentlyDispatched.delete(id);
      }
    }
  } catch (err) {
    console.error('[dispatcherCron] Error in dispatch cycle:', err);
  }

  if (dispatched > 0) {
    console.log(`[dispatcherCron] Cycle complete: dispatched=${dispatched}, skipped=${skipped}`);
  }

  return { dispatched, skipped };
}

// Singleton cron — uses globalThis to survive Next.js HMR in dev
export function startDispatcherCron(): void {
  // Skip during next build to avoid spawning agents during static generation
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_BUILD === '1' ||
    process.argv.some((a: string) => a === 'build')
  ) return;

  const g = globalThis as Record<string, unknown>;
  if (g.__taskDispatcherInterval) return;
  // Set sentinel immediately (before setInterval) to prevent concurrent callers from racing in
  g.__taskDispatcherInterval = true;

  console.log('[dispatcherCron] Stuck task recovery starting (30s interval)');

  // Run immediately on start, then every 30s
  runDispatchCycle();
  const interval = setInterval(runDispatchCycle, 30 * 1000);
  if (typeof interval === 'object' && 'unref' in interval) interval.unref();
  g.__taskDispatcherInterval = interval;
}
