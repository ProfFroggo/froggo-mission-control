// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
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

    let sql: string;
    const values: unknown[] = [roomId];

    if (since) {
      // Incremental fetch — get everything after the given timestamp
      sql = 'SELECT * FROM chat_room_messages WHERE roomId = ? AND timestamp > ? ORDER BY timestamp ASC';
      values.push(Number(since));
    } else {
      // Initial load — get the latest 500 messages (subquery to reverse order)
      sql = 'SELECT * FROM (SELECT * FROM chat_room_messages WHERE roomId = ? ORDER BY timestamp DESC LIMIT 500) ORDER BY timestamp ASC';
    }

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

    const { agentId, content, replyTo, role, mentionedAgents, messageId, timestamp } = body;

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const now = timestamp ?? Date.now();

    const result = db.prepare(`
      INSERT INTO chat_room_messages (roomId, agentId, content, replyTo, timestamp, role, mentionedAgents, messageId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(roomId, agentId, content, replyTo ?? null, now, role ?? 'agent', JSON.stringify(mentionedAgents ?? []), messageId ?? null);

    const message = db.prepare('SELECT * FROM chat_room_messages WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('POST /api/chat-rooms/[roomId]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
