// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Shared budget types and helpers used by API routes and budget alert system.

import { getDb } from '@/lib/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BudgetRow {
  id: string;
  name: string;
  agentId: string | null;
  period: string;
  limitUsd: number;
  alertAt: number;
  createdAt: number;
}

export type Period = 'daily' | 'weekly' | 'monthly';

// ── Period helpers ─────────────────────────────────────────────────────────────

export function periodStartMs(period: Period): number {
  const now = new Date();
  switch (period) {
    case 'daily': {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    case 'weekly': {
      const day = now.getDay();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime();
    }
    case 'monthly': {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
  }
}

// ── Spend calculation ─────────────────────────────────────────────────────────

export function calculatePeriodSpend(
  db: ReturnType<typeof getDb>,
  budget: BudgetRow
): number {
  const since = periodStartMs(budget.period as Period);
  const agentFilter = budget.agentId ? 'AND agentId = ?' : '';
  const args: unknown[] = budget.agentId ? [since, budget.agentId] : [since];

  const row = db.prepare(
    `SELECT COALESCE(SUM(costUsd), 0) AS spend FROM token_usage WHERE timestamp >= ? ${agentFilter}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).get(...(args as any[])) as { spend: number };

  return row?.spend ?? 0;
}
