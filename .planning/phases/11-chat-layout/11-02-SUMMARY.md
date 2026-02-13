---
phase: 11-chat-layout
plan: 02
subsystem: ui
tags: [react-resizable-panels, tiptap, resizable-layout, writing-workspace]

# Dependency graph
requires:
  - phase: 11-chat-layout/01
    provides: "Writing workspace foundation (ProjectEditor, ChapterEditor, stores)"
provides:
  - "3-pane resizable layout with collapsible sidebar and chat pane"
  - "react-resizable-panels v4 integration with Layout persistence"
  - "Selection highlight CSS for TipTap blur state"
  - "Chat pane placeholder ready for Plan 03 replacement"
affects: [11-chat-layout/03, 11-chat-layout/04]

# Tech tracking
tech-stack:
  added: [react-resizable-panels@4.6.2, "@tiptap/markdown@3.19.0", "@tiptap/extensions@3.19.0"]
  patterns: ["v4 API (Group/Panel/Separator not PanelGroup/PanelResizeHandle)", "Layout type is {[id:string]:number} map not number[]", "PanelImperativeHandle for collapse/expand", "onResize with PanelSize.asPercentage for collapse detection"]

key-files:
  created: []
  modified:
    - "src/components/writing/ProjectEditor.tsx"
    - "src/styles/writing-editor.css"
    - "package.json"

key-decisions:
  - "v4 Layout type is object map {chapters:15, chat:30, editor:55} not array [15,30,55] -- research doc was incorrect"
  - "Collapse state tracked via onResize PanelSize.asPercentage === 0 (no onCollapse/onExpand callbacks in v4)"
  - "ChapterSidebar w-64 override via [&>div]:!w-full Tailwind arbitrary selector to prevent fixed-width conflict with resizable panel"
  - "Context/Version panels as absolute overlays inside editor pane (not additional resizable panels)"

patterns-established:
  - "react-resizable-panels v4: Group/Panel/Separator imports, orientation not direction, Layout not number[]"
  - "Panel collapse detection: onResize + PanelSize.asPercentage === 0"
  - "Imperative panel control: panelRef prop with PanelImperativeHandle.collapse()/expand()"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 11 Plan 02: 3-Pane Resizable Layout Summary

**react-resizable-panels v4 3-pane layout with collapsible chapters sidebar and chat placeholder, layout persistence to localStorage, and TipTap selection highlight CSS**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T03:03:18Z
- **Completed:** 2026-02-13T03:07:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Installed react-resizable-panels v4.6.2, @tiptap/markdown, @tiptap/extensions
- Rewrote ProjectEditor from 70-line flex layout to 220-line 3-pane resizable layout
- Chapters sidebar and chat pane are collapsible to zero width with toggle buttons
- Layout persists to localStorage as object map keyed by panel id
- Context and Version panels render as absolute overlays inside editor pane
- Selection highlight CSS ready for TipTap Selection extension

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm packages** - `b8ab54f` (chore)
2. **Task 2: Rewrite ProjectEditor with 3-pane layout and add CSS** - `9ab4db9` (feat)

## Files Created/Modified
- `package.json` - Added react-resizable-panels, @tiptap/markdown, @tiptap/extensions dependencies
- `src/components/writing/ProjectEditor.tsx` - Complete rewrite: 3-pane resizable layout with Group/Panel/Separator, collapse/expand toggle, layout persistence
- `src/styles/writing-editor.css` - Added .selection highlight class and separator transition styles

## Decisions Made
- v4 `Layout` type is `{[id: string]: number}` object map, not `number[]` array. The research doc incorrectly described it as array format based on v3 behavior. Fixed during implementation.
- No `onCollapse`/`onExpand` callbacks exist in v4. Collapse state is detected via `onResize` callback when `PanelSize.asPercentage === 0`.
- ChapterSidebar has hardcoded `w-64` class. Rather than modifying the component (plan says no changes needed), used `[&>div]:!w-full` Tailwind arbitrary selector in the wrapper to override.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed v4 API type mismatches from research doc**
- **Found during:** Task 2 (ProjectEditor rewrite)
- **Issue:** Research doc described `defaultLayout` as `number[]` and `onLayoutChanged` taking `number[]`. Actual v4 API uses `Layout` type (`{[id: string]: number}`) and `PanelSize` type (`{asPercentage, inPixels}`).
- **Fix:** Updated all type signatures to match actual v4 API: `Layout` for layout persistence, `PanelSize` for resize callbacks, `PanelImperativeHandle` (not `ImperativePanelHandle`) for panel refs.
- **Files modified:** src/components/writing/ProjectEditor.tsx
- **Verification:** `npx tsc --noEmit` shows zero errors in ProjectEditor.tsx
- **Committed in:** 9ab4db9

---

**Total deviations:** 1 auto-fixed (1 bug -- incorrect type information in research doc)
**Impact on plan:** Essential for TypeScript compilation. No scope creep. Same functionality, correct types.

## Issues Encountered
- Pre-existing TypeScript errors throughout the codebase (70+ errors in Dashboard.tsx, ChatRoomView.tsx, VoiceChatPanel.tsx, etc.) unrelated to this plan. ProjectEditor.tsx compiles clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 3-pane layout skeleton is complete and ready for Plan 03 to replace the chat placeholder with ChatPane
- Layout persistence, collapse/expand, and separator styling are all functional
- No blockers for Plan 03

---
*Phase: 11-chat-layout*
*Completed: 2026-02-13*
