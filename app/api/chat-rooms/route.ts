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
