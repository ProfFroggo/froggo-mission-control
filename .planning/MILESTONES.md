# Project Milestones: Mission Control Next.js

## v6.0 Security Hardening (Shipped: 2026-03-07)

**Delivered:** Eliminated all critical/high security vulnerabilities — command injection via shell-interpolated agent IDs fixed, path traversal blocked in library/soul/files routes, Gemini API key moved server-side out of localStorage, 5 security headers added, input length limits enforced across all user-facing routes, and 20 security regression checks added to the E2E smoke test.

**Phases completed:** 50–57 (8 phases, 9 plans; phases 52+53 absorbed into Phase 50)

**Key accomplishments:**

- `validateAgentId()` shared utility (`src/lib/validateId.ts`): enforces `/^[a-z0-9][a-z0-9-_]*$/`, applied to 10+ routes — full defence-in-depth against path traversal and injection via agent ID
- Command injection fix: `spawn/route.ts` replaced `execSync(\`bash "${id}"\`)` with `spawnSync('bash', [script, id])` — id never interpolated into shell string
- Path traversal fix: `library/route.ts` `startsWith(LIBRARY_PATH)` boundary check + `files/read/route.ts` `ALLOWED_ROOTS` allowlist — returns 403 for `/etc/passwd`, private keys, env files
- Hardcoded absolute path removed from `soul/route.ts` — uses `process.cwd()` (works on any machine)
- Gemini API key server-side: 7 voice/meeting components converted from localStorage fallback to `settingsApi.get('gemini_api_key')` API-only — key never reaches browser storage
- CSP + 4 security headers in `next.config.js` — `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `X-XSS-Protection`, CSP with Gemini HTTPS/WSS origins
- Input length limits: task title ≤500, description ≤5000, agent name ≤100, library name ≤255, soul content ≤50KB (413 response); SQL injection confirmed safe (grep verification)
- 20 security regression checks in `tools/e2e-smoke-test.sh` (127/128 total passing)

**Stats:**

- 8 phases (50–57), 9 plans, ~26 task commits
- 127/128 E2E smoke checks pass (pre-existing TS error unrelated to security)
- Timeline: 2026-03-07 (1 intensive session)
- Git range: `e75dd81` (Phase 50 plan) → `42ccc8a` (Phase 57 complete)

**Archive:** `.planning/milestones/v6.0-security-hardening.md`

---

## v4.0 Agent & Module Library (Shipped: 2026-03-06)

**Delivered:** Full self-service catalog — browse, hire, install, and manage agents and modules without touching a CLI. Hire wizard creates agent workspaces, module install wizard wires module_state, lifecycle management handles fire/uninstall non-destructively, and onboarding role presets auto-configure a fresh instance.

**Phases completed:** 31–39 (12 plans total, including 33.1 inserted)

**Key accomplishments:**

- Catalog data model: `catalog_agents` + `catalog_modules` DB tables, 15 agent + 19 module JSON manifests, `catalogSync.ts` with atomic startup upsert that preserves hire state
- Catalog REST API: 4 routes (GET/PATCH/DELETE) with core module uninstall protection at API layer
- Agent Library UI: `AgentLibraryPanel` card grid with search/filter/model badges; Active/Library tab switcher in AgentPanel
- Agent creation wizard overhauled: `/api/agents/hr/stream` endpoint fixed, v3.0 YAML soul template, custom agents register in catalog
- Agent hire wizard: `POST /api/agents/hire` creates workspace with CLAUDE.md + SOUL.md + MEMORY.md (idempotent)
- Module Library UI: `ModuleLibraryPanel` with category colors, dependency warnings, Installed/Library tabs
- Module install wizard: 3-step modal (check → catalog → module_state), `POST /api/modules/install`
- Lifecycle management: non-destructive fire (workspace rename), non-destructive uninstall, core module guard
- Onboarding role presets: Developer/Designer/Marketing/Executive — parallel agent+module install via `Promise.allSettled`
- E2E: 107/107 smoke checks pass (was 85 before v4.0)

**Stats:**

- 10 phases (31–39 + 33.1), 12 plans
- 64 files changed, +3,601 / -275 lines
- ~119,510 lines TypeScript/TSX total
- 1 day (2026-03-06)
- Git range: `3f820be` → `612765d`

**Archive:** `.planning/milestones/v4.0-agent-module-library.md`

---

## v3.0 Autonomous Core (Shipped: 2026-03-06)

**Delivered:** Dispatched agents run with their full soul files, sessions persist across tasks, context survives compaction, costs are tracked, and the platform alerts on stuck/failed work.

**Phases completed:** 23–30 + 23.1 (9 phases, 10 plans)

**Key accomplishments:**

- Task dispatcher overhaul: `--system-prompt` with SOUL.md, per-agent model, session persistence via `--resume`
- All 15 workspace CLAUDE.md files fixed: replaced defunct derek-db with MCP tool calls
- PreCompact hook: re-injects current task + last 5 activities on context compaction
- Agent Teams hooks: `TeammateIdle` + `TaskCompleted` auto-log to task board
- Token & cost tracking: `token_usage` DB table, MODEL_PRICING, `calcCostUsd()`, analytics endpoint
- Skills auto-loading: dispatch message instructs agents to check/load relevant skill first
- Monitoring: `checkStuckTasks()` in cron daemon, `/api/agents/health` endpoint
- Rate limiting: per-agent spawn lock + dispatch debounce

**Git range:** `17b6869` → `99aea48`

---

## v2.0 Froggo Platform (Shipped: 2026-03-05)

**Delivered:** Full operational infrastructure layered on v1.0 — tmux orchestration, enhanced memory, voice bridge, per-agent capability configs, git worktrees, 9 skills.

**Phases completed:** 15–22 (8 phases, 12 plans)

**Key accomplishments:**

- ENV singleton (`src/lib/env.ts`): single source of truth for all paths/models/pricing
- Tmux orchestration: `mission-control` session, per-agent panes, start/resume scripts
- Memory MCP v3: 4 tools (search/recall/write/read) + QMD BM25/vector/hybrid search
- APPROVAL_RULES.md: Tier 0–3 with per-agent decision matrix; git worktrees for coder/designer/chief
- 15 agents enriched with real personality, maxTurns, worktreePath, model configs
- 9 skills in `.claude/skills/` including x-twitter-strategy, nextjs-patterns, git-workflow
- Voice bridge: Gemini Live WS server at `ws://localhost:8765`

---

## v1.0 Migration (Shipped: 2026-03-04)

**Delivered:** Complete Electron → Next.js migration — browser-based multi-agent AI orchestration dashboard with no Electron, no OpenClaw, fully operational Claude Code agents.

**Phases completed:** 0–14 (30 plans total)

**Key accomplishments:**

- Electron fully removed (73 files, 22,392 lines) — Next.js 15 App Router scaffolded with TypeScript strict config
- 18-table SQLite schema with `getDb()` singleton, WAL mode, 13 agents seeded at startup
- 36 API routes covering all IPC channels — tasks, agents, chat, approvals, inbox, sessions, analytics, cron
- All `window.clawdbot` IPC calls replaced with typed REST API clients via `src/lib/api.ts`
- `mission-control-db` MCP (11 tools) + memory MCP (3 tools) standalone via StdioServerTransport
- 13 SOUL.md agent configs + tiered approval hooks (Tier 0–3) + session sync to Obsidian vault
- Real SSE streaming — spawns `claude` CLI, pipes `stream-json` output token-by-token
- `npm run build` PASS — 19 pages, all API routes compiled, TypeScript clean

**Stats:**

- 14 phases + Phase 0, 30 plans
- ~117,000 lines TypeScript/TSX
- 37 days (2026-01-26 → 2026-03-04)

**Archive:** `.planning/v1.0-migration-ARCHIVE.md`

---
