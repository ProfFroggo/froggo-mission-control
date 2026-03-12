// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const session = db.prepare('SELECT * FROM agent_sessions WHERE agentId = ?').get(id);
    return NextResponse.json(session || { agentId: id, sessionId: null, status: 'none' });
  } catch (error) {
    console.error('GET /api/agents/[id]/session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const { sessionId, model } = await request.json();
    const now = Date.now();
    db.prepare(`INSERT OR REPLACE INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
      VALUES (?, ?, ?, ?, ?, 'active')`).run(id, sessionId, model || 'claude-sonnet-4-5', now, now);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/agents/[id]/session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    // Clear all session key variants for this agent (raw, chat:, modal:)
    const stmt = db.prepare('DELETE FROM agent_sessions WHERE agentId = ?');
    stmt.run(id);
    stmt.run(`chat:${id}`);
    stmt.run(`modal:${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/agents/[id]/session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
