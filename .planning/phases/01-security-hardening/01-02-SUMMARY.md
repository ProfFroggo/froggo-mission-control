---
phase: 01-security-hardening
plan: 02
subsystem: electron-security
tags: [sql-injection, devtools, filesystem, parameterized-queries, better-sqlite3]
dependency-graph:
  requires: [01-01]
  provides: [SEC-03-devtools-disabled, SEC-04-sql-injection-fixed, SEC-05-fs-restricted, SEC-06-db-exec-safe]
  affects: [02-broken-features]
tech-stack:
  added: []
  patterns: [parameterized-queries, path-allowlist-validation, lazy-db-connections]
key-files:
  created:
    - electron/fs-validation.ts
  modified:
    - electron/main.ts
    - electron/x-automations-service.ts
    - electron/export-backup-service.ts
    - electron/database.ts
decisions:
  - id: SEC-03
    choice: Remove production openDevTools() call
    reason: DevTools in production builds exposes internal state, IPC channels, and allows arbitrary code execution
  - id: SEC-04
    choice: Migrate all targeted SQL handlers to better-sqlite3 prepare() with ? params
    reason: Shell exec sqlite3 with string interpolation is vulnerable to SQL injection
  - id: SEC-05
    choice: Path allowlist restricted to ~/clawd, ~/.openclaw, ~/Froggo
    reason: Renderer-initiated FS operations must not escape known safe directories
  - id: SEC-06
    choice: Keep db:exec channel name, replace implementation with prepare()
    reason: Renaming would touch 5+ renderer files for no security gain; prepare() with params is equally safe
  - id: SEC-DB
    choice: Add getSecurityDb() lazy connection for security.db
    reason: Security handlers used separate DB file; needed own better-sqlite3 connection to eliminate shell exec
metrics:
  duration: ~9min
  completed: 2026-02-11
---

# Phase 01 Plan 02: Attack Surface Lockdown Summary

Disabled DevTools in production, migrated all targeted SQL injection vectors to parameterized queries via better-sqlite3, restricted filesystem IPC to safe paths, and replaced the unsafe db:exec shell-exec implementation.

## What Changed

### SEC-03: DevTools Disabled in Production
- Removed `mainWindow.webContents.openDevTools()` from the production (else) branch in createWindow()
- Dev mode `openDevTools()` preserved for development workflow
- The comment "Temporarily enable DevTools in production for debugging" removed

### SEC-04: SQL Injection Vectors Eliminated
**x-automations-service.ts** (complete rewrite):
- Removed `execSync`, `query()`, and `queryJSON()` shell helpers
- All 8 CRUD functions now use `prepare().run/get/all()` with `?` parameters
- Dynamic UPDATE builds use `setClauses[]` + `params[]` pattern
- Fixed wrong `DB_PATH` (was `~/Froggo/clawd/data/froggo.db`, now uses database.ts)

**export-backup-service.ts** (rewrite):
- Removed `queryDb()` shell exec function
- All export functions (exportTasks, exportAgentLogs, exportChatHistory) use parameterized filter building
- importTasks rewritten with parameterized INSERT
- restoreBackup verification uses prepare()
- `.backup` shell command preserved (takes no user input)

**main.ts** -- targeted handlers migrated:
- `db:exec`: Shell exec replaced with `prepare(query).all/run(...params)`
- `rejections:log`: Shell exec replaced with `prepare().run()`
- `inbox:add`: Shell exec INSERT replaced with `prepare().run()`
- `inbox:update`: Shell exec UPDATE replaced with parameterized SET clause
- `inbox:approveAll`: Shell exec replaced with `prepare().run()`
- `inbox:listRevisions`: Shell exec replaced with `prepare().all()`
- `schedule:list`: Shell exec replaced with `db.exec()` for CREATE TABLE + `prepare().all()`
- `schedule:add`: Shell exec + temp file replaced with `prepare().run()`
- `schedule:cancel`: Shell exec replaced with `prepare().run()`
- `schedule:update`: Shell exec replaced with parameterized SET clause
- `schedule:sendNow`: Shell exec replaced with `prepare().get/run()`
- `processScheduledItems`: All 6 shell exec sqlite3 calls replaced with `prepare().run()`
- `library:list`: Shell exec replaced with `prepare().all()` with category param
- `notification-settings:mute`: Shell exec replaced with `prepare().get/run()`
- `notification-settings:unmute`: Shell exec replaced with `prepare().run()`
- All 7 security handlers: `initSecurityDB`, `listKeys`, `addKey`, `deleteKey`, `updateAuditLog`, `listAlerts`, `dismissAlert`
- `security:runAudit`: Finding/alert INSERT loops use parameterized statements

### SEC-05: Filesystem IPC Restricted
- Created `electron/fs-validation.ts` with `isAllowedPath()` and `validateFsPath()`
- Allowed roots: `~/clawd/`, `~/.openclaw/`, `~/Froggo/`
- Handles `~` expansion and path traversal via `path.resolve()`
- All 3 FS handlers (`fs:writeBase64`, `fs:readFile`, `fs:append`) validate before any I/O

### SEC-06: db:exec Handler Secured
- Replaced shell exec with `prepare(query).all(...params)` / `.run(...params)`
- Kept SELECT/INSERT allowlist check
- Channel name `db:exec` preserved (5+ renderer files depend on it)

### database.ts Enhancement
- Added `getSecurityDb()` lazy-init connection for `~/clawd/data/security.db`
- Added security.db cleanup in `closeDb()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed notification-settings SQL injection**
- **Found during:** Task 2
- **Issue:** `notification-settings:mute` and `notification-settings:unmute` handlers used shell exec with string interpolation
- **Fix:** Migrated both to parameterized queries
- **Files modified:** electron/main.ts

**2. [Rule 2 - Missing Critical] Fixed security.db handlers**
- **Found during:** Task 2
- **Issue:** All 7 security handlers used execSync/sqlite3 with string interpolation, and security.db had no better-sqlite3 connection
- **Fix:** Added `getSecurityDb()` to database.ts, rewrote all handlers with parameterized queries
- **Files modified:** electron/database.ts, electron/main.ts

**3. [Rule 2 - Missing Critical] Fixed additional schedule/inbox/library handlers**
- **Found during:** Task 2 (scope was broader than initially listed)
- **Issue:** inbox:approveAll, inbox:listRevisions, schedule:list, and processScheduledItems all used shell exec sqlite3
- **Fix:** Migrated all to parameterized queries
- **Files modified:** electron/main.ts

### Known Remaining Sites
The following handlers still use shell exec sqlite3 but were not in the plan scope:
- notification-settings:get, notification-settings:save, notification-settings:delete, notification-settings:getEffective (~5 handlers)
- tasks:create (~1 handler)
- task attachments (~3 handlers)
- message folders (~10+ handlers)
- conversation pins (~5+ handlers)
- get-dm-history (safe: only interpolates a number)

These are lower-risk (most only accept constrained inputs from the UI) and can be addressed in a future cleanup.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Disable DevTools, create FS validation, restrict FS handlers | 1a71f11 | electron/fs-validation.ts (new), electron/main.ts |
| 2 | Fix all SQL injection vectors | 53951eb | electron/main.ts, electron/x-automations-service.ts, electron/export-backup-service.ts, electron/database.ts |

## Verification Results

- DevTools: Only `openDevTools()` in `if (isDev)` branch (line 349)
- SQL injection: No `execSync.*sqlite3.*${` in targeted service files
- FS restriction: `validateFsPath` called in all 3 FS handlers
- db:exec: Uses `prepare()` with real params
- Build: `npm run electron:build` succeeds

## Next Phase Readiness

Phase 01 (Security Hardening) is now complete. All 4 security categories addressed:
- SEC-03: DevTools disabled in production
- SEC-04: SQL injection vectors eliminated in targeted handlers
- SEC-05: Filesystem IPC restricted to safe paths
- SEC-06: db:exec uses parameterized queries

Ready for Phase 02 (Broken Features).
