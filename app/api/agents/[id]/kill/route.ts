import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const guard = validateAgentId(agentId);
    if (guard) return guard;
    const db = getDb();
    const now = Date.now();

    // Set agent status to offline and clear sessionKey
    db.prepare('UPDATE agents SET status = ?, sessionKey = NULL, lastActivity = ? WHERE id = ?')
      .run('offline', now, agentId);

    // Update agent_sessions status to terminated
    db.prepare(`
      UPDATE agent_sessions SET status = 'terminated', lastActivity = ? WHERE agentId = ?
    `).run(now, agentId);

    return NextResponse.json({ success: true, agentId });
  } catch (error) {
    console.error('POST /api/agents/[id]/kill error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
