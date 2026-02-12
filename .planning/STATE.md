# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Kevin can trust that Froggo.app is secure, reliable, and honest -- every button works, every indicator reflects reality.
**Current focus:** Phase 2 Fix Broken Features complete. Ready for Phase 3 Functional Fixes (needs research + planning).

## Current Position

Phase: 2 of 4 (Fix Broken Features) -- COMPLETE
Plan: 2 of 2 in current phase -- COMPLETE
Status: Phase complete
Last activity: 2026-02-12 -- Completed 02-02-PLAN.md (restore AI IPC handlers: channel name fix, generateReply, getAnalysis)

Progress: [████████░░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~18min
- Total execution time: ~145min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-security-hardening | 6/6 | ~138min | ~23min |
| 02-fix-broken-features | 2/2 | ~7min | ~3.5min |

**Recent Trend:**
- Last 8 plans: 01-01 (~45min), 01-02 (~9min), 01-03 (~20min), 01-04 (~13min), 01-05 (~20min), 01-06 (~31min), 02-01 (~5min), 02-02 (~2min)
- Trend: Phase 2 fixes are fast due to well-researched targeted edits with clear backup references

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
- Keep Anthropic API call as-is in ai:generateReply (direct HTTP, no DB)
- Leave ai:analyzeMessages stub unchanged (too complex, out of scope)

### Pending Todos

- Phase 2 complete (all 10 FIX requirements addressed)
- Phase 3 needs research + planning before execution
- Phase 4 needs research + planning before execution

### Blockers/Concerns

- Must run `electron:build` (not just `npm run build`) for changes to appear in packaged app
- Users on fresh install need to configure API keys and profile in Settings (previously hardcoded)
- Phases 3 and 4 plan files not yet created -- need research phase

## Session Continuity

Last session: 2026-02-12
Stopped at: Completed 02-02-PLAN.md (Phase 2 complete)
Resume file: None
