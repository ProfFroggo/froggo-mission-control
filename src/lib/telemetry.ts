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
