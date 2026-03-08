---
phase: 34-agent-hire-wizard
plan: 01
subsystem: api + ui
tags: [hire-wizard, workspace, agent-creation]

requires:
  - phase: 33.1-01
    provides: HRAgentCreationModal + catalog registration
provides:
  - POST /api/agents/hire — creates ~/mission-control/agents/{id}/ workspace (CLAUDE.md, SOUL.md, MEMORY.md)
  - agentApi.hire() in api.ts
  - workspace step added to HRAgentCreationModal creation flow (5 total steps)
affects: [37-lifecycle-management]

tech-stack:
  added: []
  patterns: [mkdirSync recursive, writeFileSync for workspace files, MEMORY.md idempotency guard]

key-files:
  created: [app/api/agents/hire/route.ts]
  modified: [src/lib/api.ts, src/components/HRAgentCreationModal.tsx]

key-decisions:
  - "MEMORY.md is not overwritten if it already exists (preserves accumulated memory on re-hire)"
  - "CLAUDE.md and SOUL.md are always written/overwritten (update persona on re-hire)"
  - "memory/ subdirectory created for daily log files"
  - "Workspace step is step 3 of 5 (after soul, before catalog)"

issues-created: []

duration: 10min
completed: 2026-03-06
---

# Phase 34 Plan 01: Agent Hire Wizard Summary

**Workspace creation added to hire flow — ~/mission-control/agents/{id}/ with CLAUDE.md + SOUL.md + MEMORY.md**

## Performance
- **Duration:** 10 min
- **Completed:** 2026-03-06
- **Tasks:** 1 (combined 34-01 + 34-02 into single plan)

## Accomplishments
- `POST /api/agents/hire` creates workspace dir, writes CLAUDE.md (MCP tools, workspace paths, task lifecycle), SOUL.md (persona, capabilities), MEMORY.md (empty template unless exists)
- `agentApi.hire()` added to api.ts
- `workspace` step added as step 3 of 5 in HRAgentCreationModal
- TypeScript clean, build passes — `/api/agents/hire` confirmed in build output

## Task Commits
1. **Task 1: hire endpoint + modal workspace step** — `8ddd868` (feat)

## Files Created/Modified
- `app/api/agents/hire/route.ts` — new endpoint
- `src/lib/api.ts` — agentApi.hire() added
- `src/components/HRAgentCreationModal.tsx` — workspace step added

## Deviations from Plan
- Phase 34 roadmap mentioned "live activity stream in the UI" — the step-by-step progress UI in HRAgentCreationModal already handles this via the existing step animation. Full streaming HR agent for workspace generation is a future enhancement.

## Next Phase Readiness
- Phase 34 complete — hire flow end-to-end: DB → soul file → workspace → catalog → activate
- Ready for Phase 35: Module Library UI

---
*Phase: 34-agent-hire-wizard*
*Completed: 2026-03-06*
