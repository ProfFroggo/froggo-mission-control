# Inbox — Triage Patterns

Domain reference for message classification, routing decisions, brief writing, and escalation triggers. Read this at session start and before processing any unusual message type.

---

## 1. Message Classification System

Every incoming message is classified into one of seven categories. Classification happens before prioritization.

### Category Definitions

| Category | Definition | Routing destination |
|----------|-----------|-------------------|
| **question** | Asks for information, an explanation, or a recommendation. Does not require a system change. | Researcher (for factual/research questions), relevant specialist (for capability questions), Mission Control (for platform/strategy questions) |
| **request** | Asks for work to be done. Results in a new task being created. | Varies by request type — see routing table |
| **update** | New information about something already in progress. Does not require new work, but should be logged. | Existing task's activity log |
| **urgent** | Time-sensitive and high-impact. May be any of the above types, but escalated by time constraint. | Mission Control immediately |
| **system** | Automated notification from a monitoring tool, build system, webhook, or scheduled task. | DevOps (infrastructure alerts), Coder (build failures), Security (security alerts) |
| **spam** | No action required. Promotional, off-topic, or clearly irrelevant. | Archive |
| **social** | Community message, feedback, general conversation, or relationship message. Not a work request but worth acknowledging. | Discord Manager (Discord), Customer Success (support feedback), Social Manager (public social mentions) |

### Classification Decision Tree

```
Is this time-sensitive and high-impact?
├── Yes → URGENT (P0/P1) — escalate to Mission Control immediately
└── No → Continue classification

Is this from an automated system?
├── Yes → SYSTEM — route to DevOps or Coder based on type
└── No → Continue

Does it ask for work to be done?
├── Yes → REQUEST — create task, route to appropriate agent
└── No → Continue

Does it ask for information?
├── Yes → QUESTION — route to relevant subject-matter agent
└── No → Continue

Does it provide new information about existing work?
├── Yes → UPDATE — log to existing task activity
└── No → Continue

Is it community conversation or social?
├── Yes → SOCIAL — route to Discord Manager or Customer Success
└── No → SPAM — archive with note
```

### When classification is ambiguous
If a message could be either a request or a question (common: "Can you add X?" — is this a question about capability or a request for implementation?), default to REQUEST and create a task. It is easier to close a task than to chase down a request that was treated as a question and dropped.

If a message could be an update or a new request, check for an active task on this topic. If one exists: UPDATE. If not: REQUEST.

---

## 2. Priority Assignment

Priority is assigned based on two dimensions: time-sensitivity and impact.

### Priority Matrix

|  | **High Impact** | **Medium Impact** | **Low Impact** |
|--|----------------|------------------|---------------|
| **High Time-Sensitivity** | P0 | P1 | P2 |
| **Medium Time-Sensitivity** | P1 | P2 | P3 |
| **Low Time-Sensitivity** | P2 | P3 | P3 |

### Priority Definitions

**P0 — Critical (respond now, no queue)**
- System is down or degraded for users
- Security breach or unauthorized access
- Data loss in progress
- Payment or financial system failure
- Authentication completely broken
- Action: Interrupt Mission Control immediately regardless of what is in queue.

**P1 — High (same session, front of queue)**
- Core user-facing feature is broken (users cannot complete a primary task)
- Bug has been confirmed as a regression from a recent deploy
- Legal or compliance deadline is imminent
- Key stakeholder is blocking on a time-sensitive decision
- Action: Move to front of queue, address this session.

**P2 — Normal (next available slot)**
- Feature request or improvement
- Non-critical bug with a workaround available
- Research or analysis request
- Standard content creation request
- Feedback that warrants response but not urgency
- Action: Create task, enter sprint backlog or queue.

**P3 — Low (backlog)**
- Nice-to-have feature idea
- Minor UX polish suggestion
- Non-blocking observation
- General feedback with no specific ask
- Action: Log to backlog. May not be addressed for several sprints.

### Priority override: Sender urgency vs. actual urgency
Senders frequently communicate urgency that does not match actual impact. Apply the matrix independently of how the sender communicated their urgency. However: note in the brief that the sender expressed urgency, so the receiving agent has that context.

Example: "URGENT PLEASE this is critical we need the dashboard to show monthly not weekly!!!" — This is P2 (feature request with workaround: user can currently view by date range). Note in brief: "Sender expressed high urgency around this preference."

---

## 3. Routing Decision Table

Use the task type to determine the correct agent. When in doubt, escalate to Mission Control rather than guessing.

### Engineering / Technical
| Message type | Primary agent | Notes |
|-------------|---------------|-------|
| Code bug / crash | `coder` | P1 if user-blocking, P2 otherwise |
| Architecture question | `chief` | If it requires design decisions |
| Security concern (any signal) | `security` | Always P0 or P1, never defer |
| Build / CI failure | `devops` | P1 if blocking merges |
| Performance issue | `coder` or `devops` | Coder for app-level, DevOps for infra-level |
| Database issue | `coder` or `devops` | Depends on whether it is query or infra |
| API integration issue | `coder` | Escalate to `chief` if it touches core systems |

### Product / Design
| Message type | Primary agent | Notes |
|-------------|---------------|-------|
| Feature request | `product-manager` | Product Manager scopes it, then Mission Control routes |
| UI/UX feedback | `designer` | |
| Design asset request | `designer` | |
| Roadmap question | `product-manager` | |
| A/B test request | `product-manager` or `growth-director` | Depends on whether it is product or growth-driven |

### Marketing / Content
| Message type | Primary agent | Notes |
|-------------|---------------|-------|
| Social media post request | `social-manager` | Needs approval_create before posting |
| Content creation request | `writer` or `content-strategist` | Writer for execution, Content Strategist for strategy |
| Campaign planning | `growth-director` | |
| Paid advertising | `performance-marketer` | |
| Discord announcement | `discord-manager` | |
| Brand voice question | `voice` | |

### Operations
| Message type | Primary agent | Notes |
|-------------|---------------|-------|
| User support issue | `customer-success` | |
| User onboarding question | `customer-success` | |
| Data / analytics request | `data-analyst` | |
| Financial / budget question | `finance-manager` | |
| Project coordination | `project-manager` | |
| Research request | `researcher` | |
| Anything about agent team | `hr` | |
| Anything truly unclear | `mission-control` | With Inbox's best classification guess and an uncertainty note |

---

## 4. Brief Writing Templates

The brief Inbox writes is the primary artifact it produces. Its quality determines whether downstream agents can act without follow-up questions.

### Standard brief (most requests)

```
ROUTED MESSAGE BRIEF

Category: [question / request / update / urgent / system / social]
Priority: [P0 / P1 / P2 / P3]
Priority reason: [One sentence explaining the impact/time-sensitivity assessment]
Assigned to: [Agent name]

Original message:
[Quote or close paraphrase of the original message]

Summary:
[What the person actually needs, in plain language — not just what they said]

Context:
[Why this is being asked, what situation prompted it, any relevant history]

Expected output:
[What success looks like — what should the receiving agent produce or do?]

Related:
[Task ID if this is related to existing work / Any relevant links or files]
```

### Minimal brief (low-complexity, obvious routing)

```
[P2] Feature request: [one-line summary]
From: [sender]
Detail: [one or two sentences of context]
Assigned to: [agent]
```

### Urgent escalation brief

```
URGENT — P0/P1 ESCALATION

Priority: [P0 / P1]
Issue: [One-line description of what is wrong]
Impact: [Who is affected, how severely]
First reported: [Timestamp]
Current status: [What is known so far]

Original message:
[Quote]

Recommended first action:
[What the receiving agent should do immediately]
```

---

## 5. Thread Continuity Rules

Before creating any new task, Inbox checks for an existing active task on the same topic.

### Detecting existing threads
Check by:
1. Task title search — does an active task exist with similar keywords?
2. Sender/reporter — has this person reported on this topic before?
3. Topic area — is there an ongoing sprint item or project that this naturally belongs to?

### What to do with follow-up messages

**Follow-up that adds information to an existing task**:
Post to the existing task's activity log. Do not create a new task. Note: "Inbox: [brief summary of new information from message dated X]"

**Follow-up that changes the scope of an existing task**:
Post to the existing task's activity log with a flag: "Inbox: Scope change requested — [description]. Flagging for PM review."

**Follow-up that appears to contradict an earlier message**:
Post to the existing task with a flag: "Inbox: Potential contradiction with earlier requirement — [description]. Flagging for clarification before proceeding."

**Message that appears related but is genuinely a separate concern**:
Create a new task, but reference the related task: "Related to task #[ID] but scoped separately because [reason]."

---

## 6. Escalation Triggers

These conditions trigger immediate escalation regardless of queue position.

### Security-related escalation
**Trigger signals (any of these warrant P0/P1 escalation to Security)**:
- Message mentions unauthorized access, breach, or hack
- Message describes behavior consistent with SQL injection or XSS
- User reports seeing another user's data
- Abnormal pattern of login failures mentioned
- Any message containing: "someone accessed", "hacked", "leaked", "exposed", "vulnerability"

**Action**: Route to `security` as P0. Copy Mission Control. Do not wait for more information.

---

### System failure escalation
**Trigger signals**:
- Error rates spiking (mentioned in message or automated alert)
- Service completely unavailable
- Database errors affecting user-facing functionality
- Payment processing failure

**Action**: Route to `devops` (infrastructure) or `coder` (application) as P0. Copy Mission Control.

---

### Data integrity escalation
**Trigger signals**:
- User reports incorrect data being shown
- User reports data disappearing
- Duplicate records mentioned
- Calculation errors in financial or critical data

**Action**: Route to `coder` as P1. Flag to Mission Control with data integrity note. Do not try to fix or investigate — route it fast.

---

### Legal / compliance escalation
**Trigger signals**:
- Any message mentioning legal action, lawyers, or regulators
- GDPR/CCPA deletion or access requests
- Any message from a regulatory body
- Financial compliance concerns

**Action**: Route to Mission Control as P1 with a clear escalation flag. Do not route to engineering agents — this needs a human decision first.

---

## 7. Inbox Quality Checks

Before routing any message, verify:

- [ ] Classification is one of the seven categories (not invented)
- [ ] Priority is P0/P1/P2/P3 with a stated reason
- [ ] Brief includes a summary in plain language (not just a quote of the original)
- [ ] An existing active task was checked for before creating a new one
- [ ] Security signals were checked (even for non-security messages — sometimes they hide in plain sight)
- [ ] The receiving agent has everything they need to act without a follow-up question

After routing, verify:
- [ ] The message is marked as processed in the inbox log
- [ ] If it was a thread continuation, the existing task was updated, not a new task created
- [ ] If it was genuinely ambiguous, Mission Control was copied with a note about the uncertainty

---

## 8. Common Triage Mistakes

**Routing based on who sent the message, not what it contains**
Messages from important people are not automatically high priority. A CEO asking for a minor UI preference is P3. An automated alert about a payment failure is P0. Priority is always impact + time-sensitivity.

**Creating new tasks for existing threads**
The most common source of fragmented context on the platform. Always search for existing tasks first.

**Treating all urgent-sounding messages as P0**
P0 is reserved for: system down, security breach, data loss, payment failure. Everything else is at most P1. Using P0 too broadly erodes its value as a signal.

**Routing ambiguous messages without flagging the ambiguity**
When classification is uncertain, make a best guess AND note the uncertainty explicitly in the brief. Never route silently on an uncertain call.

**Writing briefs that just quote the original message**
A quote is not a brief. A brief summarizes what the person needs, adds context, and defines what a good response looks like. The receiving agent should not need to read the original message to act.

**Skipping security signal checks on non-security messages**
Security concerns sometimes arrive embedded in other types of messages. A bug report that describes behavior consistent with data exposure is a security issue first.
