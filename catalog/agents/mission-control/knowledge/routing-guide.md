# Mission Control — Routing Guide

Domain reference for task routing, agent selection, request decomposition, and coordination patterns. Read this when receiving a new request to determine the correct routing strategy.

---

## 1. Agent Roster and Routing Table

### Core Operations Agents
| Agent | Route to when... | Do NOT route when... |
|-------|-----------------|----------------------|
| `clara` | Any task reaches internal-review or agent-review. P0/P1 before done. | Clara does not receive new work requests — she reviews work that is already in review status. |
| `inbox` | Processing a batch of incoming messages, or when the inbox queue needs clearing. | Clara routes are not inbox routes. Routing tasks that have already been classified is not an inbox job. |
| `project-manager` | Cross-functional coordination, sprint planning, stakeholder status reports, runbooks, retrospectives, dependency mapping. | Product decisions, technical scoping, budget decisions. |
| `mission-control` | Orchestration, routing, tie-breaking, escalations. | Never routes to itself for actual work execution. |

### Engineering Agents
| Agent | Route to when... | Do NOT route when... |
|-------|-----------------|----------------------|
| `coder` | Standard feature implementation, bug fixes, TypeScript/React/Next.js work, single-file or small multi-file changes. | Architecture decisions, complex multi-file changes spanning core systems. |
| `chief` | Architecture decisions, complex multi-file changes (scope >5 files), core system changes, reviewing Coder's approach on complex tasks, breaking ties between Coder approaches. | Standard feature work that Coder can handle without architectural input. |
| `senior-coder` | Premium implementation requiring deep expertise, security-sensitive code, performance-critical paths. | Standard CRUD, routine feature work. |
| `devops` | CI/CD pipelines, deployment configuration, infrastructure, Docker, environment setup, reliability monitoring. | Application-level code; DevOps owns infrastructure, not the app. |
| `qa-engineer` | Functional testing strategy, accessibility audits, Playwright end-to-end tests, Vitest unit test writing, test coverage analysis. | Clara already handles the review gate — QA Engineer writes tests, not review verdicts. |
| `security` | Security audits, OWASP compliance, threat modelling, auth implementation review, data handling compliance. | Routine code review — Clara handles that. Security handles the security-specific pass. |

### Design and Content Agents
| Agent | Route to when... | Do NOT route when... |
|-------|-----------------|----------------------|
| `designer` | UI/UX work, design system components, Tailwind layout, accessibility in UI, component design, visual design. | Copy writing, content strategy — those are separate. |
| `content-strategist` | Content strategy, editorial calendar, brand voice guidelines, content pillars, campaign structure. | Execution of individual pieces of copy — that is Writer or Voice. |
| `writer` | Docs, release notes, in-app text, blog posts, long-form content, technical writing. | Brand voice auditing — Voice does that. |
| `voice` | Brand voice review on any user-facing copy. Voice command processing and transcription structuring. | Original long-form content creation — Voice edits and audits, Writer creates. |

### Marketing and Growth Agents
| Agent | Route to when... | Do NOT route when... |
|-------|-----------------|----------------------|
| `growth-director` | Growth strategy, GTM planning, experiments, OKRs, acquisition funnel analysis, retention strategy. | Paid media execution — that goes to Performance Marketer. |
| `performance-marketer` | Google Ads, Meta Ads, TikTok campaigns, ROAS optimization, ad creative briefs, paid channel reporting. | Organic content strategy — that is Growth Director or Content Strategist. |
| `social-manager` | X/Twitter execution, social scheduling, community engagement, social analytics. | Content strategy — that is Content Strategist. |
| `researcher` | Web research, competitive analysis, market sizing, synthesis reports, fact-checking, primary source finding. | Any task that is clearly a known fact or does not require research. |

### Operations and Support Agents
| Agent | Route to when... | Do NOT route when... |
|-------|-----------------|----------------------|
| `customer-success` | User support tickets, onboarding help, churn analysis, user feedback synthesis, retention workflows. | Product decisions derived from feedback — those go to Product Manager. |
| `data-analyst` | SQL queries, analytics dashboard construction, KPI tracking, BI reporting, data pipeline analysis. | Product strategy informed by data — that is Product Manager's interpretation. |
| `finance-manager` | Budget tracking, financial reporting, Solana wallet management, cost analysis, spend approvals. | Resource allocation decisions — those involve Finance Manager but are ultimately Growth Director or Mission Control calls. |
| `discord-manager` | Discord server management, community moderation, Discord announcements, Discord growth. | Cross-platform social — that is Social Manager. |
| `hr` | Agent lifecycle management, agent onboarding, training documentation, team structure decisions. | Individual task assignments — that is Mission Control. |
| `product-manager` | Product roadmap, sprint prioritization, feature specs, A/B test design, user story writing. | Execution of any of those — Product Manager defines, agents execute. |

---

## 2. Task Decomposition Patterns

### When to Decompose
Decompose a task when any of these are true:
- It requires more than one agent to complete
- It spans more than one domain (e.g., feature + documentation + tests)
- A single agent cannot complete it in a session
- The acceptance criteria reference multiple independent deliverables
- Reviewing it as a single unit would require Clara to assess multiple unrelated things at once

### Decomposition Rules
- Each subtask must have exactly one owner
- Each subtask must have its own acceptance criterion
- Subtasks must be in dependency order — upstream subtasks complete before downstream ones start
- No subtask should be "do X and also Y" — each subtask does one thing

### Example Decompositions

**New feature request: "Add a password reset flow"**
```
Task 1 → chief: Design the password reset architecture (DB schema, API endpoints, email flow)
Task 2 → coder: Implement API endpoints per architecture [depends on Task 1]
Task 3 → coder: Implement UI components for password reset [depends on Task 1]
Task 4 → qa-engineer: Write end-to-end tests for password reset flow [depends on Tasks 2+3]
Task 5 → writer: Write in-app copy for password reset screens [parallel with Tasks 2+3]
```

**Campaign request: "Launch a Twitter campaign for the new feature"**
```
Task 1 → content-strategist: Define campaign strategy, messaging pillars, target audience
Task 2 → writer: Draft tweet copy [depends on Task 1]
Task 3 → voice: Brand voice audit on tweet copy [depends on Task 2]
Task 4 → designer: Create visual assets for tweets [depends on Task 1]
Task 5 → social-manager: Schedule and post campaign [depends on Tasks 3+4]
```

**Research request: "Understand our competitive position in DeFi wallets"**
```
Task 1 → researcher: Competitive analysis — top 5 DeFi wallet competitors, feature comparison
Task 2 → data-analyst: Analyze our current user metrics vs. category benchmarks [parallel]
Task 3 → growth-director: Synthesize findings into GTM positioning recommendations [depends on Tasks 1+2]
```

---

## 3. Parallelization vs. Serialization

### Parallelize when:
- Tasks have no dependency on each other's outputs
- Multiple independent investigation paths need to be explored simultaneously
- Time pressure exists and work can genuinely run concurrently
- Different domains are involved with no coordination needed mid-stream (design + backend + research)

### Serialize when:
- One task's output is another task's input
- The work requires a single coherent decision before branching (architecture before implementation)
- Clara's review of Phase 1 gates Phase 2 starting
- Context from one workstream materially affects decisions in another

### Agent Team threshold:
Spawn an Agent Team for parallel work when:
- Three or more genuinely independent paths
- Investigation requires competing hypotheses to be explored simultaneously
- The synthesis of parallel workstreams is as important as the workstreams themselves

Do not spawn an Agent Team for:
- Sequential work that happens to involve multiple agents
- Work that looks parallel but has a shared dependency that will create a bottleneck
- Small tasks — the coordination overhead of a team exceeds the benefit

---

## 4. Common Routing Mistakes

### Routing to Mission Control instead of a specialist
**Wrong**: "Mission Control, can you write the documentation for this feature?"
**Right**: Route to `writer` with a clear brief. Mission Control does not produce deliverables — it routes to agents who do.

### Routing without a brief
**Wrong**: Assigning a task to `coder` with the title "Fix the login bug"
**Right**: Assigning a task with: the specific bug behavior, steps to reproduce, expected behavior, relevant files, acceptance criterion for the fix

### Routing architecture to Coder instead of Chief
**Wrong**: Sending a "refactor the authentication system" task to `coder`
**Right**: Send architecture review to `chief` first; then `chief` and `coder` can split implementation if appropriate

### Routing to Research when the answer is known
**Wrong**: Routing a task to `researcher` to find out what a term means when it is already in the platform documentation
**Right**: Check existing context before routing research. Researcher is for genuinely unknown information.

### Creating new tasks for existing threads
**Wrong**: Creating a new task when someone follows up on an existing task
**Right**: Route the follow-up message to the existing task's activity log. Only create new tasks for new requests.

### Assigning tasks with overlapping scope
**Wrong**: Task A: "Build the API endpoint" and Task B: "Build the feature including the API endpoint" — both assigned simultaneously
**Right**: One task per scope boundary. Task B should depend on Task A, not duplicate it.

---

## 5. Escalation Paths

### P0 Escalation
Trigger: System down, security breach, data loss, payment failure, authentication broken
Path: Inbox classifies as P0 → Mission Control notified immediately → Mission Control drops current work to triage → Routes to relevant specialist (Security, Coder/Chief, DevOps depending on type) → All resources concentrated → Clara review before resolution is marked done

### P1 Escalation
Trigger: Core feature broken, user-blocking bug, legal/compliance issue
Path: Inbox classifies as P1 → Mission Control queues immediately after any active P0 → Routes to relevant specialist → Clara review before done

### Agent Conflict Escalation
Trigger: Two agents disagree on approach, ownership, or output
Resolution: Higher trust tier has priority. If tied → Chief breaks tie on technical questions, Mission Control on routing/scope questions. All conflicts logged to task activity.

### Task Stuck Escalation
Trigger: Task in in-progress status with no activity for 2+ hours
Step 1 (2 hours): Mission Control posts check-in comment in task activity
Step 2 (3 hours, no response): Mission Control either reassigns or moves to human-review with a note explaining the blockage
Never: Leave a stuck task unaddressed until the next session

### Approval Aging Escalation
Trigger: Pending approval item not actioned in 24+ hours
Action: Mission Control posts a reminder in the relevant chat room and flags to user via inbox
Do not: Wait longer than 24 hours before flagging. Aged approvals are a pipeline blocker.

---

## 6. Request Type to Routing Template

### "Can you..." (capability question)
Route to the agent with that capability. Include the context needed to answer the specific question, not just the general domain.

### "I need..." (work request)
Create a task. Assign to the appropriate agent. Write acceptance criteria before assigning.

### "What happened to..." (status question)
Check task activity log first. If there is a complete answer there, respond directly. If not, route to the task owner with a status request.

### "Something is broken..." (incident)
Classify severity (P0/P1/P2). Route to the appropriate engineering agent. If security-related or data-loss-related, always treat as P0 until proven otherwise.

### "We should..." (idea or suggestion)
Create a P3 backlog task for the idea. Route to the relevant agent for initial scoping if it is high-priority. Do not discard ideas — log them.

### "Approve this..." (approval request)
Route to the appropriate approver. Create an approval item via `approval_create` if this is an external action. Flag if it has been waiting more than 24 hours.

---

## 7. Pipeline Orchestration Patterns

When a project requires coordinated multi-agent work across sequential phases, Mission Control operates as a pipeline orchestrator rather than a one-off router. This section covers the patterns, logic, and guardrails for running autonomous pipelines.

### Phase-Based Coordination

Every pipeline is decomposed into phases with explicit entry and exit criteria. Phases do not start until prior phase exit criteria are documented and met.

**Standard phase structure for a technical project**:

```
Phase 1: Specification & Planning
  Trigger: Multi-part project request received
  Owner: project-manager (or mission-control for small scopes)
  Deliverable: Task list with per-task acceptance criteria and dependency map
  Exit gate: All tasks have owners, acceptance criteria, and dependency order confirmed

Phase 2: Architecture & Foundation
  Trigger: Phase 1 exit gate passed
  Owner: chief (technical) or designer (UX-led)
  Deliverable: Architecture doc, foundational patterns, any shared scaffolding
  Exit gate: Architecture reviewed; all Phase 3 agents can start from it independently

Phase 3: Implementation — Dev-QA Loop (per task)
  Trigger: Phase 2 exit gate passed
  Owner: assigned specialist per task; qa-engineer validates each
  Loop: Implement → QA → PASS (advance) or FAIL (retry with feedback)
  Exit gate: All tasks pass QA validation

Phase 4: Integration & Final Validation
  Trigger: All Phase 3 tasks pass QA
  Owner: qa-engineer (cross-task integration) → clara (final review)
  Deliverable: Integration test results, cross-task coherence confirmation
  Exit gate: Clara review passes; pipeline marked complete
```

Not every project requires all four phases. Adapt the structure — the requirement for explicit exit gates applies regardless of how many phases are used.

### Dev-QA Loop and Retry Logic

Each task in the implementation phase runs through a validation loop before the next task begins (unless tasks are provably independent and can run in parallel).

**Per-task loop**:

```
Step 1: Assign to specialist agent
  - Include: task description, acceptance criteria, relevant prior phase context
  - Be specific: reference exact files, docs, or prior outputs the agent should use

Step 2: Agent implements and signals completion

Step 3: Route to qa-engineer for validation
  - qa-engineer receives: task description, acceptance criteria, agent output
  - qa-engineer returns: PASS or FAIL with specific, actionable feedback

Step 4: Decision

  IF PASS:
    → Log pass to task activity with QA confirmation
    → Reset retry counter
    → Advance to next task

  IF FAIL (attempt 1):
    → Log QA feedback to task activity
    → Route back to implementing agent with full QA feedback attached
    → Increment retry counter (now at 1/3)

  IF FAIL (attempt 2):
    → Assess: is this the same issue or a new failure mode?
    → Same issue: provide more precise re-assignment instructions
    → New issue: treat as distinct failure, still increment counter (now at 2/3)
    → Route back to implementing agent with refined instructions

  IF FAIL (attempt 3) — escalation threshold:
    → Mark task as human-review
    → Write escalation note: what was attempted, QA findings each cycle, apparent root cause
    → Notify user via inbox
    → Pause this task; continue any unblocked parallel tasks
    → Do NOT retry — three cycles with specialist agents is the limit before human input
```

**The 3-attempt limit is not a default** — it is the ceiling. Some tasks are resolved on the first QA pass. The limit exists to prevent infinite loops when an issue requires architectural input, additional context, or a decision the agents cannot make unilaterally.

### Quality Gates Between Phases

Quality gates are enforced at two levels: task-level and phase-level.

**Task-level gate**: A task is complete only when it has passed QA validation and that pass is documented in the task activity log with the specific acceptance criteria that were verified. An undocumented pass is not a pass.

**Phase-level gate**: A phase is complete only when every task in it has cleared its task-level gate. If one task is blocked, the phase does not close and the next phase does not open. The blocked task is escalated; other tasks in the phase that are complete are logged as complete and wait.

**Evidence requirement**: Every gate decision — pass or fail — must include the specific criterion that was evaluated and the specific evidence that supports the decision. "Looks good" is not evidence. "The password reset form submits correctly and redirects to the confirmation screen, verified via Playwright test output" is evidence.

**No advancement without documentation**: The gate is not cleared until the documentation exists. This is not bureaucracy — it is the record that future sessions, Clara, and any reviewing human will use to understand what was actually verified.

### Parallel vs. Sequential Work in Pipelines

Mission Control continuously evaluates which tasks can run in parallel and which must be sequential.

**Parallelize when**:
- Tasks have different specialist owners with no shared output artifacts
- Tasks draw from the same Phase 2 foundation but produce independent deliverables
- Research, writing, and implementation work for the same project have no cross-dependency
- Time pressure is significant and the parallelization benefit outweighs the synthesis overhead

**Serialize when**:
- One task's output is an input to another (dependency chain)
- A QA failure in Task A would require rework in Task B if B started prematurely
- Tasks share a single specialist agent who cannot effectively context-switch between both simultaneously
- Phase exit criteria require full task completion before the next phase starts

When the dependency is ambiguous, err toward serialization and document the choice. Unnecessary serialization costs time. Unnecessary parallelization costs rework when upstream failures cascade.

### Pipeline Status Reporting

At every phase boundary, Mission Control produces a status record. At pipeline completion, Mission Control produces a completion summary. These are logged to task activity, not kept in memory only.

**Phase boundary status template**:
```
Phase [N] complete → Phase [N+1] starting
Tasks completed this phase: [N]
QA cycles required: [total across all tasks in this phase]
Retries used: [count] of [max]
Blocked / escalated: [list any — or "none"]
Next phase owner(s): [agent names]
Next phase deliverable: [brief description]
```

**Pipeline completion template**:
```
Pipeline complete
Total phases: [N]
Total tasks: [N] | Passed first attempt: [N] | Required retries: [N] | Escalated: [N]
Final validation: [Clara review status]
Deliverables: [list]
Remaining items (if any): [list with status]
```
