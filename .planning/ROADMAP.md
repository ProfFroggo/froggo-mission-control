# Roadmap: Mission Control — Froggo Platform

## Overview

Multi-agent AI orchestration platform. v1.0 migrated from Electron/OpenClaw to Next.js/Claude Code. v2.0 (Froggo Platform) adds operational infrastructure: tmux orchestration, enhanced memory, voice layer, per-agent capability configs, and git worktrees.

Spec sources:
- v1.0: `/Users/kevin.macarthur/Downloads/fork-merge.md`
- v2.0: `FROGGO-MIGRATION-ADDENDUM.pdf`, `FROGGO-AGENT-CAPABILITY-MATRIX.pdf`, `FROGGO-VOICE-INTEGRATION.pdf`, `FROGGO-MIGRATION-EXECUTION-PLAN.pdf`

## Milestones

- ✅ [v1.0 Migration](milestones/v1.0-migration-ARCHIVE.md) — Phases 0–14 — SHIPPED 2026-03-04
- ✅ **v2.0 Froggo Platform** — Phases 15–22 — SHIPPED 2026-03-05
- ✅ **v3.0 Autonomous Core** — Phases 23–30 — SHIPPED 2026-03-06
- ✅ [**v4.0 Agent & Module Library**](milestones/v4.0-agent-module-library.md) — Phases 31–39 — SHIPPED 2026-03-06
- ✅ **v5.0 Projects Module** — Phases 40–49 — SHIPPED 2026-03-07
- ✅ [**v6.0 Security Hardening**](milestones/v6.0-security-hardening.md) — Phases 50–57 — SHIPPED 2026-03-07
- ✅ **v6.1 Codebase Review & Hardening** — Phases 58–70 — SHIPPED 2026-03-07
- ✅ **v7.0 Install & First-Run Overhaul** — Phases 71–78 — SHIPPED 2026-03-08
- ✅ **v8.0 Platform Quality** — Phases 79–86 (complete 2026-03-09)
- 🚧 **v9.0 Agent Intelligence** — Phases 87–97 (in progress)

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

<details>
<summary>✅ v3.0 Autonomous Core (Phases 23–30) — SHIPPED 2026-03-06</summary>

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

</details>

---

<details>
<summary>✅ v4.0 Agent & Module Library (Phases 31–39) — SHIPPED 2026-03-06</summary>

See full archive: [milestones/v4.0-agent-module-library.md](milestones/v4.0-agent-module-library.md)

## v4.0 Agent & Module Library

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
- [x] 33-01: AgentLibraryPanel + Active/Library tab in AgentPanel — DONE 2026-03-06

---

### Phase 33.1: Create Agent Wizard Overhaul (INSERTED)
**Goal**: Fix the broken `HRAgentCreationModal` (`/api/agents/hr/stream` endpoint missing); update soul file template to v3.0 format (MCP tools, workspace paths, GSD protocol); wire custom-created agents to also produce a `.catalog/agents/{id}.json` manifest so they appear in the library; unify "create custom" and "hire from catalog" flows in the UI
**Depends on**: Phase 33
**Research**: Unlikely (root cause known; patterns established in v3.0 agent files)
**Plans**: 1 plan

Plans:
- [x] 33.1-01: hr/stream endpoint, catalog registration, v3.0 soul template — DONE 2026-03-06

---

### Phase 34: Agent Hire Wizard (HR Agent-Backed)
**Goal**: Multi-step hire wizard: HR agent reads manifest, creates `~/mission-control/agents/{id}/` workspace (SOUL.md, CLAUDE.md, MEMORY.md), registers agent in DB, wires into MCP config, writes intro memory — all with a live activity stream in the UI
**Depends on**: Phase 33
**Research**: Unlikely (HR agent exists; workspace pattern established in Phase 23.1)
**Plans**: 2 plans

Plans:
- [x] 34-01: POST /api/agents/hire workspace creation + modal workspace step — DONE 2026-03-06

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
| 31. Catalog Schema & Data Model | v4.0 | 1/1 | Complete | 2026-03-06 |
| 32. Catalog REST API | v4.0 | 1/1 | Complete | 2026-03-06 |
| 33. Agent Library UI | v4.0 | 1/1 | Complete | 2026-03-06 |
| 33.1. Create Agent Wizard Overhaul | v4.0 | 1/1 | Complete | 2026-03-06 |
| 34. Agent Hire Wizard | v4.0 | 1/1 | Complete | 2026-03-06 |
| 35. Module Library UI | v4.0 | 1/1 | Complete | 2026-03-06 |
| 36. Module Install Wizard | v4.0 | 1/1 | Complete | 2026-03-06 |
| 37. Agent & Module Lifecycle | v4.0 | 1/1 | Complete | 2026-03-06 |
| 38. Onboarding Role Presets | v4.0 | 1/1 | Complete | 2026-03-06 |
| 39. E2E Verification v4.0 | v4.0 | 1/1 | Complete | 2026-03-06 |

</details>

---

**v1.0 COMPLETE (2026-03-04) — v2.0 COMPLETE (2026-03-05) — v3.0 COMPLETE (2026-03-06) — v4.0 COMPLETE (2026-03-06) — v5.0 COMPLETE (2026-03-07)**

---

## v5.0 Projects Module

**Milestone Goal:** Introduce a first-class Projects concept — a named workspace where agents, tasks, chats, files, and automations are organized around a shared goal. Any user can create a project, assign agents to it, track progress across tasks, and run automations — all from a unified project workspace panel in the UI.

**Spec source:** Conversation 2026-03-07 — user request for Projects module with: card view of active projects, per-project workspace with tabs (chat, tasks, automations, files/memory), agent dispatch from project context, project-aware task filtering.

---

### Phase 40: project-data-model
**Goal**: Add `projects` and `project_members` DB tables; TypeScript interfaces; REST endpoints (`GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `POST /api/projects/:id/members`); seed data; catalogSync registers Projects module manifest
**Depends on**: Phase 39
**Research**: Unlikely (follows existing agents/tasks DB patterns; better-sqlite3 WAL)
**Plans**: 2 plans

Plans:
- [x] 40-01: DB migration — projects + project_members tables; TypeScript interfaces in src/types/
- [x] 40-02: REST API routes + catalog module manifest for projects module

---

### Phase 41: project-creation-wizard
**Goal**: Multi-step creation wizard (3 steps: Name & Goal → Assign Agents → Review & Launch); POSTs to `/api/projects`; validates name uniqueness; supports emoji/color picker for project identity; accessible modal with keyboard navigation
**Depends on**: Phase 40
**Research**: Unlikely (follows AgentHireWizard pattern from Phase 34)
**Plans**: 1 plan

Plans:
- [x] 41-01: ProjectCreationWizard component (3-step modal) wired to POST /api/projects

---

### Phase 42: projects-module-card-view
**Goal**: Projects module panel showing card grid of active projects — project name, emoji/color, assigned agent avatars, open task count, last activity; "New Project" button opens wizard; empty state with onboarding prompt; registered in ViewRegistry as `projects` module
**Depends on**: Phase 41
**Research**: Unlikely (follows ModuleLoader + ViewRegistry patterns from v1.0)
**Plans**: 2 plans

Plans:
- [x] 42-01: ProjectsPanel card grid UI + ViewRegistry registration + module nav entry
- [x] 42-02: ProjectCard component with task count badge, agent avatars, last activity timestamp

---

### Phase 43: project-workspace-shell
**Goal**: Clicking a project card navigates to `/projects/:id` (or opens a workspace panel); shell layout with project header (name, emoji, color, description, assigned agents), tabbed navigation (Chat | Tasks | Automations | Files & Memory), and breadcrumb back to Projects list
**Depends on**: Phase 42
**Research**: Unlikely (follows Next.js App Router dynamic route patterns from nextjs-patterns skill)
**Plans**: 2 plans

Plans:
- [x] 43-01: `/app/projects/[id]/page.tsx` route + ProjectWorkspaceShell layout component
- [x] 43-02: ProjectHeader component + tab navigation + breadcrumb

---

### Phase 44: project-chat-tab
**Goal**: Chat tab inside project workspace — lists project chat rooms (auto-creates one per project on creation); renders existing ChatPanel with project context pre-seeded; project-scoped room shown with all assigned agents as participants; new message defaults to project room
**Depends on**: Phase 43
**Research**: Unlikely (reuses ChatPanel + chat rooms API; adds project_id FK to chat_rooms)
**Plans**: 1 plan

Plans:
- [x] 44-01: Add project_id to chat_rooms; ProjectChatTab renders ChatPanel scoped to project rooms; auto-create room on project creation

---

### Phase 45: project-tasks-tab
**Goal**: Tasks tab showing kanban/list view of tasks scoped to the project; filter/sort by status, assignee, priority; "New Task" pre-fills project_id; drag-to-reorder columns; task count rolled up to project card; add project_id FK to tasks table
**Depends on**: Phase 43
**Research**: Unlikely (reuses KanbanPanel with project filter; adds project_id to tasks)
**Plans**: 2 plans

Plans:
- [x] 45-01: Add project_id FK to tasks table; filter tasks by project in GET /api/tasks; ProjectTasksTab renders KanbanPanel with projectId prop
- [x] 45-02: New Task modal pre-fills project context; task count badge on project card

---

### Phase 46: project-automations-tab
**Goal**: Automations tab showing cron jobs and n8n/automation workflows scoped to the project; "Add Automation" opens schedule builder (one-off, interval, cron expression); automations tagged with project_id; run history shown per automation; add project_id to schedule.json/cron entries
**Depends on**: Phase 43
**Research**: Unlikely (reuses cron-daemon + schedule API; adds project scoping)
**Plans**: 2 plans

Plans:
- [x] 46-01: Add project_id to schedule entries; GET /api/cron?project=:id filter; ProjectAutomationsTab list + run history
- [x] 46-02: AutomationBuilder component — name, kind (once/interval/cron), command, project association

---

### Phase 47: project-files-memory-tab
**Goal**: Files & Memory tab showing files in `~/mission-control/library/projects/{id}/` directory and memory entries tagged with project context; file upload (drag-drop or browse) saves to project library folder; memory search pre-filtered to project; file list with type icons, size, date
**Depends on**: Phase 43
**Research**: Unlikely (memory MCP search exists; library path pattern established; file API uses Node.js fs)
**Plans**: 2 plans

Plans:
- [x] 47-01: `GET /api/projects/:id/files` lists ~/mission-control/library/projects/{id}/; `POST` handles file upload; ProjectFilesTab renders file list with icons
- [x] 47-02: Memory search panel in Files tab — calls memory_search MCP filtered by project tag; displays knowledge entries

---

### Phase 48: project-agent-dispatch
**Goal**: "Dispatch Agent" action from project workspace sends a task directly to an assigned agent with project context pre-populated (project name, goal, relevant task IDs); dispatch uses existing taskDispatcher + soul file loading; dispatched task appears in project Tasks tab; project context injected into agent system prompt
**Depends on**: Phases 44, 45
**Research**: Unlikely (taskDispatcher.ts already dispatches with soul file; adding project context is additive)
**Plans**: 1 plan

Plans:
- [x] 48-01: ProjectDispatchModal — select agent + write brief; dispatches via POST /api/tasks + taskDispatcher with project_id; project context appended to dispatch message

---

### Phase 49: e2e-verification-v5
**Goal**: All v5.0 systems verified — project creation, workspace navigation, chat/tasks/automations/files tabs all functional, agent dispatch from project context, task/room project scoping correct, smoke test extended to cover projects module
**Depends on**: All v5.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [x] 49-01: E2E smoke test extended with projects module checks; manual UAT walkthrough all tabs

---

## Progress (v5.0)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 40. Project Data Model | v5.0 | 2/2 | Complete | 2026-03-07 |
| 41. Project Creation Wizard | v5.0 | 1/1 | Complete | 2026-03-07 |
| 42. Projects Card View | v5.0 | 2/2 | Complete | 2026-03-07 |
| 43. Project Workspace Shell | v5.0 | 2/2 | Complete | 2026-03-07 |
| 44. Project Chat Tab | v5.0 | 1/1 | Complete | 2026-03-07 |
| 45. Project Tasks Tab | v5.0 | 2/2 | Complete | 2026-03-07 |
| 46. Project Automations Tab | v5.0 | 2/2 | Complete | 2026-03-07 |
| 47. Project Files & Memory Tab | v5.0 | 2/2 | Complete | 2026-03-07 |
| 48. Project Agent Dispatch | v5.0 | 1/1 | Complete | 2026-03-07 |
| 49. E2E Verification v5.0 | v5.0 | 1/1 | Complete | 2026-03-07 |
| 50. Agent ID Validation | v6.0 | 2/2 | Complete | 2026-03-07 |
| 51. Path Traversal — Library | v6.0 | 1/1 | Complete | 2026-03-07 |
| 52. Command Injection — Spawn | v6.0 | 1/1 | Complete | 2026-03-07 |
| 53. Path Traversal — Soul Route | v6.0 | 1/1 | Complete | 2026-03-07 |
| 54. Gemini Key Server-Side | v6.0 | 2/2 | Complete | 2026-03-07 |
| 55. CSP & Security Headers | v6.0 | 1/1 | Complete | 2026-03-07 |
| 56. Input Sanitization Sweep | v6.0 | 2/2 | Complete | 2026-03-07 |
| 57. Security E2E Verification | v6.0 | 1/1 | Complete | 2026-03-07 |

---

<details>
<summary>✅ v6.0 Security Hardening (Phases 50–57) — SHIPPED 2026-03-07</summary>

See full details: [milestones/v6.0-security-hardening.md](milestones/v6.0-security-hardening.md)

- [x] Phase 50: agent-id-validation (2/2 plans) — 2026-03-07
- [x] Phase 51: path-traversal-library (1/1 plan) — 2026-03-07
- [x] Phase 52: command-injection-spawn (absorbed into Phase 50) — 2026-03-07
- [x] Phase 53: path-traversal-soul-route (absorbed into Phase 50) — 2026-03-07
- [x] Phase 54: gemini-key-server-side (2/2 plans) — 2026-03-07
- [x] Phase 55: csp-security-headers (1/1 plan) — 2026-03-07
- [x] Phase 56: input-sanitization-sweep (2/2 plans) — 2026-03-07
- [x] Phase 57: security-e2e-verification (1/1 plan) — 2026-03-07

</details>

---

## Milestone 6: Codebase Review & Hardening
*Auto-generated from full codebase audit — 2026-03-07. Backup: mission-control-nextjs-backup-20260307-181947*

#### Phase 58: cron-race-condition-fixes

**Goal**: Fix 3 race conditions in cron/interval initialization: (1) `taskDispatcherCron.ts` — store interval ID in `globalThis.__taskDispatcherInterval`, guard with existence check before creating; (2) `claraReviewCron.ts` — set `g._claraReviewCron` flag BEFORE creating the interval to eliminate TOCTOU window; (3) `app/api/agents/[id]/stream/route.ts` — store reap interval in `globalThis._reapInterval`, guard with existence check; (4) `taskDispatcher.ts:~608` — store redispatch setTimeout IDs in a `Map<string, NodeJS.Timeout>`, skip if already queued; (5) `app/api/health/route.ts` — wrap both cron startup calls in a once-per-process globalThis guard.
**Status**: COMPLETE
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 58-01: fix-cron-races

#### Phase 59: logic-bug-fixes

**Goal**: Fix 5 logic bugs causing data corruption: (1) `app/api/tasks/[id]/route.ts` reviewStatus auto-advancement — add guard `if (!('status' in body))` so explicit status overrides are never clobbered by the auto-advance; (2) recurrence spawning in same file — query for existing sibling with same `recurrenceParentId + dueDate` before spawning to prevent duplicate tasks on rapid PATCH calls; (3) `app/api/agents/route.ts` POST — remove `role`, `personality`, `color` from INSERT statement (columns don't exist in agents schema → runtime SQL error); (4) `app/api/approvals/[id]/route.ts` — wrap processing in `if (existing.status === 'pending')` guard to prevent duplicate activity logs; (5) `app/api/inbox/[id]/route.ts` — check `result.changes === 0` after UPDATE and return 404 early instead of SELECT then null-check.
**Depends on**: Phase 58
**Plans**: 1 plan

Plans:
- [x] 59-01: fix-logic-bugs

#### Phase 60: api-validation-hardening

**Goal**: Add missing input validation to 5 API routes: (1) `app/api/notifications/route.ts` — validate `parseInt(limit)` and `parseInt(since)` with NaN check, return 400 on invalid; (2) `app/api/inbox/route.ts` — add console.warn in fire-and-forget spawn catch block (currently silent); (3) `src/lib/api.ts` streamMessage — add `.catch(onError)` to outer fetch chain; (4) `app/api/chat/sessions/route.ts` — validate agentId doesn't contain colon or special chars before constructing key; (5) `app/api/agents/[id]/stream/route.ts` — verify agent exists in DB before spawning Claude process.
**Depends on**: Phase 59
**Plans**: 1 plan

Plans:
- [x] 60-01: api-validation

#### Phase 61: emoji-removal

**Goal**: Replace ALL emoji characters used as UI elements with Lucide icons per CLAUDE.md policy. Files: (1) `AccessibilitySettings.tsx:329` — 💡→Lightbulb, remove ⌘ from span; (2) `FinancePanel.tsx:286-296` — 🍽️🛍️💡🖼️→UtensilsCrossed,ShoppingBag,Lightbulb,ImageIcon; (3) `Kanban.tsx:50-54` — add `icon: LucideIcon` to column config, render icon instead of emoji; (4) `Kanban.tsx:1227-1252` — ⚠️✅→AlertTriangle,CheckCircle; (5) `EnhancedSettingsPanel.tsx:633-640` — remove emojis from option labels; (6) `ScreenSourcePicker.tsx:140` — ⚠️→AlertTriangle; (7) `DraggableVideoWindow.tsx:177` — 📹🖥️→Camera,Monitor; (8) `DashboardRedesigned.tsx:110,634-635` — emoji returns→icon components; (9) `VIPSettingsPanel.tsx:31` — emoji:'🎯'→icon field; (10) `TaskDetailPanel.tsx:~800` — ✅❌→CheckCircle,XCircle; (11) `ModuleLoader.ts` — remove ❌ from console string.
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 61-01: replace-emojis

#### Phase 62: hardcoded-color-fixes

**Goal**: Replace hardcoded Tailwind color classes with design tokens: (1) `Kanban.tsx:1394` `bg-green-500`→`bg-success`; (2) `HealthCheckModal.tsx:613` `bg-green-600 hover:bg-green-700`→`bg-success hover:bg-success/90`; (3) `MarketplaceBrowse.tsx:255,265` `bg-green-600/90`,`bg-amber-500/90`→`bg-success`,`bg-warning`; (4) `ScreenSourcePicker.tsx:159` `bg-black`→`bg-mission-control-bg`; (5) normalize modal overlays to `bg-black/50` (ScreenSourcePicker uses bg-black/60).
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 62-01: fix-hardcoded-colors

#### Phase 63: button-focus-standardization

**Goal**: Standardize interactive element styles: (1) audit all primary/action buttons — should use `rounded-xl`; icon/secondary buttons use `rounded-lg`; (2) fix `HealthCheckModal.tsx` primary button to use `rounded-xl`; `ProjectCreationWizard.tsx:494` retry to `rounded-lg`; (3) add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent` to ALL buttons missing focus styles — especially in `ScreenSourcePicker.tsx`; (4) document the standard in a comment in forms.css.
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 63-01: button-focus-std

#### Phase 64: store-selector-narrowing

**Goal**: Replace broad store subscriptions with granular selectors to eliminate unnecessary re-renders: (1) `Dashboard.tsx:706` — split 11-value `useStore()` into individual selectors; (2) `App.tsx:63` — split 4 action destructuring into individual selectors; (3) `Sidebar.tsx:54-56` — wrap activeTasks filter in useMemo; (4) `CommsInbox3Pane.tsx` — narrow activities subscription; (5) verify `useShallow` usage in Kanban.tsx is correct. Move `APPROVAL_ICONS` map in Dashboard.tsx to module level (outside component function).
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 64-01: narrow-store-selectors

#### Phase 65: react-memo-usememo

**Goal**: Add memoization to high-frequency render paths: (1) `Dashboard.tsx` — wrap StatCard, ApprovalCard, HeaderBar in React.memo(); (2) `Dashboard.tsx:357-368` — `useMemo` for activities.slice(0,8); (3) `Dashboard.tsx:723-739` — consolidate 5 derived useMemo into grouped memo; (4) `CommandPalette.tsx:63-210` — `useMemo` for commands array with proper deps; (5) `Kanban.tsx` — memo KanbanCard (or equivalent card component) to isolate single-card updates from full column re-render.
**Depends on**: Phase 64
**Plans**: 1 plan

Plans:
- [x] 65-01: add-memoization

#### Phase 66: n-plus-one-fixes

**Goal**: Replace O(n) linear searches with Map lookups in render hot paths: (1) `Dashboard.tsx` ActivityFeed — `useMemo(() => new Map(agents.map(a=>[a.id,a])), [agents])` then `agentMap.get(task.assignedTo)`; (2) `Dashboard.tsx` TodaySchedule — pre-compute `getMeetingLink` results in useMemo; (3) `store.ts` updateTask action — consider adding `taskById` lookup helper or Map alongside array; (4) `store.ts` loadTasksFromDB — add 5s request deduplication guard to prevent N concurrent fetches from multiple mounted components.
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 66-01: n-plus-one

#### Phase 67: interval-effect-cleanup

**Goal**: Fix stale closures and interval management in effects: (1) `Dashboard.tsx` TodaySchedule — wrap `loadEvents` in `useCallback`, add to interval deps; (2) `Dashboard.tsx` SystemHealth — same pattern; (3) `Sidebar.tsx:97-101` — ensure `loadInboxCount` wrapped in `useCallback([])` to stabilize interval dep; (4) `Kanban.tsx:95-149` — verify `loadTasksFromDB` is stable store action ref; consider merging two 30s intervals into one.
**Depends on**: Phase 65
**Plans**: 1 plan

Plans:
- [x] 67-01: interval-cleanup

#### Phase 68: formatting-utils-consolidation

**Goal**: Create `src/utils/formatting.ts` and eliminate all duplicate formatting functions: (1) `formatTimeAgo(ts: number): string` — 6+ copies in Dashboard, DashboardRedesigned, NotificationsPanelV2, QuickStatsWidget, DebugTab, ChannelsTab, CodeAgentDashboard → one canonical impl; (2) `formatDueDate` — 3 copies in Kanban, TaskScheduler, ProjectKanban → one; (3) `formatDate`/`formatTime`/`formatDateTime` — 5+ variants → standardized set; (4) `formatDuration` — 2 copies → one. Update all import sites.
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 68-01: formatting-utils

#### Phase 69: agent-config-centralization

**Goal**: Create `src/lib/agentConfig.ts` to eliminate hardcoded agent names/IDs: (1) `PROTECTED_AGENTS = ['mission-control', 'main', 'clara']` — currently duplicated in Kanban, AgentPanel, TaskDetailPanel (3 copies); (2) agent type labels map — duplicated in MorningBrief, QuickActions; (3) default assignment lists — OnboardingWizard, ModuleBuilder/TaskGenerator. Update all 7 affected files to import from `agentConfig.ts`.
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 69-01: agent-config

#### Phase 70: dead-code-cleanup

**Goal**: Remove dead/duplicate code: (1) `src/components/IconWrapper.tsx` — remove duplicate IconBadge function (lines 146-181); verify consumers import from IconBadge.tsx; (2) remove `pendingTaskUpdates` Set from store.ts (declared but never used — implement properly or delete); (3) remove commented-out code blocks in HealthCheckModal.tsx (~lines 200,250); (4) audit 4 potentially unused components: Toggle.tsx, LoadingPanel.tsx, Skeleton.tsx, BadgeShowcase.tsx — remove if truly unused; (5) remove/gate 40+ console.log statements in non-error paths.
**Depends on**: none
**Plans**: 1 plan

Plans:
- [x] 70-01: dead-code


---

### 🚧 v7.0 Install & First-Run Overhaul (In Progress)

**Milestone Goal:** Every user who runs `npm install -g froggo-mission-control` gets a working, fully-configured platform in under 5 minutes — no broken builds, no empty agent workspaces, no missing config files, and a guided in-app setup wizard that walks them through credentials, agents, modules, and a tour.

**Source:** Clean-install audit `~/Downloads/mission-control-install-improvements.md` (2026-03-08) + WebP image migration.

---

#### Phase 71: build-fix-postcss-tailwind

**Goal**: Fix P0 build break — `postcss.config.mjs` must use `@tailwindcss/postcss` (not `tailwindcss` directly) for Tailwind v4 + Next.js 16; add `@tailwindcss/postcss` to `package.json` dependencies; ensure `@tailwindcss/forms` is present; verify `next build` completes without errors after fix
**Depends on**: Phase 70
**Research**: Unlikely (known root cause, config file change only)
**Plans**: 1 plan

Plans:
- [ ] 71-01: TBD (run /gsd:plan-phase 71 to break down)

---

#### Phase 72: install-bootstrap-core

**Goal**: Make `mission-control setup` / `install.sh` produce a fully working `~/mission-control/` directory: (1) scaffold core agent workspaces (main, clara, coder, writer) from `catalog/agents/{id}/` templates; (2) generate `~/mission-control/.claude/settings.json` with MCP registrations + hooks; (3) generate `~/mission-control/.mcp.json` with corrected VAULT_PATH and all 3 MCP servers including cron-mcp; (4) generate `~/mission-control/CLAUDE.md` with project context, agent roster, task lifecycle, MCP tool docs; (5) create `schedule.json` as `{}` and `google-tokens.json` as `{}`; (6) apply performance indexes SQL to DB on first init
**Depends on**: Phase 71
**Research**: Unlikely (all patterns exist in bin/cli.js and install.sh; catalog templates already on disk)
**Plans**: 2 plans

Plans:
- [ ] 72-01: TBD
- [ ] 72-02: TBD

---

#### Phase 73: qmd-fallback-and-search-ui

**Goal**: Graceful search degradation when `qmd` is not installed: (1) `src/lib/env.ts` add `resolveQmdBin()` trying `qmd` then falling back to `rg`; (2) memory MCP uses fallback bin if qmd missing; (3) Memory panel shows search tool status badge (qmd/ripgrep/not found); (4) clear UI message with install link if neither found
**Depends on**: Phase 72
**Research**: Unlikely (env.ts resolveClaudeBin() pattern already exists)
**Plans**: 1 plan

Plans:
- [ ] 73-01: TBD

---

#### Phase 74: cli-wizard-simplification

**Goal**: Strip all interactive prompts from CLI wizard — no API keys, no permissions, no sample data, no role selection; CLI does only: prerequisite check, directory creation, core bootstrap, config generation, LaunchAgent/systemd install, MCP + next build, start server, open `/setup`; update `bin/cli.js` and `install.sh`
**Depends on**: Phase 72
**Research**: Unlikely (existing bin/cli.js patterns; removal-only changes)
**Plans**: 1 plan

Plans:
- [ ] 74-01: TBD

---

#### Phase 75: in-app-wizard-overhaul

**Goal**: Redesign `/setup` OnboardingWizard with 10-step flow: Welcome → System Check → Agent Permissions → Gemini API Key (skippable) → Google Workspace OAuth (skippable) → Obsidian Vault (skippable) → Agent & Module Picker (core pre-checked, optional catalog checkboxes) → Animated Setup Checklist (live progress) → Interactive Tour → Done; remove role-preset step, camera/mic permissions step, sample data step
**Depends on**: Phase 74
**Research**: Unlikely (extends existing OnboardingWizard; agent/module catalog API exists from v4.0)
**Plans**: 3 plans

Plans:
- [ ] 75-01: TBD
- [ ] 75-02: TBD
- [ ] 75-03: TBD

---

#### Phase 76: interactive-tour

**Goal**: Re-launchable interactive tour with 8 stops (Dashboard → Tasks → Agents → Inbox → Memory → Library → Analytics → Settings); each stop: element highlight overlay, 1-2 sentence tooltip, Next/Skip buttons; tour state in DB settings; re-launchable from Settings → Help; auto-launches at end of setup wizard
**Depends on**: Phase 75
**Research**: Unlikely (vanilla React portal overlay; no external library needed)
**Plans**: 1 plan

Plans:
- [ ] 76-01: TBD

---

#### Phase 77: webp-image-migration

**Goal**: Convert all PNG/JPG images to WebP: audit `public/` and `catalog/agents/*/avatar.*`; convert with `cwebp`/`sharp`; update all `<img>`, `next/image`, and CSS references; update `package.json` files array if needed; verify agent avatars render in Agent Library UI
**Depends on**: Phase 71
**Research**: Unlikely (Next.js Image supports WebP natively)
**Plans**: 1 plan

Plans:
- [ ] 77-01: TBD

---

#### Phase 78: e2e-verification-v7

**Goal**: Verify all v7.0 changes: fresh setup creates all expected files in `~/mission-control/`; core agent workspaces exist; config files generated correctly; `next build` passes; wizard flow completes; agent/module picker installs; tour navigates all 8 stops; WebP images load; smoke test updated with install checks
**Depends on**: All v7.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 78-01: TBD

## Progress (v7.0)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 71. Build Fix PostCSS/Tailwind | v7.0 | 0/1 | Not started | - |
| 72. Install Bootstrap Core | v7.0 | 0/2 | Not started | - |
| 73. QMD Fallback & Search UI | v7.0 | 0/1 | Not started | - |
| 74. CLI Wizard Simplification | v7.0 | 0/1 | Not started | - |
| 75. In-App Wizard Overhaul | v7.0 | 0/3 | Not started | - |
| 76. Interactive Tour | v7.0 | 0/1 | Not started | - |
| 77. WebP Image Migration | v7.0 | 0/1 | Not started | - |
| 78. E2E Verification v7.0 | v7.0 | 0/1 | Not started | - |

---

### ✅ v8.0 Platform Quality (Complete — 2026-03-09)

**Milestone Goal:** Transform the platform from "baseline works" to "pro" quality. 110+ gaps identified across a full three-pass audit (frontend, API/backend, catalog/agents). This milestone closes the most impactful ones: silent failures become visible, interactive chat feels instant (Anthropic SDK streaming), the polling storm ends, security holes are plugged, and all 16 agent souls are corrected.

**Source:** Full platform audit `~/Downloads/froggo-platform-audit-final.md` (2026-03-09)

---

#### Phase 79: stability-fixes

**Goal**: Close the six most dangerous silent failure modes surfaced in the audit — (1) Clara double-dispatch via MCP hook + cron both firing; (2) taskDispatcher discards stderr making agent failures invisible; (3) missing DB indexes on `tasks.status`, `tasks(status,reviewStatus)`, `task_activity(taskId,timestamp)`; (4) raise all polling minimums (InboxPanel 5s→60s, LogsTab 3s→30s, Sidebar 15s→60s); (5) add `LIMIT 200` to all 6 unbounded SQL queries; (6) fix Kanban `useMemo`/`useCallback` empty dependency arrays causing stale task display
**Depends on**: Phase 78
**Research**: Unlikely (all root causes identified; fixes are targeted changes to existing files)
**Plans**: 3 plans

Plans:
- [ ] 79-01: Clara double-dispatch fix + stderr capture in taskDispatcher + concurrency semaphore (max 5 concurrent)
- [ ] 79-02: DB index migration + LIMIT on all unbounded queries + recurring task idempotency constraint
- [ ] 79-03: Kanban useMemo/useCallback dep arrays + polling interval raises + visibility-based polling pause

---

#### Phase 80: real-time-chat-streaming

**Goal**: Replace Claude CLI for interactive chat with Anthropic SDK streaming — users see word-by-word output (~300ms to first token, not 3–15s silence); new `POST /api/agents/[id]/chat` route streams `text_delta` events via SSE; `ChatPanel.tsx` switched to `ReadableStream` reader that appends tokens as they arrive; CLI retained for autonomous task dispatch; conversation history saved to DB per session
**Depends on**: Phase 79
**Research**: Likely (Anthropic SDK streaming API)
**Research topics**: `client.messages.stream()` SSE pattern, tool_use events in stream, conversation history format, token tracking from stream finalMessage
**Plans**: 3 plans

Plans:
- [ ] 80-01: New `app/api/agents/[id]/chat/route.ts` — Anthropic SDK stream, soul.md system prompt, conversation history from DB, tool definitions from MCP
- [ ] 80-02: `ChatPanel.tsx` — switch to streaming fetch, append text_delta chunks, typing indicator, abort on unmount
- [ ] 80-03: Conversation history persistence — save complete turn to DB on stream end; load last N turns on panel open

---

#### Phase 81: frontend-performance

**Goal**: Fix the four highest-impact frontend bugs from the audit — (1) `TaskDetailPanel.tsx` file-level `eslint-disable react-hooks/exhaustive-deps` removed; fix stale closure useEffects causing updates to apply to wrong task; (2) optimistic update rollback — store pre-update state and rollback with toast on API failure; (3) interval ref cleanup pattern enforced across all 20+ polling components; (4) store module-level gateway listeners moved to root useEffect so they can be cleaned up and tested
**Depends on**: Phase 79
**Research**: Unlikely (React patterns; all changes are internal)
**Plans**: 3 plans

Plans:
- [ ] 81-01: `TaskDetailPanel.tsx` — remove file-level eslint-disable; fix individual useEffect dep arrays; verify task-switching applies updates to correct task
- [ ] 81-02: Optimistic update rollback in `store.ts` updateTask/updateSubtask; toast on failure; rollback to pre-update state
- [ ] 81-03: Gateway listeners → root `layout.tsx` useEffect with cleanup; `debouncedTaskRefresh` module-scoped ref (not `window.__taskRefreshTimer`)

---

#### Phase 82: sse-real-time-layer

**Goal**: Replace all polling with a single Server-Sent Events endpoint; `GET /api/events` emits `task.updated`, `task.created`, `agent.status`, `inbox.count` events whenever DB state changes; all 20+ polling `setInterval` calls removed from components; `useEventBus` hook subscribes to event stream; fallback: 60s polling if SSE fails; visibility-based pause at app root level (not per-component)
**Depends on**: Phase 81
**Research**: Likely (SSE in Next.js App Router)
**Research topics**: Next.js App Router SSE pattern with ReadableStream, DB change notifications (SQLite doesn't have native pub/sub — need lightweight event emitter), connection cleanup on client disconnect
**Plans**: 3 plans

Plans:
- [ ] 82-01: `app/api/events/route.ts` — SSE endpoint; in-process event emitter; DB write helpers emit events; keepalive ping every 30s
- [ ] 82-02: `src/lib/useEventBus.ts` hook — EventSource subscribe/unsubscribe; reconnect with backoff; visibility pause
- [ ] 82-03: Remove all `setInterval` polling from: InboxPanel, LogsTab, TopBar, Kanban, ApprovalQueuePanel, AgentPanel, CircuitBreakerStatus, Sidebar, Dashboard, HealthStatusWidget; replace with useEventBus

---

#### Phase 83: auth-and-security

**Goal**: Close the three critical security gaps — (1) auth middleware: `middleware.ts` validates `INTERNAL_API_TOKEN` bearer token on all `/api/*` routes; token stored in `.env`; (2) executor path traversal fix: `scriptPath` validated against `~/mission-control/scripts/` allowlist before execution; (3) prompt injection guard: user-supplied content wrapped in XML tags with "treat as data" instruction before injection into agent prompts; add `Content-Security-Policy` header if missing
**Depends on**: Phase 79
**Research**: Unlikely (Next.js middleware pattern established in v6.0 security work; path.resolve validation is standard)
**Plans**: 2 plans

Plans:
- [ ] 83-01: `middleware.ts` bearer token auth + `INTERNAL_API_TOKEN` in `.env`; update all client-side fetch calls to include auth header
- [ ] 83-02: Executor path traversal fix + prompt injection XML wrapping in stream route + CSP header audit

---

#### Phase 84: agent-soul-quality

**Goal**: Fix all 22 catalog gaps from the audit — (1) remove 14 phantom Google Workspace routes from inbox soul; (2) add `approval_create` MCP call workflow to writer + social-manager souls; (3) add escalation criteria to mission-control, coder, growth-director souls; (4) fix all 16 module icon fields from emoji to Lucide names; (5) add soul.md existence validation to `catalogSync.ts`; (6) fix `"core"` flag on projects, finance, schedule modules; (7) fix "stratagies" typo to "strategies" across all library output paths; (8) add accessibility-checklist skill reference to designer soul
**Depends on**: Phase 79
**Research**: Unlikely (all changes are to soul.md, manifest.json, and catalog JSON files — no code logic)
**Plans**: 3 plans

Plans:
- [ ] 84-01: Inbox soul overhaul — remove phantom routes section, add triage-protocol workflow, mark Google Workspace as "coming in v9.0"
- [ ] 84-02: Approval gate documentation — writer, social-manager, coder souls; escalation criteria — mission-control, coder souls; module icon Lucide migration (all 16 modules)
- [ ] 84-03: catalogSync soul.md validation; core flag fixes (projects, finance, schedule); library path typo fixes; OnboardingWizard fetch from catalog instead of hardcoded list

---

#### Phase 85: observability-and-circuit-breakers

**Goal**: Make failures visible and self-healing — (1) `telemetry` DB table + `trackEvent()` util called from dispatch start/end, Clara review result, cron job result, API errors; (2) `GET /api/metrics` returns event counts by type for last 24h; (3) circuit breaker: track consecutive failures per agent, set `offline` status after 3 failures in a window, stop dispatch until manually re-enabled; (4) cron job failures write task activity entries (not console-only); (5) error boundary components wrapping Kanban, TaskDetailPanel, InboxPanel, ChatPanel, FinancePanel
**Depends on**: Phase 79
**Research**: Unlikely (SQLite table + React error boundaries; all patterns established)
**Plans**: 2 plans

Plans:
- [ ] 85-01: `telemetry` table migration + `trackEvent()` + `GET /api/metrics` endpoint + circuit breaker in taskDispatcher (3-strike per-agent lockout)
- [ ] 85-02: React Error Boundary component wrapping all major panels; cron daemon job failure → task activity write; Clara review result telemetry

---

#### Phase 86: e2e-verification-v8

**Goal**: Verify all v8.0 changes — streaming chat returns tokens within 500ms; Kanban shows correct tasks after rapid polling with correct memo deps; TaskDetailPanel updates apply to correct task when switching; SSE events flow from DB write to UI update; auth middleware blocks unauthenticated requests; executor rejects path traversal attempts; agent soul quality checked (no phantom routes, approval gate present); circuit breaker locks out failing agent after 3 failures; telemetry records events; smoke test extended to cover all v8.0 additions
**Depends on**: All v8.0 phases
**Research**: Unlikely
**Plans**: 1 plan

Plans:
- [ ] 86-01: Extend e2e smoke test; manual checklist verification of streaming, SSE, auth, circuit breaker, and soul quality

## Progress (v8.0)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 79. Stability Fixes | v8.0 | 3/3 | Done | 2026-03-09 |
| 80. Real-Time Chat Streaming | v8.0 | 3/3 | Done | 2026-03-09 |
| 81. Frontend Performance | v8.0 | 3/3 | Done | 2026-03-09 |
| 82. SSE Real-Time Layer | v8.0 | 3/3 | Done | 2026-03-09 |
| 83. Auth & Security | v8.0 | 0/2 | Skipped (not in scope) | - |
| 84. Agent Soul Quality | v8.0 | 0/3 | Skipped (not in scope) | - |
| 85. Observability & Circuit Breakers | v8.0 | 2/2 | Done | 2026-03-09 |
| 86. E2E Verification v8.0 | v8.0 | 1/1 | Done | 2026-03-09 |

---

### 🚧 v9.0 Agent Intelligence (In Progress)

**Milestone Goal:** Transform agents from stateless executors into learning systems. Wire the three missing loops (write, read, Clara), scale memory infrastructure, and give agents the ability to improve with every task they complete.

**Source:** `~/Downloads/froggo-agent-intelligence-roadmap.md`

---

#### Phase 87: Memory Protocol Foundation

**Goal**: Add explicit memory protocol sections to all 15 agent SOUL.md files. Extend task session expiry from 2 hours to 24 hours. Add session cleanup cron (delete sessions >7 days). Seed the vault with 10 core knowledge articles (architecture, conventions, common gotchas). Add initial memory_search call to task system prompt so agents start looking up context from day one.
**Depends on**: Phase 86
**Research**: Unlikely (internal file edits, DB constant change, memory MCP already built)
**Plans**: 2 plans

Plans:
- [ ] 87-01: Update all 15 SOUL.md files with memory protocol section; add memory_search instruction to TASK_SUFFIX in taskDispatcher; extend SESSION_EXPIRY_MS to 24h; add session cleanup in claraReviewCron startup sweep
- [ ] 87-02: Write 10 seed knowledge articles to vault (architecture decisions, task lifecycle, MCP tools reference, common patterns, security conventions, UI conventions, agent capabilities, deployment notes, testing patterns, troubleshooting guide)

---

#### Phase 88: Write Loop — Post-Task Memory Capture

**Goal**: Every completed task generates a structured memory note in the vault. The Stop hook in `.claude/settings.json` fires after each Claude process exits and triggers memory_write. Agents leave a record of what they learned so future sessions start warm.
**Depends on**: Phase 87
**Research**: Unlikely (Stop hook slot already exists in settings.json; memory MCP tools built)
**Plans**: 2 plans

Plans:
- [ ] 88-01: Implement `tools/hooks/memory-capture.js` — reads Claude session output, extracts task summary, calls memory MCP to write structured note to `~/mission-control/memory/agents/{agentId}/YYYY-MM-DD-{task-slug}.md`; wire into `.claude/settings.json` Stop hook
- [ ] 88-02: Add end-of-task memory write instruction to TASK_SUFFIX in taskDispatcher (fallback if hook unavailable); add memory write to task_activity on completion; verify notes appear in vault after task completes

---

#### Phase 89: Read Loop — Pre-Dispatch Memory Injection

**Goal**: Before every task starts, query the vault for relevant past notes and inject the top 3 results into the system prompt as `## Your Relevant Memory`. Agents stop starting cold. An agent that worked on a similar task last week automatically gets its own notes injected before the new task.
**Depends on**: Phase 88
**Research**: Unlikely (extends buildTaskSystemPrompt() in taskDispatcher; memory MCP search already works)
**Plans**: 2 plans

Plans:
- [ ] 89-01: Add `loadRelevantMemory(agentId, taskTitle)` to taskDispatcher — calls memory_search via the memory MCP HTTP interface, returns top 3 results (max 1500 tokens), injects as `## Your Relevant Memory` section before TASK_SUFFIX; skip if no results or budget exceeded
- [ ] 89-02: Test injection quality — verify correct notes surface for relevant tasks; add token budget guard (drop memory section if total prompt would exceed model limit); log injection hits/misses to telemetry

---

#### Phase 90: Clara Learning Loop

**Goal**: After every review Clara writes a one-line pattern note appending to `~/mission-control/memory/agents/clara/agent-patterns/{agentId}.md`. Clara's system prompt in claraReviewCron loads this file before reviewing that agent. After 10+ reviews Clara knows each agent's strengths and blind spots. Review quality improves over time.
**Depends on**: Phase 89
**Research**: Unlikely (extends claraReviewCron.ts; memory file read/write)
**Plans**: 2 plans

Plans:
- [ ] 90-01: Update claraReviewCron — after each review decision append pattern line to agent-specific pattern file; format: `YYYY-MM-DD | {title} | {approved/rejected} | {reason-summary}`; create file if not exists
- [ ] 90-02: Update buildClaraSystemPrompt() to load agent pattern file when reviewing — inject as `## Your Past Reviews of {agentName}`; cap at last 20 lines to control token usage; verify Clara's review notes reference past patterns

---

#### Phase 91: Structured Memory Format + Expertise Map

**Goal**: Standardize all memory notes with YAML frontmatter (date, agent, task, tags, confidence). Update memory_write MCP tool to validate and enforce format. Auto-maintain an expertise map (`memory/agents/expertise-map.md`) that tracks which agent has notes on which topics — making cross-agent knowledge discovery possible.
**Depends on**: Phase 90
**Research**: Unlikely (memory MCP tool extension; YAML frontmatter; file append)
**Plans**: 2 plans

Plans:
- [ ] 91-01: Define structured memory note format with YAML frontmatter; update memory_write in `tools/memory-mcp/src/index.ts` to accept and validate structured format; update memory_search to filter/boost by tags; backfill seed notes with correct frontmatter
- [ ] 91-02: Implement expertise map auto-update — when memory_write is called, append agent + tags to `memory/agents/expertise-map.md`; add memory_recall query for expertise map; expose expertise map in AgentPanel expanded view

---

#### Phase 92: Skill Auto-Assignment from Task Keywords

**Goal**: At dispatch time, automatically match task title/description keywords against a TASK_SKILL_MAP and inject matching skills into the system prompt without manual assignment. Agents get react-best-practices for React tasks, security-checklist for API tasks, etc. — without anyone having to remember to assign skills.
**Depends on**: Phase 91
**Research**: Unlikely (extends taskDispatcher skill loading; TASK_SKILL_MAP is a static config)
**Plans**: 1 plan

Plans:
- [ ] 92-01: Define `TASK_SKILL_MAP` in taskDispatcher (react→react-best-practices, api→security-checklist, test→froggo-testing-patterns, etc.); auto-inject up to 2 matched skills at dispatch time; merge with manually assigned skills (deduplicated); log auto-assigned skills to task activity

---

#### Phase 93: PreCompact Hook — Context Compression

**Goal**: Implement the PreCompact hook in `.claude/settings.json` so when Claude's context window fills up and compaction is triggered, a summary of the current session is written to the agent's vault before compression. No context is ever permanently lost across compaction boundaries.
**Depends on**: Phase 91
**Research**: Unlikely (PreCompact hook slot already exists in settings.json; memory write established)
**Plans**: 2 plans

Plans:
- [ ] 93-01: Implement `tools/hooks/pre-compact-summary.js` — receives current session state, extracts key decisions/progress/blockers, calls memory_write with category='session' before compaction fires; wire into `.claude/settings.json` PreCompact hook
- [ ] 93-02: Test compaction survival — verify that long-running tasks that hit context limit still have their progress captured; verify resumed sessions can find pre-compact summary via memory_search; add compaction event to telemetry

---

#### Phase 94: Task Handoff Memory

**Goal**: When a task is reassigned from agent A to agent B, agent A writes a structured handoff note (where I left off, what I tried, what still needs doing). The handoff note is automatically injected into agent B's first session for that task. Reassignments no longer start cold.
**Depends on**: Phase 93
**Research**: Unlikely (extends task reassignment PATCH handler + memory injection at dispatch)
**Plans**: 2 plans

Plans:
- [ ] 94-01: Add handoff note trigger to task PATCH handler — when `assignedTo` changes and task has prior session, create handoff prompt for outgoing agent; store handoff note to `memory/agents/{oldAgent}/handoffs/{taskId}.md`; link in task activity
- [ ] 94-02: At dispatch for reassigned tasks, detect existing handoff note and inject it as `## Handoff from {previousAgent}` in system prompt; verify incoming agent acknowledges prior work in first response

---

#### Phase 95: Agent Performance Dashboard

**Goal**: Track per-agent metrics in the telemetry table: task completion rate, Clara approval rate, average task duration by type, memory write frequency, skill usage. Display improvement charts on the Agents page so the user can see which agents are getting smarter and which need support.
**Depends on**: Phase 94
**Research**: Unlikely (telemetry table already exists; charting is UI work on existing AgentPanel)
**Plans**: 2 plans

Plans:
- [ ] 95-01: Extend telemetry tracking — add per-agent events for: memory_written, skill_used, review_approved, review_rejected, handoff_created, session_compacted; add `/api/agents/{id}/metrics` endpoint returning 30-day summary
- [ ] 95-02: Build AgentPerformancePanel component — shows approval rate trend (line chart), memory write frequency, skill usage breakdown, top task types; add as new tab in AgentManagementModal; show improvement delta vs 7 days ago

---

#### Phase 96: Vector Embeddings for Semantic Memory Search

**Goal**: Generate embeddings for memory notes at write time using the Anthropic embeddings API. Store alongside notes in QMD. Memory search runs hybrid BM25+vector with re-ranking so semantically similar notes surface even when vocabulary differs ("make search faster" finds "FTS5 performance optimization").
**Depends on**: Phase 95
**Research**: Likely (Anthropic embeddings API — confirm current endpoint, model, cost; QMD vector storage format)
**Research topics**: Anthropic text-embedding-3 API endpoint and cost per note; QMD vector index format; hybrid re-ranking strategy (RRF vs weighted sum)
**Plans**: 3 plans

Plans:
- [ ] 96-01: Research and validate Anthropic embeddings API; implement `generateEmbedding(text)` in memory MCP; update memory_write to generate and store embedding alongside note
- [ ] 96-02: Update memory_search to run BM25 + vector query in parallel; implement RRF (Reciprocal Rank Fusion) re-ranking; update fallback grep path to skip embedding step gracefully
- [ ] 96-03: Validate search quality improvement — test 20 queries where BM25 fails and vector succeeds; measure latency delta; add embedding generation time to telemetry; write QA report

---

#### Phase 97: Task Template Library + Memory Scale

**Goal**: Auto-generate reusable task templates from recurring patterns (after 5+ similar tasks). A nightly memory decay cron archives notes older than 90 days to keep the hot vault fast. The vault scales to thousands of notes without quality degradation.
**Depends on**: Phase 96
**Research**: Unlikely (pattern detection is analytics on existing data; file archival is simple cron)
**Plans**: 2 plans

Plans:
- [ ] 97-01: Implement task template detection — after each task completes, check if 5+ tasks with similar title pattern exist; if yes, generate template note to `memory/templates/{pattern}.md`; expose templates in TaskModal ("Similar to past tasks — use template?")
- [ ] 97-02: Implement memory decay cron — nightly job moves notes older than 90 days to `memory/archive/YYYY/`; notes 14-90 days old flagged as 'warm' (0.7 weight in search); hot vault stays under 500 notes; add vault stats to `/api/metrics`

---

## Progress (v9.0)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 87. Memory Protocol Foundation | v9.0 | 0/2 | Not started | - |
| 88. Write Loop — Post-Task Memory | v9.0 | 0/2 | Not started | - |
| 89. Read Loop — Pre-Dispatch Injection | v9.0 | 0/2 | Not started | - |
| 90. Clara Learning Loop | v9.0 | 0/2 | Not started | - |
| 91. Structured Memory Format | v9.0 | 0/2 | Not started | - |
| 92. Skill Auto-Assignment | v9.0 | 0/1 | Not started | - |
| 93. PreCompact Hook | v9.0 | 0/2 | Not started | - |
| 94. Task Handoff Memory | v9.0 | 0/2 | Not started | - |
| 95. Agent Performance Dashboard | v9.0 | 0/2 | Not started | - |
| 96. Vector Embeddings | v9.0 | 0/3 | Not started | - |
| 97. Task Templates + Memory Scale | v9.0 | 0/2 | Not started | - |

---

### 📋 v10.0 Real-Time Streaming (Planned)

**Milestone Goal:** Replace the buffered Claude CLI subprocess stream with a direct Anthropic SDK stream for interactive chat, delivering true typewriter-style output at 100–200ms latency vs the current 200–750ms chunked output. Cron and task dispatch remain on the CLI route.

#### Phase 98: SDK Chat Route — Wire & Persist

**Goal**: Upgrade `/api/agents/[id]/chat/route.ts` with conversation history loading, message persistence to `chat_messages` SQLite table, system prompt loading from SOUL.md, usage tracking, correct SSE headers, and per-agent lock. DB migration for `chat_messages` if missing.
**Depends on**: Phase 97
**Research**: Unlikely (Anthropic SDK already in codebase — `@anthropic-ai/sdk`; patterns follow existing stream route)
**Plans**: 3 plans

Plans:
- [ ] 98-01: DB migration — add `chat_messages` table + indexes to `src/lib/database.ts`; verify history route at `app/api/agents/[id]/chat/history/route.ts` loads from table; add `GET /api/agents/[id]/chat/history` call to ChatPanel mount
- [ ] 98-02: Update `chat/route.ts` — load last 40 messages from DB, persist user + assistant messages, load SOUL.md system prompt, add per-agent lock (reuse `agentLocks` map), add `X-Accel-Buffering: no` and full SSE headers
- [ ] 98-03: Wire `ChatPanel.tsx` and `AgentChatModal.tsx` to `/chat` — switch fetch URL, update event parsing from `assistant`/`result` to `text_delta`/`done`, progressive `setMessages` on each delta, remove session key management from frontend

---

#### Phase 99: Route Separation — Chat vs Task Dispatch

**Goal**: Make the architectural split between interactive chat (`/chat`) and background task dispatch (`/stream`) explicit and permanent. Audit all callers, add clear doc headers to both routes, remove any `/stream` fallback from frontend components.
**Depends on**: Phase 98
**Research**: Unlikely (internal audit + comments)
**Plans**: 1 plan

Plans:
- [ ] 99-01: Grep all `/stream` callers — move frontend callers (ChatPanel, AgentChatModal) to `/chat`; add doc header comments to `stream/route.ts` (task dispatch only) and `chat/route.ts` (interactive chat only); add explicit error handling in frontend instead of any `/stream` fallback

---

#### Phase 100: StreamingText Component

**Goal**: Create a `StreamingText` component with blinking cursor during stream, auto-hide cursor on completion. Memoize `MarkdownMessage` with custom comparator. Replace inline streaming display in ChatPanel and AgentChatModal. Add CSS keyframe animations using platform design tokens.
**Depends on**: Phase 98
**Research**: Unlikely (internal component using existing Tailwind + CSS vars)
**Plans**: 2 plans

Plans:
- [ ] 100-01: Create `src/components/StreamingText.tsx` — `memo` wrapper around `MarkdownMessage`, accepts `content` + `streaming` props, renders blinking cursor when streaming; wrap `MarkdownMessage` in `React.memo` with `(prev, next) => prev.content === next.content` comparator
- [ ] 100-02: Replace inline streaming divs in `ChatPanel.tsx` and `AgentChatModal.tsx` with `StreamingText`; add CSS animations to `src/forms.css` (`mission-control-cursor-blink`, `mission-control-text-appear` keyframes using `--mission-control-accent` token)

---

#### Phase 101: Performance Hardening

**Goal**: Close all edge cases: client disconnect aborts SDK stream and cleans up lock, 2-minute server-side timeout, 20k-char history budget to prevent context bloat, error events displayed in message bubble, 429 rate limit shown with retry hint.
**Depends on**: Phase 100
**Research**: Unlikely (internal hardening using existing patterns)
**Plans**: 2 plans

Plans:
- [ ] 101-01: Verify `ReadableStream.cancel()` calls `sdkStream.abort()` and cleans `agentLocks`; add 120s `setTimeout` that enqueues `{type:'error'}` and closes stream; add `X-Accel-Buffering: no` to `stream/route.ts` for consistency
- [ ] 101-02: Add 20k-char history trim in `chat/route.ts` (40-message DESC LIMIT, reverse, char-count filter); handle `evt.type === 'error'` in `ChatPanel.tsx` (set message status to error); catch 429 in SDK stream loop and emit structured `{type:'error', retryAfter}` event

---

## Progress (v10.0)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 98. SDK Chat Route | v10.0 | 0/3 | Not started | - |
| 99. Route Separation | v10.0 | 0/1 | Not started | - |
| 100. StreamingText Component | v10.0 | 0/2 | Not started | - |
| 101. Performance Hardening | v10.0 | 0/2 | Not started | - |
