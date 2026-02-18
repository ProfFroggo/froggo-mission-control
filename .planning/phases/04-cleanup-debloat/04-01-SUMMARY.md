---
phase: 04-cleanup-debloat
plan: 01
subsystem: ui
tags: [react, typescript, dead-code, cleanup, tree-shaking]

# Dependency graph
requires:
  - phase: 03-functional-fixes
    provides: stable component code to clean up
provides:
  - Clean src/ tree with zero dead lib files, zero dead components, zero backup files
  - ~18,500 lines of dead code and backup files removed
affects: [all future development -- smaller codebase, faster builds, clearer imports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Direct component imports instead of ProtectedPanels re-exports for dead panels

key-files:
  created: []
  modified:
    - src/components/ProtectedPanels.tsx
    - src/store/store.ts
    - src/lib/agents.ts
    - src/components/CodeAgentDashboard.tsx
    - src/components/XAutomationsPanel.tsx
    - src/components/TaskDetailPanel.tsx
    - src/components/SessionsFilter.tsx
    - src/components/InboxPanel.tsx
    - src/components/SettingsPanel.tsx
    - src/components/ReportsPanel.tsx
    - src/components/QuickStatsWidget.tsx
    - src/components/Kanban.tsx
    - src/components/ContextControlBoard.tsx
    - src/components/EpicCalendar.tsx
    - src/components/MarkdownMessage.tsx

key-decisions:
  - "ContentCalendar file kept (used by XPanel.tsx) but its dead ProtectedPanels export removed"
  - "SettingsPanel dead _notifPrefs useState AND its useEffect loader both removed together"

patterns-established:
  - "No underscore-prefixed unused state variables in components"
  - "No commented-out code blocks in components"

# Metrics
duration: 6min
completed: 2026-02-12
---

# Phase 4 Plan 1: Dead Code & Backup File Cleanup Summary

**Deleted 12 dead files, 17 backup files, and removed ~60 lines of dead code from 15 live files -- 18,500+ total lines removed**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-12T11:26:57Z
- **Completed:** 2026-02-12T11:33:01Z
- **Tasks:** 2
- **Files deleted:** 29 (12 dead source + 17 backup)
- **Files modified:** 15

## Accomplishments
- Deleted 7 dead lib files (readState, queryCache, optimizedQueries, performanceMonitoring, smartAccountSelector, voiceService, api/gateway)
- Deleted 5 dead component files (ThreePaneInbox, CommsInbox, UnifiedCommsInbox, ThreadedCommsInbox, CalendarPanel)
- Removed 5 dead lazy import/export pairs from ProtectedPanels.tsx
- Removed clearCompletedApprovals from store.ts (interface + implementation)
- Removed getAgentPrompt from agents.ts (dead function returning empty string)
- Removed 8 underscore-prefixed unused state variables across 6 components
- Removed 10 commented-out code blocks across 8 components
- Deleted all 17 backup/bak/original files from src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead lib files, dead component files, and dead ProtectedPanels exports** - `cdbaa46` (chore)
2. **Task 2: Remove dead store code, dead component code, and all backup files** - `29259b8` (chore)

## Files Deleted
- `src/lib/readState.ts` - Unused read state tracking
- `src/lib/queryCache.ts` - Unused query cache layer
- `src/lib/optimizedQueries.ts` - Unused optimized query module
- `src/lib/performanceMonitoring.ts` - Unused performance monitoring (note: performanceMonitor.ts is ALIVE)
- `src/lib/smartAccountSelector.ts` - Unused account selector
- `src/lib/voiceService.ts` - Unused voice service
- `src/api/gateway.ts` - Dead API gateway (live gateway is at src/lib/gateway.ts)
- `src/components/ThreePaneInbox.tsx` - Superseded inbox variant
- `src/components/CommsInbox.tsx` - Superseded inbox variant
- `src/components/UnifiedCommsInbox.tsx` - Superseded inbox variant
- `src/components/ThreadedCommsInbox.tsx` - Superseded inbox variant
- `src/components/CalendarPanel.tsx` - Superseded by EpicCalendar
- 17 backup/bak/original files across src/components/, src/lib/, src/store/

## Files Modified
- `src/components/ProtectedPanels.tsx` - Removed 5 dead lazy imports and exports
- `src/store/store.ts` - Removed clearCompletedApprovals interface and implementation
- `src/lib/agents.ts` - Removed dead getAgentPrompt function and its call site
- `src/components/CodeAgentDashboard.tsx` - Removed _totalCost state and commented formatDuration
- `src/components/XAutomationsPanel.tsx` - Removed _executions state and commented ACTION_ICONS
- `src/components/TaskDetailPanel.tsx` - Removed _loading, _showAgentWarning, _activeAgentSession states
- `src/components/SessionsFilter.tsx` - Removed _showDropdown state
- `src/components/InboxPanel.tsx` - Removed _collapsedLanes state
- `src/components/SettingsPanel.tsx` - Removed _notifPrefs state and its useEffect loader
- `src/components/ReportsPanel.tsx` - Removed commented __report line
- `src/components/QuickStatsWidget.tsx` - Removed commented __activeSessions line
- `src/components/Kanban.tsx` - Removed commented formatRelativeTime, isDueSoon, assignees
- `src/components/ContextControlBoard.tsx` - Removed commented __escaped variable
- `src/components/EpicCalendar.tsx` - Removed commented __lastDay variable
- `src/components/MarkdownMessage.tsx` - Removed commented parts array

## Decisions Made
- ContentCalendar.tsx file kept (used by XPanel.tsx) but its dead ProtectedPanels export removed
- SettingsPanel: removed both _notifPrefs useState AND the useEffect that loaded prefs into it (both dead together)
- agents.ts getAgentPrompt removal: simplified spawn call from `${systemPrompt}\n\n## YOUR TASK\n${task}` to `## YOUR TASK\n${task}` since the function always returned empty string

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- src/ tree is now lean: zero dead lib files, zero dead component files, zero backup files
- 24 pre-existing TypeScript errors remain (App.tsx View types, Dashboard layout types, InboxPanel reviewStatus, TokenUsageWidget percent_used, gemini module declarations) -- these predate this plan
- Ready for 04-02 (component CSS and debug cleanup)

---
*Phase: 04-cleanup-debloat*
*Completed: 2026-02-12*
