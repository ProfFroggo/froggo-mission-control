# Mission Control — Froggo Platform

## What This Is

Mission Control is a multi-agent AI orchestration platform running in the browser. Agents (coder, researcher, writer, chief, clara, designer, etc.) are orchestrated via Claude Code CLI, communicate through a shared SQLite database and Obsidian memory vault, and are controlled through a Next.js dashboard. The v1.0 migration from Electron is complete — the platform now runs fully in the browser with no native dependencies.

## Core Value

Agents talking end-to-end — a human assigns work, agents execute autonomously, approvals surface only what needs human judgment.

## Requirements

### Validated (v1.0)

- ✓ Electron removed, Next.js App Router scaffolded — v1.0
- ✓ 18-table SQLite schema with `getDb()` singleton — v1.0
- ✓ 36 API routes covering all former IPC channels — v1.0
- ✓ All Zustand stores using typed REST API clients — v1.0
- ✓ `mission-control-db` MCP server (11 tools) for agent DB access — v1.0
- ✓ memory MCP server (3 tools) for Obsidian vault access — v1.0
- ✓ 13 agent SOUL.md configs in `.claude/agents/` — v1.0
- ✓ Tiered approval hook system (Tier 0–3) — v1.0
- ✓ Session sync hook → Obsidian vault — v1.0
- ✓ Obsidian vault at `~/mission-control/memory/` with QMD indexing — v1.0
- ✓ Chat rooms with 5s polling UI — v1.0
- ✓ Session management API (persist + resume sessions) — v1.0
- ✓ Cron daemon + cron MCP server (3 tools) — v1.0
- ✓ Real SSE streaming via claude CLI `stream-json` — v1.0
- ✓ 6 Claude Code skills in `.claude/skills/` — v1.0
- ✓ `npm run build` PASS, TypeScript clean — v1.0

### Active (v2.0 — Froggo Platform)

- [ ] Env & config: `.env` file, typed `src/lib/env.ts` wrapper, `COST_STRATEGY.md`
- [ ] Tmux orchestration: `tools/tmux-setup.sh` named session `froggo-agents`, per-agent panes
- [ ] Agent start/resume script: `tools/agent-start.sh` (resume by session ID or start new)
- [ ] Dashboard spawn API: `/api/agents/[id]/spawn` maps agent IDs to tmux panes
- [ ] Enhanced memory MCP: 4 tools (memory_search, memory_recall, memory_write, memory_read) with QMD BM25/vector/hybrid
- [ ] Session sync hook: exports to Obsidian, updates QMD index, logs analytics
- [ ] APPROVAL_RULES.md: Tier 0–3 with explicit examples per agent action
- [ ] Git worktrees: `tools/worktree-setup.sh` for coder, designer, chief agents
- [ ] Voice bridge: Gemini Live API (`gemini-2.5-flash-native-audio-preview`) as voice skin, Claude Code as brain
- [ ] Per-agent capability configs: frontmatter with model, mode, maxTurns, tools, worktree
- [ ] Agent soul enrichment: real personality, context, and constraints in each SOUL.md
- [ ] Three-tier model strategy: Opus (lead), Sonnet (worker), Haiku (trivial)

### Out of Scope

- Electron / electron-builder — permanently removed, MDM blocks unsigned Electron on Bitso device
- OpenClaw gateway — replaced by Claude Code SDK direct integration
- `--dangerously-skip-permissions` — agents use proper approval flow
- Twitter/X automation — deferred (no external API keys in scope)
- Finance module — deferred (external API dependencies)
- Supabase / remote DB — SQLite is intentional for local-first operation

## Context

**Current state (post v1.0):**
- Stack: Next.js 15 App Router, TypeScript, Tailwind CSS, Zustand, better-sqlite3, lucide-react
- DB: `~/mission-control/data/mission-control.db` (18 tables, WAL mode)
- Memory: `~/mission-control/memory/` (Obsidian vault, QMD indexed)
- Library: `~/mission-control/library/` (agent output files)
- MCP: `mission-control-db` (11 tools) + `memory` (3 tools)
- Agents: 13 defined in `.claude/agents/` with SOUL.md
- Build: `npm run build` PASS, 19 pages, TypeScript clean
- LOC: ~117,000 TypeScript/TSX

**Technical debt from v1.0:**
- 531 `window.clawdbot` references still routed via bridge.ts shim — direct migration per component not yet done
- Agent SOUL.md files are skeletal — need real personality content
- Memory MCP uses grep fallback (QMD binary install not verified)

**Path mapping (PDF specs → actual):**
| Spec path | Actual path |
|-----------|-------------|
| `~/froggo-nextjs/` | `~/git/mission-control-nextjs/` |
| `~/froggo/data/froggo.db` | `~/mission-control/data/mission-control.db` |
| `~/obsidian-vault/` | `~/mission-control/memory/` |
| `froggo-agents` tmux session | `froggo-agents` (same) |

## Constraints

- **No Electron**: Kandji MDM (installed Feb 2026) blocks unsigned Electron apps with SIGKILL
- **No OpenClaw**: Replaced by Claude Code SDK + Next.js API routes
- **No --dangerously-skip-permissions**: Agents use proper approval flow
- **Local-first**: SQLite, Obsidian vault, no external database
- **Tech stack**: Next.js App Router, TypeScript, better-sqlite3 (server-side), Tailwind CSS

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router (not Pages) | Modern SSR + API routes, edge-ready | ✓ Good |
| `better-sqlite3` (not Postgres) | Same DB file, zero migration, simpler ops | ✓ Good |
| `window.clawdbot` compat shim | Incremental migration without breaking all components at once | ✓ Good |
| Claude Code SDK (not custom runner) | No OpenClaw dependency, native ecosystem | ✓ Good |
| SSE for streaming (not WebSocket) | Simpler, works with Next.js routes natively | ✓ Good |
| `noImplicitAny: false` in tsconfig | Electron codebase used implicit any throughout | ✓ Good |
| Obsidian vault for memory | Human-readable, QMD-searchable, works offline | ✓ Good |
| StdioServerTransport for MCP | Standard pattern, no extra server port needed | ✓ Good |
| Tmux for agent orchestration | Terminal multiplexer, persistent sessions, easy pane management | — v2.0 |
| Gemini Live for voice layer | Native audio I/O, personality transfer via system_instruction | — v2.0 |
| Three-tier model strategy | Cost/capability tradeoff per agent role | — v2.0 |

---
*Last updated: 2026-03-05 after v1.0 milestone*
