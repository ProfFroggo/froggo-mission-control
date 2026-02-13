---
phase: 09-outline-versions
plan: 01
subsystem: ui
tags: [dnd-kit, react, sortable, drag-drop, collapsible, writing]

# Dependency graph
requires:
  - phase: 05-writing-core
    provides: "ChapterSidebar, ChapterListItem, writingStore with reorderChapters"
  - phase: 05-writing-core
    provides: "@dnd-kit packages installed, EditPanelsModal DnD pattern"
provides:
  - "Drag-and-drop chapter reordering via GripVertical handle"
  - "Collapsible chapter list section with toggle"
  - "Persistent reorder via reorderChapters store action"
affects: [09-02, version-history, outline-tree]

# Tech tracking
tech-stack:
  added: []
  patterns: ["useSortable + GripVertical handle pattern for list items", "Collapsible section with ChevronDown rotation"]

key-files:
  created: []
  modified:
    - "src/components/writing/ChapterListItem.tsx"
    - "src/components/writing/ChapterSidebar.tsx"

key-decisions:
  - "GripVertical handle-only drag (listeners on handle, not whole item) for click-to-select compatibility"
  - "ChevronDown rotates -90deg when collapsed (down=expanded, right=collapsed)"

patterns-established:
  - "Sortable list item pattern: outer div with setNodeRef/style, separate grip button with attributes/listeners"
  - "Collapsible section: useState toggle + conditional render + rotating chevron"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 9 Plan 01: Outline Versions - Chapter DnD & Collapsible Summary

**Drag-and-drop chapter reordering with GripVertical handle and collapsible Chapters section in sidebar using @dnd-kit**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T00:31:56Z
- **Completed:** 2026-02-13T00:33:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ChapterListItem now has a sortable GripVertical drag handle visible on hover
- ChapterSidebar wraps chapter list in DndContext/SortableContext with handleDragEnd
- Collapsible "Chapters (N)" header toggles chapter list visibility
- Drag listeners are only on the grip handle, preserving click-to-select on the item body

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sortable drag-and-drop to ChapterListItem** - `ce71b06` (feat)
2. **Task 2: Wire DndContext into ChapterSidebar with collapsible toggle** - `81d27d8` (feat)

## Files Created/Modified
- `src/components/writing/ChapterListItem.tsx` - Added useSortable hook, GripVertical handle, sortable ref wrapper
- `src/components/writing/ChapterSidebar.tsx` - Added DndContext/SortableContext, collapsible toggle, handleDragEnd with arrayMove

## Decisions Made
- GripVertical handle-only drag: listeners on handle button, not whole item -- preserves click-to-select behavior
- ChevronDown rotation: -90deg when collapsed (rotated right), 0deg when expanded (pointing down) with smooth transition
- 5px activation constraint on PointerSensor to prevent accidental drags from clicks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DnD chapter reordering and collapsible outline complete
- Ready for 09-02 (version snapshots / chapter history)
- All existing chapter functionality (select, rename, delete, create) unchanged and compatible

---
*Phase: 09-outline-versions*
*Completed: 2026-02-13*
