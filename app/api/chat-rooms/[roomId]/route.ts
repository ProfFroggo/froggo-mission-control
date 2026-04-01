// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// PATCH /api/chat-rooms/[roomId] — update room name, description, pinnedMessageId
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { name, description, pinnedMessageId } = body as {
      name?: string;
      description?: string;
      pinnedMessageId?: string | null;
    };

    const db = getDb();
    const room = db.prepare('SELECT id FROM chat_rooms WHERE id = ?').get(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (pinnedMessageId !== undefined) { updates.push('pinnedMessageId = ?'); values.push(pinnedMessageId ?? null); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updatedAt = ?');
    values.push(Date.now());
    values.push(roomId);

    db.prepare(`UPDATE chat_rooms SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/chat-rooms/[roomId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/chat-rooms/[roomId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const db = getDb();
    db.prepare('DELETE FROM chat_rooms WHERE id = ?').run(roomId);
    db.prepare('DELETE FROM chat_room_messages WHERE roomId = ?').run(roomId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/chat-rooms/[roomId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
