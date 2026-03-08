/**
 * Clara Review Sweep — Cron endpoint
 *
 * Finds all tasks in 'review' status without an active review and triggers Clara.
 * GET  — manual trigger / status check
 * Also runs automatically every 3 minutes via a server-side interval.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Background sweep ─────────────────────────────────────────────────────────
// Runs every 3 minutes while the Next.js server is alive.
// Stored in globalThis to survive Next.js hot-reloads.

const SWEEP_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

type G = typeof globalThis & { _claraReviewTimer?: ReturnType<typeof setInterval> };

function startSweepIfNeeded() {
  const g = globalThis as G;
  if (g._claraReviewTimer) return; // already running

  g._claraReviewTimer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  g._claraReviewTimer.unref?.(); // don't block process exit
  console.log('[clara-review] Background sweep started — runs every 3 minutes');
}

async function runSweep() {
  let tasks: { id: string }[] = [];
  try {
    tasks = getDb()
      .prepare(`SELECT id FROM tasks WHERE status = 'review' AND (reviewStatus IS NULL OR reviewStatus NOT IN ('in-review', 'approved'))`)
      .all() as { id: string }[];
  } catch {
    return; // DB not available
  }

  if (tasks.length === 0) return;

  console.log(`[clara-review] Sweep found ${tasks.length} task(s) pending review`);

  for (const task of tasks) {
    try {
      await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/agents/clara/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });
    } catch {
      // Server might not be ready yet — will retry next sweep
    }
  }
}

// Start on module load (first request warms up the route)
startSweepIfNeeded();

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  // Manual trigger: sweep now and return what was queued
  let tasks: { id: string; title: string }[] = [];
  try {
    tasks = getDb()
      .prepare(`SELECT id, title FROM tasks WHERE status = 'review' AND (reviewStatus IS NULL OR reviewStatus NOT IN ('in-review', 'approved'))`)
      .all() as { id: string; title: string }[];
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
  }

  // Fire off reviews asynchronously (don't await)
  for (const task of tasks) {
    fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/agents/clara/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id }),
    }).catch(() => {});
  }

  return NextResponse.json({
    swept: tasks.length,
    tasks: tasks.map(t => t.id),
    nextSweepInMs: SWEEP_INTERVAL_MS,
  });
}
