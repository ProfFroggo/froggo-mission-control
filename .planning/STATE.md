# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Agents talking end-to-end — a human assigns work, agents execute autonomously, approvals surface only what needs human judgment.
**Current focus:** v2.0 Froggo Platform — Phase 15 (Env & Config) ready to plan

## Current Position

Phase: 15 of 22 (env-and-config)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-05 — v1.0 milestone archived, v2.0 roadmap scaffolded

Progress: ████████████████░░░░ 14/22 phases complete

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 30
- Average duration: 3 min
- Total execution time: ~1.5 hours

## Accumulated Context

### Architecture (post v1.0)

- **App**: Next.js 15 App Router, TypeScript, Tailwind, Zustand
- **DB**: `~/mission-control/data/mission-control.db` (better-sqlite3, WAL, 18 tables)
- **Memory**: `~/mission-control/memory/` (Obsidian vault, QMD indexed)
- **Library**: `~/mission-control/library/` (agent output files)
- **MCP**: `tools/mission-control-db-mcp/` (11 tools) + `tools/memory-mcp/` (3 tools)
- **Agents**: 13 in `.claude/agents/` with SOUL.md
- **Hooks**: `tools/hooks/` — approval-hook.js, review-gate.js, session-sync.js
- **Skills**: 6 in `.claude/skills/`
- **Build**: `npm run build` PASS, 19 pages, TypeScript clean

### Path Mapping (PDF spec → actual)

| Spec path | Actual path |
|-----------|-------------|
| `~/froggo-nextjs/` | `~/git/mission-control-nextjs/` |
| `~/froggo/data/froggo.db` | `~/mission-control/data/mission-control.db` |
| `~/obsidian-vault/` | `~/mission-control/memory/` |
| `froggo-agents` tmux session | `froggo-agents` (same name) |
| `~/froggo-worktrees/` | `~/mission-control-worktrees/` |

### Key Decisions (v1.0 + v2.0 setup)

- Next.js App Router + better-sqlite3 at ~/mission-control/data/mission-control.db
- SSE not WebSocket; StdioServerTransport for MCP servers
- Tmux `froggo-agents` session for persistent agent panes (v2.0)
- Three-tier model: Opus=lead/orchestrator, Sonnet=workers, Haiku=trivial (v2.0)
- Gemini Live `gemini-2.5-flash-native-audio-preview` for voice layer (v2.0)
- No new directories during agent work — amend existing structure only

### Deferred Issues (carried from v1.0)

- Starred messages API not implemented (ChatPanel TODO)
- File attachments (fs:writeBase64) no web equivalent
- Whisper transcription not wired (bridge.ts shim in place)
- 531 `window.clawdbot` refs still via bridge.ts — direct migration per-component not done

### Pending Todos

None.

## Session Continuity

Last session: 2026-03-05
Stopped at: v1.0 archived, v2.0 ROADMAP scaffolded — Phase 15 ready to plan
Resume file: None
