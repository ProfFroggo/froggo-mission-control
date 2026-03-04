import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const { status } = body;
    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const now = Date.now();
    const result = db.prepare(
      'UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?'
    ).run(status, now, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, status, lastActivity: now });
  } catch (error) {
    console.error('PATCH /api/agents/[id]/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
