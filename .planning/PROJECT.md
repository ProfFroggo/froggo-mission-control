# Mission Control Agent Autonomy — Deep System Review & Fix Plan

## What This Is

A comprehensive overhaul of Mission Control's agent execution pipeline, memory system, and planning framework. The platform has 14 agents, a kanban task board, Clara review gates, cron scheduling, and MCP-based tool access — but the system isn't truly autonomous. Tasks get stuck, reviews fail silently, dispatch crashes, memory is fragmented, and agents don't use structured planning. This project makes everything work end-to-end without human intervention.

## Core Value

Tasks flow from creation to completion autonomously: `todo → Clara pre-review → in-progress (agent works) → review (Clara verifies) → done` — with self-healing at every failure point and agents that remember, learn, and plan.

## Requirements

### Validated

- ✓ 14 agents with SOUL.md configs in `.claude/agents/` — existing
- ✓ SQLite task board with kanban statuses — existing
- ✓ Clara pre-work review (internal-review gate) — existing
- ✓ Clara post-work review (review gate) — existing
- ✓ Task dispatcher with retry + backoff — existing
- ✓ Cron daemon checking schedule.json every 60s — existing
- ✓ MCP tools for DB access (11 tools) — existing
- ✓ Memory MCP server for vault access — existing
- ✓ Session persistence (resume sessions) — existing
- ✓ Cron jobs can create tasks (taskTemplate) — existing (just built)
- ✓ Knowledge ingest with Gemini AI — existing (just built)

### Active

#### Pipeline Autonomy (Critical)
- [ ] Re-dispatch agent after Clara post-review rejection with feedback
- [ ] Clara subprocess reliability (--dangerously-skip-permissions, no empty args)
- [ ] Dispatch subprocess reliability (same fixes)
- [ ] Failed dispatch → retry to todo (not dead-end human-review)
- [ ] Auto-advance todo tasks with agent → internal-review
- [ ] Review count only increments on actual decisions (not silent failures)
- [ ] Circuit breaker recovery (open circuits auto-close after cooldown)

#### Agent Memory System (Critical)
- [ ] Unify memory locations (currently 4+ scattered dirs)
- [ ] Per-agent memory: each agent gets structured memory dir
- [ ] Session checkpoints: save learnings after each task completion
- [ ] Memory injection: agents receive relevant memory at dispatch time
- [ ] Clean up duplicate `memory/memory/` nesting
- [ ] Agent pattern memory (Clara's review patterns → all agents)

#### GSD-Driven Agent Execution (Critical)
- [ ] Agents use GSD-style phases/milestones for projects and campaigns
- [ ] Multi-agent GSD: project roadmap with phase assignments to different agents
- [ ] Campaign execution uses structured planning (not ad-hoc task creation)
- [ ] Progress tracking per project: phases, milestones, completion %
- [ ] Agents can create/update their own subtasks and planning notes

#### Cron & Scheduling Reliability
- [ ] All cron jobs use taskTemplate (create tasks, not messages)
- [ ] Task recurrence uses original due date (no drift)
- [ ] Cron execution history in DB (not just JSON state)
- [ ] Scheduled content execution engine (tweets, emails)

#### Knowledge System
- [ ] Living knowledge base: daily Gemini review cron
- [ ] Auto-discover knowledge from tasks, meetings, agent notes
- [ ] Knowledge graph relationships between articles
- [ ] Knowledge sync: DB ↔ filesystem always in sync

### Out of Scope

- UI/UX polish — just completed 3 full passes, not revisiting
- New module development (finance, meetings) — focus on existing system
- External API integrations (Twitter posting, email sending) — setup wizard done, actual posting is separate
- Deployment/hosting — local development only for now
- Test suite creation — focus on making the system work first

## Context

### Current Architecture
- **Runtime**: Next.js 16 App Router + SQLite (better-sqlite3)
- **Agent execution**: Claude Code CLI spawned as child process with `--print --output-format stream-json`
- **Agent config**: SOUL.md files in `.claude/agents/{id}.md`
- **Memory vault**: `~/mission-control/memory/` (Obsidian-compatible)
- **Knowledge base**: `~/mission-control/memory/knowledge/` + SQLite `knowledge_base` table
- **Cron daemon**: `tools/cron-daemon.js` (Node.js, reads schedule.json)
- **MCP servers**: mission-control-db (11 tools), memory (3 tools), cron (3 tools)
- **Task pipeline**: todo → internal-review → in-progress → review → done

### Known Critical Bugs (Found Today)
1. **Clara subprocess fails silently**: Missing `--dangerously-skip-permissions` causes permission prompt hang → 3-min timeout → silent failure → count increments → human-review dead-end
2. **Empty --disallowedTools crash**: `loadDisallowedTools().join(',')` returns `""` → Claude CLI crashes with exit code 1
3. **No re-dispatch after rejection**: Clara rejects post-work review → task goes to in-progress → no agent re-spawned → task sits forever
4. **Review count pre-increment**: Count goes up before subprocess runs → silent failures count as reviews → false escalation
5. **Todo tasks not auto-advancing**: Tasks reset to todo via DB don't auto-move to internal-review
6. **Memory fragmentation**: 4+ memory locations, most agents have zero memory files, duplicate `memory/memory/` dir

### Agent Roster
mission-control, clara, coder, hr, inbox, designer, social-manager, growth-director, qa-engineer, security, senior-coder, chief, finance-manager, data-analyst (+ art, voice, writer as workers)

## Constraints

- **CLI-based agents**: Must use Claude Code CLI spawn architecture (not HTTP API/SDK)
- **No breaking changes**: All fixes must be backward compatible with existing task data
- **SQLite storage**: No migration to external databases
- **Self-healing**: Every failure mode must have an automatic recovery path — no dead ends

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Agents must use --dangerously-skip-permissions | Autonomous execution requires no interactive prompts | ✓ Good |
| Failed dispatch → todo (not human-review) | human-review is a dead end with no auto-recovery | ✓ Good |
| Review count only on actual decisions | Prevents false escalation from silent subprocess failures | ✓ Good |
| Cron jobs create tasks via taskTemplate | Tasks go through full pipeline instead of bypassing it via chat | ✓ Good |
| GSD planning for agent project execution | Structured phases/milestones beat ad-hoc task creation | — Pending |
| Unified memory at ~/mission-control/memory/agents/{id}/ | Single location per agent, structured dirs | — Pending |
| Re-dispatch with Clara feedback on rejection | Closes the loop so agents implement review changes | — Pending |

---
*Last updated: 2026-03-15 after initialization*
