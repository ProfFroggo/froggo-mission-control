---
phase: 01-security-hardening
plan: 04
subsystem: ipc-database
tags: [sql-injection, parameterized-queries, better-sqlite3, folders, pins]
completed: 2026-02-12
duration: ~13min
dependency-graph:
  requires: ["01-03"]
  provides: ["Parameterized folder and pin handlers"]
  affects: ["01-05", "01-06"]
tech-stack:
  patterns: ["prepare().run/get/all() with ? params", "synchronous better-sqlite3 over async exec", "dynamic SET with code-controlled field names"]
key-files:
  modified: ["electron/main.ts"]
decisions:
  - id: DEC-01-04-01
    decision: "Use db.prepare() directly for folders:update dynamic SET clause (not cached prepare())"
    rationale: "Dynamic SQL with variable SET fields would bloat statement cache"
metrics:
  tasks-completed: 2
  tasks-total: 2
  sql-injection-sites-eliminated: 21
  remaining-after: 32
---

# Phase 01 Plan 04: Folder and Pin Handler Migration Summary

Migrated all message folder (13 handlers) and conversation pin (7 handlers) IPC handlers from shell-exec sqlite3 with manual escaping to parameterized queries via better-sqlite3 prepare().

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Migrate message folder handlers | 6019cf7 | 13 folder/rule handlers converted to prepare() |
| 2 | Migrate conversation pin handlers | ec7608e | 7 pin handlers converted, 4-level nesting flattened |

## What Changed

### Task 1: Folder Handlers (13 handlers)
- `folders:list` -- simple SELECT, removed exec+JSON.parse wrapper
- `folders:create` -- INSERT with ? params, lastInsertRowid for folderId
- `folders:update` -- dynamic SET clause with code-controlled field names + ? params
- `folders:delete` -- DELETE with ? param
- `folders:assign` -- INSERT OR IGNORE with ? params
- `folders:unassign` -- DELETE with ? params
- `folders:for-conversation` -- JOIN query with ? param
- `folders:conversations` -- SELECT with ? param
- `folders:rules:list` -- SELECT, no user input
- `folders:rules:get` -- SELECT with ? param
- `folders:rules:save` -- UPDATE with ? params (JSON stored as param, not interpolated)
- `folders:rules:delete` -- UPDATE with ? param
- `folders:auto-assign` -- SELECT + INSERT in loop with ? params

### Task 2: Pin Handlers (7 handlers)
- `pins:list` -- simple SELECT
- `pins:is-pinned` -- SELECT with ? param
- `pins:pin` -- flattened from 4-level nested exec callbacks to flat synchronous calls (COUNT + EXISTS + MAX + INSERT)
- `pins:unpin` -- DELETE with ? param
- `pins:toggle` -- flattened from 4-level nested exec to flat synchronous (EXISTS + DELETE or COUNT + MAX + INSERT)
- `pins:reorder` -- single prepared statement reused in loop
- `pins:count` -- simple COUNT

## Verification Results

- Zero `.replace(/'/g, "''")` in folder handlers: PASS
- Zero `.replace(/'/g, "''")` in pin handlers: PASS
- Zero `exec sqlite3` in folder/pin handlers: PASS
- TypeScript compilation: CLEAN
- Total `.replace(/'/g` reduced from 53 to 32 (21 eliminated)
- Response formats preserved (same IPC channel names, same return shapes)

## Deviations from Plan

None -- plan executed exactly as written.

## Code Quality Improvements

The pin handlers (especially `pins:pin` and `pins:toggle`) went from 80+ lines of deeply nested callback hell to ~20 lines of flat synchronous code each. This is a significant readability and maintainability improvement beyond just the security fix.

## Next Phase Readiness

32 SQL injection sites remain for plans 01-05 and 01-06 to address. After all three wave-2 plans complete, re-run verification to confirm SEC-04 satisfied.
