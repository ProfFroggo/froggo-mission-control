# Roadmap: Mission Control — Froggo Platform

## Overview

Multi-agent AI orchestration platform. v1.0 migrated from Electron/OpenClaw to Next.js/Claude Code. v2.0 (Froggo Platform) adds operational infrastructure: tmux orchestration, enhanced memory, voice layer, per-agent capability configs, and git worktrees.

Spec sources:
- v1.0: `/Users/kevin.macarthur/Downloads/fork-merge.md`
- v2.0: `FROGGO-MIGRATION-ADDENDUM.pdf`, `FROGGO-AGENT-CAPABILITY-MATRIX.pdf`, `FROGGO-VOICE-INTEGRATION.pdf`, `FROGGO-MIGRATION-EXECUTION-PLAN.pdf`

## Milestones

- ✅ [v1.0 Migration](v1.0-migration-ARCHIVE.md) — Phases 0–14 — SHIPPED 2026-03-04
- ✅ **v2.0 Froggo Platform** — Phases 15–22 — SHIPPED 2026-03-05
- ✅ **v3.0 Autonomous Core** — Phases 23–30 — SHIPPED 2026-03-06
- 🚧 **v4.0 Agent & Module Library** — Phases 31–39 (in progress)

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

## ✅ v3.0 Autonomous Core — SHIPPED 2026-03-06

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
- [x] 24-01: Create `tools/hooks/precompact-hook.js` — reads `CLAUDE_AGENT_ID` env, queries in-progress tasks + last 5 activities from DB, writes re-injection prompt to stdout; add PreCompact hook to `.claude/settings.json` — DONE 2026-03-06

---

### Phase 25: Agent Teams Quality Gates
**Goal**: `TeammateIdle` and `TaskCompleted` hooks configured so Agent Teams automatically log completions to the task board and optionally trigger Clara review on P0/P1 tasks
**Depends on**: Phase 23
**Research**: Unlikely (hooks are documented; patterns match existing review-gate.js)
**Plans**: 1 plan

Plans:
- [x] 25-01: Create `tools/hooks/teammate-idle.js` + `tools/hooks/task-completed.js`; add `TeammateIdle` and `TaskCompleted` hook entries to `.claude/settings.json` — DONE 2026-03-06

---

### Phase 26: Token & Cost Tracking
**Goal**: Every agent invocation logs input/output tokens + cost to a `token_usage` table; dashboard shows per-agent and per-task spend; model pricing defined in `env.ts`
**Depends on**: Phase 23
**Research**: Unlikely (token counts already in stream "result" events; DB schema extension is straightforward)
**Plans**: 2 plans

Plans:
- [x] 26-01: DB migration — add `token_usage` table; add MODEL_PRICING + calcCostUsd() to `src/lib/env.ts` — DONE 2026-03-06
- [x] 26-02: Log tokens from stream route + task dispatcher; `GET /api/analytics/tokens` endpoint — DONE 2026-03-06

---

### Phase 27: Skills Auto-Loading
**Goal**: Agents dispatched via task board check and load their relevant skill before working; task dispatch message includes a skills-check instruction; `.claude/CLAUDE.md` protocol updated
**Depends on**: Phase 23
**Research**: Unlikely (skills already exist in .claude/skills/; dispatch message template is one change)
**Plans**: 1 plan

Plans:
- [x] 27-01: Skills-check step added to dispatch message; CLAUDE.md skills protocol updated with absolute path — DONE 2026-03-06

---

### Phase 28: Monitoring & Alerting
**Goal**: Stuck tasks (in-progress > 4 hours) are detected and alert posted to #general; per-agent health panel shows active/idle/error status and last activity; cron daemon sweeps every 30 min
**Depends on**: Phase 26
**Research**: Unlikely (cron daemon + DB queries + chat_post MCP already exist)
**Plans**: 2 plans

Plans:
- [x] 28-01: `checkStuckTasks()` in cron-daemon.js (30-min sweep, 4-hr threshold); `tools/hooks/agent-error.js` — DONE 2026-03-06
- [x] 28-02: `GET /api/agents/health` endpoint with per-agent status, last activity, error count, tokens — DONE 2026-03-06

---

### Phase 29: Rate Limiting & Resilience
**Goal**: Max 1 concurrent stream per agent (prevent duplicate spawns); task dispatcher queues rapid-fire dispatches for same agent; Claude API errors handled gracefully with task status update
**Depends on**: Phase 23
**Research**: Unlikely (in-memory lock map pattern; error handling follows existing patterns)
**Plans**: 1 plan

Plans:
- [x] 29-01: `agentLocks` spawn lock in stream route; DEBOUNCE_MS dispatch debounce in taskDispatcher — DONE 2026-03-06

---

### Phase 30: E2E Verification v3.0
**Goal**: All v3.0 systems verified end-to-end — soul file dispatch, session continuity, PreCompact hook, token logging, Agent Teams hooks, monitoring alert, rate limiting
**Depends on**: All v3.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [x] 30-01: E2E smoke test extended to 84 checks — all v3.0 phases verified (Phases 23–29) — 84/84 pass — DONE 2026-03-06

---

---

## 🚧 v4.0 Agent & Module Library (In Progress)

**Milestone Goal:** Any team member can browse a catalog of agents and modules, hire/install with a wizard-guided flow backed by HR and Coder agents, and have their Mission Control instance automatically configured — without touching a CLI.

### Phase 31: Catalog Schema & Data Model ✅ DONE 2026-03-06
**Goal**: Define JSON manifest format for agents and modules; add `catalog_agents` and `catalog_modules` DB tables; seed catalog with all 15 existing agents and current module set; establish `.catalog/` directory structure in repo
**Depends on**: Phase 30
**Plans**: 3 plans — COMPLETE

Plans:
- [x] 31-01: catalog_agents + catalog_modules DB tables + TypeScript interfaces (DONE 2026-03-06)
- [x] 31-02: .catalog/agents/ 15 JSON manifests + catalogSync.ts syncCatalogAgents() (DONE 2026-03-06)
- [x] 31-03: .catalog/modules/ 19 JSON manifests + syncCatalogModules() wired (DONE 2026-03-06)

---

### Phase 32: Catalog REST API
**Goal**: `GET /api/catalog/agents` and `GET /api/catalog/modules` return catalog items with install status; `POST /api/catalog/agents/:id/install` and `POST /api/catalog/modules/:id/install` trigger wizard; install status derived from DB
**Depends on**: Phase 31
**Research**: Unlikely (standard API routes; follows existing /api/agents patterns)
**Plans**: 1 plan

Plans:
- [x] 32-01: 4 catalog routes (GET/PATCH agents+modules) + catalogApi in api.ts — DONE 2026-03-06

---

### Phase 33: Agent Library UI
**Goal**: New "Agents Library" sub-page under `/agents` showing catalog cards for all available agents — hired (green), available (grey), with role tags, capability badges, and a "Hire" button that launches the wizard
**Depends on**: Phase 32
**Research**: Unlikely (follows existing agent panel UI patterns)
**Plans**: 2 plans

Plans:
- [ ] 33-01: TBD
- [ ] 33-02: TBD

---

### Phase 33.1: Create Agent Wizard Overhaul (INSERTED)
**Goal**: Fix the broken `HRAgentCreationModal` (`/api/agents/hr/stream` endpoint missing); update soul file template to v3.0 format (MCP tools, workspace paths, GSD protocol); wire custom-created agents to also produce a `.catalog/agents/{id}.json` manifest so they appear in the library; unify "create custom" and "hire from catalog" flows in the UI
**Depends on**: Phase 33
**Research**: Unlikely (root cause known; patterns established in v3.0 agent files)
**Plans**: 1 plan

Plans:
- [ ] 33.1-01: TBD (run /gsd:plan-phase 33.1 to break down)

---

### Phase 34: Agent Hire Wizard (HR Agent-Backed)
**Goal**: Multi-step hire wizard: HR agent reads manifest, creates `~/mission-control/agents/{id}/` workspace (SOUL.md, CLAUDE.md, MEMORY.md), registers agent in DB, wires into MCP config, writes intro memory — all with a live activity stream in the UI
**Depends on**: Phase 33
**Research**: Unlikely (HR agent exists; workspace pattern established in Phase 23.1)
**Plans**: 2 plans

Plans:
- [ ] 34-01: TBD
- [ ] 34-02: TBD

---

### Phase 35: Module Library UI
**Goal**: "Modules Library" page showing all available modules from catalog — installed (active/inactive toggle), available (Install button), with responsible agent badge, dependency indicators, and API key requirements shown before install
**Depends on**: Phase 32
**Research**: Unlikely (follows existing ModuleLoader + ViewRegistry patterns)
**Plans**: 2 plans

Plans:
- [ ] 35-01: TBD
- [ ] 35-02: TBD

---

### Phase 36: Module Install Wizard (Coder Agent-Backed)
**Goal**: Step-through install wizard: Coder agent reads module manifest, checks npm deps, prompts for API keys, registers in `module_state` DB table, adds to ViewRegistry, assigns responsible agent — with live progress stream in UI
**Depends on**: Phase 35
**Research**: Unlikely (Coder agent exists; module system patterns established in v1.0)
**Plans**: 2 plans

Plans:
- [ ] 36-01: TBD
- [ ] 36-02: TBD

---

### Phase 37: Agent & Module Lifecycle Management
**Goal**: Fire/uninstall agents (workspace archival, DB removal, MCP unwiring); disable/enable modules without full uninstall; version tracking for catalog items; re-hire with config preserved
**Depends on**: Phases 34, 36
**Research**: Unlikely (inverse of hire/install flows)
**Plans**: 1 plan

Plans:
- [ ] 37-01: TBD

---

### Phase 38: Onboarding Role Presets
**Goal**: Enhanced onboarding wizard with role selection step (Developer, Designer, Marketing, Executive); each role maps to a preset of starter agents + modules that get auto-hired/installed; role saved to DB for future catalog recommendations
**Depends on**: Phases 34, 36
**Research**: Unlikely (extends existing OnboardingWizard component)
**Plans**: 1 plan

Plans:
- [ ] 38-01: TBD

---

### Phase 39: E2E Verification v4.0
**Goal**: All v4.0 catalog/library/wizard flows verified — catalog seeds correctly, hire wizard creates workspace and DB record, module install wires into ViewRegistry, uninstall cleans up, role preset fires correct installs
**Depends on**: All v4.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 39-01: TBD

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
| 23. Task Dispatcher Overhaul | v3.0 | 1/1 | Complete | 2026-03-06 |
| 23.1. Agent Identity Foundation | v3.0 | 1/1 | Complete | 2026-03-06 |
| 24. PreCompact Context Resilience | v3.0 | 1/1 | Complete | 2026-03-06 |
| 25. Agent Teams Quality Gates | v3.0 | 1/1 | Complete | 2026-03-06 |
| 26. Token & Cost Tracking | v3.0 | 2/2 | Complete | 2026-03-06 |
| 27. Skills Auto-Loading | v3.0 | 1/1 | Complete | 2026-03-06 |
| 28. Monitoring & Alerting | v3.0 | 2/2 | Complete | 2026-03-06 |
| 29. Rate Limiting & Resilience | v3.0 | 1/1 | Complete | 2026-03-06 |
| 30. E2E Verification v3.0 | v3.0 | 1/1 | Complete | 2026-03-06 |
| 31. Catalog Schema & Data Model | v4.0 | 0/1 | Not started | - |
| 32. Catalog REST API | v4.0 | 0/1 | Not started | - |
| 33. Agent Library UI | v4.0 | 0/2 | Not started | - |
| 33.1. Create Agent Wizard Overhaul | v4.0 | 0/1 | Not started | - |
| 34. Agent Hire Wizard | v4.0 | 0/2 | Not started | - |
| 35. Module Library UI | v4.0 | 0/2 | Not started | - |
| 36. Module Install Wizard | v4.0 | 0/2 | Not started | - |
| 37. Agent & Module Lifecycle | v4.0 | 0/1 | Not started | - |
| 38. Onboarding Role Presets | v4.0 | 0/1 | Not started | - |
| 39. E2E Verification v4.0 | v4.0 | 0/1 | Not started | - |

**v1.0 COMPLETE (2026-03-04) — v2.0 COMPLETE (2026-03-05) — v3.0 COMPLETE (2026-03-06) — v4.0 IN PROGRESS**
