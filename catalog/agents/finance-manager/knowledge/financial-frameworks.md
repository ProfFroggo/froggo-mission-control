# Financial Frameworks — Knowledge Reference
### Finance Manager — Froggo Mission Control

This document is the operational reference for financial management at a DeFi-native startup. It covers budget templates, unit economics calculators, monthly review structure, crypto accounting considerations, and expense classification.

---

## 1. Budget Template

### Annual Budget Structure

The budget is a hypothesis about how the company will operate for the year. It should be detailed enough to be useful and flexible enough to be updated as conditions change. Review monthly. Revise quarterly.

```
=== ANNUAL OPERATING BUDGET ===
Company: [Name] | FY: [Year] | Version: [Draft/Approved] | Last updated: [Date]

--- REVENUE ---
Protocol / Transaction Fees
  - Estimated monthly transaction volume ($): [M]
  - Blended fee rate (%): [%]
  - Monthly fee revenue: [$ = volume × rate]
  - Annual total: [$ × 12]

SaaS / Subscription Revenue (if applicable)
  - Paying subscribers: [N]
  - ARPU (monthly): [$]
  - Monthly MRR: [$]
  - Annual ARR: [$]

Treasury Yield / Staking Income
  - Stablecoin staking yield (APY): [%]
  - Average stablecoin balance: [$]
  - Annual yield: [$]

TOTAL ANNUAL REVENUE (PROJECTED): [$]

--- COST OF REVENUE ---
Blockchain Infrastructure
  - RPC node costs (Alchemy/QuickNode/self-hosted): [$]/mo
  - Gas subsidization (if the product pays gas): [$]/mo
  - Smart contract deployment costs (one-time or per release): [$]

Security & Audits (amortized annually)
  - Smart contract audits: [$] (amortize over [N] months)
  - Bug bounty program: [$]/yr
  - Security tooling (Forta, OpenZeppelin Defender, etc.): [$]/mo

Custody & Key Management
  - Custody provider fees: [$]/mo
  - HSM / MPC key management: [$]/mo

TOTAL COST OF REVENUE: [$]/yr
GROSS PROFIT: [$] | GROSS MARGIN: [%]

--- OPERATING EXPENSES ---

ENGINEERING (includes salaries + contractor + tooling)
  Headcount
    - [Role]: [$k fully-loaded salary] × [N FTE] = [$k]
    - [Role]: [$k fully-loaded salary] × [N FTE] = [$k]
    - Contractors/agencies: [$k] (monthly average × 12)
  Infrastructure
    - AWS / GCP / cloud compute: [$]/mo
    - Databases (Supabase, PlanetScale, etc.): [$]/mo
    - CDN and storage (Cloudflare, S3): [$]/mo
    - Monitoring (Datadog, Sentry, etc.): [$]/mo
    - CI/CD and devops tooling: [$]/mo
  Developer Tooling
    - GitHub Teams: [$]/mo
    - Linear/Jira: [$]/mo
    - Vercel/deployment: [$]/mo
    - Other SaaS: [$]/mo
  ENGINEERING SUBTOTAL: [$]/yr

PRODUCT & DESIGN
  Headcount
    - [Role]: [$k] × [N FTE] = [$k]
  Tools
    - Figma: [$]/mo
    - User research tools (Maze, Hotjar, etc.): [$]/mo
  PRODUCT & DESIGN SUBTOTAL: [$]/yr

MARKETING & GROWTH
  Headcount
    - [Role]: [$k] × [N FTE] = [$k]
  Paid Acquisition
    - Twitter/X Ads: [$]/mo
    - Google Ads: [$]/mo
    - Other paid: [$]/mo
  Content & Creative
    - Video production: [$]/mo average
    - Design contractors: [$]/mo
  Community
    - Discord / community events: [$]/mo
    - Influencer partnerships: [$]/mo (annual cap)
  Brand & PR
    - PR agency (if applicable): [$]/mo
    - Conference sponsorships: [$]/yr
  MARKETING & GROWTH SUBTOTAL: [$]/yr

OPERATIONS & G&A
  Legal & Compliance
    - Outside counsel (retainer + hourly): [$]/yr
    - Compliance software/services: [$]/mo
    - IP filings and trademark: [$]/yr (one-time or recurring)
  Finance & Accounting
    - Accounting firm/CFO services: [$]/mo
    - Financial software (QuickBooks/Ramp/Brex): [$]/mo
    - Crypto accounting tools (Koinly, CoinTracker, etc.): [$]/mo
  HR & Recruiting
    - HR tools (Rippling, Gusto): [$]/mo
    - Recruiting (agency fees or Greenhouse): [$]/yr
  Insurance
    - D&O insurance: [$]/yr
    - Cyber liability insurance: [$]/yr
    - E&O insurance: [$]/yr
  Miscellaneous G&A
    - Office / coworking (if applicable): [$]/mo
    - Travel & entertainment: [$]/yr
    - Subscriptions (Notion, Slack, etc.): [$]/mo
  OPERATIONS SUBTOTAL: [$]/yr

TOTAL OPERATING EXPENSES: [$]/yr
NET OPERATING INCOME / (LOSS): [$]/yr

--- TREASURY SUMMARY ---
(Tracked separately from P&L — this is the balance sheet component)

Stablecoin Holdings (USD-equivalent)
  - USDC on [chain]: [$]
  - USDT on [chain]: [$]
  - Other: [$]
  TOTAL STABLECOIN: [$]

Native Token Holdings
  - [Token symbol]: [N tokens] @ [$] price = [$] USD value
  - Note: Mark-to-market monthly. Do not count as operating cash.

Monthly Burn Rate (rolling 3-month average): [$]/mo
Operating Runway at current burn: [N] months
Target minimum runway: 18 months
```

---

## 2. Unit Economics Calculator

### Core Metrics & Formulas

**Customer Acquisition Cost (CAC) by channel**:
```
CAC (channel) = Total spend on channel / New paying users acquired from that channel

Example:
Twitter Ads spend in March: $12,000
New users attributed to Twitter Ads in March: 240
CAC (Twitter Ads) = $12,000 / 240 = $50.00

Blended CAC = Total marketing spend / Total new paying users
Note: Blended CAC hides underperforming channels. Always calculate by channel.
```

**Lifetime Value (LTV)**:
```
LTV = Average monthly revenue per user × Average customer lifespan in months × Gross margin

Example:
Average monthly fee revenue per active user: $8
Average customer lifespan: 14 months
Gross margin: 65%
LTV = $8 × 14 × 0.65 = $72.80

DeFi nuance: lifespan is highly market-cycle dependent.
Run separate LTV calculations for bull market cohorts vs. bear market cohorts.
```

**LTV:CAC Ratio**:
```
LTV:CAC = LTV / CAC

Interpretation:
< 1:1  — You're destroying value on every acquisition
1-2:1  — Breaking even, barely. Growth is not sustainable.
3:1    — Healthy baseline. Sufficient return on acquisition investment.
5:1+   — Excellent. You may be underinvesting in growth.

Rule: Never launch a growth spend initiative without knowing your current LTV:CAC.
```

**CAC Payback Period**:
```
Payback Period (months) = CAC / (Monthly gross margin per customer)

Example:
CAC: $50
Monthly gross margin per customer: $5.20 ($8 revenue × 65% gross margin)
Payback Period = $50 / $5.20 = 9.6 months

Benchmarks (DeFi/fintech):
< 12 months — Healthy for B2C
12-18 months — Acceptable but capital-intensive
> 18 months — Requires long runway or reducing CAC

Note: If your fundraising runway is shorter than your payback period, growth spend destroys value.
```

**Burn Multiple**:
```
Burn Multiple = Net cash burned / Net new ARR added

Example:
Net new ARR added in Q2: $180,000
Net cash burned in Q2: $360,000
Burn Multiple = $360,000 / $180,000 = 2.0x

Interpretation:
< 1.0x — Exceptional efficiency
1.0-1.5x — Excellent
1.5-2.0x — Acceptable, typical for aggressive growth phase
2.0-3.0x — High. Acceptable if runway is > 24mo and growth is accelerating.
> 3.0x — Crisis signal. Spending too much for growth being achieved.
```

**Net Revenue Retention (NRR)**:
```
NRR = (Starting MRR + Expansion MRR - Churned MRR - Contraction MRR) / Starting MRR × 100

Example:
Starting MRR (Jan 1): $50,000 from existing user cohort
Expansion (upgrades/more usage): +$8,000
Churn (users who left): -$4,000
Contraction (users who downgraded): -$1,500
Ending MRR from same cohort (Dec 31): $52,500
NRR = $52,500 / $50,000 × 100 = 105%

Interpretation:
> 120% — Best-in-class. Existing users driving growth.
> 100% — Growth comes from existing users, not just new. Healthy.
< 100% — You're contracting. New user growth is papering over a leaky bucket.
```

---

## 3. Monthly Financial Review Structure

Run on the 3rd business day of every month (data for prior month complete by then).

### Pre-Meeting Preparation (Finance Manager completes before review)

1. Pull all transactions from payment processors and bank accounts
2. Reconcile with accounting system
3. Calculate budget vs. actual by department
4. Update rolling 3-month burn rate
5. Recalculate runway
6. Identify any variance > 10% with written explanation
7. Update unit economics metrics (if new cohort data available)

### Monthly Review Document Structure

```
MONTHLY FINANCIAL REVIEW
Month: [MMMM YYYY] | Prepared: [Date] | Reviewer: Finance Manager

=== EXECUTIVE SUMMARY ===
Monthly net burn: [$] | vs. budget: [+/-$] ([+/-]%)
Total cash on hand: [$] (stablecoin + fiat)
Operating runway: [N] months (at current burn)
Revenue: [$] | vs. last month: [+/-]%
Key flag(s): [1-2 sentences on anything that requires leadership attention]

=== REVENUE ===
Protocol fees: [$] | Budget: [$] | Variance: [+/-$] [explanation if >10%]
SaaS / subscription: [$] | Budget: [$] | Variance: [+/-$]
Treasury yield: [$] | Budget: [$] | Variance: [+/-$]
TOTAL: [$] | Budget: [$] | Variance: [+/-$] ([+/-]%)

=== EXPENSES BY DEPARTMENT ===
Engineering: [$] | Budget: [$] | Variance: [+/-$]
  [Note if any variance driven by headcount change, contractor spike, etc.]
Product & Design: [$] | Budget: [$] | Variance: [+/-$]
Marketing & Growth: [$] | Budget: [$] | Variance: [+/-$]
Operations/G&A: [$] | Budget: [$] | Variance: [+/-$]
TOTAL OPEX: [$] | Budget: [$] | Variance: [+/-$] ([+/-]%)

=== HEADCOUNT ===
Total FTE at month end: [N]
New hires this month: [N] | Department(s): [list]
Departures this month: [N] | Department(s): [list]
Open roles (approved, not yet hired): [N]

=== TREASURY POSITION ===
Stablecoin/fiat (operating cash): [$]
Native token holdings: [N tokens] @ [$] = [$] USD value
  - Change from prior month: [+/-]% (price change) | [+/-N tokens] (buy/sell/vesting)
Total treasury (USD equivalent): [$]

=== BURN RATE & RUNWAY ===
This month burn: [$]
3-month rolling average burn: [$]
Runway at 3-mo average: [N] months
Runway stress test (worst-case month burn): [N] months

=== UPCOMING COMMITMENTS ===
[Date]: [Renewal / payment / milestone] | Amount: [$]
[Date]: [Renewal / payment / milestone] | Amount: [$]

=== DECISIONS REQUIRED ===
[Any expense requests pending approval, budget reallocation requests, or go/no-go decisions]

=== UNIT ECONOMICS SNAPSHOT ===
Blended CAC (MTD): [$]
LTV:CAC ratio: [X:1]
CAC payback period: [N months]
NRR (trailing 12mo): [%]
Burn multiple (trailing quarter): [X]x
```

---

## 4. Crypto Accounting Considerations

### Revenue Recognition

| Item | Treatment |
|------|-----------|
| Protocol fees earned | Revenue when earned (accrual) |
| Staking yield received | Revenue when received (cash basis or accrual — pick one and be consistent) |
| Token incentives paid to users | Marketing/acquisition expense, not revenue deduction |
| Unrealized token appreciation | Asset value change (balance sheet), NOT income |
| Token grants to ecosystem | Expense when vested/paid |
| Treasury token sales for operations | Proceeds are not revenue — adjust cost basis |

### Cost Basis Tracking

Every token acquisition creates a cost basis that must be tracked for tax purposes. Every token disposal (swap, sale, transfer out) is a taxable event in most jurisdictions.

**Required data points per transaction**:
- Date and time of transaction
- Token type and quantity
- USD value at time of transaction (use CoinGecko or CoinMarketCap price at block timestamp)
- Transaction hash (on-chain reference)
- Wallet address (source and destination)
- Purpose (acquisition, sale, swap, fee payment, incentive distribution, team grant)

**Cost basis method**: Choose FIFO (first in, first out) or specific identification and document the choice. Apply consistently across all token types. Document the choice in the accounting policy.

**Tools for crypto accounting**:
- Koinly — best for multi-chain portfolios, handles most DeFi protocols
- CoinTracker — good for simple setups
- Cryptio — enterprise-grade, handles on-chain + CeFi
- Manual (for small volume): export on-chain transactions via Etherscan/Solscan CSV, map to USD price at transaction timestamp, maintain in spreadsheet

### Employee Token Compensation

Token grants to employees are a complex area with significant tax implications.

**Key principles**:

- **At grant (unvested)**: Generally not taxable at grant if subject to vesting schedule and forfeiture risk (Section 83(b) election applies in US)
- **At vest**: The fair market value of tokens at vest date is ordinary income to the employee and a compensation expense to the company
- **At sale**: Capital gain/loss on the difference between sale price and the basis established at vest

**Section 83(b) election** (US-specific, consult counsel):
- Employees can elect to recognize income at grant (when tokens may have low value) rather than at vest (when they may be worth more)
- Must be filed within 30 days of grant
- Requires valuation at time of grant

**Payroll implications**:
- Token vest events create payroll tax obligations
- Employer must withhold income tax and employment taxes on the fair market value at vest
- This often requires employees to sell some tokens immediately upon vest to cover tax withholding OR for the company to net-settle (withhold tokens)

**Always get legal/tax counsel before launching any token compensation program.**

### Treasury Management

**Operating treasury** (stablecoins + fiat) and **protocol treasury** (on-chain tokens) must be managed as separate entities:

| Treasury Type | Purpose | Management rule |
|---------------|---------|----------------|
| Operating (stablecoins) | Pay salaries, SaaS, contractors, operations | Must cover 18 months runway minimum at all times |
| Protocol (native token) | Ecosystem grants, liquidity provisioning, strategic reserves | Governed separately, not available for operating expenses without board/governance approval |
| Validator/staking | Generates yield, may be locked | Treat yield as income; track lock periods as illiquid |

**Treasury rebalancing triggers**:
- Operating runway drops below 18 months → evaluate protocol treasury liquidation (with governance approval and market impact analysis)
- Token treasury experiences >30% USD value decline in 90 days → review total financial position
- New large expense commitment → verify operating runway remains above 12 months after commitment

**Multisig treasury operations**:
- Document: signers, threshold (e.g., 3-of-5), signing process, approval requirements per threshold
- All transactions above $50k: require written approval from Mission Control before execution
- All transactions: log in the treasury transaction register with purpose, approver, and transaction hash

---

## 5. Expense Classification Guide

### Chart of Accounts for a DeFi Startup

```
REVENUE ACCOUNTS
4000  Protocol / Transaction Fee Revenue
4100  SaaS / Subscription Revenue
4200  Treasury Yield Income
4300  Partnership Revenue
4900  Other Revenue

COST OF REVENUE
5000  Blockchain Infrastructure (RPC nodes, gas costs)
5100  Smart Contract Security (audits, bug bounties)
5200  Custody & Key Management
5300  Other Direct Costs

OPERATING EXPENSES
  ENGINEERING
  6000  Engineering Salaries & Benefits
  6010  Engineering Contractor / Freelance
  6020  Cloud Infrastructure (AWS, GCP)
  6030  Developer SaaS Tooling
  6040  Security Tooling & Services

  PRODUCT & DESIGN
  6100  Product Salaries & Benefits
  6110  Design Contractor / Freelance
  6120  Design & Research Tools

  MARKETING & GROWTH
  6200  Marketing Salaries & Benefits
  6210  Paid Acquisition (by channel sub-category)
  6220  Content & Creative Production
  6230  Community Events & Sponsorships
  6240  Influencer & Partnership Spend
  6250  Brand & PR

  OPERATIONS
  6300  Legal & Compliance
  6310  Finance & Accounting Services
  6320  HR & Recruiting
  6330  Insurance
  6340  Office & Workspace
  6350  Travel & Entertainment
  6360  General SaaS & Software Subscriptions

OTHER
7000  Depreciation & Amortization
7100  Interest Expense
7200  Token Compensation (non-cash)
7300  Foreign Exchange Gain/Loss
```

### Classification Rules & Common Edge Cases

| Expense | Account | Notes |
|---------|---------|-------|
| AWS/GCP/cloud compute | 6020 | Split between product infrastructure and development infrastructure if significant |
| Smart contract audit | 5100 | Can be amortized over the life of the contract (typically 1-2 years) if material |
| Bug bounty payout | 5100 | Treat as cost of revenue — directly related to security of product |
| Token incentives to users | 6230 | Marketing expense, not revenue reduction |
| Token grants to employees | 7200 | Non-cash compensation; track separately from cash comp |
| Crypto accounting software | 6310 | Finance tools |
| Conference sponsorship | 6230 | Marketing — require pre-approval with expected ROI |
| Hardware wallets for team | 5200 or 6040 | Security-related; can be either depending on use (operations vs. dev) |
| Gas fees for team contract testing | 6020 or 6040 | Development infrastructure |
| Gas fees for protocol operation | 5000 | Cost of revenue |
| Influencer one-time payment | 6240 | Require 1099 or equivalent if contractor |
| Legal (token offering structuring) | 6300 | Capital-related legal can be deferred — consult accountant |
| Board member compensation | 6000 or separate | Check employment classification; often in a separate G&A line |

### Pre-Approval Thresholds

| Amount | Required approval |
|--------|------------------|
| Under $500 | Team lead can approve |
| $500 - $5,000 | Department head + Finance Manager review |
| $5,000 - $25,000 | Finance Manager recommendation + Mission Control approval |
| Above $25,000 | Mission Control approval + documentation of business case |
| Above $100,000 | Board notification (if applicable) |
| Any token transfer | Mission Control approval regardless of amount |
| Recurring new commitment > $1,000/mo | Finance Manager evaluation + Mission Control approval |

---

## 6. Vendor Audit Protocol

### Quarterly Vendor Audit Process

Run at the start of Q1, Q2, Q3, Q4.

**Step 1: Pull the complete spend list**
- Export all recurring charges from primary payment method (Ramp, Brex, company card)
- Export all bank ACH debits (for vendors not on card)
- List every item with: vendor name, monthly/annual cost, billing method, what it's for, who owns it

**Step 2: Status categorization for each vendor**

| Category | Definition | Action |
|----------|-----------|--------|
| Active-Core | Used daily, business-critical | Keep. Verify we're on best pricing. |
| Active-Useful | Used regularly, clear value | Keep. Check if alternatives are cheaper. |
| Active-Unclear | Billed regularly, unclear active usage | Find owner. If no owner in 2 weeks, cancel. |
| Dormant | We are paying but nobody is using it | 30-day cancellation notice immediately. |
| Renewable | Annual renewal within 90 days | Evaluate before renewal. Don't auto-accept. |

**Step 3: Optimization review**
For any annual expense >$2,400/yr (>$200/mo):
- Is there a cheaper alternative that does the job?
- Are we on the right pricing tier (over- or under-sized plan)?
- Are there startup credits or discounts available that we haven't applied for?
- If annual vs monthly: is the usage reliable enough to commit to annual for the discount?

**Step 4: Produce vendor audit report**
- Total annual SaaS/vendor spend
- Identified savings (cancelled dormant, downgraded tiers, switched to cheaper alternatives)
- Upcoming renewals with recommendation (renew/evaluate/cancel)
- Flagged items for follow-up

### Startup Credit Programs (Apply if not already enrolled)

| Provider | Program | Value |
|----------|---------|-------|
| AWS | AWS Activate | Up to $100k in credits |
| Google Cloud | Google for Startups | Up to $200k in credits |
| Stripe | Stripe Atlas / startup program | Fee waivers and credits |
| Twilio | Twilio for Startups | Credits |
| Segment | Segment Startup Program | Credits |
| MongoDB | MongoDB for Startups | Credits |
| Notion | Notion for Startups | Discounts |
| Linear | Linear for Startups | Discounts |
| Datadog | Datadog for Startups | Credits |

Check current availability — programs change. If a new provider is being evaluated, always check whether a startup program exists before signing up at full price.

---

## 7. Financial Decision Support Templates

### Expense Request Evaluation Template


When any expense request comes in, apply this framework before making a recommendation:

```
EXPENSE EVALUATION FORM

Request submitted by: [agent/person]
Date received: [date]
Response due: [date — within 48 hours]

WHAT
Description: [What exactly is being purchased]
Vendor/provider: [Name]
Cost: [$] (one-time / monthly / annual)
Start date: [When it would begin]

WHY
Business objective: [What specific outcome does this enable]
Alternatives considered: [Did they evaluate alternatives, or is this the first option]
What happens if we don't do this: [What is the cost of NOT spending]
Minimum viable version: [Is there a cheaper way to test the hypothesis first]

FINANCIAL IMPACT
Is this budgeted: [Yes / No — if yes, which budget line]
If unbudgeted: [What is it replacing, or is this incremental]
Annual cost (if recurring): [$]
Expected ROI: [Specific and measurable if possible]
Success criteria: [How will we know this was worth it]

RECOMMENDATION
[ ] Approve
[ ] Approve with modifications: [specify]
[ ] Deny — reason: [specific]
[ ] Defer — pending: [what information is needed]
[ ] Conditional — will approve if: [conditions]

Notes: [Any additional context]
```

---

## 8. Accounts Payable & Vendor Management

This section covers the operational frameworks for processing payments, managing the vendor registry, enforcing payment controls, and optimizing cash flow through AP timing.

### AP Workflow

The accounts payable workflow runs from invoice receipt through payment confirmation and audit logging. Each step is mandatory; no step may be skipped to accelerate payment.

```
Step 1: Invoice Receipt
  - Receive invoice via designated channel (billing email, agent request, or platform tool)
  - Log invoice: vendor name, invoice number, invoice date, due date, amount, currency, payment method, internal owner
  - Verify invoice number is not a duplicate (check AP register before proceeding)

Step 2: Three-Way Matching
  - Locate the Purchase Order or pre-approved commitment for this invoice
  - Confirm delivery/completion: goods received, services rendered, milestone met
  - Match: PO amount vs. invoice amount vs. confirmed delivery
  - IF ALL THREE MATCH → proceed to approval routing
  - IF ANY MISMATCH → place on hold, notify internal owner and vendor, log discrepancy

Step 3: Approval Routing
  - Apply approval threshold rules (see table below)
  - Under threshold: document internal owner confirmation
  - Above threshold: create approval request via approval_create MCP tool before any action
  - Do not proceed to payment until required approval is documented

Step 4: Payment Execution
  - Confirm recipient address/account matches vendor registry (not just the invoice)
  - If address differs from registry: re-verify via secondary channel before updating registry or paying
  - Select payment rail based on vendor preference, amount, and urgency
  - Execute payment; capture transaction ID or confirmation reference
  - Log payment: invoice reference, amount, rail, recipient, timestamp, approval reference, transaction ID

Step 5: Confirmation & Close
  - Confirm settlement (for crypto: on-chain confirmation; for ACH: bank confirmation)
  - Update invoice status to PAID in AP register
  - Notify requesting agent or internal owner
  - Archive invoice with payment confirmation attached
```

### Approval Thresholds

| Amount | Required approval |
|--------|------------------|
| Under $500 | Team lead confirmation |
| $500 – $5,000 | Finance Manager review + department head confirmation |
| $5,000 – $25,000 | Finance Manager recommendation + Mission Control approval |
| Above $25,000 | Mission Control approval + documented business case |
| Any token/crypto transfer | Mission Control approval regardless of amount |
| New recurring commitment > $1,000/mo | Finance Manager evaluation + Mission Control approval |

All approvals above the $5,000 threshold are routed via `approval_create` MCP tool. No payment above that threshold proceeds without a documented approval reference in the payment log.

### Vendor Onboarding Checklist

Before processing any payment to a new vendor, complete the following:

```
VENDOR ONBOARDING — required before first payment

1. Identity verification
   [ ] Legal entity name confirmed (matches invoice and any contract)
   [ ] Business type: [sole proprietor / LLC / corporation / DAO / other]
   [ ] Registered address or jurisdiction confirmed
   [ ] Tax ID collected if applicable (EIN for US, VAT for EU, etc.)

2. Payment details
   [ ] Preferred payment rail documented: [ACH / wire / USDC / other]
   [ ] Payment details collected directly from vendor (not sourced only from invoice)
   [ ] Payment details confirmed via secondary channel if amount > $1,000
   [ ] Backup payment rail documented (if primary fails)

3. Commercial terms
   [ ] Payment terms: [net 15 / net 30 / on receipt / milestone-based / other]
   [ ] Currency: [USD / USDC / other]
   [ ] Early payment discount available: [yes / no — if yes, terms]
   [ ] Invoicing frequency: [monthly / per milestone / one-time]

4. Internal setup
   [ ] Internal owner assigned (which agent or person manages this relationship)
   [ ] Business purpose documented (what service/good is being purchased)
   [ ] Approval requirement noted: [per-invoice approval / pre-approved recurring amount]
   [ ] 1099 / contractor compliance noted if applicable (US)
   [ ] Added to vendor registry

5. Compliance flags
   [ ] Any international wire restrictions or sanctions screening required: [yes / no]
   [ ] Data handling obligations (vendor has access to user data): [yes / no]
   [ ] Contract on file: [yes / no — if yes, location]
```

### Common Fraud Signals

Place any payment on hold and escalate to Mission Control when any of the following are present:

| Signal | Why it matters |
|--------|---------------|
| Recipient payment details changed from prior payment | Account takeover / payment redirection fraud |
| Invoice arrived via personal email of a contact (not company billing address) | Social engineering / BEC fraud |
| Invoice amount is just below an approval threshold | Threshold-busting to avoid review |
| New vendor requesting urgent payment within 24-48 hours of first contact | Pressure tactic; no established relationship |
| Invoice references a PO number that cannot be located | Fake invoice |
| Existing vendor requests switch from ACH to wire or crypto via email only | Payment redirection fraud |
| Address change request arrives via email with no secondary verification | Account takeover |
| Multiple invoices for the same period from the same vendor for the same service | Duplicate invoice fraud |

**Response to a fraud signal**: Do not process. Log the signal. Notify Mission Control and the internal vendor owner immediately. Require verbal confirmation or a second communication channel (phone call, video, in-person) before any address change or urgent payment is processed. Document the verification method used.

### Payment Terms Negotiation

Payment terms are a negotiable form of working capital. When vendor payment terms can be extended, the company retains cash for longer at no cost. When early payment discounts are available, taking them is often the equivalent of a 20-40% annualized return on capital.

**Framework for evaluating early payment discounts**:
```
Annualized value of discount = (Discount % / (1 - Discount %)) × (365 / Days saved)

Example: 2/10 net 30 (2% discount for paying 20 days early)
= (0.02 / 0.98) × (365 / 20)
= 0.0204 × 18.25
= ~37% annualized

Decision rule:
- If annualized return > current stablecoin yield AND runway > 18 months → take the discount
- If runway is constrained (< 18 months) → preserve cash, use full net terms
```

**Negotiating extended terms**:
- Extended net terms (net 45, net 60, net 90) are most negotiable with larger vendors who value the relationship
- Frame as a business request: "We're managing cash flow carefully; can we move to net 45?"
- Offer something in return when possible: case study, longer contract commitment, referral
- Document any agreed term changes in the vendor registry and flag in the AP workflow

**Terms to negotiate at vendor onboarding**:
- Net payment terms (default: net 30; push for net 45-60 with non-critical vendors)
- Annual vs. monthly billing (annual gives the vendor certainty; ask for a 15-20% discount in return)
- Volume pricing: if you expect to scale usage, lock in volume pricing before you need it
- Startup credits: for SaaS and cloud infrastructure, always ask whether a startup program or credits are available before signing at list price
- Auto-renewal terms: never accept auto-renewal without a defined cancellation window (minimum 30 days notice); document the renewal date in the vendor registry

### AP Aging Schedule

Maintain an AP aging schedule as a live view of all outstanding invoices. Review it weekly; incorporate it into the monthly financial review.

```
AP AGING SCHEDULE
As of: [date] | Next update: [date]

=== CURRENT (due in 0-14 days) ===
[Vendor] | INV-[#] | Due [date] | $[amount] | [status: pending approval / approved / queued]

=== UPCOMING (due in 15-30 days) ===
[Vendor] | INV-[#] | Due [date] | $[amount] | [status]

=== FUTURE (due in 31-60 days) ===
[Vendor] | INV-[#] | Due [date] | $[amount] | [status]

=== ON HOLD (dispute or fraud flag) ===
[Vendor] | INV-[#] | Due [date] | $[amount] | Hold reason: [description] | Owner: [agent]

=== OVERDUE ===
[Vendor] | INV-[#] | Due [date] | $[amount] | Days overdue: [N] | Action: [description]

TOTALS
Current: $[amount] | Upcoming: $[amount] | Future: $[amount] | On hold: $[amount]
Total outstanding AP: $[amount]
Expected cash outflow next 30 days: $[current + upcoming]
```

The AP aging schedule is the input for the 30-day cash outflow forecast. It must be reconciled with the operating treasury balance before any payment batches are run.
