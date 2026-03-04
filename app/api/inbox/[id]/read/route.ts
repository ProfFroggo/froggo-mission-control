import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const result = db.prepare('UPDATE inbox SET isRead = 1 WHERE id = ?').run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, isRead: true });
  } catch (error) {
    console.error('POST /api/inbox/[id]/read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
