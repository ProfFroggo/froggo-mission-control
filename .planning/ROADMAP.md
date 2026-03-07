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
- 🚧 **v6.0 Security Hardening** — Phases 50–57 (in progress)

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
| 50. Agent ID Validation | v6.0 | 0/1 | Not started | - |
| 51. Path Traversal — Library | v6.0 | 0/1 | Not started | - |
| 52. Command Injection — Spawn | v6.0 | 0/1 | Not started | - |
| 53. Path Traversal — Soul Route | v6.0 | 0/1 | Not started | - |
| 54. Gemini Key Server-Side | v6.0 | 0/1 | Not started | - |
| 55. CSP & Security Headers | v6.0 | 0/1 | Not started | - |
| 56. Input Sanitization Sweep | v6.0 | 0/1 | Not started | - |
| 57. Security E2E Verification | v6.0 | 0/1 | Not started | - |

---

### 🚧 v6.0 Security Hardening (In Progress)

**Milestone Goal:** Eliminate all critical and high security findings from the platform audit — command injection, path traversal, credential exposure, and input validation gaps.

#### Phase 50: agent-id-validation

**Goal**: Create a shared `validateAgentId()` utility that enforces `/^[a-z0-9][a-z0-9-_]*$/` and apply it to every route that uses agent ID in file path construction: `[id]/stream`, `[id]/spawn`, `[id]/soul`, `[id]/avatar`, `[id]/config`, `[id]/session`, `[id]/kill`, `[id]/status`, `[id]/models`, `hire`. Return 400 if validation fails.
**Depends on**: Phase 49
**Research**: Unlikely (internal validation pattern)
**Plans**: 1 plan

Plans:
- [ ] 50-01: TBD (run /gsd:plan-phase 50 to break down)

#### Phase 51: path-traversal-library

**Goal**: Fix the path traversal vulnerability in `/api/library/route.ts` `view` action — after building `candidate = path.join(ENV.LIBRARY_PATH, decoded)`, verify `candidate.startsWith(ENV.LIBRARY_PATH + path.sep)` before reading. Return 403 if outside boundary. Apply the same check to any other route that builds file paths from user input.
**Depends on**: Phase 50
**Research**: Unlikely (standard path containment check)
**Plans**: 1 plan

Plans:
- [ ] 51-01: TBD

#### Phase 52: command-injection-spawn

**Goal**: Fix command injection in `/api/agents/[id]/spawn/route.ts:73` — replace `execSync(\`bash "${scriptPath}" "${id}"\`)` with `spawnSync('bash', [scriptPath, id])` so the id is passed as a literal argument, never interpolated into a shell string. Agent ID already validated by Phase 50 so double-protected.
**Depends on**: Phase 50
**Research**: Unlikely (Node.js child_process pattern)
**Plans**: 1 plan

Plans:
- [ ] 52-01: TBD

#### Phase 53: path-traversal-soul-route

**Goal**: Fix two issues in `/api/agents/[id]/soul/route.ts`: (1) remove hardcoded `/Users/kevin.macarthur/git/mission-control-nextjs` path — replace with `process.cwd()` or `join(homedir(), 'git', 'mission-control-nextjs')`; (2) the id-in-path risk is covered by Phase 50's validation, but add an explicit `startsWith(AGENTS_DIR)` check after path construction as defence-in-depth.
**Depends on**: Phase 50
**Research**: Unlikely (internal path fix)
**Plans**: 1 plan

Plans:
- [ ] 53-01: TBD

#### Phase 54: gemini-key-server-side

**Goal**: Stop sending the Gemini API key to the browser. Add `GET /api/settings/gemini-key` route that reads from the DB server-side and returns the key only to authenticated server requests. Update `VoiceChatPanel`, `MeetingsPanel`, `MeetingScribe`, `MeetingTranscriptionPanel`, `TeamVoiceMeeting`, `MeetingTranscribe`, and `QuickActions` to fetch the key via this API route at call time instead of reading from localStorage. The key stored in the DB settings table (already exists) is the canonical source — remove `localStorage` as a key store.
**Depends on**: Phase 53
**Research**: Unlikely (internal API proxy pattern)
**Plans**: 1 plan

Plans:
- [ ] 54-01: TBD

#### Phase 55: csp-security-headers

**Goal**: Add security response headers to all routes via Next.js middleware or `next.config.js` `headers()` config: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block`. Add a basic `Content-Security-Policy` that allows `'self'` plus Gemini/Google API origins needed for voice. These headers are free hardening for a web app.
**Depends on**: Phase 53
**Research**: Unlikely (standard Next.js header config)
**Plans**: 1 plan

Plans:
- [ ] 55-01: TBD

#### Phase 56: input-sanitization-sweep

**Goal**: Audit all remaining user-supplied string inputs that touch the DB or filesystem: (1) add length limits on task title/description (500/5000 chars), agent name (100 chars), library filename (255 chars); (2) ensure no raw string concatenation into SQL queries (currently clean — confirm via grep); (3) sanitize catalog agent/module IDs on install using same `validateAgentId()` from Phase 50; (4) add length cap on personality/soul content written to filesystem (50KB max).
**Depends on**: Phase 55
**Research**: Unlikely (input validation patterns)
**Plans**: 1 plan

Plans:
- [ ] 56-01: TBD

#### Phase 57: security-e2e-verification

**Goal**: Extend `tools/e2e-smoke-test.sh` with security regression tests: (1) send `../../../etc/passwd` as agent ID → expect 400; (2) send base64(`../../../etc/passwd`) to library view → expect 403/404 not file contents; (3) verify Gemini key endpoint returns key (server-side) but key does NOT appear in any JS bundle or client HTML; (4) send shell-special-char agent ID to spawn → expect 400; (5) confirm all security headers present on any route response.
**Depends on**: Phase 56
**Research**: Unlikely (bash test extensions)
**Plans**: 1 plan

Plans:
- [ ] 57-01: TBD
