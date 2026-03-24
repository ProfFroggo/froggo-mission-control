---
phase: 04-auto-advance-recovery
plan: 01
subsystem: pipeline
provides: [human-review-redispatch, stuck-escalation, stale-alerts]
affects: [05-agent-memory-unification]
key-files: [app/api/tasks/[id]/route.ts, src/lib/claraReviewCron.ts]
key-decisions:
  - human-review→in-progress auto-dispatches agent
  - 4h+ stuck with 3+ re-dispatches escalates to human-review
  - 24h+ human-review gets daily chat room reminder
---

# Phase 4 Plan 1: Auto-advance & Recovery — Summary

**Closed every dead-end in the task pipeline — human-review auto-resumes, stuck tasks escalate, stale reviews alert.**

## Prior Work

- Auto-advance todo→internal-review already implemented in claraReviewCron
- Stuck in-progress 30-min re-dispatch already working
- human-review→done transition already allowed in store

## Accomplishments

- **Human-review → in-progress auto-dispatch**: When human resolves a blocker and moves task back to in-progress, the assigned agent is automatically re-dispatched. Activity logged.
- **4h+ stuck escalation**: Tasks stuck in-progress >4h with 3+ recovery re-dispatches automatically move to human-review with detailed message. Notification posted to mission-control chat room.
- **24h+ stale human-review alerts**: Tasks sitting in human-review >24h get a daily reminder posted to mission-control chat room. Alert only fires once per 24h.
- **Previous status capture**: PATCH handler now captures `previousStatus` before writing update, enabling transition-based triggers.

## Files Modified

- `app/api/tasks/[id]/route.ts` — human-review→in-progress redispatch, previousStatus capture
- `src/lib/claraReviewCron.ts` — 4h stuck escalation, 24h stale alert passes

## Decisions Made

- 4h threshold with 3+ re-dispatches for escalation (prevents premature escalation)
- Chat room notifications for visibility (not just activity log entries)

## Issues Encountered

- PATCH handler didn't have pre-update task state — added `previousStatus` capture

## Next Step

Phase 4 complete — ready for Phase 5 (Agent Memory Unification).
