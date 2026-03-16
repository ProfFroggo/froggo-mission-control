# Roadmap: Mission Control Agent Autonomy

## Overview

Transform Mission Control from a semi-autonomous platform where tasks constantly get stuck into a fully self-healing agent execution system. Work progresses from critical pipeline fixes (tasks must flow) through memory and planning infrastructure (agents must remember and plan) to automated knowledge management (the system must learn).

## Domain Expertise

None — internal system architecture, no external domain skills needed.

## Phases

- [ ] **Phase 1: Pipeline Critical Fix** — Re-dispatch after Clara rejection, close the autonomous loop
- [ ] **Phase 2: Clara Review Hardening** — Bulletproof pre-work and post-work review subprocess
- [x] **Phase 3: Task Dispatcher Hardening** — Reliable agent spawn, circuit breaker recovery
- [ ] **Phase 4: Auto-advance & Recovery** — Close every gap in the task pipeline
- [ ] **Phase 5: Agent Memory Unification** — Single structured memory dir per agent
- [ ] **Phase 6: Memory Injection & Checkpoints** — Agents receive relevant memory at dispatch, save learnings after completion
- [ ] **Phase 7: GSD Agent Planning Framework** — Structured project/campaign execution with phases and milestones
- [ ] **Phase 8: Cron & Scheduling Overhaul** — Reliable scheduling, execution history, content execution
- [ ] **Phase 9: Knowledge System Automation** — Living, self-updating knowledge base via Gemini cron
- [ ] **Phase 10: Integration Validation** — End-to-end pipeline test, verify all flows work autonomously

## Phase Details

### Phase 1: Pipeline Critical Fix
**Goal**: When Clara rejects a post-work review, the agent is automatically re-dispatched with Clara's feedback. This is THE critical missing piece — without it, rejected tasks sit in in-progress forever.
**Depends on**: Nothing (first phase, most urgent)
**Research**: Unlikely (internal code, patterns established)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Add re-dispatch on Clara post-review rejection (claraReviewCron.ts)
- [ ] 01-02: Add re-dispatch on stuck in-progress detection (task watcher)

### Phase 2: Clara Review Hardening
**Goal**: Clara's review subprocess never fails silently. Every spawn produces a decision (approve/reject) or logs a clear error. No more false escalations.
**Depends on**: Phase 1
**Research**: Unlikely (CLI args, spawn patterns already known)
**Plans**: 3 plans

Plans:
- [ ] 02-01: Audit and fix all spawn args (--dangerously-skip-permissions, empty args, env stripping)
- [ ] 02-02: Add stdout/stderr capture + structured error logging for every Clara subprocess
- [ ] 02-03: Add Clara review timeout recovery (process killed → clear state, retry next cycle)

### Phase 3: Task Dispatcher Hardening
**Goal**: Agent dispatch never silently fails. Every spawn either succeeds or produces actionable error. Failed dispatches self-heal.
**Depends on**: Phase 2 (Clara fixes inform dispatcher fixes)
**Research**: Unlikely (same patterns as Phase 2)
**Plans**: 3 plans

Plans:
- [ ] 03-01: Audit dispatcher spawn args + env (same fixes as Clara)
- [ ] 03-02: Circuit breaker auto-recovery (open circuits close after cooldown period)
- [ ] 03-03: Dispatch failure → todo (not human-review), with exponential backoff on re-attempts

### Phase 4: Auto-advance & Recovery
**Goal**: Every task status has a clear next step. No dead ends. Tasks auto-advance through the pipeline.
**Depends on**: Phases 1-3
**Research**: Unlikely (internal logic)
**Plans**: 3 plans

Plans:
- [ ] 04-01: Auto-advance todo→internal-review when agent assigned (in review cron, not just POST)
- [ ] 04-02: Stuck task detection: in-progress >4h with no activity → re-dispatch or escalate
- [ ] 04-03: human-review recovery: after human takes action, task returns to pipeline automatically

### Phase 5: Agent Memory Unification
**Goal**: Every agent has a single, structured memory directory. Clean up fragmented locations. Establish the memory schema.
**Depends on**: Nothing (independent of pipeline fixes)
**Research**: Unlikely (filesystem organization)
**Plans**: 3 plans

Plans:
- [ ] 05-01: Audit all memory locations, design unified schema (~/mission-control/memory/agents/{id}/)
- [ ] 05-02: Migrate existing memory files, clean up duplicates (memory/memory/, scattered checkpoints)
- [ ] 05-03: Create memory dir structure for all 14 agents with README templates

### Phase 6: Memory Injection & Checkpoints
**Goal**: Agents receive relevant memory when dispatched and save learnings after task completion. Memory accumulates over time.
**Depends on**: Phase 5
**Research**: Likely (need to investigate best patterns for context injection into Claude CLI)
**Research topics**: How much context can be injected via --system-prompt, memory size limits, summarization strategies
**Plans**: 4 plans

Plans:
- [ ] 06-01: Memory injection at dispatch time (load agent memory → inject into system prompt)
- [ ] 06-02: Session checkpoint on task completion (extract key learnings → save to memory)
- [ ] 06-03: Memory summarization (keep memory files under size limits, compress old entries)
- [ ] 06-04: Clara pattern memory (review outcomes feed back into agent-specific improvement notes)

### Phase 7: GSD Agent Planning Framework
**Goal**: Agents use structured GSD-style planning for projects and campaigns. Multi-agent projects have roadmaps with phase assignments.
**Depends on**: Phase 4 (pipeline must be reliable first)
**Research**: Likely (need to design the multi-agent GSD protocol)
**Research topics**: How agents create/update phases, how to assign phases to different agents, progress tracking API
**Plans**: 5 plans

Plans:
- [ ] 07-01: Project planning data model (phases, milestones tables in SQLite)
- [ ] 07-02: MCP tools for agents to create/update project plans
- [ ] 07-03: Agent planning prompt (system instruction for GSD-style thinking)
- [ ] 07-04: Multi-agent phase assignment (route phases to specialist agents)
- [ ] 07-05: Campaign workspace integration (connect GSD plans to campaign UI)

### Phase 8: Cron & Scheduling Overhaul
**Goal**: Reliable scheduling with execution history, all cron jobs create tasks, content scheduling has execution engine.
**Depends on**: Phase 4 (pipeline must be reliable for task creation)
**Research**: Unlikely (existing patterns, just needs completion)
**Plans**: 3 plans

Plans:
- [ ] 08-01: Migrate cron storage from JSON to SQLite (execution history table)
- [ ] 08-02: Convert remaining message-mode cron jobs to taskTemplate
- [ ] 08-03: Content scheduling execution engine (check scheduled_items, fire at time)

### Phase 9: Knowledge System Automation
**Goal**: Knowledge base is living — daily Gemini review discovers new knowledge from tasks, meetings, agent notes. Articles stay current.
**Depends on**: Phase 6 (memory system must exist for knowledge to reference)
**Research**: Likely (Gemini API for knowledge synthesis)
**Research topics**: Gemini batch processing, knowledge graph generation, article freshness scoring
**Plans**: 4 plans

Plans:
- [ ] 09-01: Daily knowledge review cron (Gemini scans tasks, activity, agent notes for new knowledge)
- [ ] 09-02: Auto-create knowledge articles from discovered insights
- [ ] 09-03: Knowledge freshness scoring (flag stale articles for review/update)
- [ ] 09-04: Knowledge graph: auto-link related articles, visualize dependencies

### Phase 10: Integration Validation
**Goal**: End-to-end verification that the full pipeline works autonomously. Create test tasks, watch them flow through every stage.
**Depends on**: All previous phases
**Research**: Unlikely (testing existing system)
**Plans**: 2 plans

Plans:
- [ ] 10-01: Pipeline smoke test (create task → Clara approves → agent executes → Clara verifies → done)
- [ ] 10-02: Failure recovery test (kill agent mid-task, verify self-healing activates)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Pipeline Critical Fix | 0/2 | Not started | - |
| 2. Clara Review Hardening | 0/3 | Not started | - |
| 3. Task Dispatcher Hardening | 1/1 | Complete | 2026-03-15 |
| 4. Auto-advance & Recovery | 0/3 | Not started | - |
| 5. Agent Memory Unification | 0/3 | Not started | - |
| 6. Memory Injection & Checkpoints | 0/4 | Not started | - |
| 7. GSD Agent Planning Framework | 0/5 | Not started | - |
| 8. Cron & Scheduling Overhaul | 0/3 | Not started | - |
| 9. Knowledge System Automation | 0/4 | Not started | - |
| 10. Integration Validation | 0/2 | Not started | - |
