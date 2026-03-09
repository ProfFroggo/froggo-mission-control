// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

interface AgentHealth {
  agentId: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  lastActivity: number | null;
  sessionAge: number | null;
  activeTask: { id: string; title: string; progress: number } | null;
  errorCount: number;
  totalInvocations: number;
  totalCostUsd: number;
}

export async function GET() {
  try {
    const db = getDb();
    const since = Date.now() - 24 * 60 * 60 * 1000; // last 24 hours

    // All agents
    const agents = db.prepare('SELECT id, name FROM agents ORDER BY id').all() as { id: string; name: string }[];

    const health: AgentHealth[] = agents.map((agent) => {
      // Latest session
      const session = db.prepare(
        'SELECT lastActivity FROM agent_sessions WHERE agentId = ? ORDER BY lastActivity DESC LIMIT 1'
      ).get(agent.id) as { lastActivity: number } | undefined;

      // Active in-progress task
      const activeTask = db.prepare(
        "SELECT id, title, progress FROM tasks WHERE assignedTo = ? AND status = 'in-progress' LIMIT 1"
      ).get(agent.id) as { id: string; title: string; progress: number } | undefined;

      // Error count from task_activity in last 24 hours
      const errorRow = db.prepare(
        "SELECT COUNT(*) AS cnt FROM task_activity WHERE agentId = ? AND action IN ('dispatch_error','agent_error') AND timestamp >= ?"
      ).get(agent.id, since) as { cnt: number };

      // Token invocations + cost in last 24 hours
      const tokenRow = db.prepare(
        'SELECT COUNT(*) AS invocations, COALESCE(SUM(costUsd), 0) AS totalCost FROM token_usage WHERE agentId = ? AND timestamp >= ?'
      ).get(agent.id, since) as { invocations: number; totalCost: number };

      const lastActivity = session?.lastActivity ?? null;
      const sessionAge = lastActivity ? Date.now() - lastActivity : null;

      let status: 'active' | 'idle' | 'error' = 'idle';
      if (errorRow.cnt > 0) status = 'error';
      else if (activeTask) status = 'active';
      else if (sessionAge !== null && sessionAge < 5 * 60 * 1000) status = 'active';

      return {
        agentId: agent.id,
        name: agent.name,
        status,
        lastActivity,
        sessionAge,
        activeTask: activeTask ?? null,
        errorCount: errorRow.cnt,
        totalInvocations: tokenRow.invocations,
        totalCostUsd: tokenRow.totalCost,
      };
    });

    return NextResponse.json({ agents: health, updatedAt: Date.now() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
