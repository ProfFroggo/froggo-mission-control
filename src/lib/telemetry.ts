// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 85: Telemetry utility — fire-and-forget event tracking

import { getDb } from './database';

/**
 * Track a named event in the telemetry table.
 * Non-blocking, non-fatal — never throws.
 */
export function trackEvent(
  event: string,
  data?: Record<string, unknown>,
  agentId?: string
): void {
  try {
    getDb().prepare(
      `INSERT INTO telemetry (ts, event, data, agentId) VALUES (?, ?, ?, ?)`
    ).run(
      Date.now(),
      event,
      data ? JSON.stringify(data) : null,
      agentId ?? null
    );
  } catch (e) {
    console.warn('[telemetry] Failed to track event:', event, e);
  }
}

// ── Retention ────────────────────────────────────────────────────────────────

const TELEMETRY_RETENTION_DAYS = 30;
const TELEMETRY_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

/** Delete telemetry events older than TELEMETRY_RETENTION_DAYS. */
export function pruneTelemetry(): number {
  try {
    const cutoff = Date.now() - TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const result = getDb().prepare('DELETE FROM telemetry WHERE ts < ?').run(cutoff);
    if (result.changes > 0) {
      console.log(`[telemetry] Pruned ${result.changes} events older than ${TELEMETRY_RETENTION_DAYS} days`);
    }
    return result.changes;
  } catch (e) {
    console.warn('[telemetry] Failed to prune:', e);
    return 0;
  }
}

type G = typeof globalThis & { _telemetryPruneTimer?: ReturnType<typeof setInterval> };

/** Start periodic telemetry cleanup. Safe to call multiple times (idempotent). */
export function startTelemetryRetention(): void {
  const g = globalThis as G;
  if (g._telemetryPruneTimer) return;
  // Run once on startup, then periodically
  pruneTelemetry();
  const timer = setInterval(pruneTelemetry, TELEMETRY_PRUNE_INTERVAL_MS);
  timer.unref?.();
  g._telemetryPruneTimer = timer;
}
