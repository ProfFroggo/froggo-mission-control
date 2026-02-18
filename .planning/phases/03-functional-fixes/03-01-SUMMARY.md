---
phase: 03-functional-fixes
plan: 01
subsystem: ui
tags: [react, routing, error-boundary, ipc, notifications, debounce]

# Dependency graph
requires:
  - phase: 02-fix-broken-features
    provides: IPC channel fixes and AI handler restoration
provides:
  - 9-agent routing table in matchTaskToAgent()
  - DMFeed error boundary via ProtectedPanels
  - IPC null guards for web mode safety across 11 call sites
  - Per-type notification debounce timers
affects: [03-02-PLAN, 04-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordered regex routing table for agent matching (more specific patterns first)"
    - "Per-type debounce Map pattern for independent event timers"
    - "IPC null guard pattern: check window.clawdbot?.namespace before calling"

key-files:
  created: []
  modified:
    - src/lib/agents.ts
    - src/components/InboxPanel.tsx
    - src/components/ProtectedPanels.tsx
    - src/App.tsx
    - src/components/TokenUsageWidget.tsx
    - src/components/AgentTokenDetailModal.tsx
    - src/components/TaskDetailPanel.tsx
    - src/components/DMFeed.tsx
    - src/lib/notificationService.ts

key-decisions:
  - "Ordered regex routing: designer/social-manager/growth-director first, coder/writer/chief last as catch-alls"
  - "DMFeed gets default export added for lazy import compatibility"
  - "Per-type debounce Map replaces single refreshTimer to prevent cross-type cancellation"

patterns-established:
  - "Agent routing: ordered regex table in matchTaskToAgent(), specific patterns before generic"
  - "IPC guard: always check window.clawdbot?.namespace before any IPC call, return gracefully in web mode"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 3 Plan 1: Functional Fixes Summary

**9-agent routing table, DMFeed error boundary, 11 IPC null guards, and per-type notification debounce**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T10:44:47Z
- **Completed:** 2026-02-12T10:48:47Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Expanded matchTaskToAgent from 4-agent if-chain to 9-agent ordered regex routing table (designer, social-manager, growth-director, hr, lead-engineer, coder, researcher, writer, chief)
- Wired InboxPanel to use matchTaskToAgent at both approval points -- no more hardcoded 'coder' assignment
- Wrapped DMFeed in error boundary via ProtectedPanels with lazy loading
- Added IPC null guards to all call sites in TokenUsageWidget, AgentTokenDetailModal, TaskDetailPanel, and DMFeed for web mode safety
- Replaced single refreshTimer with per-type Map so task/approval/message notifications debounce independently

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand agent routing table and wire InboxPanel** - `52fb55c` (feat)
2. **Task 2: DMFeed error boundary, IPC null guards, notification debounce fix** - `b20129e` (feat)

## Files Created/Modified
- `src/lib/agents.ts` - 9-agent ordered regex routing table in matchTaskToAgent()
- `src/components/InboxPanel.tsx` - Import matchTaskToAgent, use at both approval sites
- `src/components/ProtectedPanels.tsx` - Add DMFeed lazy import + error boundary wrapper
- `src/App.tsx` - Import DMFeed from ProtectedPanels instead of directly
- `src/components/TokenUsageWidget.tsx` - IPC null guard for tokens.summary/budget
- `src/components/AgentTokenDetailModal.tsx` - IPC null guard for tokens.log
- `src/components/TaskDetailPanel.tsx` - IPC null guards for tasks.attachments, exec.run, fs.writeBase64
- `src/components/DMFeed.tsx` - IPC null guard for getDMHistory + default export for lazy loading
- `src/lib/notificationService.ts` - Per-type debounce Map replacing single refreshTimer

## Decisions Made
- Ordered regex routing: designer/social-manager/growth-director checked first (more specific multi-word patterns), coder/writer/chief last (broader catch-all patterns)
- Added default export to DMFeed.tsx because React.lazy() requires default exports
- Used Map<string, Timer> for notification debounce so task event at 0ms and message event at 50ms both fire their respective refreshes (previously the message would cancel the pending task refresh)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added default export to DMFeed.tsx**
- **Found during:** Task 2 (DMFeed error boundary)
- **Issue:** DMFeed only had a named export (`export const DMFeed`), but `React.lazy()` requires a default export
- **Fix:** Added `export default DMFeed;` at end of file
- **Files modified:** src/components/DMFeed.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** b20129e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for lazy loading to work. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in Dashboard.tsx (layout types), InboxPanel.tsx (reviewStatus type), and genai module declarations exist but are unrelated to this plan's changes. No new errors introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent routing covers all 9 agents -- inbox approvals now route correctly
- All panels safe for web mode (no IPC crashes)
- Notification service handles concurrent events without dropping
- Ready for 03-02-PLAN (remaining functional fixes)

---
*Phase: 03-functional-fixes*
*Completed: 2026-02-12*
