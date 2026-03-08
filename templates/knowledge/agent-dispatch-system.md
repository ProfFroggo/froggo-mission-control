---
title: Agent Dispatch System
tags: [knowledge, dispatch, automation]
updated: 2026-03-08
---

# Agent Dispatch System

## Overview
When a task is created with `assignedTo` and `status=todo`, the platform automatically spawns a Claude Code CLI agent to work on it.

## How It Works

### 1. Task Created / Assigned
- Via Kanban UI, API, or another agent using `mcp__mission-control_db__task_create`
- If `assignedTo` is set and `status=todo`, dispatch fires automatically

### 2. Dispatcher Cron
- Runs every **30 seconds** on the server
- Finds all `todo` tasks with an assigned agent
- Dispatches each (with 5-minute cooldown per task to prevent duplication)
- Started via `app/api/health/route.ts` on server boot

### 3. Agent Spawn
```
claude --print --model claude-sonnet-4-6 --dangerously-skip-permissions <task-message>
```
- CWD: `~/mission-control/agents/{agentId}/` (agent's workspace)
- Detached process — server doesn't wait for it
- Logged to `task_activity` table

### 4. Agent Work Loop
1. Claim task: `task_update { status: "in-progress" }`
2. Write plan: `task_update { planningNotes: "..." }`
3. Create subtasks: `task_create { parentTaskId: "..." }`
4. Do work, log frequently: `task_add_activity { message: "..." }`
5. If blocked or needs human input: `task_update { status: "human-review" }`
6. When done: `task_update { status: "agent-review", progress: 100 }`

### 5. Review Gate
Before a task can stay in `agent-review`:
- ✅ `planningNotes` must be non-empty
- ✅ At least 1 subtask must exist
- ✅ `assignedTo` must be set
- ✅ `reviewerId` is auto-set to `clara`

Failure → task pushed back to `in-progress` with reason.

### 6. Clara Reviews
- Clara picks up `agent-review` tasks
- APPROVED → `done`
- CHANGES_REQUESTED → back to `in-progress` with specific feedback

## Key Files
- `src/lib/taskDispatcher.ts` — dispatch function
- `src/lib/taskDispatcherCron.ts` — 30s cron
- `src/lib/reviewGate.ts` — review validation
- `app/api/health/route.ts` — cron start on boot

## Related
- [[knowledge/task-lifecycle]]
- [[knowledge/mcp-tools]]
