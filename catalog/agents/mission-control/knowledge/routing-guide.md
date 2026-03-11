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
