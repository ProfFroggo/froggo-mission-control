import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();
    const messages = db.prepare(
      'SELECT * FROM messages WHERE sessionKey = ? ORDER BY timestamp ASC'
    ).all(key);

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET /api/chat/sessions/[key]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: sessionKey } = await params;
    const db = getDb();
    const body = await request.json();

    const { role, content, channel = 'dashboard', streaming = 0 } = body;

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO messages (id, sessionKey, role, content, timestamp, channel, streaming)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionKey, role, content, now, channel, streaming ? 1 : 0);

    // Update session messageCount and lastActivity
    db.prepare(`
      UPDATE sessions SET messageCount = messageCount + 1, lastActivity = ? WHERE key = ?
    `).run(now, sessionKey);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('POST /api/chat/sessions/[key]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
