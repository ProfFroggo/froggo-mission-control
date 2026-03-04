import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    const now = Date.now();
    const sessionId = crypto.randomUUID();
    const model = body.model ?? null;

    // Upsert agent_sessions record
    db.prepare(`
      INSERT INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
      VALUES (?, ?, ?, ?, ?, 'active')
      ON CONFLICT (agentId) DO UPDATE SET
        sessionId = excluded.sessionId,
        model = excluded.model,
        lastActivity = excluded.lastActivity,
        status = 'active'
    `).run(agentId, sessionId, model, now, now);

    // Update agent status to active
    db.prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?')
      .run('active', now, agentId);

    return NextResponse.json({ success: true, agentId, sessionId });
  } catch (error) {
    console.error('POST /api/agents/[id]/spawn error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
