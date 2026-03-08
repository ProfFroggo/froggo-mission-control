---
name: financial-model
description: Process for building financial models, budget analyses, cost-benefit comparisons, and revenue forecasts — from raw data to structured financial output.
---

# Financial Model

## Purpose

Produce rigorous, assumption-transparent financial analyses. Every model must show its inputs, assumptions, and reasoning — conclusions without traceable data are not acceptable.

## Trigger Conditions

Load this skill when:
- Building or updating a budget (monthly, quarterly, annual)
- Analyzing a spend request or cost-benefit decision
- Forecasting revenue, runway, or unit economics
- Comparing subscription costs or vendor pricing
- Generating a financial report for mission-control or the owner

## Procedure

### Step 1 — Define the Question
State clearly:
- What financial question is being answered?
- What decision will this analysis inform?
- What time horizon applies (monthly, quarterly, annual, multi-year)?

### Step 2 — Identify Data Sources
List all inputs needed:
- Existing budget files (check `library/docs/research/` for prior finance reports)
- Known fixed costs (subscriptions, tooling, headcount)
- Variable costs (usage-based APIs, campaign spend)
- Revenue or income data if applicable

**Never invent numbers.** If a data point is missing, flag it as an assumption with a range estimate.

### Step 3 — Structure the Model

Use this standard layout for any model:

```
INPUTS (facts and confirmed data)
├── Revenue: ...
├── Fixed costs: ...
└── Variable costs: ...

ASSUMPTIONS (estimates with rationale)
├── Growth rate: X% — based on [source/rationale]
└── Churn rate: Y% — based on [source/rationale]

CALCULATIONS
├── Gross margin: Revenue − COGS
├── Operating expenses: Fixed + Variable
└── Net: Gross margin − OpEx

OUTPUTS
├── Monthly burn rate
├── Runway (months)
└── ROI or payback period (if applicable)
```

### Step 4 — Run Scenarios

For any recommendation, produce 3 scenarios:
- **Conservative:** Pessimistic assumptions (worst-case inputs)
- **Base:** Most likely assumptions
- **Optimistic:** Best-case inputs

Label each scenario clearly. Never present only the base case.

### Step 5 — Validate

Before finalizing:
- Do totals add up? Verify arithmetic.
- Are all assumptions explicitly stated and defensible?
- Are currency, units, and time periods consistent throughout?
- Flag any input that has >20% uncertainty as HIGH RISK.

### Step 6 — Approval Gate

Any recommendation involving fund movement or budget reallocation:
1. Draft recommendation with rationale
2. Mark task as `human-review` — do NOT approve your own financial recommendations
3. Include: amount, purpose, expected ROI, risk level

### Step 7 — Save & Report
- Save to `library/docs/research/YYYY-MM-DD_finance_<description>.md`
- Strategy docs to `library/docs/stratagies/YYYY-MM-DD_strategy_<description>.md`
- Include data range, sources, and scenario summary at top of file

## Output Format

```
## Financial Analysis: [Title]
Date: YYYY-MM-DD
Period: [Q1 2025 / FY 2025 / etc.]
Question: [What this answers]

### Summary
[3-sentence executive summary with the key number and recommendation]

### Inputs
| Item | Value | Source |
|------|-------|--------|
| ... | ... | ... |

### Assumptions
| Assumption | Value | Rationale |
|------------|-------|-----------|
| ... | ... | ... |

### Scenarios
| Scenario | Monthly Burn | Runway | Net |
|----------|-------------|--------|-----|
| Conservative | ... | ... | ... |
| Base | ... | ... | ... |
| Optimistic | ... | ... | ... |

### Recommendation
[Approve / Deny / Conditional — with clear reasoning]

### Risk Flags
- [Any HIGH RISK inputs or assumptions]
```

## Examples

**Good task for this skill:** "Analyze Q1 API costs and model what happens if usage doubles in Q2."

**Good task for this skill:** "Is $500/month on the new analytics tool justified by the time it saves?"

**Escalation trigger:** Any recommendation over $1,000 or touching treasury funds → always route to `human-review`. Finance Manager never self-approves.
