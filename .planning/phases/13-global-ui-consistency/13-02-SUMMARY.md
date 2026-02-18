---
phase: 13-global-ui-consistency
plan: 02
subsystem: ui
tags: [react, tailwind, agent-theming, border, agentpanel]

# Dependency graph
requires:
  - phase: 13-global-ui-consistency
    provides: agentThemes utility with per-agent border/bg/text/ring classes
provides:
  - Per-agent theme borders on action row divider, More/Less button, and expanded section divider in AgentPanel
affects:
  - Any future work on AgentPanel.tsx agent card styling

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use theme.border from getAgentTheme() for all border elements on agent cards (not border-clawd-border/50)"

key-files:
  created: []
  modified:
    - src/components/AgentPanel.tsx

key-decisions:
  - "All three border targets (action row divider, More/Less button, expanded divider) now use theme.border from getAgentTheme()"

patterns-established:
  - "Agent card borders: always use theme.border, never hard-coded border-clawd-border/50"

# Metrics
duration: 1min
completed: 2026-02-17
---

# Phase 13 Plan 02: Agent Card Per-Agent Theme Borders Summary

**Three border/divider elements in AgentPanel agent cards now use per-agent theme colors (theme.border) instead of the generic gray border-clawd-border/50**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-17T23:37:56Z
- **Completed:** 2026-02-17T23:39:01Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Action row divider (above Start/Stop/More buttons) now renders with agent's theme color
- More/Less button border now renders with agent's theme color
- Expanded section divider (above metrics/skills/chat) now renders with agent's theme color
- Zero remaining `border-clawd-border/50` in AgentPanel.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace generic borders with per-agent theme borders in AgentPanel.tsx** - `c201c8b` (feat)

**Plan metadata:** (see below in docs commit)

## Files Created/Modified
- `src/components/AgentPanel.tsx` - Three className replacements: action divider, More/Less button, expanded section divider now use `${theme.border}` template literal

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error on line 101 (`window.clawdbot?.agents?.getMetrics()`) was present before changes and is unrelated to this plan. Our changes introduced zero new TypeScript errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three agent card border targets are now themed per-agent
- Ready for next plan in phase 13 (global UI consistency)
- No blockers

---
*Phase: 13-global-ui-consistency*
*Completed: 2026-02-17*
