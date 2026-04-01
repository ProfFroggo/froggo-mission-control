// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rooms = db.prepare(`
      SELECT r.*, COUNT(m.id) AS messageCount
      FROM chat_rooms r
      LEFT JOIN chat_room_messages m ON m.roomId = r.id
      GROUP BY r.id
      ORDER BY r.createdAt ASC
    `).all();
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

    if (!name || typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'name is required and must be 200 characters or fewer' }, { status: 400 });
    }
    if (agents !== undefined && !Array.isArray(agents)) {
      return NextResponse.json({ error: 'agents must be an array' }, { status: 400 });
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
