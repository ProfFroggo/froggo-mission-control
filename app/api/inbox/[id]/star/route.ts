import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    const starred = body.starred !== false ? 1 : 0;

    const result = db.prepare('UPDATE inbox SET starred = ? WHERE id = ?').run(starred, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, starred: starred === 1 });
  } catch (error) {
    console.error('POST /api/inbox/[id]/star error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
