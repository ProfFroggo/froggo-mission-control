# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Agents talking end-to-end — a human assigns work, agents execute autonomously, approvals surface only what needs human judgment.
**Current focus:** v2.0 Froggo Platform — COMPLETE 2026-03-05

## Current Position

Phase: 23 of 30 (task-dispatcher-overhaul)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-06 — v3.0 Autonomous Core milestone created (8 phases, 10 plans)

Progress: ░░░░░░░░░░ 0% (v3.0)

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
- **E2E test**: `tools/e2e-smoke-test.sh` — 62/62 checks pass

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

## Roadmap Evolution

- Milestone v3.0 created: Autonomous Core — closes dispatcher gap, adds PreCompact resilience, Agent Teams hooks, token tracking, skills auto-loading, monitoring, rate limiting (Phases 23-30)

## Session Continuity

Last session: 2026-03-06
Stopped at: v3.0 Autonomous Core milestone created — Phase 23 (task-dispatcher-overhaul) ready to plan
Resume file: None
