---
name: growth-experiment
description: Step-by-step process for designing, launching, measuring, and documenting a growth experiment — from hypothesis to results log.
---

# Growth Experiment

## Purpose

Design rigorous growth experiments that produce actionable, statistically valid results. Every experiment must have a clear hypothesis, defined success criteria, and documented learnings before it runs — not after. Guessing is not a growth strategy.

## Trigger Conditions

Load this skill when:
- Designing a new A/B test, multivariate test, or growth hypothesis
- Evaluating whether an experiment has reached statistical significance
- Documenting the results of a completed experiment
- Reviewing an experiment backlog to prioritize what to run next
- Auditing an in-flight experiment for methodology problems

## Procedure

### Step 1 — Write the Hypothesis

Every experiment starts with a formal hypothesis in this structure:

```
If we [specific change or intervention],
then [measurable outcome],
because [underlying mechanism or user behavior we believe is true].
```

Examples of strong hypotheses:
- "If we add a one-click referral prompt on the post-trade confirmation screen, then referral sign-ups will increase by 15%, because users are most motivated to share immediately after a positive transaction."
- "If we reduce the onboarding flow from 7 steps to 4 steps, then D1 activation rate will increase by 10%, because friction is the primary drop-off driver based on funnel data."

Anti-patterns to reject:
- "We think the button color should be green." (No measurable outcome, no mechanism)
- "Let's try making the CTA bigger." (No hypothesis, no success criteria)

### Step 2 — Define the Primary Metric

Choose exactly one primary metric. This is the single number that determines whether the experiment wins or loses.

- Must be measurable before the experiment runs
- Must be attributable to the change being tested (not confounded by other changes)
- Must be collected at the user level, not aggregate

Secondary metrics (guardrail metrics) are allowed but do not determine win/loss. They exist to catch regressions.

```
Primary metric: [metric name] — [how it is measured] — [current baseline]
Guardrail metrics:
  - [metric 1] — must not decrease by more than X%
  - [metric 2] — must not decrease by more than X%
```

### Step 3 — Calculate Minimum Detectable Effect (MDE)

The MDE is the smallest improvement worth detecting. If you cannot observe an effect this size with statistical confidence, the experiment should not run.

```
MDE Inputs:
  Baseline conversion rate (p1): ____%
  Minimum meaningful lift (absolute): ____pp  OR  minimum lift (relative): ____%
  Significance level (alpha): 0.05 (standard)
  Statistical power (1-beta): 0.80 (standard)
```

Use the two-proportion z-test formula or a sample size calculator (e.g., Evan Miller's calculator). Document the result:

```
Required sample size per variant: ________ users
Total sample required: ________ users (× number of variants)
Estimated time to reach sample at current traffic: ________ days
```

If estimated runtime exceeds 8 weeks, reconsider the MDE or the scope of the experiment.

### Step 4 — Define the Control and Variant(s)

```
Control (baseline):
  Description: [What the current experience looks like — be specific]
  Screenshot or spec link: ___

Variant A:
  Description: [Exactly what changes — one change per variant]
  Screenshot or spec link: ___

Variant B (if applicable):
  Description: ___
```

Rules:
- One change per variant. If you change two things, you cannot attribute the effect.
- The control must represent the current production experience exactly.
- Maximum 3 variants (including control) for most experiments. More variants require proportionally larger sample sizes.

### Step 5 — Define Traffic Allocation and Assignment

```
Traffic split: [50/50 | 33/33/33 | custom: ___]
Assignment unit: [user ID | session ID | device ID]
Assignment method: [random hash | feature flag tool | manual split]
Tool/system used: ___
Experiment ID or flag name: ___
```

Always assign at the user level (not session) unless there is a specific reason not to. Session-level assignment causes contamination when the same user sees both variants.

### Step 6 — Set Success Criteria (Before Launch)

Lock success criteria before the experiment runs. Changing them after you see results is p-hacking.

```
Experiment wins if:
  - Primary metric improves by ≥ [MDE value]
  - Statistical significance: p < 0.05
  - Sample size reached: ≥ [required sample per variant]
  - Runtime: ≥ [minimum runtime, typically 7 days to capture weekly cycles]

Experiment loses if:
  - Primary metric does not improve by MDE at full sample
  - Any guardrail metric drops by more than [threshold]

Inconclusive if:
  - Sample size not reached within [max runtime]
  - Results are directionally positive but below MDE
```

### Step 7 — Pre-Launch Checklist

Before starting the experiment, verify every item:

- [ ] Hypothesis written in If/Then/Because format
- [ ] Primary metric defined and tracking confirmed in analytics tool
- [ ] Guardrail metrics defined and tracking confirmed
- [ ] Sample size calculated and documented
- [ ] MDE documented
- [ ] Control and variant(s) fully specified
- [ ] Traffic allocation configured and verified
- [ ] No other experiments running on the same population (experiment collision check)
- [ ] Minimum runtime locked (no peeking and stopping early)
- [ ] Success criteria documented and locked
- [ ] Stakeholder sign-off received
- [ ] Rollback plan documented (what to do if guardrail metric breached)

### Step 8 — Monitor During the Experiment

Check the experiment at these intervals only (peeking more often increases false positive rate):

```
Day 1:   Verify tracking is firing correctly — sample accumulating as expected?
Day 3:   Guardrail check only — are any regressions appearing?
Day 7:   First planned interim check — sample size milestone?
Final:   Full analysis when minimum sample AND minimum runtime both met
```

Do not call the experiment early. Do not share partial results with stakeholders until the experiment is complete.

### Step 9 — Statistical Significance Check

At experiment close:

```
Results:
  Control conversions: ___ / ___ visitors  =  ____%
  Variant conversions: ___ / ___ visitors  =  ____%
  Relative lift: ____%
  Absolute lift: ____pp

Statistical test: two-proportion z-test
  Z-score: ____
  p-value: ____
  Confidence level: ____%
  Statistically significant: YES / NO (p < 0.05?)

Power check:
  Sample size reached: YES / NO
  Minimum runtime reached: YES / NO
```

Only declare a winner if ALL of the following are true: p < 0.05, sample size met, minimum runtime met, and guardrail metrics not breached.

### Step 10 — Document and Ship (or Archive)

**If the experiment wins:**
- Create a task to ship the winning variant to 100% of users
- Document the result in the experiment log
- Update the product or marketing baseline metrics

**If the experiment loses or is inconclusive:**
- Document what was learned — a null result is still a result
- Identify what would need to be true for a follow-up experiment to succeed
- Archive the experiment with full documentation

## Templates

### Experiment Brief Template

```markdown
## Experiment Brief

**Experiment name**: [short descriptive name, e.g., "post-trade-referral-prompt"]
**Owner**: [agent or human responsible]
**Date created**: YYYY-MM-DD
**Target launch date**: YYYY-MM-DD
**Target close date**: YYYY-MM-DD

### Hypothesis
If we [specific change],
then [measurable outcome],
because [underlying mechanism].

### Primary Metric
- Metric: ___
- Current baseline: ___%
- MDE (absolute): ___pp
- MDE (relative): ___%

### Guardrail Metrics
| Metric | Current value | Max acceptable drop |
|--------|--------------|---------------------|
|        |              |                     |

### Sample Size
- Required per variant: ___
- Total required: ___
- Estimated days to reach: ___

### Variants
**Control**: [description]
**Variant A**: [description]

### Traffic Split
- Split: 50/50
- Assignment unit: user ID
- Flag/tool: ___

### Success Criteria (locked before launch)
- Primary metric lift ≥ ___%
- p < 0.05
- Min runtime: ___ days
- Min sample: ___ per variant

### Pre-Launch Checklist
- [ ] Tracking verified
- [ ] Guardrail tracking verified
- [ ] No experiment collision
- [ ] Rollback plan documented
- [ ] Stakeholder sign-off
```

### Experiment Results Template

```markdown
## Experiment Results

**Experiment name**: ___
**Status**: WON / LOST / INCONCLUSIVE
**Closed date**: YYYY-MM-DD

### Results Summary
| Variant | Conversions | Visitors | Rate | Lift vs Control |
|---------|-------------|----------|------|-----------------|
| Control |             |          |      | —               |
| Variant A |           |          |      |                 |

### Statistical Validity
- p-value: ___
- Confidence: ___%
- Significant: YES / NO
- Sample size met: YES / NO
- Min runtime met: YES / NO

### Guardrail Metrics
| Metric | Control | Variant | Change | Breached? |
|--------|---------|---------|--------|-----------|
|        |         |         |        |           |

### Decision
[WIN → ship | LOSE → archive | INCONCLUSIVE → extend or retest]

### Learnings
1. [What we learned that is now true regardless of win/loss]
2. [What we would change in the next iteration]

### Next Steps
- [ ] [Ship winning variant / task link]
- [ ] [Update baseline metrics]
- [ ] [Follow-up experiment brief if applicable]
```

### Experiment Log Entry Format

```
| Date | Name | Hypothesis Summary | Primary Metric | Result | Lift | p-value | Decision |
```

## Output

Save experiment briefs to: `~/mission-control/library/docs/research/YYYY-MM-DD_experiment_[name]_brief.md`
Save experiment results to: `~/mission-control/library/docs/research/YYYY-MM-DD_experiment_[name]_results.md`
Maintain the running experiment log at: `~/mission-control/library/docs/research/experiment-log.md`

## Examples

**Good task for this skill:** "Design an experiment to test whether a simplified onboarding flow improves D7 retention."

**Good task for this skill:** "The referral prompt experiment has been running 14 days. Evaluate results and make a recommendation."

**Anti-pattern to avoid:** Calling a winner after 2 days with 200 users. Statistical significance requires adequate sample and runtime — no exceptions.

**Escalation trigger:** Any experiment touching user data collection, privacy flows, or financial transactions → route brief to mission-control for review before launch.
