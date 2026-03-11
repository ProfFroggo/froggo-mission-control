# Product Frameworks Reference — Mission Control Platform

Last updated: 2025-03
Context: DeFi / Crypto wallet product (Froggo / onchain platform)

---

## PRD Template

Use this structure for all Product Requirements Documents.

```markdown
# PRD: [Feature Name]

**Status**: Draft / In Review / Approved
**Author**: PM
**Created**: YYYY-MM-DD
**Last updated**: YYYY-MM-DD
**Sprint target**: [Sprint name or Q/month]

---

## Problem Statement

**Who** is affected: [user segment]
**What** they are trying to do: [job to be done]
**Where** it breaks today: [specific failure point]
**Evidence**: [data, support tickets, research findings, quote count]
**Scale**: [how many users, how frequently]

## Goal

One sentence: "Enable [user] to [accomplish job] so that [outcome]."

## Success Metrics

| Metric | Current baseline | Target | Timeframe |
|--------|----------------|--------|-----------|
| [Primary metric] | XX% | YY% | 4 weeks post-ship |
| [Guard rail metric] | XX% | No regression | Ongoing |

## User Stories

### Story 1: [Title]
**As a** [user type]
**I want to** [action]
**So that** [outcome]

**Acceptance Criteria:**
- [ ] [Testable condition 1]
- [ ] [Testable condition 2]
- [ ] [Testable condition 3]

### Story 2: [Title]
...

## Scope

### In scope
- [Item]
- [Item]

### Out of scope (this version)
- [Item — and why]
- [Item — and why]

## Open Questions

| Question | Owner | Due |
|----------|-------|-----|
| [Question] | [agent/person] | [date] |

## Design Notes
[Link to Designer's spec or mockups]

## Technical Constraints
[Any known technical constraints from Coder/Chief]

## Regulatory / Compliance Notes
[Any KYC/AML/jurisdiction flags]

## Dependencies
[Other features, infrastructure, third parties this depends on]
```

---

## Feature Prioritization Matrix

### RICE Scoring

**Formula**: Score = (Reach × Impact × Confidence) ÷ Effort

| Factor | How to score |
|--------|-------------|
| **Reach** | Users affected per month. Count from analytics or estimate with range. |
| **Impact** | 0.25 = minimal, 0.5 = low, 1 = medium, 2 = high, 3 = massive |
| **Confidence** | 80% = strong evidence, 60% = some evidence, 40% = gut feel |
| **Effort** | Person-weeks. Get estimate from Coder before scoring. |

Example:
| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|-----------|--------|-----------|
| Wallet connection retry | 500/mo | 2 | 80% | 0.5 | 1,600 |
| Portfolio view | 2000/mo | 1 | 60% | 4 | 300 |
| Advanced filter | 200/mo | 1 | 40% | 3 | 27 |

Higher RICE = build first, all else equal.

### MoSCoW for Sprint Scope

Applied at the start of sprint planning to sort the candidate backlog:

| Priority | Definition | Rule |
|---------|-----------|------|
| **Must** | Sprint goal fails without this | Maximum 60% of sprint capacity |
| **Should** | High value, sprint still delivers without it | Maximum 30% of capacity |
| **Could** | Nice-to-have, first item dropped if time is short | Maximum 10% of capacity |
| **Won't** | Explicitly parked — named, not forgotten | Logged to backlog with rationale |

Key rule: if "Must" items exceed 60% of capacity, the sprint scope is too large. Push items to "Should" or delay the sprint goal.

### Value vs. Effort Quick Sort

For fast backlog triage before deeper RICE scoring:

```
High Value / Low Effort  → Quick Wins (ship now)
High Value / High Effort → Strategic Bets (plan carefully, validate first)
Low Value / Low Effort   → Fill-ins (only if capacity allows)
Low Value / High Effort  → Avoid (push back hard)
```

### Kano Classification

Before scoring features, classify them:

| Class | Meaning | Implication |
|-------|---------|------------|
| **Must-have** (hygiene) | Expected; absence = strong dissatisfaction | Not a differentiator — table stakes |
| **Performance** | More = better, linearly | Invest proportional to competitive gap |
| **Delighter** | Unexpected; presence = disproportionate satisfaction | Differentiator if unique |
| **Indifferent** | Users don't notice either way | Don't build |
| **Reverse** | Some users dislike this feature | Segment carefully or avoid |

Note: Kano classification drifts over time. Yesterday's delighter becomes today's must-have. Reassess quarterly.

---

## JTBD Interview Framework

Jobs To Be Done interviews reveal the job a user is trying to accomplish, the context in which they're doing it, and the emotional stakes.

### Setup
- Duration: 30-45 minutes
- Format: Conversational, not survey-style
- Target: 5-8 interviews per research question (patterns emerge quickly in a focused user segment)
- Avoid: Showing mockups or feature ideas until after the core job is understood

### Opening Questions (establish context)
1. "Walk me through the last time you [did the thing we're building for]."
2. "Where were you? What were you trying to accomplish?"
3. "What had you tried before that didn't work?"

### Core Job Questions (understand the job)
4. "What does success look like for you in this situation?"
5. "What's the most frustrating part of how you do it today?"
6. "What would make you never go back to the old way?"

### Switching Questions (understand motivation intensity)
7. "Was there a specific moment when you decided [current product/approach] wasn't working?"
8. "What would have to be true for you to switch to something new for this?"

### Synthesis Output

After 5+ interviews, produce a JTBD statement:

```
When I am [situation/context],
I want to [motivation — functional + emotional],
So I can [outcome / desired result].
```

Example:
```
When I check my portfolio in the morning before market hours,
I want to see my total position value and overnight P&L at a glance,
So I can decide if I need to take any action before the market moves.
```

---

## Metrics for a Crypto Wallet Product

### Acquisition
| Metric | Definition | Target context |
|--------|-----------|---------------|
| New wallet connections / day | Wallets that completed connection flow | Rising week-over-week |
| Onboarding completion rate | % who start onboarding and reach first transaction | Compare to DeFi benchmark ~40-60% |
| Channel attribution | Source of new users (organic, referral, paid) | Diversification health |

### Activation (first value moment)
| Metric | Definition | Target context |
|--------|-----------|---------------|
| Day-1 activation rate | % of new users who complete first target action within 24hr | Varies by product; typical goal ≥40% |
| Time to first transaction | Median time from signup to first completed transaction | Reduce sprint-over-sprint |
| Onboarding step drop-off | % abandoning at each step | Identify highest-friction step |

### Retention
| Metric | Definition | Target context |
|--------|-----------|---------------|
| Day-7 retention | % of day-0 cohort returning on day 7 | DeFi benchmark ~20-35% |
| Day-30 retention | % of day-0 cohort returning on day 30 | |
| Monthly Active Wallets (MAW) | Unique wallets with ≥1 transaction in 30 days | Growth target |
| Churn rate | Wallets active in month N absent in month N+1 | Investigate spikes |

### Engagement
| Metric | Definition | Target context |
|--------|-----------|---------------|
| Transactions per active wallet / month | Depth of use | Rising = engagement improving |
| Feature adoption rate | % of active users using a given feature 30 days post-ship | Validates feature need |
| Session frequency | Average sessions per active user per week | |

### Revenue / Volume (if applicable)
| Metric | Definition | Target context |
|--------|-----------|---------------|
| Transaction volume (USD) | Total dollar value transacted | Primary growth health metric |
| Average transaction size | Volume ÷ transaction count | Rising = higher-value users |
| Fee revenue | Platform fee income | |

### Health / Quality
| Metric | Definition | Target context |
|--------|-----------|---------------|
| Transaction success rate | % of initiated transactions that complete successfully | >98% |
| Error rate | % of sessions with a JS or API error | <1% |
| Support ticket rate | Support tickets per 1,000 MAW | Declining = product quality improving |

---

## Sprint Planning Template

```markdown
# Sprint [Number] — [Start Date] to [End Date]

## Sprint Goal
[One sentence: what will users be able to do that they can't do today?]

## Capacity
- Coder: [X hours]
- Designer: [X hours]
- Total: [X person-hours]

## Committed Items (Must + Should)

| Story | Points | Owner | Priority |
|-------|--------|-------|---------|
| [Story title] | X | [agent] | Must |
| [Story title] | X | [agent] | Should |

Total committed: [X points / hours]

## Backlog (Could — drop if needed)
| Story | Points | Notes |
|-------|--------|-------|
| [Story title] | X | First to drop |

## Won't (this sprint — named explicitly)
- [Item]: [reason — pushed to sprint N+1, or waiting on X]

## Success Criteria
- [ ] Sprint goal achieved (testable statement)
- [ ] All Must stories pass QA
- [ ] No regressions in [key area]

## Risks
- [Risk]: [mitigation]
```

---

## A/B Experiment Design Template

```markdown
# Experiment: [Name]

**Owner**: PM
**Status**: Designing / Running / Concluded
**Dates**: [Start] → [End]

## Hypothesis
We believe that [change] will cause [user segment] to [behavior],
because [reasoning / evidence base].

## Variant Description
- **Control**: Current state — [describe]
- **Variant A**: [change description]
- (optional) **Variant B**: [change description]

## Primary Metric
[Single metric that determines success]
**Baseline**: [current value]
**Minimum detectable effect**: [X% change we care about]

## Guard Rail Metrics (must not degrade)
- [Metric]: no regression below [threshold]
- [Metric]: no regression below [threshold]

## Sample Size & Runtime
- Target significance: p < 0.05, 80% power
- Required sample size: [N per variant] — calculated using [tool/formula]
- Estimated runtime: [X days at current traffic volume]

## Decision Criteria (defined in advance)
- Ship Variant: primary metric improves ≥ MDE at p < 0.05 AND no guard rail degradation
- Hold: insufficient significance at runtime end → extend or redesign
- Rollback: guard rail metric degrades > [threshold] at any checkpoint

## Results (fill after)
| Metric | Control | Variant | Delta | Significance |
|--------|---------|---------|-------|-------------|
| [Primary] | | | | |
| [Guard rail] | | | | |

**Decision**: [Ship / Hold / Rollback]
**Learnings**: [What this tells us about user behavior]
```

---

## Competitive Analysis Framework

For DeFi/crypto product landscape tracking.

### Coverage areas
1. **Feature parity audit**: What core features do the top 3-5 competitors have that we don't? What do we have they don't?
2. **Onboarding comparison**: Time to first action, steps required, friction points
3. **UX benchmarks**: Transaction flow, error handling, confirmation UX
4. **Pricing/fee structure**: How do they communicate fees? What's the model?
5. **Community signals**: Discord/Twitter/Reddit sentiment about their product — what are users complaining about?

### Source hierarchy
1. Direct product usage (most reliable)
2. App store reviews + community forums (user-voice)
3. Competitor blog posts and changelogs (self-reported, optimistic)
4. Analyst reports (summarized, often lagging)

### Output format
```markdown
# Competitive Analysis: [Area]
Date: YYYY-MM-DD

## Summary
[2-3 sentences: what's the competitive landscape and where do we stand?]

## Feature Comparison
| Feature | Us | Competitor A | Competitor B | Notes |
|---------|----|----|----|----|
| [Feature] | ✓ | ✓ | ✗ | |

## Key Differentiators (ours)
- [What we do that they don't, meaningfully]

## Gaps (ours)
- [What they do that we don't, that users actually want]

## Recommendations
- [Specific product implications]
```
