---
name: triage-protocol
description: Standard process for classifying, prioritizing, and routing incoming messages — ensuring every item lands with the right agent at the right priority level with no messages left unclassified.
---

# Triage Protocol

## Purpose

Process the inbox with speed and precision. Every message gets a category, a priority, and a destination. Nothing sits unclassified. Inbox does not respond, decide, or act — it reads, tags, and routes.

## Trigger Conditions

Load this skill when:
- A new message arrives that needs routing
- Processing a batch of queued inbox items
- Reviewing the inbox for unprocessed or misrouted items
- Building a digest of low-priority items for owner review

## Procedure

### Step 1 — Read the Message
Read the full message before classifying. Do not skim. Note:
- Sender identity (known agent, external contact, system alert, unknown)
- Channel / source (direct message, Discord, email, webhook, internal task)
- Apparent intent (what does the sender want or report?)
- Any urgency signals (words like "urgent", "down", "blocked", error codes, alerts)

### Step 2 — Classify the Message Type

| Category | Description | Examples |
|----------|-------------|----------|
| `request` | Someone wants something done | "Can you build X?", "Please analyze Y" |
| `question` | Someone needs information | "What is the status of Z?", "How does X work?" |
| `update` | Status or progress report | "Task X is done", "Deployment succeeded" |
| `alert` | System or automated notification | Error logs, monitoring alerts, CI failures |
| `feedback` | Opinion or reaction to something | "The new feature is confusing", "Great work on Y" |
| `social` | Non-work, relationship message | Greetings, congratulations, casual chat |
| `spam` | No actionable content | Unsolicited promotion, irrelevant newsletter |
| `unknown` | Cannot determine intent | Route to mission-control with full message |

### Step 3 — Assign Priority

| Priority | Criteria | Response time target |
|----------|----------|---------------------|
| `critical` | System down, data loss risk, security incident, blocking production | Immediate escalation |
| `high` | Agent or human is blocked, deadline-sensitive request, P0 task follow-up | Same session |
| `normal` | Standard work request, question, or update | Queue for next session |
| `low` | FYI, social, routine update, non-urgent feedback | Digest |

**Critical overrides queue order.** All other priorities are processed in arrival order.

### Step 4 — Route the Message

Apply the routing table:

| Message Type + Priority | Route To |
|------------------------|----------|
| `alert` + `critical` | mission-control — immediate |
| `request` + any | Create task → assign to correct agent (use agent-routing skill if unsure) |
| `question` + high/normal | researcher (if research needed) or mission-control |
| `update` | Log in relevant task activity, no routing needed |
| `feedback` + high | mission-control |
| `feedback` + normal/low | Queue for digest |
| `social` | No action, archive |
| `spam` | Archive, do not route |
| `unknown` | mission-control with full forwarded content |

### Step 5 — Create Task (for `request` messages)

When a message requires work to be done:
```
mcp__mission-control_db__task_create {
  "title": "[verb] [noun] — from [sender]",
  "description": "[Full message context + what was requested]",
  "priority": "p0/p1/p2/p3",
  "assignedTo": "[correct agent]",
  "status": "todo"
}
```

Map priority: critical → p0, high → p1, normal → p2, low → p3

### Step 6 — Build Digest (for low-priority batches)
When processing a batch of low-priority items, group them into a digest:
```
## Inbox Digest — [Date]
[N] items processed

### For Awareness
- [Sender]: [1-line summary]
- ...

### No Action Required
- [N] social / routine updates archived
```

Post digest as a task activity update on a digest task, or save to:
`library/docs/research/YYYY-MM-DD_inbox_export.md`

### Step 7 — Log Everything
For every message processed, log in task activity:
- Source, sender, category, priority assigned, routing destination
- If task created: include task ID
- Never leave a batch unlogged

## Output Format

### Single Message Triage Record
```
Message: [brief description or subject]
Source: [channel/sender]
Category: [request / question / update / alert / feedback / social / spam / unknown]
Priority: [critical / high / normal / low]
Route: [agent name or action]
Task created: [task ID or N/A]
Notes: [any ambiguity or special handling]
```

### Batch Triage Summary
```
## Triage Batch — [Date/Time]
Processed: N messages

| # | Summary | Category | Priority | Routed To | Task ID |
|---|---------|----------|----------|-----------|---------|
| 1 | ... | ... | ... | ... | ... |
...

Critical escalations: [list or "none"]
Tasks created: N
Archived: N
```

## Examples

**Good task for this skill:** "Process the 8 new messages in the inbox queue."

**Good task for this skill:** "A Discord webhook just fired with an error payload — triage and route it."

**Anti-pattern to avoid:** Inbox editing the message content before routing, or making a judgment call on what the solution should be. Read, tag, route — that's it.

**Escalation trigger:** Any message from an unknown external sender with sensitive content (credentials, legal, financial) → always route to `human-review`, not to another agent.
