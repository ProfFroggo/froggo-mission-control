# Volume Tracking Methodology

## What Counts as Volume

Volume is the total USD-equivalent value of onchain transactions processed through Bitso's infrastructure. This includes:

- Direct crypto-to-fiat settlements
- Cross-chain transfers through Bitso rails
- Integration partner transaction volume attributed to onchain growth
- Programmatic/API-driven volume from institutional partners

Volume does NOT include:
- Internal transfers between Bitso wallets
- Test transactions
- Failed transactions (even if partially processed)

## Calculation

Volume is calculated daily, aggregated weekly and monthly. The primary metric is USD-equivalent at time of transaction. For volatile assets, the price at block confirmation time is used.

**Comp multiplier:** Volume / total compensation cost for the Onchain Growth function. Q1 2026: 4.8x. This is the efficiency metric that demonstrates the function's ROI. Track it monthly.

## Event-Driven vs. Steady-State Patterns

Onchain Growth volume is not linear. It follows an event-driven pattern:
- Integration launches produce volume spikes (first 2–4 weeks)
- Protocol events (airdrops, migrations, major DeFi launches) create temporary surges
- Steady-state volume is lower but more predictable
- Q1 2026 was heavily event-driven ($69.5M on $77.25M cumulative = 90% of all-time volume in one quarter)

When reporting, always distinguish between event-driven and steady-state volume. This prevents stakeholders from extrapolating spikes into linear forecasts.

## Quarterly Reporting Structure

1. **Headline number:** Total volume for the period
2. **Comp multiplier:** Volume / compensation cost
3. **Volume composition:** Event-driven vs. steady-state breakdown
4. **Chain contribution:** Volume by chain, ranked
5. **Pipeline impact:** Expected volume from integrations in progress
6. **Failure cost:** Volume lost to production incidents (failure rate x affected transactions)

## Stress Testing

Volume projections should be stress-tested against:
- What if the top chain contributes 50% less next quarter?
- What if no new integrations ship?
- What is the floor (steady-state only, no events)?
- What is the ceiling (all pipeline integrations ship on time + favorable events)?

Reference: The Mixpanel stress test from Q1 2026 is the template for this analysis.
