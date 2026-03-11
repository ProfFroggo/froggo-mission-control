---
name: product-prd
description: Process for writing and validating a Product Requirements Document — from deciding when to write one to decomposing it into engineering tasks.
---

# Product PRD

## Purpose

Produce PRDs that give engineers enough context to build the right thing without ambiguity, while giving stakeholders a clear view of what is being built, why, and how success is measured. A PRD is not a spec dump — it is a decision record.

## Trigger Conditions

Load this skill when:
- A new product feature or change needs to be scoped before engineering work begins
- A task exists with vague requirements that need formalization
- A feature request has arrived from a stakeholder or user research
- Decomposing an approved PRD into tasks for the engineering team
- Reviewing an existing PRD for completeness before it enters the build pipeline

## Procedure

### Step 1 — Decide Whether a PRD Is the Right Document

Not every feature needs a PRD. Use this decision matrix:

| Situation | Right document |
|-----------|---------------|
| Small, well-understood bug fix or UI tweak | Engineering ticket (no PRD) |
| New feature with clear precedent and no ambiguity | Engineering ticket with brief context |
| New feature with design decisions, tradeoffs, or multiple approaches | PRD |
| Cross-team initiative affecting multiple systems | PRD + strategy doc |
| Product direction decision (what to build vs. not) | Strategy doc |
| Everything the team needs to build a new product area | PRD |

**Write a PRD when**: scope is unclear, design decisions need to be made, success needs to be measurable, or multiple people need alignment before work starts.

**Do not write a PRD when**: the task is small enough to describe in 3 sentences in a ticket.

### Step 2 — Write the Problem Statement

The problem statement answers: what is broken or missing, for whom, and why it matters now.

Format:
```
[User type] currently [pain point or unmet need].
This results in [observable negative outcome — use data if available].
We know this because [evidence: user feedback, analytics, support tickets, research].
Solving this is a priority now because [strategic reason or urgency].
```

Example:
```
New users who complete KYC currently drop off before making their first trade at a rate of 62%.
This results in low D7 activation and wasted acquisition spend.
We know this because funnel analytics show a 38% completion rate on the "fund your account" step, and 15 support tickets per week cite confusion about the funding flow.
Solving this is a priority now because our Q2 growth target depends on improving activation by 15pp.
```

Do not begin writing PRD sections until the problem statement is clear and evidence-based. If evidence is missing, task researcher to gather it before proceeding.

### Step 3 — Write User Stories in JTBD Format

Jobs to Be Done format for user stories: "When [situation], I want to [motivation], so I can [outcome]."

This is more actionable than "As a user I want X" because it captures the context that drives the behavior.

Examples:
```
When I've just completed KYC verification, I want to understand exactly what I need to do to make my first trade, so I can get the experience I signed up for without feeling confused or lost.

When my deposit is pending, I want to see a clear status update with expected time, so I can stop worrying about whether my funds are safe.

When I'm comparing two crypto assets to buy, I want to see their recent price performance side-by-side, so I can make a decision without leaving the app.
```

Write at minimum 3 user stories per PRD. Each story should be from the perspective of a real user segment (be specific — not "a user" but "a first-time crypto buyer" or "an existing user adding funds").

### Step 4 — Define Success Metrics

For every PRD, define:

```
Primary success metric:
  Metric: [what we measure]
  Current baseline: [current value]
  Target: [value we want to reach]
  Timeframe: [when we expect to see the change]
  Measurement method: [where does this data come from]

Secondary metrics (at least 2):
  1. Metric: ___ | Baseline: ___ | Target: ___ | Method: ___
  2. Metric: ___ | Baseline: ___ | Target: ___ | Method: ___

Guardrail metrics (must not regress):
  1. Metric: ___ | Current value: ___ | Max acceptable drop: ___
  2. Metric: ___ | Current value: ___ | Max acceptable drop: ___
```

If you cannot define measurable success metrics, the problem statement is not specific enough. Return to Step 2.

### Step 5 — Define Scope (In Scope / Non-Goals)

**In Scope**: What this PRD commits to delivering. Each item should be specific enough to build.

**Non-Goals**: What we are deliberately not building in this version, with a brief reason why. Non-goals prevent scope creep and answer "but what about X?" questions before they are asked.

```
### In Scope (V1)
- [Specific feature or behavior 1]
- [Specific feature or behavior 2]
- [Specific feature or behavior 3]

### Non-Goals (explicitly excluded from V1)
- [Feature X] — not in scope because [reason: different user need / to be addressed in V2 / out of strategy]
- [Feature Y] — not in scope because [reason]

### Future Considerations (V2+)
- [Item that came up in scoping but is deferred]
- [Item to revisit after V1 data is available]
```

### Step 6 — Write Acceptance Criteria

Every user story or feature needs acceptance criteria in Given/When/Then format. These become the definition of done for engineering.

Format:
```
Given [initial state or context],
When [user action or system event],
Then [observable outcome].
```

Examples:
```
Given a user has completed KYC and not yet made a deposit,
When they arrive at the dashboard for the first time,
Then they see the "Fund your account" onboarding step as the primary action with a clear next-step button.

Given a user's bank transfer is pending,
When they view the funding status page,
Then they see the transfer status as "Pending," the estimated arrival time in business days, and a support contact link.

Given a user clicks "Fund your account,"
When the funding modal opens,
Then they see at minimum 3 funding methods with estimated arrival times for each, and can select one without leaving the modal.
```

Each acceptance criterion should be:
- Testable (can a QA engineer verify it?)
- Unambiguous (only one interpretation possible)
- Focused on behavior, not implementation

### Step 7 — Document Open Questions

Capture everything that is unknown or needs a decision before engineering starts. Leaving open questions buried in comments causes delays mid-sprint.

```
### Open Questions

| # | Question | Owner | Priority | Status | Answer / Decision |
|---|----------|-------|----------|--------|-------------------|
| 1 | [question] | [agent/person] | P0/P1/P2 | open / resolved | [answer when resolved] |
```

P0 open questions must be resolved before the PRD is approved. P1 must be resolved before engineering starts. P2 can be resolved during implementation.

### Step 8 — Define Timeline

```
### Timeline
| Milestone | Date | Description |
|-----------|------|-------------|
| PRD review complete | YYYY-MM-DD | Stakeholder sign-off |
| Design handoff | YYYY-MM-DD | Designs available for engineering |
| Engineering starts | YYYY-MM-DD | Sprint assignment |
| Internal beta / staging | YYYY-MM-DD | Internal testing |
| Production launch | YYYY-MM-DD | Full rollout |
| Post-launch review | YYYY-MM-DD + 14 days | Success metrics check |
```

Flag any hard deadlines (marketing launches, regulatory dates, public commitments) explicitly.

### Step 9 — Stakeholder Review

Before a PRD is approved:
1. Share draft with: product owner (human), lead engineer, designer, data analyst
2. Collect feedback with a 3-business-day deadline
3. Resolve all P0 open questions
4. Get explicit sign-off from human owner before moving to build

Do not move a PRD to "in-progress" without human sign-off. Create a human-review task.

### Step 10 — Decompose PRD into Engineering Tasks

Once approved, decompose the PRD into tasks for the engineering team. Follow this pattern:

For each major feature/behavior in the PRD:
1. **Backend task**: API endpoints, data model changes, business logic
2. **Frontend task**: UI components, state management, user interactions
3. **Integration task**: Third-party services, webhooks, data pipeline (if applicable)
4. **Testing task**: Unit tests, integration tests, E2E test coverage
5. **Analytics task**: Event tracking implementation for success metrics

Task format:
```
Task title: [Verb] [noun] — [context from PRD]
Description: [What needs to be built, linking back to PRD acceptance criteria]
PRD reference: [link or section]
Acceptance criteria: [copy from PRD, section-specific]
Priority: P0/P1/P2
Assigned to: coder / devops / designer
Dependencies: [other tasks that must complete first]
```

## Full PRD Template

```markdown
# PRD: [Feature Name]

**Status**: Draft / In Review / Approved / In Build / Shipped
**Owner**: [agent or human name]
**Version**: 1.0
**Created**: YYYY-MM-DD
**Last updated**: YYYY-MM-DD

---

## Problem Statement
[2-4 sentences. What is broken, for whom, why it matters, and evidence.]

## User Stories

### Story 1
When [situation], I want to [motivation], so I can [outcome].

### Story 2
When [situation], I want to [motivation], so I can [outcome].

### Story 3
When [situation], I want to [motivation], so I can [outcome].

## Success Metrics

**Primary metric**: [name] — Baseline: ___ — Target: ___ — By: YYYY-MM-DD
**Secondary metrics**:
- [Metric 2]: Baseline ___ → Target ___
- [Metric 3]: Baseline ___ → Target ___
**Guardrail metrics**:
- [Metric]: must not drop below ___

## Scope

### In Scope (V1)
- [Feature/behavior]
- [Feature/behavior]

### Non-Goals
- [Excluded item] — because ___
- [Excluded item] — because ___

### Future Considerations
- [Deferred item]

## Acceptance Criteria

### [Feature Area 1]
- Given ___, When ___, Then ___
- Given ___, When ___, Then ___

### [Feature Area 2]
- Given ___, When ___, Then ___

## Open Questions

| # | Question | Owner | Priority | Status |
|---|----------|-------|----------|--------|
| 1 | | | P0 | open |

## Design

[Link to Figma or design spec. If designs are not yet available, note expected date.]

## Technical Notes

[Any known technical constraints, architectural decisions, or dependencies engineers need to know. Optional — add when engineering has provided input.]

## Timeline

| Milestone | Date |
|-----------|------|
| PRD approved | YYYY-MM-DD |
| Engineering starts | YYYY-MM-DD |
| Launch | YYYY-MM-DD |

## Stakeholder Sign-Off

| Name | Role | Status | Date |
|------|------|--------|------|
| [Name] | Product Owner | Approved / Pending | |
| [Name] | Engineering Lead | Approved / Pending | |
| [Name] | Design | Approved / Pending | |
```

## Output

Save PRDs to: `~/mission-control/library/docs/stratagies/YYYY-MM-DD_prd_[feature-name].md`
Save task decomposition output in the task board via MCP tools, linking each task back to the PRD file path.

## Examples

**Good task for this skill:** "Write a PRD for the new mobile deposit flow. Users are dropping off at funding — we need to fix this before the Q2 growth push."

**Good task for this skill:** "The funding flow PRD is approved. Decompose it into engineering tasks for the sprint."

**Anti-pattern to avoid:** Writing acceptance criteria that describe implementation ("the button should be blue") instead of behavior ("the user should be able to confirm their action with a single tap"). Implementation is the engineer's decision.

**Escalation trigger:** Any PRD touching user financial data, KYC flows, regulatory compliance, or security → must go through human-review before moving to build. Tag mission-control.
