// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';

interface PresenceEntry {
  id: string;
  name: string;
  avatar?: string;
  joinedAt: number;
}

// In-memory store: roomId -> Map<userId, PresenceEntry>
const presenceStore = new Map<string, Map<string, PresenceEntry>>();

// Clean up stale presence entries (older than 30 minutes)
const STALE_MS = 30 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [roomId, users] of presenceStore.entries()) {
    for (const [userId, entry] of users.entries()) {
      if (now - entry.joinedAt > STALE_MS) {
        users.delete(userId);
      }
    }
    if (users.size === 0) presenceStore.delete(roomId);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  if (!roomId) {
    return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  }
  cleanup();
  const users = Array.from(presenceStore.get(roomId)?.values() ?? []);
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roomId, userId = 'user', name = 'You', avatar } = body as {
      action: 'join' | 'leave';
      roomId: string;
      userId?: string;
      name?: string;
      avatar?: string;
    };

    if (!action || !roomId) {
      return NextResponse.json({ error: 'action and roomId required' }, { status: 400 });
    }

    if (action === 'join') {
      if (!presenceStore.has(roomId)) {
        presenceStore.set(roomId, new Map());
      }
      presenceStore.get(roomId)!.set(userId, {
        id: userId,
        name,
        avatar,
        joinedAt: Date.now(),
      });
    } else if (action === 'leave') {
      presenceStore.get(roomId)?.delete(userId);
    }

    cleanup();
    const users = Array.from(presenceStore.get(roomId)?.values() ?? []);
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('POST /api/chat/presence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
