---
phase: 01-security-hardening
plan: 05
subsystem: database
tags: [sql-injection, better-sqlite3, parameterized-queries, ipc-handlers]

requires:
  - phase: 01-security-hardening (01-01)
    provides: "better-sqlite3 database module with prepare() and db.exec()"
  - phase: 01-security-hardening (01-02)
    provides: "Pattern for migrating shell-exec sqlite3 to prepare()"
  - phase: 01-security-hardening (01-04)
    provides: "Migrated folder/pin handlers (same file, different sections)"
provides:
  - "Parameterized task:sync handler (zero SQL injection)"
  - "Parameterized attachment handlers (list, listAll, add, delete)"
  - "Parameterized library handlers (upload, delete, link, view, download)"
  - "Parameterized inbox handlers (addWithMetadata, list, submitRevision, getRevisionContext, markRead)"
  - "Safe stdin-piped inbox:filter (no shell interpolation)"
  - "Parameterized email auto-check inbox INSERT"
  - "Bug fix: library:view and library:download use correct DB path"
affects: [01-06-remaining-handlers, verification]

tech-stack:
  added: []
  patterns:
    - "prepare().run() with ? params for all INSERT/UPDATE/DELETE"
    - "prepare().get() for single-row SELECT"
    - "prepare().all() for multi-row SELECT"
    - "db.exec() for DDL-only statements (CREATE TABLE IF NOT EXISTS)"
    - "execSync with input option for safe stdin piping to scripts"

key-files:
  created: []
  modified:
    - "electron/main.ts"

key-decisions:
  - "library:upload uses db.exec() for CREATE TABLE DDL (no user params) + prepare() for INSERT"
  - "inbox:filter uses execSync with input option instead of echo pipe (avoids shell injection entirely)"
  - "library:view and library:download bug-fixed from wrong path ~/Froggo/clawd/ to correct shared DB via prepare()"
  - "froggo-db CLI calls retained where they are fire-and-forget logging (not SQL injection vectors)"
  - "inbox-filter.sh script calls retained where they handle non-DB operations (toggle-star, add-tag, etc.)"

patterns-established:
  - "Number(result.lastInsertRowid) for getting inserted row ID from RunResult"
  - "db.exec() for DDL that needs no parameters, prepare() for DML with user data"

duration: 20min
completed: 2026-02-12
---

# Phase 01 Plan 05: Task, Attachment, Library, and Inbox Handler Migration Summary

**Parameterized queries for 17 IPC handlers: tasks:sync, 4 attachment, 5 library, 6 inbox, and email auto-check -- eliminating ~20 SQL injection sites and fixing wrong DB path bug in library:view/download**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-02-12T08:55:37Z
- **Completed:** 2026-02-12T09:15:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Eliminated ~20 SQL injection sites across task, attachment, library, and inbox handlers
- Removed 14 `.replace(/'/g, "''")` manual escaping calls
- Fixed bug in library:view and library:download that used wrong DB path (`~/Froggo/clawd/data/froggo.db` instead of `~/froggo/data/froggo.db`)
- Converted async shell-exec patterns to synchronous prepare() calls (faster, more reliable)
- Made inbox:filter safe by using execSync with stdin input option instead of shell echo pipe

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate tasks:create, attachment, and library handlers** - `a2ede3c` (feat)
2. **Task 2: Migrate remaining inbox handlers and email auto-check** - `c73a3c4` (feat)

## Files Created/Modified
- `electron/main.ts` - Migrated 17 IPC handlers from shell-exec sqlite3 to parameterized queries

## Decisions Made
- library:upload uses `db.exec()` for DDL (CREATE TABLE IF NOT EXISTS) since it has no user params, then `prepare()` for the INSERT
- inbox:filter replaced shell echo+pipe with `execSync` input option -- avoids shell injection entirely while keeping the inbox-filter.sh script
- Retained froggo-db CLI calls where they are fire-and-forget activity logging (not SQL injection vectors)
- Retained inbox-filter.sh script calls where they handle non-DB operations (toggle-star, add-tag, etc.)
- Fixed library:view and library:download wrong DB path as a bug fix (Rule 1) -- they referenced ~/Froggo/clawd/ which doesn't exist

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong DB path in library:view and library:download**
- **Found during:** Task 1 (library handler migration)
- **Issue:** Both handlers used `sqlite3 ~/Froggo/clawd/data/froggo.db` -- incorrect path that would fail on fresh systems
- **Fix:** Migrated to `prepare()` which uses the correct shared DB connection from database.ts
- **Files modified:** electron/main.ts
- **Verification:** No hardcoded DB paths remain in library handlers
- **Committed in:** a2ede3c (Task 1 commit)

**2. [Rule 2 - Missing Critical] Migrated attachments:listAll (not explicitly in plan)**
- **Found during:** Task 1 (attachment handler migration)
- **Issue:** attachments:listAll had same shell-exec sqlite3 pattern as attachments:list but wasn't explicitly listed in plan
- **Fix:** Migrated to prepare().all() for consistency
- **Files modified:** electron/main.ts
- **Committed in:** a2ede3c (Task 1 commit)

**3. [Rule 2 - Missing Critical] Migrated inbox:getRevisionContext (not explicitly in plan)**
- **Found during:** Task 2 (inbox handler migration)
- **Issue:** inbox:getRevisionContext used shell-exec sqlite3 with interpolated itemId
- **Fix:** Migrated to prepare().get() with parameterized query
- **Files modified:** electron/main.ts
- **Committed in:** c73a3c4 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness and security coverage. No scope creep.

## Issues Encountered
- Parallel plan 01-04 was modifying the same file (electron/main.ts), causing "file modified since read" errors. Resolved by re-reading and applying edits in larger batches to reduce timing conflicts.

## Next Phase Readiness
- 8 `.replace(/'/g` patterns remain in electron/main.ts (skills handlers, chat:saveMessage, shell escape utilities, search CLI call)
- These are in scope for plan 01-06 (remaining handlers)
- After 01-06: re-run verification to confirm SEC-04 fully satisfied

---
*Phase: 01-security-hardening*
*Completed: 2026-02-12*
