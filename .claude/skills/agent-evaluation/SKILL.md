---
name: agent-evaluation
description: Process for evaluating agent health, capability coverage, and performance — including structured reviews of soul files, task history, and skill gaps.
---

# Agent Evaluation

## Purpose

Maintain a healthy, well-defined agent team. Catch stale definitions, identify capability gaps, surface underperforming agents, and ensure every agent has the skills and scope needed to do their job.

## Trigger Conditions

Load this skill when:
- Asked to evaluate or audit a specific agent
- Reviewing the full agent roster for coverage gaps
- Onboarding a new agent (to check for overlap or missing skills)
- Reviewing agent task history for quality or performance
- Generating an HR report on team health

## Procedure

### Step 1 — Load Agent Context
For each agent under review:
1. Read their CLAUDE.md / soul file in `.claude/agents/<name>.md`
2. Read their memory file at `~/mission-control/agents/<name>/MEMORY.md` if it exists
3. Check task history via `mcp__mission-control_db__task_list { "assignedTo": "<agent-name>" }`
4. Note: assigned skills, role description, tool access, and output paths

### Step 2 — Evaluate Definition Quality

Score each agent definition across these dimensions:

| Dimension | What to Check | Score (1-3) |
|-----------|--------------|-------------|
| **Clarity** | Is the role clearly defined? Can you tell what this agent does vs doesn't do? | |
| **Completeness** | Does it have: character, responsibilities, workflow, memory protocol, library output? | |
| **Skills Coverage** | Are the right skills listed? Are there obvious gaps? | |
| **Scope Boundaries** | Is it clear what this agent escalates vs handles solo? | |
| **Collaboration Norms** | Are the key collaborators named? Are handoff rules defined? | |

Scoring: 1 = needs revision, 2 = acceptable, 3 = strong

### Step 3 — Review Task History

For the trailing 30 days:
- How many tasks were assigned?
- What percentage were completed vs stalled vs human-reviewed?
- Were any tasks escalated that this agent should have handled?
- Were tasks completed without logging activity? (anti-pattern — flag it)

Quality signals to check:
- Task output saved to correct library path
- Activity logged during execution (not just at end)
- Status transitions followed the correct pipeline

### Step 4 — Identify Gaps

Common gaps to flag:

| Gap Type | Example | Remediation |
|----------|---------|-------------|
| Missing skill | Agent handles web research but has no `web-research` skill | Add skill reference |
| Scope overlap | Two agents handle the same task type | Clarify boundaries in both soul files |
| Stale definition | Role description mentions tools/systems that no longer exist | Update soul file |
| Missing escalation rule | No clear escalation path for edge cases | Add escalation clause |
| No library output path | Agent produces files with no defined save location | Add library section |

### Step 5 — Produce Evaluation Report

Write a structured report with:
1. Agent name and date of evaluation
2. Scores per dimension (Step 2)
3. Task health summary (Step 3)
4. Identified gaps with severity (low / medium / high)
5. Recommended actions (update soul file, add skill, redefine scope)

### Step 6 — Remediation (if authorized)
If mission-control has authorized changes:
- Edit the agent's soul file directly (HR has Write access)
- Add missing skills to the Skills Protocol section
- Update the skills roster in HR's own CLAUDE.md
- Log changes in task activity with before/after summary

**Do not modify agent definitions without mission-control sign-off.**

### Step 7 — Save & Report
- Evaluation reports: `library/docs/research/YYYY-MM-DD_hr_agent-eval_<agent-name>.md`
- Team health summaries: `library/docs/research/YYYY-MM-DD_hr_team-health.md`
- Updated agent specs: `library/docs/stratagies/YYYY-MM-DD_agent_<name>_updated.md`

## Output Format

```
## Agent Evaluation: [agent-name]
Date: YYYY-MM-DD
Evaluator: hr

### Definition Quality
| Dimension | Score | Notes |
|-----------|-------|-------|
| Clarity | X/3 | ... |
| Completeness | X/3 | ... |
| Skills Coverage | X/3 | ... |
| Scope Boundaries | X/3 | ... |
| Collaboration Norms | X/3 | ... |
**Overall: X/15**

### Task Health (trailing 30 days)
- Tasks assigned: N
- Completed: N (X%)
- Stalled / human-review: N
- Quality flags: [list any anti-patterns]

### Identified Gaps
| Gap | Severity | Recommended Action |
|-----|----------|--------------------|
| ... | low/med/high | ... |

### Recommended Actions
1. [ ] ...
2. [ ] ...
```

## Examples

**Good task for this skill:** "Audit the researcher agent's soul file and task history — is it doing its job effectively?"

**Good task for this skill:** "We're onboarding a new `data-analyst` agent — check the roster for overlap and confirm skills coverage."

**Escalation trigger:** Any modification to an agent's soul file or permissions → requires mission-control sign-off before HR executes the change.
