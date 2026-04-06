// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

/**
 * Task state machine — single source of truth for valid status transitions.
 *
 * Pipeline:
 *   todo -> internal-review -> in-progress -> review -> done
 *   Any stage can go to/from human-review.
 *
 * Rules:
 * - todo -> in-progress is BLOCKED (must go through internal-review first)
 * - Agents CANNOT set internal-review — SYSTEM manages it when a task is assigned
 * - Agents CANNOT set done — only Clara can after review
 * - `blocked` status does NOT exist — use `human-review` instead
 * - `failed` and `cancelled` are terminal-ish states with limited re-entry
 */

const _VALID_STATUSES = [
  'todo',
  'internal-review',
  'in-progress',
  'review',
  'human-review',
  'done',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof _VALID_STATUSES)[number];

/** All valid task statuses. Use for runtime validation (e.g. `.includes()`). */
export const VALID_STATUSES: string[] = [..._VALID_STATUSES];

/**
 * Map of each status to the statuses it can transition to.
 * This must stay in sync with the store's moveTask() VALID_TRANSITIONS,
 * plus the API-only statuses (failed, cancelled) that don't exist in the
 * frontend store.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  'todo':            ['internal-review', 'human-review', 'cancelled'],
  'internal-review': ['in-progress', 'todo'],
  'in-progress':     ['review', 'human-review', 'failed', 'cancelled'],
  'review':          ['done', 'in-progress', 'human-review'],
  'human-review':    ['in-progress', 'todo', 'review', 'done', 'cancelled'],
  'done':            ['in-progress'],  // reopen
  'failed':          ['todo', 'in-progress'],
  'cancelled':       ['todo'],
};

/**
 * Validates whether a status transition is allowed.
 *
 * @returns null if the transition is valid, or an error message string if invalid.
 */
export function validateTransition(
  currentStatus: string,
  newStatus: string
): string | null {
  // Same status — no-op, allow it (not really a transition)
  if (currentStatus === newStatus) return null;

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    return `Unknown current status: "${currentStatus}"`;
  }

  if (!allowed.includes(newStatus)) {
    return `Invalid transition: ${currentStatus} \u2192 ${newStatus}`;
  }

  return null;
}
