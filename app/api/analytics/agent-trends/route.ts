// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

interface DailyRow {
  date: string;
  agent_id: string;
  tasks: number;
  completed: number;
  tokens: number;
}

interface AgentMeta {
  id: string;
  name: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10), 1), 365);
    const agentId = searchParams.get('agentId') ?? null;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const agentFilter = agentId ? 'AND t.assignedTo = ?' : '';
    const queryParams: (number | string)[] = agentId ? [since, agentId] : [since];

    const rows = db
      .prepare(
        `SELECT
           date(t.updatedAt / 1000, 'unixepoch')              AS date,
           t.assignedTo                                         AS agent_id,
           COUNT(*)                                             AS tasks,
           SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed,
           0                                                    AS tokens
         FROM tasks t
         WHERE t.assignedTo IS NOT NULL
           AND t.updatedAt >= ?
           ${agentFilter}
         GROUP BY date, t.assignedTo
         ORDER BY date ASC`
      )
      .all(...queryParams) as DailyRow[];

    // Group by agent
    const agentMap = new Map<
      string,
      { date: string; tasks: number; successRate: number; tokens: number }[]
    >();

    for (const row of rows) {
      if (!agentMap.has(row.agent_id)) agentMap.set(row.agent_id, []);
      agentMap.get(row.agent_id)!.push({
        date: row.date,
        tasks: row.tasks,
        successRate: row.tasks > 0 ? Math.round((row.completed / row.tasks) * 100 * 10) / 10 : 0,
        tokens: row.tokens,
      });
    }

    // Resolve agent names from agents table (best-effort)
    const agentIds = [...agentMap.keys()];
    const metaMap = new Map<string, string>();
    if (agentIds.length > 0) {
      try {
        const placeholders = agentIds.map(() => '?').join(',');
        const metas = db
          .prepare(`SELECT id, name FROM agents WHERE id IN (${placeholders})`)
          .all(...agentIds) as AgentMeta[];
        for (const m of metas) {
          if (m.name) metaMap.set(m.id, m.name);
        }
      } catch {
        // agents table may not exist in all deployments — silently ignore
      }
    }

    const agents = agentIds.map((id) => ({
      id,
      name: metaMap.get(id) ?? id,
      daily: agentMap.get(id) ?? [],
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('GET /api/analytics/agent-trends error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
