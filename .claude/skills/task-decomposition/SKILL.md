---
name: task-decomposition
description: How to break down work into tasks for the Mission Control task board
---

# Task Decomposition

## Principles
1. Each task should be completable in < 4 hours
2. One agent per task (clear ownership)
3. Explicit acceptance criteria
4. Dependencies identified upfront

## Task Format
- **Title**: Verb + noun ("Implement dark mode toggle")
- **Priority**: P0 (critical) P1 (high) P2 (medium) P3 (low)
- **Labels**: feature, bug, docs, infra, research
- **Assigned**: Specific agent ID
- **Acceptance criteria**: Bulleted list in description

## Task Lifecycle (Mission Control)
Tasks move through these states on the task board:
```
blocked → todo → in-progress → internal-review → review → human-review → done
```
- `blocked`: waiting on dependency or decision
- `todo`: ready to start, all dependencies met
- `in-progress`: actively being worked
- `internal-review`: agent self-review or peer agent check
- `review`: awaiting Clara (P0/P1) or senior-coder review
- `human-review`: requires human sign-off before completing
- `done`: accepted, output saved to library

## Decomposition Steps
1. Identify the end state (what does done look like?)
2. List all work items needed to reach that state
3. Check dependencies between items
4. Assign priorities
5. Create tasks in smallest committable units
6. Post tasks to the Mission Control task board via MCP tool
7. Link output artifacts to `~/mission-control/library/` in task description
