import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');

    let sql = 'SELECT * FROM chat_room_messages WHERE roomId = ?';
    const values: unknown[] = [roomId];

    if (since) {
      sql += ' AND timestamp > ?';
      values.push(Number(since));
    }

    sql += ' ORDER BY timestamp ASC';

    const messages = db.prepare(sql).all(...values);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET /api/chat-rooms/[roomId]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const db = getDb();
    const body = await request.json();

    const { agentId, content, replyTo } = body;

    if (!agentId || !content) {
      return NextResponse.json({ error: 'agentId and content are required' }, { status: 400 });
    }

    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO chat_room_messages (roomId, agentId, content, replyTo, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(roomId, agentId, content, replyTo ?? null, now);

    const message = db.prepare('SELECT * FROM chat_room_messages WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('POST /api/chat-rooms/[roomId]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
