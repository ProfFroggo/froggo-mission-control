# Roadmap: Froggo Next.js Migration

## Overview

Migrate the Froggo AI multi-agent dashboard from Electron + OpenClaw to Next.js + Claude Code SDK. Each phase strips one Electron concern and replaces it with a web-native equivalent, delivering a fully browser-based agent orchestration platform with no native dependencies.

Phase 0 (setup & audit) is complete. Phases 1–14 cover the full migration from scaffolding through final E2E verification. Spec source: `/Users/kevin.macarthur/Downloads/fork-merge.md`.

## Domain Expertise

None (no ~/.claude/skills/expertise/ available)

## Phases

- [x] **Phase 0: Setup & Audit** - Clone, branch, full IPC/gateway/preload audit ✓ COMPLETE
- [ ] **Phase 1: Electron Strip + Next.js Scaffold** - Remove Electron, install Next.js App Router, create compatibility bridge
- [ ] **Phase 2: Database Layer** - Shared better-sqlite3 module, full schema (tasks, agents, messages, approvals, inbox, chat rooms)
- [ ] **Phase 3: API Routes** - Convert all 20+ IPC handler files to Next.js `/api/*` REST routes
- [ ] **Phase 4: Frontend Wiring** - Replace `window.clawdbot` IPC calls with fetch, wire Zustand stores, SSE for chat
- [ ] **Phase 5: MCP Servers** - `froggo-db` MCP + memory MCP for agent tool access
- [ ] **Phase 6: Agent Definitions** - `.claude/` directory, `SOUL.md` per agent, `settings.json`, shared `CLAUDE.md`
- [ ] **Phase 7: Permission & Hook System** - Tiered approval hooks, Clara review gate, session sync hook
- [ ] **Phase 8: Memory System** - Obsidian vault structure, QMD indexing, architecture map seeded
- [ ] **Phase 9: Chat Rooms** - Inter-agent communication tables, API routes, dashboard UI, SSE
- [ ] **Phase 10: Session Management** - Persistent session table, session management API, spawn integration
- [ ] **Phase 11: Cron & Automation** - Cron entries, cron MCP tools, cron daemon
- [ ] **Phase 12: SSE Streaming** - `/api/agents/:id/stream` endpoint, dashboard real-time polling
- [ ] **Phase 13: Skills** - Project-specific Claude Code skills (froggo-db, coding standards)
- [ ] **Phase 14: Final Integration & Testing** - E2E smoke test, approval flow, inter-agent comms, memory recall, cleanup

## Phase Details

### Phase 0: Setup & Audit ✓ COMPLETE
**Goal**: Cloned repo to `~/git/froggo-nextjs`, created `migration/nextjs-claude-code` branch, audited all 20+ IPC handlers, `gateway.ts`, `preload.ts`, `agent-registry.json`, and database schema
**Depends on**: Nothing
**Research**: Unlikely (audit task)
**Plans**: Complete — 2026-03-04

---

### Phase 1: Electron Strip + Next.js Scaffold
**Goal**: Working Next.js app that renders the existing React UI in a browser — Electron and OpenClaw fully removed, compatibility bridge in place
**Depends on**: Phase 0
**Research**: Unlikely (migration steps fully specified in fork-merge.md §1.1–1.9)
**Plans**: 3 plans

Plans:
- [x] 01-01: Remove Electron deps (`npm uninstall electron electron-builder ...`), install Next.js, create `next.config.js`, update `tsconfig.json` and `package.json` scripts ✓ 2026-03-04
- [x] 01-02: Create App Router structure (`app/layout.tsx`, `app/page.tsx`), verify TypeScript compiles ✓ 2026-03-04
- [x] 01-03: Create `src/lib/api.ts` (typed API clients) + `src/lib/bridge.ts` (`window.clawdbot` polyfill), verify app loads at `localhost:3000` ✓ 2026-03-04

### Phase 2: Database Layer
**Goal**: Shared `getDb()` module with full schema — all tables created on first run, no migration needed from existing `froggo.db`
**Depends on**: Phase 1
**Research**: Unlikely (better-sqlite3 already in codebase, full schema in fork-merge.md §2.1)
**Plans**: 2 plans

Plans:
- [x] 02-01: Create `src/lib/database.ts` with `getDb()`, WAL mode, schema: tasks, subtasks, task_activity, task_labels, task_attachments, agents, sessions, messages, approvals, inbox ✓ 2026-03-04
- [x] 02-02: Extend schema: chat_rooms, chat_room_messages, analytics_events, cron_jobs, skills tables; verify DB creates at `~/froggo/data/froggo.db` ✓ 2026-03-04

### Phase 3: API Routes
**Goal**: All IPC handler files converted to Next.js API routes — every `window.clawdbot` channel has a `/api/*` equivalent
**Depends on**: Phase 2
**Research**: Unlikely (mechanical IPC→REST mapping, all patterns in fork-merge.md §3.1–3.3 and `src/lib/api.ts`)
**Plans**: 4 plans

Plans:
- [x] 03-01: Tasks API — `/api/tasks`, `/api/tasks/[id]`, subtasks, activity, attachments routes ✓ 2026-03-04
- [x] 03-02: Agents + chat sessions API — `/api/agents`, `/api/agents/[id]`, `/api/chat/sessions` ✓ 2026-03-04
- [x] 03-03: Approvals + inbox + settings + modules API — `/api/approvals`, `/api/inbox`, `/api/settings`, `/api/modules` ✓ 2026-03-04
- [x] 03-04: Analytics + marketplace + schedule API; verify all routes respond correctly ✓ 2026-03-04

### Phase 4: Frontend Wiring
**Goal**: Dashboard fully functional — no 404s, Zustand stores use typed API clients, chat uses SSE
**Depends on**: Phase 3
**Research**: Unlikely (following patterns established in Phases 1–3)
**Plans**: 2 plans

Plans:
- [x] 04-01: Update Zustand stores to call typed API methods (`taskApi.*`, `agentApi.*`, etc.), strip all IPC store calls ✓ 2026-03-04
- [x] 04-02: Wire `ChatPanel.tsx` to SSE stream endpoint, remove all `window.clawdbot.gateway.*` references, verify dashboard renders without errors ✓ 2026-03-04

### Phase 5: MCP Servers
**Goal**: `froggo-db` MCP and memory MCP running standalone — agents can query DB and read memory through tool calls
**Depends on**: Phase 2
**Research**: Likely (Claude Code MCP server API — current registration patterns needed)
**Research topics**: Claude Code MCP SDK current API, tool registration format, stdio transport setup, how agents discover/configure MCP servers in `settings.json`
**Plans**: 2 plans

Plans:
- [ ] 05-01: Create `froggo-db` MCP server — tools: `get_tasks`, `update_task`, `create_task`, `get_agent_info`, `log_activity`
- [ ] 05-02: Create memory MCP server — tools: `search_memory`, `add_memory`, `get_recent_context`; test both standalone with Claude Code

### Phase 6: Agent Definitions
**Goal**: `.claude/` directory fully configured — all 13 agents have `SOUL.md`, `settings.json` controls permissions, `CLAUDE.md` provides shared context
**Depends on**: Phase 5
**Research**: Unlikely (config file creation, patterns in fork-merge.md §6.1–6.4 and `agent-registry.json`)
**Plans**: 2 plans

Plans:
- [ ] 06-01: Create `.claude/` directory, `CLAUDE.md` shared context, `settings.json` with MCP server config and allowed tools per trust tier
- [ ] 06-02: Create `SOUL.md` for all 13 agents: main, coder, researcher, writer, chief, hr, clara, social_media_manager, growth_director, lead_engineer, voice, designer, degen-frog

### Phase 7: Permission & Hook System
**Goal**: Tiered approval hooks active — Tier 1/2 auto-approved, Tier 3+ routed to dashboard for human review; Clara gate and session sync working
**Depends on**: Phase 6
**Research**: Likely (Claude Code hooks system — current hook API and intercept patterns)
**Research topics**: Claude Code hooks API format, pre-tool-use hook structure, how hooks read/write approval state to DB, session sync hook patterns
**Plans**: 2 plans

Plans:
- [ ] 07-01: Create `hooks/` directory + tiered approval hook (`hooks/tier-approval.js`) — Tier 1 auto-approve, Tier 2 log, Tier 3 block + create approval record, Tier 4 reject
- [ ] 07-02: Create Clara review gate hook (`hooks/clara-review.js`) + session sync hook (`hooks/session-sync.js`), register all hooks in `settings.json`

### Phase 8: Memory System
**Goal**: Obsidian vault structure created, QMD indexed, architecture map seeded — agents can recall project context via memory MCP
**Depends on**: Phase 6
**Research**: Likely (QMD CLI tool — install and index patterns)
**Research topics**: QMD install and CLI usage, `qmd index` command format, Obsidian vault structure for agent memory, directory conventions
**Plans**: 2 plans

Plans:
- [ ] 08-01: Install QMD, create Obsidian vault at `~/froggo/memory/`, seed architecture map from `fork-merge.md` and codebase docs
- [ ] 08-02: Index vault with `qmd index`, add cron entry for QMD freshness (`qmd index --watch` or scheduled), verify memory MCP can retrieve context

### Phase 9: Chat Rooms
**Goal**: Inter-agent chat rooms working — agents post messages to rooms, humans read/post, SSE delivers real-time updates to dashboard
**Depends on**: Phases 4, 8
**Research**: Unlikely (SQL + REST API + SSE — all patterns from prior phases)
**Plans**: 2 plans

Plans:
- [ ] 09-01: Chat rooms DB tables + API routes — `/api/chat-rooms`, `/api/chat-rooms/[id]/messages` + SSE stream endpoint
- [ ] 09-02: Dashboard chat room UI component — room list sidebar, message thread, post input; wire to API

### Phase 10: Session Management
**Goal**: Persistent session tracking — spawn API creates sessions, sessions survive restart, session list visible in dashboard
**Depends on**: Phase 4
**Research**: Unlikely (SQL + REST, same patterns as Phase 3)
**Plans**: 2 plans

Plans:
- [ ] 10-01: Session management table + API — `/api/sessions`, `/api/sessions/[key]`, session CRUD operations
- [ ] 10-02: Wire spawn API (`/api/agents/[id]/spawn`) to create session records; add session list to dashboard; test persistence across restart

### Phase 11: Cron & Automation
**Goal**: Scheduled tasks running — cron daemon active, agents schedule work via MCP tools, dashboard shows cron status
**Depends on**: Phase 5
**Research**: Unlikely (node-cron or similar, patterns clear from fork-merge.md §11.1–11.3)
**Plans**: 2 plans

Plans:
- [ ] 11-01: Cron entries for recurring work: email check interval, QMD freshness, task notifications watcher
- [ ] 11-02: Cron MCP server — tools: `schedule_task`, `list_jobs`, `cancel_job`; cron daemon process (`src/server/cron-daemon.ts`)

### Phase 12: SSE Streaming
**Goal**: Full streaming pipeline — chat messages stream token-by-token via SSE, dashboard shows live typing indicator
**Depends on**: Phase 4
**Research**: Unlikely (Next.js streaming response + Claude Code SDK streaming — patterns in fork-merge.md §12.1–12.2)
**Plans**: 2 plans

Plans:
- [ ] 12-01: Create `/api/agents/[id]/stream` SSE endpoint — calls Claude Code SDK `query()` with streaming, pipes deltas as `data:` events
- [ ] 12-02: Dashboard real-time polling for non-SSE events (task updates, agent status changes); verify full streaming E2E

### Phase 13: Skills
**Goal**: Project-specific Claude Code skills installed — agents invoke `froggo-db` skill and coding standards skill without manual setup
**Depends on**: Phase 6
**Research**: Likely (Claude Code skills API — registration and invocation format)
**Research topics**: Claude Code skills format (YAML/JSON), how skills registered in `settings.json`, skill invocation from agent SOUL.md or tools
**Plans**: 1 plan

Plans:
- [ ] 13-01: Create `froggo-db` skill + coding standards skill; register both in `.claude/settings.json`; verify invocation from agent session

### Phase 14: Final Integration & Testing
**Goal**: Full E2E verification — all 6 test scenarios pass, zero Electron remnants, production `npm run build` succeeds
**Depends on**: All prior phases
**Research**: Unlikely (verification and cleanup)
**Plans**: 2 plans

Plans:
- [ ] 14-01: E2E smoke tests — task CRUD, agent spawn, chat message E2E, approval flow, inter-agent chat room message
- [ ] 14-02: Memory recall test; no-Electron audit (`grep -r electron src/`); production build (`npm run build`); cleanup dead files

---

## Progress

**Execution Order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Setup & Audit | — | Complete | 2026-03-04 |
| 1. Electron Strip + Next.js Scaffold | 3/3 | Complete | 2026-03-04 |
| 2. Database Layer | 2/2 | Complete | 2026-03-04 |
| 3. API Routes | 4/4 | Complete | 2026-03-04 |
| 4. Frontend Wiring | 2/2 | Complete | 2026-03-04 |
| 5. MCP Servers | 0/2 | Not started | - |
| 6. Agent Definitions | 0/2 | Not started | - |
| 7. Permission & Hook System | 0/2 | Not started | - |
| 8. Memory System | 0/2 | Not started | - |
| 9. Chat Rooms | 0/2 | Not started | - |
| 10. Session Management | 0/2 | Not started | - |
| 11. Cron & Automation | 0/2 | Not started | - |
| 12. SSE Streaming | 0/2 | Not started | - |
| 13. Skills | 0/1 | Not started | - |
| 14. Final Integration & Testing | 0/2 | Not started | - |
