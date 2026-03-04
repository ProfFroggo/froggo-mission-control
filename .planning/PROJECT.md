# Froggo AI Dashboard — Next.js Migration

## What This Is

Froggo is a multi-agent AI orchestration dashboard. This project migrates it from an Electron/OpenClaw desktop app to a Next.js web app backed by Claude Code agents via the Claude Code SDK. The result is a browser-based dashboard with no Electron, no OpenClaw, no third-party services.

## Core Value

Agents talking end-to-end — messages in, streaming responses out, human-in-the-loop approvals working. Everything else is scaffolding.

## Requirements

### Validated

- ✓ Repo cloned to `~/git/froggo-nextjs` — existing
- ✓ Migration branch `migration/nextjs-claude-code` created — existing
- ✓ Codebase audited (20+ IPC handler files, gateway.ts, preload.ts, agent-registry.json) — existing

### Active

- [ ] Strip Electron, scaffold Next.js App Router — Phase 1
- [ ] Database layer: better-sqlite3, full schema from existing Electron DB — Phase 2
- [ ] API routes: all IPC handler files → Next.js `/api/*` routes — Phase 3
- [ ] Frontend wiring: replace `window.clawdbot` IPC calls with fetch, SSE for chat — Phase 4
- [ ] MCP servers: `froggo-db` + memory MCP for agent tool access — Phase 5
- [ ] Agent definitions: `.claude/` directory, `SOUL.md` files, `settings.json` — Phase 6
- [ ] Permission & hook system: tiered approvals, Clara review gate, session sync — Phase 7
- [ ] Memory system: Obsidian vault + QMD indexing — Phase 8
- [ ] Chat rooms: inter-agent communication tables, API, UI — Phase 9
- [ ] Session management: persistent session table, spawn API — Phase 10
- [ ] Cron & automation: scheduled tasks, cron MCP, daemon — Phase 11
- [ ] SSE streaming: `/api/agents/:id/stream` endpoint, dashboard polling — Phase 12
- [ ] Skills: project-specific Claude Code skills — Phase 13
- [ ] Final integration & E2E testing — Phase 14

### Out of Scope

- Electron / electron-builder — permanently removed, MDM blocks unsigned Electron on Bitso device
- OpenClaw gateway — replaced by Claude Code SDK direct integration
- Third-party services (no Slack, no external APIs not already in codebase) — per constraint
- `--dangerously-skip-permissions` — explicitly excluded by migration spec
- Twitter/X automation features — low priority, deferred post-v1
- Finance module (external API dependencies) — deferred post-v1

## Context

- **Source**: [ProfFroggo/Froggo-AI](https://github.com/ProfFroggo/Froggo-AI.git) — Electron app using OpenClaw gateway (WebSocket at `ws://127.0.0.1:18789`)
- **Stack carried over**: Vite → Next.js, React 18, TypeScript, Tailwind CSS, Zustand, better-sqlite3, @dnd-kit, lucide-react, @tiptap
- **IPC surface**: 20+ handler files in `electron/handlers/`, all become API routes under `/api/`
- **Preload bridge**: `window.clawdbot.modules.invoke(channel, ...args)` — wrapped by `src/lib/api.ts` + `src/lib/bridge.ts` compatibility shim during migration
- **Agents defined**: 13 agents in `electron/agent-registry.json` (main, coder, researcher, writer, chief, hr, clara, social_media_manager, growth_director, lead_engineer, voice, designer, degen-frog)
- **DB**: `~/froggo/data/froggo.db` (better-sqlite3 WAL mode) — same path, schema extended not replaced
- **Migration plan**: `/Users/kevin.macarthur/Downloads/fork-merge.md` — primary spec, all phase details

## Constraints

- **No Electron**: Kandji MDM (installed Feb 2026) blocks unsigned Electron apps with SIGKILL — web-only
- **No OpenClaw**: Entire gateway replaced by Claude Code SDK + Next.js API routes
- **No --dangerously-skip-permissions**: Agent hooks must use proper approval flow
- **No third-party services**: All agent backends must be self-hosted or Claude Code
- **Tech stack**: Next.js App Router, TypeScript strict mode, better-sqlite3 (server-side only), Tailwind CSS
- **Target path**: `~/git/froggo-nextjs` (already cloned, branch: `migration/nextjs-claude-code`)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router (not Pages) | Modern, SSR + API routes in one, edge-ready | — Pending |
| `better-sqlite3` kept (not Postgres) | Same DB file, zero migration needed, simpler ops | — Pending |
| `window.clawdbot` compat shim | Migrate incrementally — shim routes IPC to fetch, refactor components as you go | — Pending |
| Claude Code SDK (not custom agent runner) | No OpenClaw dependency, uses existing Claude Code ecosystem | — Pending |
| SSE for streaming (not WebSocket) | Simpler, no extra server, works with Next.js API routes | — Pending |
| Phase 0 done in session | Repo cloned, branch created, full audit completed | ✓ Good |

---
*Last updated: 2026-03-04 after initialization*
