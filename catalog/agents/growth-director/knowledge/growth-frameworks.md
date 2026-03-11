# Growth Frameworks — Reference Guide

Domain reference for the Growth Director. Core frameworks, metric definitions, experiment design, and crypto/DeFi-specific growth patterns.

---

## 1. AARRR — The Pirate Metrics Framework

The canonical growth accounting framework. Every user's lifecycle maps to these five stages. The job of growth is to find the weakest stage and improve it.

### Acquisition
How do users find you?

| Channel | Notes for Froggo Mission Control |
|---------|----------------------------------|
| Organic search (SEO) | Long-tail: "self-hosted AI agent platform", "autonomous AI agents for startups" |
| X/Twitter | Build-in-public content; developer community; product announcements |
| GitHub | Repository visibility, stars, README quality, dependents |
| Product Hunt | Launch events; works best with concentrated community upvote effort |
| Word of mouth | Builders talking to builders; highest LTV source |
| Content marketing | Blog posts, tutorials, case studies |
| Paid (if applicable) | Developer-targeted paid is expensive; ROI requires strong LTV |

**Acquisition metrics to track:**
- New visitors per channel per week
- Signup rate by channel (not all traffic converts equally)
- CAC by channel (fully-loaded: ad spend + team time / new signups)

**Key insight**: Acquisition channels that produce users who activate are worth 3-5x channels that produce signups who churn. Track activation rate by acquisition source, not just volume.

### Activation
Do users experience value quickly enough to continue?

**Activation = reaching the "aha moment"** — the point where the user understands the product's core value through direct experience.

For Froggo Mission Control, candidate aha moments:
1. First agent completes a real task end-to-end
2. First time user deploys their own agent configuration
3. First time a task runs autonomously while the user is away

**Activation funnel example:**
```
Signup
  → Profile/setup complete
  → First agent launched
  → First task assigned to agent
  → First task completed by agent  ← aha moment candidate
  → Return visit within 48 hours
```

**Activation metrics:**
- % of signups who complete each funnel step
- Time-to-aha-moment (median, by cohort)
- Activation rate by acquisition source
- Drop-off point with highest abandonment

**Improving activation:**
- Reduce steps to aha moment
- Guide users toward the moment (onboarding flows, contextual tooltips)
- Identify users who haven't activated and intervene (email, in-app)

### Retention
Do users keep coming back?

**Retention curves** — what to expect by product type:

| Product Type | Day 1 | Day 7 | Day 30 |
|-------------|-------|-------|--------|
| Consumer app (weak) | 25% | 8% | 3% |
| Consumer app (strong) | 40% | 20% | 10% |
| B2B SaaS (strong) | 60% | 45% | 30% |
| Developer tools (strong) | 50% | 35% | 25% |

A retention curve that flattens is healthy. A curve that trends toward zero means the product isn't delivering sustained value.

**Retention segments to analyze:**
- By cohort (signup week/month)
- By activation status (activated vs. not activated)
- By acquisition source
- By usage pattern in first 7 days

**Retention leading indicators:**
- Daily/weekly active usage in first 7 days is the strongest predictor of 30-day retention
- Identify the actions correlated with high retention — build activation around those actions

### Referral
Do users bring others?

**Viral coefficient (K-factor) formula:**
```
K = invitations_sent_per_user × conversion_rate_on_invitations

K > 1 = viral growth (self-sustaining)
K < 1 = growth requires external input
K = 0.3 is realistic for most B2B tools; design for it, not against it
```

**Referral mechanics for developer tools:**
- GitHub stars / forks as passive referral signal
- "Built with Froggo" attribution in outputs
- Explicit referral program (give X, get Y) — works best when the product is already loved
- Community content creation (tutorials, case studies) by users

**Referral metrics:**
- Invitations sent per activated user per 30 days
- Conversion rate on referral invitations
- Organic vs. referred signup ratio over time

### Revenue
Do users pay, and does the unit economics work?

**Key unit economics metrics:**

| Metric | Formula | Target |
|--------|---------|--------|
| MRR | sum of monthly recurring revenue | Growing 10-20% month-over-month |
| ARR | MRR × 12 | — |
| ARPU | MRR / active paying users | Know by segment |
| LTV | ARPU × avg subscription months | 3:1 vs CAC at minimum |
| CAC | total acquisition cost / new paying users | Recover within 12 months |
| LTV:CAC | LTV / CAC | > 3:1 |
| CAC payback period | CAC / (ARPU × gross margin) | < 12 months |

**Revenue expansion levers:**
- Tier upgrades (freemium to paid; basic to pro)
- Seat expansion (team plans)
- Usage-based upsell (more agents, more tasks, more storage)

---

## 2. Growth Loops vs. Funnels

### Funnels (linear)
```
Awareness → Acquisition → Activation → Revenue
```
Scale linearly with input. More spend → more users at each stage. Sustainable but doesn't compound.

### Growth Loops (compounding)
Each user journey through the loop generates inputs for the next cycle.

**Example loops for Froggo Mission Control:**

**Content Loop:**
```
Build in public (X/GitHub) → Generates organic traffic → Signups → Activated users → Create their own content about Froggo → More organic traffic
```

**Referral Loop:**
```
Activated user → Invites teammate or shares publicly → New signup → Activation → More referrals
```

**Community Loop:**
```
User solves problem with Froggo → Shares in Discord/X → Attracts similar users → Community grows → Community content attracts more users
```

**PLG (Product-Led Growth) Loop:**
```
User deploys Froggo → Shares results → Shows product working in public → Others see and sign up
```

**Prioritization rule**: Invest in loops over funnels where possible. Loops compound; funnels don't.

---

## 3. Experiment Design

### Anatomy of a Good Growth Experiment

Every experiment must have these elements documented BEFORE the experiment runs:

```markdown
## Experiment: [Name]

**Hypothesis**: If we [do X], then [metric Y] will [change by Z] because [reason].
Example: If we reduce the onboarding flow from 8 steps to 4 steps, then activation rate will increase by 15% because each additional step loses ~5% of users and steps 5-8 are not critical to reaching the aha moment.

**Primary metric**: [The single metric that determines success or failure]
**Secondary metrics**: [Supporting metrics to watch for unexpected effects]
**Minimum detectable effect (MDE)**: [Smallest change worth detecting]
**Statistical significance threshold**: 95% confidence (standard)
**Sample size required**: [Calculated, see below]
**Estimated runtime**: [Days needed to hit required sample size]
**Control**: [What doesn't change]
**Variant**: [What changes]
**Owner**: [Who runs it]
**Status**: Planned / Running / Complete
**Result**: Winner / Loser / Inconclusive
**Learnings**: [What we now know regardless of outcome]
```

### Sample Size Calculation (Simplified)

For conversion rate tests:
```
Required sample = (Z_α/2 + Z_β)² × (p1(1-p1) + p2(1-p2)) / (p1 - p2)²

Where:
- p1 = baseline conversion rate
- p2 = expected conversion rate with change
- Z_α/2 = 1.96 for 95% confidence
- Z_β = 0.84 for 80% power
```

**Practical rule of thumb**: For a test to detect a 10% relative improvement (e.g., 20% → 22% conversion), you need roughly 5,000 samples per variant. For a 20% relative improvement, roughly 1,200 per variant.

Use online calculators (Evan Miller's A/B test calculator) for exact numbers. The point is: run the calculation before starting, not after wondering why results are inconclusive.

### Statistical Significance vs. Practical Significance
A result can be statistically significant (unlikely to be random) but not practically significant (the effect is real but too small to matter). Always ask: even if this is real, is the effect size big enough to justify the ongoing maintenance cost of the change?

### Learning Velocity
Aim for 5-10 experiments per month. Most will be inconclusive or losing. That's fine. The goal is to learn faster than competitors, not to win every test. Document all results — a library of "things that didn't work" is a strategic asset.

---

## 4. Cohort Analysis Patterns

### What is a Cohort?
A cohort is a group of users who started at the same time (or share another defining characteristic). Cohort analysis shows how behavior changes based on when/how users joined.

### Standard Cohort Table (Retention)
```
Cohort   | Week 0 | Week 1 | Week 2 | Week 4 | Week 8
---------|--------|--------|--------|--------|--------
Jan W1   |  100%  |  45%   |  35%   |  28%   |  22%
Jan W2   |  100%  |  48%   |  37%   |  29%   |  —
Feb W1   |  100%  |  52%   |  40%   |  —     |  —
```

If Week 1 retention is improving across cohorts (Jan: 45% → Feb: 52%), something you changed is working. If it's declining, something is getting worse.

### Key Cohort Analyses to Run

1. **Retention by acquisition source**: Do users from X/Twitter retain better than users from Product Hunt? Informs channel investment decisions.

2. **Retention by activation status**: Do users who hit the aha moment in Week 1 retain at 3x+ the rate of users who don't? (Usually yes. This justifies activation investment.)

3. **Revenue cohorts**: What is MRR by cohort 3 months, 6 months, 12 months after acquisition? Shows LTV trend by cohort.

4. **Feature adoption cohorts**: Do users who adopt feature X in Week 1 retain better? (If yes: bake feature X into onboarding.)

---

## 5. Key Growth Metrics for a Crypto/DeFi Wallet Tool

### Product Metrics
| Metric | Definition | Target Range |
|--------|-----------|--------------|
| DAU/MAU ratio | Daily engagement / monthly active | >20% = strong engagement |
| Task completion rate | Tasks completed / tasks assigned | >70% = healthy |
| Agent activation rate | % of signups who launch at least 1 agent | Track trend |
| Time to first agent | Median hours from signup to first agent launch | Minimize |
| Feature adoption rate | % of users using key features in first 30 days | Per feature |

### Growth Metrics
| Metric | Definition | Notes |
|--------|-----------|-------|
| Viral coefficient (K) | Referrals per user × conversion rate | Track monthly |
| Organic/paid ratio | % of new users from organic sources | Higher = healthier |
| Payback period | CAC / (ARPU × gross margin%) | Target <12 months |
| Net MRR growth | (New MRR + Expansion MRR) - (Churn MRR + Contraction MRR) | Primary revenue KPI |
| NPS | Net Promoter Score | >40 = strong |

### Crypto/DeFi-Specific Context
- Users are technical and skeptical — growth through credibility, not hype
- Developer tools in crypto/DeFi spread through GitHub, X/Twitter, Discord
- Building-in-public is a primary distribution channel
- Community trust compounds over months/years — protect it
- Network effects from integrations (other protocols, wallets, chains) can create strong growth loops

---

## 6. North Star Metric Framework

A North Star metric is the single number that best captures whether users are getting value. It should:
- Be a leading indicator of revenue (not revenue itself)
- Reflect user value creation, not just user activity
- Be measurable and actionable

**For Froggo Mission Control:**
Candidate North Star: **Weekly tasks completed by activated users**

This metric:
- Requires activation (user has deployed an agent)
- Measures actual value creation (tasks getting done)
- Compounds with retained users
- Is actionable (break into: more activated users × more tasks per user)

**North Star decomposition:**
```
Weekly tasks completed =
  (Activated users) × (tasks per activated user per week)

Activated users =
  (New signups) × (activation rate) + (retained activated users)

Tasks per user per week =
  driven by: agent configuration quality, task variety, retention
```

Every growth initiative should move at least one of these underlying levers.
