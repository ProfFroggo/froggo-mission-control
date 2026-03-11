# Metrics Library — Mission Control Platform

Last updated: 2025-03
Context: DeFi / Crypto wallet product analytics

---

## Metric Definition Standard

Every metric used in any report or dashboard must have an entry in this library before it is used.

**Required fields for every metric:**
- **Name**: Canonical name used in all communications
- **Definition**: Precise description, including what is included and what is excluded
- **Calculation**: The formula or SQL logic
- **Unit**: What the number is measured in (%, count, $, etc.)
- **Source**: Where the data comes from
- **Update frequency**: How often this should be refreshed
- **Owner**: Who is responsible for keeping this accurate

---

## Core Platform Metrics

### Acquisition

---

**New Wallet Connections**
- **Definition**: Count of unique wallet addresses that completed a successful wallet connection for the first time in the period
- **Calculation**: `COUNT(DISTINCT wallet_address) WHERE event = 'wallet_connected' AND is_first_connection = true AND created_at BETWEEN [period_start] AND [period_end]`
- **Unit**: Count
- **Source**: Internal events database
- **Update frequency**: Daily
- **Excludes**: Reconnections of previously connected wallets; test/internal wallets

---

**Onboarding Completion Rate**
- **Definition**: Percentage of users who begin the onboarding flow and reach the first successful transaction within the onboarding window (7 days of starting)
- **Calculation**: `Users completing first_transaction within 7 days of wallet_connected / Users who initiated wallet_connected × 100`
- **Unit**: Percentage
- **Source**: Internal events + wallet activity
- **Update frequency**: Weekly (cohorted by start week)
- **Benchmark**: DeFi consumer apps: 30-50% is typical; target > 45%

---

**Acquisition Channel Mix**
- **Definition**: Distribution of new wallet connections by acquisition source (organic search, paid, referral, direct, unknown)
- **Calculation**: `COUNT(DISTINCT wallet_address) GROUP BY acquisition_source / total new wallets × 100`
- **Unit**: Percentage per channel
- **Source**: UTM attribution from session data
- **Update frequency**: Weekly
- **Note**: UTM attribution in DeFi is unreliable — crypto users block trackers aggressively. Treat "unknown" / "direct" as undercount of organic.

---

### Activation

---

**Day-1 Activation Rate**
- **Definition**: Percentage of new wallets (connected on day 0) that complete the defined activation event within 24 hours
- **Activation event**: First completed transaction (deposit, swap, or other core product action)
- **Calculation**: `Wallets with first_transaction within 24hr of wallet_connected / new wallets on day 0 × 100`
- **Unit**: Percentage
- **Source**: Internal events
- **Update frequency**: Daily, reported weekly (cohorted by connection day)
- **Benchmark**: Target > 35%

---

**Time to First Transaction (T2FT)**
- **Definition**: Median time in hours between wallet_connected event and first_transaction event
- **Calculation**: `MEDIAN(first_transaction_at - wallet_connected_at)` in hours
- **Unit**: Hours (median)
- **Source**: Internal events
- **Update frequency**: Weekly
- **Note**: Use median, not mean. Distribution is typically highly right-skewed (some users take weeks). Mean will be pulled by outliers.

---

**Onboarding Step Drop-off Rate**
- **Definition**: Percentage of users who abandon at each step of the onboarding flow
- **Calculation**: For each step N: `(users completing step N-1 - users completing step N) / users completing step N-1 × 100`
- **Unit**: Percentage per step
- **Source**: Internal events with step_name field
- **Update frequency**: Weekly
- **Use case**: Identify highest-friction step in onboarding for prioritization

---

### Retention

---

**Day-7 Retention**
- **Definition**: Percentage of users first active in week W who are also active in week W+1 (i.e., return within 7-14 days of first activity)
- **Calculation (cohorted)**: `Active wallets in [cohort week + 7 days window] / cohort size × 100`
- **Unit**: Percentage
- **Source**: Internal wallet activity
- **Update frequency**: Weekly (reported by cohort)
- **Benchmark**: DeFi products: 20-35% is typical; target ≥ 28%

---

**Day-30 Retention**
- **Definition**: Percentage of users first active in month M who are also active in month M+1
- **Calculation (cohorted)**: `Active wallets in month M+1 / cohort size (month M) × 100`
- **Unit**: Percentage
- **Source**: Internal wallet activity
- **Update frequency**: Monthly (reported by cohort)

---

**Monthly Active Wallets (MAW)**
- **Definition**: Count of unique wallet addresses with at least one completed transaction in the trailing 30-day window
- **Calculation**: `COUNT(DISTINCT wallet_address) WHERE transaction completed AND transaction_at BETWEEN (today - 30 days) AND today`
- **Unit**: Count
- **Source**: Internal transaction events
- **Update frequency**: Daily (trailing 30-day rolling window)
- **Note**: This is a rolling metric, not a calendar-month metric. Specify which when reporting.

---

**Monthly Churn Rate**
- **Definition**: Percentage of wallets active in month M that have zero activity in month M+1
- **Calculation**: `Wallets active in month M with no activity in M+1 / wallets active in month M × 100`
- **Unit**: Percentage
- **Source**: Internal transaction events
- **Update frequency**: Monthly
- **Note**: Investigate spikes in churn — they often correlate with specific product events or market conditions

---

### Engagement

---

**Transactions per Active Wallet per Month**
- **Definition**: Average number of completed transactions per MAW in a 30-day period
- **Calculation**: `Total completed transactions / Monthly Active Wallets`
- **Unit**: Transactions/wallet
- **Source**: Internal transactions
- **Update frequency**: Monthly
- **Benchmark**: Rising trend = deeper engagement; declining trend = engagement dilution from lower-intent new users

---

**Feature Adoption Rate**
- **Definition**: Percentage of Monthly Active Wallets who use a specific feature within 30 days of its ship date
- **Calculation**: `Unique wallets using feature / MAW in same 30-day window × 100`
- **Unit**: Percentage
- **Source**: Feature-specific events
- **Update frequency**: Measured 14 days and 30 days post-ship
- **Use case**: Validates whether a shipped feature was needed; informs whether a discoverability problem exists

---

### Volume / Revenue

---

**Transaction Volume (USD)**
- **Definition**: Total USD value of completed transactions in the period
- **Calculation**: `SUM(amount_usd) WHERE transaction_status = 'completed' AND transaction_at IN [period]`
- **Unit**: USD
- **Source**: Internal transactions with USD conversion at time of transaction
- **Update frequency**: Daily
- **Note**: Use transaction-time exchange rate, not today's rate. Retroactive revaluation creates accounting confusion.

---

**Average Transaction Size (USD)**
- **Definition**: Median USD value per completed transaction in the period
- **Calculation**: `MEDIAN(amount_usd) WHERE transaction_status = 'completed' AND transaction_at IN [period]`
- **Unit**: USD (median)
- **Source**: Internal transactions
- **Update frequency**: Weekly
- **Note**: Use median. Transaction size distributions are heavily right-skewed by whale activity.

---

### Health / Quality

---

**Transaction Success Rate**
- **Definition**: Percentage of initiated transactions that reach completed status (excluding user-cancelled)
- **Calculation**: `Completed transactions / (Initiated transactions - User-cancelled transactions) × 100`
- **Unit**: Percentage
- **Source**: Internal transaction events
- **Update frequency**: Daily
- **Target**: > 98%
- **Note**: Distinguish between user cancellations (product UX issue) and technical failures (infrastructure issue)

---

**Error Rate**
- **Definition**: Percentage of user sessions containing at least one unhandled JavaScript or API error
- **Calculation**: `Sessions with error event / Total sessions × 100`
- **Unit**: Percentage
- **Source**: Error tracking (client-side events)
- **Update frequency**: Daily
- **Target**: < 1%

---

**Support Ticket Rate**
- **Definition**: Support tickets opened per 1,000 Monthly Active Wallets
- **Calculation**: `Support tickets in period / MAW in same period × 1000`
- **Unit**: Tickets per 1,000 MAW
- **Source**: Support system + MAW metric
- **Update frequency**: Monthly
- **Interpretation**: Declining = product quality improving or self-serve getting better

---

## SQL Query Patterns

### Cohort Retention Table

```sql
WITH cohorts AS (
  SELECT
    wallet_address,
    DATE_TRUNC('week', MIN(first_activity_at)) AS cohort_week
  FROM user_activity
  GROUP BY wallet_address
),
weekly_activity AS (
  SELECT
    wallet_address,
    DATE_TRUNC('week', activity_at) AS activity_week
  FROM user_activity
  GROUP BY wallet_address, activity_week
),
cohort_activity AS (
  SELECT
    c.cohort_week,
    EXTRACT(EPOCH FROM (w.activity_week - c.cohort_week)) / 604800 AS weeks_since_start,
    COUNT(DISTINCT c.wallet_address) AS retained_users
  FROM cohorts c
  JOIN weekly_activity w ON c.wallet_address = w.wallet_address
  WHERE w.activity_week >= c.cohort_week
  GROUP BY c.cohort_week, weeks_since_start
),
cohort_sizes AS (
  SELECT cohort_week, COUNT(*) AS cohort_size
  FROM cohorts
  GROUP BY cohort_week
)
SELECT
  ca.cohort_week,
  cs.cohort_size,
  ca.weeks_since_start,
  ca.retained_users,
  ROUND(ca.retained_users::numeric / cs.cohort_size * 100, 1) AS retention_pct
FROM cohort_activity ca
JOIN cohort_sizes cs ON ca.cohort_week = cs.cohort_week
ORDER BY ca.cohort_week, ca.weeks_since_start;
```

---

### Funnel Analysis

```sql
WITH funnel_events AS (
  SELECT
    wallet_address,
    MAX(CASE WHEN event_name = 'wallet_connected' THEN 1 ELSE 0 END) AS step_1,
    MAX(CASE WHEN event_name = 'onboarding_started' THEN 1 ELSE 0 END) AS step_2,
    MAX(CASE WHEN event_name = 'first_transaction_initiated' THEN 1 ELSE 0 END) AS step_3,
    MAX(CASE WHEN event_name = 'first_transaction_completed' THEN 1 ELSE 0 END) AS step_4
  FROM events
  WHERE event_at BETWEEN '2025-01-01' AND '2025-03-01'
  GROUP BY wallet_address
)
SELECT
  SUM(step_1) AS step_1_count,
  SUM(step_2) AS step_2_count,
  SUM(step_3) AS step_3_count,
  SUM(step_4) AS step_4_count,
  ROUND(SUM(step_2)::numeric / NULLIF(SUM(step_1), 0) * 100, 1) AS step_1_to_2_pct,
  ROUND(SUM(step_3)::numeric / NULLIF(SUM(step_2), 0) * 100, 1) AS step_2_to_3_pct,
  ROUND(SUM(step_4)::numeric / NULLIF(SUM(step_3), 0) * 100, 1) AS step_3_to_4_pct,
  ROUND(SUM(step_4)::numeric / NULLIF(SUM(step_1), 0) * 100, 1) AS overall_conversion_pct
FROM funnel_events;
```

---

### Day-7 Retention by Cohort (PostgreSQL / Supabase)

```sql
WITH first_activity AS (
  SELECT
    wallet_address,
    DATE(MIN(activity_at)) AS first_active_date
  FROM wallet_activity
  GROUP BY wallet_address
),
returning_users AS (
  SELECT DISTINCT
    f.wallet_address,
    f.first_active_date,
    w.activity_at::date AS return_date,
    (w.activity_at::date - f.first_active_date) AS days_since_start
  FROM first_activity f
  JOIN wallet_activity w ON f.wallet_address = w.wallet_address
  WHERE w.activity_at::date BETWEEN f.first_active_date + 7 AND f.first_active_date + 13
)
SELECT
  f.first_active_date AS cohort_date,
  COUNT(DISTINCT f.wallet_address) AS cohort_size,
  COUNT(DISTINCT r.wallet_address) AS returned_day7,
  ROUND(COUNT(DISTINCT r.wallet_address)::numeric / NULLIF(COUNT(DISTINCT f.wallet_address), 0) * 100, 1) AS day7_retention_pct
FROM first_activity f
LEFT JOIN returning_users r ON f.wallet_address = r.wallet_address
GROUP BY f.first_active_date
ORDER BY f.first_active_date;
```

---

### Period-over-Period Comparison

```sql
WITH current_period AS (
  SELECT COUNT(DISTINCT wallet_address) AS maw
  FROM wallet_activity
  WHERE activity_at BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE
),
prior_period AS (
  SELECT COUNT(DISTINCT wallet_address) AS maw
  FROM wallet_activity
  WHERE activity_at BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '30 days'
)
SELECT
  current_period.maw AS current_maw,
  prior_period.maw AS prior_maw,
  current_period.maw - prior_period.maw AS absolute_change,
  ROUND((current_period.maw - prior_period.maw)::numeric / NULLIF(prior_period.maw, 0) * 100, 1) AS pct_change
FROM current_period, prior_period;
```

---

### Segmented Metric Query Template

```sql
-- Always run aggregate first, then segment to find where aggregate hides divergence
SELECT
  [segment_column],               -- e.g., acquisition_channel, country, user_tier
  COUNT(DISTINCT wallet_address) AS wallets,
  COUNT(DISTINCT CASE WHEN [activation_condition] THEN wallet_address END) AS activated,
  ROUND(
    COUNT(DISTINCT CASE WHEN [activation_condition] THEN wallet_address END)::numeric
    / NULLIF(COUNT(DISTINCT wallet_address), 0) * 100, 1
  ) AS activation_rate
FROM [events_or_users_table]
WHERE created_at BETWEEN [period_start] AND [period_end]
GROUP BY [segment_column]
ORDER BY wallets DESC;
```

---

## On-Chain Data Sources Reference

### DefiLlama
- **URL**: `https://defillama.com/` — public UI; `https://api.llama.fi/` — free API
- **Covers**: TVL by protocol and chain, protocol revenue, stablecoin data
- **Strengths**: Broad coverage, updated frequently, open methodology
- **Limitations**: TVL methodology varies by protocol; some protocols self-report
- **Best for**: Protocol TVL comparison, ecosystem health, chain-level TVL

### Dune Analytics
- **URL**: `https://dune.com/`
- **Covers**: Custom SQL queries over indexed blockchain data
- **Strengths**: Flexible, community-built dashboards, primary source blockchain data
- **Limitations**: Query performance varies; some chains have indexing lag
- **Best for**: Custom on-chain analysis, protocol-specific metrics, wallet behavior

### Nansen
- **URL**: `https://nansen.ai/` — paid
- **Covers**: Wallet labeling (smart money, exchanges, protocols), fund flows
- **Strengths**: Wallet labels enable segmentation that raw blockchain data doesn't allow
- **Limitations**: Paid, coverage varies by chain, labels are probabilistic
- **Best for**: Who is using or moving assets, smart money flow analysis

### Glassnode
- **URL**: `https://glassnode.com/` — paid for most metrics
- **Covers**: On-chain metrics for BTC and ETH primarily
- **Strengths**: Deep historical data, institutional-grade methodology
- **Limitations**: Expensive, narrow chain coverage
- **Best for**: Bitcoin/Ethereum macro health metrics

### Etherscan / Block Explorers
- **URL**: `https://etherscan.io/` (Ethereum); chain-specific for others
- **Covers**: Raw transaction data, wallet history, contract interactions
- **Strengths**: Primary source; the truth
- **Limitations**: Not queryable at scale without indexing; not aggregated
- **Best for**: Transaction verification, contract interaction audit, specific wallet lookup

---

## Visualization Best Practices

### Chart Type Selection

| Goal | Chart type | Notes |
|------|-----------|-------|
| Show trend over time | Line chart | Zero-based Y-axis; label the line |
| Compare categories | Bar chart | Horizontal bars for many categories |
| Show composition | Stacked bar or pie | Pie: max 5 slices |
| Show correlation | Scatter plot | Include trendline |
| Show distribution | Histogram or box plot | Avoid hiding skew |
| Show funnel | Horizontal funnel bars | Show % at each step |
| Show retention | Cohort heatmap | Color scale: dark = high retention |

### Non-Negotiable Rules

1. **Y-axis starts at zero for bar charts.** Always. If you need to show variation in a narrow range, use a line chart with an annotation noting the range.
2. **Line charts can have non-zero Y-axis** but must label the axis minimum prominently.
3. **Every chart has a title that answers the question, not describes the chart.** "Day-7 Retention Has Improved 6 Points Since January" not "Day-7 Retention Rate."
4. **Every chart has a time period label.** "Last 90 days (as of 2025-03-01)" not unlabeled.
5. **Color for categories must be accessible.** Never rely on red/green alone for status — use pattern + color.
6. **Delta indicators** (period over period): show the direction, the absolute change, and the percentage change. Not just one of the three.
7. **Don't show 40 metrics on one dashboard.** Three focal metrics on the primary view. Everything else is a drill-down.

### Dashboard Structure

```
Dashboard: [Name]
Audience: [Who reads this]
Decision it supports: [What action does it enable]

Row 1: 3 focal KPIs (big numbers with period-over-period delta)
Row 2: Primary trend chart (30 or 90 day line)
Row 3: Two supporting charts (segmentation, funnel, or cohort)
Row 4: Detail table (sortable, with drill-down)
```

Footer: "Data refreshed: [timestamp] | Source: [system] | Owner: Data Analyst"
