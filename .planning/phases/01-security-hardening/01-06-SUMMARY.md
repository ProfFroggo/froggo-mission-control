---
phase: 01-security-hardening
plan: 06
subsystem: electron-ipc
tags: [sql-injection, parameterized-queries, sessions-db, calendar, conversations, tokens]

dependency-graph:
  requires: ["01-01", "01-02", "01-03", "01-04", "01-05"]
  provides: ["SEC-04 fully satisfied", "getSessionsDb() lazy connection", "zero SQL injection in electron/main.ts"]
  affects: ["02-broken-features"]

tech-stack:
  added: []
  patterns: ["getSessionsDb() readonly lazy connection with legacy path fallback"]

file-tracking:
  key-files:
    created: []
    modified:
      - electron/main.ts
      - electron/database.ts

decisions:
  - id: sessions-db-readonly
    choice: "Open sessions.db as readonly with fileMustExist"
    reason: "Dashboard never writes to gateway session tracking database"
  - id: sessions-db-path-fallback
    choice: "Check ~/.openclaw/sessions.db first, fallback to ~/.openclaw/sessions.db"
    reason: "Support both OpenClaw and legacy Clawdbot installations"
  - id: search-shell-escape
    choice: "Replace SQL escaping with POSIX shell escaping in search:local"
    reason: "froggo-db search is a CLI tool, not a SQL query -- needs shell escaping not SQL escaping"
  - id: conversation-delete-transaction
    choice: "Use db.transaction() for conversations:delete"
    reason: "5 sequential DELETE operations should be atomic for data consistency"

metrics:
  duration: ~31min
  completed: 2026-02-12
---

# Phase 01 Plan 06: Final SQL Injection Gap Closure Summary

**One-liner:** Eliminated all remaining SQL injection sites: calendar events, conversation archive/delete, agent skills, comms fetch state, chat messages, search, token tracking, and DM history -- plus added getSessionsDb() for sessions.db access.

## Tasks Completed

### Task 1: Migrate calendar, conversation, agent skill, comms, and search handlers

**Changes in electron/main.ts:**

- **Calendar events:create**: Removed `escapeSQL` helper, replaced shell-exec INSERT with `prepare()` using 19 parameterized columns
- **Calendar events:update**: Replaced `escapeSQL` with dynamic SET clause using code-controlled field names and `?` params; also migrated the post-update SELECT to `prepare()`
- **Conversation archive/unarchive/isArchived/markRead**: Replaced all `escapedKey` patterns and shell-exec with direct `prepare()` calls
- **Conversation delete**: Replaced 5 sequential shell-exec DELETEs with `db.transaction()` for atomicity
- **Conversation archived**: Replaced shell-exec JOIN query with parameterized `prepare()` call
- **Agent addSkill/updateSkill**: Removed `escapedSkill` patterns, replaced with `prepare()` with `?` params
- **Comms getFetchState/updateFetchState**: Converted from `runMsgCmd` shell-exec to synchronous `prepare()` calls
- **Chat saveMessage/loadMessages**: Removed `escapedContent` patterns, replaced with `prepare()` with `?` params
- **search:local**: Replaced SQL escaping (`"''"`) with shell escaping (`"'\\''"`) since this is a CLI argument, not SQL

### Task 2: Add getSessionsDb() and migrate sessions.db handlers

**Changes in electron/database.ts:**

- Added `getSessionsDb()`: lazy readonly connection to sessions.db with OpenClaw/legacy path fallback
- Returns `null` if sessions.db does not exist (callers handle gracefully)
- Added cleanup in `closeDb()` for sessionsDb connection

**Changes in electron/main.ts:**

- Added `getSessionsDb` to import from `./database`
- **tokens:summary**: Replaced `promisify(exec)` + sqlite3 shell-exec with `getSessionsDb().prepare()` using parameterized WHERE clauses
- **tokens:log**: Same migration pattern with LIMIT and ORDER BY
- **tokens:budget**: Replaced shell-exec sessions.db query with `getSessionsDb().prepare()` for SUM query
- **get-dm-history**: Replaced `execSync(sqlite3 -json ...)` with froggo.db `prepare()` call

## Verification Results

### SQL Escaping Patterns
- **Zero** `.replace(/'/g, "''")` SQL escaping patterns remain
- **5** `.replace(/'/g, "'\\''")` shell escaping patterns remain (all correct):
  - search:local (CLI argument to froggo-db)
  - AI:generate (openclaw agent CLI)
  - messages:send (wacli/tgcli/gog CLI)
  - agents:chat (openclaw agent CLI)
  - agents:create (shell script args)

### Shell-exec sqlite3 Calls
- **Zero** `exec.*sqlite3` calls remain
- **Zero** `execSync.*sqlite3` calls remain

### TypeScript Compilation
- **Zero** errors in electron/ directory (pre-existing frontend errors unrelated)

### Parameterized Query Count
- **156** `prepare()` calls in electron/main.ts (up from ~20 pre-gap-closure)

## Deviations from Plan

### Parallel Execution Timing

Task 1 edits were interleaved with parallel plans 01-04 and 01-05, which were editing the same file (electron/main.ts) concurrently. Some of Task 1's changes were committed as part of 01-05's commits (c73a3c4, a2ede3c) due to concurrent file modifications. All changes are present in the repository and verified.

### [Rule 2 - Missing Critical] Email inbox insert already migrated

The email inbox INSERT in `runImportantEmailCheck()` (which had SQL escaping on title/content) was already migrated to `prepare()` by parallel plan 01-05. No additional work needed.

## Commits

| Hash | Description |
|------|-------------|
| c73a3c4 | feat(01-05): includes Task 1 calendar/conversation/skill/comms/chat/search migrations (interleaved) |
| 8a68092 | feat(01-06): getSessionsDb() + token/DM handler migrations |

## Success Criteria Verification

- [x] Zero `.replace(/'/g, "''")` SQL escaping patterns remain in electron/main.ts
- [x] Only `.replace(/'/g` instances are shell-escaping for CLI tools (5 sites)
- [x] Zero `exec.*sqlite3` or `execSync.*sqlite3` calls remain
- [x] `getSessionsDb()` exists in database.ts with lazy init, readonly flag, and cleanup
- [x] All response formats unchanged -- renderer code unaffected
- [x] **SEC-04 (All SQL uses parameterized inputs) is now SATISFIED**

## Phase 1 Gap Closure Complete

With plans 01-04, 01-05, and 01-06 all complete, the 53 SQL injection sites identified after 01-03 are now eliminated. Phase 1 Success Criterion 3 (SEC-04) is fully satisfied.
