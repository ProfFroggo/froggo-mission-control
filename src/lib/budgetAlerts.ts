// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Budget alert helper — called after every token usage write.
// Checks all applicable budgets for the agent and emits SSE alerts.

import type Database from 'better-sqlite3';
import { emitSSEEvent } from './sseEmitter';

interface BudgetRow {
  id: string;
  name: string;
  agentId: string | null;
  period: string;
  limitUsd: number;
  alertAt: number;
}

type Period = 'daily' | 'weekly' | 'monthly';

function periodStartMs(period: Period): number {
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

export function checkBudgetAlerts(
  db: Database.Database,
  agentId: string
): void {
  try {
    const budgets = db
      .prepare('SELECT * FROM budgets WHERE agentId = ? OR agentId IS NULL')
      .all(agentId) as BudgetRow[];

    for (const budget of budgets) {
      try {
        const since = periodStartMs(budget.period as Period);
        const agentFilter = budget.agentId ? 'AND agentId = ?' : '';
        const args: unknown[] = budget.agentId ? [since, budget.agentId] : [since];

        const row = db
          .prepare(
            `SELECT COALESCE(SUM(costUsd), 0) AS spend FROM token_usage WHERE timestamp >= ? ${agentFilter}`
          )
          .get(...args) as { spend: number };

        const spent = row?.spend ?? 0;
        const pct = budget.limitUsd > 0 ? (spent / budget.limitUsd) * 100 : 0;

        if (pct >= budget.alertAt) {
          emitSSEEvent('budget.alert', {
            budgetId: budget.id,
            name: budget.name,
            agentId: budget.agentId ?? null,
            period: budget.period,
            spent,
            limit: budget.limitUsd,
            pct,
            exceeded: pct >= 100,
          });
        }
      } catch {
        // Per-budget errors are non-fatal
      }
    }
  } catch {
    // Non-fatal — budget alerts must never break token logging
  }
}
