// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get('messageId');
  if (!messageId) {
    return NextResponse.json({ error: 'messageId required' }, { status: 400 });
  }
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT reaction, COUNT(*) as count, GROUP_CONCAT(userId) as users FROM message_reactions WHERE messageId = ? GROUP BY reaction'
    ).all(messageId) as { reaction: string; count: number; users: string }[];

    const reactions = rows.map(r => ({
      reaction: r.reaction,
      count: r.count,
      users: r.users ? r.users.split(',') : [],
    }));
    return NextResponse.json({ reactions });
  } catch (error) {
    console.error('GET /api/chat/reactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: toggle reaction (add if not present, remove if already present)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, reaction, userId = 'user' } = body as {
      messageId: string;
      reaction: string;
      userId?: string;
    };

    if (!messageId || !reaction) {
      return NextResponse.json({ error: 'messageId and reaction required' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare(
      'SELECT id FROM message_reactions WHERE messageId = ? AND userId = ? AND reaction = ?'
    ).get(messageId, userId, reaction);

    let added: boolean;
    if (existing) {
      db.prepare(
        'DELETE FROM message_reactions WHERE messageId = ? AND userId = ? AND reaction = ?'
      ).run(messageId, userId, reaction);
      added = false;
    } else {
      db.prepare(
        'INSERT INTO message_reactions (messageId, userId, reaction) VALUES (?, ?, ?)'
      ).run(messageId, userId, reaction);
      added = true;
    }

    // Return updated counts for this message
    const rows = db.prepare(
      'SELECT reaction, COUNT(*) as count, GROUP_CONCAT(userId) as users FROM message_reactions WHERE messageId = ? GROUP BY reaction'
    ).all(messageId) as { reaction: string; count: number; users: string }[];

    const reactions = rows.map(r => ({
      reaction: r.reaction,
      count: r.count,
      users: r.users ? r.users.split(',') : [],
    }));

    return NextResponse.json({ success: true, added, reactions });
  } catch (error) {
    console.error('POST /api/chat/reactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
