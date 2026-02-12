---
phase: 01-security-hardening
plan: 03
subsystem: electron-security
tags: [sql-injection, parameterized-queries, better-sqlite3, notification-settings, snooze]
dependency-graph:
  requires: [01-02]
  provides: [notification-settings-parameterized, snooze-parameterized]
  affects: [01-04, 01-05, 01-06]
tech-stack:
  added: []
  patterns: [parameterized-queries, db-transactions, dynamic-set-clauses]
key-files:
  created: []
  modified:
    - electron/main.ts
decisions:
  - id: SEC-04-cont
    choice: Use db.prepare() directly for dynamic SET clauses (not cached prepare())
    reason: Dynamic UPDATE SQL varies per call; caching would bloat statement cache with unique SQL strings
  - id: SNOOZE-TX
    choice: Use db.transaction() for snooze:unset (history insert + delete)
    reason: Atomic unsnooze prevents orphaned history or missing deletes on partial failure
metrics:
  duration: ~20min
  completed: 2026-02-12
---

# Phase 01 Plan 03: Notification-Settings and Snooze SQL Injection Closure Summary

Migrated all notification-settings (6 handlers) and snooze (7 handlers) IPC handlers from shell-exec sqlite3 with `.replace(/'/g, "''")` escaping to parameterized queries via better-sqlite3 `prepare()`. Eliminated 21 SQL injection sites.

## What Changed

### Notification-Settings Handlers (6 migrated)

**notification-settings:get** -- `prepare().get()` with `?` session_key param. Replaced shell exec + JSON.parse with direct synchronous query.

**notification-settings:set** -- Dynamic UPDATE uses `setParts[]` + `params[]` pattern with `db.prepare()` (not cached, since SQL varies). INSERT uses `prepare()` with 15 `?` placeholders. All field values passed as parameters, zero string interpolation.

**notification-settings:delete** -- `prepare().run()` with `?` session_key param.

**notification-settings:global-defaults** -- `prepare().get()` with hardcoded `WHERE id = 1` (no user input needed).

**notification-settings:set-global-defaults** -- Dynamic UPDATE same pattern as `notification-settings:set`, 12 possible fields, all parameterized.

**notification-settings:get-effective** -- `prepare().get()` against the `effective_notification_settings` SQLite view with `?` session_key param.

### Snooze Handlers (7 migrated)

**snooze:list** -- `prepare().all()` with no params (static query).

**snooze:get** -- `prepare().get()` with `?` session_id param.

**snooze:set** -- Check-then-update/insert pattern, all values parameterized. `snooze_reason` passed directly (no escaping needed with `?` params).

**snooze:unset** -- Wrapped in `db.transaction()` for atomicity: INSERT into `snooze_history` + DELETE from `conversation_snoozes`. Previously these were separate async exec calls that could partially fail.

**snooze:markReminderSent** -- `prepare().run()` with `?` session_id param.

**snooze:expired** -- `prepare().all()` with `?` timestamp param for `snooze_until <= ?`.

**snooze:history** -- `prepare().all()` with `?` session_id and sanitized limit param (clamped to 1-100).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added limit sanitization to snooze:history**
- **Found during:** Task 2
- **Issue:** `limit` parameter passed from renderer could be any number; while parameterized queries prevent SQL injection, unbounded LIMIT could cause memory issues
- **Fix:** Clamp limit to range [1, 100] via `Math.max(1, Math.min(Math.floor(limit), 100))`
- **Files modified:** electron/main.ts
- **Commit:** 8518f88

**2. [Rule 2 - Missing Critical] Added transaction to snooze:unset**
- **Found during:** Task 2
- **Issue:** Original code ran history INSERT and active DELETE as separate async shell commands -- partial failure could leave inconsistent state
- **Fix:** Wrapped both operations in `db.transaction()` for atomicity
- **Files modified:** electron/main.ts
- **Commit:** 8518f88

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migrate notification-settings handlers to prepare() queries | 509d352 | electron/main.ts |
| 2 | Migrate snooze handlers to prepare() queries | 8518f88 | electron/main.ts |

## Verification Results

- `grep -n "replace(/'/g" electron/main.ts | grep -i "notification"` -- zero lines (was ~14)
- `grep -n "replace(/'/g" electron/main.ts | grep -i "snooze"` -- zero lines (was ~7)
- `grep -n "exec.*sqlite3.*notification" electron/main.ts` -- zero lines
- `grep -n "exec.*sqlite3.*snooze" electron/main.ts` -- zero lines
- `prepare(` calls in notification handlers: 12 lines
- `prepare(` calls in snooze handlers: 11 lines
- Total `replace(/'/g` count: 74 -> 53 (21 eliminated)
- TypeScript compiles clean: `npx tsc --noEmit -p tsconfig.electron.json`

## Next Phase Readiness

53 `replace(/'/g` patterns remain in electron/main.ts, to be addressed by:
- 01-04: tasks:create and task attachment handlers
- 01-05: message folder handlers
- 01-06: conversation pins and remaining handlers
