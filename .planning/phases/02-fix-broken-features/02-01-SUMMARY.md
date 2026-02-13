---
phase: 02-fix-broken-features
plan: 01
subsystem: ui, ipc, electron
tags: [openclaw, tailwind, react-grid-layout, json-parse, avatar-grouping, electron-ipc]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: parameterized DB queries, safeStorage for secrets, database.ts shared connection
provides:
  - Working spawn handler using openclaw CLI
  - Correct Dashboard active-work widget layout
  - Tailwind-safe hover classes for agent cards
  - Correct avatar grouping in chat rooms
  - Robust JSON.parse handling in InboxPanel
  - All CLI references use openclaw (not clawdbot)
  - All API key paths use ~/.openclaw/ (not ~/.openclaw/)
affects: [02-fix-broken-features plan 02, 03-add-missing-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HOVER_BG_MAP static lookup pattern for Tailwind JIT dynamic classes"
    - "Pre-filter-then-map pattern for correct index references in filtered arrays"
    - "try/catch guard on all JSON.parse of DB metadata"

key-files:
  created: []
  modified:
    - electron/main.ts
    - src/components/Dashboard.tsx
    - src/components/AgentPanel.tsx
    - src/components/ChatRoomView.tsx
    - src/components/InboxPanel.tsx
    - src/components/VoiceChatPanel.tsx
    - src/components/TaskDetailPanel.tsx
    - src/store/store.ts

key-decisions:
  - "Keep .clawdbot/openclaw.json as legacy config fallback (line 4144)"
  - "Use IIFE wrapper for pre-filtered messages to avoid restructuring JSX tree"
  - "Guard handleAdjust JSON.parse as additional unguarded call found beyond research"

patterns-established:
  - "HOVER_BG_MAP: static Record<string,string> mapping bg classes to hover:bg classes for Tailwind JIT"
  - "displayedMessages: filter first, then map, reference filtered array for prev-message checks"

# Metrics
duration: 5min
completed: 2026-02-12
---

# Phase 2 Plan 1: Fix Broken Features (Mechanical Fixes) Summary

**Fixed 7 broken features: spawn handler (openclaw CLI), Dashboard layout key, Tailwind hover classes (HOVER_BG_MAP), avatar grouping index, unguarded JSON.parse, clawdbot CLI strings, stale API key paths**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-12T10:05:14Z
- **Completed:** 2026-02-12T10:09:47Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Spawn handler (Play button on Kanban tasks) now calls `openclaw agent --agent` instead of deleted Python script
- All 3 API key file reads use `~/.openclaw/` as primary path
- Dashboard active-work widget renders in correct grid position (i: not id:)
- Agent card hover effects work in production builds via HOVER_BG_MAP static lookup
- Chat avatar grouping uses pre-filtered array for correct previous-message comparison
- 2 unguarded JSON.parse calls in InboxPanel now have try/catch guards
- All 4 CLI command strings in VoiceChatPanel, InboxPanel, TaskDetailPanel use `openclaw`

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix main.ts backend issues (FIX-02 + FIX-10)** - `b6283f3` (fix)
2. **Task 2: Fix frontend component bugs (FIX-05/06/07/08/09)** - `51c4c74` (fix)
3. **Extra: Update stale comment in store.ts** - `afa0cbb` (chore)
4. **Extra: Guard additional JSON.parse in InboxPanel** - `18b737e` (fix)

## Files Created/Modified
- `electron/main.ts` - Fixed spawn handler (openclaw CLI) and 3 API key paths (.openclaw/)
- `src/components/Dashboard.tsx` - Fixed react-grid-layout key (id: -> i:)
- `src/components/AgentPanel.tsx` - Added HOVER_BG_MAP for Tailwind JIT hover classes
- `src/components/ChatRoomView.tsx` - Pre-filtered messages for correct avatar grouping
- `src/components/InboxPanel.tsx` - Guarded JSON.parse calls + openclaw CLI ref
- `src/components/VoiceChatPanel.tsx` - Replaced 2 clawdbot CLI strings with openclaw
- `src/components/TaskDetailPanel.tsx` - Replaced clawdbot CLI string + comment with openclaw
- `src/store/store.ts` - Updated stale comment referencing deleted spawn script

## Decisions Made
- Kept `.clawdbot/openclaw.json` at line 4144 as intentional legacy config fallback (it's the second entry in the config search array)
- Used IIFE `(() => { ... })()` wrapper for pre-filtered messages to avoid restructuring the entire JSX tree
- Line 1370 (priority_metadata) and line 1941 (pendingApprovalItem.metadata) were already inside try blocks -- no fix needed despite research listing them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Additional unguarded JSON.parse in handleAdjust**
- **Found during:** Task 2 verification (FIX-08 scope expansion)
- **Issue:** Line 857 JSON.parse(item.metadata) in handleAdjust was not inside any try/catch block. Research only identified 3 sites but this 4th was also unguarded.
- **Fix:** Added try/catch with empty object fallback
- **Files modified:** src/components/InboxPanel.tsx
- **Verification:** Confirmed all JSON.parse(item.metadata) calls are now inside try blocks
- **Committed in:** 18b737e

**2. [Rule 1 - Bug] Stale comment referencing deleted script**
- **Found during:** Final verification scan
- **Issue:** store.ts line 930 comment said "spawn agent via spawn-agent-with-retry" but that script is deleted
- **Fix:** Updated comment to say "via openclaw CLI"
- **Files modified:** src/store/store.ts
- **Committed in:** afa0cbb

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both auto-fixes improve correctness and code accuracy. No scope creep.

## Issues Encountered
- Research listed line 1370 and 1941 as unguarded JSON.parse, but both were already inside try blocks -- no fix needed. Only line 228 and the additionally-discovered line 857 needed guards.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 mechanical FIX requirements resolved (FIX-02, FIX-05, FIX-06, FIX-07, FIX-08, FIX-09, FIX-10)
- FIX-03 (missing AI IPC handlers) remains for plan 02-02
- TypeScript compilation shows only pre-existing errors (none introduced by these changes)

---
*Phase: 02-fix-broken-features*
*Completed: 2026-02-12*
