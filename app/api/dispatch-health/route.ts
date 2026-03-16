// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getCircuitBreakerState, getActiveDispatchCount } from '@/lib/taskDispatcher';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    // Recent dispatch failures
    const recentFailures = (db.prepare(
      `SELECT COUNT(*) as cnt FROM task_activity WHERE action = 'dispatch_failed' AND timestamp > ?`
    ).get(oneHourAgo) as { cnt: number } | undefined)?.cnt ?? 0;

    // Recent timeouts
    const recentTimeouts = (db.prepare(
      `SELECT COUNT(*) as cnt FROM task_activity WHERE action = 'dispatch_timeout' AND timestamp > ?`
    ).get(oneHourAgo) as { cnt: number } | undefined)?.cnt ?? 0;

    // Recent successful dispatches
    const recentSuccesses = (db.prepare(
      `SELECT COUNT(*) as cnt FROM task_activity WHERE action = 'dispatch_exit' AND timestamp > ?`
    ).get(oneHourAgo) as { cnt: number } | undefined)?.cnt ?? 0;

    return NextResponse.json({
      activeDispatches: getActiveDispatchCount(),
      circuitBreakers: getCircuitBreakerState(),
      lastHour: {
        successes: recentSuccesses,
        failures: recentFailures,
        timeouts: recentTimeouts,
      },
    });
  } catch (err) {
    console.error('[dispatch-health]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
