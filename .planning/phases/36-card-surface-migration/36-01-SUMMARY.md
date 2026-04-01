# Phase 36: Card & Surface Migration

## Status: COMPLETE (2026-03-24)

## What Was Done

### AgentMetricsCard.tsx — Radix Card
- Imported `Card` from `@radix-ui/themes`
- `Stat` component: replaced `<div className="bg-mission-control-bg rounded-lg p-3">` with `<Card size="1" variant="surface">`
- Affects all expanded agent metric views (OrchestratorMetrics, HRMetrics, etc.) that use the shared `Stat` component

### AgentPanel.tsx — Radix Badge
- Imported `Badge` from `@radix-ui/themes`
- Agent status badge (busy/disabled/suspended/archived/draft): replaced custom `<span>` with Radix `<Badge>`
  - busy → orange, suspended → red, draft → blue, others → gray
  - `variant="soft"`, `size="1"`
- Circuit breaker badge: replaced `<span>` with `<Badge color="red" variant="soft" size="1">`

## Agent card containers (the rounded-2xl cards) were intentionally left as-is
- They use `absolute` positioning, custom `theme.border`, and complex interactive overlay buttons
- Wrapping in Radix `<Card>` would conflict with `position: relative/absolute` assumptions
- This is the safe minimal approach per the phase instructions

## Build: PASS
