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

    // Find all 'todo' tasks with an assigned agent
    const tasks = db.prepare(
      `SELECT id, assignedTo FROM tasks
       WHERE status = 'todo' AND assignedTo IS NOT NULL AND assignedTo != ''`
    ).all() as Array<{ id: string; assignedTo: string }>;

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
  const g = globalThis as Record<string, unknown>;
  if (g.__taskDispatcherInterval) return;
  // Set sentinel immediately (before setInterval) to prevent concurrent callers from racing in
  g.__taskDispatcherInterval = true;

  console.log('[dispatcherCron] Task dispatcher starting (30s interval)');

  // Run immediately on start, then every 30s
  runDispatchCycle();
  g.__taskDispatcherInterval = setInterval(runDispatchCycle, 30 * 1000);
}
