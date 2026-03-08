import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rooms = db.prepare('SELECT * FROM chat_rooms ORDER BY createdAt ASC').all();
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('GET /api/chat-rooms error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const { id, name, topic, agents } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const roomId = id || `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    db.prepare(`
      INSERT OR IGNORE INTO chat_rooms (id, name, topic, agents, updatedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(roomId, name, topic ?? '', JSON.stringify(agents ?? []), now, now);

    const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('POST /api/chat-rooms error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
