import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE key = ?').get(key);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('GET /api/chat/sessions/[key] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();

    // Delete messages first (cascade should handle it, but explicit for safety)
    db.prepare('DELETE FROM messages WHERE sessionKey = ?').run(key);
    const result = db.prepare('DELETE FROM sessions WHERE key = ?').run(key);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/chat/sessions/[key] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
