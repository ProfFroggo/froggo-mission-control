---
name: research-brief
description: Process for scoping, conducting, and delivering a research brief — from question definition through synthesis, confidence labeling, and final report.
---

# Research Brief

## Purpose

Produce research that answers specific questions with traceable evidence and honest confidence levels. Every claim in a research output is labeled with its source and confidence. Undocumented opinions are not research — they are guesses wearing research clothes.

## Trigger Conditions

Load this skill when:
- A specific question needs answering before a decision can be made
- Gathering competitive intelligence on a market, product, or player
- Investigating a technical topic, protocol, or on-chain phenomenon
- Scoping what is known vs. unknown before a strategy doc is written
- Validating an assumption before building an experiment or PRD on top of it
- Synthesizing prior research into a structured summary

## Procedure

### Step 1 — Write the Research Brief (Before Any Research Begins)

Do not begin gathering information until the brief is complete. Unscoped research produces unstructured outputs.

```markdown
## Research Brief

**Question**: [One precise research question. Not a topic. A question with a specific answer.]
**Decision this informs**: [What action or decision depends on the answer?]
**Requester**: [Agent or human name]
**Deadline**: [When the output is needed]
**Acceptable sources**:
  - [ ] Web search (public information)
  - [ ] Internal data / DB
  - [ ] Agent memory / prior research in library
  - [ ] On-chain data (Birdeye, Solana explorer, etc.)
  - [ ] Third-party APIs
  - [ ] Primary sources only (no secondary synthesis)
**Depth required**: [Quick scan (30 min) / Standard brief (2-4 hrs) / Deep research (full task)]
**Output format**: [Summary paragraph / Structured report / Bullet list for deck / Raw findings + analysis]
**Known context**: [What we already know or believe about this topic — starting assumptions]
**What "done" looks like**: [Specific deliverable that satisfies this brief]
```

The question must be specific. Examples:

| Bad (topic, not question) | Good (specific question) |
|--------------------------|-------------------------|
| "Research our competitors" | "What is the fee structure of the top 5 DeFi lending protocols by TVL on Solana as of this month?" |
| "Look into user retention" | "What retention tactics do consumer crypto apps use between D1 and D30, and which have published efficacy data?" |
| "Find out about regulations" | "What are the current KYC requirements for crypto exchanges operating in Mexico, Brazil, and Colombia?" |

### Step 2 — Identify and Prioritize Sources

Before searching, map the source landscape. Different source types have different reliability and speed trade-offs.

```
Source hierarchy (highest to lowest reliability):
  Tier 1 — Primary sources: Official documentation, regulatory filings, on-chain data, academic papers, direct company statements
  Tier 2 — Reputable secondary: Major journalism (Bloomberg, Reuters, WSJ), industry analysts (Messari, DeFiLlama), peer-reviewed synthesis
  Tier 3 — Community / informal: Twitter/X threads, Discord discussions, Reddit, blog posts
  Tier 4 — AI-generated / uncited: Use only for orientation, never as a source for a claim
```

For each source type needed:

```
Source plan:
  1. Check agent memory and library first: `~/mission-control/library/docs/research/`
     → Search for prior research on this topic before duplicating work
  2. Web search: [planned search queries]
  3. Internal data: [specific tables or reports to check]
  4. On-chain data: [specific contracts, tokens, or metrics to pull]
  5. API calls: [specific endpoints or tools]
```

### Step 3 — Check Prior Research First

Before any external search, check the local library. Prior research may already contain the answer or a starting point.

```
Search library for prior research:
  ~/mission-control/library/docs/research/
  → Look for files matching the topic, date range, or requester
  → Check ~/mission-control/memory/ for agent memory on the topic
```

If prior research exists: review it, note what is still current and what may be stale, and build on it rather than starting from scratch. Document what was inherited from prior research vs. newly gathered.

### Step 4 — Execute Research

Work through the source plan systematically. For each piece of information gathered:

**Capture in raw findings format:**
```
Claim: [the fact, data point, or observation]
Source: [URL / tool / internal / memory — be specific]
Source tier: [1 / 2 / 3 / 4]
Date: [when was this published or retrieved?]
Confidence: [high / medium / low — see confidence labeling below]
Notes: [any caveats, context, or contradicting information]
```

Do not summarize as you go. Collect raw findings first, synthesize in the next step.

**Confidence labeling rules:**

| Label | Criteria |
|-------|----------|
| `high` | Directly from a primary source, verified by cross-reference, recent (< 6 months for fast-moving topics) |
| `medium` | Secondary source, or primary but unverified / potentially outdated |
| `low` | Community source, single source only, older than 12 months, or contradicted by other sources |
| `unverified` | Found but unable to confirm — include for completeness but mark clearly |

**Every claim in the final output must have a confidence label.** A report with unlabeled claims is not acceptable — it implies false certainty.

### Step 5 — Handle Conflicting Evidence

When sources contradict each other:

1. Document both sides in raw findings with their sources
2. Note the nature of the conflict (factual contradiction? Different time periods? Different methodologies? Different jurisdictions?)
3. Assess which source is more reliable using the tier hierarchy
4. In the final synthesis, present the conflict honestly:
   - "Source A states X (Tier 1, high confidence). Source B states Y (Tier 3, low confidence). The weight of evidence favors X, but this is not settled."
5. Do not silently pick one and discard the other — surface the conflict in the output

If the conflict cannot be resolved: label the topic as `contested` and recommend commissioning primary research or reaching out to a primary source directly.

### Step 6 — Synthesize: Raw Findings → Patterns → Insights → Recommendations

Synthesis is not summarization. Summarization describes what the sources said. Synthesis draws meaning from what the sources said.

**Step 6a — Group raw findings into patterns**
Look at all raw findings. What do multiple sources agree on? Where do they cluster? Group into 3-7 patterns.

**Step 6b — Derive insights from patterns**
Each pattern produces one insight: a declarative statement of what is true, based on the pattern, that is not obvious from any single source.

Example:
- Pattern: "5 out of 6 top DeFi lending protocols reviewed charge 0-0.1% origination fees but make the majority of revenue on liquidation penalties."
- Insight: "In the current DeFi lending market, origination fee competition has driven rates to near-zero, making protocol revenue highly dependent on market volatility events."

**Step 6c — Derive recommendations from insights**
For each insight that is decision-relevant, produce one recommendation:
- Specific enough to act on
- Scoped to the decision the research was meant to inform
- Labeled with confidence (because recommendations inherit the confidence of the insights they come from)

### Step 7 — Write the Research Report

```markdown
# Research Report: [Title]

**Date**: YYYY-MM-DD
**Researcher**: [agent name]
**Question answered**: [Exact question from brief]
**Decision informed**: [What this enables]
**Sources used**: [count by tier: Tier 1: X, Tier 2: Y, Tier 3: Z]
**Research depth**: [Quick scan / Standard / Deep]

---

## Summary

[3-5 sentences. The direct answer to the research question, in plain language.
State the overall confidence in the answer: high / medium / low.]

---

## Key Findings

### Finding 1: [Declarative headline]
**Confidence**: high / medium / low
[2-4 sentences of supporting evidence with sources cited inline as (Source: [name/URL])]

### Finding 2: [Declarative headline]
**Confidence**: high / medium / low
[Supporting evidence]

### Finding 3: [Declarative headline]
**Confidence**: medium
[Supporting evidence]

---

## Contested or Uncertain Areas

[Document any claims where sources conflict, where confidence is low, or where the answer is "we don't know yet."]

| Topic | What's uncertain | Why | Confidence |
|-------|-----------------|-----|------------|
|       |                 |     | low |

---

## Recommendations

1. [Specific recommendation — confidence: high / medium / low]
2. [Specific recommendation — confidence: high / medium / low]
3. [Specific recommendation — confidence: high / medium / low]

---

## What This Research Does Not Cover

[Be explicit about scope boundaries. What questions remain open? What would require additional research to answer?]

---

## Sources

| # | Source | URL / Reference | Tier | Date accessed |
|---|--------|-----------------|------|---------------|
| 1 | | | | |

---

## Raw Findings (for audit trail)

[Optional: include raw findings log for complex research. Enables future researchers to audit the synthesis.]
```

### Step 8 — Peer Review (for High-Stakes Research)

For research that will inform a significant product, financial, or strategic decision — have another agent or the human owner review before delivery.

Reviewer checks:
- [ ] Does every claim in the findings have a source?
- [ ] Are confidence labels used consistently?
- [ ] Are conflicting sources documented (not silently resolved)?
- [ ] Does the recommendation follow logically from the findings?
- [ ] Is the scope clearly stated (what is and isn't covered)?

### Step 9 — Deliver and Archive

Deliver the report in the format requested. Always include the brief alongside the report so future researchers understand the scope.

Save to library. Future research tasks should check here before starting from scratch.

## Quick Brief Template (for fast research tasks)

```markdown
## Quick Research Brief
Question: ___
Decision: ___
Deadline: ___
Sources OK: web search / internal / on-chain / all
Depth: quick scan

## Raw Findings
1. [Claim] — Source: ___ — Confidence: ___
2. [Claim] — Source: ___ — Confidence: ___

## Summary Answer
[Direct answer to question, 2-3 sentences]
Overall confidence: high / medium / low

## Source List
1.
2.
```

## Output

Save research reports to: `~/mission-control/library/docs/research/YYYY-MM-DD_research_[topic].md`
Save raw findings (for complex research) to: `~/mission-control/library/docs/research/YYYY-MM-DD_research_[topic]_raw.md`

## Examples

**Good task for this skill:** "Research the current regulatory landscape for crypto lending products in Latin America. We need this to inform our product roadmap decision."

**Good task for this skill:** "What on-chain metrics best predict a token's 30-day price performance? Gather existing research and synthesize findings."

**Anti-pattern to avoid:** Presenting uncertain findings with high confidence. It is always better to say "medium confidence — single source" than to present a claim as definitive. Decision-makers calibrate on confidence. False confidence leads to bad decisions.

**Escalation trigger:** If research uncovers a potential legal, regulatory, or security risk for the platform → pause and route to mission-control immediately with a human-review task before completing the report.
