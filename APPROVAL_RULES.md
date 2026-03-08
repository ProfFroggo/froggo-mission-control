# Approval Rules — Mission Control Platform

Agents MUST use `approval_create` MCP tool for any action in Tier 2 or higher.
The approval hook (`tools/hooks/approval-hook.js`) enforces these tiers automatically.

## ⚠️ Task Creation Standards — MANDATORY (enforced by MCP)

### Task Lifecycle
```
todo → internal-review → in-progress → review → human-review (if needed) → done
                                              ↘ done (if no human approval needed)
       ↑ quality gate        ↑ agent works   ↑ Clara checks completion
```

**Stage definitions:**
- **todo**: task created, agent setting it up (add planning, subtasks, assign agent)
- **internal-review** ("Ready to Start"): quality gate — Clara verifies everything is in place before work begins
- **in-progress**: assigned agent is actively working, spawning sub-agents for subtasks
- **review** (Agent Review): Clara verifies ALL planned work was completed; sends back to in-progress with notes if incomplete
- **human-review**: required for external actions, content approval, permissions, irreversible actions, OR if task is blocked and needs a human to unblock it
- **done**: complete

**`blocked` status no longer exists.** If a task is blocked, move it to `human-review` with a clear description of what is blocking it.

### Mandatory requirements before moving to `internal-review`:
1. **`planningNotes` required** — full plan, approach, steps, context (min 20 chars). Enforced on `task_create` AND `todo → internal-review`.
2. **Clara is always reviewer** — `reviewerId` is hardcoded to `clara`. Do not override.
3. **Minimum 2 subtasks** — use `subtask_create` to add at least 2 subtasks.
4. **Agent must be assigned** — `assignedTo` must be set.

### Correct agent workflow:
```
1. task_create (planningNotes filled)       ← blocked if planningNotes missing
2. subtask_create × 2+                      ← break work into steps
3. task_update assignedTo=<agent>           ← assign the worker
4. task_update status=internal-review       ← blocked if above not done
   (Clara reviews → moves to in-progress)
5. agent works → task_update status=review  ← agent signals work complete
   (Clara checks → done or human-review)
```

**Skipping internal-review is a workflow violation and will be blocked.**

---

## Tier 0: Auto-Approve (no interruption)

All of the following execute without any approval request:

**Read operations:**
- File reads (`Read`, `Glob`, `Grep`, `LS`)
- Database reads via `task_list`, `inbox_list`, `chat_read`, `agent_status`
- Memory reads via `memory_search`, `memory_recall`, `memory_read`
- Git status, git log, git diff (read-only)
- `npm test`, `npx tsc --noEmit` (tests/type checks only)

**Agent-internal actions:**
- Writing to `~/mission-control/memory/` (Obsidian vault)
- Writing to `~/mission-control/library/` (output files)
- Creating task activity logs
- Posting to chat rooms (inter-agent only)

## Tier 1: Soft Approve (logged, auto-proceeds after 5s)

**Code changes:**
- File edits in `src/`, `app/`, `components/`, `tools/`
- Git commits to feature branches (not main)
- Creating new files in existing directories

**Task management:**
- Updating task status (todo → in-progress → internal-review)
- Adding subtasks
- Writing agent session notes

**Memory writes:**
- Writing decisions, patterns, gotchas to vault via `memory_write`

## Tier 2: Review Required (queued, human must approve via dashboard)

**Significant changes:**
- Moving tasks to `done` or `review` status
- Git push to any remote branch
- File deletions
- Database schema changes (`ALTER TABLE`, `CREATE TABLE`)
- Installing new npm packages

**External preparation:**
- Drafting (not sending) emails
- Drafting (not posting) social media content
- Creating PR descriptions for human review

## Tier 3: Explicit Human Approval (blocks until approved)

**External actions (irreversible):**
- Sending emails or messages to external parties
- Posting to Twitter/X, LinkedIn, or any social platform
- Financial transactions of any kind
- Deploying to production environments
- Force-pushing git branches
- Deleting production data

**High-stakes completions:**
- Marking P0 or P1 tasks as done
- Publishing any public-facing content
- API calls to payment processors

---

## Per-Agent Notes

| Agent | Tier 1 allowed | Tier 2 requires | Tier 3 requires |
|-------|----------------|-----------------|-----------------|
| mission-control | task updates, memory writes | push, done tasks | deploy, external |
| coder | file edits, commits | push, schema changes | deploy |
| researcher | memory writes | — | — |
| writer | doc writes | push | external publish |
| chief | task updates | push, done tasks | deploy |
| clara | task review comments | move to done | — |
| designer | file edits, commits | push | publish |
| social_media_manager | draft content | queue for review | post externally |
| growth_director | draft campaigns | queue for approval | run paid campaigns |
| hr | — | — | all external |
| onchain_worker | — | any chain reads | all transactions |
| degen-frog | analysis only | — | any trade action |
| voice | audio config | — | external calls |

---

## Approval Flow

1. Agent calls `approval_create` tool with `tier`, `action`, `description`
2. For Tier 1: Logged to DB, proceeds automatically after 5 seconds
3. For Tier 2: Added to approvals queue in dashboard — agent waits
4. For Tier 3: Push notification + dashboard alert — agent blocks until explicit approval

See `tools/hooks/approval-hook.js` for enforcement implementation.
