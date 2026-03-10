// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
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

// Background sweep is handled by src/lib/claraReviewCron.ts (started from /api/health).
// This route exists as a manual trigger and status endpoint only.

const SWEEP_INTERVAL_MS = 3 * 60 * 1000; // used in response only

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
