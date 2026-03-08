---
name: community-ops
description: Standard operating procedures for Discord community management — channel governance, moderation workflows, engagement campaigns, and community health monitoring.
---

# Community Ops

## Purpose

Keep the Discord community healthy, active, and well-governed. Every action taken in a community space must be intentional, documented, and approved before execution.

## Trigger Conditions

Load this skill when:
- Planning or editing channel structure or roles
- Responding to a community issue, report, or moderation event
- Designing or launching an engagement initiative
- Reviewing community health metrics
- Setting up or modifying Discord bots or automations

## Procedure

### Step 1 — Read Context Before Acting
Before any community action:
1. Check memory for prior decisions about this channel/member/topic
2. Review the relevant channel's stated purpose and community guidelines
3. Confirm what approval level this action requires (see Approval Matrix below)

### Step 2 — Classify the Situation

| Situation Type | Examples | Initial Response |
|---------------|----------|-----------------|
| Moderation event | Spam, harassment, rule violation | Log → Review → Action with reason |
| Channel request | New channel, rename, archive | Draft proposal → Approval |
| Engagement task | Event planning, contest, AMA | Draft plan → Approval |
| Bot / automation | New webhook, bot command | Draft config → Test in staging → Approval |
| Community health | Low activity, sentiment shift | Analysis report → Recommendations |

### Step 3 — Approval Matrix

**Never execute Discord actions directly without following this gate:**

| Action Type | Approval Required |
|-------------|------------------|
| Responding to a member with advice | Self (log it) |
| Posting a community update | mission-control sign-off |
| Muting a member | mission-control sign-off |
| Banning a member | Human review (owner) |
| Creating / deleting a channel | mission-control sign-off |
| Adding / changing bot config | Human review |
| Launching an engagement campaign | mission-control sign-off |

### Step 4 — Moderation Workflow
When handling a moderation situation:
1. **Document first:** Who, what channel, what content, timestamp
2. **Assess severity:**
   - Low: Warn message (off-topic, minor rule)
   - Medium: Mute (repeated violations, disruptive)
   - High: Escalate to ban → human review required
3. **Draft the action** with reason text (visible to member and logged)
4. **Route for approval** based on severity
5. **Execute** after approval — never pre-emptively
6. **Log outcome** in task activity with resolution

### Step 5 — Engagement Planning
For community events, campaigns, or growth initiatives:
1. State the goal: What does success look like? (Metric + target)
2. Define the format: Event type, duration, channel, participation mechanism
3. Draft the announcement copy (professional, warm, community-first tone)
4. Identify resource requirements: Bot integrations, prizes, co-hosts
5. Set a timeline: Announcement → Event → Wrap-up → Report
6. Submit for approval before any public announcement

### Step 6 — Community Health Check
Run a health review when requested or on a regular cadence:

Metrics to assess:
- **Activity:** Messages/day, active members/week, thread engagement rate
- **Sentiment:** Tone of recent conversations (positive / neutral / negative)
- **Retention:** Members joining vs leaving over trailing 30 days
- **Channel health:** Which channels are active, which are dead

Output: Health report with trends, flags, and 1–3 recommendations.

### Step 7 — Save & Report
- Community health reports: `library/docs/research/YYYY-MM-DD_community_<description>.md`
- Engagement plans / strategies: `library/docs/stratagies/YYYY-MM-DD_discord_<description>.md`
- Log all moderation actions in task activity

## Output Format

### Moderation Action
```
## Moderation Action
Date: YYYY-MM-DD
Member: [username]
Channel: [#channel-name]
Violation: [description]
Severity: Low / Medium / High
Action taken: [warn / mute duration / ban]
Reason (visible to member): [message text]
Approval: [who approved]
```

### Engagement Plan
```
## Community Engagement Plan: [Title]
Date: YYYY-MM-DD
Goal: [metric + target]
Format: [event type + channel]
Timeline: [Announce → Event → Wrap-up]
Announcement copy:
> [draft text]
Resource requirements: ...
Approval status: Pending / Approved
```

## Examples

**Good task for this skill:** "Plan a 'Share Your Stack' community thread in #dev-chat to boost engagement this week."

**Good task for this skill:** "A member has been posting off-topic promo links in #general — handle it."

**Escalation trigger:** Any ban, any external platform integration, any campaign involving prizes or external partners → route to human review before proceeding.
