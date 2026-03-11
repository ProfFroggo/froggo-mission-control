---
name: task-decomposition
description: How to break down work into tasks for the Mission Control task board
---

# Task Decomposition

## Core principle: define constraints, not instructions

A well-written task tells an agent **what done looks like**, not **how to get there**.

The agent has full freedom in HOW to reach the completion condition. The completion
condition is what gets enforced — not the implementation steps.

> "Work until all tests pass" outperforms "do A, then B, then C"

This is the difference between a constraint and a checklist. Checklists can be
completed without achieving the goal. Constraints cannot be faked.

---

## Decomposition principles

1. Each task completable in < 4 hours
2. One agent per task — clear ownership
3. **Each subtask has exactly one measurable completion condition**
4. Dependencies identified upfront
5. The HOW is left to the agent — only specify WHAT and WHEN DONE

---

## Task format

- **Title**: Verb + noun ("Implement dark mode toggle")
- **Priority**: P0 (critical) P1 (high) P2 (medium) P3 (low)
- **Labels**: feature, bug, docs, infra, research
- **Assigned**: Specific agent ID
- **Description**: Context + acceptance criteria (the constraints)

### Acceptance criteria format

Write acceptance criteria as verifiable conditions, not steps:

```
✓ `npx tsc --noEmit` exits 0
✓ `npm run build` succeeds
✓ `npm test` passes (no regressions)
✓ The toggle persists across page reload
✓ Works in both light and dark system preference
```

**NOT** this:
```
- Add a toggle button to the header
- Connect to the theme store
- Save preference to localStorage
```

The first is a constraint. The second is a recipe. Agents follow recipes mechanically
and stop when the list ends, even if the goal isn't met.

---

## Subtask structure

Subtasks carve the work into independently verifiable slices. Each subtask gets:

- A clear scope (what part of the goal it owns)
- A single completion condition (the constraint the agent works toward)
- Freedom in approach (no step-by-step instructions unless absolutely required)

### Example — good subtask decomposition

Parent task: "Add user avatar upload to profile page"

```
Subtask 1: DB + API layer
Assigned: coder
Completion condition: POST /api/profile/avatar accepts multipart/form-data,
  stores in ~/mission-control/library/avatars/, returns {url}. API tests pass.

Subtask 2: UI component
Assigned: coder
Completion condition: AvatarUpload component renders, accepts drag-drop and
  click-to-browse, shows preview, calls the API. Vitest snapshot passes.

Subtask 3: Integration + E2E
Assigned: qa-engineer
Completion condition: Playwright test — upload an image, reload, verify it
  persists. Test file committed to tests/e2e/. All E2E pass.
```

### Example — bad subtask decomposition

```
Subtask 1: Add multer middleware
Subtask 2: Write the route handler
Subtask 3: Add the input element
Subtask 4: Wire onChange handler
```

These are implementation steps, not subtasks. They give the agent no freedom
and no way to know when it's actually done.

---

## Task lifecycle

```
todo → internal-review → in-progress → agent-review → done
              ↕                              ↕
         human-review                  human-review
      (needs human input)          (external dependency)
```

- `todo` — created, needs plan + subtasks
- `internal-review` — Clara checks: plan quality, subtask breakdown, agent assignment,
  acceptance criteria are actual constraints not steps
- `in-progress` — agent working, freedom in approach
- `agent-review` — Clara checks: all completion conditions verified, not just attempted
- `human-review` — needs human input OR external dependency
- `done` — Clara approved

---

## Decomposition steps

1. Define the end state as a set of verifiable conditions
2. Split the work into independent slices that each have a clear completion condition
3. Assign one agent per slice
4. Check dependencies between slices
5. Create tasks via MCP: `mcp__mission-control_db__task_create`
6. Create subtasks via MCP: `mcp__mission-control_db__subtask_create`
7. Link output artifacts to `~/mission-control/library/` in task description

---

## Clara's Gate 1 checklist (internal-review)

Before approving a task to `in-progress`, verify:
- [ ] Acceptance criteria are constraints (verifiable conditions), not steps
- [ ] Each subtask has exactly one completion condition
- [ ] Subtask assignment is correct (right agent for the scope)
- [ ] Dependencies between subtasks are explicit
- [ ] Size is right — no subtask > 2hr, no task > 4hr
