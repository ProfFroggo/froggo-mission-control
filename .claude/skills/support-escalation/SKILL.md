---
name: support-escalation
description: Decision process for escalating support issues to the right agent or human — covering tiers, triggers, escalation message format, SLA targets, and post-escalation follow-up.
---

# Support Escalation

## Purpose

Route support issues to the right destination with the right urgency, the first time. A misrouted escalation delays resolution and frustrates users. An un-escalated issue that should have been escalated causes incidents. This process eliminates both failure modes.

## Trigger Conditions

Load this skill when:
- A support issue arrives that cannot be resolved immediately by the customer-success agent
- An issue requires input from product, engineering, finance, or a human owner
- A support issue involves potential security, data loss, or financial impact
- Evaluating the urgency and routing of an open support queue
- Following up on a previously escalated issue that has not been resolved within SLA

## Escalation Tier Definitions

### Tier 1 — CS Handles Independently

Customer-success agent resolves without escalation.

**Characteristics:**
- Common, well-documented issue type
- Resolution is within CS agent's authority
- No system access, financial action, or engineering change required
- No risk of data loss, security breach, or user financial harm

**Examples:**
- Account navigation questions ("Where do I find my transaction history?")
- Explaining a feature or product behavior
- Resending a confirmation email
- Clarifying fee structure or trading limits
- Explaining why a transaction was declined (rule-based, no engineering needed)
- General onboarding questions

**Resolution target:** Same session. No escalation task required.

---

### Tier 2 — Route to Product / Engineering / Finance

Issue requires input or action from a specialized agent. CS cannot resolve independently.

**Characteristics:**
- Requires diagnosis of system behavior or code-level investigation
- Requires a product decision or policy clarification
- Requires financial or billing action
- Reproducible bug or unexpected platform behavior
- Issue affects multiple users (pattern, not one-off)

**Examples:**
- User reports transaction stuck in "pending" for > 24h (route to coder via project-manager)
- User cannot complete KYC despite correct documentation (route to product-manager)
- Billing discrepancy or incorrect fee charged (route to finance-manager)
- Feature not working as documented (route to coder)
- User reports data not loading or dashboard error (route to coder)
- Policy question about what is or isn't allowed on the platform (route to product-manager)

**Resolution target:** P1 — same session for acknowledgment, resolution within 24h. P2 — acknowledgment within 4h, resolution within 72h.

---

### Tier 3 — Human Owner Required

Issue requires human judgment, authority, or external communication. No agent can resolve this autonomously.

**Characteristics:**
- Potential security incident or account compromise
- User reports financial loss or missing funds
- Legal, regulatory, or compliance implications
- Media inquiry or reputational risk
- Issue requires financial settlement or compensation decision
- Affects > 10 users simultaneously (possible platform incident)
- User is threatening legal action

**Examples:**
- User reports unauthorized account access or phishing (security incident)
- User reports sending funds to wrong address and requests reversal (financial loss)
- User reports their wallet was drained after using the platform (possible security breach)
- Journalist or researcher requesting comment
- User threatening lawsuit or regulatory complaint
- Mass support volume spike suggesting a platform incident

**Resolution target:** Immediate escalation. Human must acknowledge within 1 hour.

---

## Escalation Triggers by Issue Type

Use this table for quick routing decisions when a new issue arrives:

| Issue type | Tier | Route to | Urgency |
|-----------|------|----------|---------|
| Account navigation / feature question | 1 | CS resolves | Low |
| Password reset or login issue | 1 | CS resolves | Normal |
| Fee or policy question | 1 | CS resolves | Normal |
| Transaction delayed > 24h | 2 | coder (via project-manager) | High |
| Feature bug — single user | 2 | coder (via project-manager) | Normal |
| Feature bug — multiple users | 2→3 | project-manager + monitor for incident | High |
| KYC failure — user believes docs are correct | 2 | product-manager | Normal |
| Billing / fee discrepancy | 2 | finance-manager | High |
| On-chain transaction question (stuck tx, gas, etc.) | 2 | researcher | Normal |
| DeFi protocol error or failed interaction | 2 | researcher | High |
| Account compromise reported | 3 | human-owner | IMMEDIATE |
| User reports missing funds | 3 | human-owner | IMMEDIATE |
| Security incident (any) | 3 | human-owner | IMMEDIATE |
| Legal threat or regulatory complaint | 3 | human-owner | IMMEDIATE |
| Media inquiry | 3 | human-owner | IMMEDIATE |
| Platform-wide incident (> 10 users affected) | 3 | human-owner + project-manager | IMMEDIATE |
| Data breach or exposure suspected | 3 | human-owner | IMMEDIATE |

---

## Step-by-Step Escalation Process

### Step 1 — Gather Issue Context

Before escalating, collect all available context. An incomplete escalation wastes the receiving agent's time.

```
Required context:
  User ID / account identifier: ___
  Issue reported date/time: YYYY-MM-DD HH:MM
  Channel reported through: ___
  Issue description (verbatim from user if possible): ___
  Steps user took before the issue occurred: ___
  What the user expected to happen: ___
  What actually happened: ___
  Transaction IDs or reference numbers (if applicable): ___
  Screenshots or error messages provided by user: ___
  Prior support interactions on this issue: ___
  CS actions already taken: ___
  Why this cannot be resolved at Tier 1: ___
```

Do not escalate without completing this context block. Incomplete escalations get sent back, which doubles the time-to-resolution.

### Step 2 — Determine Tier and Route

Use the trigger table above. When in doubt between Tier 2 and Tier 3, default to Tier 3. It is better to over-escalate a genuine incident than to under-escalate it.

### Step 3 — Write the Escalation Message

Use this format for all escalation messages (task activity or direct chat):

```markdown
## Support Escalation — [Tier 2 / Tier 3] — [Issue Type]

**Escalated by**: customer-success
**Escalated to**: [agent name / human-owner]
**Escalation time**: YYYY-MM-DD HH:MM
**Urgency**: [IMMEDIATE / High / Normal]

### User
- User ID: ___
- Account status: [active / restricted / pending KYC / etc.]
- User since: ___

### Issue
[2-4 sentence clear description of what the user reported, using their words where possible]

### User Impact
[What is the user unable to do? Is there financial impact? Is there ongoing harm?]
Example: "User cannot complete a trade. Funds are in their account but all trade attempts return error code 4023. Started 6 hours ago."

### Urgency Rationale
[Why this urgency level? What happens if not resolved within SLA?]

### What Has Been Tried
- [Action 1 CS already took]
- [Action 2 CS already took]
- [Why these did not resolve the issue]

### What We Need From You
[Specific ask — not "please help" but "we need you to: investigate transaction ID [X], confirm whether the issue is on-chain or platform-side, and provide a status update within 2 hours"]

### Reference
- Task ID: [link to support task]
- Transaction IDs: ___
- Error messages: ___
- Relevant logs (if available): ___
```

### Step 4 — Create a Task

For Tier 2 and Tier 3 escalations, always create a task in the task board:

```
Task title: [SUPPORT] [Issue type] — User [partial ID] — [date]
Priority: P0 (Tier 3 / IMMEDIATE) | P1 (Tier 2 High) | P2 (Tier 2 Normal)
Assigned to: [receiving agent]
Status: internal-review (Tier 2) | human-review (Tier 3)
Description: [Copy full escalation context block]
```

Do not only send a chat message without creating a task. Chat messages get missed; tasks are tracked.

### Step 5 — Notify the User

After escalating, update the user with an acknowledgment. The user should never feel abandoned.

**Tier 2 acknowledgment (send to user within 30 minutes of escalation):**
```
Hi [Name], thanks for reaching out. We've reviewed your issue and have passed it to our technical team for investigation. We'll have an update for you within [SLA timeframe]. Reference number for this issue: [task ID].
```

**Tier 3 acknowledgment (send to user within 15 minutes):**
```
Hi [Name], we take this kind of issue very seriously and have immediately escalated it to our senior team. They will contact you directly within [1 hour]. Reference: [task ID]. Please do not take any further action on your account until you hear from us.
```

Do not promise specific outcomes. Do not speculate on causes. Do not give timelines longer than the SLA.

---

## SLA Targets by Tier

| Tier | Urgency | First response | Resolution target |
|------|---------|---------------|------------------|
| Tier 1 | Normal | Immediate | Same session |
| Tier 2 | Normal | < 4 hours | 72 hours |
| Tier 2 | High | < 1 hour | 24 hours |
| Tier 3 | IMMEDIATE | < 15 minutes (human acknowledgment) | Ongoing until resolved |

**SLA clock starts when the issue is reported to CS**, not when it is escalated. Time spent gathering context counts.

---

## Post-Escalation Follow-Up

### After Tier 2 Escalation

At the halfway point of the SLA (e.g., 36h into a 72h window):
- Check task for updates from the receiving agent
- If no update received: send a follow-up chat to the receiving agent referencing the task ID
- Update the user proactively: "We're still investigating and will have an update for you by [new target time]"

Do not wait for the SLA to expire before following up. Proactive follow-up prevents breaches.

### After Tier 3 Escalation (IMMEDIATE)

Do not manage a Tier 3 issue independently. Once escalated:
- Confirm human owner has acknowledged (check for task activity within 15 minutes)
- If no acknowledgment: send another message via all available channels (chat + task update)
- Stay available to provide additional context to the human owner
- Do not communicate with the user beyond the initial acknowledgment unless directed by the human owner
- Do not take any platform actions (no refunds, no account changes) without explicit human direction

### Closure

When an issue is resolved (by any agent or human):
1. Update the user with the resolution
2. Confirm the user is satisfied
3. Update the task to `done` (if you have authority) or create a `done` request for the responsible agent
4. Log the resolution in task activity: what the root cause was, what fixed it, how long it took
5. If the issue revealed a gap in Tier 1 CS ability (e.g., a common question that kept needing Tier 2): flag it as a knowledge base gap for the product-manager to address

---

## Escalation Anti-Patterns

These patterns cause resolution delays and must be avoided:

| Anti-pattern | Why it's harmful | What to do instead |
|-------------|-----------------|-------------------|
| Escalating without context | Receiving agent must re-gather everything | Complete the context block before escalating |
| Chat-only escalation (no task) | Message lost, no tracking | Always create a task + send chat message |
| Vague ask ("please help") | Receiver doesn't know what to do | State the specific ask with a concrete action |
| Over-escalating Tier 1 to Tier 2 | Wastes engineering/product time | Check the trigger table; resolve common issues at Tier 1 |
| Under-escalating Tier 3 to Tier 2 | Delays critical response | When in doubt, escalate up |
| Not notifying the user after escalating | User feels abandoned | Always send acknowledgment within SLA |
| Promising specific outcomes to user | Creates liability | Acknowledge and give timeline only |

---

## Escalation Log Format

Maintain a running log of all Tier 2 and Tier 3 escalations:

```markdown
| Date | Task ID | User ID | Issue Type | Tier | Routed To | Time to Acknowledge | Time to Resolve | Resolution |
|------|---------|---------|------------|------|-----------|--------------------|-----------------|------------|
```

Review this log weekly to identify recurring issue patterns that could be resolved with product changes or Tier 1 knowledge base improvements.

## Output

Save escalation logs to: `~/mission-control/library/docs/research/YYYY-MM_support-escalation-log.md`
Save incident reports (Tier 3 only) to: `~/mission-control/library/docs/research/YYYY-MM-DD_incident_support_[description].md`

## Examples

**Good task for this skill:** "User reports that their $500 deposit is showing in their bank as completed but not in their platform account. Determine escalation tier and route."

**Good task for this skill:** "We have 12 support tickets in the last 2 hours all reporting the same 'trade failed' error. Triage and escalate appropriately."

**Anti-pattern to avoid:** Attempting to investigate a Tier 3 incident (security, missing funds) independently before escalating. Human must be in the loop for these immediately. Every minute of delay in a real security incident has compounding consequences.

**Escalation trigger (always Tier 3):** Any report of account compromise, missing funds, unauthorized transactions, or data breach — escalate to human-owner as the very first action, before gathering additional context.
