---
name: paid-campaign-launch
description: Pre-launch checklist and process for paid campaigns across Google, Meta, X, and Reddit — from creative approval to first-24h monitoring and kill-switch criteria.
---

# Paid Campaign Launch

## Purpose

Launch paid campaigns that are tracking-clean, compliance-safe, structurally sound, and actively monitored from the moment they go live. A campaign that launches without verified tracking is worse than no campaign — it burns budget with no signal.

## Trigger Conditions

Load this skill when:
- Launching a new paid campaign on any platform
- Resuming a paused campaign after creative or audience changes
- Auditing an existing campaign for structural or compliance issues
- Building a new campaign structure from scratch
- Generating a post-launch performance report

## Procedure

### Step 1 — Pre-Launch Readiness Check

Complete every item before touching the platform launch button. Do not skip items. Do not launch with any box unchecked.

#### Tracking
- [ ] Conversion pixel/tag confirmed firing on all target conversion events (test with Tag Assistant or Pixel Helper)
- [ ] UTM parameters present and correct on all destination URLs
- [ ] UTM format follows platform naming convention (see conventions below)
- [ ] Landing page loads correctly from ad click (test click-through from preview)
- [ ] Analytics tool (Mixpanel/GA4/internal) receiving test events
- [ ] Conversion window configured appropriately (7-day click / 1-day view is standard for crypto products)

#### Audience
- [ ] Target audience defined: demographics, interests, exclusions
- [ ] Custom audiences uploaded or synced (if using CRM lists)
- [ ] Lookalike audiences validated (check source audience size ≥ 1,000)
- [ ] Exclusion audiences applied: existing customers excluded unless re-engagement campaign
- [ ] Geographic targeting confirmed and legal in all targeted regions
- [ ] Age gate applied where required (crypto ads: 18+ mandatory in all platforms)

#### Creative
- [ ] All ad creatives reviewed and approved (internal approval record exists)
- [ ] Creative dimensions correct for each placement (see specs below)
- [ ] Copy reviewed for compliance (see platform-specific notes below)
- [ ] No promises of guaranteed returns, no specific ROI claims
- [ ] Disclaimers present where required by platform policy
- [ ] Brand voice and visual standards applied

#### Budget and Pacing
- [ ] Daily budget set correctly — not lifetime budget unless intentional
- [ ] Campaign start date and end date confirmed (or "ongoing" is intentional)
- [ ] Budget pacing: standard pacing (not accelerated) unless specific reason documented
- [ ] Spend cap configured if applicable
- [ ] Budget matches approved spend amount in task brief

#### Campaign Structure
- [ ] Campaign → ad set → ad hierarchy correct (see structure below)
- [ ] Campaign objective matches business goal (conversions, not traffic, for performance campaigns)
- [ ] Bid strategy documented (target CPA, maximize conversions, manual CPC — whichever applies)
- [ ] Ad set naming convention applied
- [ ] No duplicate ad sets targeting identical audiences (causes auction overlap)

### Step 2 — Platform-Specific Crypto Ad Compliance

Crypto advertising is restricted on all major platforms. Violations result in ad rejection, account suspension, or permanent bans. Review these before every launch.

#### Google Ads
- Requires certification for cryptocurrency exchanges and wallets
- Certification must be renewed annually
- Allowed: crypto exchanges with valid certification, crypto wallets
- Not allowed: DeFi protocols (unless separately certified), NFT promotions, ICO/token sales
- Disclosure required: volatility risk language in ad copy or landing page
- Geo restrictions: some countries blocked entirely — check current Google crypto ads policy

#### Meta (Facebook / Instagram)
- Requires written permission from Meta for cryptocurrency ads
- Submit permission request at: business.facebook.com → Account Settings → Cryptocurrency Ads
- Once approved: permission applies to the ad account, not the campaign
- Not allowed: promises of profit, "guaranteed returns," specific price predictions
- Required disclaimer on landing page: investment risk disclosure
- Audience restriction: cannot target under-18 audiences

#### X (Twitter)
- Requires certification for cryptocurrency companies
- Certification is granted at account level, valid for 12 months
- Allowed (with certification): exchanges, wallets, blockchain infrastructure
- Not allowed: token sales, yield farming promotions, ICO ads
- Copy restriction: no "get rich," "earn X% APY guaranteed," or specific price targets
- Requires disclosure in copy or landing page for investment risk

#### Reddit
- Reddit does not require crypto-specific certification but enforces content policy
- Not allowed: pump-and-dump language, specific price predictions, guaranteed returns
- Best practice: target crypto-adjacent subreddits (r/defi, r/cryptocurrency) not general finance
- Copy must be informational in tone, not promotional hype
- Community rules vary by subreddit — check before targeting

### Step 3 — Campaign Structure

Follow this structure on all platforms. Flat structures cause budget waste and loss of control.

```
Campaign level
├── Objective: [Conversions / App installs / Traffic]
├── Budget: $XXX/day
└── Bid strategy: [Target CPA $XX | Maximize conversions]

Ad Set level (one audience per ad set)
├── Audience: [Audience name and definition]
├── Placement: [Automatic / Manual — document which]
├── Schedule: [All day / Dayparted — document if dayparted]
└── Frequency cap: [if applicable]

Ad level (2-4 ads per ad set for creative testing)
├── Ad 1: [creative name]
├── Ad 2: [creative name]
└── Ad 3: [creative name]
```

### Step 4 — Naming Conventions

Consistent naming is critical for reporting and debugging. Apply this convention on all platforms:

```
Campaign:  [PLATFORM]_[OBJECTIVE]_[AUDIENCE]_[PRODUCT]_[YYYYMM]
Ad Set:    [AUDIENCE_SEGMENT]_[GEO]_[PLACEMENT]
Ad:        [CREATIVE_TYPE]_[MESSAGE_ANGLE]_[FORMAT]_[VERSION]
```

Examples:
```
Campaign:  META_CONV_LOOKALIKE_ONBOARDING_202503
Ad Set:    LAL-2PCT_US-CA_FEED-STORY
Ad:        VIDEO_SPEEDRUN_9x16_V2

Campaign:  GOOGLE_CONV_BRANDED_EXCHANGE_202503
Ad Set:    BRANDED-KEYWORDS_US_SEARCH
Ad:        RSA_VALUE-PROP_V1
```

UTM parameter format:
```
utm_source=[platform]&utm_medium=paid&utm_campaign=[campaign-name]&utm_content=[ad-name]&utm_term=[keyword-if-search]
```

Example:
```
?utm_source=meta&utm_medium=paid&utm_campaign=META_CONV_LOOKALIKE_ONBOARDING_202503&utm_content=VIDEO_SPEEDRUN_9x16_V2
```

### Step 5 — Creative Specs Quick Reference

| Platform | Placement | Recommended Size | Max File Size | Video Length |
|----------|-----------|-----------------|---------------|--------------|
| Meta | Feed | 1080×1080 (1:1) | 30MB | 15–60s |
| Meta | Stories/Reels | 1080×1920 (9:16) | 4GB video | 15–60s |
| Meta | Feed video | 1080×1350 (4:5) | 4GB | 15–60s |
| Google | Display | 300×250, 728×90, 160×600 | 150KB | — |
| Google | YouTube | 1920×1080 (16:9) | — | >15s (skip) |
| X | Promoted Tweet | 1200×675 (16:9) | 512MB | 15–60s |
| X | Video card | 800×450 (16:9) | 1GB | up to 10m |
| Reddit | Promoted Post | 1200×628 or 1:1 | 20MB | 15–60s |

### Step 6 — Launch

1. Double-check all pre-launch items are checked off
2. Set campaign status to Active
3. Record launch timestamp and campaign IDs in task activity
4. Screenshot or export initial campaign settings as baseline record
5. Set calendar reminder for 4-hour check, 24-hour check, and 72-hour check

### Step 7 — First 24 Hours Monitoring Protocol

Check at these intervals after launch. Document findings in task activity.

**4-hour check:**
- [ ] Ads approved by platform (no rejections)
- [ ] Spend accumulating (not zero — check for delivery issues)
- [ ] CPM/CPC within expected range (±50% of baseline — flag if extreme)
- [ ] No tracking errors firing in analytics
- [ ] Landing page still loading correctly

**24-hour check:**
- [ ] Spend pacing correctly vs. daily budget (target: ~100% of daily budget spent)
- [ ] Impressions and clicks within expected volume
- [ ] CTR within range: Search >2%, Display >0.3%, Social >0.5% (varies by industry)
- [ ] Conversion events firing (even if volume is low at this stage)
- [ ] Frequency (Meta/Reddit): should be <2.0 at 24h for cold audiences
- [ ] Any delivery warnings or disapprovals in platform UI
- [ ] Guardrail: CPA not more than 3× target at this stage (high variance is normal early)

**72-hour check:**
- [ ] Trend analysis: is CPA trending toward target or away?
- [ ] Best/worst performing ad sets — document
- [ ] Best/worst performing creatives — document
- [ ] Any audience fatigue signals (rising CPM, falling CTR)
- [ ] Recommend optimizations or document rationale for no changes

### Step 8 — Kill-Switch Criteria

Pause a campaign immediately if any of the following occur:

| Trigger | Action |
|---------|--------|
| Tracking broken — zero conversions after 500+ clicks | Pause + investigate tracking |
| CPA > 5× target after 72h and $500+ spent | Pause + escalate to human review |
| Platform policy violation detected | Pause immediately + notify mission-control |
| Landing page 404 or error | Pause + route to devops |
| Spend spike > 3× daily budget in <12h | Pause + audit budget settings |
| Ad account flagged or suspended | Stop all spend + notify human owner immediately |
| Guardrail metric (e.g., sign-up rate) drops >20% vs. baseline | Pause + route to product + data teams |

When pausing on kill-switch: document the reason, timestamp, spend total at pause, and route a task to the appropriate agent within the same session.

### Step 9 — Post-Launch Reporting Template

File a performance report after the first 7 days:

```markdown
## Paid Campaign Report — [Campaign Name]
**Period**: YYYY-MM-DD to YYYY-MM-DD
**Platform**: [Google / Meta / X / Reddit]
**Budget spent**: $___
**Campaign objective**: ___

### Performance Summary
| Metric | Target | Actual | vs. Target |
|--------|--------|--------|------------|
| Impressions | — | | — |
| Clicks | — | | — |
| CTR | ___% | ___% | |
| Conversions | ___ | ___ | |
| CPA | $___ | $___ | |
| ROAS | ___× | ___× | |

### Top Performing Ad Sets
1. [Name] — CPA: $___ — Volume: ___
2. [Name] — CPA: $___ — Volume: ___

### Top Performing Creatives
1. [Name] — CTR: ___% — Conversions: ___
2. [Name] — CTR: ___% — Conversions: ___

### Issues Encountered
[Any tracking issues, rejections, delivery problems]

### Recommendations
1. [Scale / pause / adjust]
2. [Creative or audience changes for next period]

### Next Actions
- [ ] [Specific action, owner, deadline]
```

## Output

Save pre-launch checklists to: `~/mission-control/library/docs/research/YYYY-MM-DD_campaign_[name]_prelaunch.md`
Save post-launch reports to: `~/mission-control/library/docs/research/YYYY-MM-DD_campaign_[name]_report.md`

## Examples

**Good task for this skill:** "Launch the March Meta retargeting campaign for existing users — run the full pre-launch checklist and document results."

**Good task for this skill:** "The Google campaign spend spiked 4× in 3 hours — evaluate kill-switch criteria and recommend action."

**Anti-pattern to avoid:** Launching a campaign without verifying tracking first. Untracked spend is wasted spend with no learning value.

**Escalation trigger:** Any kill-switch event, policy violation detection, or daily spend exceeding $1,000 → notify mission-control and create a human-review task immediately.
