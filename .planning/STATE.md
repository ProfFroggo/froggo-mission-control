# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Kevin can trust that Froggo.app is secure, reliable, and honest -- every button works, every indicator reflects reality.
**Current focus:** Phase 2 Fix Broken Features in progress. 02-01 complete (7 mechanical fixes). 02-02 remaining (AI IPC handlers).

## Current Position

Phase: 2 of 4 (Fix Broken Features)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-12 -- Completed 02-01-PLAN.md (7 mechanical fixes: spawn handler, layout, hover, avatars, JSON guards, CLI strings, API paths)

Progress: [███████░░░] 58%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: ~20min
- Total execution time: ~143min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-security-hardening | 6/6 | ~138min | ~23min |
| 02-fix-broken-features | 1/2 | ~5min | ~5min |

**Recent Trend:**
- Last 7 plans: 01-01 (~45min), 01-02 (~9min), 01-03 (~20min), 01-04 (~13min), 01-05 (~20min), 01-06 (~31min), 02-01 (~5min)
- Trend: Phase 2 mechanical fixes are fast due to well-researched targeted edits

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Wave-based execution order: security first, then broken features, then functional, then cleanup
- Keep preload namespace as `clawdbot` (cosmetic rename deferred to v2)
- Keep electron/main.ts as monolith (breakup deferred to v2)
- Used Electron safeStorage (OS keychain) for secret storage instead of .env files
- Async IPC bridge pattern for API keys (safeStorage only in main process)
- Dynamic gog CLI discovery for Google accounts instead of hardcoded arrays
- Empty defaults in userSettings store -- existing users unaffected via localStorage persistence
- Keep db:exec IPC channel name unchanged -- 5+ renderer files depend on it, prepare() with params is equally safe
- Path allowlist for FS IPC: ~/clawd/, ~/.openclaw/, ~/Froggo/
- Security.db gets its own lazy better-sqlite3 connection via getSecurityDb()
- Use db.prepare() directly (not cached) for dynamic SET clauses to avoid statement cache bloat
- Use db.transaction() for multi-step operations (snooze:unset, conversations:delete) for atomicity
- Reuse single prepared statement in loops (pins:reorder) for efficiency
- db.exec() for DDL-only statements (CREATE TABLE IF NOT EXISTS), prepare() for DML with user data
- execSync with input option for safe stdin piping to shell scripts (inbox:filter)
- Number(result.lastInsertRowid) for getting inserted row ID from RunResult
- sessions.db opened as readonly (dashboard never writes to gateway session tracking)
- sessions.db path: check ~/.openclaw/ first, fallback to ~/.clawdbot/ for legacy support
- search:local uses shell escaping (not SQL escaping) since froggo-db is a CLI tool
- conversations:delete uses db.transaction() for atomic multi-table cleanup
- Keep .clawdbot/openclaw.json as legacy config fallback (line 4144 in main.ts)
- HOVER_BG_MAP static lookup pattern for Tailwind JIT dynamic hover classes
- IIFE wrapper for pre-filtered messages to avoid JSX tree restructuring

### Pending Todos

- Phase 2 plan 02-01 complete (7 mechanical fixes)
- Ready for 02-02 (restore missing AI IPC handlers)

### Blockers/Concerns

- Must run `electron:build` (not just `npm run build`) for changes to appear in packaged app
- Users on fresh install need to configure API keys and profile in Settings (previously hardcoded)
- 02-02 requires reading main.ts.before-cleanup to recover lost AI handlers with Phase 1 security patterns

## Session Continuity

Last session: 2026-02-12
Stopped at: Completed 02-01-PLAN.md
Resume file: None
