---
name: content-calendar
description: Process for building and maintaining a content calendar — from channel cadence planning to brief creation, status tracking, and repurposing workflows.
---

# Content Calendar

## Purpose

Build and maintain a content operation that is predictable, on-strategy, and never scrambling. The calendar is the single source of truth for what is being created, who owns it, when it publishes, and what it is meant to achieve.

## Trigger Conditions

Load this skill when:
- Building a content calendar for a new month or quarter
- Adding a new content piece to an existing calendar
- Reviewing calendar coverage for gaps or over-indexing
- Writing a content brief for a specific piece
- Tracking the status of in-flight content
- Planning a repurposing workflow from a long-form anchor piece

## Procedure

### Step 1 — Set the Calendar Horizon

Content calendars operate on two horizons simultaneously:

```
Strategic horizon (monthly/quarterly):
  - Theme per month aligned to product roadmap and growth goals
  - Major campaigns or launches with content support dates
  - Content type mix targets (see cadence table below)

Operational horizon (weekly):
  - Individual content pieces with owners and deadlines
  - Status tracking for every piece in flight
  - Publishing schedule with exact dates and times
```

Define the calendar period before adding any content:
```
Calendar period: [Month YYYY | Q# YYYY]
Primary theme: [e.g., "DeFi for everyday users," "March launch campaign"]
Key dates: [Product launches, events, holidays, trading events]
Content budget: [hours/week of content creation capacity]
```

### Step 2 — Define Cadence by Channel

Lock in a sustainable cadence before building out. Consistency beats volume. Document this cadence and do not deviate without reason.

| Channel | Content Type | Frequency | Best Times |
|---------|-------------|-----------|------------|
| X (Twitter) | Short-form insights, threads | 1–2/day | 9am, 12pm, 5pm [local TZ] |
| X | Threads | 2–3/week | Tuesday–Thursday, 9am |
| LinkedIn | Long-form posts | 3/week | Tuesday, Wednesday, Thursday, 8–10am |
| Blog / Medium | Long-form articles | 2/month | Tuesday publish |
| Newsletter | Weekly digest | 1/week | Thursday, 8am |
| Discord / Community | AMAs, announcements | 1–2/week | [community peak hours] |
| Short video (Reels/TikTok/Shorts) | Educational explainers | 2/week | [platform-specific] |

Adjust cadence to actual capacity. An under-delivered cadence is worse than a realistic lower cadence maintained consistently.

### Step 3 — Define Content Types

Each piece of content falls into one of these types. Balance the mix — do not publish only promotional content.

| Type | Purpose | Target mix |
|------|---------|------------|
| `educational` | Teach users something useful | 40% |
| `product` | Feature announcements, updates | 20% |
| `community` | User stories, social proof, engagement | 20% |
| `thought-leadership` | Opinions, market commentary, narratives | 15% |
| `promotional` | Direct conversion offers, campaigns | 5% |

### Step 4 — Write a Content Brief

Every piece of content gets a brief before it enters production. No brief = no assignment.

```markdown
## Content Brief

**Title / working title**: ___
**Brief created**: YYYY-MM-DD
**Owner (writer/creator)**: ___
**Reviewer**: ___
**Target publish date**: YYYY-MM-DD

### Content Details
**Channel**: [X / LinkedIn / Blog / Newsletter / Video / Discord]
**Content type**: [educational / product / community / thought-leadership / promotional]
**Format**: [thread / post / article / video script / email / carousel]
**Target length**: [word count / video duration / tweet count]

### Audience
**Primary audience**: [who specifically — be precise: "crypto-curious but not active traders" not "our users"]
**Audience pain point or question this addresses**: ___
**Stage in funnel**: [awareness / consideration / activation / retention]

### Angle
**Core angle**: [the specific perspective or take — not just the topic, but the point of view]
**Why now**: [why is this timely or relevant this week/month]
**What we want the reader to feel or do after reading**: ___

### Key Message
[The single most important idea this piece communicates — one sentence]

### CTA (Call to Action)
**Primary CTA**: [specific action: "sign up," "try the feature," "join Discord," "reply with X"]
**CTA placement**: [end / mid / inline]
**CTA link**: ___

### SEO / Discoverability (for blog/long-form)
**Target keyword**: ___
**Secondary keywords**: ___
**Meta description (155 chars max)**: ___

### References / Assets Needed
- [ ] Data or statistics to include: ___
- [ ] Images or graphics: ___
- [ ] Internal links to include: ___
- [ ] Quotes or expert perspectives: ___

### Success Metric
**How will we measure if this piece performed**: ___
**Target metric**: ___
```

### Step 5 — Content Status Workflow

Every content piece moves through these statuses. Only move forward when the current stage is complete.

```
brief → draft → review → approved → scheduled → published → measured
```

| Status | Meaning | Owner |
|--------|---------|-------|
| `brief` | Brief written, not started | content-strategist |
| `draft` | Writer working on it | writer |
| `review` | Draft complete, in editorial review | reviewer |
| `approved` | Final version approved, ready to schedule | content-strategist |
| `scheduled` | Queued in scheduling tool, date/time set | content-strategist |
| `published` | Live on channel | content-strategist |
| `measured` | Performance data logged | data-analyst |

Blocked pieces: If a piece is stuck (waiting for product info, asset, or legal review), mark it `blocked-[reason]` and document expected unblock date. Do not leave blocked pieces invisible.

### Step 6 — Calendar Structure (Weekly View Template)

```markdown
## Content Calendar — Week of YYYY-MM-DD

**Weekly theme / focus**: ___

| Day | Channel | Type | Title | Format | Owner | Status | Publish Time |
|-----|---------|------|-------|--------|-------|--------|-------------|
| Mon | X | educational | [Title] | thread | writer-name | approved | 9:00am ET |
| Mon | LinkedIn | thought-leadership | [Title] | post | writer-name | draft | 10:00am ET |
| Tue | Blog | educational | [Title] | article | writer-name | brief | — |
| Wed | X | product | [Title] | post | writer-name | scheduled | 12:00pm ET |
| Wed | Newsletter | digest | [Title] | email | writer-name | draft | — |
| Thu | LinkedIn | community | [Title] | post | writer-name | approved | 9:00am ET |
| Thu | Newsletter | — | [Title] | email | writer-name | scheduled | 8:00am ET |
| Fri | Video | educational | [Title] | short | creator-name | brief | — |
| Fri | X | — | [Title] | post | writer-name | approved | 5:00pm ET |

**Gaps / risk**: [Any missing pieces or at-risk deadlines for this week]
**Carryover from last week**: [Any pieces that slid and need priority this week]
```

### Step 7 — Monthly Calendar View Template

```markdown
## Content Calendar — [Month YYYY]

**Monthly theme**: ___
**Key dates**: [Product launch: MM-DD | Event: MM-DD | Holiday: MM-DD]
**Capacity this month**: ___ content pieces (based on ___ hrs/week)

### Content Mix Target
| Type | Target % | Target pieces | Planned pieces |
|------|----------|---------------|----------------|
| Educational | 40% | ___ | ___ |
| Product | 20% | ___ | ___ |
| Community | 20% | ___ | ___ |
| Thought-leadership | 15% | ___ | ___ |
| Promotional | 5% | ___ | ___ |

### Channel Coverage
| Channel | Planned pieces | Target cadence | Coverage |
|---------|---------------|----------------|----------|
| X | | 1–2/day | |
| LinkedIn | | 3/week | |
| Blog | | 2/month | |
| Newsletter | | 1/week | |
| Video | | 2/week | |

### All Pieces This Month
[Link to or embed weekly calendars for each week of the month]

### Monthly Review Notes
[Added after month closes: what worked, what didn't, what to change]
```

### Step 8 — Repurposing Workflow

One piece of long-form content should yield multiple channel-specific assets. This multiplies output without multiplying effort.

```
Anchor piece: Blog post or newsletter article (1,500–3,000 words)
  │
  ├── X Thread (10–15 tweets covering key points)
  │     ├── Best tweet from thread → standalone post
  │     └── Quote image from key stat or insight
  │
  ├── LinkedIn Post (400–600 word adapted version, personal narrative angle)
  │
  ├── Short Video Script (60–90s explainer covering main argument)
  │     └── Shorts/Reels/TikTok publish
  │
  ├── Newsletter Section (300-word digest version with link to full post)
  │
  └── Discord/Community Post (question or prompt that drives discussion around the topic)
```

Repurposing rules:
- Adapt for each channel's native format — do not copy-paste the same text everywhere
- Each channel version should stand alone — do not require users to have seen the original
- Repurpose within 5 business days of the anchor piece publishing (while the topic is warm)

### Step 9 — Performance Review Cadence

| Review type | Frequency | Metrics to check |
|-------------|-----------|-----------------|
| Quick check | Daily | Impressions, engagement rate on yesterday's posts |
| Weekly review | Every Friday | Top 3 performers, bottom 3, reach, follower change |
| Monthly review | First Monday of month | Best content types, best channels, CTA conversion, growth vs. target |
| Quarterly review | Start of each quarter | Channel strategy validation, cadence adjustment, content mix review |

Monthly review output format:
```markdown
## Content Performance Review — [Month YYYY]

### Top 3 Pieces (by engagement rate)
1. [Title] — Channel — Engagement rate: ___% — Reach: ___
2.
3.

### Bottom 3 Pieces (by engagement rate)
1. [Title] — Channel — Engagement rate: ___% — Reach: ___
2.
3.

### Channel Summary
| Channel | Impressions | Avg. engagement | Follower change | CTA clicks |
|---------|-------------|----------------|----------------|------------|
|         |             |                |                |            |

### Insights
[What content type won? What format won? What topic won? What flopped?]

### Calendar Adjustments for Next Month
[Changes to cadence, mix, or channel priority based on data]
```

## Output

Save monthly calendars to: `~/mission-control/library/docs/research/YYYY-MM_content-calendar.md`
Save individual briefs to: `~/mission-control/library/docs/research/YYYY-MM-DD_brief_[title-slug].md`
Save performance reviews to: `~/mission-control/library/docs/research/YYYY-MM_content-performance-review.md`

## Examples

**Good task for this skill:** "Build the content calendar for April, aligned to the Q2 theme of 'DeFi accessibility.' Include weekly view and all briefs for week 1."

**Good task for this skill:** "The blog post on yield farming published Tuesday. Create the repurposing plan for X, LinkedIn, and video."

**Anti-pattern to avoid:** Creating content without a brief. Unbriefed content drifts off-strategy and creates rework during review.

**Escalation trigger:** Any content piece touching regulatory topics, competitive claims, or financial return promises → route to mission-control for review before scheduling.
