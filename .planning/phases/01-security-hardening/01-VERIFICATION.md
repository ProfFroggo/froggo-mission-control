---
phase: 01-security-hardening
verified: 2026-02-12T09:35:33Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "All SQL uses prepare().run() with ? parameters (74 sites eliminated)"
    - "The db:exec handler cannot execute arbitrary SQL beyond safe SELECT patterns (complete migration closed broader attack surface)"
  gaps_remaining: []
  regressions: []
---

# Phase 01: Security Hardening Verification Report

**Phase Goal:** No security vulnerabilities remain in shipped source code
**Verified:** 2026-02-12T09:35:33Z
**Status:** passed
**Re-verification:** Yes — after gap closure plans 01-03 through 01-06

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No API tokens in source (Twitter Bearer, Gemini keys, gateway token) | ✓ VERIFIED | Zero hits in active src/ and electron/ files (backup files excluded) |
| 2 | No PII in source (emails, phone, name) | ✓ VERIFIED | Zero hits in active src/ and electron/ files (backup files excluded) |
| 3 | DevTools disabled in production builds | ✓ VERIFIED | `openDevTools()` only in `if (isDev)` block at line 349 |
| 4 | All SQL uses prepare().run() with ? parameters | ✓ VERIFIED | 156 prepare() calls, 0 shell-exec sqlite3, 5 shell-escape patterns (all for CLI tools) |
| 5 | Filesystem IPC handlers restricted to safe paths | ✓ VERIFIED | All 3 fs: handlers call validateFsPath() before operations |

**Score:** 5/5 truths verified

### Re-Verification Summary

**Previous verification (2026-02-11)** found 74 SQL injection sites blocking phase goal achievement.

**Gap closure plans 01-03 through 01-06** eliminated all 74 sites:
- **01-03**: Migrated notification-settings (6 handlers) and snooze (7 handlers) — 21 sites eliminated
- **01-04**: Migrated message folders (13 handlers) and conversation pins (7 handlers) — 21 sites eliminated  
- **01-05**: Migrated tasks, attachments (4), library (5), inbox (6) — ~20 sites eliminated
- **01-06**: Migrated calendar, conversations, skills, chat, search, tokens, DM history + added getSessionsDb() — remaining sites eliminated

**Current state:**
- 156 `prepare()` calls with parameterized queries
- 0 `exec.*sqlite3` shell commands
- 0 `execSync.*sqlite3` shell commands
- 5 `.replace(/'/g, "'\\''")` patterns (all shell-escaping for CLI tools, not SQL)
  - search:local (froggo-db CLI)
  - AI:generate (openclaw agent CLI)
  - messages:send (wacli/tgcli CLI)
  - agents:chat (openclaw agent CLI)
  - agents:create (shell script args)

**No regressions:** Previously verified truths (1, 2, 3, 5) remain satisfied.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `electron/secret-store.ts` | Keychain-backed secret storage with 4 exports | ✓ VERIFIED | Exports storeSecret/getSecret/hasSecret/deleteSecret, uses safeStorage |
| `electron/fs-validation.ts` | Path allowlist validation | ✓ VERIFIED | Exports isAllowedPath/validateFsPath, allowlist: ~/clawd, ~/.openclaw, ~/Froggo |
| `electron/database.ts` | getSessionsDb() for readonly sessions.db access | ✓ VERIFIED | Line 81: lazy connection with OpenClaw/legacy fallback |
| `electron/x-automations-service.ts` | Uses parameterized queries via database.ts | ✓ VERIFIED | All functions use prepare().run/get/all() |
| `electron/export-backup-service.ts` | Uses parameterized queries via database.ts | ✓ VERIFIED | queryDbSafe() uses prepare() |
| `electron/main.ts` (DevTools) | Production branch has no openDevTools() | ✓ VERIFIED | Only `if (isDev)` block at line 349 |
| `electron/main.ts` (SQL injection) | All SQL uses prepare() | ✓ VERIFIED | 156 prepare() calls, 0 shell-exec sqlite3 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| electron/x-api-client.ts | electron/secret-store.ts | getSecret('x-bearer-token') | ✓ WIRED | Import and call verified |
| electron/connected-accounts-service.ts | electron safeStorage | encrypt/decrypt using safeStorage | ✓ WIRED | Import and usage verified |
| src/components/VoiceChatPanel.tsx | window.clawdbot.settings.getApiKey | IPC call for Gemini key | ✓ WIRED | Async getGeminiApiKey() implementation verified |
| electron/main.ts (fs handlers) | electron/fs-validation.ts | validateFsPath() before fs ops | ✓ WIRED | Called at lines 3642, 3658, 3674 |
| electron/main.ts (db:exec) | electron/database.ts | prepare(query) with params | ✓ WIRED | Uses prepare() + allowlist check |
| electron/main.ts (tokens) | electron/database.ts | getSessionsDb() | ✓ WIRED | tokens:summary/log/budget use getSessionsDb().prepare() |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| SEC-01: No hardcoded API tokens | ✓ SATISFIED | None - all tokens removed |
| SEC-02: No PII in source | ✓ SATISFIED | None - all PII removed |
| SEC-03: DevTools disabled in production | ✓ SATISFIED | None - only enabled in dev mode |
| SEC-04: All SQL uses parameterized inputs | ✓ SATISFIED | Gap closure complete: 156 prepare() calls, 0 shell-exec |
| SEC-05: FS handlers restricted to safe paths | ✓ SATISFIED | None - fs-validation enforced |
| SEC-06: db:exec cannot execute arbitrary SQL | ✓ SATISFIED | Uses prepare() + allowlist (SELECT/INSERT only) |
| SEC-07: Encryption key not hardcoded | ✓ SATISFIED | None - uses safeStorage |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| N/A | N/A | N/A | None | No blocking anti-patterns found |

**Notes:**
- 0 TODO/FIXME/XXX/HACK comments in electron/main.ts
- 1 console.log call (non-blocking)
- 11 exec calls involving database keywords (7 froggo-db CLI fire-and-forget logging, 4 db.exec() DDL-only)
- All remaining patterns are safe and necessary

### Success Criteria from ROADMAP.md

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | grep for known API tokens returns zero hits | ✓ PASS | Zero hits in active files |
| 2 | DevTools cannot be opened in packaged Froggo.app | ✓ PASS | openDevTools() only in dev mode |
| 3 | Passing `'; DROP TABLE tasks; --` as task title does not execute SQL injection | ✓ PASS | All SQL uses prepare() with ? params |
| 4 | FS IPC handlers refuse paths outside allowed directories | ✓ PASS | fs-validation.ts enforces allowlist |
| 5 | Encryption key loaded from environment/keychain, not hardcoded | ✓ PASS | Uses safeStorage, no hardcoded default |

**Overall:** 5/5 success criteria verified

---

## Gap Closure Analysis

### Gaps from Previous Verification

**Truth 4 FAILED (previous):** 74 SQL injection sites remained after 01-02, using `.replace(/'/g, "''")` with shell-exec sqlite3.

**Gap closure plans:**
- 01-03: notification-settings + snooze (13 handlers, 21 sites)
- 01-04: message folders + conversation pins (20 handlers, 21 sites)
- 01-05: tasks, attachments, library, inbox (17 handlers, ~20 sites)
- 01-06: calendar, conversations, skills, chat, search, tokens + getSessionsDb() (remaining sites)

**Current verification results:**
- ✓ Zero `.replace(/'/g, "''")` SQL escaping patterns remain
- ✓ 5 `.replace(/'/g, "'\\''")` shell escaping patterns remain (all correct - for CLI tools)
- ✓ Zero shell-exec sqlite3 calls
- ✓ 156 prepare() calls with parameterized queries
- ✓ All db.exec() calls are DDL-only (CREATE TABLE IF NOT EXISTS)

**Gaps closed:** All 74 SQL injection sites eliminated. Truth 4 now VERIFIED.

### Quality Improvements Beyond Gap Closure

Plans 01-03 through 01-06 also delivered:
- **Atomicity:** Added db.transaction() for multi-step operations (snooze:unset, conversations:delete)
- **Input validation:** Added limit sanitization (snooze:history clamped to 1-100)
- **Bug fixes:** Fixed wrong DB paths in library:view/download (~/Froggo/clawd/ -> ~/froggo/data/)
- **Readability:** Flattened 4-level nested callbacks to flat synchronous code (pin handlers)
- **Consistency:** Migrated all handlers to same pattern (prepare() with ? params)

---

## Human Verification Required

### 1. Test SQL injection protection

**Test:**
1. Build and run the packaged Froggo.app (production mode)
2. Create a task with title: `'; DROP TABLE tasks; --`
3. Check if the tasks table still exists with: `froggo-db task-list`

**Expected:** Task is created with the literal string as title, tasks table is not dropped

**Why human:** Final end-to-end verification that parameterized queries work correctly at runtime

### 2. Test filesystem restriction

**Test:**
1. Open Froggo.app in dev mode (DevTools available)
2. Try to read a file outside allowed paths via Console: `window.clawdbot.fs.readFile('/etc/passwd')`

**Expected:** Error: "Path outside allowed directories"

**Why human:** Verify the runtime IPC behavior enforces path restrictions

### 3. Test secret storage

**Test:**
1. Open Settings > API Keys in Froggo.app
2. Store a test Gemini API key
3. Check that `~/.openclaw/credentials/dashboard/gemini.enc` file exists
4. Verify the file contents are encrypted: `file ~/.openclaw/credentials/dashboard/gemini.enc`

**Expected:** File exists, type shows "data" (binary/encrypted), not "text"

**Why human:** Verify the safeStorage encryption actually works at runtime

---

_Verified: 2026-02-12T09:35:33Z_
_Verifier: Claude (gsd-verifier)_
_Previous verification: 2026-02-11T23:50:00Z_
_Gap closure: Plans 01-03, 01-04, 01-05, 01-06_
