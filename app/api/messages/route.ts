import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// GET /api/messages?limit=N&sessionKey=...
// Returns recent chat messages from the messages table.
// Used by the gateway chat history fallback.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const sessionKey = searchParams.get('sessionKey') ?? null;

    const db = getDb();
    const rows = sessionKey
      ? db.prepare('SELECT * FROM messages WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT ?')
          .all(sessionKey, limit)
      : db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?')
          .all(limit);

    return NextResponse.json({ messages: rows });
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return NextResponse.json({ messages: [] });
  }
}
