---
phase: 08-research-library
plan: 01
subsystem: database
tags: [better-sqlite3, ipc, research, fact-source-linking, preload-bridge]

# Dependency graph
requires:
  - phase: 07-memory-store
    provides: VerifiedFact type, writing-memory-service pattern, preload bridge pattern
provides:
  - writing-research-service.ts with 9 IPC handlers for source CRUD and fact-source linking
  - writingResearchDbPath helper in paths.ts
  - Preload bridge for writing.research.sources.* and writing.research.links.*
  - Extended VerifiedFact status type with 'needs-source'
affects: [08-02 (UI components depend on these IPC handlers and preload bridge)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-project SQLite with lazy init and connection cache (Map<string, Database>)"
    - "Fact-source junction table with ON DELETE CASCADE for source cleanup"

key-files:
  created:
    - electron/writing-research-service.ts
  modified:
    - electron/paths.ts
    - electron/main.ts
    - electron/preload.ts
    - electron/writing-memory-service.ts
    - src/store/memoryStore.ts
    - src/components/writing/FactList.tsx
    - src/components/writing/FactForm.tsx

key-decisions:
  - "Per-project research.db (not shared) for data isolation and portability"
  - "Synchronous better-sqlite3 API for all research DB operations (no async needed)"
  - "Blue badge with 'S' label for needs-source status"

patterns-established:
  - "Per-project SQLite DB with lazy init, WAL mode, foreign keys ON, connection cache"
  - "Junction table pattern for cross-storage linking (JSON facts <-> SQLite sources)"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 8 Plan 01: Research Library Backend Summary

**Per-project SQLite research DB with sources table, fact-source junction table, 9 IPC handlers, preload bridge, and 'needs-source' fact status extension across 4 files**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T23:55:31Z
- **Completed:** 2026-02-12T23:58:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Per-project SQLite research database with WAL mode, foreign keys, and lazy connection cache
- Source CRUD (list, create, update, delete) via IPC with parameterized queries
- Fact-source many-to-many linking via junction table with ON DELETE CASCADE
- VerifiedFact status extended to include 'needs-source' in all 4 locations

## Task Commits

Each task was committed atomically:

1. **Task 1: Research service + paths + IPC registration** - `53ddbd0` (feat)
2. **Task 2: Preload bridge + fact status enum extension** - `b9541aa` (feat)

## Files Created/Modified
- `electron/writing-research-service.ts` - NEW: SQLite CRUD for sources + fact_sources junction table + 9 IPC handlers (287 lines)
- `electron/paths.ts` - Added writingResearchDbPath helper
- `electron/main.ts` - Import + registerWritingResearchHandlers() call + closeAllResearchDbs() on shutdown
- `electron/preload.ts` - Added writing.research.sources.* and writing.research.links.* bridge methods (9 channels)
- `electron/writing-memory-service.ts` - Extended VerifiedFact status type to include 'needs-source'
- `src/store/memoryStore.ts` - Extended VerifiedFact status type to include 'needs-source'
- `src/components/writing/FactList.tsx` - Added blue badge + 'S' label for needs-source status
- `src/components/writing/FactForm.tsx` - Added 'Needs Source' option to status dropdown

## Decisions Made
- Per-project research.db (not shared) matches existing per-project file layout and keeps data portable
- Used synchronous better-sqlite3 directly (no async wrapper) since all operations are fast local I/O
- Blue badge for needs-source status distinguishes it visually from the yellow/green/red of existing statuses
- cleanOrphanedLinks function handles cross-storage consistency (JSON facts + SQLite sources)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 9 IPC handlers ready for Plan 02 UI components (SourceList, SourceForm, researchStore)
- Preload bridge methods available for frontend Zustand store
- Fact status 'needs-source' renders correctly in existing FactList
- Research DB connections properly cleaned up on app shutdown

---
*Phase: 08-research-library*
*Completed: 2026-02-13*
