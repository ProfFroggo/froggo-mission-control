import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    // Check for existing active session
    const existing = db.prepare(
      'SELECT sessionId FROM agent_sessions WHERE agentId = ? AND status = ?'
    ).get(id, 'active') as { sessionId: string } | undefined;

    let command: string;
    let resumed = false;
    if (existing?.sessionId) {
      command = `claude --resume ${existing.sessionId} --agents ${id}`;
      resumed = true;
    } else {
      command = `claude --agents ${id}`;
    }

    const now = Date.now();

    if (!resumed) {
      const sessionId = crypto.randomUUID();
      const model = body.model ?? null;
      db.prepare(`
        INSERT INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
        VALUES (?, ?, ?, ?, ?, 'active')
        ON CONFLICT (agentId) DO UPDATE SET
          sessionId = excluded.sessionId,
          model = excluded.model,
          lastActivity = excluded.lastActivity,
          status = 'active'
      `).run(id, sessionId, model, now, now);
    } else {
      db.prepare('UPDATE agent_sessions SET lastActivity = ? WHERE agentId = ?')
        .run(now, id);
    }

    db.prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?')
      .run('active', now, id);

    return NextResponse.json({ success: true, command, resumed });
  } catch (error) {
    console.error('POST /api/agents/[id]/spawn error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
