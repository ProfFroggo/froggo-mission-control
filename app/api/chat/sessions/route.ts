import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT s.*, a.name as agentName, a.avatar as agentAvatar
      FROM sessions s
      LEFT JOIN agents a ON s.agentId = a.id
      ORDER BY s.lastActivity DESC
    `).all();

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('GET /api/chat/sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { agentId } = body;
    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const now = Date.now();
    const key = `agent:${agentId}:${now}`;

    db.prepare(`
      INSERT INTO sessions (key, agentId, createdAt, lastActivity, messageCount)
      VALUES (?, ?, ?, ?, 0)
    `).run(key, agentId, now, now);

    const session = db.prepare('SELECT * FROM sessions WHERE key = ?').get(key);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('POST /api/chat/sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
