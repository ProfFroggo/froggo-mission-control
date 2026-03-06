# Roadmap: Mission Control — Froggo Platform

## Overview

Multi-agent AI orchestration platform. v1.0 migrated from Electron/OpenClaw to Next.js/Claude Code. v2.0 (Froggo Platform) adds operational infrastructure: tmux orchestration, enhanced memory, voice layer, per-agent capability configs, and git worktrees.

Spec sources:
- v1.0: `/Users/kevin.macarthur/Downloads/fork-merge.md`
- v2.0: `FROGGO-MIGRATION-ADDENDUM.pdf`, `FROGGO-AGENT-CAPABILITY-MATRIX.pdf`, `FROGGO-VOICE-INTEGRATION.pdf`, `FROGGO-MIGRATION-EXECUTION-PLAN.pdf`

## Milestones

- ✅ [v1.0 Migration](v1.0-migration-ARCHIVE.md) — Phases 0–14 — SHIPPED 2026-03-04
- ✅ **v2.0 Froggo Platform** — Phases 15–22 — SHIPPED 2026-03-05
- 🚧 **v3.0 Autonomous Core** — Phases 23–30 (in progress)

---

## Completed

<details>
<summary>✅ v1.0 Migration (Phases 0–14) — SHIPPED 2026-03-04</summary>

- [x] Phase 0: Setup & Audit — 2026-03-04
- [x] Phase 1: Electron Strip + Next.js Scaffold (3/3 plans) — 2026-03-04
- [x] Phase 2: Database Layer (2/2 plans) — 2026-03-04
- [x] Phase 3: API Routes (4/4 plans) — 2026-03-04
- [x] Phase 4: Frontend Wiring (2/2 plans) — 2026-03-04
- [x] Phase 5: MCP Servers (2/2 plans) — 2026-03-04
- [x] Phase 6: Agent Definitions (2/2 plans) — 2026-03-04
- [x] Phase 7: Permission & Hook System (2/2 plans) — 2026-03-04
- [x] Phase 8: Memory System (2/2 plans) — 2026-03-04
- [x] Phase 9: Chat Rooms (2/2 plans) — 2026-03-04
- [x] Phase 10: Session Management (2/2 plans) — 2026-03-04
- [x] Phase 11: Cron & Automation (2/2 plans) — 2026-03-04
- [x] Phase 12: SSE Streaming (2/2 plans) — 2026-03-04
- [x] Phase 13: Skills (1/1 plan) — 2026-03-04
- [x] Phase 14: Final Integration & Testing (2/2 plans) — 2026-03-04

See full details: [v1.0-migration-ARCHIVE.md](v1.0-migration-ARCHIVE.md)

</details>

<details>
<summary>✅ v2.0 Froggo Platform (Phases 15–22) — SHIPPED 2026-03-05</summary>

- [x] Phase 15: Environment & Configuration (1/1 plan) — 2026-03-05
- [x] Phase 16: Tmux Orchestration (2/2 plans) — 2026-03-05
- [x] Phase 17: Enhanced Memory MCP (2/2 plans) — 2026-03-05
- [x] Phase 18: Approval Rules + Worktrees (1/1 plan) — 2026-03-05
- [x] Phase 19: Per-Agent Capabilities (2/2 plans) — 2026-03-05
- [x] Phase 20: Skill Enrichment (1/1 plan) — 2026-03-05
- [x] Phase 21: Voice Bridge (2/2 plans) — 2026-03-05
- [x] Phase 22: E2E Verification v2.0 (1/1 plan) — 2026-03-05

</details>

---

## 🚧 v3.0 Autonomous Core (In Progress)

**Milestone Goal:** Close the gaps between configured agents and what actually runs in production — dispatched agents execute with their full soul files, sessions persist across tasks, context survives compaction, costs are tracked, and the platform alerts on stuck/failed work.

### Phase 23: Task Dispatcher Overhaul
**Goal**: Dispatched agents run with `--agents {id}` so their soul file, model, permissionMode, mcpServers, and memory config are all loaded; session continuity via `--resume`; per-agent model used (not hardcoded)
**Depends on**: Phase 22
**Research**: Unlikely (patterns established in stream route and spawn route)
**Plans**: 1 plan

Plans:
- [x] 23-01: Fix `src/lib/taskDispatcher.ts` — soul file as --system-prompt, per-agent model from DB, cwd=process.cwd(), --output-format stream-json, session persist with :task suffix, exit logging — DONE 2026-03-06

---

### Phase 23.1: Agent Identity Foundation
**Goal**: Every agent workspace has correct MCP-based CLAUDE.md (no derek-db), collaborator awareness in SOUL.md, and GSD protocol link; writer and voice get SOUL.md files
**Depends on**: Phase 23
**Research**: None
**Plans**: 1 plan

Plans:
- [x] 23.1-01: Fix all 15 workspace CLAUDE.md files (replace derek-db with MCP tools) — DONE 2026-03-06

---

### Phase 24: PreCompact Context Resilience
**Goal**: When Claude auto-compacts a long session, a PreCompact hook re-injects the agent's current task, last 5 activity entries, and key decisions so context is never lost mid-task
**Depends on**: Phase 23
**Research**: Unlikely (PreCompact hook is documented; hook reads from existing DB)
**Plans**: 1 plan

Plans:
- [ ] 24-01: Create `tools/hooks/precompact-hook.js` — reads `CLAUDE_AGENT_ID` env, queries in-progress tasks + last 5 activities from DB, writes re-injection prompt to stdout; add PreCompact hook to `.claude/settings.json`

---

### Phase 25: Agent Teams Quality Gates
**Goal**: `TeammateIdle` and `TaskCompleted` hooks configured so Agent Teams automatically log completions to the task board and optionally trigger Clara review on P0/P1 tasks
**Depends on**: Phase 23
**Research**: Unlikely (hooks are documented; patterns match existing review-gate.js)
**Plans**: 1 plan

Plans:
- [ ] 25-01: Create `tools/hooks/teammate-idle.js` + `tools/hooks/task-completed.js`; add `TeammateIdle` and `TaskCompleted` hook entries to `.claude/settings.json`; teammate-idle checks if task in DB is actually complete and logs; task-completed fires `triggerClaraReview` for P0/P1

---

### Phase 26: Token & Cost Tracking
**Goal**: Every agent invocation logs input/output tokens + cost to a `token_usage` table; dashboard shows per-agent and per-task spend; model pricing defined in `env.ts`
**Depends on**: Phase 23
**Research**: Unlikely (token counts already in stream "result" events; DB schema extension is straightforward)
**Plans**: 2 plans

Plans:
- [ ] 26-01: DB migration — add `token_usage` table (agentId, taskId, sessionId, model, inputTokens, outputTokens, costUsd, timestamp); update `tools/mission-control-db-mcp/src/index.ts` to expose `log_token_usage` tool; add model pricing constants to `src/lib/env.ts`
- [ ] 26-02: Log from stream route (parse "result" event for token counts), log from task dispatcher (parse stdout close); add `GET /api/analytics/tokens` endpoint; add usage widget to the analytics/dashboard panel

---

### Phase 27: Skills Auto-Loading
**Goal**: Agents dispatched via task board check and load their relevant skill before working; task dispatch message includes a skills-check instruction; `.claude/CLAUDE.md` protocol updated
**Depends on**: Phase 23
**Research**: Unlikely (skills already exist in .claude/skills/; dispatch message template is one change)
**Plans**: 1 plan

Plans:
- [ ] 27-01: Update `src/lib/taskDispatcher.ts` dispatch message template to include skills-check instruction (reference `.claude/CLAUDE.md` skills routing table); update `.claude/CLAUDE.md` pre-task protocol section to make skills-check explicit; validate with a test dispatch

---

### Phase 28: Monitoring & Alerting
**Goal**: Stuck tasks (in-progress > 4 hours) are detected and alert posted to #general; per-agent health panel shows active/idle/error status and last activity; cron daemon sweeps every 30 min
**Depends on**: Phase 26
**Research**: Unlikely (cron daemon + DB queries + chat_post MCP already exist)
**Plans**: 2 plans

Plans:
- [ ] 28-01: Add stuck-task detection to `tools/cron-daemon.js` — every 30 min query tasks in-progress > 4 hours, post alert to #general via `chat_post` MCP; add `tools/hooks/agent-error.js` that fires on agent process non-zero exit to log error and update task status
- [ ] 28-02: Add agent health panel component to dashboard — per-agent row showing status (active/idle/error), last activity timestamp, session age, and error count from `token_usage` + `task_activity` tables; wire to new `GET /api/agents/health` endpoint

---

### Phase 29: Rate Limiting & Resilience
**Goal**: Max 1 concurrent stream per agent (prevent duplicate spawns); task dispatcher queues rapid-fire dispatches for same agent; Claude API errors handled gracefully with task status update
**Depends on**: Phase 23
**Research**: Unlikely (in-memory lock map pattern; error handling follows existing patterns)
**Plans**: 1 plan

Plans:
- [ ] 29-01: Add per-agent spawn lock to stream route (reject 2nd spawn if already active for same agent); add dispatch debounce/queue to task dispatcher (100ms window); handle Claude process non-zero exit → update task to `blocked` with error message; handle ENOENT (claude binary not found) with clear error

---

### Phase 30: E2E Verification v3.0
**Goal**: All v3.0 systems verified end-to-end — soul file dispatch, session continuity, PreCompact hook, token logging, Agent Teams hooks, monitoring alert, rate limiting
**Depends on**: All v3.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 30-01: E2E smoke test — assign task → verify dispatch uses `--agents` flag → verify soul file loaded (check system prompt in output) → verify session saved to DB → verify token logged → assign P0 task and move to review → verify Clara auto-triggered → verify stuck-task alert fires for synthetic > 4hr task → verify duplicate spawn rejected

---

### Phase 15: Environment & Configuration
**Goal**: Single `.env` file as source of truth for all paths + model strategy; typed `src/lib/env.ts` wrapper; `COST_STRATEGY.md` documented
**Depends on**: Phase 14
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 15-01: Create `.env` (FROGGO_DB_PATH, VAULT_PATH, PROJECT_DIR, QMD_BIN, LOG_DIR, model tiers), `src/lib/env.ts` typed wrapper, `COST_STRATEGY.md`

---

### Phase 16: Tmux Orchestration
**Goal**: `tools/tmux-setup.sh` creates named `froggo-agents` session with per-agent panes; `tools/agent-start.sh` resumes existing sessions by ID or starts new; dashboard spawn API wired to tmux panes
**Depends on**: Phase 15
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 16-01: `tools/tmux-setup.sh` — session `froggo-agents`, window 0 (panes: froggo/coder/clara/on-demand), window 1 (log monitoring), window 2 (Next.js dev server)
- [ ] 16-02: `tools/agent-start.sh` (check DB for session ID → `claude --resume` or new); update `/api/agents/[id]/spawn` to call agent-start.sh via tmux pane mapping

---

### Phase 17: Enhanced Memory MCP
**Goal**: Upgrade memory MCP from 3 tools to 4 tools with QMD BM25/vector/hybrid search; session sync hook exports to Obsidian + updates QMD index
**Depends on**: Phase 15
**Research**: Unlikely (memory MCP already exists at tools/memory-mcp/)
**Plans**: 2 plans

Plans:
- [ ] 17-01: Upgrade `tools/memory-mcp/src/index.ts` — add `memory_recall` (temporal/topic/graph), upgrade `memory_search` to QMD BM25/vector/hybrid, upgrade `memory_write` to category routing (decision/gotcha/pattern/daily/review)
- [ ] 17-02: Upgrade `tools/hooks/session-sync.js` — POST to `/api/sync-claude-sessions`, update QMD indexes, log analytics event

---

### Phase 18: APPROVAL_RULES + Git Worktrees
**Goal**: `APPROVAL_RULES.md` documents Tier 0–3 with explicit examples per agent action; git worktrees created for coder/designer/chief agents
**Depends on**: Phase 15
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 18-01: Create `APPROVAL_RULES.md` (Tier 0: auto-approve, Tier 1: soft/logged, Tier 2: review required, Tier 3: explicit human); `tools/worktree-setup.sh` creates `~/mission-control-worktrees/{coder,designer,chief}` on branches `agent/{name}`

---

### Phase 19: Per-Agent Capability Configs
**Goal**: All 13 agent SOUL.md files upgraded with full frontmatter (model tier, mode, maxTurns, allowed tools, worktree path) and real personality content
**Depends on**: Phases 15, 18
**Research**: Unlikely (full spec in FROGGO-AGENT-CAPABILITY-MATRIX.pdf)
**Plans**: 2 plans

Plans:
- [ ] 19-01: Update `.claude/settings.json` — per-agent model config, maxTurns, tool allowlists; update `CLAUDE.md` shared context with library routing table
- [ ] 19-02: Enrich all 13 SOUL.md files — real personality, role context, constraints, output routing; add `froggo-db-mcp` + `memory` MCP to all agent configs

---

### Phase 20: Agent Skill Enrichment
**Goal**: Existing 6 skills enriched with Froggo-specific context; new skills added per capability matrix
**Depends on**: Phase 19
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 20-01: Update existing 6 skills with Froggo paths/conventions; add: `x-twitter-strategy`, `nextjs-patterns`, `git-workflow`; register all in `settings.json`

---

### Phase 21: Voice Bridge
**Goal**: Gemini Live API voice bridge running — voice input → Gemini → Claude Code → response streamed back; per-agent voice personalities; `switch_agent` function call
**Depends on**: Phase 19
**Research**: Likely (Gemini Live API `gemini-2.5-flash-native-audio-preview` current SDK patterns)
**Plans**: 2 plans

Plans:
- [ ] 21-01: Create `tools/voice-bridge/` — `src/index.ts` (Gemini Live session + function call handler), `src/personality.ts` (loads agent SOUL.md → Gemini system_instruction, VOICE_MAP per agent)
- [ ] 21-02: `src/tools.ts` (Gemini FunctionDeclarations mirroring all MCP tools + `delegate_to_claude` + `switch_agent`); `/api/voice/status` endpoint; voice bridge start/stop from dashboard

---

### Phase 22: E2E Verification v2.0
**Goal**: All v2.0 components verified end-to-end — tmux sessions start, agents resume, memory search works, approval tiers fire correctly, voice bridge connects
**Depends on**: All v2.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 22-01: E2E smoke test — tmux session start, agent spawn/resume, memory write/search, Tier 1 approval auto-approve, Tier 3 approval queues for human, voice bridge handshake

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Setup & Audit | v1.0 | — | Complete | 2026-03-04 |
| 1. Electron Strip | v1.0 | 3/3 | Complete | 2026-03-04 |
| 2. Database Layer | v1.0 | 2/2 | Complete | 2026-03-04 |
| 3. API Routes | v1.0 | 4/4 | Complete | 2026-03-04 |
| 4. Frontend Wiring | v1.0 | 2/2 | Complete | 2026-03-04 |
| 5. MCP Servers | v1.0 | 2/2 | Complete | 2026-03-04 |
| 6. Agent Definitions | v1.0 | 2/2 | Complete | 2026-03-04 |
| 7. Permission & Hooks | v1.0 | 2/2 | Complete | 2026-03-04 |
| 8. Memory System | v1.0 | 2/2 | Complete | 2026-03-04 |
| 9. Chat Rooms | v1.0 | 2/2 | Complete | 2026-03-04 |
| 10. Session Management | v1.0 | 2/2 | Complete | 2026-03-04 |
| 11. Cron & Automation | v1.0 | 2/2 | Complete | 2026-03-04 |
| 12. SSE Streaming | v1.0 | 2/2 | Complete | 2026-03-04 |
| 13. Skills | v1.0 | 1/1 | Complete | 2026-03-04 |
| 14. Final Integration | v1.0 | 2/2 | Complete | 2026-03-04 |
| 15. Env & Config | v2.0 | 1/1 | Complete | 2026-03-05 |
| 16. Tmux Orchestration | v2.0 | 2/2 | Complete | 2026-03-05 |
| 17. Enhanced Memory MCP | v2.0 | 2/2 | Complete | 2026-03-05 |
| 18. Approval Rules + Worktrees | v2.0 | 1/1 | Complete | 2026-03-05 |
| 19. Per-Agent Capabilities | v2.0 | 2/2 | Complete | 2026-03-05 |
| 20. Skill Enrichment | v2.0 | 1/1 | Complete | 2026-03-05 |
| 21. Voice Bridge | v2.0 | 2/2 | Complete | 2026-03-05 |
| 22. E2E Verification v2.0 | v2.0 | 1/1 | Complete | 2026-03-05 |
| 23. Task Dispatcher Overhaul | v3.0 | 0/1 | Not started | - |
| 24. PreCompact Context Resilience | v3.0 | 0/1 | Not started | - |
| 25. Agent Teams Quality Gates | v3.0 | 0/1 | Not started | - |
| 26. Token & Cost Tracking | v3.0 | 0/2 | Not started | - |
| 27. Skills Auto-Loading | v3.0 | 0/1 | Not started | - |
| 28. Monitoring & Alerting | v3.0 | 0/2 | Not started | - |
| 29. Rate Limiting & Resilience | v3.0 | 0/1 | Not started | - |
| 30. E2E Verification v3.0 | v3.0 | 0/1 | Not started | - |

**v1.0 COMPLETE (2026-03-04) — v2.0 COMPLETE (2026-03-05) — v3.0 IN PROGRESS**
