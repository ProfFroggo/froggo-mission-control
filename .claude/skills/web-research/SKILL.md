---
name: web-research
description: Systematic process for researching topics on the web — gathering, evaluating, and synthesizing information from multiple sources into structured reports.
---

# Web Research

## Purpose

Produce well-sourced, credible research by following a structured search-and-synthesis loop. Avoid single-source conclusions, validate claims across sources, and always surface contradictions rather than hiding them.

## Trigger Conditions

Load this skill when:
- Assigned a task that requires gathering information from external sources
- Asked to investigate a company, product, technology, or market
- Comparing multiple approaches, tools, or vendors
- Fact-checking a claim or assumption
- Building a competitive landscape or market overview

## Procedure

### Step 1 — Define Scope
Before searching, write out:
- The primary research question (one sentence)
- Sub-questions to answer (max 5)
- What "done" looks like (deliverable type: report, comparison table, summary)
- Time horizon: current data only, or historical also?

### Step 2 — Keyword Planning
Identify 3–5 search query variants:
- Narrow and specific ("Solana DEX volume Q4 2024")
- Broad and exploratory ("DEX market share 2024")
- Alternative framing ("decentralized exchange trends crypto")

Avoid duplicate queries. Cover different angles of the same question.

### Step 3 — Primary Search Pass
Use `WebSearch` or `WebFetch` to gather sources:
1. Run each query variant
2. Collect the 3 most relevant results per query
3. Note: URL, title, publication date, and a 1-sentence relevance summary for each

**Do not write conclusions yet.** Gather first.

### Step 4 — Source Evaluation
Before citing any source, evaluate:

| Criterion | Check |
|-----------|-------|
| Recency | Is it current enough for this question? |
| Authority | Is the source credible (official docs, reputable publications, primary data)? |
| Bias | Does the source have an obvious agenda? |
| Specificity | Does it address the actual question, or just adjacent topics? |

Discard sources that fail 2+ criteria.

### Step 5 — Deep Read & Note-Taking
For each retained source:
- Extract 3–5 key facts or data points
- Note any caveats or conflicting signals the source itself raises
- Tag: `CONFIRMED` (seen in 2+ independent sources) or `UNVERIFIED` (single source only)

### Step 6 — Synthesis
Write findings in this order:
1. **Answer the primary question** in 2–3 sentences
2. **Supporting evidence** — facts tagged `CONFIRMED` first, `UNVERIFIED` clearly labeled
3. **Contradictions or open questions** — never suppress conflicts in the data
4. **Gaps** — what you could not find and why it matters

### Step 7 — Save & Report
- Save research report to `library/docs/research/YYYY-MM-DD_research_<topic>.md`
- Include date gathered, sources list, and research questions at top of file
- Post summary to task activity log

## Output Format

```
## Research Report: [Topic]
Date: YYYY-MM-DD
Research question: ...

### Summary
[2-3 sentence direct answer]

### Key Findings
1. [Finding] — Source: [URL] (CONFIRMED / UNVERIFIED)
2. ...

### Contradictions & Open Questions
- ...

### Sources
- [Title] — [URL] — [Date published]
```

## Examples

**Good task for this skill:** "Research the top 5 community Discord bots for engagement tracking and compare their pricing models."

**Bad fit (use codebase tools instead):** "Investigate why the API is returning 500 errors." — Use Grep, Read, Bash.

**Good escalation trigger:** Source content is paywalled, requires login, or returns no usable results → log in task activity and continue with available data.
