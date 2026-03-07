# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Agents talking end-to-end — a human assigns work, agents execute autonomously, approvals surface only what needs human judgment.
**Current focus:** v5.0 — planning next milestone

## Current Position

Phase: 40 — project-data-model
Plan: 40-01
Status: Todo — v5.0 milestone created, ready to execute Phase 40
Last activity: 2026-03-07 — v5.0 Projects Module milestone created (Phases 40–49)

Progress: ░░░░░░░░░░ 0% (v5.0 — 0/10 phases done)

## Performance Metrics

**Velocity (v1.0 + v2.0):**
- Total plans completed: 39 (30 v1.0 + 9 v2.0)
- v2.0 execution time: ~45 min (8 phases, autonomous)
- Total git commits this session: 11

## Accumulated Context

### Architecture (v2.0 — fully operational)

- **App**: Next.js 15 App Router, TypeScript, Tailwind, Zustand
- **DB**: `~/mission-control/data/mission-control.db` (better-sqlite3, WAL, 18 tables)
- **Memory**: `~/mission-control/memory/` (Obsidian vault, QMD BM25/vector/hybrid indexed)
- **Library**: `~/mission-control/library/` (agent output files, category-routed)
- **MCP**: `tools/mission-control-db-mcp/` (11 tools) + `tools/memory-mcp/` (4 tools v3.0)
- **Agents**: 15 in `.claude/agents/` — maxTurns, worktreePath, personality enriched
- **Hooks**: `tools/hooks/` — review-gate.js, session-sync.js (writes to vault + QMD)
- **Skills**: 9 in `.claude/skills/` (6 updated + 3 new: x-twitter, nextjs-patterns, git-workflow)
- **Voice**: `tools/voice-bridge/` — Gemini Live WS server, `/api/voice/status` endpoint
- **Tmux**: `tools/tmux-setup.sh` — `mission-control` session, 3 windows, per-agent panes
- **Worktrees**: `tools/worktree-setup.sh` — `~/mission-control-worktrees/{coder,designer,chief}`
- **Approval Rules**: `APPROVAL_RULES.md` — Tier 0-3 with per-agent matrix
- **E2E test**: `tools/e2e-smoke-test.sh` — 107/107 checks pass (v2.0 + v3.0 + v4.0)

### Path Mapping (PDF spec → actual)

| Spec path | Actual path |
|-----------|-------------|
| `~/froggo-nextjs/` | `~/git/mission-control-nextjs/` |
| `~/froggo/data/froggo.db` | `~/mission-control/data/mission-control.db` |
| `~/obsidian-vault/` | `~/mission-control/memory/` |
| `froggo-agents` tmux session | `mission-control` (renamed to match project) |
| `~/froggo-worktrees/` | `~/mission-control-worktrees/` |

### Key Decisions (v2.0)

- ENV.DB_PATH is canonical — no direct process.env in src/
- Tmux session named `mission-control` (not `froggo-agents`)
- Memory MCP v3.0: 4 tools (memory_search/recall/write/read) + QMD hybrid search
- Three-tier model: Opus 4.6 (lead), Sonnet 4.6 (workers), Haiku 4.5 (trivial)
- Gemini Live `gemini-2.5-flash-native-audio-preview` for voice layer
- Voice bridge runs as standalone Node.js WS server on port 8765
- MCP servers registered in `.claude/settings.json` mcpServers block
- Agent worktrees for coder/designer/chief only; senior-coder shares coder worktree
- 15 agents total (2 more than spec: discord-manager, finance-manager added in v1.0)

### Deferred Issues (carried from v1.0)

- Starred messages API not implemented (ChatPanel TODO)
- File attachments (fs:writeBase64) no web equivalent
- Whisper transcription not wired (bridge.ts shim in place)
- 531 `window.clawdbot` refs still via bridge.ts — direct migration per-component not done

### Pending Todos

None.

### Key Decisions (v3.0 — in progress)

- Task dispatcher: cwd=process.cwd() (not agent workspace) for MCP access; `{agentId}:task` key for task sessions
- `--system-prompt` with SOUL.md for `--print` mode (not `--agents {id}` which is for interactive mode only)
- Agent workspace CLAUDE.md files: replaced defunct derek-db CLI with mcp__mission-control_db__* MCP tools
- Task session expiry: 2 hours (shorter than chat 30-min in-memory; task sessions are discrete)

## Roadmap Evolution

- Milestone v3.0 created: Autonomous Core — closes dispatcher gap, adds PreCompact resilience, Agent Teams hooks, token tracking, skills auto-loading, monitoring, rate limiting (Phases 23-30)
- Phase 23.1 inserted: Agent Identity Foundation — fixed all 15 workspace CLAUDE.md files
- Milestone v4.0 created: Agent & Module Library — catalog schema, hire/install wizards (HR + Coder agent-backed), library UIs, lifecycle management, onboarding role presets (Phases 31-39)
- Milestone v5.0 created: Projects Module — project data model + REST API, creation wizard, card view, workspace shell with 4 tabs (chat/tasks/automations/files+memory), agent dispatch from project context (Phases 40-49)

### Key Decisions (v4.0)

- Catalog tables (catalog_agents, catalog_modules) are SEPARATE from existing agents/module_state tables — additive only
- .catalog/ manifest files are source of truth; syncCatalogAgents/syncCatalogModules() upsert on every DB init
- ON CONFLICT preserves installed/enabled/core — DB owns hire state, manifests own metadata
- 7 core modules: settings, agent-mgmt, inbox, chat, kanban, approvals, notifications
- syncCatalogModules() placed in catalogSync.ts (shared file) not a separate file

## Session Continuity

Last session: 2026-03-07
Stopped at: v5.0 milestone created. Phase 40 (project-data-model) is next. Start with Plan 40-01: DB migration (projects + project_members tables) then Plan 40-02: REST API routes + catalog module manifest.
Resume file: None
