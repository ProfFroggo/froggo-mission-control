# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Complete platform — fast, secure, polished, responsive, multi-user, with onboarding and plugin SDK.
**Current focus:** v9.0 Complete Platform — defining requirements.

## Current Position

Phase: 69 — DMG Build Pipeline
Plan: 01 of 1
Status: Phase complete
Last activity: 2026-03-01 — Completed 69-01-PLAN.md (Configure electron-builder for DMG output with ASAR and entitlements)

Progress: [██████░░░░░░░░░░░░░░] 24%

## Performance Metrics

**v7.0 Velocity:**
- Total plans completed: 26
- Average duration: ~3.8 min/plan
- Total execution time: ~99 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 42 | 2/2 | 14 min | 7 min |
| 43 | 3/3 | 7 min | 2.3 min |
| 44 | 2/2 | 4 min | 2 min |
| 45 | 3/3 | ~7 min | ~2.3 min |
| 46 | 3/3 | ~6 min | ~2 min |
| 47 | 2/2 | ~4 min | ~2 min |
| 48 | 1/1 | ~2 min | ~2 min |
| 49 | 1/1 | ~2 min | ~2 min |
| 50 | 1/1 | ~5 min | ~5 min |
| 52 | 1/1 | ~2 min | ~2 min |
| 55 | 1/1 | ~2 min | ~2 min |
| 51 | 1/1 | ~3 min | ~3 min |
| 53 | 1/1 | ~2 min | ~2 min |
| 54 | 1/1 | ~3 min | ~3 min |
| 56 | 3/3 | ~6 min | ~2 min |
| 57 | 4/4 | ~12 min | ~3 min |
| 58 | 5/5 | ~34 min | ~7 min |
| 59 | 5/5 | ~18 min | ~4 min |
| 60 | 3/3 | ~9 min | ~3 min |
| 69 | 1/1 | ~2 min | ~2 min |

## Accumulated Context

### Standing Decisions (carry forward to all future milestones)

- New IPC handlers go in dedicated service files under electron/ (NOT main.ts)
- All paths through electron/paths.ts
- CSS token pattern from Phase 13 applies to all new UI
- Finance uses `acknowledged` column (0/1), NOT `status`
- Agent discovery: always use ~/agent-*/ glob, never hardcoded list
- Obsidian-style module system (same-process, manifest.json, self-registration)
- Feature-level toggles only (not sub-feature)
- Credential bridge: 0600 files at ~/.openclaw/credentials/dispatcher/ (not macOS Keychain CLI)
- Module "install" = feature-flag toggle for compiled-in modules (no runtime dynamic import — ASAR is enabled in prod)
- ASAR enabled in prod builds: native modules (better-sqlite3, sqlite3) use asarUnpack; do NOT add app-sandbox entitlement (execFile to /opt/homebrew/bin/* would be blocked)
- Prod build identity is '-' (ad-hoc signing); afterPack re-signs after fuse flip to prevent SIGKILL
- entitlements at build/entitlements.mac.plist (not repo root entitlements.plist)
- Module view ownership: modules are sole registrars for their view IDs
- Only registerModuleHandler() channels are lifecycle-managed; registerHandler() channels are permanent (legacy-safe)
- moduleFactories Map persists handler references across unregister cycles — NOT cleared on disable
- Core module guard: manifest.core === true → disableModule() is a no-op
- module:state:* and module:ipc:* handlers use registerHandler() (core infra), not registerModuleHandler()
- module:state:getDisabledSync uses ipcMain.on() (sync IPC) for ipcRenderer.sendSync() in preload
- defaultDisabled + known[] pattern for modules that should be hidden on fresh install
- Stub IPC handlers should check sqlite_master for table existence before querying (graceful degradation)
- Only user-facing mutations get toast error feedback; background polling operations fail silently
- Task status transitions validated via VALID_TRANSITIONS map (statuses not in map bypass validation)
- Gateway on() listeners receive single arg (payload), not (event, data)
- All IPC handlers validate sender origin via validateSender() in ipc-registry.ts; file:// URLs have origin "null" — normalized to "file://"
- Shell commands with user/DB input use execFile() with arg arrays (not exec with string interpolation)
- Full binary paths required for execFile: /opt/homebrew/bin/openclaw, /opt/homebrew/bin/froggo-db, /opt/homebrew/bin/x-api, /opt/homebrew/bin/gog
- Module-level gateway listeners (store.ts, notificationService.ts) are intentional singletons -- never cleaned up
- Zustand arrays must have explicit bounds: artifactStore MAX_ARTIFACTS=200, MAX_VERSIONS_PER_ARTIFACT=50

### Pending Todos

- DEPLOY: `sudo cp ~/froggo/tools/dispatcher/agent-dispatcher /opt/homebrew/bin/agent-dispatcher` (write-protected, needs manual step)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-01 UTC
Stopped at: Completed 69-01-PLAN.md (Phase 69 complete)
Resume file: None

### Hourly Alignment Checks

**2026-03-01 00:41 GMT** — Hourly alignment check (Chief)
- Branch: feat/modular-dashboard-marketplace
- No pending tasks in froggo-db
- Phase 60 complete (Onboarding First Run)
- No blockers or architectural conflicts
- Marketplace: Recent commits on main (not dev branch)
  - d053c0c: Add agent performance card
  - b3bb20a: Update hero to 65/35 split
  - 9b434a3: Update stats (20+ modules, 15+ agents)

Config:
{
  "mode": "yolo",
  "depth": "comprehensive",
  "parallelization": true,
  "commit_docs": false,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
