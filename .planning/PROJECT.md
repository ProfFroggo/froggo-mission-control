# Mission Control — Froggo Platform

## What This Is

Mission Control is a multi-agent AI orchestration platform running in the browser. Agents (coder, researcher, writer, chief, clara, designer, social-manager, and 8 more) are orchestrated via Claude Code CLI, communicate through a shared SQLite database and Obsidian memory vault, and are controlled through a Next.js dashboard. A self-service catalog allows users to browse, hire, and install agents and modules without touching a CLI. Onboarding role presets configure a fresh instance in seconds.

## Core Value

Agents talking end-to-end — a human assigns work, agents execute autonomously, approvals surface only what needs human judgment.

## Requirements

### Validated

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
- ✓ ENV singleton (`src/lib/env.ts`) — single source of truth for paths/models — v2.0
- ✓ Tmux orchestration (`tools/tmux-setup.sh`, `tools/agent-start.sh`) — v2.0
- ✓ Enhanced memory MCP v3 (4 tools, QMD BM25/vector/hybrid) — v2.0
- ✓ APPROVAL_RULES.md Tier 0–3 + git worktrees for coder/designer/chief — v2.0
- ✓ 15 agents with real personality, maxTurns, worktreePath, model configs — v2.0
- ✓ 9 skills including x-twitter-strategy, nextjs-patterns, git-workflow — v2.0
- ✓ Voice bridge: Gemini Live WS server at `ws://localhost:8765` — v2.0
- ✓ Task dispatcher: soul file as `--system-prompt`, per-agent model, session persistence — v3.0
- ✓ All 15 workspace CLAUDE.md files using MCP tool calls (not defunct derek-db) — v3.0
- ✓ PreCompact hook re-injects current task + last 5 activities — v3.0
- ✓ TeammateIdle + TaskCompleted hooks auto-log to task board — v3.0
- ✓ Token & cost tracking: `token_usage` table, MODEL_PRICING, calcCostUsd() — v3.0
- ✓ Skills auto-loading in dispatch message — v3.0
- ✓ Monitoring: checkStuckTasks() cron sweep, /api/agents/health endpoint — v3.0
- ✓ Rate limiting: per-agent spawn lock + dispatch debounce — v3.0
- ✓ Catalog data model: catalog_agents + catalog_modules tables, 15+19 JSON manifests, catalogSync.ts — v4.0
- ✓ Catalog REST API: GET/PATCH/DELETE endpoints with core module protection — v4.0
- ✓ Agent Library UI: AgentLibraryPanel, Active/Library tabs, model badges — v4.0
- ✓ HR stream endpoint fixed, v3.0 soul template, custom agents register in catalog — v4.0
- ✓ Agent hire wizard: workspace creation with CLAUDE.md + SOUL.md + MEMORY.md — v4.0
- ✓ Module Library UI: ModuleLibraryPanel, Installed/Library tabs, category/dep warnings — v4.0
- ✓ Module install wizard: 3-step modal, POST /api/modules/install — v4.0
- ✓ Lifecycle: non-destructive fire (workspace archive), non-destructive uninstall — v4.0
- ✓ Onboarding role presets: 4 roles auto-install agents+modules, 7-step wizard — v4.0
- ✓ `validateAgentId()` utility — all agent/catalog routes guarded against path traversal and injection — v6.0
- ✓ Command injection fixed in spawn route (`spawnSync` args array, never shell-interpolated) — v6.0
- ✓ Path traversal fixed in library (`startsWith` boundary) + files/read (`ALLOWED_ROOTS` allowlist) routes — v6.0
- ✓ Hardcoded absolute path removed from soul route (uses `process.cwd()`) — v6.0
- ✓ Gemini API key server-side: 7 components use DB-backed settings API, not localStorage — v6.0
- ✓ 5 security headers in next.config.js (X-Frame-Options, CSP with Gemini origins, nosniff, Referrer-Policy, XSS-Protection) — v6.0
- ✓ Input length limits: task (500/5000), hire (100), library (255), soul (50KB cap, 413 on exceed) — v6.0
- ✓ Module ID validation via `validateAgentId` in catalog/modules/[id] — v6.0
- ✓ 20 security regression checks in e2e-smoke-test.sh (127/128 passing) — v6.0

### Active (v5.0 — next milestone, TBD)

- [ ] Agent streaming workspace generation (currently step-progress UI, not live stream)
- [ ] Role preset saved to DB for catalog recommendations
- [ ] Re-hire UX: full config preservation on re-hire
- [ ] Starred messages API (ChatPanel TODO)
- [ ] File attachments in chat
- [ ] Whisper transcription wired (bridge.ts shim in place)

### Out of Scope

- Electron / electron-builder — permanently removed, MDM blocks unsigned Electron on Bitso device
- OpenClaw gateway — replaced by Claude Code SDK direct integration
- `--dangerously-skip-permissions` — agents use proper approval flow
- Twitter/X automation — deferred (no external API keys in scope)
- Finance module — deferred (external API dependencies)
- Supabase / remote DB — SQLite is intentional for local-first operation

## Context

**Current state (post v6.0):**
- Stack: Next.js 15 App Router, TypeScript, Tailwind CSS, Zustand, better-sqlite3, lucide-react
- DB: `~/mission-control/data/mission-control.db` (20 tables: 18 core + catalog_agents + catalog_modules)
- Memory: `~/mission-control/memory/` (Obsidian vault, QMD indexed)
- Library: `~/mission-control/library/` (agent output files, category-routed)
- MCP: `mission-control-db` (11 tools) + `memory` (4 tools v3)
- Catalog: `catalog/agents/` (15 manifests) + `catalog/modules/` (18 manifests)
- Agents: 15 defined in `.claude/agents/` with enriched SOUL.md + workspace dirs
- E2E test: `tools/e2e-smoke-test.sh` — 127/128 checks pass (1 pre-existing TS error)
- LOC: ~119,510 TypeScript/TSX
- Security: all critical/high audit findings resolved (v6.0)

**Technical debt:**
- Belt-and-suspenders in ModuleInstallModal (calls both moduleApi.install + catalogApi.setModuleInstalled)
- 531 `window.clawdbot` refs still via bridge.ts shim (from v1.0 carry-over)

**Path mapping:**
| Spec path | Actual path |
|-----------|-------------|
| `~/froggo-nextjs/` | `~/git/mission-control-nextjs/` |
| `~/froggo/data/froggo.db` | `~/mission-control/data/mission-control.db` |
| `~/obsidian-vault/` | `~/mission-control/memory/` |
| `froggo-agents` tmux session | `mission-control` (renamed) |
| `~/froggo-worktrees/` | `~/mission-control/worktrees/` |

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
| Tmux for agent orchestration | Terminal multiplexer, persistent sessions, easy pane management | ✓ Good |
| Gemini Live for voice layer | Native audio I/O, personality transfer via system_instruction | ✓ Good |
| Three-tier model strategy | Cost/capability tradeoff per agent role | ✓ Good |
| `--system-prompt` with SOUL.md for dispatch | `--agents {id}` is interactive mode only; `--print` needs explicit system | ✓ Good |
| Catalog additive (separate tables) | No migration risk to existing agents/module_state | ✓ Good |
| ON CONFLICT preserves hire state | Manifests own metadata; DB owns install state | ✓ Good |
| Non-destructive fire (workspace rename) | Preserves agent work history for forensics | ✓ Good |
| Core module guard at API layer | Defense in depth — not just UI | ✓ Good |
| `Promise.allSettled` for role presets | Partial install failure doesn't block onboarding | ✓ Good |
| `validateAgentId` shared utility pattern | One function applied everywhere — returns `NextResponse \| null` | ✓ Good |
| `spawnSync` args array for child processes | Agent ID never shell-interpolated — eliminates injection class | ✓ Good |
| `ALLOWED_ROOTS` allowlist for file reads | Safer than denylist — explicit whitelist of accessible paths | ✓ Good |
| CSP via `next.config.js headers()` (not middleware) | Simpler, no edge runtime needed, applies globally | ✓ Good |
| Input length caps pragmatic (not RFC-strict) | 500/5000/100/255/50KB chosen for DoS prevention, not pedantic limits | ✓ Good |
| Static smoke test checks (grep-based) | No running server required — catches regressions in any environment | ✓ Good |

---
*Last updated: 2026-03-07 after v6.0 milestone*
