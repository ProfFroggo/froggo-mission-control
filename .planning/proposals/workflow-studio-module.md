# GSD: Workflow Studio Module — Forked Sim-Powered Visual Workflow Builder

## Executive Summary

Fork [Sim Studio](https://github.com/simstudioai/sim) (Apache 2.0, 27k+ stars) into Mission Control as a fully customized **Workflow Studio** module. Strip cloud/enterprise features (~40-50% of codebase), restyle to MC's design system, and deeply integrate with agents, tasks, and MCP tools. Add a conversational "Automator" assistant agent that can build workflows from natural language. The existing linear Automation Step Builder stays as-is for simple automations — Workflow Studio is the advanced visual canvas for complex multi-step DAG workflows.

## Why Fork (Not Sidecar)

| Approach | Pros | Cons |
|----------|------|------|
| **Sidecar + iframe** | Easy setup, no code changes | No design system control, iframe UX quirks, two separate apps, postMessage hacks, double the infra |
| **Full fork** | Full design control, deep integration, single app, shared auth/DB bridge, customize anything | Higher initial effort, must maintain fork, merge upstream updates selectively |

**Decision: Full fork.** We want this to feel native, not embedded. Full control over the canvas, blocks, and execution engine. We can strip 40-50% of the code (cloud, billing, org management, enterprise SSO, marketing site) and reshape what remains.

## Architecture

```
froggo-mission-control/
├── app/                          ← existing MC Next.js app
│   ├── api/
│   │   ├── agents/               ← existing
│   │   ├── tasks/                ← existing
│   │   ├── workflows/            ← NEW: bridge to Sim executor
│   │   │   ├── route.ts          ← CRUD (list, create, update, delete)
│   │   │   ├── [id]/
│   │   │   │   ├── execute/      ← trigger DAG execution
│   │   │   │   ├── status/       ← poll execution state
│   │   │   │   └── deploy/       ← deploy/undeploy
│   │   │   └── hooks/            ← webhook callbacks from executions
│   │   └── ...
│   └── workflow-studio/          ← NEW: Sim canvas pages (App Router)
│       ├── page.tsx              ← workflow list / home
│       └── [id]/
│           └── page.tsx          ← canvas editor for single workflow
│
├── src/
│   ├── components/
│   │   ├── WorkflowStudioPanel.tsx  ← NEW: module shell (sidebar integration)
│   │   ├── AutomationsPanel.tsx     ← KEEP: existing step builder, untouched
│   │   └── ...
│   └── ...
│
├── workflow-studio/              ← NEW: forked Sim core (stripped)
│   ├── blocks/                   ← block definitions + registry (~60 kept)
│   ├── tools/                    ← tool implementations (~60 kept)
│   ├── executor/                 ← DAG execution engine (100% kept)
│   ├── serializer/               ← canvas ↔ executable transform
│   ├── connectors/               ← external service connectors
│   ├── triggers/                 ← webhook, cron, manual, API triggers
│   ├── stores/                   ← Zustand stores (workflow, execution, canvas)
│   ├── components/               ← canvas UI components (restyled)
│   │   ├── ui/                   ← base primitives (merged with MC's)
│   │   ├── canvas/               ← ReactFlow canvas + node renderers
│   │   ├── panel/                ← side panels (block config, logs)
│   │   └── copilot/              ← AI copilot chat UI
│   ├── lib/                      ← core libraries (execution, mcp, knowledge)
│   ├── hooks/                    ← React hooks
│   └── providers/                ← context providers
│
├── tools/
│   ├── mission-control-db-mcp/   ← existing — add workflow MCP tools
│   └── ...
└── ...
```

### What Gets Stripped (~40-50% of Sim)

| Category | Strip |
|----------|-------|
| **Routes** | Landing/marketing pages, blog, changelog, invite, chat/form embeds, templates marketplace, sitemap/robots, playground |
| **API Routes** | billing, organizations, superuser, telemetry, demo-requests, emails, stars, creators, usage tracking, notifications, mothership, chat embed, form embed, permission-groups, OAuth server |
| **Enterprise** | ALL of `ee/` — SSO, RBAC, whitelabeling |
| **DB Tables** | ~25 tables: org, billing, subscription, templates marketplace, SSO, audit, usage, mothership, OAuth server, notifications, waitlist |
| **Components** | analytics tracking, email templates, embeddable widgets |
| **Auth** | Replace better-auth with MC's auth (local = no auth, or simple token) |
| **Blocks/Tools** | ~140 niche SaaS blocks stripped (ashby, attio, brandfetch, clay, clerk, docusign, gong, etc.) — keep ~60 essential ones |
| **Triggers** | Strip niche (ashby, attio, calcom, calendly, circleback, fathom, fireflies, grain, lemlist, typeform, webflow) — keep ~15 essential |
| **Lib** | billing, blog, branding, analytics events, monitoring, mothership, notifications, OpenGraph gen, audit, OAuth server, permission-groups |

### What Gets Kept (Core Engine)

| Category | Keep |
|----------|------|
| **Executor** | 100% — DAG engine, orchestrators, handlers, HITL, variables, errors |
| **Canvas** | ReactFlow editor, node renderers, edge connectors, canvas-mode store |
| **Blocks** | ~60 core blocks: agent, function, condition, router, parallel, evaluator, guardrails, thinking, variables, workflow, response, triggers, + LLM (openai, google, anthropic), search (firecrawl, jina, tavily, exa, perplexity), messaging (gmail, slack, discord, telegram), dev (github, jira, linear, notion), DB (postgresql, mongodb, redis, supabase), cloud (s3, sqs), media (tts, stt, vision, image_gen), browser (stagehand, browser_use), knowledge, memory, table, mcp, a2a, file, http, webhook |
| **Tools** | Matching tool implementations for kept blocks |
| **Stores** | workflows, execution, canvas-mode, panel, terminal, variables, folders, logs, undo-redo, workflow-diff, table, chat |
| **Copilot** | AI copilot API + chat UI for workflow generation |
| **Serializer** | Canvas ↔ executable transformation |
| **Lib** | execution, workflows, webhooks, mcp, a2a, knowledge, copilot, credentials, environment, uploads, file-parsers, chunkers, tokenization, table, guardrails, search |
| **DB Tables** | ~30 tables: workflow, blocks, edges, execution, knowledge, credentials, mcp, a2a, tables, memory, schedules, webhooks, copilot, files, settings, api_key, custom_tools, skills |

## Domain Expertise

**Required**: ReactFlow, Zustand, DAG execution, Sim Studio internals, Drizzle ORM.
**Research-heavy**: Yes — Phase 1 is almost entirely research and stripping.

---

## Phases

### Phase 1: Fork & Strip — Clean Lean Codebase
**Goal**: Fork Sim, strip cloud/enterprise bloat, get the canvas running standalone.
**Depends on**: Nothing
**Research**: Heavy — understanding Sim's dependency graph, what's safe to strip

**Plans**:
- 01-01: Fork `simstudioai/sim` → `froggo-mission-control/workflow-studio/`
  - Clone just `apps/sim/` (not docs, docker, helm, packages — we extract what we need)
  - Copy `packages/db/` for schema reference
  - Copy `packages/logger/` (lightweight, useful)
- 01-02: Strip Phase — remove cloud/enterprise features
  - Delete `ee/` entirely (SSO, RBAC, whitelabeling)
  - Delete marketing routes: `(landing)/`, `(home)/`, blog, changelog, invite, templates marketplace, chat embed, form embed, playground, `.well-known/`, sitemap, robots
  - Delete API routes: billing, organizations, superuser, telemetry, demo-requests, emails, stars, creators, usage, notifications, mothership, chat, form, permission-groups, OAuth server
  - Delete components: analytics/, emails/, emcn/
  - Delete libs: billing, blog, branding, events, monitoring, mothership, notifications, og, audit, OAuth server, permission-groups
  - Delete DB tables: org, billing, subscription, templates, SSO, audit, usage, mothership, OAuth, waitlist, notifications
- 01-03: Strip niche blocks/tools (~140 → ~60)
  - Keep: core logic, LLM, search, messaging, dev, DB, cloud, media, browser, knowledge, mcp
  - Remove: ashby, attio, brandfetch, clay, clerk, docusign, gong, greenhouse, greptile, hex, incidentio, infisical, kalshi, ketch, langsmith, lemlist, luma, revenuecat, rippling, servicenow, similarweb, wealthbox, workday, zendesk, etc.
  - Update block registry + tool registry to remove deleted entries
- 01-04: Auth replacement
  - Set `DISABLE_AUTH=true` for local mode
  - Gut better-auth routes, replace with simple pass-through (MC is single-user local)
  - Remove user/session/account/verification tables from schema
- 01-05: Database setup
  - Sim uses PostgreSQL + pgvector — set up on port 5433 (MC's SQLite stays separate)
  - Run Drizzle migrations for stripped schema
  - Verify canvas loads with clean DB
- 01-06: Verify stripped build
  - `bun install` + `bun run build` succeeds
  - Canvas editor loads, blocks draggable, connections work
  - Executor runs a simple 2-node workflow

**Deliverable**: Clean ~60% smaller Sim fork that builds and runs.

---

### Phase 2: Restyle — Mission Control Design System
**Goal**: Canvas looks and feels like a native Mission Control module.
**Depends on**: Phase 1

**Plans**:
- 02-01: Replace Sim's color palette with MC CSS variables
  - Map Sim's shadcn theme tokens → `--mission-control-*` variables
  - Dark/light mode via MC's theme system (not Sim's)
  - Accent color from MC's color picker
- 02-02: Restyle canvas chrome
  - Toolbar, sidebar, panels → MC's surface/border/text tokens
  - Node cards → MC styling (rounded corners, border colors, shadows)
  - Block config panels → MC form styles (forms.css)
- 02-03: Replace Sim's sidebar/nav with MC integration
  - Remove Sim's own sidebar (workspace switcher, nav)
  - Canvas is full-width inside MC's module shell
  - Workflow list lives in MC's sidebar or a left panel
- 02-04: Typography and icons
  - Match MC's font stack
  - Lucide icons (already shared)
  - No Sim branding (logo, footer, etc.)
- 02-05: Loading states and transitions
  - Match MC's existing patterns (skeleton loaders, fade-in animations)

**Deliverable**: Canvas indistinguishable from the rest of Mission Control.

---

### Phase 3: Integration — MC Routes & Module Shell
**Goal**: Workflow Studio is accessible from MC's sidebar as a first-class module.
**Depends on**: Phase 2

**Plans**:
- 03-01: Create `WorkflowStudioPanel.tsx` — module shell component
  - Left panel: workflow list (name, status, last run, deploy state)
  - Main area: canvas editor (rendered from forked Sim components)
  - Right panel: execution log / block config (context-dependent)
  - Top bar: workflow name, deploy toggle, run button, copilot toggle
- 03-02: Add "Workflows" entry to Sidebar.tsx
  - Lucide `Workflow` icon
  - Between existing modules (e.g., after Automations or after Projects)
- 03-03: Create bridge API routes
  - `app/api/workflows/route.ts` — CRUD using Drizzle against Sim's DB
  - `app/api/workflows/[id]/execute/route.ts` — invoke DAG executor
  - `app/api/workflows/[id]/status/route.ts` — execution state
  - `app/api/workflows/[id]/deploy/route.ts` — toggle deployment
  - `app/api/workflows/hooks/route.ts` — execution completion callbacks
- 03-04: Wire ReactFlow canvas into module shell
  - Import canvas components from `workflow-studio/components/canvas/`
  - Provide stores (workflow, execution, canvas-mode) via Zustand
  - Connect to bridge API for persistence
- 03-05: Workflow CRUD UI
  - Create workflow → name + optional template → opens canvas
  - Delete workflow (with confirmation)
  - Duplicate workflow
  - Folder organization

**Deliverable**: Users can create, edit, and manage workflows from MC's sidebar.

---

### Phase 4: Execution Pipeline — Run Workflows From MC
**Goal**: Workflows execute through Sim's DAG engine, with results visible in MC.
**Depends on**: Phase 3

**Plans**:
- 04-01: Wire "Run" button to DAG executor
  - Serialize canvas → executable format (via serializer)
  - Pass to `DAGExecutor.execute()` with input variables
  - Stream execution progress to UI (block-by-block status)
- 04-02: Execution log UI
  - Show DAG execution trace (which blocks ran, inputs/outputs, timing)
  - Collapsible block results (like main chat's tool groups)
  - Error highlighting with block-level detail
- 04-03: Schedule/trigger support
  - Cron triggers → integrate with MC's cron daemon or use Sim's scheduler
  - Webhook triggers → generate webhook URL, register in MC
  - Manual trigger → "Run" button
  - API trigger → expose `/api/v1/workflows/{id}/execute` for external calls
- 04-04: HITL integration
  - Sim's `human_in_the_loop` block → MC's `approval_create` MCP tool
  - Paused executions show in MC's approval queue
  - Approve/reject → resumes workflow execution
- 04-05: Execution history
  - Store run history in Sim's execution tables
  - Dashboard widget: recent runs, success/failure rates
  - Filter by workflow, date range, status

**Deliverable**: Full workflow execution with live progress, HITL, scheduling, and history.

---

### Phase 5: Agent Integration — MC Agents as Workflow Blocks
**Goal**: Mission Control agents are callable from workflows, and agents can trigger workflows.
**Depends on**: Phase 3

**Plans**:
- 05-01: Custom block: `mission_control_agent`
  - Config: select agent, prompt template, model, timeout
  - Execution: calls MC's `/api/agents/{id}/stream`, collects response
  - Output: agent response text, artifacts, tool calls made
- 05-02: Custom block: `mission_control_task`
  - Config: title template, description, assignTo, priority, tags
  - Execution: creates task via `/api/tasks`, optionally waits for completion
  - Output: task ID, final status, agent output
- 05-03: Custom block: `mission_control_mcp`
  - Config: pick any MCP tool from registry, fill args
  - Execution: calls MCP tool directly
  - Output: tool result
- 05-04: Register blocks in Sim's block registry + create tool implementations
- 05-05: Add MCP tools for agents to call workflows
  - `workflow_list` — list available workflows
  - `workflow_execute` — trigger a workflow with input
  - `workflow_status` — check execution status
  - `workflow_deploy` — deploy/undeploy a workflow
  - Add to `mission-control-db-mcp/src/index.ts`
- 05-06: Bidirectional: workflow completion → task activity
  - When a workflow finishes, post activity to any linked task
  - When an agent completes a task that was triggered by a workflow, notify the workflow

**Deliverable**: Agents and workflows are fully interoperable — workflows call agents, agents call workflows.

---

### Phase 6: Automator Agent — Conversational Workflow Builder
**Goal**: A dedicated agent that builds and manages workflows through natural language.
**Depends on**: Phase 5

**Plans**:
- 06-01: Create Automator agent
  - `~/mission-control/agents/automator/SOUL.md` — workflow builder personality
  - Knowledge of all available blocks, their configs, and common patterns
  - Trust tier: Worker (can create workflows, deploy, execute)
- 06-02: Conversational build flow
  - User describes what they want → Automator creates workflow via MCP tools
  - Step-by-step confirmation: "I'll add a Gmail trigger → condition block → Slack notification. Sound good?"
  - User can say "actually change the condition to check for priority" → Automator modifies
- 06-03: Integrate Sim's Copilot API (if we keep it)
  - Use copilot's node generation from natural language
  - Or build our own using Claude + block schema knowledge
- 06-04: "Teach mode" — watch and learn
  - User builds a workflow manually on canvas
  - Automator observes and can suggest improvements
  - "I notice you're checking email then posting to Slack — want me to add error handling?"
- 06-05: Workflow templates from conversation
  - "Build me a competitor monitoring workflow"
  - Automator uses skill knowledge to generate appropriate DAG
  - Deploys with schedule, tests with dry run
- 06-06: Workflow debugging assistance
  - "My workflow failed on step 3" → Automator reads execution log, diagnoses issue
  - Can modify blocks and re-run

**Deliverable**: Full conversational workflow builder — describe what you want, Automator builds it.

---

### Phase 7: Templates & Polish
**Goal**: Pre-built templates, UX polish, documentation.
**Depends on**: Phase 4, Phase 5, Phase 6

**Plans**:
- 07-01: Template library (stored as workflow JSON)
  - "Daily Standup Report" — query tasks → summarize → post to room
  - "Competitor Monitor" — scrape sites → diff changes → alert
  - "Content Pipeline" — research → draft → review → schedule
  - "Incident Response" — detect error → create P0 → page human → remediate
  - "Data Sync" — fetch from API → transform → write to DB
- 07-02: One-click template deploy
  - Gallery UI in Workflow Studio
  - Preview template DAG before deploying
  - Customize variables (URLs, schedules, agent IDs)
- 07-03: Import/export
  - Export workflow as JSON
  - Import workflow from JSON
  - Share between MC instances
- 07-04: Keyboard shortcuts
  - Match MC's existing shortcuts where applicable
  - Canvas-specific: zoom, pan, select all, delete, undo/redo
- 07-05: Performance optimization
  - Lazy load canvas components
  - Virtualize large workflow lists
  - Cache execution results
- 07-06: Documentation
  - Workflow Studio skill in `.claude/skills/workflow-builder/SKILL.md`
  - Block reference guide for Automator agent
  - User-facing help panel

**Deliverable**: Polished, documented, production-ready workflow module with templates.

---

## Technical Requirements

| Component | Requirement |
|-----------|-------------|
| **PostgreSQL** | New instance on port 5433 (Sim's Drizzle schema, pgvector for knowledge/RAG) |
| **Bun** | v1.2.13+ (Sim's runtime — or use Node 20+ with minor adjustments) |
| **ReactFlow** | Added to MC's dependencies (Sim's canvas library) |
| **Drizzle ORM** | Added to MC's dependencies (Sim's DB layer) |
| **Disk** | ~200MB for stripped Sim + dependencies |
| **Memory** | Shared process — canvas is client-side, executor is server-side |

## Existing Automation Builder — No Changes

The current `AutomationsPanel.tsx` + `AutomationBuilderModal.tsx` + `AutomationStepBuilder.tsx` stay exactly as-is. They serve a different use case:

| Feature | Automation Step Builder | Workflow Studio |
|---------|----------------------|-----------------|
| **Complexity** | Simple linear sequences | Complex DAGs with branching, loops, parallelism |
| **Interface** | Step-by-step wizard | Visual canvas with drag-and-drop |
| **Triggers** | Cron schedules | Cron, webhook, API, chat, manual, form |
| **Execution** | Cron daemon + agent dispatch | DAG executor with variable passing |
| **Use case** | "Run this agent every morning" | "When email arrives, classify it, route to right agent, notify in Slack, update task board" |

They coexist — simple automations use the step builder, complex workflows use the studio.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Fork maintenance burden | Pin to Sim release tag, cherry-pick important upstream fixes only |
| ReactFlow + Zustand conflicts with MC's existing setup | Sim's stores are namespaced, ReactFlow is isolated to canvas |
| PostgreSQL adds infrastructure complexity | Only needed for workflow data — can use same PG instance as other services with separate schema |
| Large initial effort (Phase 1 stripping) | Well-documented strip list above, registry patterns make deletion mechanical |
| Bun vs Node runtime differences | Sim works on Node 20+ too, Bun is optional optimization |

## Success Metrics

- Canvas loads in < 2s with Mission Control's design system
- Users can build a 5-node workflow visually in < 3 minutes
- Automator agent can create + deploy a workflow from conversation in < 5 minutes
- Workflow executions are visible in task board with block-level detail
- MC agents are callable as workflow blocks
- Zero regression on existing automation step builder
- 5+ production-ready templates within 2 weeks of launch
