# PM Ops — Task Templates

Domain reference for task writing, acceptance criteria, subtask decomposition, and prioritization. Read this when creating or reviewing tasks to ensure they meet the quality standard for entering the sprint pipeline.

---

## 1. What Makes a Well-Formed Task

Every task entering the board must have:

1. **Title** — One line, action-oriented, specific. Bad: "Fix bug". Good: "Fix: password reset email sends to wrong address when account has multiple emails".
2. **Description** — Context, background, why this task exists. What problem is being solved?
3. **Acceptance criteria** — The specific, testable conditions that define done. See Section 2.
4. **Assignee** — One owner. Not "Engineering team". Not "TBD". One specific agent.
5. **Priority** — P0/P1/P2/P3. See Section 6.
6. **Dependencies** — Any other task that must be complete before this one can start, stated explicitly.

Tasks missing any of these will be rejected at Gate 1 (Clara's internal-review) and sent back. It is faster to write them correctly the first time.

---

## 2. Writing Acceptance Criteria

Acceptance criteria answer: **how will we know this task is done?**

### The three-part formula
A well-formed acceptance criterion has three parts:
- **Given** [context or precondition]
- **When** [action or trigger]
- **Then** [expected outcome, measurable]

### Examples by quality

**Bad**: "The login should work"
**Good**: "Given a registered user with a valid email and password, when they submit the login form, then they are redirected to the dashboard and their session token is set in localStorage"

**Bad**: "Write documentation for the API"
**Good**: "Given the `/api/auth/reset-password` endpoint exists, when a developer reads the API docs, then they can find: the endpoint URL, required request parameters, all possible response codes with descriptions, and a working curl example"

**Bad**: "Design looks good"
**Good**: "Given the design comp from Figma, when the component is rendered at 1280px and 375px viewport widths, then: layout matches the Figma comp within 4px, all interactive states (hover, focus, disabled) are visually distinct, and the component passes WCAG AA contrast check"

### How many criteria per task?
- Simple tasks: 1-3 criteria
- Medium tasks: 3-6 criteria
- If you need more than 8 criteria: the task is too large, decompose it

### Edge case criteria
Always include at least one criterion for the failure/error case when the task involves user input or external dependencies:
- "Given a user submits the form with an invalid email, then an error message appears describing the issue"
- "Given the external API returns a 500, then the user sees a retry prompt, not a blank screen"

---

## 3. Task Templates by Type

### Feature Task
```
Title: Feature: [short description of the capability being added]

Description:
As a [user type], I need [capability] so that [benefit/reason].

Background:
[Any relevant context — why is this being built now? What problem does it solve?]

Acceptance Criteria:
- [ ] Given [context], when [action], then [expected behavior]
- [ ] Given [context], when [action], then [expected behavior]
- [ ] Given an error/failure condition, when [action], then [graceful handling]

Out of scope:
[Anything explicitly not included in this task that someone might assume is included]

Dependencies:
- [Task/resource that must be complete or available before this task can start]

Notes:
[Any additional context, design links, Figma references, etc.]
```

---

### Bug Task
```
Title: Fix: [short description of what is broken]

Description:
Bug reported: [who reported it, when, how]

Current behavior:
[What is happening now — be specific, include error messages if applicable]

Expected behavior:
[What should happen instead]

Steps to reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3 — observe the bug]

Environment:
- Browser/platform: [if relevant]
- User account type: [if relevant]
- Feature flag state: [if relevant]

Acceptance Criteria:
- [ ] Given [reproduction steps], when [action], then [expected behavior occurs — not the bug]
- [ ] Given [reproduction steps], when [action], then [no regression in adjacent functionality]

Notes:
[Any hypotheses about root cause, relevant code areas, previous related bugs]
```

---

### Research Task
```
Title: Research: [topic or question to be answered]

Description:
We need to understand [topic] in order to [decision/outcome this research enables].

Research questions:
1. [Primary question]
2. [Secondary question]
3. [Additional question if applicable]

Scope:
- In scope: [what to research]
- Out of scope: [what is explicitly not needed — prevents scope creep]
- Time box: [maximum time before delivering findings — research tasks need a time limit]

Deliverable:
[What the output should look like: a written report? A comparison table? A recommendation with supporting evidence?]

Acceptance Criteria:
- [ ] Each research question is answered with sources cited
- [ ] Report includes a clear recommendation or conclusion (not just raw information)
- [ ] Report is saved to [specific path]

Dependencies:
[Any information that would help the researcher — existing docs, prior research to reference]
```

---

### Content Task
```
Title: Content: [content type] — [topic/title/description]

Description:
[What is being created, for what purpose, for what audience]

Channel:
[Where this content will be published: X/Twitter, Discord, email, blog, docs, UI copy]

Audience:
[Who will read this: technical developers, crypto-native community, general users, internal team]

Tone:
[Formal/casual/technical/accessible — and reference brand voice guidelines]

Deliverable specifications:
- Format: [tweet thread / blog post / Discord message / etc.]
- Length: [approximate word/character count or range]
- Key messages to include: [specific points that must be covered]
- Things to avoid: [specific phrases, claims, or approaches to not use]

Acceptance Criteria:
- [ ] Covers all key messages listed above
- [ ] Appropriate length for channel
- [ ] Passes brand voice check (no hollow enthusiasm, no jargon stacking)
- [ ] No unverified statistics or unsupported claims
- [ ] Saved to [specific path]
```

---

### Infrastructure / DevOps Task
```
Title: Infra: [short description of the infrastructure change]

Description:
[What infrastructure change needs to happen and why]

Current state:
[What exists today]

Target state:
[What should exist after this task is complete]

Impact assessment:
- Downtime expected: [Yes/No, estimated duration if yes]
- Rollback procedure: [How to reverse this change if it goes wrong]
- Dependencies affected: [Any other systems that depend on what is changing]

Acceptance Criteria:
- [ ] [Specific outcome that proves the change is working correctly]
- [ ] [Any monitoring/alerting that should be verified]
- [ ] [Rollback procedure documented and tested]

Approval required: [Yes — this needs approval_create before execution / No]

Notes:
[Any relevant runbooks, documentation, access requirements]
```

---

### Sprint Planning Facilitation Task
```
Title: Sprint: [Sprint name/number] — Planning facilitation

Description:
Facilitate sprint planning for [Sprint name/number], ensuring the sprint backlog is well-formed and capacity-realistic before work begins.

Pre-work required:
- [ ] Backlog groomed — all items in the sprint candidate pool have been refined
- [ ] Capacity confirmed — each agent's available hours for the sprint period are known
- [ ] Priority order established — items are ranked P0→P3 before planning begins

Acceptance Criteria:
- [ ] Sprint backlog contains only items with complete acceptance criteria
- [ ] All sprint items are assigned to a specific agent
- [ ] Total estimated effort does not exceed confirmed capacity
- [ ] All inter-sprint dependencies are mapped and their upstream tasks are confirmed complete or in-flight
- [ ] Sprint goal (one sentence describing what success looks like for this sprint) is written and agreed
- [ ] Sprint plan document saved to `library/docs/strategies/[sprint-name]-sprint-plan.md`

Notes:
[Any carry-over items from previous sprint, known constraints, capacity exceptions]
```

---

## 4. Subtask Decomposition Patterns

### When to break a task into subtasks
Break any task into subtasks when:
- It will take more than 4 hours to complete
- It involves sequential steps where each step's output is the next step's input
- Different agents will complete different parts
- Reviewing the completed task would require Clara to assess multiple unrelated things

### Subtask sizing guide
- Subtask is well-sized if it can be completed in one focused session (2-4 hours)
- Subtask is too large if completing it would leave the implementer mid-thought at session end
- Subtask is too small if the coordination overhead of managing it exceeds the work itself

### Dependency notation
When creating subtasks, list dependencies explicitly:
```
Subtask 1: Design the database schema for user sessions
Subtask 2: Implement the API endpoint for session creation [depends on Subtask 1]
Subtask 3: Implement the UI for session display [depends on Subtask 2]
Subtask 4: Write end-to-end tests for session flow [depends on Subtasks 2+3]
```

### Parallel vs. sequential subtasks
Parallel (can run simultaneously):
- Research + Backend implementation (neither depends on the other)
- Copy writing + Design (often independent)
- Unit tests + Documentation (after implementation is complete)

Sequential (must run in order):
- Architecture decision → Implementation → Tests
- Research → Strategy → Execution
- Design → Frontend implementation

---

## 5. Task Title Conventions

**Action prefixes** (use these consistently):
- `Feature:` — new capability being added
- `Fix:` — bug being corrected
- `Refactor:` — code improvement without behavior change
- `Research:` — investigation and synthesis task
- `Content:` — anything produced for publication
- `Infra:` — infrastructure or deployment change
- `Docs:` — documentation update
- `Design:` — visual/UX design work
- `Sprint:` — ceremony facilitation task
- `Audit:` — review or assessment task

**What makes a good title**:
- Starts with the action prefix
- The subject is specific, not generic ("password reset email" not "email functionality")
- A person who has not read the description can roughly understand the scope
- Fits in one line (under 80 characters)

**What makes a bad title**:
- "Fix bug" — which bug?
- "Update the app" — update what?
- "Look into the issue with authentication" — look into it to what end?
- Starts with an agent name ("Coder: implement...") — the assignee field handles agent assignment

---

## 6. Task Prioritization Framework

### P0 — Critical (respond immediately)
**Criteria**: System down, data loss, security breach, payment failure, authentication broken
**Response**: Drop everything. All available resources. Mission Control notified immediately.
**Examples**:
- Production site is returning 500 for all requests
- User payment processing is failing
- Authentication tokens are being exposed in logs

### P1 — High (same session)
**Criteria**: Core feature broken in a way that blocks users, legal/compliance issue, major regression
**Response**: Address within the current working session. Do not defer to next sprint.
**Examples**:
- New user registration flow is broken
- A deployed change introduced a data corruption bug
- A compliance requirement deadline is approaching with work unstarted

### P2 — Normal (next available slot)
**Criteria**: Feature request, improvement, standard bug that has a workaround, research task
**Response**: Enter the sprint backlog. Prioritized by impact within the P2 pool.
**Examples**:
- New feature request from growth team
- UI polish that improves but does not gate functionality
- Research needed for a future decision

### P3 — Low (backlog)
**Criteria**: Nice-to-have, idea, non-blocking observation
**Response**: Logged in backlog. Reviewed at sprint planning. May not be addressed for weeks.
**Examples**:
- Code style improvements with no functional impact
- Stretch features that would be good but are not needed now
- Ideas worth tracking but not prioritizing

### Priority escalation
Any task can be escalated to a higher priority if circumstances change. PM Ops tracks when P2 tasks should be promoted to P1 based on:
- A deadline approaching
- A dependency being unblocked that makes the task high-impact now
- A user impact growing while the task sits in backlog

---

## 7. Runbook Template

```markdown
# Runbook: [Name of Procedure]

## Purpose
[What this runbook accomplishes and when to use it]

## When to Use
[Specific trigger conditions for executing this runbook]

## Prerequisites
- [ ] [Required access, tool, or condition 1]
- [ ] [Required access, tool, or condition 2]

## Steps

### Step 1: [Step name]
**Action**: [Exact command, click, or action to take]
**Expected output**: [What you should see when this step succeeds]
**If this fails**: [What to do if the step does not produce the expected output]

### Step 2: [Step name]
**Action**: [...]
**Expected output**: [...]
**If this fails**: [...]

[Continue for all steps]

## Verification
[How to confirm the procedure completed successfully]

## Rollback Procedure
[How to reverse this runbook if something went wrong]

## Contacts
[Who to contact if the runbook fails at a step that is not covered above]

## Last Updated
[Date — update this whenever the runbook is tested or revised]
```

---

## 8. Risk Register Template

```markdown
# Risk Register: [Project Name]

## Risk Assessment Scale
**Likelihood**: High (likely this sprint/phase) / Medium (possible) / Low (unlikely)
**Impact**: High (blocks the project or causes major rework) / Medium (delays or partial rework) / Low (minor inconvenience)

## Active Risks

| ID | Risk Description | Likelihood | Impact | Owner | Mitigation Plan | Status |
|----|-----------------|-----------|--------|-------|----------------|--------|
| R1 | [Description of risk] | High/Med/Low | High/Med/Low | [Agent] | [What reduces this risk] | Open/Mitigated/Closed |
| R2 | ... | ... | ... | ... | ... | ... |

## Risk Thresholds
- **High + High**: Escalate to Mission Control immediately. Create a P1 task for mitigation.
- **High + Medium** or **Medium + High**: Create P2 mitigation task. Review weekly.
- **Low + Any** or **Any + Low**: Monitor. No immediate action required.

## Closed Risks
[Risks that have been resolved — retain for retrospective analysis]

| ID | Risk Description | Resolution | Date Closed |
|----|-----------------|-----------|-------------|
| R0 | ... | ... | ... |
```
