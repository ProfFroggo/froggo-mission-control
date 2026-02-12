# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Kevin can trust that Froggo.app is secure, reliable, and honest -- every button works, every indicator reflects reality.
**Current focus:** Phase 4 Cleanup & Debloat complete. All phases done.

## Current Position

Phase: 4 of 4 (Cleanup & Debloat)
Plan: 2 of 2 in current phase
Status: Phase complete -- ALL PHASES DONE
Last activity: 2026-02-12 -- Completed 04-01-PLAN.md (dead code deletion, backup file cleanup)

Progress: [████████████] 100% (12/12 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: ~13min
- Total execution time: ~161min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-security-hardening | 6/6 | ~138min | ~23min |
| 02-fix-broken-features | 2/2 | ~7min | ~3.5min |
| 03-functional-fixes | 2/2 | ~8min | ~4min |
| 04-cleanup-debloat | 2/2 | ~8min | ~4min |

**Recent Trend:**
- Last 10 plans: 01-04 (~13min), 01-05 (~20min), 01-06 (~31min), 02-01 (~5min), 02-02 (~2min), 03-01 (~4min), 03-02 (~4min), 04-02 (~2min), 04-01 (~6min)
- Trend: Research-backed plans with targeted edits execute fast

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
- Ordered regex routing: designer/social-manager/growth-director first (specific), coder/writer/chief last (catch-all)
- DMFeed default export added for React.lazy() compatibility
- Per-type debounce Map replaces single refreshTimer for independent event handling
- loadGatewaySessions sets both gatewaySessions and sessions state (merges two IPC calls)
- matchTaskToAgent for approval/revision routing instead of hardcoded agent names
- 400ms debounce for shared task refresh (balances responsiveness and dedup)
- Reference equality memo (prev.task === next.task) with JSON.stringify for small objects
- 200 message cap per chat room in localStorage
- Only replace custom CSS classes within specific components -- text-utilities.css still used by Kanban, AgentPanel, etc.
- Keep console.error in MorningBrief (legitimate error reporting), only remove console.log debug lines
- SettingsPanel shortcut editor saves to localStorage but App.tsx doesn't read it (cosmetic display only)
- ContentCalendar.tsx file kept (used by XPanel.tsx) but its dead ProtectedPanels export removed
- SettingsPanel dead _notifPrefs useState AND its useEffect loader both removed together

### Pending Todos

- None -- all phases complete

### Blockers/Concerns

- Must run `electron:build` (not just `npm run build`) for changes to appear in packaged app
- Users on fresh install need to configure API keys and profile in Settings (previously hardcoded)
- 24 pre-existing TypeScript errors remain (App.tsx View types, Dashboard layout types, etc.) -- predate all cleanup work

## Session Continuity

Last session: 2026-02-12
Stopped at: ALL PHASES COMPLETE — milestone verified and closed
Resume file: None
