# Support Playbooks — Knowledge Reference
### Customer Success — Froggo Mission Control

This document contains playbooks for handling common user issues on a DeFi wallet platform, the escalation decision tree, response templates by issue type, user sentiment scoring, and feedback categorization for the product team.

---

## 1. Common User Issues & Resolutions

### Issue Category Map

| Category | Subcategory | Frequency | Default Priority |
|----------|------------|-----------|-----------------|
| Wallet Connection | Browser extension conflict | High | P1 |
| Wallet Connection | Unsupported wallet | Medium | P2 |
| Transaction Status | Pending / stuck transaction | High | P1 |
| Transaction Status | Failed transaction | High | P1 |
| Transaction Status | Transaction not showing | Medium | P2 |
| Assets | Tokens not visible | High | P2 |
| Assets | NFT not showing | Medium | P3 |
| Assets | Wrong balance displayed | High | P1 |
| Security | Suspected phishing / scam | Any | P0 |
| Security | Wallet potentially compromised | Any | P0 |
| Security | Unauthorized transaction | Any | P0 |
| Onboarding | Don't know how to start | High | P2 |
| Onboarding | KYC / verification issue | Medium | P1 |
| Product | Feature not working as expected | Medium | P2 |
| Fees | Gas fee confusion | High | P2 |
| Fees | Unexpected fee charged | Medium | P1 |

---

### PLAYBOOK 1: Wallet Won't Connect

**Symptoms**: User reports they can't connect their wallet. Error messages vary. May say "wallet not found," "connection rejected," or the connect button does nothing.

**Triage questions to ask**:
1. Which wallet are they using? (MetaMask, Phantom, Coinbase Wallet, WalletConnect, other)
2. Which browser? (Chrome, Firefox, Brave, Safari)
3. Have they connected this wallet before, or is this the first time?
4. Any error message visible? (ask for screenshot)
5. Are they on desktop or mobile?

**Resolution paths by root cause**:

**Root cause: Wallet extension not detected**
- Ask them to check if the browser extension is installed and enabled (`chrome://extensions/`)
- MetaMask and Coinbase Wallet must be unlocked (not just installed) before connecting
- If using Brave browser: check that Brave Shields are not blocking the site
- Resolution: guide them through unlocking the extension → retry connection

**Root cause: Multiple wallets installed (conflict)**
- Multiple wallet extensions can conflict when all are enabled simultaneously
- Ask which wallet they intend to use → have them disable the others in browser extension settings → retry
- This is the #1 cause of "wallet not found" errors with MetaMask

**Root cause: Wrong network/chain selected**
- The platform operates on [specific chains]. If the user's wallet is on a different chain, the connection may fail or show no assets.
- Ask them to check the selected network in their wallet UI
- Guide them to switch to [network name]

**Root cause: Mobile wallet using WalletConnect**
- WalletConnect requires the user to be on the same device or scan a QR code
- Ask if they're using the mobile app version of their wallet
- Guide them to: open wallet app → find WalletConnect or scan option → scan the QR code on the desktop site

**Root cause: Browser compatibility**
- Safari has limited Web3 support without additional extensions
- Recommend Chrome or Firefox for best experience
- If Brave, Shields may need to be disabled for the site

**If unresolved after all above**:
- Ask user for: browser version, extension version, screenshot of the error
- Escalate to Coder with: reproduction steps, environment details, error message, frequency (are others reporting this?)

**Response template** (wallet not connecting):
> "Thanks for reaching out. Let's get this sorted — wallet connection issues are usually quick to fix.
>
> First, which wallet are you using, and which browser? Also, is your wallet extension unlocked (visible and logged in, not just installed)?
>
> While you check that: one common cause is having multiple wallet extensions enabled at once. If you have more than one installed, try disabling the ones you're not using in your browser's extension settings, then refresh and try again.
>
> Let me know what you find and I'll walk you through the next step."

---

### PLAYBOOK 2: Transaction Is Pending / Stuck

**Symptoms**: User submitted a transaction that shows "pending" and hasn't confirmed. Time varies — could be minutes or hours.

**First response priority**: Establish whether funds are at risk. Pending does not mean lost.

**Triage**:
1. How long has it been pending?
2. What type of transaction? (swap, transfer, approve, bridge)
3. What chain? (Ethereum, Solana, Polygon, other)
4. Do they have the transaction hash? (ask for it)
5. Did they set a custom gas price, or use the default?

**Resolution by root cause**:

**Root cause: Low gas price (Ethereum/EVM)**
- Transactions on Ethereum and EVM chains require gas. If the gas price was set below the current network's fee market, the transaction queues until it becomes economical to process.
- Guide user to: copy the transaction hash → paste into [Etherscan/relevant explorer] → check status
- If "pending" with very low gas: can be sped up or cancelled using MetaMask's speed up / cancel feature (works by replacing the transaction with a higher gas price)
- Important: Speed up replaces the transaction; the original nonce is reused

**Root cause: Network congestion**
- During high-traffic periods (market events, popular NFT mints), all transactions slow down
- Check current gas price on Etherscan Gas Tracker
- If network is congested: reassure user their funds are safe, the transaction will confirm when the network clears
- Expected wait: usually <30 minutes for standard congestion. Extreme events can take 1-2 hours.

**Root cause: Solana transaction dropped**
- Solana doesn't use gas the same way. Transactions can be "dropped" rather than stuck.
- Check the transaction status in Solscan using the transaction signature
- If dropped: the transaction was never included in a block. Funds were never moved. User can safely resubmit.
- Guide user to retry the transaction from the platform UI

**Root cause: Bridge transaction delay**
- Cross-chain bridges have built-in delays — some are 15 minutes, some are several hours
- Check the bridge's status page or the platform's bridge status indicator
- Reassure user this is expected behavior, not a problem

**Response template** (stuck transaction):
> "Your funds are safe — a pending transaction just means it's waiting to be included in a block, not that anything went wrong.
>
> To check the status yourself, can you share the transaction hash? You can find it in your wallet's activity/history tab. Once I have it, I can look up exactly where it is in the queue.
>
> In the meantime: if you submitted this on [Ethereum/EVM chain], check Etherscan.io and paste the hash there. You'll see whether it's still pending or confirmed. If the gas price was set very low, MetaMask has a 'Speed Up' option that lets you resubmit with a higher fee.
>
> What chain were you on, and how long ago did you submit it?"

---

### PLAYBOOK 3: Transaction Failed

**Symptoms**: Transaction shows "failed" status. Funds may appear to have been deducted (gas fee) but the action didn't complete.

**Critical first step**: Confirm what the user means by "failed." In blockchain:
- The transaction failed BUT was included in a block → gas fee consumed, action not completed
- The transaction was dropped → never included, no funds moved

**Triage**:
1. Does the transaction appear in their wallet history?
2. What was the transaction doing? (swap, approval, transfer)
3. Do they have the transaction hash?
4. Did they get an error message? If so, what?

**Common failure reasons by type**:

**Swap failure: Slippage tolerance too low**
- On DEX swaps, if the price moves more than the slippage tolerance between when they submitted and when the transaction executes, it fails.
- Gas fee is lost. The swap did not execute. Funds (minus gas) are still in the wallet.
- Resolution: retry the swap with a higher slippage tolerance (0.5% → 1% or 2% for volatile assets)

**Swap failure: Insufficient gas**
- Transaction ran out of gas mid-execution (gas limit set too low)
- Resolution: retry with higher gas limit (most wallet UIs have an "edit gas" option → increase gas limit)

**Smart contract interaction: Reverted**
- The contract rejected the transaction for a specific reason
- Error message in the transaction details on Etherscan often explains why ("ERC20: transfer amount exceeds balance," etc.)
- Guide user to the transaction on Etherscan → look at the "Revert reason" in the transaction details
- Most reverts are not platform bugs — they are business logic (tried to transfer more than balance, tried to unlock before vesting, etc.)

**Transfer: Insufficient balance**
- User tried to transfer more than they have (accounting for gas)
- Always need to keep some native token (ETH, SOL, MATIC) for gas fees
- Resolution: send slightly less, leaving gas reserve

**Response template** (failed transaction):
> "A failed transaction means the action didn't complete — but depending on the type, your funds are in one of two states.
>
> Can you share the transaction hash from your wallet history? That lets me look at exactly what happened.
>
> Quick question: was this a swap, a transfer, or something else? Swaps commonly fail because the price moved faster than the slippage tolerance allows — in which case your tokens are still in your wallet (just minus the gas fee). If it was a transfer, it could be an insufficient balance issue.
>
> Once I have the hash, I can tell you exactly what happened and walk you through the fix."

---

### PLAYBOOK 4: Tokens Not Showing / Wrong Balance

**Symptoms**: User says their tokens aren't visible in the platform, or the balance shown doesn't match what they expect.

**First step**: Establish whether this is a display issue (tokens are there but not showing) or a balance discrepancy (balance shown is wrong).

**Triage**:
1. Which tokens are missing or wrong?
2. Which chain are they on?
3. Have they checked their wallet address directly on a block explorer?
4. Did they recently bridge tokens from another chain?

**Resolution by root cause**:

**Root cause: Token not auto-indexed**
- Not all tokens are automatically displayed. New tokens, low-liquidity tokens, or exotic token contracts may need to be manually added.
- Resolution: guide user to "Add custom token" feature → enter the token contract address → token should appear
- Provide the verified contract address for common tokens from the platform's official list

**Root cause: Wrong chain selected**
- Tokens live on specific chains. Tokens on Ethereum do not show up if the user's view is filtered to Polygon.
- Ask user to check which chain is currently selected in the platform
- Guide them to switch to the correct chain

**Root cause: Post-bridge delay**
- Cross-chain bridges have confirmation delays. Tokens may be "in flight" for 5-30 minutes after bridge confirmation.
- If they just bridged: check the bridge status. If the bridge is confirmed, wait the standard delay period.
- If the bridge is confirmed and delay period has passed → escalate to Coder with bridge transaction hash

**Root cause: Balance display bug**
- If the balance shown doesn't match the block explorer for the same address: this is a product bug
- Collect: wallet address, token in question, expected balance, displayed balance, chain
- Escalate to Coder immediately. Note severity: if this affects any financial action (swap, transfer), it's P1.

**Response template** (tokens not showing):
> "Let's figure out where your tokens are.
>
> First — can you check your wallet address directly on [Etherscan/Solscan/chain explorer]? This will tell us if the tokens are definitely in your wallet vs. a display issue in our platform. If they show up on the explorer but not in the platform, that's something we can fix.
>
> Which tokens are you looking for, and which chain should they be on? Also, did you recently bridge them from another chain? If so, there can be a few minutes of delay before they appear."

---

### PLAYBOOK 5: Security Incident (P0)

**Symptoms**: User reports: phishing link clicked, seed phrase possibly exposed, unauthorized transaction, suspected wallet compromise.

**THIS IS ALWAYS P0. Respond within 15 minutes. Do not complete the queue before handling this.**

**Immediate response protocol**:

1. **Acknowledge immediately**. No queue. No "I'll get back to you."
2. **Assess the situation**: ask calmly what happened. Don't question whether it's real. Treat it as real.
3. **Determine urgency**: is there an active ongoing threat (e.g., they're still on a phishing site, seed phrase was just entered), or is this a post-event investigation?

**If seed phrase was entered on a suspected phishing site**:
> "Please stop any activity on that site immediately if you're still on it. If your seed phrase has been shared, your wallet is at risk. The fastest action: transfer any assets to a completely new wallet using a device that has never touched the compromised wallet or site. Do NOT use the same seed phrase on a new wallet — create a brand new one.
>
> I know this is alarming. I'm escalating this to our security team immediately. Can you tell me roughly when this happened and which wallet?"

**If unauthorized transaction is seen**:
> "First — your remaining assets are still in your wallet and are safe until another transaction happens. Let's work quickly.
>
> Please do not approve any new transactions until we've assessed this. Can you share: (1) the transaction hash from your history, (2) approximately when you first noticed it? I'm escalating this to our security team right now."

**Escalation actions to take simultaneously**:
- Create P0 task: `mission-control` + `security` — "Security incident: [user], [brief description], [timestamp]"
- If suspected phishing site: capture the URL, report to Discord Manager to post community warning immediately
- If impersonator account is involved: ban from Discord + report to Discord Trust & Safety

**Do not**:
- Promise recovery of lost funds unless Finance Manager has confirmed this is possible
- Give technical advice beyond "move to a new wallet" without Security agent guidance
- Delay escalation to investigate first — escalate simultaneously with first response

---

## 2. Escalation Decision Tree

```
Ticket arrives
      │
      ▼
Is this a security incident (phishing, compromise, unauthorized tx)?
      │
   YES → P0 IMMEDIATELY — respond + escalate to Mission Control + Security simultaneously
      │
     NO
      │
      ▼
Does this involve money the user believes they lost or can't access?
      │
   YES → P1 — respond with fund status first, then investigate
      │         Escalate to Finance Manager if financial discrepancy confirmed
     NO
      │
      ▼
Is this a product bug (behavior that is clearly not working as designed)?
      │
   YES → P1/P2 depending on impact
      │    - Affects financial actions (swap, transfer, bridge) → P1, escalate to Coder
      │    - Display/UI issue only → P2, escalate to Coder
     NO
      │
      ▼
Is this a user question or confusion (product is working, user needs guidance)?
      │
   YES → P2/P3 — answer in session. Document if it's the 3rd+ time this question appeared.
      │    Route to Writer if FAQ/help doc doesn't cover it.
     NO
      │
      ▼
Is this a billing/fee/payment dispute?
      │
   YES → P1 if potential unauthorized charge, P2 if confusion about fees
      │    Escalate to Finance Manager with: transaction ID, amount, timestamp, user's expectation vs. actual
     NO
      │
      ▼
Is this a feature request?
      │
   YES → P3 — acknowledge, thank them, do NOT promise anything
      │    Route to Product Manager with: verbatim quote, ticket reference, recurrence count
     NO
      │
      ▼
Route to the most appropriate team member or handle within session.
```

### Escalation Contacts by Issue Type

| Issue Type | Route to | Include in escalation |
|-----------|---------|----------------------|
| Product bug (technical) | Coder | Steps to reproduce, environment, frequency, error message |
| Security incident | Mission Control + Security | Timeline, description, any links/addresses involved |
| Financial discrepancy | Finance Manager | Transaction ID, amount, chain, timestamp, expected vs. actual |
| Feature request | Product Manager | Verbatim quote, ticket ref, recurrence count |
| Help doc gap | Writer | The question (verbatim), the correct answer, context |
| Community-wide issue | Discord Manager | Pattern description, number of affected users |
| Churn risk | Growth Director | User ID, sentiment score, history, what would save them |

---

## 3. Response Templates by Issue Type

### Template: Initial Acknowledgment (while investigating)

> "Thanks for reaching out. I'm looking into this now — I'll have a response for you shortly.
>
> While I investigate: [if security concern] your assets are safe until a new transaction is approved — don't approve anything new right now. [if transaction pending] a pending transaction just means it's queuing, not that anything went wrong."

### Template: Request for More Information

> "To get this sorted quickly, can you share:
> - [Specific piece of info needed 1]
> - [Specific piece of info needed 2]
>
> That'll let me [specific thing you need it for — "look up the transaction status," "check the contract address," etc.]."

### Template: Feature Request Response

> "Thanks for the suggestion — I've noted it and passed it along to the product team. I can't make any promises about if or when it would be built, but this kind of feedback directly shapes our roadmap.
>
> Is there a workaround I can help you find in the meantime, or is there a specific problem you're trying to solve that I can look at with you?"

### Template: Bug Report Acknowledgment

> "Thanks for reporting this — I can confirm this is a bug we need to look at. I'm escalating it to our engineering team now.
>
> A few questions that'll help them investigate: [1-3 targeted technical questions].
>
> I'll follow up once I have an update from the team."

### Template: Closing a Ticket

> "Glad that resolved it. Is there anything else I can help with?
>
> If you run into anything else — feel free to reach out. We're here."

### Template: Unable to Fully Resolve (escalation in progress)

> "I've escalated this to [team/person] and they're looking into it. Based on what I'm seeing, [brief honest status — "this appears to be a bug," "this is being investigated," "this is taking longer than expected"].
>
> I'll follow up by [specific time or condition — "end of day tomorrow," "once engineering has confirmed the issue"]. You have my word on that."

### Template: Suspected Scam Warning to Community (via Discord Manager)

> "SECURITY ALERT: We've received reports of [describe scam — "fake support accounts DMing users," "phishing site at [URL]", "fake airdrop claiming to be from us"].
>
> Reminder: the [Project] team will never DM you first to offer help or ask you to connect your wallet. Official announcements only come from this server's #announcements channel.
>
> If you've interacted with this, please post in #ask-for-help immediately."

---

## 4. User Sentiment Scoring

Track sentiment on every resolved ticket. This data feeds the monthly CS Digest.

### Sentiment Score Scale

| Score | Label | Signals |
|-------|-------|---------|
| 5 | Very Positive | User expressed explicit satisfaction, said thank you warmly, offered positive feedback about the product |
| 4 | Positive | User's issue was resolved without friction, tone was neutral-to-friendly throughout |
| 3 | Neutral | Issue resolved but user tone was flat or transactional; no explicit sentiment either way |
| 2 | Negative | User expressed frustration, had to ask multiple times, or expressed disappointment in the product |
| 1 | Very Negative | User expressed anger, threatened to leave, or made the interaction difficult; regardless of resolution |
| 0 | Churned | User left the platform or explicitly stated intention to leave |

**Monthly sentiment reporting**:
- Average sentiment score for the period
- Trend vs. last period (+/- and direction)
- Score distribution (% of tickets at each score)
- Correlation with issue type (which issue categories generate the most negative sentiment?)
- Verbatim samples at score 1-2 for PM and Growth Director

### Sentiment Change Alerts

| Condition | Action |
|-----------|--------|
| Rolling 7-day average drops below 3.0 | Alert Growth Director immediately |
| Single day with >3 tickets scoring 1 | Investigate for common cause; alert PM |
| Score 0 (explicit churn statement) | Tier 3 intervention; alert Growth Director |
| Sudden spike in volume + neutral/negative sentiment | Likely product incident; alert Mission Control |

---

## 5. Feedback Categorization for Product Teams

Every piece of product feedback captured in support interactions gets tagged and routed. Use this taxonomy.

### Feedback Type Tags

| Tag | Definition |
|-----|-----------|
| `ux-confusion` | User was confused by how a feature works (not a bug, but UX needs clarity) |
| `feature-request` | User is asking for something the product doesn't currently do |
| `bug-report` | Behavior that is clearly not working as designed |
| `performance` | Latency, loading speed, or responsiveness complaint |
| `security-concern` | User expressed anxiety about safety, even if not an incident |
| `documentation-gap` | User asked a question that should have been answerable by docs/FAQ |
| `pricing-feedback` | Feedback specifically about fees, pricing, or value perception |
| `competitor-comparison` | User mentioned a competitor product, positively or negatively |
| `positive-signal` | User explicitly praised a feature or their experience |
| `onboarding-friction` | Confusion or difficulty specifically in the first-session experience |

### Monthly Feedback Digest Format

Delivered to: Product Manager, Growth Director, Mission Control
Frequency: 1st of every month

```
CS DIGEST — [Month YYYY]
Prepared by: Customer Success | Tickets reviewed: [N]

TOP 5 UX CONFUSION POINTS
1. [Feature/flow] — [N tickets] — "verbatim quote"
   Category: ux-confusion
   Recommended action: [specific suggestion — update tooltip, rewrite error message, etc.]

2-5. [same format]

TOP 5 FEATURE REQUESTS
1. [Feature] — [N requests] — "verbatim quote"
   Who's asking: [power user / newcomer / specific use case description]
   Priority signal: [High / Medium / Low based on frequency and user value]

2-5. [same format]

BUGS REPORTED THIS MONTH
[List with ticket count, chain/environment, and escalation status]

POSITIVE SIGNALS (what users love)
- [Feature] — [N mentions] — "verbatim quote"

DOCUMENTATION GAPS
- [Question asked 3+ times that isn't in docs] — Suggested doc: [title/description]

SECURITY INCIDENTS
- [Count and brief description, or "None"]

SENTIMENT TREND
Average this month: [X.X] | vs. last month: [+/-]
Key driver of change: [brief explanation]

CHURN SIGNALS
- [N] users at Tier 2 risk | [N] users at Tier 3 risk
- [N] explicit churn statements received
- Intervention outcomes: [X] saved, [Y] churned despite intervention

RECOMMENDED PRIORITY ACTIONS FOR PRODUCT TEAM
1. [Specific recommendation with supporting data]
2. [Specific recommendation with supporting data]
3. [Specific recommendation with supporting data]
```

---

## 6. DeFi-Specific User Education Resources

### Key Concepts to Be Ready to Explain Clearly

**Gas fees**:
- Every transaction on Ethereum (and EVM-compatible chains) requires gas — a small fee paid to validators
- Gas price fluctuates based on network demand. High-traffic periods = higher gas.
- If a transaction fails, gas is still consumed (it paid for the compute, even if the result was a failure)
- Users can often choose "slow / standard / fast" gas settings — slow is cheaper but takes longer

**Slippage**:
- When you swap tokens on a DEX, the price can change between when you submit and when the transaction executes
- Slippage tolerance is the maximum price change you're willing to accept
- Too low slippage → transaction fails if price moves
- Too high slippage → you might get a worse rate than expected (and may be front-run by MEV bots)

**Transaction finality**:
- On Ethereum: ~12 seconds for first confirmation, but 64+ blocks (~15 minutes) for full finality
- On Solana: ~400ms confirmation, ~2-3 seconds for high confidence
- On Polygon: ~2 seconds, but bridge withdrawals to Ethereum take 7+ days (checkpoint period)
- Bridges often add their own delay on top of base-chain finality

**Smart contract approvals**:
- Before a DEX or protocol can move your tokens, you must "approve" it
- Approvals are separate transactions (with their own gas fee) from the actual swap/action
- Unlimited approvals are common but expose you to risk if the contract is compromised
- Revoke approvals via Revoke.cash or Etherscan when done with a protocol

**Seed phrases / private keys**:
- Your seed phrase = total control of your wallet. Whoever has it, controls it.
- Never share it with anyone. No legitimate platform or support agent will ever ask for it.
- Store it offline. Never in a screenshot, email, or cloud document.
- Losing your seed phrase = permanently losing access if the device is lost
