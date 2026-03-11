---
name: data-analysis
description: Structured process for conducting a data analysis from request to delivery — including brief definition, query planning, data quality checks, and report formatting.
---

# Data Analysis

## Purpose

Produce analyses that answer specific questions and inform specific decisions. Every analysis starts with a clear question and ends with a recommendation — not just observations. Data without a "so what" is noise.

## Trigger Conditions

Load this skill when:
- A request for data analysis, a report, or a metrics deep-dive arrives
- Investigating a performance anomaly or unexpected metric change
- Validating whether a product change or campaign produced the expected result
- Producing a periodic report (weekly, monthly, quarterly)
- Answering a specific business question with quantitative data

## Procedure

### Step 1 — Write the Analysis Brief

Before touching any data, answer these questions in writing. If you cannot answer them, the request is not ready to be worked on — route back to the requester.

```
Analysis brief:

Question being answered:
[One precise question. "How is the app performing?" is not a question. "What is the 30-day trend in D7 retention rate for users who completed KYC in January?" is a question.]

Decision this informs:
[What will someone do differently based on the answer? If the answer is "nothing" or "it depends," the question may be the wrong question.]

Requester:
[Who asked? Agent or human name]

Deadline:
[When is the answer needed?]

Acceptable data sources:
[Internal DB? Mixpanel? Third-party API? Scraped data? Internal-only or public data OK?]

Output format expected:
[Summary report? CSV export? Chart? Dashboard update? Inline task activity?]
```

### Step 2 — Identify Data Sources

List every source needed before writing a single query. For each:

```
Source 1:
  - Name / tool: [e.g., mission-control DB, Mixpanel, on-chain data API]
  - Access method: [MCP tool / SQL / API endpoint]
  - Tables or events relevant: [e.g., `users`, `transactions`, `funnel_events`]
  - Date range available: [how far back does data go?]
  - Known limitations: [e.g., "only tracks web, not mobile," "30-day lookback limit"]

Source 2: ...
```

Flag any gaps: if a required data source is unavailable or unreliable, surface this before starting work, not after. A flawed analysis delivered confidently is worse than a delayed analysis delivered honestly.

### Step 3 — Write the Query Plan

Write the logic of the analysis in plain language before writing SQL or API calls. This catches errors before they waste computation time and makes peer review faster.

```
Query plan:

Step 1: Pull all users who [condition] from [source] for [date range]
Step 2: Join to [table] on [key] to get [additional fields]
Step 3: Filter to [subset] because [reason — e.g., exclude test accounts, exclude incomplete records]
Step 4: Aggregate by [dimension] to get [metric]
Step 5: Compare [group A] vs [group B] on [metric]
Step 6: Calculate [derived metric] as [formula]
```

Only write actual queries after the plan is written and reviewed. Complex analyses should have plans reviewed before execution.

### Step 4 — Execute Queries

When writing SQL:

- Always use a `LIMIT` on exploratory queries until you know the data volume
- Always include a `WHERE` clause limiting date range — unbounded queries on large tables are slow and expensive
- Add comments in the query explaining what each clause does — especially joins and filters
- Save every query used, with description, to the analysis output file (reproduceability is required)

```sql
-- Query 1: Get D7 retention rate for January KYC cohort
-- Users who completed KYC in January 2025 and returned within 7 days
SELECT
  DATE(kyc_completed_at) AS kyc_date,
  COUNT(DISTINCT u.id) AS cohort_size,
  COUNT(DISTINCT CASE WHEN e.event_date <= DATE(u.kyc_completed_at, '+7 days') THEN e.user_id END) AS retained_d7,
  ROUND(
    COUNT(DISTINCT CASE WHEN e.event_date <= DATE(u.kyc_completed_at, '+7 days') THEN e.user_id END) * 100.0
    / COUNT(DISTINCT u.id), 2
  ) AS d7_retention_rate
FROM users u
LEFT JOIN events e ON u.id = e.user_id AND e.event_type = 'session_start'
WHERE u.kyc_completed_at >= '2025-01-01'
  AND u.kyc_completed_at < '2025-02-01'
  AND u.test_account = 0  -- exclude test accounts
GROUP BY DATE(kyc_completed_at)
ORDER BY kyc_date;
```

### Step 5 — Data Quality Checks

Before drawing any conclusions, validate the data. Do not skip this step. Analysts who skip data quality checks produce wrong answers with confidence.

**Check 1: Null / missing data**
```sql
-- Check for unexpected nulls in key fields
SELECT
  COUNT(*) AS total_rows,
  COUNT(user_id) AS non_null_user_id,
  COUNT(created_at) AS non_null_created_at,
  COUNT(kyc_completed_at) AS non_null_kyc_date
FROM users
WHERE created_at >= '2025-01-01';
```

Document: What % of rows have nulls in key fields? Is this expected? Does it affect the analysis?

**Check 2: Outliers and unexpected distributions**
```sql
-- Check metric distribution before aggregating
SELECT
  MIN(transaction_amount) AS min_val,
  AVG(transaction_amount) AS avg_val,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY transaction_amount) AS median_val,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY transaction_amount) AS p95_val,
  MAX(transaction_amount) AS max_val
FROM transactions
WHERE created_at >= '2025-01-01';
```

Flag: If max is dramatically different from p95, there are outliers. Document whether to include, exclude, or cap them.

**Check 3: Unexpected row counts**
- Does the row count match what you expect for the period?
- Are there date gaps (days with zero events) that look like missing data vs. genuine zeros?

**Check 4: Duplicate detection**
```sql
-- Check for duplicate user records
SELECT user_id, COUNT(*) as cnt
FROM users
GROUP BY user_id
HAVING COUNT(*) > 1;
```

**Check 5: Cross-source consistency**
If using multiple data sources, verify totals agree within a reasonable margin (usually ±5%). If they don't, understand why before proceeding.

Document all quality issues found and how they were handled. Quality issues that are not documented become silent errors.

### Step 6 — Structure the Analysis

Follow this structure for all analyses. It ensures the output is decision-ready, not just data-rich.

```
1. Summary (3-5 sentences)
   The bottom-line answer to the question, up front. Do not make the reader page through 10 tables to find the answer.

2. Findings
   The data that supports the summary. Tables, numbers, comparisons.
   Each finding stated as a declarative sentence with the supporting number.
   Example: "D7 retention for January KYC completers is 28%, down 5pp vs. December."

3. So What (interpretation)
   What does this mean for the business or the decision?
   Connect the finding to the decision the analysis was meant to inform.

4. Recommendation
   What should be done differently based on this data?
   Be specific: "Pause the onboarding email series and retest with a shorter version" beats "improve onboarding."

5. Caveats and limitations
   What the data does NOT tell you. What assumptions were made. What would invalidate the conclusion.

6. Queries and methodology
   Every query used, in full, with explanatory comments.
```

### Step 7 — Visualization Selection

Use the right chart type for the data. Never use a chart just to have a chart.

| Data situation | Chart type |
|---------------|------------|
| Change over time (single metric) | Line chart |
| Change over time (multiple metrics) | Line chart with multiple series (max 4–5) |
| Comparing values across categories | Bar chart (horizontal if labels are long) |
| Part-to-whole relationship | Stacked bar or pie (pie: only if ≤5 segments) |
| Distribution of a metric | Histogram |
| Correlation between two metrics | Scatter plot |
| Funnel / conversion steps | Funnel chart |
| Single number that matters | Large number + context (vs. target, vs. prior period) |

Chart formatting requirements:
- Always label axes with units
- Always show the baseline or target if relevant
- Do not use 3D charts
- Do not use more than 5 colors in a single chart
- Use consistent color conventions (red = bad, green = good — unless colorblind-safe palette required)

### Step 8 — Peer Review Before Delivery

For any analysis that will inform a significant decision ($1,000+ spend, product change, strategic direction), request a review from another agent or human before delivering.

Peer reviewer checklist:
- [ ] Does the query logic match what's described in the query plan?
- [ ] Are the date ranges and filters correct?
- [ ] Are there any obvious data quality issues not documented?
- [ ] Does the "So What" follow logically from the findings?
- [ ] Is the recommendation specific and actionable?
- [ ] Are caveats and limitations honestly stated?

### Step 9 — Deliver and Document

Deliver the analysis in the format requested. If no format was specified, deliver as a structured Markdown report saved to the library.

Always include at the top of every report:
```
Analysis: [Title]
Date: YYYY-MM-DD
Analyst: [agent name]
Period: [date range analyzed]
Data sources: [list]
Question answered: [exact question from brief]
```

## Analysis Report Template

```markdown
# Analysis: [Title]

**Date**: YYYY-MM-DD
**Analyst**: [agent name]
**Period analyzed**: YYYY-MM-DD to YYYY-MM-DD
**Data sources**: [list]
**Question**: [Exact question this answers]
**Decision it informs**: [What action or decision depends on this]

---

## Summary

[3-5 sentences. The answer, up front, in plain English. Include the key number.]

---

## Findings

### Finding 1: [Declarative headline]
[Data, table, or chart supporting this finding]

| Dimension | Metric | Value | vs. Prior Period | vs. Target |
|-----------|--------|-------|-----------------|------------|
|           |        |       |                 |            |

### Finding 2: [Declarative headline]
[Data]

### Finding 3: [Declarative headline]
[Data]

---

## So What

[2-4 sentences. What do these findings mean for the business? Connect data to decision.]

---

## Recommendation

1. [Specific action — who does what by when]
2. [Specific action]
3. [Specific action]

**Confidence level**: High / Medium / Low — because [reason]

---

## Caveats and Limitations

- [Limitation 1: what the data doesn't cover]
- [Limitation 2: assumption made]
- [What would change this conclusion]

---

## Methodology

### Data Sources Used
- [Source 1]: [what was pulled, date range]
- [Source 2]: [what was pulled, date range]

### Data Quality Notes
- [Any nulls, outliers, or gaps found and how handled]

### Queries

**Query 1: [Description]**
```sql
[full query]
```

**Query 2: [Description]**
```sql
[full query]
```
```

## Output

Save analysis reports to: `~/mission-control/library/docs/research/YYYY-MM-DD_analysis_[topic].md`
Save raw query files to: `~/mission-control/library/docs/research/YYYY-MM-DD_queries_[topic].sql`

## Examples

**Good task for this skill:** "Why did our D30 retention drop 8pp in February? Analyze by cohort, channel, and onboarding completion status."

**Good task for this skill:** "Generate the weekly metrics report for the dashboard — MAU, conversion rate, average transaction volume, and top 5 trading pairs by volume."

**Anti-pattern to avoid:** Reporting data without context. "MAU is 12,400" is not an analysis. "MAU is 12,400, up 8% MoM but 12% below our Q1 target of 14,100, driven primarily by a slowdown in new user activation" is an analysis.

**Escalation trigger:** Any analysis that reveals a potential data breach, security issue, or unexplained financial anomaly → pause analysis, route to mission-control immediately, do not document findings in the library until cleared.
