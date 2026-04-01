---
phase: 03-task-dispatcher-hardening
plan: 01
subsystem: dispatcher
provides: [process-timeout, agent-busy-tracking, dispatch-health-api]
affects: [04-auto-advance-recovery]
key-files: [src/lib/taskDispatcher.ts, app/api/dispatch-health/route.ts]
key-decisions:
  - 30-minute process timeout with SIGTERM→SIGKILL escalation
  - Agent status set to busy/idle based on active task count
  - Timed-out tasks return to todo (not human-review)
---

# Phase 3 Plan 1: Task Dispatcher Hardening — Summary

**Added 30-minute process timeout, agent busy/idle tracking, and dispatch health API.**

## Prior Work (from critical bug fixes)

Most Phase 3 roadmap goals were already implemented during bug fix sessions:
- Spawn args audit: `--dangerously-skip-permissions`, empty `--disallowedTools` guard
- Circuit breaker: 3-failure threshold, 10-minute auto-recovery, SSE events
- Dispatch failure → todo with exponential backoff (2s, 4s delays, 3 attempts max)
- Startup stuck task recovery with staggered re-dispatch

## Accomplishments (this plan)

- **Process timeout**: Hung Claude CLI processes killed after 30 minutes (SIGTERM, then SIGKILL after 5s). Timed-out tasks return to `todo` for retry. Timeout cleared on normal process exit.
- **Agent busy/idle tracking**: Agent status set to `busy` on dispatch, `idle` on clean exit (only if no other in-progress tasks), `idle` on failure (circuit breaker may override to `offline`)
- **Dispatch health API**: `GET /api/dispatch-health` returns active dispatch count, circuit breaker state per agent, and last-hour success/failure/timeout counts

## Files Created/Modified

- `src/lib/taskDispatcher.ts` — process timeout, agent status updates, exported `getActiveDispatchCount()`
- `app/api/dispatch-health/route.ts` — new health endpoint

## Decisions Made

- 30-minute timeout chosen: long enough for complex tasks, short enough to catch hung processes
- Timed-out tasks go to `todo` (same as dispatch failures) rather than `human-review`

## Issues Encountered

None.

## Next Step

Phase 3 complete — ready for Phase 4 (Auto-advance & Recovery).
