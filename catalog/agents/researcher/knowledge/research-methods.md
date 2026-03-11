# Research Methods Reference — Mission Control Platform

Last updated: 2025-03
Context: DeFi / Crypto platform research

---

## Structured Research Protocol

Follow this protocol for every research task, regardless of scope.

### Phase 1: Question Clarification (before searching)
1. State the exact question in one sentence
2. Identify the decision this research supports
3. Name the minimum confidence level required for that decision
4. List the 2-3 most likely answers (expected range)
5. Identify what would disprove the expected answer

If the question cannot be stated in one sentence, it's more than one question. Split it.

### Phase 2: Source Planning (before reading)
1. Identify where primary sources live for this question type
2. List secondary sources as fallbacks
3. Note which sources have known biases for this topic
4. Set a staleness threshold (how old can data be?)

### Phase 3: Collection
1. Start with the most authoritative primary source
2. Cross-reference with at least 2 independent sources for any factual claim
3. Note date and provenance for every piece of evidence
4. Flag anything that conflicts with other findings immediately — don't defer
5. Actively search for disconfirming evidence

### Phase 4: Synthesis
1. Identify the central finding that answers the original question
2. Assign a confidence level to the central finding
3. Note supporting findings and their individual confidence levels
4. Surface any contradictions and explain them
5. Identify what remains unknown

### Phase 5: Report
Use the standard output structure (see below).

---

## Standard Research Report Structure

```markdown
# Research: [Topic / Question]

**Date:** YYYY-MM-DD
**Requested by:** [agent or user]
**Question:** [exact one-sentence question]
**Decision supported:** [what will this inform?]
**Confidence level:** High / Medium / Low

---

## Summary (3-5 sentences)
[The central finding and its confidence level, in plain language.
A reader who reads only this should get the essential answer.]

## Key Findings

1. **[Finding]** — [source, date] [Confidence: Strong/Moderate/Weak]
2. **[Finding]** — [source, date] [Confidence: Strong/Moderate/Weak]
3. **[Finding]** — [source, date] [Confidence: Strong/Moderate/Weak]
...

## Contradictions / Conflicts
[If sources disagree, document it here with both sides and the likely explanation]

## Sources

| Source | URL or location | Date | Source type | Known bias |
|--------|----------------|------|-------------|-----------|
| [Name] | [url] | [date] | Primary/Secondary/Opinion | [note] |
...

## Confidence Assessment

**Central finding confidence**: [Strong/Moderate/Weak]

[Reasoning: what drives this confidence level — source quality, consistency,
primary vs secondary, data freshness]

## Staleness Warnings
[Any findings that are older than the threshold for this question type]

## Open Questions
[What this research could not answer. What would be needed to answer it.]
```

---

## Source Quality Hierarchy

### Tier 1 — Primary Sources
Direct evidence. Highest reliability.
- On-chain data (Etherscan, blockchain explorers) — permanent, immutable
- Official protocol documentation and changelogs
- Regulatory body publications (SEC, CFTC, FCA, etc.)
- Verified on-chain analytics platforms (Dune Analytics, Glassnode, Nansen, DefiLlama)
- Your own product's analytics database
- Direct user interview transcripts

### Tier 2 — Independent Analysis
Analysis performed on primary data by an independent third party.
- Independently verified DeFi research (Messari, The Block Research)
- Academic papers with methodology disclosed
- Audit reports from established security firms (Trail of Bits, Certik, OpenZeppelin)
- Third-party competitive intelligence with stated methodology

### Tier 3 — Secondary Synthesis
Summaries of Tier 1 and 2 by a party with potential agenda.
- News articles (CoinDesk, The Block, Decrypt) — verify the underlying primary source
- Protocol team blog posts — optimistic by incentive
- Competitor marketing materials — optimistic by design
- Analyst reports from firms with business interests in covered protocols

### Tier 4 — Opinion / Speculation
No evidentiary basis.
- Social media posts (including from credible individuals)
- Discord/Telegram community claims
- Anonymous forum posts (Reddit, CT)
- Predictions without stated methodology

**Rule**: Never present Tier 3 or 4 claims as established fact. Always attribute and confidence-label them.

---

## Validating Claims in the Crypto / DeFi Space

The DeFi information environment has uniquely high noise. Apply these specific validation steps:

### For TVL / Protocol Metrics Claims
1. Find the source (usually DefiLlama or DeFiPulse)
2. Check: is TVL denominated in native token (inflatable) or USD-normalized?
3. Check: does it include protocol-owned liquidity (POL)? POL is not user capital.
4. Check the time period — TVL can double in a week and halve the next; point-in-time claims mislead
5. Cross-reference with Dune Analytics if a specific protocol's methodology is uncertain

### For "X protocol was hacked / lost funds" Claims
1. Look for the post-mortem from the protocol team (primary source)
2. Cross-reference with blockchain explorer transaction records
3. Distinguish between exploit (code vulnerability), governance attack, and rug pull — different risk signals
4. Note whether funds were recovered (some exploits are partially recovered via negotiations or white-hat)

### For Regulatory Claims
1. Link to the primary regulatory document (the actual ruling, guidance, or proposed rule)
2. Note the jurisdiction precisely — US SEC, EU MiCA, UK FCA, etc.
3. Note the effective date and whether it is final, proposed, or interpretive guidance
4. Note what entity types it applies to (registered broker-dealers, unlicensed platforms, all users, etc.)
5. Flag: regulatory claims go stale fast. Date prominently.

### For Competitive Feature Claims
1. Use the product yourself if possible — announcement ≠ shipped feature
2. Check app store reviews for user experience of the claimed feature
3. Check the competitor's changelog or release notes
4. Check community (Discord/Twitter) for user experience signal on the feature
5. Note the date the feature shipped (not announced)

### For User Behavior Claims ("users prefer X" / "users do Y")
1. Is this a user survey (stated preference) or usage data (revealed preference)?
2. What is the sample size and selection method?
3. What user segment is this from? Power users in a Discord ≠ median user
4. Is this from the product team (optimistic bias) or independent research?
5. Look for converging signals from multiple independent sources

---

## Competitive Analysis Framework

### What to Track

| Category | What to look for | Source |
|---------|-----------------|--------|
| Feature parity | What core features do they have? | Direct product use |
| Onboarding experience | Steps, friction, time to first value | Direct walkthrough |
| Transaction UX | Speed, confirmation, error handling | Direct use |
| Fee structure | How fees are calculated and communicated | Landing page + help docs |
| Community health | Size, activity, sentiment | Discord, Twitter, Reddit |
| Development velocity | How fast are they shipping? | Changelog, GitHub activity |
| User complaints | What users dislike | App store reviews, community |
| User praise | What users love | Same sources |

### Competitive Intelligence Sources (DeFi specific)
- **Protocol changelogs**: most reliable feature tracking
- **Job postings**: signals strategic direction (hiring a ZK proof engineer = ZK feature coming)
- **On-chain activity**: growing or shrinking TVL/active addresses is observable
- **App store reviews**: unfiltered user experience
- **Twitter/X community sentiment**: directionally useful, not analytically precise
- **Discord "support" channel**: concentrated pain point signal from actual users

### Output Template
```markdown
## Competitive Analysis: [Competitor / Area]
Date: YYYY-MM-DD

### Summary
[Where this competitor stands relative to us, and what's changed recently]

### Feature Comparison
| Feature | Us | [Competitor] | Notes |
|---------|----|----|-----|
| [Feature] | Live | Announced, not live | Their announcement: [link] |
| [Feature] | No | Live since [date] | User reviews: [signal] |

### Their Strengths
- [Specific strength with evidence]

### Their Weaknesses (user-reported)
- [Specific weakness with source — app store reviews, community complaints]

### Trajectory
[Direction they're heading based on hiring, changelog, community focus]

### Differentiation Opportunity
[Where the gap is that users are asking for but nobody is doing well]
```

---

## Research Decay Rates

Different types of information have different shelf lives. Always date findings and apply these thresholds:

| Information type | Usable age | Action when older |
|----------------|------------|-------------------|
| On-chain metrics (price, TVL, volume) | < 24 hours | Re-query |
| Protocol-specific data (TVL, user counts) | < 7 days | Re-query |
| Competitive feature comparison | < 30 days | Re-verify by using the product |
| User research / survey data | < 3 months | Flag as potentially stale |
| Market sizing / TAM estimates | < 6 months | Flag as stale; note macro changes |
| Technical documentation | < 6 months | Check version; docs can lag implementation |
| Regulatory landscape | Variable | Always date; can change overnight |
| Academic / behavioral research | < 2 years for DeFi; < 5 years for general UX | Use with caution on DeFi-specific claims |

---

## Confidence Level Vocabulary

Use these exact terms to maintain consistent calibration across reports:

### Strong Evidence
- Multiple independent primary sources
- Consistent findings with no significant contradictions
- Recent (within staleness threshold)
- Language: "The evidence strongly indicates...", "The data confirms...", "It is well-established that..."

### Moderate Evidence
- Limited primary sources, or some dependency on secondary
- Directionally consistent but with variation or gaps
- Near the staleness threshold
- Language: "Evidence suggests...", "Available data indicates...", "Research points toward..."

### Weak Evidence
- Single source, or source with known strong bias
- Indirect, inferential, or analogical
- Near or beyond staleness threshold
- Language: "There are indications that...", "Some evidence hints at...", "It is possible that..."

### No Evidence
- No data found
- Claims only from incentivized parties with no independent corroboration
- Language: "No evidence was found for...", "The research could not confirm...", "This claim is unsubstantiated in available sources."

**Never use hedge language to obscure the confidence level.** "It seems like it might be the case" is weak evidence labeled as opinion. State the confidence tier explicitly.

---

## Research Report Checklist

Before submitting any research report, verify:

- [ ] The question being answered is stated explicitly in one sentence
- [ ] Every factual claim has a source with a date
- [ ] Each claim is labeled with a confidence level (Strong/Moderate/Weak)
- [ ] Any contradictions between sources are surfaced and explained
- [ ] Information older than the staleness threshold is flagged
- [ ] The summary accurately reflects the findings (no overclaiming)
- [ ] Open questions are explicitly named
- [ ] Source types are identified (Primary/Secondary/Opinion)
- [ ] The central finding is in the summary — readable without the full report
- [ ] No file modifications were made during research
