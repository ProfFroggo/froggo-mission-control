# Froggo Directory Restructure — 2026-02-12

## Problem

The Froggo.app dashboard was completely broken — no tasks loaded, nothing worked. Three root causes:

1. **Broken froggo-db symlinks** — `/opt/homebrew/bin/froggo-db` and `~/.local/bin/froggo-db` pointed to a dead path (`~/Froggo/clawd/tools/froggo-db/froggo-db`) from a prior migration attempt that no longer existed
2. **50+ hardcoded absolute paths** in `electron/main.ts` and other electron/*.ts files — all referencing `/Users/worker/clawd/` or `os.homedir() + 'clawd'` with no abstraction
3. **Stripped database at canonical path** — `~/clawd/data/froggo.db` was a 491KB skeleton DB (no tasks table, no subtasks, no agent_registry). The real 26MB database with 795 tasks and 173 tables lived at `~/clawd-froggo/data/froggo.db` inside the agent workspace
4. **Dashboard nested inside agent workspace** — the Electron app lived at `~/clawd-froggo/clawd-dashboard/`, buried two levels deep inside the Froggo agent's workspace directory

Additionally, the entire project used the legacy `clawd` naming from the pre-OpenClaw era, making the codebase confusing for anyone not familiar with the history.

---

## Approach

Six sequential states, each independently valuable, each with rollback capability:

| State | Goal | Risk Level |
|-------|------|------------|
| 0 | Freeze + baseline snapshot | None |
| 3 | Path resolver module (make code location-independent) | Low |
| 4 | Fix prod (make tasks appear) | Medium |
| 5 | Move dashboard + rename agent workspaces | Medium |
| 6 | Rename project root `clawd` → `froggo` | High |

States 1-2 were planning/mapping states executed inline (no separate implementation step).

---

## State 0 — Freeze and Baseline

**What:** Created safety nets before touching anything.

**Actions:**
- Created branch `fix/restructure-safe` off `dev`
- Tagged `pre-restructure-20260212` for point-in-time recovery
- Created tarballs:
  - `~/backups/pre-restructure-clawd.tar.gz` (project backbone)
  - `~/backups/pre-restructure-dashboard.tar.gz` (dashboard app)
- Pushed branch + tag to remote

**Recovery:** `git checkout pre-restructure-20260212` + extract tarballs to restore any state.

---

## State 3 — Centralized Path Resolver

**What:** Created `electron/paths.ts` — a single module that owns every filesystem path used by the Electron main process. All 7 electron/*.ts files now import paths from here instead of constructing them inline.

### New File: `electron/paths.ts`

```typescript
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const HOME = os.homedir();

// Env var overrides for portability (CI, other machines, future renames)
export const PROJECT_ROOT = process.env.FROGGO_ROOT || path.join(HOME, 'froggo');
const AGENT_PREFIX = process.env.FROGGO_AGENT_PREFIX || 'agent-';

// Project directories
export const DATA_DIR     = path.join(PROJECT_ROOT, 'data');
export const SCRIPTS_DIR  = path.join(PROJECT_ROOT, 'scripts');
export const TOOLS_DIR    = path.join(PROJECT_ROOT, 'tools');
export const LIBRARY_DIR  = path.join(PROJECT_ROOT, 'library');
export const UPLOADS_DIR  = path.join(PROJECT_ROOT, 'uploads');
export const LOGS_DIR     = path.join(PROJECT_ROOT, 'logs');
export const REPORTS_DIR  = path.join(PROJECT_ROOT, 'reports');

// Database files
export const FROGGO_DB    = path.join(DATA_DIR, 'froggo.db');
export const SCHEDULE_DB  = path.join(DATA_DIR, 'schedule.db');
export const SECURITY_DB  = path.join(DATA_DIR, 'security.db');

// OpenClaw directories
export const OPENCLAW_DIR    = path.join(HOME, '.openclaw');
export const SESSIONS_DB     = path.join(OPENCLAW_DIR, 'sessions.db');
export const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');

// External binaries
export const LOCAL_BIN     = path.join(HOME, '.local', 'bin');
export const FROGGO_DB_CLI = path.join(LOCAL_BIN, 'froggo-db');
export const TGCLI         = path.join(LOCAL_BIN, 'tgcli');
export const DISCORDCLI    = path.join(LOCAL_BIN, 'discordcli');
export const CLAUDE_CLI    = path.join(LOCAL_BIN, 'claude');

// Shell PATH for child processes
export const SHELL_PATH = `/opt/homebrew/bin:${LOCAL_BIN}:/usr/local/bin:/usr/bin:/bin`;

// Agent workspaces
export const agentWorkspace = (agentId: string) =>
  path.join(HOME, `${AGENT_PREFIX}${agentId}`);

// Startup diagnostics
export function verifyPaths(): void { ... }
```

### Replacements in `electron/main.ts` (50+ changes)

| Pattern (before) | Replacement (after) | Count |
|-------------------|---------------------|-------|
| `path.join(os.homedir(), 'clawd', 'data', 'froggo.db')` | `FROGGO_DB` | 6 |
| `path.join(os.homedir(), 'clawd', 'scripts', ...)` | `path.join(SCRIPTS_DIR, ...)` | 6 |
| `path.join(os.homedir(), 'clawd', 'tools', ...)` | `path.join(TOOLS_DIR, ...)` | 2 |
| `path.join(os.homedir(), 'clawd', 'library')` | `LIBRARY_DIR` | 1 |
| `path.join(os.homedir(), 'clawd', 'uploads')` | `UPLOADS_DIR` | 1 |
| `` `sqlite3 ~/clawd/data/froggo.db` `` | `` `sqlite3 ${FROGGO_DB}` `` | 5 |
| `` `~/clawd/scripts/inbox-filter.sh` `` | `` `${SCRIPTS_DIR}/inbox-filter.sh` `` | 7 |
| `/Users/worker/.local/bin/froggo-db` | `FROGGO_DB_CLI` | 3 |
| `/Users/worker/.local/bin/tgcli` | `TGCLI` | 3 |
| `/Users/worker/.local/bin/discordcli` | `DISCORDCLI` | 3 |
| `/Users/worker/.local/bin/claude` | `CLAUDE_CLI` | 2 |
| Inline PATH strings | `SHELL_PATH` | 3 |
| `` `~/clawd-${r.id}` `` workspace template | `agentWorkspace(r.id)` | 1 |
| `.clawdbot` legacy references | `.openclaw` | various |

### Other electron/*.ts files updated

| File | What changed |
|------|-------------|
| `database.ts` | Removed `homedir`/`join` imports. Now imports `FROGGO_DB`, `SCHEDULE_DB`, `SECURITY_DB`, `SESSIONS_DB`, `SESSIONS_DB_LEGACY` from `./paths` |
| `connected-accounts-service.ts` | `DB_PATH` now imported as `FROGGO_DB` from `./paths`. Removed unused `os`, `path`, `fs` imports |
| `export-backup-service.ts` | `DB_PATH = FROGGO_DB`, backup/export dirs use `PROJECT_ROOT`. Removed inline path construction |
| `benchmark.ts` | `dbPath = FROGGO_DB`. Removed unused `path`/`os` imports |
| `notification-events.ts` | `SESSION_DIR` now uses `OPENCLAW_DIR` (was `.clawdbot`). Removed unused imports |

### Why this matters

- **Zero hardcoded paths** in the electron codebase (except `shell-security.ts` blocklist, which is intentional)
- **Future renames are zero-code** — set `FROGGO_ROOT` env var and everything follows
- **CI/other machines** can override paths without touching source
- **Startup diagnostics** (`verifyPaths()`) catches missing files immediately

---

## State 4 — Fix Production

**What:** Made the dashboard actually work again. Tasks visible, agents listed, no errors.

### Critical discovery: wrong database

The DB at `~/clawd/data/froggo.db` (491KB) was a stripped skeleton — missing `tasks`, `subtasks`, `agent_registry`, and dozens of other tables. The real database with 795 tasks, 173 tables, and 26MB of data lived at `~/clawd-froggo/data/froggo.db`.

**Fix:** Copied the real DB to the canonical path:
```bash
cp ~/clawd-froggo/data/froggo.db ~/clawd/data/froggo.db
ln -sf ~/clawd/data/froggo.db ~/clawd-froggo/data/froggo.db  # old points to new
```

### Broken symlinks fixed

| Symlink | Was pointing to | Fixed to |
|---------|----------------|----------|
| `/opt/homebrew/bin/froggo-db` | `~/Froggo/clawd/tools/froggo-db/froggo-db` (DEAD) | `~/clawd/tools/froggo-db/froggo-db` |
| `~/.local/bin/froggo-db` | `~/Froggo/clawd/tools/froggo-db/froggo-db` (DEAD) | `~/clawd/tools/froggo-db/froggo-db` |
| `~/.local/bin/chief` | `~/clawd/agents/lead-engineer/launch.sh` (DEAD) | Removed (obsolete) |

### froggo-db CLI path fix

The Python CLI itself had hardcoded paths to the old `~/Froggo/` tree:
```python
# Before (line 64-65)
DB_PATH = Path.home() / "Froggo" / "clawd" / "data" / "froggo.db"
SCHEMA_PATH = Path.home() / "Froggo" / "clawd" / "tools" / "froggo-db" / "schema.sql"

# After
DB_PATH = Path.home() / "clawd" / "data" / "froggo.db"
SCHEMA_PATH = Path.home() / "clawd" / "tools" / "froggo-db" / "schema.sql"
```

### Stale file removed

`~/.openclaw/froggo.db` — 0 bytes, leftover from some prior operation. Could confuse any tooling scanning for DBs.

### Build + deploy

```bash
cd ~/clawd-froggo/clawd-dashboard
npm run build:prod   # tsc + vite + electron-builder
cp -R release/prod/mac-arm64/Froggo.app /Applications/
```

**Result:** App opens, tasks load (795 tasks visible), agent list populates, no errors.

---

## State 5 — Move Dashboard + Rename Agent Workspaces

**What:** Dashboard becomes a standalone app. Agent workspaces get the `agent-` prefix.

### Dashboard moved out of agent workspace

```
Before: ~/clawd-froggo/clawd-dashboard/
After:  ~/froggo-dashboard/
Shim:   ~/clawd-froggo/clawd-dashboard → ~/froggo-dashboard (symlink)
```

### Agent workspaces renamed

All 19 `~/clawd-*` directories renamed to `~/agent-*`:

| Before | After |
|--------|-------|
| `~/clawd-coder/` | `~/agent-coder/` |
| `~/clawd-writer/` | `~/agent-writer/` |
| `~/clawd-researcher/` | `~/agent-researcher/` |
| `~/clawd-chief/` | `~/agent-chief/` |
| `~/clawd-clara/` | `~/agent-clara/` |
| `~/clawd-hr/` | `~/agent-hr/` |
| `~/clawd-designer/` | `~/agent-designer/` |
| `~/clawd-voice/` | `~/agent-voice/` |
| `~/clawd-social-manager/` | `~/agent-social-manager/` |
| `~/clawd-growth-director/` | `~/agent-growth-director/` |
| `~/clawd-lead-engineer/` | `~/agent-lead-engineer/` |
| `~/clawd-senior-coder/` | `~/agent-senior-coder/` |
| `~/clawd-froggo/` | `~/agent-froggo/` |
| `~/clawd-chat-agent/` | `~/agent-chat-agent/` |
| `~/clawd-degen-frog/` | `~/agent-degen-frog/` |
| `~/clawd-jess/` | `~/agent-jess/` |
| `~/clawd-finance-manager/` | `~/agent-finance-manager/` |
| `~/clawd-inbox/` | `~/agent-inbox/` |
| `~/clawd-main/` | `~/agent-main/` |
| `~/clawd-workspace/` | `~/agent-workspace/` |

Backward-compat symlinks created at every old path (`~/clawd-X` → `~/agent-X`).

### Code changes

- `electron/paths.ts`: `AGENT_PREFIX` default changed from `'clawd-'` to `'agent-'`
- `/opt/homebrew/bin/agent-dispatcher`: `memory_path` pattern updated (`~/agent-{agent_id}/MEMORY.md`)

### Build + deploy from new location

```bash
cd ~/froggo-dashboard
npm run build:prod
cp -R release/prod/mac-arm64/Froggo.app /Applications/
```

---

## State 6 — Root Rename (`clawd` → `froggo`)

**What:** The project backbone directory renamed from `~/clawd` to `~/froggo`. This was the largest change — touching every config file, every script, every tool, every doc.

### Directory move

```bash
mv ~/clawd ~/froggo
ln -s ~/froggo ~/clawd   # backward-compat symlink
```

### Dashboard code

`electron/paths.ts` default changed:
```typescript
// Before
const PROJECT_ROOT = process.env.FROGGO_ROOT || path.join(HOME, 'clawd');
// After
const PROJECT_ROOT = process.env.FROGGO_ROOT || path.join(HOME, 'froggo');
```

### froggo-db CLI (Python)

Updated 12 path references across 3 files:

| File | Changes |
|------|---------|
| `froggo-db` (main) | `DB_PATH`, `SCHEMA_PATH`, `memory_dir`, `queue_file`, `enforcer_path` (×4), error message, spawn command, example text |
| `inbox_search_commands.py` | 5× `DB_PATH` in different functions |
| Helper scripts (7 files) | `skill-track.sh`, `test-calendar.sh`, `emit-task-event.sh`, `test-entry-point-notifications.sh`, `test-calendar-crud.sh`, `calendar-helper.sh`, `add-comms-metadata.sql` |

### Agent dispatcher

`/opt/homebrew/bin/agent-dispatcher` line 37:
```python
# Before
DB_PATH = os.path.expanduser("~/clawd/data/froggo.db")
# After
DB_PATH = os.path.expanduser("~/froggo/data/froggo.db")
```

### LaunchAgent plists (6 files)

All `/Users/worker/clawd/` references replaced with `/Users/worker/froggo/`:

| Plist | Paths changed |
|-------|--------------|
| `com.clawd.library-watcher.plist` | ProgramArguments, StandardOutPath, StandardErrorPath |
| `com.clawd.message-aggregation.plist` | ProgramArguments, StandardOutPath, StandardErrorPath |
| `com.clawd.notifications.plist` | ProgramArguments (×2 — full path + inline bash), StandardOutPath, StandardErrorPath, WorkingDirectory |
| `com.clawd.read-state-sync.plist` | ProgramArguments, StandardOutPath, StandardErrorPath |
| `com.clawd.task-lifecycle.plist` | ProgramArguments, StandardOutPath, StandardErrorPath |
| `com.clawd.telegram-cache.plist` | ProgramArguments, StandardOutPath, StandardErrorPath |

All 6 plists reloaded via `launchctl bootout` + `launchctl bootstrap`.

### OpenClaw config (`~/.openclaw/openclaw.json`)

| Field | Before | After |
|-------|--------|-------|
| `env.vars.NODE_OPTIONS` | `--require /Users/worker/clawd/tools/...` | `--require /Users/worker/froggo/tools/...` |
| `agents.defaults.workspace` | `/Users/worker/clawd` | `/Users/worker/froggo` |
| `agents.list[0].workspace` (froggo) | `/Users/worker/clawd` | `/Users/worker/froggo` |
| `agents.list[1-14].workspace` (all agents) | `/Users/worker/clawd-{name}` | `/Users/worker/agent-{name}` |
| `session.store` | `~/.clawdbot/sessions/sessions.json` | `~/.openclaw/sessions/sessions.json` |

### External symlinks retargeted

| Symlink | Before | After |
|---------|--------|-------|
| `/opt/homebrew/bin/froggo-db` | `~/clawd/tools/froggo-db/froggo-db` | `~/froggo/tools/froggo-db/froggo-db` |
| `~/.local/bin/froggo-db` | `~/clawd/tools/froggo-db/froggo-db` | `~/froggo/tools/froggo-db/froggo-db` |
| `/opt/homebrew/bin/solana-transfer-safe` | `~/clawd/tools/solana-transfer-safe` | `~/froggo/tools/solana-transfer-safe` |
| `/opt/homebrew/bin/x-api` | `~/clawd/tools/x-api/x-api` | `~/froggo/tools/x-api/x-api` |

### Agent workspace context symlinks retargeted

All `~/agent-*/AGENTS.md`, `~/agent-*/TOOLS.md`, `~/agent-*/USER.md` now point to `~/froggo/shared-context/` instead of `~/clawd/shared-context/`.

### Bulk script/tool/doc updates

| Category | File count | Pattern replaced |
|----------|-----------|-----------------|
| Shell scripts (`~/froggo/scripts/`) | 180 | `$HOME/clawd/`, `~/clawd/`, `/Users/worker/clawd/`, `${HOME}/clawd/` → `froggo` equivalents |
| Tool scripts (`~/froggo/tools/`) | 14 | Same patterns |
| Markdown docs (`~/froggo/**/*.md`) | 15 | Same + `clawd-dashboard` → `froggo-dashboard`, `~/.clawdbot/` → `~/.openclaw/`, `~/clawd-*` → `~/agent-*` |
| Agent workspace docs (`~/agent-*/**/*.md`) | 279+ | Same path patterns, `clawd-dashboard` → `froggo-dashboard` |
| Dashboard docs (`~/froggo-dashboard/*.md`) | 4 | Same path patterns |
| Root CLAUDE.md | 1 | Updated workspace reference |

### Build + deploy

```bash
cd ~/froggo-dashboard
npm run build:prod
cp -R release/prod/mac-arm64/Froggo.app /Applications/
```

---

## Final Directory Structure

```
~/froggo/                              # Project root (backbone)
  ├── data/
  │   ├── froggo.db                    # Canonical task DB (26MB, 795 tasks, 173 tables)
  │   ├── schedule.db
  │   └── security.db
  ├── scripts/                         # 180+ operational shell scripts
  ├── tools/
  │   ├── froggo-db/                   # Main CLI tool (Python, 6000+ lines)
  │   │   ├── froggo-db                # Entry point
  │   │   ├── inbox_search_commands.py
  │   │   ├── read_state_commands.py
  │   │   ├── gate_commands.py
  │   │   ├── finance_commands.py
  │   │   ├── helpers/
  │   │   ├── migrations/
  │   │   ├── triggers.sql
  │   │   └── schema.sql
  │   ├── x-api/                       # Twitter/X API tool
  │   ├── session-manager/
  │   ├── library-watcher.js
  │   └── ...
  ├── shared-context/                  # Symlinked into every agent workspace
  │   ├── AGENTS.md
  │   ├── TOOLS.md
  │   └── USER.md
  ├── config/
  ├── library/
  ├── uploads/
  ├── logs/
  └── memory/

~/froggo-dashboard/                    # Standalone Electron app
  ├── electron/                        # Main process (TypeScript)
  │   ├── main.ts                      # 7000+ lines, 60+ IPC handlers
  │   ├── paths.ts                     # NEW — centralized path resolver
  │   ├── database.ts                  # SQLite connection manager
  │   ├── connected-accounts-service.ts
  │   ├── export-backup-service.ts
  │   ├── benchmark.ts
  │   ├── notification-events.ts
  │   ├── notification-service.ts
  │   └── shell-security.ts
  ├── src/                             # Renderer (React + TypeScript + Vite)
  │   ├── components/
  │   ├── store/
  │   ├── lib/
  │   └── ...
  ├── electron-builder.dev.js          # Dev build config (com.froggo.dev)
  ├── electron-builder.prod.js         # Prod build config (com.froggo.app)
  ├── release/
  │   ├── dev/mac-arm64/               # Dev builds go here
  │   └── prod/mac-arm64/              # Prod builds go here
  └── ...

~/agent-{name}/                        # 19 agent workspaces
  ├── AGENTS.md → ~/froggo/shared-context/AGENTS.md
  ├── TOOLS.md  → ~/froggo/shared-context/TOOLS.md
  ├── USER.md   → ~/froggo/shared-context/USER.md
  ├── SOUL.md                          # Agent personality/rules
  ├── IDENTITY.md                      # Agent identity
  ├── STATE.md                         # Current state
  ├── MEMORY.md                        # Persistent memory
  └── HEARTBEAT.md                     # Status/heartbeat

~/froggo-voice/                        # Voice service (standalone)

~/.openclaw/                           # OpenClaw runtime
  ├── openclaw.json                    # Config (agents, channels, gateway, models)
  ├── sessions.db                      # Gateway session database
  ├── dispatcher-state.json            # Agent dispatcher cooldowns + state
  ├── logs/
  └── agents/{name}/                   # Per-agent OpenClaw config

/Applications/Froggo.app               # Production app
/opt/homebrew/bin/agent-dispatcher      # Unified dispatcher (Python)
/opt/homebrew/bin/froggo-db             # → ~/froggo/tools/froggo-db/froggo-db
/opt/homebrew/bin/x-api                 # → ~/froggo/tools/x-api/x-api
/opt/homebrew/bin/solana-transfer-safe  # → ~/froggo/tools/solana-transfer-safe
~/.local/bin/froggo-db                  # → ~/froggo/tools/froggo-db/froggo-db
```

### Backward-compat symlinks (temporary)

```
~/clawd                    → ~/froggo
~/clawd-coder              → ~/agent-coder
~/clawd-writer             → ~/agent-writer
~/clawd-researcher         → ~/agent-researcher
~/clawd-chief              → ~/agent-chief
~/clawd-clara              → ~/agent-clara
~/clawd-hr                 → ~/agent-hr
~/clawd-designer           → ~/agent-designer
~/clawd-voice              → ~/agent-voice
~/clawd-social-manager     → ~/agent-social-manager
~/clawd-growth-director    → ~/agent-growth-director
~/clawd-lead-engineer      → ~/agent-lead-engineer
~/clawd-senior-coder       → ~/agent-senior-coder
~/clawd-froggo             → ~/agent-froggo
~/clawd-chat-agent         → ~/agent-chat-agent
~/clawd-degen-frog         → ~/agent-degen-frog
~/clawd-jess               → ~/agent-jess
~/clawd-finance-manager    → ~/agent-finance-manager
~/clawd-inbox              → ~/agent-inbox
~/clawd-main               → ~/agent-main
~/clawd-workspace          → ~/agent-workspace
```

These can be removed once everything is confirmed stable.

---

## Verification Results

| Check | Result |
|-------|--------|
| App opens and shows tasks | 795 tasks visible |
| `froggo-db token-summary day` | Works (no usage today) |
| `sqlite3 ~/froggo/data/froggo.db "SELECT count(*) FROM tasks"` | 795 |
| DB file size | 26MB (non-zero, WAL healthy) |
| External symlinks resolve | All 4 point to `~/froggo/` |
| Agent context symlinks resolve | All point to `~/froggo/shared-context/` |
| LaunchAgents reloaded | All 6 reloaded with `~/froggo/` paths |
| OpenClaw config clean | Zero `clawd` references |
| Dispatcher clean | Zero `clawd` references |
| `npm run build:prod` | Succeeds, produces `Froggo.app` |

---

## Recovery

If anything breaks:

```bash
# Option 1: Restore from tag
cd ~/froggo-dashboard
git checkout pre-restructure-20260212

# Option 2: Restore from tarballs
tar xzf ~/backups/pre-restructure-clawd.tar.gz -C ~
tar xzf ~/backups/pre-restructure-dashboard.tar.gz -C ~/agent-froggo/

# Option 3: Backward-compat symlinks still work
# ~/clawd → ~/froggo means old paths still resolve
```

---

## What's Next

- [ ] Run the app for a few days to confirm stability
- [ ] Remove backward-compat symlinks (`~/clawd`, `~/clawd-*`) once stable
- [ ] Remove `~/Froggo/` directory (old pre-migration attempt, if it exists)
- [ ] Commit all dashboard changes to git (paths.ts, main.ts, etc.)
- [ ] Establish proper dev workflow: branch from `dev`, PR to `dev`, merge to `main` for prod
