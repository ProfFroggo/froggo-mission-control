---
phase: 13-global-ui-consistency
plan: "01"
subsystem: ui
tags: [tailwind, css-custom-properties, design-tokens, dark-mode, theming]

# Dependency graph
requires: []
provides:
  - CSS custom properties --clawd-bg-alt, --clawd-bg0, --clawd-card defined in :root and :root.light
  - Tailwind color tokens clawd.bg-alt, clawd.bg0, clawd.card mapped to CSS vars
  - Visible backgrounds in both dark and light mode for 40+ components
affects:
  - All phases that add or modify component UI (input backgrounds, card surfaces, status displays)
  - Any UI audit/repair work that checks for transparent backgrounds

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS custom property + Tailwind fallback pattern: 'token': 'var(--token, #fallback)'"
    - "Dark/light theme via :root (dark default) + :root.light (light override)"

key-files:
  created: []
  modified:
    - src/index.css
    - tailwind.config.js

key-decisions:
  - "bg-alt set to #1a1a1a (dark) / #f4f4f5 (light) — midpoint between bg and surface, distinct from both"
  - "bg0 set to #0a0a0a (dark) / #fafafa (light) — same as --clawd-bg, for semantic clarity"
  - "card set to #141414 (dark) / #ffffff (light) — same as --clawd-surface, for semantic clarity"
  - "Tailwind fallbacks match dark-mode values as safe default"

patterns-established:
  - "New color tokens: define in src/index.css (:root and :root.light), then expose in tailwind.config.js clawd object"

# Metrics
duration: ~1min
completed: 2026-02-17
---

# Phase 13 Plan 01: Global UI Consistency Summary

**Defined three missing CSS token trio (--clawd-bg-alt, --clawd-bg0, --clawd-card) that caused transparent backgrounds across 40+ components in dark mode**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-17T23:37:38Z
- **Completed:** 2026-02-17T23:38:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Three CSS custom properties added to `:root` (dark) and `:root.light` (light) in `src/index.css`
- Three Tailwind color utilities added to `clawd` color group in `tailwind.config.js`
- `bg-clawd-bg-alt`, `bg-clawd-bg0`, `bg-clawd-card` now resolve to visible hex colors instead of transparent
- Root cause of UI-01 (white-on-white inputs in dark mode) addressed at the token definition layer

## Task Commits

Each task was committed atomically:

1. **Task 1: Add missing CSS custom properties to index.css** - `6fbb49f` (feat)
2. **Task 2: Add missing Tailwind color tokens to tailwind.config.js** - `95ffa93` (feat)

## Files Created/Modified
- `src/index.css` - Added --clawd-bg-alt, --clawd-bg0, --clawd-card to both :root and :root.light blocks
- `tailwind.config.js` - Added bg-alt, bg0, card entries to clawd color object with var() + fallback pattern

## Decisions Made
- **bg-alt value:** #1a1a1a dark / #f4f4f5 light — a step between pure black bg and surface, appropriate for input field backgrounds
- **bg0 and card values:** mirror existing --clawd-bg and --clawd-surface respectively, adding semantic aliases rather than new visual values
- **Tailwind fallback:** Dark-mode values used as fallback (safe default, renders correctly if CSS var fails to resolve)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors exist in the codebase (unrelated to CSS changes) — confirmed no new errors introduced by this plan. The TS errors are about IPC handler type definitions and will be addressed by later plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Token foundation is in place. All 40+ components using `bg-clawd-bg-alt`, `bg-clawd-bg0`, `bg-clawd-card` now resolve to visible colors.
- Ready for Phase 13 Plan 02 (audit and fix remaining UI consistency issues).

---
*Phase: 13-global-ui-consistency*
*Completed: 2026-02-17*
