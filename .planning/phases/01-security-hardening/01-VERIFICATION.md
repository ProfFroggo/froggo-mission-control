---
phase: 01-security-hardening
verified: 2026-02-11T23:50:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "All SQL uses prepare().run() with ? parameters"
    status: failed
    reason: "74 SQL escaping sites remain in main.ts using manual .replace(/'/g, \"\") pattern with shell exec sqlite3"
    artifacts:
      - path: "electron/main.ts"
        issue: "Lines with execSync/exec and string interpolation remain: notification-settings (12 sites), message folders (10 sites), conversation pins (8 sites), snooze (12 sites), inbox add/update (6 sites), library add (2 sites), and others"
    missing:
      - "Migrate notification-settings handlers to prepare() queries"
      - "Migrate message folder handlers to prepare() queries"
      - "Migrate conversation pin handlers to prepare() queries"
      - "Migrate snooze handlers to prepare() queries"
      - "Migrate remaining inbox/library handlers to prepare() queries"
      - "Remove all .replace(/'/g, '') manual escaping patterns"
  - truth: "The db:exec handler cannot execute arbitrary SQL beyond safe SELECT patterns"
    status: partial
    reason: "db:exec uses prepare() which is safe, but only allows SELECT/INSERT - the plan required broader protection"
    artifacts:
      - path: "electron/main.ts"
        issue: "Lines 4266-4270 have allowlist check for SELECT/INSERT only, but doesn't prevent UPDATE/DELETE through other IPC channels that still use shell exec"
    missing:
      - "Complete migration of all remaining SQL injection vectors to close the broader attack surface"
---

# Phase 01: Security Hardening Verification Report

**Phase Goal:** No security vulnerabilities remain in shipped source code
**Verified:** 2026-02-11T23:50:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No API tokens in source (Twitter Bearer, Gemini keys, gateway token) | ✓ VERIFIED | `grep -rn` for all known tokens returns zero hits in src/ and electron/ |
| 2 | No PII in source (emails, phone, name) | ✓ VERIFIED | `grep -rn` for kevin@carbium, kevin.macarthur@bitso, Kevin MacArthur, +35054008841 returns zero hits (excluding .bak) |
| 3 | DevTools disabled in production builds | ✓ VERIFIED | `openDevTools()` only appears in `if (isDev)` block at line 349, not in production else block |
| 4 | All SQL uses prepare().run() with ? parameters | ✗ FAILED | 74 manual SQL escaping sites remain in electron/main.ts using .replace(/'/g, "") with shell exec sqlite3. Only x-automations-service.ts and export-backup-service.ts were fully migrated. |
| 5 | Filesystem IPC handlers restricted to safe paths | ✓ VERIFIED | fs-validation.ts exists, validateFsPath() called in all 3 FS handlers (fs:writeBase64, fs:readFile, fs:append) |

**Score:** 4/5 truths verified (Truth 4 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `electron/secret-store.ts` | Keychain-backed secret storage with 4 exports | ✓ VERIFIED | File exists (2419 bytes), exports storeSecret/getSecret/hasSecret/deleteSecret, uses safeStorage |
| `electron/fs-validation.ts` | Path allowlist validation | ✓ VERIFIED | File exists (1338 bytes), exports isAllowedPath/validateFsPath, allowlist: ~/clawd, ~/.openclaw, ~/Froggo |
| `electron/x-automations-service.ts` | Uses parameterized queries via database.ts | ✓ VERIFIED | `import { prepare } from './database'` found, all functions use prepare().run/get/all() |
| `electron/export-backup-service.ts` | Uses parameterized queries via database.ts | ✓ VERIFIED | `import { prepare, db } from './database'` found, queryDbSafe() uses prepare() |
| `electron/main.ts` (DevTools) | Production branch has no openDevTools() | ✓ VERIFIED | Only `if (isDev)` block has openDevTools() at line 349 |
| `electron/main.ts` (SQL injection) | All SQL uses prepare() | ✗ STUB/PARTIAL | db:exec handler uses prepare() (line 4272), but 74 other sites use shell exec with manual escaping |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| electron/x-api-client.ts | electron/secret-store.ts | getSecret('x-bearer-token') | ✓ WIRED | `import { getSecret } from './secret-store'` found at line 6 |
| electron/connected-accounts-service.ts | electron safeStorage | encrypt/decrypt using safeStorage | ✓ WIRED | `import { safeStorage } from 'electron'` found, used in encrypt/decrypt functions |
| src/components/VoiceChatPanel.tsx | window.clawdbot.settings.getApiKey | IPC call for Gemini key | ✓ WIRED | Async getGeminiApiKey() calls IPC (implementation verified in SUMMARY) |
| electron/main.ts (fs handlers) | electron/fs-validation.ts | validateFsPath() before fs ops | ✓ WIRED | validateFsPath() called at lines 4211, 4227, 4243 (all 3 FS handlers) |
| electron/main.ts (db:exec) | electron/database.ts | prepare(query) with params | ✓ WIRED | Line 4272: `const stmt = prepare(query);` |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| SEC-01: No hardcoded API tokens | ✓ SATISFIED | None - all tokens removed |
| SEC-02: No PII in source | ✓ SATISFIED | None - all PII removed |
| SEC-03: DevTools disabled in production | ✓ SATISFIED | None - only enabled in dev mode |
| SEC-04: All SQL uses parameterized inputs | ✗ BLOCKED | 74 SQL injection sites remain in main.ts |
| SEC-05: FS handlers restricted to safe paths | ✓ SATISFIED | None - fs-validation enforced |
| SEC-06: db:exec cannot execute arbitrary SQL | ⚠️ PARTIAL | db:exec itself is safe (uses prepare), but broader attack surface remains via 74 other shell exec sites |
| SEC-07: Encryption key not hardcoded | ✓ SATISFIED | None - uses safeStorage |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| electron/main.ts | 1006-1008, 1036, 1060, etc. (74 sites) | Manual SQL escaping with .replace(/'/g, "''") + shell exec | 🛑 Blocker | SQL injection vulnerability - escaping single quotes is insufficient protection |
| electron/main.ts | 3518, 4494, 4506, 4516 | String interpolation in sqlite3 shell command | 🛑 Blocker | Direct SQL injection vector |
| electron/main.ts | 7323 | execSync with query parameter | 🛑 Blocker | SQL injection in security handlers (though plan claims these were fixed) |

### Gaps Summary

**Truth 4 FAILED: SQL injection protection incomplete**

Plan 01-02 claimed to "Fix all SQL injection vectors" but only migrated:
- x-automations-service.ts (complete)
- export-backup-service.ts (complete)  
- db:exec handler (complete)
- ~10 targeted handlers in main.ts

**74 SQL escaping sites remain in main.ts:**
- notification-settings handlers: ~12 sites (get, save, delete, getEffective, mute, unmute)
- message folders handlers: ~10 sites (create, update, delete, list, assign)
- conversation pins handlers: ~8 sites (pin, unpin, reorder, list)
- snooze handlers: ~12 sites (snooze, unsnooze, history)
- inbox handlers: ~6 sites (add, update, revisions)
- library handlers: ~2 sites (add, link tasks)
- tasks:create: ~1 site
- get-dm-history: ~1 site
- Others: ~22 sites

The SUMMARY admits these as "Known Remaining Sites" and claims they are "lower-risk" because "most only accept constrained inputs from the UI." **This is incorrect reasoning** - UI-sourced inputs are still user-controlled and can be manipulated by a compromised renderer or via DevTools (though DevTools is now disabled in production). The `.replace(/'/g, "''")` pattern is insufficient:

1. **It only escapes single quotes** - doesn't protect against other SQL injection techniques
2. **Shell exec adds another layer of parsing** - shell escaping vs SQL escaping are different concerns
3. **Manual escaping is error-prone** - any site where a developer forgets to escape is vulnerable

**Why this blocks the phase goal:**

The phase goal states: "No security vulnerabilities remain in shipped source code"

Success criterion 3 states: "Passing `'; DROP TABLE tasks; --` as a task title through the UI does not execute SQL injection"

With 74 manual escaping sites remaining, this criterion cannot be verified as TRUE. Any of these handlers could be exploited.

**Recommendation:** Create a gap closure plan to migrate all remaining SQL sites to parameterized queries via prepare().

---

## Success Criteria from ROADMAP.md

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | grep for known API tokens returns zero hits | ✓ PASS | Zero hits for Twitter Bearer, Gemini keys, gateway token |
| 2 | DevTools cannot be opened in packaged Froggo.app | ✓ PASS | openDevTools() only in dev mode |
| 3 | Passing `'; DROP TABLE tasks; --` as task title does not execute SQL injection | ✗ FAIL | 74 SQL injection sites remain - cannot verify this is safe |
| 4 | FS IPC handlers refuse paths outside allowed directories | ✓ PASS | fs-validation.ts enforces allowlist |
| 5 | Encryption key loaded from environment/keychain, not hardcoded | ✓ PASS | Uses safeStorage, no hardcoded default remains |

**Overall:** 4/5 success criteria verified

---

## Human Verification Required

### 1. Test SQL injection protection

**Test:** 
1. Build and run the packaged Froggo.app (production mode)
2. Create a task with title: `'; DROP TABLE tasks; --`
3. Check if the tasks table still exists

**Expected:** Task is created with the literal string as title, tasks table is not dropped

**Why human:** Need to test actual SQL execution behavior, not just code patterns. The 74 remaining manual escaping sites make automated verification insufficient.

### 2. Test filesystem restriction

**Test:**
1. Open Froggo.app DevTools (should only work in dev mode)
2. Try to read a file outside allowed paths via Console: `window.clawdbot.fs.readFile('/etc/passwd')`

**Expected:** Error: "Path outside allowed directories"

**Why human:** Need to verify the runtime IPC behavior, not just the code path.

### 3. Test secret storage

**Test:**
1. Store a Gemini API key in Settings > API Keys
2. Check that `~/.openclaw/credentials/dashboard/gemini.enc` file exists
3. Verify the file contents are encrypted (not plaintext)

**Expected:** File exists, contents are binary/encrypted

**Why human:** Need to verify the safeStorage encryption actually works at runtime.

---

_Verified: 2026-02-11T23:50:00Z_
_Verifier: Claude (gsd-verifier)_
