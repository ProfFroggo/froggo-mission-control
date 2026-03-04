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

    const { action, adjustedContent, notes } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let status: string;
    if (action === 'approved') {
      status = 'approved';
    } else if (action === 'rejected') {
      status = 'rejected';
    } else if (action === 'adjusted') {
      status = 'adjusted';
    } else {
      return NextResponse.json({ error: 'action must be approved, rejected, or adjusted' }, { status: 400 });
    }

    const respondedAt = Date.now();

    db.prepare(`
      UPDATE approvals
      SET status = ?, respondedAt = ?, adjustedContent = ?, notes = ?
      WHERE id = ?
    `).run(status, respondedAt, adjustedContent ?? null, notes ?? null, id);

    const updated = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id);
    if (!updated) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/approvals/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
