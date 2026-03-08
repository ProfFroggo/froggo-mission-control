---
title: Task Lifecycle
tags: [knowledge, tasks, pipeline]
updated: 2026-03-08
---

# Task Lifecycle

## Pipeline

```
todo → internal-review → in-progress → agent-review → done
             ↕                              ↕
        human-review                  human-review
     (needs human input)         (external dependency)
```

**`blocked` status does not exist — use `human-review` instead.**

## States

| Status | Meaning |
|--------|---------|
| `todo` | Task created, needs a plan and subtasks assigned |
| `internal-review` | Clara quality gate BEFORE work starts: verifies plan, subtasks, agent assignment |
| `in-progress` | Agent actively working |
| `agent-review` | Clara quality gate AFTER work: verifies all planned work is complete and correct |
| `human-review` | Branches off at any stage when: (1) needs human input/approval, or (2) blocked by external dependency |
| `done` | Clara approved, work complete |

## Transitions

- **todo → internal-review**: Task created, plan drafted, subtasks assigned — ready for Clara pre-check
- **internal-review → in-progress**: Clara approves the plan; agent begins work
- **internal-review → human-review**: Clara flags missing plan, unclear scope, or needs human input
- **in-progress → agent-review**: Agent completes work, self-reviews, posts summary
- **in-progress → human-review**: Agent is blocked by external dependency or needs human decision
- **agent-review → done**: Clara approves — work is complete and correct
- **agent-review → in-progress**: Clara requests changes with specific feedback
- **human-review → todo**: Human resolves the blocker, restarts the pipeline
- **human-review → in-progress**: Human unblocks directly back to active work

## Rules

- **Skipping internal-review** (todo → in-progress direct) is blocked by MCP hook
- **Only Clara can move a task to `done`** — agents must move to `agent-review` and wait
- **Agents must post activity** on every meaningful decision via `task_add_activity`
- **P0/P1 tasks** always require Clara review in addition to the standard gate

## SLAs

| Priority | Time to in-progress | Time to done |
|----------|--------------------|----|
| P0 | < 4 hours | < 24 hours |
| P1 | < 24 hours | < 1 week |
| P2 | < 1 week | Best effort |
| P3 | Best effort | Best effort |

## Related
- [[knowledge/agent-dispatch-system]]
- [[knowledge/mcp-tools]]
