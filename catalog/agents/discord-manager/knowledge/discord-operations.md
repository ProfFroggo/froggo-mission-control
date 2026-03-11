# Discord Operations — Knowledge Reference
### Discord Manager — Froggo Mission Control

This document is the operational reference for running a healthy, growing Discord community for a DeFi/crypto project. It covers server architecture, moderation protocols, bot setup, community event templates, engagement tactics, and escalation rules.

---

## 1. Server Architecture Best Practices

### Channel Hierarchy

The goal of channel design is that a brand-new user can land, understand the server in 30 seconds, and find what they need without asking someone. Design for the lost visitor, not the expert.

**Standard channel structure for a DeFi project**:

```
WELCOME & INFO
  #welcome            — Automated welcome + rules + quick orientation
  #announcements      — Team-only posting. Product updates, token news, launches.
  #rules              — Clear, concise community standards (5-7 rules max)
  #faq                — Pinned answers to the top 20 questions we get in support

COMMUNITY
  #general            — Open conversation, on-topic community discussion
  #price-talk         — Price, charts, market discussion. Keeps price talk contained.
  #trading-strategies — Technical discussion, setups, strategies
  #alpha              — Community-sourced signals and analysis
  #memes              — Memes and culture. Essential in crypto.

SUPPORT
  #ask-for-help       — Wallet issues, transaction questions, onboarding
  #bug-reports        — Users reporting product bugs (links to GitHub issues)

GOVERNANCE (if applicable)
  #proposals          — Governance discussions
  #votes              — Active vote announcements and results

BUILD WITH US
  #feedback           — Structured product feedback (use a bot for tagging)
  #dev-updates        — Engineering updates, ship notes, technical changelog

ROLES (voice)
  #community-calls    — Town halls, AMAs, spaces
  #working-groups     — Role-gated voice channels for contributors

TEAM-ONLY (private)
  #mod-log            — All moderation actions logged here
  #team-general       — Internal team chat
```

### Channel Purpose Rules

Every channel MUST have:
- A one-line description in the channel topic (visible to all users)
- At minimum one pinned message with context

Every channel SHOULD NOT:
- Exist if it's getting fewer than 5 meaningful messages per week and there's no plan to activate it
- Exist if its purpose overlaps with another channel without a clear distinction

**Dead channel protocol**: Channels with <10 messages/month for 2 consecutive months get evaluated. Options: run an activation event, archive it, or merge it with a related channel. Archiving is preferable to leaving a ghost channel visible.

---

## 2. Role System Design

### Standard Role Hierarchy

```
@everyone               — Visitor. Can read #welcome, #announcements, #faq. Cannot post.
@Member                 — Verified human (passed verification). Gets full community access.
@Active                 — 10+ posts. Unlocks contributor-tier channels.
@Contributor            — Nominated. Demonstrated consistent value to the community.
@Ambassador             — Highest earned tier. Can pin messages, help new users, soft-moderate.
@Team                   — Official staff. Clearly labeled. Dedicated role color.
@Moderator              — Elevated mod role for trusted community members.
```

### Role Gating Logic

**Visitor → Member** (automatic, via verification bot):
- Trigger: Joins server
- Action: Passes CAPTCHA or reaction verification
- Grant: @Member role

**Member → Active** (automatic, via MEE6 or Carl-bot XP system):
- Trigger: 10+ messages posted (non-spam)
- Grant: @Active role + unlock of #alpha and #feedback channels

**Active → Contributor** (manual, mod-nominated):
- Criteria: Regular, high-quality contributions over 30+ days
- Process: Mod team nomination → simple majority vote in #mod-log → DM the user with explanation
- Grant: Role + welcome message from mod team

**Contributor → Ambassador** (manual, senior mod approval):
- Criteria: Demonstrated leadership, helps new users unprompted, represents community well
- Process: Senior mod + team sign-off
- Grant: Limited moderation tools (pin messages, move users to voice), special channel access

---

## 3. Bot Setup & Configuration

### Recommended Bot Stack

| Bot | Purpose | Priority |
|-----|---------|----------|
| MEE6 or Carl-bot | Moderation, auto-roles, XP system, welcome messages | Essential |
| Statbot or ServerStats | Analytics — member growth, channel activity, message trends | Essential |
| Ticket Tool or ModMail | Private support tickets without DM chaos | High |
| CollabLand or Guild.xyz | Token-gated roles for holders | High (if holder perks exist) |
| YAGPDB | Advanced automation, forms, reaction roles | Medium |
| Dyno | Backup moderation bot | Medium |

### MEE6 / Carl-bot Configuration

**Welcome message** (posts to #welcome, not a DM):
```
Welcome to the [Project] community, {user.mention}!

Get started:
→ Read #rules to understand community standards
→ Read #faq for answers to common questions
→ Jump into #general to introduce yourself
→ Need help? Post in #ask-for-help

We're building something real here. Glad you're part of it.
```

Note: Welcome messages in a public channel should be warm but brief. Long welcome messages get scrolled past.

**Auto-moderation rules to configure**:
- Spam filter: 5+ identical messages from same user in 60 seconds → auto-timeout 1 hour
- Link filter in non-verified channels: DM links get held for review
- Invite filter: Block external Discord invites in all public channels
- @everyone mention filter: Only @Team can use @everyone
- New account age filter: Accounts <7 days old → require manual approval before posting in general channels (crypto raids almost always use new accounts)

**XP system settings**:
- Disable XP from bot commands (prevents farming)
- Enable XP from unique messages only (not rapid-fire short posts)
- Set level-up announcements to DM only (not public — level spam kills channels)
- Active role unlock at: level 5 (roughly 10-15 quality messages)

### Statbot Configuration

**Weekly metrics to track**:
- Total messages sent
- Unique active users (posted at least once)
- Most active channels (top 5)
- Member join/leave net
- Peak activity hours (for event scheduling)

**Monthly health benchmark targets**:
- Monthly active users / total members ratio: target >25%
- Member retention (30-day): target >65% of new members still present after 30 days
- Support question answer rate within 2 hours: target >90%

---

## 4. Moderation Protocols

### The Moderation Decision Framework

Before taking any moderation action, run through this checklist:
1. Is this actually a rule violation? Or just something that makes me personally uncomfortable?
2. What is the violating user's history? (Check their join date, message history, any prior actions)
3. Is this a first offense or a pattern?
4. What outcome does the community need to see from how I handle this?
5. What is the minimum action that achieves the right outcome?

**Minimum action principle**: Start with the least severe intervention and escalate only if needed.

### Action Types & When to Use Them

| Action | When to use | Duration |
|--------|------------|----------|
| Message delete | Single violating message, no pattern | N/A |
| Verbal warning (public) | Minor first offense in a channel | N/A |
| DM warning | Any correction where public call-out would be disproportionate | N/A |
| Timeout | 2+ violations in session, or one severe violation | 1hr / 24hr / 7d |
| Channel ban | User is specifically problematic in one channel | Until review |
| Server ban | Repeated severe violations, scammers, raiders, TOS violations | Permanent or timed |
| Slowmode | Channel is being flooded or FUD raid in progress | Until stabilized |

### Response Templates by Violation Type

**Price talk in non-price channel**:
> "Hey — price chat goes in #price-talk to keep this channel focused. Check it out there!"
[Move to DM if persistent]

**FUD or misinformation post**:
> "Quick note on this — [factual correction in 1-2 sentences]. For anyone with concerns, the best source is [official link]."
[Don't engage emotionally. Pin the correction if needed. Delete original only if demonstrably false AND causing harm.]

**Personal attack between users**:
> (Public) "[User1] [User2] — let's keep it constructive here. You're both capable of better than this."
(DM User1) "Hey, wanted to check in — things got heated in #general. Happy to talk through it if there's a real issue."
(DM User2) Same as above separately.

**Suspected scammer/impersonator**:
> @Team (in #mod-log): "Flagged potential scammer: [username] [discriminator]. Claiming to be [team member/official]. DM-ing users offering [scam details]. Recommend immediate ban + report to Discord."
[Ban immediately. Post scam warning in #announcements with specific details about the scam vector.]

**Coordinated raid/FUD attack**:
1. Enable slowmode (60 seconds) on affected channels immediately
2. Identify the accounts — usually brand new, similar usernames, coordinated message content
3. Mass ban all identified accounts
4. Post a brief community message: "Heads up — we had a brief raid attempt in #general. Cleaned up. No action needed from community."
[Do not provide details that would help them refine their next attempt]

### Moderation Log Template

Every moderation action in #mod-log:
```
Date: [YYYY-MM-DD HH:MM]
Mod: [Your handle]
User: [Username#discriminator] | [User ID]
Channel: [#channel-name]
Action: [Delete / Warn / Timeout / Ban]
Duration: [If applicable]
Reason: [Specific rule violated + brief description of what happened]
Evidence: [Screenshot link or message ID if relevant]
Notes: [Anything context-relevant for future reference]
```

---

## 5. Community Event Templates

### AMA (Ask Me Anything) — 72-Hour Format

**Day -3 (Announcement)**:
Post in #announcements:
```
We're hosting an AMA with [Name, Title] on [Day] at [Time UTC].

[Name] will be answering your questions about [topic 1], [topic 2], and [topic 3].

Drop your questions in #ama-questions before [Day -1 deadline]. The most upvoted questions get answered first.

Set a reminder: [Link to calendar event]
```
Cross-post to X/Twitter immediately.

**Day -1 (Reminder + question collection):**
Post in #general:
```
AMA tomorrow! [Time UTC]. Questions still open in #ama-questions.
Top questions so far: [preview 3 questions]
```

**Day 0 (AMA execution)**:
- 15 min before: Pin a countdown message in #general
- Open: "The AMA is live. [Name] is here. Starting with the top voted questions."
- Format: Mod reads question, tags the guest, guest responds. Repeat.
- Duration: 60-90 minutes. Don't go over — fatigue kills quality.
- Close: "[Name] — thank you. We're wrapping up. Any closing thoughts?" → post summary timeline.

**Day +1 (Recap)**:
Post in #announcements (and X/Twitter):
```
# AMA Recap: [Name] | [Date]

Key topics covered:
- [Bullet 1]
- [Bullet 2]
- [Bullet 3]

Full transcript: [Link to library doc or Google Doc]
```

### Community Quest / Challenge

**Setup**:
- Define the action clearly (e.g., "Execute 5 swaps using [Feature X]")
- Define the reward clearly (role unlock, NFT, whitelist, or public recognition)
- Set a deadline and announce it in #announcements + #general
- Create a dedicated thread or channel for submission/proof

**Quest announcement template**:
```
COMMUNITY QUEST: [Quest Name]

What: [Specific action to complete]
Reward: [Specific, tangible reward]
Deadline: [Date/Time UTC]
How to submit: [Post proof in #quest-submissions / Use the bot command /submit]

[N] spots available. First come, first served / All completions rewarded.
```

**Post-quest**: Announce winners in #announcements. Give them the role immediately. Tag them publicly — recognition is a community signal.

### Weekly Community Recap

Post every Friday in #announcements (or have a team member post, if they're not doing it naturally):
```
# Week in Review: [Date Range]

This week:
- [Product/engineering update 1]
- [Product/engineering update 2]
- [Community highlight — a notable thread, a user contribution, an event]

Coming next week:
- [Upcoming thing 1]
- [Upcoming thing 2]

Thanks for being here. See you in the threads.
```

---

## 6. Engagement Tactics for DeFi Communities

### Understanding the DeFi Community Dynamics

DeFi communities have unique energy patterns tied to market cycles:

**Bull market behavior**:
- High message volume, lots of excitement, many new members
- Risk: noise outpaces signal, low-quality members dilute community
- Tactic: Create quality-signal channels that cut through noise. Ambassador-led discussion threads. Structured AMAs.

**Bear market behavior**:
- Lower message volume, more skepticism, "down bad" energy
- Risk: community atrophies if not actively maintained
- Tactic: Focus on builders, real users, fundamentals. Community quests and challenges. Education content that has long-term value.

**Post-event (hack, exploit, negative news)**:
- High anxiety, FUD, potential panic
- Risk: coordinated attacks, users making bad decisions under fear
- Tactic: Rapid official communication, factual correction pinned prominently, empathetic but calm moderation. Do not delete legitimate concern posts — address them.

### Content Types That Work in DeFi Discord

| Type | Purpose | Frequency |
|------|---------|-----------|
| "GM" culture messages | Warmth, daily activation | Daily (organic from community) |
| Protocol stats/metrics thread | Community ownership of success metrics | Weekly |
| "Explain it like I'm new" threads | Accessibility, lurker activation | 1-2x/month |
| Bug bounty threads | Converts power users to contributors | Per release |
| "What are you building?" threads | Developer community activation | 1-2x/month |
| Poll / governance discussions | Ownership and investment in product | As relevant |

### Reducing Lurker-to-Participant Friction

80% of Discord members never post. Getting 5% more of them to post once is more valuable than adding new members. Tactics:

- **Low-stakes first posts**: Create threads that invite simple responses. "What wallet are you using?" "What chain do you use most?" Lurkers post when the bar is low.
- **Tag-friendly trivia**: Post a question in #general that rewards the first correct answer with a public shoutout or a small perk. Creates urgency.
- **New member spotlight**: When a new member introduces themselves with something interesting, engage with them publicly. Others see that engaging gets attention.
- **React-to-participate events**: "React with [emoji] if you want to be included in tomorrow's beta test group." Zero typing friction, creates participation and anticipation.

### Holder/Power User Perks

Token-gated channels create community tiers that reward actual users and create aspirational targets:

- **Holder channel** (verified token holders): Early announcements, beta access, direct feedback channel with team
- **Whale channel** (top holders): Direct line to founders, special events
- **Active trader channel** (verified by transaction volume via Dune/on-chain data): Advanced features, trading-specific content

Setup via CollabLand or Guild.xyz. Update verification snapshots monthly or weekly depending on token dynamics.

---

## 7. Anti-Spam & Security Protocols

### The Daily Threat Landscape for DeFi Discord Servers

| Threat | Description | Response |
|--------|-------------|----------|
| DM scammers | Impersonate team, offer "support," steal keys | Pin: Team will NEVER DM you first. Collect reports. Ban immediately. |
| Phishing links | Post links to fake product or contract addresses | Auto-delete external links in unverified channels. Post verified contract addresses prominently. |
| FUD raiders | Coordinated accounts spreading misinformation | Slowmode + ban wave + factual response pinned |
| Fake airdrop announcements | "We're doing a surprise airdrop, connect wallet here" | Auto-delete. Pin: All airdrops announced only in #announcements. |
| Impersonator accounts | Create accounts with similar name to team members | Add team verification mark to real accounts. Never respond to DM "support." |

### Pinned Security Message (always keep in #welcome and #ask-for-help)

```
SECURITY NOTICE

The [Project] team will NEVER:
- DM you first to offer support
- Ask for your seed phrase or private keys
- Ask you to sign a transaction to "verify" your wallet
- Ask you to visit a link to claim tokens (unless announced in #announcements first)

If you receive a DM from someone claiming to be from [Project], please:
1. Do not respond
2. Report the account to Discord
3. Post the username in #ask-for-help so we can ban it

Official contract addresses:
[Token]: [address]
[Contract]: [address]

Only trust announcements in #announcements. Everything else should be verified.
```

---

## 8. Community Health Metrics Dashboard

### Weekly Health Check Template

Run every Monday. Post to mission-control library.

```
DISCORD HEALTH CHECK — Week of [Date]

ACTIVITY
- Total messages (7d): [N] | vs. last week: [+/-]%
- Unique active users (7d): [N] | vs. last week: [+/-]%
- New members joined: [N]
- Members left/banned: [N]
- Net growth: [N]

ENGAGEMENT QUALITY
- Most active channel: [#channel] ([N] messages)
- Least active channel: [#channel] ([N] messages — flag if 2+ weeks low)
- Average thread depth in #general: [N] replies avg
- Support questions answered within 2hr: [X]%

MODERATION
- Actions taken: [N] warnings, [N] timeouts, [N] bans
- Moderation log entries: [N] (all actions documented?)
- Security incidents: [describe or "none"]

SENTIMENT
- Overall tone: [Positive / Neutral / Concerned / Negative]
- Key positive topics: [list]
- Key concerns surfaced: [list]
- Patterns needing product/team attention: [list]

EVENTS
- Events this week: [describe]
- Events next week: [describe]

FLAGS FOR TEAM
- [Anything that needs product, CS, or mission-control attention]
```

---

## 9. Escalation Rules

### What Gets Escalated and to Whom

| Situation | Escalate to | Via |
|-----------|------------|-----|
| User reports financial loss due to product bug | Customer Success → Finance Manager → Mission Control | Task creation in mission-control DB |
| User reports security incident (wallet drained, phishing link hit) | Mission Control + Security simultaneously | Task creation (P0) |
| Coordinated attack or sustained FUD campaign | Mission Control | Immediate task + DM |
| Request for official statement / team response | Mission Control | Task creation |
| Major community sentiment crisis (>30 members expressing serious concern) | Mission Control + Growth Director | Task creation |
| Feature request with high community traction (50+ reactions or mentions) | Product Manager via Customer Success | Monthly digest inclusion |
| Recurring bug reports from community | Customer Success → Coder pipeline | Direct message with aggregated reports |
| Impersonator accounts confirmed | Report to Discord Trust & Safety + ban immediately | No escalation needed unless pattern |

### Escalation Priority Levels

**P0 — Respond within 15 minutes**:
- Active scam link posted in server
- Report of user funds at risk
- Coordinated raid in progress
- Security incident affecting the platform

**P1 — Respond within 2 hours**:
- Viral negative post about the project gaining traction in the server
- Multiple users reporting the same critical bug
- Team member impersonator DMing users at scale
- Major community sentiment shift (sudden increase in negative sentiment)

**P2 — Respond within 24 hours**:
- Single user with a sustained complaint that isn't resolving
- Channel architecture concern
- Bot malfunction
- Recurring question type not covered in FAQ

**P3 — Address within 1 week**:
- Dead channel cleanup
- Role system updates
- Onboarding flow improvements
- Bot configuration optimization
